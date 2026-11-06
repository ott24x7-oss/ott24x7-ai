package com.ott24x7.ai.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import org.json.JSONArray
import org.json.JSONObject

class SecureSettings(context: Context) {
    private val preferences: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        "ott24x7_secure_settings",
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    private fun snapshot(): AppSettingsSnapshot {
        preferences.getString("app_settings_v2", null)?.let { return AppSettingsCodec.decode(it) }
        val selected = preferences.getString("selected_panels", null)?.split(',')?.filter(String::isNotBlank) ?: PanelCatalog.defaultSelection
        val done = runCatching { JSONArray(preferences.getString("guide_checklist", "[]")).let { array -> (0 until array.length()).map { array.optBoolean(it) } } }.getOrDefault(emptyList())
        return AppSettingsSnapshot(
            selectedPanels = selected,
            themeMode = preferences.getString("theme_mode", "system") ?: "system",
            accentColor = preferences.getLong("accent_color", 0xFF7C5CFF),
            webSearchEnabled = preferences.getBoolean("default_web_search", false),
            exaKey = preferences.getString("exa_api_key", "").orEmpty(),
            onboardingSeen = preferences.getBoolean("onboarding_seen", false),
            guideDone = done,
            readWebAnswers = preferences.getBoolean("read_web_answers", false),
            judgeModelId = preferences.getString("judge_model_id", "").orEmpty()
        )
    }

    private fun updateSnapshot(transform: (AppSettingsSnapshot) -> AppSettingsSnapshot) {
        val next = transform(snapshot())
        preferences.edit().putString("app_settings_v2", AppSettingsCodec.encode(next)).apply()
    }

    fun selectedPanels(): List<String> = snapshot().selectedPanels
    fun saveSelectedPanels(value: List<String>) = updateSnapshot { it.copy(selectedPanels = value) }
    fun themeMode(): String = snapshot().themeMode
    fun saveThemeMode(value: String) = updateSnapshot { it.copy(themeMode = value) }
    fun readWebAnswers(): Boolean = snapshot().readWebAnswers
    fun saveReadWebAnswers(value: Boolean) = updateSnapshot { it.copy(readWebAnswers = value) }
    fun exaApiKey(): String = snapshot().exaKey
    fun saveExaApiKey(value: String) = updateSnapshot { it.copy(exaKey = value) }
    fun defaultWebSearch(): Boolean = snapshot().webSearchEnabled
    fun saveDefaultWebSearch(value: Boolean) = updateSnapshot { it.copy(webSearchEnabled = value) }
    fun accentColor(): Long = snapshot().accentColor
    fun saveAccentColor(value: Long) = updateSnapshot { it.copy(accentColor = value) }
    fun onboardingSeen(): Boolean = snapshot().onboardingSeen
    fun saveOnboardingSeen(value: Boolean) = updateSnapshot { it.copy(onboardingSeen = value) }
    fun judgeModelId(): String? = snapshot().judgeModelId.takeIf(String::isNotBlank)
    fun saveJudgeModelId(value: String) = updateSnapshot { it.copy(judgeModelId = value) }
    fun guideChecklist(): List<Boolean> = snapshot().guideDone
    fun saveGuideChecklist(value: List<Boolean>) = updateSnapshot { it.copy(guideDone = value) }
    fun history(): List<String> = runCatching {
        val array = JSONArray(preferences.getString("history", "[]"))
        (0 until array.length()).map { array.optString(it) }.filter(String::isNotBlank)
    }.getOrDefault(emptyList())
    fun saveHistory(values: List<String>) {
        val array = JSONArray()
        values.take(50).forEach(array::put)
        preferences.edit().putString("history", array.toString()).apply()
    }
    fun historyTurns(): List<HistoryTurn> = HistoryStoreCodec.decode(preferences.getString("history_turns", "[]").orEmpty())
    fun saveHistoryTurns(values: List<HistoryTurn>) = preferences.edit().putString("history_turns", HistoryStoreCodec.encode(values)).apply()
    fun endpoints(): List<ApiEndpoint> = runCatching {
        val array = JSONArray(preferences.getString("api_endpoints", "[]"))
        (0 until array.length()).map { index ->
            val row = array.getJSONObject(index)
            ApiEndpoint(row.getString("id"), row.getString("name"), row.getString("baseUrl"), row.getString("apiKey"), row.getString("modelId"), row.optString("imageModelId"))
        }
    }.getOrDefault(emptyList())

    fun saveEndpoints(values: List<ApiEndpoint>) {
        val array = JSONArray()
        values.forEach { row ->
            array.put(JSONObject().put("id", row.id).put("name", row.name).put("baseUrl", row.baseUrl).put("apiKey", row.apiKey).put("modelId", row.modelId).put("imageModelId", row.imageModelId))
        }
        preferences.edit().putString("api_endpoints", array.toString()).apply()
    }
}
