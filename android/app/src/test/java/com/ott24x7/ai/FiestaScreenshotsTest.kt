package com.ott24x7.ai

import app.cash.paparazzi.Paparazzi
import app.cash.paparazzi.DeviceConfig
import com.ott24x7.ai.ui.AnswersDarkPreview
import com.ott24x7.ai.ui.AnswersLightPreview
import com.ott24x7.ai.ui.FinalPreview
import com.ott24x7.ai.ui.HistoryPreview
import com.ott24x7.ai.ui.HomeDarkPreview
import com.ott24x7.ai.ui.PickerPreview
import com.ott24x7.ai.ui.SettingsPreview
import org.junit.Rule
import org.junit.Test

class FiestaScreenshotsTest {
    @get:Rule val paparazzi = Paparazzi(deviceConfig = DeviceConfig.PIXEL_5)

    @Test fun homeScreen() = paparazzi.snapshot(name = "home") { HomeDarkPreview() }
    @Test fun answerCardsDark() = paparazzi.snapshot(name = "answers-dark") { AnswersDarkPreview() }
    @Test fun answerCardsLight() = paparazzi.snapshot(name = "answers-light") { AnswersLightPreview() }
    @Test fun modelPickerSheet() = paparazzi.snapshot(name = "model-picker") { PickerPreview() }
    @Test fun finalAnswerSheet() = paparazzi.snapshot(name = "final-answer") { FinalPreview() }
    @Test fun historyDrawer() = paparazzi.snapshot(name = "history") { HistoryPreview() }
    @Test fun settingsScreen() = paparazzi.snapshot(name = "settings") { SettingsPreview() }
}
