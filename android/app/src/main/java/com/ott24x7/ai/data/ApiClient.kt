package com.ott24x7.ai.data

import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

data class ApiAttachment(val name: String, val mimeType: String, val bytes: ByteArray)

object ApiClient {
    fun stream(
        endpoint: ApiEndpoint,
        prompt: String,
        attachment: ApiAttachment?,
        history: List<ApiChatMessage> = emptyList(),
        exaApiKey: String? = null,
        onSources: (List<ExaSource>) -> Unit = {},
        onDelta: (String) -> Unit
    ): String {
        val sources = exaApiKey?.takeIf(String::isNotBlank)?.let { ExaClient.search(it, prompt) }.orEmpty()
        onSources(sources)
        val context = ExaClient.formatContext(sources)
        val connection = openConnection(endpoint)
        try {
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Authorization", "Bearer ${endpoint.apiKey}")
            connection.setRequestProperty("Accept", "text/event-stream")
            val payload = requestBody(endpoint, prompt, attachment, history, context).put("stream", true)
            connection.outputStream.bufferedWriter(Charsets.UTF_8).use { it.write(payload.toString()) }
            if (connection.responseCode !in 200..299) throw IllegalStateException("Request failed (${connection.responseCode})")
            val answer = StringBuilder()
            connection.inputStream.bufferedReader(Charsets.UTF_8).useLines { lines ->
                lines.forEach { line ->
                    if (!line.startsWith("data:")) return@forEach
                    val value = line.removePrefix("data:").trim()
                    if (value.isEmpty() || value == "[DONE]") return@forEach
                    val delta = runCatching {
                        val content = JSONObject(value).optJSONArray("choices")?.optJSONObject(0)
                            ?.optJSONObject("delta")?.opt("content")
                        when (content) {
                            is String -> content
                            is JSONArray -> buildString {
                                for (index in 0 until content.length()) {
                                    append(content.optJSONObject(index)?.optString("text").orEmpty())
                                }
                            }
                            else -> ""
                        }
                    }.getOrDefault("")
                    if (delta.isNotEmpty()) { answer.append(delta); onDelta(delta) }
                }
            }
            return answer.toString()
        } finally {
            connection.disconnect()
        }
    }

    fun test(endpoint: ApiEndpoint): String {
        val connection = openConnection(endpoint)
        try {
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Authorization", "Bearer ${endpoint.apiKey}")
            connection.outputStream.bufferedWriter(Charsets.UTF_8).use {
                it.write(requestBody(endpoint, "Reply with: Connection successful.", null).toString())
            }
            if (connection.responseCode !in 200..299) throw IllegalStateException("Request failed (${connection.responseCode})")
            return connection.inputStream.bufferedReader(Charsets.UTF_8).use { reader ->
                JSONObject(reader.readText()).optJSONArray("choices")?.optJSONObject(0)
                    ?.optJSONObject("message")?.optString("content").orEmpty().ifBlank { "Connected" }
            }
        } finally {
            connection.disconnect()
        }
    }

    fun generateImages(endpoint: ApiEndpoint, prompt: String, size: String, count: Int = 1, modelId: String = endpoint.imageModelId.ifBlank { endpoint.modelId }): List<GeneratedImage> {
        val connection = (URL(ImageResponseParser.endpointUrl(endpoint.baseUrl)).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 25_000
            readTimeout = 180_000
            doOutput = true
            setRequestProperty("User-Agent", "OTT24x7-AI-Android/1.1")
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Authorization", "Bearer ${endpoint.apiKey}")
        }
        try {
            val payload = ImageGenerationRequest(modelId, prompt, size, count).toJson()
            connection.outputStream.bufferedWriter(Charsets.UTF_8).use { it.write(payload.toString()) }
            if (connection.responseCode !in 200..299) throw IllegalStateException("Image generation failed (${connection.responseCode})")
            return connection.inputStream.bufferedReader(Charsets.UTF_8).use { ImageResponseParser.parse(it.readText()) }
        } finally {
            connection.disconnect()
        }
    }

    private fun openConnection(endpoint: ApiEndpoint): HttpURLConnection {
        val url = normalizeChatCompletionsUrl(endpoint.baseUrl)
        return (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 25_000
            readTimeout = 180_000
            setRequestProperty("User-Agent", "OTT24x7-AI-Android/1.0")
        }
    }

    private fun requestBody(
        endpoint: ApiEndpoint,
        prompt: String,
        attachment: ApiAttachment?,
        history: List<ApiChatMessage> = emptyList(),
        systemContext: String = ""
    ): JSONObject {
        val messages = JSONArray()
        val systemMessage = buildString {
            append("You are a helpful assistant.")
            if (systemContext.isNotBlank()) append("\n\n").append(systemContext)
        }
        messages.put(JSONObject().put("role", "system").put("content", systemMessage))
        history.forEach { previous ->
            if (previous.role == "user" || previous.role == "assistant") {
                messages.put(JSONObject().put("role", previous.role).put("content", previous.content))
            }
        }
        val user = JSONObject().put("role", "user")
        if (attachment == null) user.put("content", prompt) else {
            val parts = JSONArray().put(JSONObject().put("type", "text").put("text", prompt))
            val data = Base64.encodeToString(attachment.bytes, Base64.NO_WRAP)
            if (attachment.mimeType.startsWith("image/")) {
                parts.put(JSONObject().put("type", "image_url").put("image_url", JSONObject().put("url", "data:${attachment.mimeType};base64,$data")))
            } else if (attachment.mimeType == "application/pdf") {
                parts.put(JSONObject().put("type", "file").put("file", JSONObject()
                    .put("filename", attachment.name)
                    .put("file_data", "data:application/pdf;base64,$data")))
            }
            user.put("content", parts)
        }
        messages.put(user)
        return JSONObject().put("model", endpoint.modelId).put("messages", messages).put("temperature", 0.7)
    }
}
