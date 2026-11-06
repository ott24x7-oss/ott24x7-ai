package com.ott24x7.ai

import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import com.ott24x7.ai.data.ApiEndpoint
import com.ott24x7.ai.data.HistoryAnswer
import com.ott24x7.ai.data.HistoryTurn
import com.ott24x7.ai.data.PanelCatalog
import com.ott24x7.ai.ui.ComparePreviewV2
import com.ott24x7.ai.ui.FinalAnswerPreviewV2
import com.ott24x7.ai.ui.FiestaTheme
import com.ott24x7.ai.ui.GuideScreenV2
import com.ott24x7.ai.ui.HistoryScreenV2
import com.ott24x7.ai.ui.HomeDashboard
import com.ott24x7.ai.ui.AppBottomBar
import com.ott24x7.ai.ui.MainTab
import com.ott24x7.ai.ui.ModelPickerPreviewV2
import com.ott24x7.ai.ui.OnboardingScreenV2
import com.ott24x7.ai.ui.SettingsScreenV2
import com.ott24x7.ai.ui.StudioScreenV2
import com.ott24x7.ai.ui.WebSearchPreviewV2
import org.junit.Rule
import org.junit.Test
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.unit.dp
import androidx.compose.ui.Modifier

class V2ScreenshotsTest {
    @get:Rule val paparazzi = Paparazzi(deviceConfig = DeviceConfig.PIXEL_5)
    private val recent = listOf("How do I debounce a search input in React?", "Compare iPhone 17 vs Pixel 11 cameras", "Write a polite rent reminder")
    private val endpoints = listOf(ApiEndpoint("preview", "Image API", "https://example.com/v1", "hidden", "chat-model", "image-model"))
    private val turns = listOf(
        HistoryTurn("How do I debounce a search input in React?", listOf(HistoryAnswer("api:model", "GPT-4o", "Use a debounce hook.")), "Use a 300ms debounce.", System.currentTimeMillis()),
        HistoryTurn("Compare iPhone and Pixel cameras", listOf(HistoryAnswer("chatgpt", "ChatGPT", "sent")), "", System.currentTimeMillis() - 86_400_000L)
    )

    @Test fun onboardingDark() = paparazzi.snapshot(name = "v2-onboarding-dark") { FiestaTheme(true) { OnboardingScreenV2 {} } }
    @Test fun onboardingLight() = paparazzi.snapshot(name = "v2-onboarding-light") { FiestaTheme(false) { OnboardingScreenV2 {} } }

    @Test fun homeDark() = paparazzi.snapshot(name = "v2-home-dark") { FiestaTheme(true) { withNav(MainTab.HOME, showBrand = true) { HomeDashboard(PanelCatalog.webPanels.take(4), recent, {}, {}, {}, {}) } } }
    @Test fun homeLight() = paparazzi.snapshot(name = "v2-home-light") { FiestaTheme(false) { withNav(MainTab.HOME, showBrand = true) { HomeDashboard(PanelCatalog.webPanels.take(4), recent, {}, {}, {}, {}) } } }

    @Test fun compareDark() = paparazzi.snapshot(name = "v2-compare-dark") { FiestaTheme(true) { withNav(MainTab.COMPARE) { ComparePreviewV2() } } }
    @Test fun compareLight() = paparazzi.snapshot(name = "v2-compare-light") { FiestaTheme(false) { withNav(MainTab.COMPARE) { ComparePreviewV2() } } }

    @Test fun finalAnswerDark() = paparazzi.snapshot(name = "v2-final-answer-dark") { FiestaTheme(true) { FinalAnswerPreviewV2() } }
    @Test fun finalAnswerLight() = paparazzi.snapshot(name = "v2-final-answer-light") { FiestaTheme(false) { FinalAnswerPreviewV2() } }

    @Test fun webSearchDark() = paparazzi.snapshot(name = "v2-web-search-dark") { FiestaTheme(true) { withNav(MainTab.COMPARE) { WebSearchPreviewV2() } } }
    @Test fun webSearchLight() = paparazzi.snapshot(name = "v2-web-search-light") { FiestaTheme(false) { withNav(MainTab.COMPARE) { WebSearchPreviewV2() } } }

    @Test fun studioDark() = paparazzi.snapshot(name = "v2-studio-dark") { FiestaTheme(true) { withNav(MainTab.STUDIO) { StudioScreenV2(endpoints, {}, {}) } } }
    @Test fun studioLight() = paparazzi.snapshot(name = "v2-studio-light") { FiestaTheme(false) { withNav(MainTab.STUDIO) { StudioScreenV2(endpoints, {}, {}) } } }

    @Test fun historyDark() = paparazzi.snapshot(name = "v2-history-dark") { FiestaTheme(true) { withNav(MainTab.HOME) { HistoryScreenV2(turns, {}, {}) } } }
    @Test fun historyLight() = paparazzi.snapshot(name = "v2-history-light") { FiestaTheme(false) { withNav(MainTab.HOME) { HistoryScreenV2(turns, {}, {}) } } }

    @Test fun guideDark() = paparazzi.snapshot(name = "v2-guide-dark") { FiestaTheme(true) { withNav(MainTab.GUIDE) { GuideScreenV2(List(8) { it < 3 }, {}) } } }
    @Test fun guideLight() = paparazzi.snapshot(name = "v2-guide-light") { FiestaTheme(false) { withNav(MainTab.GUIDE) { GuideScreenV2(List(8) { it < 3 }, {}) } } }

    @Test fun settingsDark() = paparazzi.snapshot(name = "v2-settings-dark") { FiestaTheme(true) { withNav(MainTab.SETTINGS) { settingsScreen(true) } } }
    @Test fun settingsLight() = paparazzi.snapshot(name = "v2-settings-light") { FiestaTheme(false) { withNav(MainTab.SETTINGS) { settingsScreen(false) } } }

    @Test fun modelPickerDark() = paparazzi.snapshot(name = "v2-model-picker-dark") { FiestaTheme(true) { ModelPickerPreviewV2() } }
    @Test fun modelPickerLight() = paparazzi.snapshot(name = "v2-model-picker-light") { FiestaTheme(false) { ModelPickerPreviewV2() } }

    @androidx.compose.runtime.Composable
    private fun settingsScreen(dark: Boolean) {
        SettingsScreenV2(
            panels = PanelCatalog.webPanels.take(4), selectedIds = PanelCatalog.defaultSelection,
            endpoints = endpoints, themeMode = if (dark) "dark" else "light", accentColor = 0xFF7C5CFF,
            exaKey = "", webDefault = false, judgeId = "preview", testMessage = "", testing = false,
            onPickModels = {}, onManageEndpoints = {}, onTheme = {}, onAccent = {}, onExaKey = {},
            onWebDefault = {}, onTestExa = {}, onJudge = {}, onClearLogins = {}, onOpenUrl = {}
        )
    }

    @androidx.compose.runtime.Composable
    private fun withNav(tab: MainTab, showBrand: Boolean = false, content: @androidx.compose.runtime.Composable () -> Unit) {
        Column(Modifier.fillMaxSize()) {
            if (showBrand) androidx.compose.material3.Text("OTT24x7 AI  ·  My subscriptions", Modifier.fillMaxWidth().padding(horizontal = 17.dp, vertical = 12.dp), fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold)
            Box(Modifier.weight(1f)) { content() }
            AppBottomBar(tab) {}
        }
    }
}
