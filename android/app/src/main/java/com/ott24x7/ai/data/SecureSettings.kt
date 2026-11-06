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

    fun selectedPanels(): List<String> = preferences.getString("selected_panels", null)
        ?.split(',')?.filter(String::isNotBlank) ?: PanelCatalog.defaultSelection

    fun saveSelectedPanels(value: List<String>) = preferences.edit().putString("selected_panels", value.joinToString(",")).apply()
    fun themeMode(): String = preferences.getString("theme_mode", "system") ?: "system"
    fun saveThemeMode(value: String) = preferences.edit().putString("theme_mode", value).apply()
    fun readWebAnswers(): Boolean = preferences.getBoolean("read_web_answers", false)
    fun saveReadWebAnswers(value: Boolean) = preferences.edit().putBoolean("read_web_answers", value).apply()
    fun history(): List<String> = runCatching {
        val array = JSONArray(preferences.getString("history", "[]"))
        (0 until array.length()).map { array.optString(it) }.filter(String::isNotBlank)
    }.getOrDefault(emptyList())
    fun saveHistory(values: List<String>) {
        val array = JSONArray()
        values.take(50).forEach(array::put)
        preferences.edit().putString("history", array.toString()).apply()
    }
    fun endpoints(): List<ApiEndpoint> = runCatching {
        val array = JSONArray(preferences.getString("api_endpoints", "[]"))
        (0 until array.length()).map { index ->
            val row = array.getJSONObject(index)
            ApiEndpoint(row.getString("id"), row.getString("name"), row.getString("baseUrl"), row.getString("apiKey"), row.getString("modelId"))
        }
    }.getOrDefault(emptyList())

    fun saveEndpoints(values: List<ApiEndpoint>) {
        val array = JSONArray()
        values.forEach { row ->
            array.put(JSONObject().put("id", row.id).put("name", row.name).put("baseUrl", row.baseUrl).put("apiKey", row.apiKey).put("modelId", row.modelId))
        }
        preferences.edit().putString("api_endpoints", array.toString()).apply()
    }
}
