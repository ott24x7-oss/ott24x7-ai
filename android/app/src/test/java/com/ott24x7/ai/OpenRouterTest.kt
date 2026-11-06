package com.ott24x7.ai

import com.ott24x7.ai.data.ApiEndpoint
import com.ott24x7.ai.data.OpenRouter
import com.ott24x7.ai.data.OpenRouterModel
import org.junit.Assert.assertEquals
import org.junit.Test

class OpenRouterTest {
    private val catalog = """
        {"data":[
          {"id":"meta-llama/llama-3.3-70b-instruct:free","name":"Meta: Llama 3.3 70B Instruct (free)","context_length":131072,
           "pricing":{"prompt":"0","completion":"0"},"architecture":{"output_modalities":["text"]}},
          {"id":"openai/gpt-4o","name":"OpenAI: GPT-4o","pricing":{"prompt":"0.0000025","completion":"0.00001"}},
          {"id":"half/free","name":"Half free","pricing":{"prompt":"0","completion":"0.000001"}},
          {"id":"img/free","name":"Image only","pricing":{"prompt":"0","completion":"0"},"architecture":{"output_modalities":["image"]}},
          {"id":"deepseek/deepseek-r1:free","name":"DeepSeek: R1 (free)","pricing":{"prompt":"0.0","completion":"0"}}
        ]}
    """

    @Test
    fun keepsOnlyFreeTextModelsAndCleansNames() {
        val models = OpenRouter.parseFreeModels(catalog)
        assertEquals(listOf("deepseek/deepseek-r1:free", "meta-llama/llama-3.3-70b-instruct:free"), models.map { it.id })
        assertEquals("Meta: Llama 3.3 70B Instruct", models.last().name)
    }

    @Test
    fun newKeyReplacesOnlyOpenRouterEndpoints() {
        val custom = ApiEndpoint("x", "Mine", "https://example.com", "old", "m")
        val free = OpenRouter.endpointFor(OpenRouterModel("a:free", "A", 0), "old")
        val updated = OpenRouter.withKey(listOf(custom, free), "new")
        assertEquals("old", updated[0].apiKey)
        assertEquals("new", updated[1].apiKey)
        assertEquals("https://openrouter.ai/api/v1", updated[1].baseUrl)
    }
}
