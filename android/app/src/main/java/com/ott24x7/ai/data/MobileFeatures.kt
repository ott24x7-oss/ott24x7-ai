package com.ott24x7.ai.data

import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.Calendar
import java.util.TimeZone

data class ExaSource(val title: String, val url: String, val text: String) {
    val domain: String get() = runCatching { URL(url).host.removePrefix("www.") }.getOrDefault(url)
}

object ExaClient {
    const val SEARCH_URL = "https://api.exa.ai/search"

    fun requestBody(query: String): JSONObject = JSONObject()
        .put("query", query)
        .put("numResults", 5)
        .put("contents", JSONObject().put("text", JSONObject().put("maxCharacters", 1500)))

    fun parseResults(json: String): List<ExaSource> {
        val rows = JSONObject(json).optJSONArray("results") ?: return emptyList()
        return (0 until rows.length()).mapNotNull { index ->
            val row = rows.optJSONObject(index) ?: return@mapNotNull null
            val url = row.optString("url").takeIf(String::isNotBlank) ?: return@mapNotNull null
            ExaSource(row.optString("title").ifBlank { URL(url).host }, url, row.optString("text"))
        }
    }

    fun formatContext(results: List<ExaSource>): String = if (results.isEmpty()) "" else buildString {
        append("Use these web search results as supporting context. Cite claims with [1], [2], and so on.\n\n")
        results.forEachIndexed { index, source ->
            append("[${index + 1}] ${source.title} (${source.url})\n${source.text}\n\n")
        }
    }.trim()

    fun search(apiKey: String, query: String): List<ExaSource> {
        val connection = URL(SEARCH_URL).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 15_000
            connection.readTimeout = 30_000
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("x-api-key", apiKey)
            connection.outputStream.bufferedWriter(Charsets.UTF_8).use { it.write(requestBody(query).toString()) }
            if (connection.responseCode !in 200..299) throw IllegalStateException("Web search failed (${connection.responseCode})")
            return connection.inputStream.bufferedReader(Charsets.UTF_8).use { parseResults(it.readText()) }
        } finally {
            connection.disconnect()
        }
    }
}

object CitationParser {
    private val citation = Regex("\\[(\\d+)]")
    fun indices(text: String, sourceCount: Int): List<Int> = citation.findAll(text)
        .mapNotNull { it.groupValues[1].toIntOrNull() }
        .filter { it in 1..sourceCount }
        .distinct()
        .toList()
}

data class HistoryAnswer(val modelId: String, val modelName: String, val text: String)
data class HistoryTurn(
    val prompt: String,
    val answers: List<HistoryAnswer>,
    val finalAnswer: String,
    val timestamp: Long
)

object HistoryStoreCodec {
    fun encode(turns: List<HistoryTurn>): String = JSONArray().apply {
        turns.take(100).forEach { turn ->
            put(JSONObject()
                .put("prompt", turn.prompt)
                .put("finalAnswer", turn.finalAnswer)
                .put("timestamp", turn.timestamp)
                .put("answers", JSONArray().apply {
                    turn.answers.forEach { answer ->
                        put(JSONObject().put("modelId", answer.modelId).put("modelName", answer.modelName).put("text", answer.text))
                    }
                }))
        }
    }.toString()

    fun decode(raw: String): List<HistoryTurn> = runCatching {
        val rows = JSONArray(raw)
        (0 until rows.length()).mapNotNull { index ->
            val row = rows.optJSONObject(index) ?: return@mapNotNull null
            val answers = row.optJSONArray("answers") ?: JSONArray()
            HistoryTurn(
                prompt = row.optString("prompt"),
                answers = (0 until answers.length()).mapNotNull { answerIndex ->
                    answers.optJSONObject(answerIndex)?.let { answer ->
                        HistoryAnswer(answer.optString("modelId"), answer.optString("modelName"), answer.optString("text"))
                    }
                },
                finalAnswer = row.optString("finalAnswer"),
                timestamp = row.optLong("timestamp")
            )
        }
    }.getOrDefault(emptyList())
}

enum class HistoryGroup { TODAY, YESTERDAY, LAST_7_DAYS, OLDER }

object HistoryGrouping {
    fun group(timestamp: Long, now: Long, timeZone: TimeZone = TimeZone.getDefault()): HistoryGroup {
        fun dayStart(value: Long): Long = Calendar.getInstance(timeZone).run {
            timeInMillis = value
            set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
            timeInMillis
        }
        val days = ((dayStart(now) - dayStart(timestamp)) / 86_400_000L).toInt()
        return when {
            days <= 0 -> HistoryGroup.TODAY
            days == 1 -> HistoryGroup.YESTERDAY
            days < 7 -> HistoryGroup.LAST_7_DAYS
            else -> HistoryGroup.OLDER
        }
    }
}

object GuideChecklist {
    const val SIZE = 8
    fun reset(): List<Boolean> = List(SIZE) { false }
    fun complete(done: List<Boolean>, index: Int): List<Boolean> = List(SIZE) { it == index || done.getOrNull(it) == true }
    fun autoCheck(done: List<Boolean>, event: String): List<Boolean> {
        val index = when (event) {
            "first_send" -> 1
            "first_combine" -> 3
            "web_search_on" -> 5
            "endpoint_added" -> 6
            "first_image" -> 7
            else -> return done.take(SIZE).let { it + List((SIZE - it.size).coerceAtLeast(0)) { false } }
        }
        return complete(done, index)
    }
    fun count(done: List<Boolean>): Int = done.take(SIZE).count { it }
}

data class AppSettingsSnapshot(
    val selectedPanels: List<String> = PanelCatalog.defaultSelection,
    val themeMode: String = "system",
    val accentColor: Long = 0xFF7C5CFF,
    val webSearchEnabled: Boolean = false,
    val exaKey: String = "",
    val onboardingSeen: Boolean = false,
    val guideDone: List<Boolean> = GuideChecklist.reset(),
    val readWebAnswers: Boolean = false,
    val judgeModelId: String = ""
)

object AppSettingsCodec {
    fun encode(value: AppSettingsSnapshot): String = JSONObject()
        .put("selectedPanels", JSONArray(value.selectedPanels))
        .put("themeMode", value.themeMode)
        .put("accentColor", value.accentColor)
        .put("webSearchEnabled", value.webSearchEnabled)
        .put("exaKey", value.exaKey)
        .put("onboardingSeen", value.onboardingSeen)
        .put("guideDone", JSONArray(value.guideDone))
        .put("readWebAnswers", value.readWebAnswers)
        .put("judgeModelId", value.judgeModelId)
        .toString()

    fun decode(raw: String): AppSettingsSnapshot = runCatching {
        val value = JSONObject(raw)
        val selected = value.optJSONArray("selectedPanels") ?: JSONArray()
        val done = value.optJSONArray("guideDone") ?: JSONArray()
        AppSettingsSnapshot(
            selectedPanels = (0 until selected.length()).map { selected.optString(it) },
            themeMode = value.optString("themeMode", "system"),
            accentColor = value.optLong("accentColor", 0xFF7C5CFF),
            webSearchEnabled = value.optBoolean("webSearchEnabled"),
            exaKey = value.optString("exaKey"),
            onboardingSeen = value.optBoolean("onboardingSeen"),
            guideDone = (0 until done.length()).map { done.optBoolean(it) }.let { it + List((GuideChecklist.SIZE - it.size).coerceAtLeast(0)) { false } }.take(GuideChecklist.SIZE),
            readWebAnswers = value.optBoolean("readWebAnswers"),
            judgeModelId = value.optString("judgeModelId")
        )
    }.getOrDefault(AppSettingsSnapshot())
}

data class ImageGenerationRequest(val model: String, val prompt: String, val size: String, val n: Int = 1) {
    fun toJson(): JSONObject = JSONObject().put("model", model).put("prompt", prompt).put("size", size).put("n", n)
}

data class GeneratedImage(val url: String = "", val base64: String = "")

object ImageResponseParser {
    fun parse(json: String): List<GeneratedImage> {
        val data = JSONObject(json).optJSONArray("data") ?: return emptyList()
        return (0 until data.length()).mapNotNull { index ->
            val row = data.optJSONObject(index) ?: return@mapNotNull null
            val base64 = row.optString("b64_json")
            val url = row.optString("url")
            if (base64.isBlank() && url.isBlank()) null else GeneratedImage(url, base64)
        }
    }

    fun endpointUrl(baseUrl: String): String {
        val clean = baseUrl.trim().trimEnd('/')
        return when {
            clean.endsWith("/v1/chat/completions") -> clean.removeSuffix("/chat/completions") + "/images/generations"
            clean.endsWith("/images/generations") -> clean
            clean.endsWith("/v1") -> "$clean/images/generations"
            else -> "$clean/v1/images/generations"
        }
    }
}
