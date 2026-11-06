package com.ott24x7.ai.data

enum class PanelKind { WEB, API }

data class PanelDefinition(
    val id: String,
    val name: String,
    val url: String,
    val description: String,
    val kind: PanelKind = PanelKind.WEB,
    val endpoint: ApiEndpoint? = null
)

data class ApiEndpoint(
    val id: String,
    val name: String,
    val baseUrl: String,
    val apiKey: String,
    val modelId: String
)

data class PanelAnswer(
    val text: String = "",
    val status: DeliveryStatus = DeliveryStatus.IDLE,
    val loading: Boolean = false
)

data class ApiChatMessage(val role: String, val content: String)

data class ChatTurnSummary(
    val prompt: String,
    val apiResponses: List<Pair<String, String>>,
    val modelCount: Int
)

enum class DeliveryStatus { IDLE, SENT, LOGIN_NEEDED, COPIED, TYPING, ERROR }

object PanelCatalog {
    val webPanels = listOf(
        PanelDefinition("chatgpt", "ChatGPT", "https://chatgpt.com/", "OpenAI · Web"),
        PanelDefinition("claude", "Claude", "https://claude.ai/", "Anthropic · Web"),
        PanelDefinition("gemini", "Gemini", "https://gemini.google.com/app", "Google · Web"),
        PanelDefinition("deepseek", "DeepSeek", "https://chat.deepseek.com/", "DeepSeek · Web"),
        PanelDefinition("grok", "Grok", "https://grok.com/", "xAI · Web"),
        PanelDefinition("copilot", "Copilot", "https://copilot.microsoft.com/", "Microsoft · Web"),
        PanelDefinition("perplexity", "Perplexity", "https://www.perplexity.ai/", "Perplexity · Web"),
        PanelDefinition("meta", "Meta AI", "https://www.meta.ai/", "Meta · Web"),
        PanelDefinition("kimi", "Kimi", "https://www.kimi.com/", "Moonshot · Web"),
        PanelDefinition("qwen", "Qwen", "https://chat.qwen.ai/", "Alibaba · Web")
    )

    val defaultSelection = listOf("chatgpt", "claude", "gemini", "deepseek")

    fun withEndpoints(endpoints: List<ApiEndpoint>): List<PanelDefinition> = webPanels + endpoints.map {
        PanelDefinition(
            id = "api:${it.id}",
            name = it.name.ifBlank { it.modelId },
            url = it.baseUrl,
            description = "${it.modelId} · API",
            kind = PanelKind.API,
            endpoint = it
        )
    }
}
