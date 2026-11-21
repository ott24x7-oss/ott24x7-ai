package com.ott24x7.ai

import com.ott24x7.ai.data.PairedPc
import com.ott24x7.ai.data.PairedPcCodec
import com.ott24x7.ai.data.PairingEndpoint
import com.ott24x7.ai.data.PairingIdentity
import com.ott24x7.ai.data.PairingQrParser
import com.ott24x7.ai.data.ProviderExportCodec
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PairingProtocolTest {
    @Test
    fun parsesEveryPairingQrFixtureCase() {
        val valid = listOf(
            """{"t":"ott24x7ai-pair","name":"Desktop","desktopIdentity":"12D3KooWDesktop","invitationId":"invitation","invitationSecret":"secret","protocolVersions":[1],"v":2,"ips":["192.168.1.8"],"port":24444}""",
            """{"t":"ott24x7ai-pair","name":"Desktop","desktopIdentity":"12D3KooWDesktop","invitationId":"invitation","invitationSecret":"secret","protocolVersions":[1],"v":3,"endpoints":[{"host":"desktop.example.com","port":24443,"security":"wss"}]}""",
            """{"t":"ott24x7ai-pair","name":"Desktop","desktopIdentity":"12D3KooWDesktop","invitationId":"invitation","invitationSecret":"secret","protocolVersions":[1],"v":3,"endpoints":[{"host":"fd7a::2","port":24444,"security":"ws"}]}"""
        )
        valid.forEach { assertTrue(PairingQrParser.parse(it).endpoints.isNotEmpty()) }
        listOf(
            """{"t":"ott24x7ai-pair","name":"Desktop","desktopIdentity":"12D3KooWDesktop","invitationId":"invitation","invitationSecret":"secret","protocolVersions":[1],"v":2,"ips":["desktop.example.com"],"port":443}""",
            """{"t":"ott24x7ai-pair","name":"Desktop","desktopIdentity":"12D3KooWDesktop","invitationId":"invitation","invitationSecret":"secret","protocolVersions":[1],"v":3,"endpoints":[{"host":"user@host/path","port":443,"security":"wss"}]}""",
            """{"t":"ott24x7ai-pair","name":"Desktop","desktopIdentity":"12D3KooWDesktop","invitationId":"invitation","invitationSecret":"secret","protocolVersions":[1],"v":3,"endpoints":[{"host":"desktop.example.com","security":"wss"}]}""",
            """{"t":"ott24x7ai-pair","name":"Desktop","desktopIdentity":"12D3KooWDesktop","invitationId":"invitation","invitationSecret":"secret","protocolVersions":[1],"v":3,"endpoints":[]}"""
        ).forEach { payload ->
            assertFalse(runCatching { PairingQrParser.parse(payload) }.isSuccess)
        }
    }

    @Test
    fun decodesExportAndMapsOnlyOpenAiCompatibleProviders() {
        val export = ProviderExportCodec.decode("""
            {
              "version": 1,
              "providers": [
                {"id":"openrouter","name":"OpenRouter","endpointConfigs":{"openai-chat-completions":{"baseUrl":"https://openrouter.ai/api/v1"}},"apiKeys":[{"key":"secret-key","isEnabled":true}],"models":[{"id":"m1","apiModelId":"free/model","name":"Free model","isEnabled":true}]},
                {"id":"gemini","name":"Gemini","endpointConfigs":{"google-generate-content":{"baseUrl":"https://generativelanguage.googleapis.com"}},"apiKeys":[],"models":[{"id":"gemini-2","apiModelId":"gemini-2","name":"Gemini","isEnabled":true}]}
              ]
            }
        """.trimIndent().toByteArray())
        assertEquals(2, export.providers.size)
        val supported = export.providers.first()
        assertTrue(supported.supported)
        assertTrue(supported.hasKey)
        assertEquals("free/model", supported.toEndpoints("device").single().modelId)
        assertFalse(export.providers[1].supported)
        assertTrue(export.providers[1].toEndpoints("device").isEmpty())
    }

    @Test
    fun pairingStorageRoundTripsAndForgetRemovesTheSelectedPc() {
        val values = listOf(
            PairedPc("one", "Office", "device-one", "token-one", "expires", "desktop-one", listOf(PairingEndpoint("192.168.1.8", 24444, "ws")), 42L),
            PairedPc("two", "Home", "device-two", "token-two", "expires", "desktop-two", emptyList(), 84L)
        )
        val afterForget = PairedPcCodec.decode(PairedPcCodec.encode(values)).filterNot { it.id == "one" }
        assertEquals(listOf("two"), afterForget.map(PairedPc::id))
        assertEquals(values[1], afterForget.single())
    }

    @Test
    fun identityIsPersistentShapeAndUsesLibp2pPeerIdEncoding() {
        val identity = PairingIdentity.fromSeed(ByteArray(32) { it.toByte() })
        assertEquals(32, identity.publicKey.size)
        assertEquals(36, identity.identityPublicKeyProtobuf().size)
        assertEquals(68, identity.identityPrivateKeyProtobuf().size)
        assertTrue(identity.peerId().startsWith("12D3"))
    }
}
