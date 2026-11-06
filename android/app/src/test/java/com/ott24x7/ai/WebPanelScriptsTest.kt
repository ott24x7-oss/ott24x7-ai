package com.ott24x7.ai

import com.ott24x7.ai.data.DeliveryStatus
import com.ott24x7.ai.data.WebPanelScripts
import com.ott24x7.ai.data.WebSendStatus
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WebPanelScriptsTest {
    @Test
    fun promptIsEscapedAsAJavaScriptString() {
        val prompt = "line one\nline two \"quoted\" \\ path\n'); document.body.innerHTML = 'bad'"
        val script = WebPanelScripts.buildInsertPromptScript(WebPanelScripts.adapterFor("chatgpt"), prompt)

        assertTrue(script.contains("const prompt = ${JSONObject.quote(prompt)};"))
        assertFalse(script.contains("const prompt = $prompt;"))
    }

    @Test
    fun adapterScriptContainsServiceSelectorsAndGenericFallbacks() {
        val script = WebPanelScripts.buildInsertPromptScript(WebPanelScripts.adapterFor("chatgpt"), "hello")

        assertTrue(script.contains("#prompt-textarea"))
        assertTrue(script.contains("data-testid=\\\"send-button\\\""))
        assertTrue(script.contains("[contenteditable=\\\"true\\\"]"))
        assertTrue(script.contains("queryDeep"))
        assertTrue(script.contains("login-needed"))
    }
}

class WebStatusMappingTest {
    @Test
    fun mapsDeliveryStatusesToPanelLabels() {
        assertEquals(DeliveryStatus.SENT, WebPanelScripts.mapStatus(WebSendStatus.SENT))
        assertEquals(DeliveryStatus.LOGIN_NEEDED, WebPanelScripts.mapStatus(WebSendStatus.LOGIN_NEEDED))
        assertEquals(DeliveryStatus.COPIED, WebPanelScripts.mapStatus(WebSendStatus.INPUT_NOT_FOUND))
        assertEquals(DeliveryStatus.COPIED, WebPanelScripts.mapStatus(WebSendStatus.FAILED))
    }
}
