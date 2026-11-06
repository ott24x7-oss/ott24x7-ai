package com.ott24x7.ai

import com.ott24x7.ai.data.normalizeChatCompletionsUrl
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class EndpointUrlTest {
    @Test
    fun normalizesOpenAiCompatibleBaseUrls() {
        assertEquals("https://openrouter.ai/api/v1/chat/completions", normalizeChatCompletionsUrl("https://openrouter.ai/api/v1/"))
        assertEquals("https://example.com/v1/chat/completions", normalizeChatCompletionsUrl("https://example.com"))
        assertEquals("https://example.com/custom/v1/chat/completions", normalizeChatCompletionsUrl("https://example.com/custom"))
        assertEquals("https://example.com/v1/chat/completions", normalizeChatCompletionsUrl("https://example.com/v1/chat/completions"))
    }

    @Test
    fun rejectsNonHttpAndCredentialedUrls() {
        assertThrows(IllegalArgumentException::class.java) { normalizeChatCompletionsUrl("file:///tmp") }
        assertThrows(IllegalArgumentException::class.java) { normalizeChatCompletionsUrl("https://user:pass@example.com") }
    }
}
