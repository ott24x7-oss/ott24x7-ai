package com.ott24x7.ai.data

import org.json.JSONObject

data class WebPanelAdapter(
    val inputSelectors: List<String>,
    val sendSelectors: List<String>,
    val readySelectors: List<String> = inputSelectors,
    val lastAnswerSelector: String? = null,
    val stopSelector: String? = null,
    val enterToSend: Boolean = true
)

enum class WebSendStatus { SENT, LOGIN_NEEDED, INPUT_NOT_FOUND, FAILED }

object WebPanelScripts {
    private val generic = WebPanelAdapter(
        listOf("textarea", "[contenteditable=\"true\"]", "[role=\"textbox\"]"),
        listOf("button[type=\"submit\"]", "button[aria-label*=\"Send\"]", "button[aria-label*=\"Submit\"]")
    )

    private val adapters = mapOf(
        "chatgpt" to WebPanelAdapter(
            listOf("#prompt-textarea", "[data-testid=\"prompt-textarea\"]", "div[contenteditable=\"true\"][data-lexical-editor=\"true\"]"),
            listOf("[data-testid=\"send-button\"]", "button[aria-label*=\"Send prompt\"]"),
            lastAnswerSelector = "[data-message-author-role=\"assistant\"]",
            stopSelector = "button[data-testid=\"stop-button\"]"
        ),
        "claude" to WebPanelAdapter(
            listOf(".ProseMirror[contenteditable=\"true\"]", "[contenteditable=\"true\"][data-placeholder]"),
            listOf("button[aria-label*=\"Send message\"]", "button[data-testid*=\"send\"]"),
            lastAnswerSelector = "[data-testid=\"chat-message\"] .font-claude-response",
            stopSelector = "button[aria-label*=\"Stop\"]"
        ),
        "gemini" to WebPanelAdapter(
            listOf(".ql-editor[contenteditable=\"true\"]", "rich-textarea [contenteditable=\"true\"]", "rich-textarea .ql-editor", "textarea"),
            listOf("button[aria-label*=\"Send message\"]", "button[aria-label*=\"Send\"]"),
            listOf(".ql-editor[contenteditable=\"true\"]", "rich-textarea"),
            "model-response", "button[aria-label*=\"Stop\"]"
        ),
        "deepseek" to WebPanelAdapter(
            listOf("textarea#chat-input", "textarea[placeholder*=\"Message\"]", "textarea"),
            listOf("button[aria-label*=\"Send\"]", "button[data-testid*=\"send\"]"),
            lastAnswerSelector = ".ds-markdown",
            stopSelector = "button[aria-label*=\"Stop\"]"
        ),
        "grok" to WebPanelAdapter(
            listOf("textarea[aria-label*=\"Ask\"]", "textarea[placeholder*=\"Ask\"]", "[contenteditable=\"true\"]"),
            listOf("button[aria-label*=\"Submit\"]", "button[aria-label*=\"Send\"]"),
            lastAnswerSelector = "[data-testid=\"conversation-turn\"] [data-message-author-role=\"assistant\"]",
            stopSelector = "button[aria-label*=\"Stop\"]"
        ),
        "copilot" to WebPanelAdapter(
            listOf("textarea[aria-label*=\"Message\"]", "#userInput", "[contenteditable=\"true\"]"),
            listOf("button[aria-label*=\"Send\"]", "button[data-testid*=\"send\"]"),
            listOf("#userInput", "textarea[aria-label*=\"Message\"]", "[contenteditable=\"true\"]"),
            "cib-message-group[source=\"bot\"]", "button[aria-label*=\"Stop\"]"
        ),
        "perplexity" to WebPanelAdapter(
            listOf("textarea[placeholder*=\"Ask\"]", "textarea[aria-label*=\"Ask\"]", "[contenteditable=\"true\"]"),
            listOf("button[aria-label*=\"Submit\"]", "button[aria-label*=\"Send\"]"),
            lastAnswerSelector = "[data-testid=\"answer\"]",
            stopSelector = "button[aria-label*=\"Stop\"]"
        ),
        "meta" to generic,
        "kimi" to generic,
        "qwen" to generic
    )

    fun adapterFor(id: String): WebPanelAdapter = adapters[id.lowercase()] ?: generic

    fun mapStatus(status: WebSendStatus): DeliveryStatus = when (status) {
        WebSendStatus.SENT -> DeliveryStatus.SENT
        WebSendStatus.LOGIN_NEEDED -> DeliveryStatus.LOGIN_NEEDED
        WebSendStatus.INPUT_NOT_FOUND, WebSendStatus.FAILED -> DeliveryStatus.COPIED
    }

    fun buildInsertPromptScript(adapter: WebPanelAdapter, prompt: String): String {
        val input = (adapter.inputSelectors + generic.inputSelectors).distinct()
        val send = (adapter.sendSelectors + generic.sendSelectors).distinct()
        val ready = (adapter.readySelectors + generic.readySelectors).distinct()
        return """(() => {
  const inputSelectors = ${jsonArray(input)};
  const sendSelectors = ${jsonArray(send)};
  const readySelectors = ${jsonArray(ready)};
  const prompt = ${JSONObject.quote(prompt)};
  const queryDeep = (root, selector) => {
    const direct = root.querySelector(selector);
    if (direct) return direct;
    for (const element of root.querySelectorAll('*')) {
      if (element.shadowRoot) {
        const nested = queryDeep(element.shadowRoot, selector);
        if (nested) return nested;
      }
    }
    return null;
  };
  const loginPage = /(?:^|\/)(?:login|log-in|signin|sign-in|auth)(?:\/|$)/i.test(location.pathname) ||
    Boolean(document.querySelector('input[type="password"], input[autocomplete="current-password"]'));
  if (!readySelectors.some((selector) => queryDeep(document, selector)))
    return { status: loginPage ? "login-needed" : "input-not-found" };
  let input = null;
  for (const selector of inputSelectors) { input = queryDeep(document, selector); if (input) break; }
  if (!input || !(input instanceof HTMLElement)) return { status: loginPage ? "login-needed" : "input-not-found" };
  input.focus();
  if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
    setter?.call(input, prompt);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    const selection = window.getSelection(); const range = document.createRange();
    range.selectNodeContents(input); selection?.removeAllRanges(); selection?.addRange(range);
    document.execCommand('insertText', false, prompt);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
  }
  for (const selector of sendSelectors) {
    const button = queryDeep(document, selector);
    if (button instanceof HTMLButtonElement && !button.disabled) { button.click(); return { status: "sent", clicked: true }; }
  }
  return { status: "sent", clicked: false };
})()"""
    }

    fun buildReadAnswerScript(adapter: WebPanelAdapter): String {
        val selector = adapter.lastAnswerSelector ?: return "(() => \"\")()"
        return "(() => { const answer = Array.from(document.querySelectorAll(${JSONObject.quote(selector)})).at(-1); return answer instanceof HTMLElement ? answer.innerText.trim() : \"\"; })()"
    }

    private fun jsonArray(values: List<String>) = "[${values.joinToString(",") { JSONObject.quote(it) }}]"
}

fun normalizeChatCompletionsUrl(baseUrl: String): String {
    val trimmed = baseUrl.trim().trimEnd('/')
    require(trimmed.isNotEmpty()) { "Enter a base URL" }
    val uri = runCatching { java.net.URI(trimmed) }.getOrElse { throw IllegalArgumentException("Enter a valid base URL") }
    require(uri.scheme.equals("https", true) || uri.scheme.equals("http", true)) { "URL must use HTTP or HTTPS" }
    require(!uri.host.isNullOrBlank() && uri.userInfo == null && uri.query == null && uri.fragment == null) { "Enter a base URL without credentials or query parameters" }
    val path = uri.path.orEmpty().trimEnd('/')
    val normalizedPath = when {
        path.endsWith("/chat/completions", true) -> path
        path.endsWith("/v1", true) -> "$path/chat/completions"
        path.isEmpty() -> "/v1/chat/completions"
        else -> "$path/v1/chat/completions"
    }
    return "${uri.scheme.lowercase()}://${uri.rawAuthority}$normalizedPath"
}
