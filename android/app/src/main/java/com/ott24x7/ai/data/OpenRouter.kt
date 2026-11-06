package com.ott24x7.ai.data

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

const val OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
private const val OPENROUTER_ENDPOINT_PREFIX = "openrouter:"

data class OpenRouterModel(val id: String, val name: String, val contextLength: Int)

object OpenRouter {
    /** Keeps text models whose prompt and completion price are both zero. */
    fun parseFreeModels(json: String): List<OpenRouterModel> {
        val data = JSONObject(json).optJSONArray("data") ?: return emptyList()
        return (0 until data.length()).mapNotNull { index ->
            val row = data.optJSONObject(index) ?: return@mapNotNull null
            val id = row.optString("id")
            val pricing = row.optJSONObject("pricing") ?: return@mapNotNull null
            if (id.isBlank() || !isZero(pricing.optString("prompt")) || !isZero(pricing.optString("completion"))) return@mapNotNull null
            val outputs = row.optJSONObject("architecture")?.optJSONArray("output_modalities")
            if (outputs != null && (0 until outputs.length()).none { outputs.optString(it) == "text" }) return@mapNotNull null
            OpenRouterModel(id, cleanName(row.optString("name").ifBlank { id }), row.optInt("context_length"))
        }.distinctBy { it.id }.sortedBy { it.name.lowercase() }
    }

    fun fetchFreeModels(): List<OpenRouterModel> = parseFreeModels(get("$OPENROUTER_BASE_URL/models", null))

    /** Returns true when OpenRouter accepts the key. */
    fun verifyKey(apiKey: String): Boolean = runCatching { get("$OPENROUTER_BASE_URL/key", apiKey) }.isSuccess

    fun endpointId(modelId: String) = OPENROUTER_ENDPOINT_PREFIX + modelId

    fun isOpenRouterEndpoint(endpoint: ApiEndpoint) = endpoint.id.startsWith(OPENROUTER_ENDPOINT_PREFIX)

    fun endpointFor(model: OpenRouterModel, apiKey: String) =
        ApiEndpoint(endpointId(model.id), model.name, OPENROUTER_BASE_URL, apiKey, model.id)

    /** Puts a new key on every OpenRouter model already added. */
    fun withKey(endpoints: List<ApiEndpoint>, apiKey: String) =
        endpoints.map { if (isOpenRouterEndpoint(it)) it.copy(apiKey = apiKey) else it }

    private fun cleanName(name: String) = name.replace(Regex("\\s*\\(free\\)\\s*$", RegexOption.IGNORE_CASE), "").trim()

    private fun isZero(price: String) = price.toBigDecimalOrNull()?.signum() == 0

    private fun get(url: String, apiKey: String?): String {
        val connection = URL(url).openConnection() as HttpURLConnection
        try {
            connection.connectTimeout = 10_000
            connection.readTimeout = 20_000
            apiKey?.let { connection.setRequestProperty("Authorization", "Bearer $it") }
            if (connection.responseCode !in 200..299) throw IllegalStateException("Request failed (${connection.responseCode})")
            return connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
        } finally {
            connection.disconnect()
        }
    }
}
