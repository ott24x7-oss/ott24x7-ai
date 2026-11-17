package com.ott24x7.ai

import com.ott24x7.ai.data.AccountsWelcomeState
import com.ott24x7.ai.data.LoginCheckResult
import com.ott24x7.ai.data.PanelCatalog
import com.ott24x7.ai.data.PanelDefinition
import com.ott24x7.ai.data.PanelLoginStatus
import com.ott24x7.ai.data.PanelLoginStatusStore
import com.ott24x7.ai.data.WebPanelScripts
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AccountsTest {
    @Test
    fun loginUrlDefaultsToPanelUrl() {
        val panel = PanelDefinition("test", "Test", "https://example.com/app", "Test · Web")

        assertEquals(panel.url, panel.loginUrl)
        assertEquals("https://chatgpt.com/auth/login", PanelCatalog.webPanels.first { it.id == "chatgpt" }.loginUrl)
    }

    @Test
    fun statusPersistenceSavesLoadsAndTreatsUnknownAsUnknown() {
        val values = mutableMapOf<String, String>()
        val store = PanelLoginStatusStore(values::get, { key, value -> values[key] = value })

        assertEquals(PanelLoginStatus.UNKNOWN, store.load("chatgpt"))
        store.save("chatgpt", PanelLoginStatus.SIGNED_IN)
        assertEquals(PanelLoginStatus.SIGNED_IN, store.load("chatgpt"))
        values["panel_login_status_chatgpt"] = "not-a-status"
        assertEquals(PanelLoginStatus.UNKNOWN, store.load("chatgpt"))
    }

    @Test
    fun loginCheckResultParsingNeverTreatsUnclearDataAsSignedIn() {
        assertEquals(LoginCheckResult.SIGNED_IN, WebPanelScripts.parseLoginCheckResult("{\"status\":\"signed-in\"}"))
        assertEquals(LoginCheckResult.SIGNED_OUT, WebPanelScripts.parseLoginCheckResult("{\"status\":\"signed-out\"}"))
        assertEquals(LoginCheckResult.UNKNOWN, WebPanelScripts.parseLoginCheckResult("{\"status\":\"maybe\"}"))
        assertEquals(LoginCheckResult.UNKNOWN, WebPanelScripts.parseLoginCheckResult("null"))
    }

    @Test
    fun firstLaunchCardShowsOnlyBeforeItIsSeen() {
        assertTrue(AccountsWelcomeState.shouldShow(false))
        assertFalse(AccountsWelcomeState.shouldShow(true))
    }
}
