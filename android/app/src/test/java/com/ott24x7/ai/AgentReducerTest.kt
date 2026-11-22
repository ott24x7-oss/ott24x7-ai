package com.ott24x7.ai

import com.ott24x7.ai.data.AgentCursor
import com.ott24x7.ai.data.AgentEventReducer
import com.ott24x7.ai.data.AgentReducerResult
import com.ott24x7.ai.data.PcSession
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.security.MessageDigest

class AgentReducerTest {
    @Test
    fun appliesUtf8StreamingTextAndTerminalExecution() {
        val session = PcSession("s", "agent", "workspace", "Test", 0, 0, null)
        var projection = AgentEventReducer.initial(session, AgentCursor("s", "epoch", 0))
        val answer = "Hi 🌍"
        val hash = MessageDigest.getInstance("SHA-256").digest(answer.toByteArray()).joinToString("") { "%02x".format(it) }
        val events = JSONArray()
            .put(event(1, "message.created", JSONObject().put("messageId", "m").put("revision", "0").put("role", "assistant").put("status", "pending").put("partIds", JSONArray())))
            .put(event(2, "part.created", JSONObject().put("messageId", "m").put("afterPartId", JSONObject.NULL).put("messageBaseRevision", "0").put("messageRevision", "1").put("part", JSONObject().put("partId", "p").put("revision", "0").put("kind", "text").put("state", "streaming").put("content", JSONObject().put("text", "")))))
            .put(event(3, "part.append", JSONObject().put("messageId", "m").put("partId", "p").put("baseRevision", "0").put("revision", "1").put("offsetUtf8", "0").put("text", answer)))
            .put(event(4, "part.completed", JSONObject().put("messageId", "m").put("partId", "p").put("baseRevision", "1").put("revision", "2").put("byteLength", answer.toByteArray().size.toString()).put("sha256", hash)))
            .put(event(5, "message.updated", JSONObject().put("baseRevision", "1").put("message", JSONObject().put("messageId", "m").put("revision", "2").put("role", "assistant").put("status", "success").put("partIds", JSONArray().put("p")))))
        var result: AgentReducerResult = AgentReducerResult.Applied(projection)
        for (index in 0 until events.length()) {
            result = AgentEventReducer.apply((result as AgentReducerResult.Applied).projection, JSONObject().put("sessionId", "s").put("streamEpoch", "epoch").put("events", JSONArray().put(events.getJSONObject(index))))
            assertTrue("event ${index + 1} ${events.getJSONObject(index).optString("kind")}: $result", result is AgentReducerResult.Applied)
        }
        assertTrue("result=$result", result is AgentReducerResult.Applied)
        projection = (result as AgentReducerResult.Applied).projection
        assertEquals(answer, projection.assistantText)
        assertEquals(5, projection.cursor.seq)
    }

    @Test
    fun rejectsGapsAndInvalidUtf8OffsetsForRecovery() {
        val projection = AgentEventReducer.initial(PcSession("s", "agent", "workspace", "Test", 0, 0, null), AgentCursor("s", "epoch", 0))
        val gap = AgentEventReducer.apply(projection, batch(event(2, "history.committed", JSONObject().put("historyRevision", "1"))))
        assertEquals("gap", (gap as AgentReducerResult.RecoveryRequired).reason)
        val wrongOffset = AgentEventReducer.apply(projection, batch(
            event(1, "message.created", JSONObject().put("messageId", "m").put("revision", "0").put("role", "assistant").put("status", "pending").put("partIds", JSONArray())),
            event(2, "part.created", JSONObject().put("messageId", "m").put("afterPartId", JSONObject.NULL).put("messageBaseRevision", "0").put("messageRevision", "1").put("part", JSONObject().put("partId", "p").put("revision", "0").put("kind", "text").put("state", "streaming").put("content", JSONObject().put("text", "é")))),
            event(3, "part.append", JSONObject().put("messageId", "m").put("partId", "p").put("baseRevision", "0").put("revision", "1").put("offsetUtf8", "1").put("text", "x"))
        ))
        assertEquals("content", (wrongOffset as AgentReducerResult.RecoveryRequired).reason)
    }

    private fun batch(vararg events: JSONObject): JSONObject = JSONObject().put("sessionId", "s").put("streamEpoch", "epoch").put("events", JSONArray(events.toList()))
    private fun event(seq: Int, kind: String, payload: JSONObject): JSONObject = JSONObject().put("seq", seq.toString()).put("kind", kind).put("payload", payload)
}
