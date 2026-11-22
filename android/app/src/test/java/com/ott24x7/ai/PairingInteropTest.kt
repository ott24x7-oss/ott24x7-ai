package com.ott24x7.ai

import com.ott24x7.ai.data.PairingClient
import com.ott24x7.ai.data.PairingIdentity
import com.ott24x7.ai.data.PairingQrParser
import com.ott24x7.ai.data.PcAgentClient
import com.ott24x7.ai.data.PcInteractionResponse
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.util.concurrent.TimeUnit

class PairingInteropTest {
    @Test
    fun importsFromTheRealTypeScriptNoiseTransport() = runBlocking {
        val host = listOf(
            File("..", "tasks/pair-interop/host.mjs"),
            File("tasks/pair-interop/host.mjs"),
            File("..", "..\\tasks/pair-interop/host.mjs")
        ).firstOrNull { it.exists() }?.canonicalFile ?: error("Interop host not found from ${System.getProperty("user.dir")}")
        val process = ProcessBuilder("node", host.absolutePath).redirectErrorStream(true).start()
        try {
            val line = process.inputStream.bufferedReader().readLine()
            assertTrue("Interop host did not publish a QR payload", line?.startsWith("QR=") == true)
            val qr = PairingQrParser.parse(line!!.removePrefix("QR="))
            val result = PairingClient(PairingIdentity.fromSeed(ByteArray(32) { it.toByte() }), "Interop phone").pair(qr)
            assertEquals("interop-device", result.pairedPc.deviceId)
            assertEquals("Interop PC", result.pairedPc.name)
            assertTrue("agent" in result.pairedPc.capabilities)
            assertEquals("interop-provider", result.export.providers.single().id)
            assertEquals("interop/model", result.export.providers.single().toEndpoints("interop-device").single().modelId)
            val agentClient = PcAgentClient(PairingIdentity.fromSeed(ByteArray(32) { it.toByte() }), result.pairedPc)
            val agents = agentClient.listAgents()
            assertEquals(listOf("claude-code"), agents.map { it.id })
            var streamed = ""
            val chat = agentClient.chat(
                agentId = agents.single().id,
                text = "Say hello",
                existingSessionId = null,
                onText = { streamed = it },
                onExecution = { _, _ -> },
                onInteraction = { PcInteractionResponse.Deny }
            )
            assertEquals("Hello from PC", streamed)
            assertEquals("Hello from PC", chat.text)
        } finally {
            process.destroy()
            process.waitFor(5, TimeUnit.SECONDS)
            if (process.isAlive) process.destroyForcibly()
        }
    }
}
