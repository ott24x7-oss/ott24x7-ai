package com.ott24x7.ai

import com.ott24x7.ai.data.AppUpdate
import com.ott24x7.ai.data.DEFAULT_APK_URL
import com.ott24x7.ai.data.UpdateDecision
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
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
}
