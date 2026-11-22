package com.ott24x7.ai.data

import org.json.JSONArray
import org.json.JSONObject
import java.nio.charset.StandardCharsets
import java.security.MessageDigest

data class PcAgent(
    val id: String,
    val name: String,
    val emoji: String = "",
    val modelName: String = "",
    val pcId: String = "",
    val pcName: String = ""
)

data class PcWorkspace(val id: String, val name: String, val system: Boolean)

data class AgentCursor(val sessionId: String, val streamEpoch: String, val seq: Long) {
    fun toJson(): JSONObject = JSONObject()
        .put("sessionId", sessionId)
        .put("streamEpoch", streamEpoch)
        .put("seq", seq.toString())
}

data class PcSession(
    val sessionId: String,
    val agentId: String,
    val workspaceId: String,
    val title: String,
    val historyRevision: Long,
    val idleRevision: Long,
    val activeExecutionId: String?
)

data class AgentPart(
    val partId: String,
    val revision: Long,
    val kind: String,
    val state: String,
    val text: String
)

data class AgentMessage(
    val messageId: String,
    val revision: Long,
    val role: String,
    val status: String,
    val partIds: List<String>
)

data class AgentExecution(
    val executionId: String,
    val status: String,
    val messageId: String?,
    val errorMessage: String?
)

data class AgentInteraction(
    val interactionId: String,
    val revision: Long,
    val executionId: String,
    val status: String,
    val summary: String,
    val inputDigest: String,
    val kind: String
)

data class AgentProjection(
    var session: PcSession,
    var cursor: AgentCursor,
    val messages: MutableMap<String, AgentMessage> = mutableMapOf(),
    val parts: MutableMap<String, AgentPart> = mutableMapOf(),
    val executions: MutableMap<String, AgentExecution> = mutableMapOf(),
    val interactions: MutableMap<String, AgentInteraction> = mutableMapOf()
) {
    val assistantText: String
        get() = messages.values
            .filter { it.role == "assistant" }
            .maxByOrNull { it.revision }
            ?.partIds
            ?.mapNotNull { parts[it] }
            ?.filter { it.kind == "text" || it.kind == "reasoning" }
            ?.joinToString("") { it.text }
            .orEmpty()

    val activeExecution: AgentExecution?
        get() = executions.values.firstOrNull { it.executionId == session.activeExecutionId }
            ?: executions.values.maxByOrNull { it.executionId }

    val pendingInteraction: AgentInteraction?
        get() = interactions.values.firstOrNull { it.status == "pending" }
}

sealed interface AgentReducerResult {
    data class Applied(val projection: AgentProjection) : AgentReducerResult
    data class RecoveryRequired(val reason: String) : AgentReducerResult
}

object AgentEventReducer {
    fun initial(session: PcSession, cursor: AgentCursor): AgentProjection = AgentProjection(session, cursor)

    fun apply(projection: AgentProjection, batch: JSONObject): AgentReducerResult {
        if (batch.optString("sessionId") != projection.cursor.sessionId || batch.optString("streamEpoch") != projection.cursor.streamEpoch) {
            return AgentReducerResult.RecoveryRequired("epoch")
        }
        val events = batch.optJSONArray("events") ?: return AgentReducerResult.RecoveryRequired("content")
        val next = projection.copy(
            messages = projection.messages.toMutableMap(),
            parts = projection.parts.toMutableMap(),
            executions = projection.executions.toMutableMap(),
            interactions = projection.interactions.toMutableMap()
        )
        var previous = -1L
        for (index in 0 until events.length()) {
            val event = events.optJSONObject(index) ?: return AgentReducerResult.RecoveryRequired("content")
            val seq = event.decimal("seq") ?: return AgentReducerResult.RecoveryRequired("content")
            if (previous >= 0 && seq != previous + 1) return AgentReducerResult.RecoveryRequired("gap")
            previous = seq
            if (seq <= next.cursor.seq) continue
            if (seq != next.cursor.seq + 1) return AgentReducerResult.RecoveryRequired("gap")
            when (applyEvent(next, event.optString("kind"), event.optJSONObject("payload") ?: JSONObject())) {
                null -> return AgentReducerResult.RecoveryRequired("revision")
                "content" -> return AgentReducerResult.RecoveryRequired("content")
            }
            next.cursor = next.cursor.copy(seq = seq)
        }
        return AgentReducerResult.Applied(next)
    }

    private fun applyEvent(projection: AgentProjection, kind: String, payload: JSONObject): String? {
        when (kind) {
            "session.updated" -> {
                val session = parseSession(payload) ?: return null
                if (session.sessionId != projection.cursor.sessionId) return null
                projection.session = session
            }
            "execution.updated" -> {
                val execution = parseExecution(payload) ?: return null
                projection.executions[execution.executionId] = execution
                if (execution.status in setOf("running", "awaiting-approval", "finalizing")) {
                    projection.session = projection.session.copy(activeExecutionId = execution.executionId)
                } else if (projection.session.activeExecutionId == execution.executionId) {
                    projection.session = projection.session.copy(activeExecutionId = null)
                }
            }
            "message.created" -> {
                val message = parseMessage(payload) ?: return null
                if (message.partIds.isNotEmpty() || projection.messages.containsKey(message.messageId)) return null
                projection.messages[message.messageId] = message
            }
            "message.updated" -> {
                val message = parseMessage(payload.optJSONObject("message") ?: return null) ?: return null
                val base = payload.decimal("baseRevision") ?: return null
                val previous = projection.messages[message.messageId] ?: return null
                if (!validRevision(previous.revision, base, message.revision) || previous.partIds != message.partIds) return null
                projection.messages[message.messageId] = message
            }
            "message.removed" -> {
                val id = payload.optString("messageId")
                val previous = projection.messages[id] ?: return null
                val base = payload.decimal("baseRevision") ?: return null
                val revision = payload.decimal("revision") ?: return null
                if (!validRevision(previous.revision, base, revision)) return null
                previous.partIds.forEach { projection.parts.remove(it) }
                projection.messages.remove(id)
            }
            "part.created" -> {
                val messageId = payload.optString("messageId")
                val message = projection.messages[messageId] ?: return null
                val part = parsePart(payload.optJSONObject("part") ?: return null) ?: return null
                val base = payload.decimal("messageBaseRevision") ?: return null
                val revision = payload.decimal("messageRevision") ?: return null
                if (!validRevision(message.revision, base, revision) || projection.parts.containsKey(part.partId)) return null
                val after = if (payload.isNull("afterPartId")) null else payload.optString("afterPartId")
                val position = if (after == null) 0 else message.partIds.indexOf(after).let { if (it < 0) return null else it + 1 }
                val ids = message.partIds.toMutableList().apply { add(position, part.partId) }
                projection.messages[messageId] = message.copy(revision = revision, partIds = ids)
                projection.parts[part.partId] = part
            }
            "part.append" -> {
                val messageId = payload.optString("messageId")
                val partId = payload.optString("partId")
                if (projection.messages[messageId]?.partIds?.contains(partId) != true) return null
                val part = projection.parts[partId] ?: return null
                val base = payload.decimal("baseRevision") ?: return null
                val revision = payload.decimal("revision") ?: return null
                val offset = payload.decimal("offsetUtf8") ?: return "content"
                if (!validRevision(part.revision, base, revision) || part.state != "streaming" || utf8Length(part.text) != offset) return "content"
                projection.parts[partId] = part.copy(revision = revision, text = part.text + payload.optString("text"))
            }
            "part.replaced" -> {
                val part = parsePart(payload.optJSONObject("part") ?: return null) ?: return null
                val previous = projection.parts[part.partId] ?: return null
                val base = payload.decimal("baseRevision") ?: return null
                if (!validRevision(previous.revision, base, part.revision)) return null
                projection.parts[part.partId] = part
            }
            "part.completed" -> {
                val partId = payload.optString("partId")
                val part = projection.parts[partId] ?: return null
                val base = payload.decimal("baseRevision") ?: return null
                val revision = payload.decimal("revision") ?: return null
                if (!validRevision(part.revision, base, revision) || part.state != "streaming") return null
                val expectedLength = payload.decimal("byteLength") ?: return "content"
                val expectedHash = payload.optString("sha256")
                val bytes = part.text.toByteArray(StandardCharsets.UTF_8)
                if (bytes.size.toLong() != expectedLength || sha256Hex(bytes) != expectedHash) return "content"
                projection.parts[partId] = part.copy(revision = revision, state = "completed")
            }
            "part.removed" -> {
                val messageId = payload.optString("messageId")
                val partId = payload.optString("partId")
                val message = projection.messages[messageId] ?: return null
                val part = projection.parts[partId] ?: return null
                val base = payload.decimal("baseRevision") ?: return null
                val revision = payload.decimal("revision") ?: return null
                val messageBase = payload.decimal("messageBaseRevision") ?: return null
                val messageRevision = payload.decimal("messageRevision") ?: return null
                if (!validRevision(part.revision, base, revision) || !validRevision(message.revision, messageBase, messageRevision)) return null
                projection.parts.remove(partId)
                projection.messages[messageId] = message.copy(revision = messageRevision, partIds = message.partIds - partId)
            }
            "interaction.updated" -> {
                val interaction = parseInteraction(payload) ?: return null
                val previous = projection.interactions[interaction.interactionId]
                if (previous != null && interaction.revision <= previous.revision) return null
                projection.interactions[interaction.interactionId] = interaction
            }
            "history.committed" -> {
                val revision = payload.decimal("historyRevision") ?: return null
                if (revision <= projection.session.historyRevision) return null
                projection.session = projection.session.copy(historyRevision = revision)
            }
        }
        return "ok"
    }

    fun parseSession(value: JSONObject): PcSession? {
        val id = value.optString("sessionId").takeIf(String::isNotBlank) ?: return null
        return PcSession(id, value.optString("agentId"), value.optString("workspaceId"), value.optString("title"), value.decimal("historyRevision") ?: 0L, value.decimal("idleRevision") ?: 0L, value.optString("activeExecutionId").takeIf(String::isNotBlank))
    }

    fun parseMessage(value: JSONObject): AgentMessage? {
        val id = value.optString("messageId").takeIf(String::isNotBlank) ?: return null
        val parts = value.optJSONArray("partIds") ?: JSONArray()
        return AgentMessage(id, value.decimal("revision") ?: 0L, value.optString("role"), value.optString("status"), (0 until parts.length()).map { parts.optString(it) })
    }

    fun parsePart(value: JSONObject): AgentPart? {
        val id = value.optString("partId").takeIf(String::isNotBlank) ?: return null
        val content = value.optJSONObject("content")
        return AgentPart(id, value.decimal("revision") ?: 0L, value.optString("kind"), value.optString("state"), content?.optString("text").orEmpty())
    }

    private fun parseExecution(value: JSONObject): AgentExecution? {
        val id = value.optString("executionId").takeIf(String::isNotBlank) ?: return null
        return AgentExecution(id, value.optString("status"), value.optString("messageId").takeIf(String::isNotBlank), value.optJSONObject("failure")?.optString("message"))
    }

    private fun parseInteraction(value: JSONObject): AgentInteraction? {
        val id = value.optString("interactionId").takeIf(String::isNotBlank) ?: return null
        return AgentInteraction(id, value.decimal("revision") ?: 0L, value.optString("executionId"), value.optString("status"), value.optString("summary"), value.optString("inputDigest"), value.optString("kind", "decision"))
    }

    private fun validRevision(current: Long, base: Long, next: Long): Boolean = current == base && next > base
    private fun utf8Length(value: String): Long = value.toByteArray(StandardCharsets.UTF_8).size.toLong()
    private fun sha256Hex(value: ByteArray): String = MessageDigest.getInstance("SHA-256").digest(value).joinToString("") { "%02x".format(it) }
}

private fun JSONObject.decimal(key: String): Long? = optString(key).toLongOrNull()
