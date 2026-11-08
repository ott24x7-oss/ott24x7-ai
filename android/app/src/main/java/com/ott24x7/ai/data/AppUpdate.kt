package com.ott24x7.ai.data

import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

const val UPDATE_MANIFEST_URL = "https://api.ott24x7.com/update/version.json"
const val UPDATE_MANIFEST_FALLBACK_URL = "https://github.com/ott24x7-oss/ott24x7-ai/releases/latest/download/version.json"
const val DEFAULT_APK_URL = "https://api.ott24x7.com/download/OTT24x7-AI.apk"
const val DEFAULT_APK_FALLBACK_URL = "https://github.com/ott24x7-oss/ott24x7-ai/releases/latest/download/OTT24x7-AI.apk"

data class UpdateInfo(
    val latestVersionCode: Int,
    val minVersionCode: Int,
    val versionName: String,
    val apkUrl: String,
    val notes: String
)

enum class UpdateDecision { NONE, OPTIONAL, FORCED }

object AppUpdate {
    /** Parses version.json; returns null when the file is malformed so a bad upload never blocks the app. */
    fun parse(json: String, allowHttp: Boolean = false): UpdateInfo? = runCatching {
        val o = JSONObject(json)
        val latest = o.getInt("latestVersionCode")
        val apkUrl = o.optString("apkUrl").ifBlank { DEFAULT_APK_URL }
        require(apkUrl.startsWith("https://") || (allowHttp && apkUrl.startsWith("http://")))
        UpdateInfo(
            latestVersionCode = latest,
            minVersionCode = o.optInt("minVersionCode", 0).coerceAtMost(latest),
            versionName = o.optString("versionName"),
            apkUrl = apkUrl,
            notes = o.optString("notes")
        )
    }.getOrNull()

    fun decide(installedVersionCode: Int, info: UpdateInfo?): UpdateDecision = when {
        info == null || installedVersionCode >= info.latestVersionCode -> UpdateDecision.NONE
        installedVersionCode < info.minVersionCode -> UpdateDecision.FORCED
        else -> UpdateDecision.OPTIONAL
    }

    fun fetch(manifestUrl: String = UPDATE_MANIFEST_URL, allowHttp: Boolean = false): UpdateInfo? =
        fetchFromUrls(listOf(manifestUrl, UPDATE_MANIFEST_FALLBACK_URL), allowHttp) { url ->
            URL(url).openConnection() as HttpURLConnection
        }

    internal fun fetchFromUrls(
        urls: List<String>,
        allowHttp: Boolean = false,
        openConnection: (String) -> HttpURLConnection
    ): UpdateInfo? {
        for (url in urls.distinct()) {
            if (!isAllowedManifestUrl(url, allowHttp)) continue
            val info = runCatching {
                val connection = openConnection(url)
                try {
                    connection.connectTimeout = 8_000
                    connection.readTimeout = 8_000
                    connection.setRequestProperty("Cache-Control", "no-cache")
                    if (connection.responseCode !in 200..299) return@runCatching null
                    if (!isAllowedManifestUrl(connection.url.toString(), allowHttp)) return@runCatching null
                    parse(connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }, allowHttp)
                } finally {
                    connection.disconnect()
                }
            }.getOrNull()
            if (info != null) return info
        }
        return null
    }

    fun downloadWithFallback(manifestUrl: String, target: File, onProgress: (Float) -> Unit) {
        downloadFromUrls(listOf(DEFAULT_APK_URL, manifestUrl, DEFAULT_APK_FALLBACK_URL), target, onProgress) { url, file, progress ->
            download(url, file, progress)
        }
    }

    internal fun downloadFromUrls(
        urls: List<String>,
        target: File,
        onProgress: (Float) -> Unit,
        download: (String, File, (Float) -> Unit) -> Unit
    ) {
        var lastError: Exception? = null
        for (url in urls.distinct()) {
            if (!isHttps(url)) {
                lastError = IllegalArgumentException("Update downloads must use HTTPS")
                continue
            }
            try {
                download(url, target, onProgress)
                return
            } catch (error: Exception) {
                lastError = error
            }
        }
        throw lastError ?: IllegalStateException("No update download URL was available")
    }

    internal fun isHttps(url: String): Boolean = protocol(url) == "https"

    private fun isAllowedManifestUrl(url: String, allowHttp: Boolean): Boolean {
        val protocol = protocol(url)
        return protocol == "https" || (allowHttp && protocol == "http")
    }

    private fun protocol(url: String): String? = runCatching { URL(url).protocol.lowercase() }.getOrNull()

    fun download(apkUrl: String, target: File, onProgress: (Float) -> Unit) {
        require(isHttps(apkUrl)) { "Update downloads must use HTTPS" }
        target.parentFile?.mkdirs()
        val connection = URL(apkUrl).openConnection() as HttpURLConnection
        try {
            connection.connectTimeout = 15_000
            connection.readTimeout = 30_000
            if (connection.responseCode !in 200..299) throw IllegalStateException("Download failed (${connection.responseCode})")
            require(isHttps(connection.url.toString())) { "Update downloads must use HTTPS" }
            val total = connection.contentLengthLong
            var done = 0L
            connection.inputStream.use { input ->
                target.outputStream().use { output ->
                    val buffer = ByteArray(64 * 1024)
                    while (true) {
                        val read = input.read(buffer)
                        if (read < 0) break
                        output.write(buffer, 0, read)
                        done += read
                        if (total > 0) onProgress(done.toFloat() / total)
                    }
                }
            }
        } finally {
            connection.disconnect()
        }
    }
}
