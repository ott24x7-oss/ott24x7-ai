package com.ott24x7.ai.data

import okhttp3.OkHttpClient
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.TimeUnit

class PcUnreachableException : Exception()
class PcTokenExpiredException : Exception()
class PcAgentUnavailableException(message: String? = null) : Exception(message)
class PcAgentRecoveryException : Exception()

sealed interface PcInteractionResponse {
    data object Approve : PcInteractionResponse
    data object Deny : PcInteractionResponse
    data class Answer(val value: String) : PcInteractionResponse
}

data class PcInteractionPrompt(
    val interactionId: String,
    val revision: Long,
    val executionId: String,
    val inputDigest: String,
    val summary: String,
    val question: Boolean,
    val inputText: String,
    val questionKey: String = ""
)

data class PcChatResult(val sessionId: String, val executionId: String, val text: String)

class PcAgentClient(
    private val identity: PairingIdentity,
    private var pc: PairedPc,
    private val onPcUpdated: (PairedPc) -> Unit = {},
    private val httpClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .writeTimeout(5, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()
) {
    suspend fun listAgents(): List<PcAgent> = withConnection { channel ->
        val result = call(channel, "agent.agents.list", JSONObject().put("limit", 100))
        val items = result.optJSONArray("items") ?: JSONArray()
        (0 until items.length()).mapNotNull { index ->
            val item = items.optJSONObject(index) ?: return@mapNotNull null
            val id = item.optString("agentId").takeIf(String::isNotBlank) ?: return@mapNotNull null
            PcAgent(
                id = id,
                name = item.optString("name").ifBlank { id },
                emoji = item.optString("emoji"),
                modelName = item.optJSONObject("model")?.optString("name").orEmpty(),
                pcId = pc.deviceId,
                pcName = pc.name
            )
        }
    }

    suspend fun chat(
        agentId: String,
        text: String,
        existingSessionId: String?,
        onText: (String) -> Unit,
        onExecution: (String, String) -> Unit,
        onInteraction: suspend (PcInteractionPrompt) -> PcInteractionResponse
    ): PcChatResult = withConnection { channel ->
        val session = getOrCreateSession(channel, agentId, existingSessionId)
        val prepared = call(channel, "agent.sessions.subscribe", JSONObject().put("sessionId", session.sessionId))
        var projection = when (prepared.optString("mode")) {
            "replay" -> AgentEventReducer.initial(session, parseCursor(prepared.optJSONObject("fromCursor") ?: JSONObject()))
            "checkpoint" -> readCheckpoint(channel, prepared, session)
            else -> throw PcAgentRecoveryException()
        }
        call(channel, "agent.subscriptions.activate", JSONObject()
            .put("subscriptionId", prepared.optString("subscriptionId"))
            .put("appliedCursor", projection.cursor.toJson()))
        val receipt = call(channel, "agent.messages.send", JSONObject()
            .put("commandId", UUID.randomUUID().toString())
            .put("sessionId", session.sessionId)
            .put("text", text)
            .put("expectedIdleRevision", session.idleRevision.toString()))
        val executionId = receipt.optString("executionId").takeIf(String::isNotBlank) ?: throw PcAgentUnavailableException()
        onExecution(session.sessionId, executionId)
        var terminal = false
        val promptedInteractions = mutableSetOf<String>()
        try {
            while (!terminal) {
                val notification = channel.nextNotification()
                when (notification.optString("method")) {
                    "agent.events" -> {
                        val params = notification.optJSONObject("params") ?: throw PcAgentRecoveryException()
                        when (val reduced = AgentEventReducer.apply(projection, params)) {
                            is AgentReducerResult.Applied -> {
                                projection = reduced.projection
                                onText(projection.assistantText)
                                projection.activeExecution?.let { execution ->
                                    terminal = execution.executionId == executionId && execution.status in setOf("completed", "cancelled", "failed", "interrupted")
                                    if (execution.status == "failed") throw PcAgentUnavailableException(execution.errorMessage ?: "PC agent failed")
                                }
                                call(channel, "agent.subscriptions.ack", JSONObject()
                                    .put("subscriptionId", params.optString("subscriptionId"))
                                    .put("cursor", projection.cursor.toJson()))
                            }
                            is AgentReducerResult.RecoveryRequired -> throw PcAgentRecoveryException()
                        }
                        projection.pendingInteraction?.let { pending ->
                            if (pending.executionId == executionId && promptedInteractions.add(pending.interactionId)) {
                                val response = readInteraction(channel, session.sessionId, pending)
                                val command = JSONObject()
                                    .put("commandId", UUID.randomUUID().toString())
                                    .put("sessionId", session.sessionId)
                                    .put("interactionId", response.interactionId)
                                    .put("expectedRevision", response.revision.toString())
                                    .put("expectedExecutionId", response.executionId)
                                    .put("inputDigest", response.inputDigest)
                                when (val answer = onInteraction(response)) {
                                    PcInteractionResponse.Approve -> command.put("decision", "approve")
                                    PcInteractionResponse.Deny -> command.put("decision", "deny")
                                    is PcInteractionResponse.Answer -> command.put("response", JSONObject().put("kind", "answer").put("answers", JSONObject().put(response.questionKey.ifBlank { response.inputText }, answer.value)))
                                }
                                call(channel, "agent.interactions.respond", command)
                            }
                        }
                    }
                    "agent.subscriptions.resetRequired" -> throw PcAgentRecoveryException()
                }
            }
        } finally {
            runCatching {
                call(channel, "agent.subscriptions.close", JSONObject().put("subscriptionId", prepared.optString("subscriptionId")))
            }
        }
        PcChatResult(session.sessionId, executionId, projection.assistantText)
    }

    suspend fun cancel(sessionId: String, executionId: String) = withConnection { channel ->
        call(channel, "agent.executions.cancel", JSONObject()
            .put("commandId", UUID.randomUUID().toString())
            .put("sessionId", sessionId)
            .put("expectedExecutionId", executionId))
    }

    private suspend fun getOrCreateSession(channel: SecureNoiseChannel, agentId: String, existingSessionId: String?): PcSession {
        if (!existingSessionId.isNullOrBlank()) {
            val current = runCatching { call(channel, "agent.sessions.get", JSONObject().put("sessionId", existingSessionId)) }.getOrNull()
            current?.optJSONObject("session")?.let { AgentEventReducer.parseSession(it) }?.let { return it }
        }
        val workspaces = call(channel, "agent.workspaces.list", JSONObject().put("agentId", agentId).put("limit", 100))
        val items = workspaces.optJSONArray("items") ?: JSONArray()
        val selected = (0 until items.length()).mapNotNull { items.optJSONObject(it) }.firstOrNull()
        val params = JSONObject()
            .put("commandId", UUID.randomUUID().toString())
            .put("agentId", agentId)
        if (selected?.optBoolean("systemWorkspace", false) == true || selected == null) {
            params.put("workspace", JSONObject().put("kind", "system"))
        } else {
            params.put("workspaceId", selected.optString("workspaceId"))
        }
        val receipt = call(channel, "agent.sessions.create", params)
        val sessionId = receipt.optString("sessionId").takeIf(String::isNotBlank) ?: throw PcAgentUnavailableException()
        val created = call(channel, "agent.sessions.get", JSONObject().put("sessionId", sessionId)).optJSONObject("session")
        return AgentEventReducer.parseSession(created ?: JSONObject().put("sessionId", sessionId).put("agentId", agentId))
            ?: throw PcAgentUnavailableException()
    }

    private suspend fun readCheckpoint(channel: SecureNoiseChannel, prepared: JSONObject, fallback: PcSession): AgentProjection {
        val descriptor = prepared.optJSONObject("checkpoint") ?: throw PcAgentRecoveryException()
        val cursor = parseCursor(descriptor.optJSONObject("cursor") ?: JSONObject())
        var session = fallback
        val messages = mutableMapOf<String, AgentMessage>()
        val parts = mutableMapOf<String, AgentPart>()
        val executions = mutableMapOf<String, AgentExecution>()
        val interactions = mutableMapOf<String, AgentInteraction>()
        val pageCount = descriptor.optInt("pageCount", 0)
        for (index in 0 until pageCount) {
            val pageParams = JSONObject().put("subscriptionId", prepared.optString("subscriptionId")).put("checkpointId", descriptor.optString("checkpointId"))
            if (index > 0) pageParams.put("pageCursor", index.toString())
            val page = call(channel, "agent.checkpoints.read", pageParams)
            val items = page.optJSONArray("items") ?: JSONArray()
            for (itemIndex in 0 until items.length()) {
                val item = items.optJSONObject(itemIndex) ?: continue
                when (item.optString("kind")) {
                    "session" -> AgentEventReducer.parseSession(item.optJSONObject("value") ?: JSONObject())?.let { session = it }
                    "message" -> AgentEventReducer.parseMessage(item.optJSONObject("value") ?: JSONObject())?.let { messages[it.messageId] = it }
                    "part" -> AgentEventReducer.parsePart(item.optJSONObject("value") ?: JSONObject())?.let { parts[it.partId] = it }
                    "execution" -> parseExecution(item.optJSONObject("value") ?: JSONObject())?.let { executions[it.executionId] = it }
                    "interaction" -> parseInteraction(item.optJSONObject("value") ?: JSONObject())?.let { interactions[it.interactionId] = it }
                }
            }
        }
        return AgentProjection(session, cursor, messages, parts, executions, interactions)
    }

    private suspend fun readInteraction(channel: SecureNoiseChannel, sessionId: String, summary: AgentInteraction): PcInteractionPrompt {
        val full = call(channel, "agent.interactions.get", JSONObject().put("sessionId", sessionId).put("interactionId", summary.interactionId)).optJSONObject("interaction") ?: JSONObject()
        val input = full.optJSONObject("input")
        val inputText = input?.optString("text").orEmpty()
        val questionKey = runCatching { JSONObject(inputText).optJSONArray("questions")?.optJSONObject(0)?.optString("question").orEmpty() }.getOrDefault("")
        return PcInteractionPrompt(summary.interactionId, summary.revision, summary.executionId, summary.inputDigest, summary.summary, summary.kind == "question", inputText, questionKey)
    }

    private suspend fun <T> withConnection(block: suspend (SecureNoiseChannel) -> T): T {
        var last: Throwable? = null
        pc.endpoints.forEach { endpoint ->
            var remote: SecureRemoteChannel? = null
            var secure: SecureNoiseChannel? = null
            try {
                remote = SecureRemoteChannel.open(httpClient, endpoint)
                secure = remote.handshake(identity, pc.desktopIdentity, listOf(1))
                secure.call("connection.hello", JSONObject().put("protocolVersions", JSONArray().put(1)))
                authenticate(secure)
                return try { block(secure) } finally { secure.close(); remote.close() }
            } catch (error: PcTokenExpiredException) {
                secure?.close(); remote?.close(); throw error
            } catch (error: PcAgentUnavailableException) {
                secure?.close(); remote?.close(); throw error
            } catch (error: PcAgentRecoveryException) {
                secure?.close(); remote?.close(); throw error
            } catch (error: PairingRemoteException) {
                secure?.close(); remote?.close()
                if (error.reason == "TOKEN_EXPIRED") throw PcTokenExpiredException()
                last = error
            } catch (error: Throwable) {
                secure?.close(); remote?.close(); last = error
            }
        }
        throw PcUnreachableException().apply { initCause(last) }
    }

    private suspend fun authenticate(channel: SecureNoiseChannel) {
        try {
            val auth = channel.call("connection.authenticate", JSONObject().put("deviceId", pc.deviceId).put("accessToken", pc.accessToken))
            updatePc(auth)
        } catch (error: PairingRemoteException) {
            if (error.reason == "TOKEN_EXPIRED") throw PcTokenExpiredException()
            throw error
        }
    }

    private suspend fun call(channel: SecureNoiseChannel, method: String, params: JSONObject): JSONObject {
        return try {
            channel.call(method, params)
        } catch (error: PairingRemoteException) {
            if (error.reason != "TOKEN_EXPIRED") throw PcAgentUnavailableException(error.remoteMessage)
            val refreshed = runCatching { channel.call("connection.refresh", JSONObject()) }.getOrElse { throw PcTokenExpiredException() }
            updatePc(refreshed)
            channel.call(method, params)
        }
    }

    private fun updatePc(auth: JSONObject) {
        val token = auth.optString("accessToken").takeIf(String::isNotBlank) ?: return
        pc = pc.copy(accessToken = token, expiresAt = auth.optString("expiresAt").ifBlank { pc.expiresAt }, lastSyncAt = System.currentTimeMillis())
        onPcUpdated(pc)
    }

    private fun parseCursor(value: JSONObject): AgentCursor = AgentCursor(value.optString("sessionId"), value.optString("streamEpoch"), value.optString("seq").toLongOrNull() ?: 0L)

    private fun parseExecution(value: JSONObject): AgentExecution? = value.optString("executionId").takeIf(String::isNotBlank)?.let { AgentExecution(it, value.optString("status"), value.optString("messageId").takeIf(String::isNotBlank), value.optJSONObject("failure")?.optString("message")) }
    private fun parseInteraction(value: JSONObject): AgentInteraction? = value.optString("interactionId").takeIf(String::isNotBlank)?.let { AgentInteraction(it, value.optString("revision").toLongOrNull() ?: 0L, value.optString("executionId"), value.optString("status"), value.optString("summary"), value.optString("inputDigest"), value.optString("kind", "decision")) }
}

suspend fun loadPcAgents(identity: PairingIdentity, pc: PairedPc): List<PcAgent> = PcAgentClient(identity, pc).listAgents()
