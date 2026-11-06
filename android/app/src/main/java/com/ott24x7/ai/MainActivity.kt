package com.ott24x7.ai

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.view.KeyEvent
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.browser.customtabs.CustomTabsIntent
import com.ott24x7.ai.data.PanelDefinition
import com.ott24x7.ai.data.WebPanelScripts
import com.ott24x7.ai.data.WebSendStatus
import com.ott24x7.ai.data.SecureSettings
import com.ott24x7.ai.ui.FiestaApp
import java.net.URI
import org.json.JSONObject

class MainActivity : ComponentActivity() {
    lateinit var secureSettings: SecureSettings
        private set

    private lateinit var documentPicker: ActivityResultLauncher<Array<String>>
    private lateinit var speechRecognizer: ActivityResultLauncher<Intent>
    private var webFileCallback: ValueCallback<Array<Uri>>? = null
    private var attachmentCallback: ((Uri?) -> Unit)? = null
    private val webViews = mutableMapOf<String, WebView>()
    private val pendingWebPrompts = mutableMapOf<String, PendingWebPrompt>()
    private val googleSignInUrls = mutableMapOf<String, String>()
    var onGoogleSignInRequired: ((String) -> Unit)? = null
    var onSpeechResult: ((String) -> Unit)? = null

    private data class PendingWebPrompt(
        val panel: PanelDefinition,
        val prompt: String,
        val onResult: (WebSendStatus) -> Unit
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        secureSettings = SecureSettings(applicationContext)
        documentPicker = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
            val webCallback = webFileCallback
            webFileCallback = null
            if (webCallback != null) webCallback.onReceiveValue(uri?.let { arrayOf(it) })
            else attachmentCallback?.invoke(uri)
            attachmentCallback = null
        }
        speechRecognizer = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val phrase = result.data?.getStringArrayListExtra(android.speech.RecognizerIntent.EXTRA_RESULTS)?.firstOrNull().orEmpty()
            if (phrase.isNotBlank()) onSpeechResult?.invoke(phrase)
        }
        setContent { FiestaApp(this) }
    }

    fun launchAttachmentPicker(onPicked: (Uri?) -> Unit) {
        attachmentCallback = onPicked
        documentPicker.launch(arrayOf("image/*", "application/pdf"))
    }

    fun launchWebFilePicker(callback: ValueCallback<Array<Uri>>): Boolean {
        webFileCallback?.onReceiveValue(null)
        webFileCallback = callback
        documentPicker.launch(arrayOf("*/*"))
        return true
    }

    fun launchSpeechRecognition() {
        val intent = Intent(android.speech.RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE_MODEL, android.speech.RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE, "en-US")
            putExtra(android.speech.RecognizerIntent.EXTRA_PROMPT, "Speak your prompt")
        }
        runCatching { speechRecognizer.launch(intent) }
    }

    fun openGoogleSignIn(url: String) {
        runCatching { CustomTabsIntent.Builder().setShowTitle(true).build().launchUrl(this, Uri.parse(url)) }
            .onFailure { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
    }

    fun googleSignInUrl(panelId: String, fallback: String): String = googleSignInUrls[panelId] ?: fallback

    fun openExternal(url: String) {
        runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
    }

    fun webViewFor(panel: PanelDefinition): WebView = webViews.getOrPut(panel.id) {
        CookieManager.getInstance().setAcceptCookie(true)
        WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.javaScriptCanOpenWindowsAutomatically = true
            settings.setSupportMultipleWindows(false)
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    if (request.url.host.equals("accounts.google.com", ignoreCase = true)) {
                        googleSignInUrls[panel.id] = request.url.toString()
                        onGoogleSignInRequired?.invoke(panel.id)
                    }
                    return false
                }

                override fun onPageFinished(view: WebView, url: String?) {
                    super.onPageFinished(view, url)
                    pendingWebPrompts[panel.id]?.let { injectPrompt(view, it) }
                }
            }
            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    webView: WebView?,
                    filePathCallback: ValueCallback<Array<Uri>>?,
                    fileChooserParams: FileChooserParams?
                ): Boolean {
                    if (filePathCallback == null) return false
                    return launchWebFilePicker(filePathCallback)
                }
            }
            loadUrl(panel.url)
        }
    }

    fun sendPromptToWebPanel(panel: PanelDefinition, prompt: String, onResult: (WebSendStatus) -> Unit) {
        val pending = PendingWebPrompt(panel, prompt, onResult)
        pendingWebPrompts[panel.id] = pending
        val view = webViewFor(panel)
        if (view.progress >= 100 && !view.url.isNullOrBlank()) injectPrompt(view, pending)
        else if (view.url.isNullOrBlank()) view.loadUrl(panel.url)
    }

    private fun injectPrompt(view: WebView, pending: PendingWebPrompt) {
        if (pendingWebPrompts[pending.panel.id] !== pending) return
        val script = WebPanelScripts.buildInsertPromptScript(WebPanelScripts.adapterFor(pending.panel.id), pending.prompt)
        view.evaluateJavascript(script) { raw ->
            if (pendingWebPrompts[pending.panel.id] !== pending) return@evaluateJavascript
            val status = runCatching { JSONObject(raw.orEmpty()).optString("status") }.getOrDefault("")
            when (status) {
                "sent" -> {
                    val clicked = runCatching { JSONObject(raw.orEmpty()).optBoolean("clicked") }.getOrDefault(false)
                    if (!clicked) {
                        view.requestFocus()
                        view.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_ENTER))
                        view.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_ENTER))
                    }
                    pending.onResult(WebSendStatus.SENT)
                }
                "login-needed" -> pending.onResult(WebSendStatus.LOGIN_NEEDED)
                else -> pending.onResult(WebSendStatus.INPUT_NOT_FOUND)
            }
            pendingWebPrompts.remove(pending.panel.id)
        }
    }

    fun clearPanelLogin(panel: PanelDefinition) {
        val host = runCatching { URI(panel.url).host }.getOrNull() ?: return
        val cookieManager = CookieManager.getInstance()
        val cookieDomain = if (host.endsWith(".google.com", ignoreCase = true)) ".google.com" else ".$host"
        cookieManager.getCookie(host).orEmpty().split(';').map(String::trim).filter(String::isNotBlank).forEach { cookie ->
            val name = cookie.substringBefore('=').trim()
            if (name.isNotBlank()) {
                cookieManager.setCookie(host, "$name=; Max-Age=0; path=/; domain=$cookieDomain")
                cookieManager.setCookie(host, "$name=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/")
            }
        }
        cookieManager.flush()
        webViews.filterKeys { it == panel.id || it.startsWith("${panel.id}:") }.values.forEach { view ->
            view.evaluateJavascript("try { localStorage.clear(); sessionStorage.clear(); } catch (_) {}", null)
            view.clearCache(true)
            view.clearHistory()
            view.postDelayed({ view.loadUrl(panel.url) }, 100)
        }
    }

    override fun onPause() {
        super.onPause()
        CookieManager.getInstance().flush()
        webViews.values.forEach { it.onPause() }
    }

    override fun onResume() {
        super.onResume()
        webViews.values.forEach { it.onResume() }
    }

    override fun onDestroy() {
        super.onDestroy()
        webViews.values.forEach { it.destroy() }
        webViews.clear()
        pendingWebPrompts.clear()
        googleSignInUrls.clear()
    }
}
