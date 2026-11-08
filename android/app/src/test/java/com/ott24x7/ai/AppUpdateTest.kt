package com.ott24x7.ai

import com.ott24x7.ai.data.AppUpdate
import com.ott24x7.ai.data.DEFAULT_APK_URL
import com.ott24x7.ai.data.DEFAULT_APK_FALLBACK_URL
import com.ott24x7.ai.data.UPDATE_MANIFEST_FALLBACK_URL
import com.ott24x7.ai.data.UPDATE_MANIFEST_URL
import com.ott24x7.ai.data.UpdateDecision
import java.io.ByteArrayInputStream
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AppUpdateTest {
    private fun manifest(latest: Int, min: Int, url: String = "https://example.com/a.apk") =
        """{"latestVersionCode":$latest,"minVersionCode":$min,"versionName":"1.$latest","apkUrl":"$url","notes":"Fixes"}"""

    @Test
    fun forcesUpdateBelowMinimumVersion() {
        assertEquals(UpdateDecision.FORCED, AppUpdate.decide(3, AppUpdate.parse(manifest(5, 4))))
    }

    @Test
    fun offersOptionalUpdateBetweenMinimumAndLatest() {
        assertEquals(UpdateDecision.OPTIONAL, AppUpdate.decide(4, AppUpdate.parse(manifest(5, 4))))
    }

    @Test
    fun staysQuietWhenUpToDateOrManifestBroken() {
        assertEquals(UpdateDecision.NONE, AppUpdate.decide(5, AppUpdate.parse(manifest(5, 5))))
        assertEquals(UpdateDecision.NONE, AppUpdate.decide(1, AppUpdate.parse("not json")))
        assertEquals(UpdateDecision.NONE, AppUpdate.decide(1, AppUpdate.parse("""{"minVersionCode":9}""")))
    }

    @Test
    fun minimumAboveLatestCannotLockUsersOut() {
        // A typo like min=50, latest=5 must not force users on v5 forever.
        assertEquals(UpdateDecision.NONE, AppUpdate.decide(5, AppUpdate.parse(manifest(5, 50))))
    }

    @Test
    fun rejectsPlainHttpApkUrlsInRelease() {
        assertNull(AppUpdate.parse(manifest(5, 5, "http://example.com/a.apk")))
        assertEquals(5, AppUpdate.parse(manifest(5, 5, "http://localhost/a.apk"), allowHttp = true)?.latestVersionCode)
    }

    @Test
    fun fallsBackToTheStableApkLink() {
        val info = AppUpdate.parse("""{"latestVersionCode":5,"minVersionCode":5}""")
        assertEquals(DEFAULT_APK_URL, info?.apkUrl)
    }

    @Test
    fun manifestFetchFallsBackFromTheOwnDomainToGitHub() {
        val requests = mutableListOf<String>()
        val info = AppUpdate.fetchFromUrls(listOf(UPDATE_MANIFEST_URL, UPDATE_MANIFEST_FALLBACK_URL)) { url ->
            requests += url
            if (url == UPDATE_MANIFEST_URL) FakeConnection(url, 503, "")
            else FakeConnection(url, 200, manifest(5, 5, "https://example.com/a.apk"))
        }

        assertEquals(listOf(UPDATE_MANIFEST_URL, UPDATE_MANIFEST_FALLBACK_URL), requests)
        assertEquals(5, info?.latestVersionCode)
    }

    @Test
    fun manifestFetchSkipsInvalidPrimaryJsonAndReturnsNullWhenBothSourcesFail() {
        val requests = mutableListOf<String>()
        val info = AppUpdate.fetchFromUrls(listOf(UPDATE_MANIFEST_URL, UPDATE_MANIFEST_FALLBACK_URL)) { url ->
            requests += url
            FakeConnection(url, 200, "{broken")
        }

        assertNull(info)
        assertEquals(listOf(UPDATE_MANIFEST_URL, UPDATE_MANIFEST_FALLBACK_URL), requests)
    }

    @Test
    fun manifestFetchSkipsPlainHttpSourcesOutsideDebugMode() {
        val requests = mutableListOf<String>()
        val info = AppUpdate.fetchFromUrls(listOf("http://example.com/version.json", UPDATE_MANIFEST_FALLBACK_URL)) { url ->
            requests += url
            FakeConnection(url, 200, manifest(5, 5))
        }

        assertEquals(listOf(UPDATE_MANIFEST_FALLBACK_URL), requests)
        assertEquals(5, info?.latestVersionCode)
    }

    @Test
    fun apkDownloadFallsBackToManifestUrlAfterTheOwnDomainFails() {
        val target = File.createTempFile("ott24x7-update-test", ".apk")
        val requests = mutableListOf<String>()
        try {
            AppUpdate.downloadFromUrls(
                listOf(DEFAULT_APK_URL, DEFAULT_APK_FALLBACK_URL),
                target,
                {},
                { url, file, _ ->
                    requests += url
                    if (url == DEFAULT_APK_URL) throw IllegalStateException("domain download failed")
                    file.writeText("apk")
                }
            )

            assertEquals(listOf(DEFAULT_APK_URL, DEFAULT_APK_FALLBACK_URL), requests)
            assertEquals("apk", target.readText())
            assertTrue(target.delete())
        } finally {
            target.delete()
        }
    }

    @Test
    fun downloadFallbackRejectsPlainHttpUrls() {
        val target = File.createTempFile("ott24x7-update-test", ".apk")
        var attempted = false
        try {
            val error = runCatching {
                AppUpdate.downloadFromUrls(listOf("http://example.com/a.apk"), target, {}) { _, _, _ ->
                    attempted = true
                }
            }.exceptionOrNull()

            assertFalse(attempted)
            assertTrue(error is IllegalArgumentException)
        } finally {
            target.delete()
        }
    }

    @Test
    fun downloadUrlValidationRejectsPlainHttpAndAcceptsHttps() {
        assertFalse(AppUpdate.isHttps("http://example.com/a.apk"))
        assertTrue(AppUpdate.isHttps("https://example.com/a.apk"))
    }

    private class FakeConnection(url: String, private val status: Int, private val body: String) : HttpURLConnection(URL(url)) {
        override fun connect() = Unit
        override fun disconnect() = Unit
        override fun usingProxy() = false
        override fun getResponseCode() = status
        override fun getInputStream() = ByteArrayInputStream(body.toByteArray(Charsets.UTF_8))
    }
}
