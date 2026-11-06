package com.ott24x7.ai

import com.ott24x7.ai.data.AppSettingsCodec
import com.ott24x7.ai.data.AppSettingsSnapshot
import com.ott24x7.ai.data.CitationParser
import com.ott24x7.ai.data.ExaClient
import com.ott24x7.ai.data.GuideChecklist
import com.ott24x7.ai.data.HistoryAnswer
import com.ott24x7.ai.data.HistoryGroup
import com.ott24x7.ai.data.HistoryGrouping
import com.ott24x7.ai.data.HistoryStoreCodec
import com.ott24x7.ai.data.HistoryTurn
import com.ott24x7.ai.data.ImageGenerationRequest
import com.ott24x7.ai.data.ImageResponseParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.TimeZone

class MobileFeaturesTest {
    @Test fun exaRequestUsesTheRequiredShape() {
        val body = ExaClient.requestBody("current android releases")
        assertEquals("current android releases", body.getString("query"))
        assertEquals(5, body.getInt("numResults"))
        assertEquals(1500, body.getJSONObject("contents").getJSONObject("text").getInt("maxCharacters"))
    }

    @Test fun exaResultsBecomeNumberedCitationContext() {
        val sources = ExaClient.parseResults("""{"results":[{"title":"Guide","url":"https://www.example.com/post","text":"Useful details"}]}""")
        assertEquals("example.com", sources.single().domain)
        assertTrue(ExaClient.formatContext(sources).contains("[1] Guide (https://www.example.com/post)"))
        assertTrue(ExaClient.formatContext(sources).contains("Cite claims with [1], [2]"))
    }

    @Test fun citationParserKeepsValidUniqueSourceNumbers() {
        assertEquals(listOf(1, 2), CitationParser.indices("See [1], [2], [1], and [4].", 2))
    }

    @Test fun historyIsGroupedByLocalCalendarDay() {
        val zone = TimeZone.getTimeZone("UTC")
        val now = 1_800_000_000_000L
        assertEquals(HistoryGroup.TODAY, HistoryGrouping.group(now - 1_000, now, zone))
        assertEquals(HistoryGroup.YESTERDAY, HistoryGrouping.group(now - 86_400_000L, now, zone))
        assertEquals(HistoryGroup.LAST_7_DAYS, HistoryGrouping.group(now - 3 * 86_400_000L, now, zone))
        assertEquals(HistoryGroup.OLDER, HistoryGrouping.group(now - 8 * 86_400_000L, now, zone))
    }

    @Test fun historyStorePreservesApiAnswersFinalAnswerAndTime() {
        val turns = listOf(HistoryTurn("Question", listOf(HistoryAnswer("api:x", "Model", "Answer")), "Combined", 42L))
        assertEquals(turns, HistoryStoreCodec.decode(HistoryStoreCodec.encode(turns)))
    }

    @Test fun checklistAutoChecksOnlyTheMatchingMilestone() {
        val done = GuideChecklist.autoCheck(GuideChecklist.reset(), "first_combine")
        assertTrue(done[3])
        assertFalse(done[1])
        assertEquals(1, GuideChecklist.count(done))
        assertTrue(GuideChecklist.autoCheck(done, "first_image")[7])
    }

    @Test fun imageRequestAndResponseSupportB64AndUrls() {
        val request = ImageGenerationRequest("image-model", "A bright poster", "9:16", 2).toJson()
        assertEquals("image-model", request.getString("model"))
        assertEquals("9:16", request.getString("size"))
        assertEquals(2, request.getInt("n"))
        assertEquals(2, ImageResponseParser.parse("""{"data":[{"b64_json":"abc"},{"url":"https://example.com/image.png"}]}""").size)
    }

    @Test fun imageEndpointUsesOpenAiCompatibleV1Path() {
        assertEquals("https://api.example/v1/images/generations", ImageResponseParser.endpointUrl("https://api.example/v1/chat/completions"))
        assertEquals("https://api.example/api/v1/images/generations", ImageResponseParser.endpointUrl("https://api.example/api/v1/"))
    }

    @Test fun settingsCodecRetainsEncryptedPreferenceValues() {
        val expected = AppSettingsSnapshot(exaKey = "test-only-key", webSearchEnabled = true, onboardingSeen = true, guideDone = List(8) { it == 2 })
        assertEquals(expected, AppSettingsCodec.decode(AppSettingsCodec.encode(expected)))
        assertEquals(AppSettingsSnapshot(), AppSettingsCodec.decode("not-json"))
    }
}
