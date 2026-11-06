package com.ott24x7.ai.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.PageSize
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat
import com.ott24x7.ai.MainActivity
import com.ott24x7.ai.R
import com.ott24x7.ai.data.ApiAttachment
import com.ott24x7.ai.data.ApiChatMessage
import com.ott24x7.ai.data.ApiClient
import com.ott24x7.ai.data.ApiEndpoint
import com.ott24x7.ai.data.ChatTurnSummary
import com.ott24x7.ai.data.DeliveryStatus
import com.ott24x7.ai.data.PanelAnswer
import com.ott24x7.ai.data.PanelCatalog
import com.ott24x7.ai.data.PanelDefinition
import com.ott24x7.ai.data.PanelKind
import com.ott24x7.ai.data.WebPanelScripts
import com.ott24x7.ai.data.WebSendStatus
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import org.json.JSONTokener
import java.io.FileNotFoundException
import kotlin.coroutines.resume
import androidx.compose.ui.layout.ContentScale

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun FiestaApp(activity: MainActivity) {
    val settings = activity.secureSettings
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val haptic = LocalHapticFeedback.current
    val mainHandler = remember { Handler(Looper.getMainLooper()) }
    val systemDark = androidx.compose.foundation.isSystemInDarkTheme()
    var themeMode by remember { mutableStateOf(settings.themeMode()) }
    val dark = when (themeMode) { "dark" -> true; "light" -> false; else -> systemDark }
    var endpoints by remember { mutableStateOf(settings.endpoints()) }
    val availablePanelIds = remember(endpoints) {
        PanelCatalog.webPanels.map(PanelDefinition::id) + endpoints.map { "api:${it.id}" }
    }
    var selectedIds by remember { mutableStateOf(settings.selectedPanels().filter { it in availablePanelIds }.take(8)) }
    var readWebAnswers by remember { mutableStateOf(settings.readWebAnswers()) }
    val panels = remember(endpoints) { PanelCatalog.withEndpoints(endpoints) }
    val selectedPanels = panels.filter { it.id in selectedIds }
    var prompt by remember { mutableStateOf("") }
    var currentPrompt by remember { mutableStateOf("") }
    var attachment by remember { mutableStateOf<ApiAttachment?>(null) }
    var showModelPicker by remember { mutableStateOf(false) }
    var showSettings by remember { mutableStateOf(false) }
    var showCombine by remember { mutableStateOf(false) }
    var expandedPanelId by remember { mutableStateOf<String?>(null) }
    var currentSetName by remember { mutableStateOf("My subscriptions") }
    var setMenuExpanded by remember { mutableStateOf(false) }
    var combineText by remember { mutableStateOf("") }
    var combineLoading by remember { mutableStateOf(false) }
    var judgeId by remember { mutableStateOf(endpoints.firstOrNull()?.id) }
    var googleSignInPanel by remember { mutableStateOf<String?>(null) }
    var activeTurn by remember { mutableIntStateOf(0) }
    val answers = remember { mutableStateMapOf<String, PanelAnswer>() }
    val conversationTurns = remember { mutableStateListOf<ChatTurnSummary>() }
    val apiConversations = remember { mutableStateMapOf<String, List<ApiChatMessage>>() }
    val history = remember { mutableStateListOf<String>().apply { addAll(settings.history()) } }
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)

    SideEffect {
        WindowCompat.getInsetsController(activity.window, activity.window.decorView).isAppearanceLightStatusBars = !dark
        WindowCompat.getInsetsController(activity.window, activity.window.decorView).isAppearanceLightNavigationBars = !dark
        activity.window.statusBarColor = android.graphics.Color.TRANSPARENT
        activity.window.navigationBarColor = android.graphics.Color.TRANSPARENT
        activity.onGoogleSignInRequired = { id -> googleSignInPanel = id }
        activity.onSpeechResult = { recognized -> prompt = recognized }
    }

    fun copyText(value: String) {
        if (value.isNotBlank()) {
            clipboard.setText(AnnotatedString(value))
            scope.launch { snackbar.showSnackbar("Copied to clipboard") }
        }
    }

    fun saveSelection(value: List<String>) {
        selectedIds = value.take(8)
        settings.saveSelectedPanels(selectedIds)
    }

    fun updateAnswer(id: String, update: (PanelAnswer) -> PanelAnswer) {
        answers[id] = update(answers[id] ?: PanelAnswer())
    }

    fun runApi(panel: PanelDefinition, text: String, file: ApiAttachment?, turn: Int) {
        val endpoint = panel.endpoint ?: return
        val previousMessages = apiConversations[endpoint.id].orEmpty().toList()
        answers[panel.id] = PanelAnswer(status = DeliveryStatus.TYPING, loading = true)
        scope.launch {
            try {
                val answerText = withContext(Dispatchers.IO) {
                    ApiClient.stream(endpoint, text, file, previousMessages) { delta ->
                        mainHandler.post {
                            if (activeTurn == turn) updateAnswer(panel.id) { it.copy(text = it.text + delta, status = DeliveryStatus.TYPING, loading = true) }
                        }
                    }
                }
                if (activeTurn == turn) {
                    apiConversations[endpoint.id] = previousMessages + ApiChatMessage("user", text) + ApiChatMessage("assistant", answerText)
                    updateAnswer(panel.id) { it.copy(text = answerText, status = DeliveryStatus.SENT, loading = false) }
                }
            } catch (_: Exception) {
                if (activeTurn == turn) updateAnswer(panel.id) { it.copy(status = DeliveryStatus.ERROR, loading = false) }
                snackbar.showSnackbar("${panel.name} could not respond. Check the endpoint settings.")
            }
        }
    }

    fun sendOne(panel: PanelDefinition, text: String, file: ApiAttachment?, turn: Int) {
        if (panel.kind == PanelKind.API) {
            runApi(panel, text, file, turn)
        } else {
            answers[panel.id] = PanelAnswer(status = DeliveryStatus.TYPING, loading = true)
            activity.sendPromptToWebPanel(panel, text) { status ->
                if (activeTurn == turn) updateAnswer(panel.id) { it.copy(status = WebPanelScripts.mapStatus(status), loading = false) }
            }
        }
    }

    fun submitPrompt(value: String) {
        val text = value.trim()
        if (text.isEmpty()) return
        if (selectedPanels.isEmpty()) {
            scope.launch { snackbar.showSnackbar("Choose at least one AI model") }
            return
        }
        haptic.performHapticFeedback(HapticFeedbackType.LongPress)
        if (currentPrompt.isNotBlank()) {
            val previousAnswers = selectedPanels.mapNotNull { panel ->
                answers[panel.id]?.text?.takeIf(String::isNotBlank)?.let { panel.name to it }
            }
            conversationTurns.add(ChatTurnSummary(currentPrompt, previousAnswers, selectedPanels.size))
        }
        activeTurn += 1
        val turn = activeTurn
        currentPrompt = text
        prompt = ""
        answers.clear()
        selectedPanels.forEach { answers[it.id] = PanelAnswer(status = DeliveryStatus.TYPING, loading = true) }
        history.remove(text)
        history.add(0, text)
        settings.saveHistory(history.toList())
        selectedPanels.filter { it.kind == PanelKind.WEB }.forEach { panel ->
            activity.sendPromptToWebPanel(panel, text) { status ->
                if (activeTurn == turn) {
                    updateAnswer(panel.id) { it.copy(status = WebPanelScripts.mapStatus(status), loading = false) }
                    if (status != WebSendStatus.SENT) {
                        val systemClipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                        systemClipboard.setPrimaryClip(ClipData.newPlainText("OTT24x7 AI prompt", text))
                        scope.launch { snackbar.showSnackbar("Prompt copied for a panel that couldn't accept it") }
                    }
                }
            }
        }
        selectedPanels.filter { it.kind == PanelKind.API }.forEach { runApi(it, text, attachment, turn) }
        attachment = null
    }

    suspend fun visibleWebAnswer(panel: PanelDefinition): String = suspendCancellableCoroutine { continuation ->
        val webView = activity.webViewFor(panel)
        val script = WebPanelScripts.buildReadAnswerScript(WebPanelScripts.adapterFor(panel.id))
        webView.evaluateJavascript(script) { raw ->
            if (!continuation.isActive) return@evaluateJavascript
            val answer = runCatching { JSONTokener(raw.orEmpty()).nextValue() as? String }.getOrNull().orEmpty()
            continuation.resume(answer.trim())
        }
    }

    fun combineAnswers() {
        val judge = endpoints.firstOrNull { it.id == judgeId } ?: endpoints.firstOrNull()
        if (judge == null) return
        judgeId = judge.id
        combineLoading = true
        combineText = ""
        scope.launch {
            val source = mutableListOf<String>()
            selectedPanels.filter { it.kind == PanelKind.API }.forEach { panel ->
                val text = answers[panel.id]?.text.orEmpty()
                if (text.isNotBlank()) source += "${panel.name}:\n$text"
            }
            if (readWebAnswers) {
                selectedPanels.filter { it.kind == PanelKind.WEB }.forEach { panel ->
                    runCatching { visibleWebAnswer(panel) }.getOrNull()?.takeIf(String::isNotBlank)?.let { source += "${panel.name}:\n$it" }
                }
            }
            if (source.isEmpty()) {
                combineLoading = false
                combineText = "No answers are ready yet. Wait for a model to respond, then try Combine again."
                return@launch
            }
            val synthesisPrompt = "Create one clear, accurate final answer to the user's prompt. Compare the model responses, keep useful detail, and resolve disagreements.\n\nUser prompt:\n$currentPrompt\n\nModel responses:\n${source.joinToString("\n\n---\n\n")}"
            try {
                val result = withContext(Dispatchers.IO) {
                    ApiClient.stream(judge, synthesisPrompt, null) { delta ->
                        mainHandler.post { combineText += delta }
                    }
                }
                combineText = result
            } catch (_: Exception) {
                combineText = "The judge model couldn't complete the combined answer. Check its endpoint settings and try again."
            }
            combineLoading = false
        }
    }

    fun pickAttachment() {
        activity.launchAttachmentPicker { uri ->
            if (uri == null) return@launchAttachmentPicker
            scope.launch {
                runCatching { readAttachment(context, uri) }
                    .onSuccess { attachment = it }
                    .onFailure { snackbar.showSnackbar("This file could not be attached. Choose an image or PDF.") }
            }
        }
    }

    FiestaTheme(dark) {
        ModalNavigationDrawer(
            drawerState = drawerState,
            drawerContent = {
                HistoryDrawerContent(
                    history = history,
                    onSelectHistory = { item ->
                        activeTurn += 1
                        currentPrompt = ""
                        prompt = item
                        answers.clear()
                        conversationTurns.clear()
                        apiConversations.clear()
                        scope.launch { drawerState.close() }
                    },
                    onSettings = { scope.launch { drawerState.close() }; showSettings = true }
                )
            }
        ) {
            Scaffold(
                modifier = Modifier.fillMaxSize(),
                containerColor = MaterialTheme.colorScheme.background,
                snackbarHost = { SnackbarHost(snackbar) },
                contentWindowInsets = WindowInsets(0, 0, 0, 0)
            ) { innerPadding ->
                Column(
                    Modifier.fillMaxSize().padding(innerPadding).background(MaterialTheme.colorScheme.background)
                        .statusBarsPadding().navigationBarsPadding().imePadding()
                ) {
                    TopBar(
                        title = if (expandedPanelId != null) panels.firstOrNull { it.id == expandedPanelId }?.name ?: "OTT24x7 AI" else currentSetName,
                        setMenuExpanded = setMenuExpanded,
                        onSetMenu = { setMenuExpanded = true },
                        onDismissSet = { setMenuExpanded = false },
                        onSelectSet = { setName ->
                            currentSetName = setName
                            setMenuExpanded = false
                            if (setName == "My subscriptions") saveSelection(PanelCatalog.defaultSelection)
                            else if (setName == "Free models") saveSelection(listOf("gemini", "deepseek", "perplexity", "qwen"))
                            else showModelPicker = true
                        },
                        onHistory = { scope.launch { drawerState.open() } },
                        onNewChat = { activeTurn += 1; currentPrompt = ""; answers.clear(); conversationTurns.clear(); apiConversations.clear(); attachment = null; expandedPanelId = null; combineText = "" },
                        expanded = expandedPanelId != null,
                        onCloseExpanded = { expandedPanelId = null }
                    )

                    if (expandedPanelId != null) {
                        val panel = panels.firstOrNull { it.id == expandedPanelId }
                        if (panel != null) {
                            PanelCard(
                                activity = activity,
                                panel = panel,
                                answer = answers[panel.id] ?: PanelAnswer(),
                                bodyHeight = (LocalConfiguration.current.screenHeightDp * 0.70f).dp,
                                expanded = true,
                                onCopy = { copyText(answers[panel.id]?.text.orEmpty()) },
                                onRegenerate = { sendOne(panel, currentPrompt, attachment, activeTurn) },
                                onExpand = { expandedPanelId = null },
                                onClearLogin = { activity.clearPanelLogin(panel); googleSignInPanel = null },
                                onOpenGoogleCustomTab = { activity.openGoogleSignIn(activity.googleSignInUrl(panel.id, panel.url)) },
                                googleSignInRequired = googleSignInPanel == panel.id,
                                modifier = Modifier.fillMaxWidth().weight(1f).padding(12.dp)
                            )
                        }
                    } else {
                        Box(Modifier.fillMaxWidth().weight(1f)) {
                            if (currentPrompt.isBlank()) {
                                HomeWelcome(
                                    panels = selectedPanels,
                                    onOpenPicker = { showModelPicker = true },
                                    onSuggestion = ::submitPrompt,
                                    modifier = Modifier.fillMaxSize()
                                )
                            } else {
                                AnswerTurn(
                                    panels = selectedPanels,
                                    currentPrompt = currentPrompt,
                                    pastTurns = conversationTurns,
                                    answers = answers,
                                    activity = activity,
                                    googleSignInPanel = googleSignInPanel,
                                    onCopy = { panel -> copyText(answers[panel.id]?.text.orEmpty()) },
                                    onRegenerate = { panel -> sendOne(panel, currentPrompt, attachment, activeTurn) },
                                    onExpand = { panel -> expandedPanelId = panel.id },
                                    onClearLogin = { panel -> activity.clearPanelLogin(panel); googleSignInPanel = null },
                                    onOpenGoogle = { panel -> activity.openGoogleSignIn(activity.googleSignInUrl(panel.id, panel.url)) },
                                    modifier = Modifier.fillMaxSize()
                                )
                            }
                        }
                        AnimatedVisibility(
                            visible = currentPrompt.isNotBlank() && answers.values.any { !it.loading && it.status != DeliveryStatus.IDLE },
                            enter = fadeIn(tween(180)), exit = fadeOut(tween(180))
                        ) {
                            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 3.dp), horizontalArrangement = Arrangement.Center) {
                                Surface(
                                    modifier = Modifier.clip(CircleShape).clickable { showCombine = true },
                                    color = MaterialTheme.colorScheme.surfaceVariant,
                                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                                    shape = CircleShape
                                ) {
                                    Row(Modifier.padding(horizontal = 14.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Default.AutoAwesome, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(16.dp))
                                        Spacer(Modifier.width(6.dp))
                                        Text("Combine", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                                    }
                                }
                            }
                        }
                        PromptComposer(
                            prompt = prompt,
                            onPromptChange = { prompt = it },
                            selectedPanels = selectedPanels,
                            attachment = attachment,
                            onAttach = ::pickAttachment,
                            onRemoveAttachment = { attachment = null },
                            onMic = { activity.launchSpeechRecognition() },
                            onOpenPicker = { showModelPicker = true },
                            onSend = { submitPrompt(prompt) }
                        )
                    }
                }
            }
        }

    if (showModelPicker) {
        ModelPickerSheet(
            panels = panels,
            selectedIds = selectedIds,
            onToggle = { id ->
                if (id in selectedIds) saveSelection(selectedIds - id)
                else if (selectedIds.size < 8) saveSelection(selectedIds + id)
                else scope.launch { snackbar.showSnackbar("You can select up to 8 models") }
            },
            onDismiss = { showModelPicker = false }
        )
    }
    if (showSettings) {
        SettingsSheet(
            panels = panels,
            endpoints = endpoints,
            themeMode = themeMode,
            readWebAnswers = readWebAnswers,
            onThemeMode = { themeMode = it; settings.saveThemeMode(it) },
            onReadWebAnswers = { readWebAnswers = it; settings.saveReadWebAnswers(it) },
            onEndpointsChanged = { updated ->
                endpoints = updated
                settings.saveEndpoints(updated)
                selectedIds = selectedIds.filter { id -> !id.startsWith("api:") || id.removePrefix("api:") in updated.map(ApiEndpoint::id) }
                settings.saveSelectedPanels(selectedIds)
                if (judgeId !in updated.map(ApiEndpoint::id)) judgeId = updated.firstOrNull()?.id
            },
            onClearLogin = activity::clearPanelLogin,
            onOpenUrl = activity::openExternal,
            onDismiss = { showSettings = false }
        )
    }
    if (showCombine) {
        CombineSheet(
            endpoints = endpoints,
            answer = combineText,
            loading = combineLoading,
            judgeId = judgeId,
            onJudgeSelected = { judgeId = it },
            onCombine = ::combineAnswers,
            onCopy = { copyText(combineText) },
            onReRun = ::combineAnswers,
            onSettings = { showCombine = false; showSettings = true },
            onDismiss = { showCombine = false }
        )
    }
    }
}

@Composable
private fun TopBar(
    title: String,
    setMenuExpanded: Boolean,
    onSetMenu: () -> Unit,
    onDismissSet: () -> Unit,
    onSelectSet: (String) -> Unit,
    onHistory: () -> Unit,
    onNewChat: () -> Unit,
    expanded: Boolean,
    onCloseExpanded: () -> Unit
) {
    val colors = MaterialTheme.colorScheme
    Row(Modifier.fillMaxWidth().height(48.dp).padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        IconButton(onClick = if (expanded) onCloseExpanded else onHistory, modifier = Modifier.size(42.dp)) {
            Icon(if (expanded) Icons.Default.Close else Icons.Default.Menu, if (expanded) "Close expanded model" else "Open history", tint = colors.onSurface)
        }
        Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
            Row(Modifier.clip(RoundedCornerShape(10.dp)).clickable(enabled = !expanded, onClick = onSetMenu).padding(horizontal = 7.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(title, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (!expanded) Icon(Icons.Default.ArrowDropDown, null, tint = colors.onSurfaceVariant, modifier = Modifier.size(18.dp))
            }
            DropdownMenu(expanded = setMenuExpanded, onDismissRequest = onDismissSet) {
                listOf("My subscriptions", "Free models", "Custom set").forEach { setName ->
                    DropdownMenuItem(text = { Text(setName) }, onClick = { onSelectSet(setName) })
                }
            }
        }
        if (!expanded) {
            IconButton(onClick = onNewChat, modifier = Modifier.size(40.dp)) { Icon(Icons.Default.Edit, "New chat", tint = colors.onSurfaceVariant, modifier = Modifier.size(19.dp)) }
        }
    }
}

@Composable
private fun HistoryDrawerContent(
    history: List<String>,
    onSelectHistory: (String) -> Unit,
    onSettings: () -> Unit
) {
    val colors = MaterialTheme.colorScheme
    ModalDrawerSheet(
        modifier = Modifier.fillMaxHeight().widthIn(max = 320.dp),
        drawerContainerColor = colors.surface,
        drawerShape = RoundedCornerShape(topEnd = 24.dp, bottomEnd = 24.dp)
    ) {
        Column(Modifier.fillMaxSize().padding(horizontal = 12.dp, vertical = 24.dp)) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                androidx.compose.foundation.Image(
                    painterResource(R.drawable.ott_logo),
                    contentDescription = "OTT24x7 AI logo",
                    modifier = Modifier.size(28.dp).clip(RoundedCornerShape(8.dp)),
                    contentScale = ContentScale.Crop
                )
                Text("OTT24x7 AI", Modifier.padding(start = 9.dp), fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
            }
            Text("Recent", color = colors.onSurfaceVariant, fontSize = 12.sp, fontWeight = FontWeight.Medium, modifier = Modifier.padding(start = 8.dp, top = 18.dp, bottom = 4.dp))
            Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState())) {
                history.take(30).forEach { item ->
                    Text(
                        item,
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).clickable { onSelectHistory(item) }
                            .padding(horizontal = 9.dp, vertical = 10.dp),
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        fontSize = 14.sp
                    )
                }
                if (history.isEmpty()) {
                    Text("Your prompts will appear here.", Modifier.padding(horizontal = 9.dp, vertical = 10.dp), color = colors.onSurfaceVariant, fontSize = 13.sp)
                }
            }
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(colors.surfaceVariant)
                    .clickable(onClick = onSettings).padding(horizontal = 12.dp, vertical = 11.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(Icons.Default.Settings, null, tint = colors.onSurfaceVariant, modifier = Modifier.size(18.dp))
                Text("Settings", Modifier.padding(start = 10.dp), fontSize = 14.sp)
            }
        }
    }
}

@Composable
@OptIn(ExperimentalLayoutApi::class)
private fun HomeWelcome(
    panels: List<PanelDefinition>,
    onOpenPicker: () -> Unit,
    onSuggestion: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = MaterialTheme.colorScheme
    Column(modifier.padding(horizontal = 20.dp, vertical = 24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        androidx.compose.foundation.Image(painterResource(R.drawable.ott_logo), contentDescription = "OTT24x7 AI logo", modifier = Modifier.size(48.dp).clip(RoundedCornerShape(14.dp)), contentScale = ContentScale.Crop)
        Text("Good evening", Modifier.padding(top = 20.dp), fontWeight = FontWeight.SemiBold, fontSize = 24.sp, textAlign = TextAlign.Center, lineHeight = 30.sp)
        Text("Ask all your AIs at once", Modifier.padding(top = 4.dp), color = colors.onSurfaceVariant, fontSize = 14.sp, textAlign = TextAlign.Center)
        Spacer(Modifier.height(20.dp))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(8.dp), maxItemsInEachRow = 3) {
            panels.forEach { panel ->
                Surface(shape = CircleShape, color = colors.surface, border = BorderStroke(1.dp, colors.outline), modifier = Modifier.clickable(onClick = onOpenPicker)) {
                    Row(Modifier.padding(start = 4.dp, end = 11.dp, top = 4.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                        ModelAvatar(panel.name, Modifier.size(20.dp))
                        Text(panel.name, Modifier.padding(start = 6.dp), fontSize = 12.sp, maxLines = 1)
                    }
                }
            }
            Surface(shape = CircleShape, color = colors.surfaceVariant, modifier = Modifier.clickable(onClick = onOpenPicker)) {
                Text("+ Models", Modifier.padding(horizontal = 11.dp, vertical = 8.dp), color = colors.primary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }
        }
        Spacer(Modifier.height(24.dp))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("Plan a 3-day Goa trip", "Fix this Python error", "Write a LinkedIn post", "Explain RAG simply").forEach { suggestion ->
                Surface(
                    modifier = Modifier.clip(RoundedCornerShape(12.dp)).clickable { onSuggestion(suggestion) },
                    color = colors.background,
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, colors.outline)
                ) {
                    Text(suggestion, Modifier.padding(horizontal = 12.dp, vertical = 9.dp), color = colors.onSurfaceVariant, fontSize = 13.sp)
                }
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun AnswerTurn(
    panels: List<PanelDefinition>,
    currentPrompt: String,
    pastTurns: List<ChatTurnSummary>,
    answers: Map<String, PanelAnswer>,
    activity: MainActivity,
    googleSignInPanel: String?,
    onCopy: (PanelDefinition) -> Unit,
    onRegenerate: (PanelDefinition) -> Unit,
    onExpand: (PanelDefinition) -> Unit,
    onClearLogin: (PanelDefinition) -> Unit,
    onOpenGoogle: (PanelDefinition) -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = MaterialTheme.colorScheme
    BoxWithConstraints(modifier) {
        val availableWidth = maxWidth
        val cardHeight = (maxHeight - 148.dp).coerceIn(320.dp, 440.dp)
        val bodyHeight = (cardHeight - 112.dp).coerceAtLeast(230.dp)
        val pagerState = rememberPagerState(pageCount = { panels.size })
        val pagerScope = rememberCoroutineScope()
        val turnScroll = rememberScrollState()
        LaunchedEffect(currentPrompt, pastTurns.size) {
            withFrameNanos { }
            turnScroll.animateScrollTo(turnScroll.maxValue)
        }
        Column(Modifier.fillMaxSize().verticalScroll(turnScroll)) {
            pastTurns.forEach { previous ->
                Surface(
                    Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
                    color = colors.surfaceVariant,
                    shape = RoundedCornerShape(18.dp)
                ) {
                    Column(Modifier.padding(horizontal = 13.dp, vertical = 9.dp)) {
                        Text(previous.prompt, color = colors.onSurfaceVariant, fontSize = 12.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                        Text("${previous.modelCount} AIs · previous turn", color = colors.onSurfaceVariant.copy(alpha = 0.75f), fontSize = 10.sp, modifier = Modifier.padding(top = 3.dp))
                    }
                }
            }
            Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 10.dp, bottom = 12.dp), horizontalArrangement = Arrangement.End) {
                Surface(shape = RoundedCornerShape(19.dp), color = colors.primary) {
                    Text(currentPrompt, Modifier.widthIn(max = availableWidth * 0.78f).padding(horizontal = 14.dp, vertical = 10.dp), color = Color.White, fontSize = 14.sp, lineHeight = 20.sp)
                }
            }
            if (panels.isEmpty()) {
                Text("Choose one or more models to see responses.", Modifier.padding(20.dp), color = colors.onSurfaceVariant)
            } else if (availableWidth >= 680.dp) {
                Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    panels.chunked(2).forEach { pair ->
                        Row(Modifier.fillMaxWidth().height(cardHeight), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            pair.forEach { panel ->
                                PanelCard(
                                    activity, panel, answers[panel.id] ?: PanelAnswer(), bodyHeight, false,
                                    onCopy = { onCopy(panel) }, onRegenerate = { onRegenerate(panel) }, onExpand = { onExpand(panel) },
                                    onClearLogin = { onClearLogin(panel) }, onOpenGoogleCustomTab = { onOpenGoogle(panel) },
                                    googleSignInRequired = googleSignInPanel == panel.id,
                                    modifier = Modifier.weight(1f).fillMaxHeight()
                                )
                            }
                            if (pair.size == 1) Spacer(Modifier.weight(1f))
                        }
                    }
                }
                if (panels.size > 2) Text("${panels.size} models", Modifier.align(Alignment.CenterHorizontally).padding(vertical = 6.dp), color = colors.onSurfaceVariant, fontSize = 11.sp)
            } else {
                val cardWidth = (availableWidth * 0.84f).coerceAtLeast(280.dp)
                HorizontalPager(
                    state = pagerState,
                    modifier = Modifier.fillMaxWidth().height(cardHeight),
                    pageSize = PageSize.Fixed(cardWidth),
                    contentPadding = PaddingValues(horizontal = 16.dp),
                    pageSpacing = 12.dp,
                    key = { panels[it].id }
                ) { index ->
                    val panel = panels[index]
                    PanelCard(
                        activity, panel, answers[panel.id] ?: PanelAnswer(), bodyHeight, false,
                        onCopy = { onCopy(panel) }, onRegenerate = { onRegenerate(panel) }, onExpand = { onExpand(panel) },
                        onClearLogin = { onClearLogin(panel) }, onOpenGoogleCustomTab = { onOpenGoogle(panel) },
                        googleSignInRequired = googleSignInPanel == panel.id,
                        modifier = Modifier.fillMaxSize()
                    )
                }
                Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                    Text("${pagerState.currentPage + 1}/${panels.size}", color = colors.onSurfaceVariant, fontSize = 12.sp)
                    Spacer(Modifier.width(9.dp))
                    repeat(panels.size) { index ->
                        Box(
                            Modifier.padding(horizontal = 2.dp).size(width = if (pagerState.currentPage == index) 16.dp else 6.dp, height = 6.dp)
                                .clip(CircleShape)
                                .background(if (pagerState.currentPage == index) colors.primary else colors.outline)
                                .clickable { pagerScope.launch { pagerState.animateScrollToPage(index) } }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun PromptComposer(
    prompt: String,
    onPromptChange: (String) -> Unit,
    selectedPanels: List<PanelDefinition>,
    attachment: ApiAttachment?,
    onAttach: () -> Unit,
    onRemoveAttachment: () -> Unit,
    onMic: () -> Unit,
    onOpenPicker: () -> Unit,
    onSend: () -> Unit
) {
    val colors = MaterialTheme.colorScheme
    Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp).clip(RoundedCornerShape(24.dp)).background(colors.surface).border(1.dp, colors.outline, RoundedCornerShape(24.dp)), horizontalAlignment = Alignment.CenterHorizontally) {
        androidx.compose.foundation.layout.Box(Modifier.fillMaxWidth().padding(2.dp).clip(RoundedCornerShape(22.dp)).background(colors.surface).padding(horizontal = 8.dp, vertical = 5.dp)) {
            Column {
                if (attachment != null) {
                    Surface(color = colors.surfaceVariant, shape = CircleShape, modifier = Modifier.padding(start = 5.dp, bottom = 5.dp)) {
                        Row(Modifier.padding(start = 9.dp, end = 5.dp, top = 4.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text(attachment.name, maxLines = 1, overflow = TextOverflow.Ellipsis, fontSize = 11.sp, modifier = Modifier.widthIn(max = 185.dp))
                            IconButton(onClick = onRemoveAttachment, modifier = Modifier.size(24.dp)) { Icon(Icons.Default.Close, "Remove attachment", modifier = Modifier.size(14.dp)) }
                        }
                    }
                }
                BasicTextField(
                    value = prompt,
                    onValueChange = onPromptChange,
                    modifier = Modifier.fillMaxWidth().heightIn(min = 42.dp, max = 96.dp).padding(horizontal = 8.dp, vertical = 4.dp),
                    textStyle = TextStyle(color = colors.onSurface, fontSize = 15.sp, lineHeight = 21.sp),
                    cursorBrush = Brush.verticalGradient(listOf(colors.primary, colors.primary)),
                    decorationBox = { inner ->
                        Box {
                            if (prompt.isBlank()) Text("Ask all your AIs…", color = colors.onSurfaceVariant, fontSize = 15.sp)
                            inner()
                        }
                    }
                )
                Row(Modifier.fillMaxWidth().padding(top = 1.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    Surface(
                        modifier = Modifier.size(36.dp).clip(CircleShape).clickable(onClick = onAttach),
                        shape = CircleShape,
                        color = colors.surface,
                        border = BorderStroke(1.dp, colors.outline)
                    ) { Box(contentAlignment = Alignment.Center) { Icon(Icons.Default.AttachFile, "Attach an image or PDF", tint = colors.onSurfaceVariant, modifier = Modifier.size(18.dp)) } }
                    Surface(
                        modifier = Modifier.clip(CircleShape).clickable(onClick = onOpenPicker),
                        color = colors.surface,
                        shape = CircleShape,
                        border = BorderStroke(1.dp, colors.outline)
                    ) {
                        Row(Modifier.padding(horizontal = 10.dp, vertical = 7.dp), verticalAlignment = Alignment.CenterVertically) {
                            Row(horizontalArrangement = Arrangement.spacedBy((-4).dp)) {
                                selectedPanels.take(3).forEach { panel -> ModelAvatar(panel.name, Modifier.size(16.dp)) }
                            }
                            Text("${selectedPanels.size} AIs", Modifier.padding(start = 6.dp), fontSize = 12.sp, fontWeight = FontWeight.Medium, maxLines = 1)
                            Icon(Icons.Default.ArrowDropDown, null, tint = colors.onSurfaceVariant, modifier = Modifier.size(16.dp))
                        }
                    }
                    Spacer(Modifier.weight(1f))
                    IconButton(onClick = onMic, modifier = Modifier.size(36.dp)) { Icon(Icons.Default.Mic, "Speak", tint = colors.onSurfaceVariant, modifier = Modifier.size(19.dp)) }
                    IconButton(onClick = onSend, enabled = prompt.isNotBlank(), modifier = Modifier.size(36.dp).clip(CircleShape).background(if (prompt.isBlank()) colors.surfaceVariant else colors.primary)) {
                        Icon(Icons.Default.ArrowUpward, "Send prompt", tint = if (prompt.isBlank()) colors.onSurfaceVariant else Color.White, modifier = Modifier.size(18.dp))
                    }
                }
            }
        }
    }
}

private fun readAttachment(context: Context, uri: Uri): ApiAttachment {
    val mime = context.contentResolver.getType(uri) ?: "application/octet-stream"
    require(mime.startsWith("image/") || mime == "application/pdf")
    val name = runCatching {
        context.contentResolver.query(uri, arrayOf(android.provider.OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) cursor.getString(0) else null
        }
    }.getOrNull() ?: "attachment.${if (mime == "application/pdf") "pdf" else "image"}"
    val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: throw FileNotFoundException()
    require(bytes.size <= 15 * 1024 * 1024) { "File is too large" }
    return ApiAttachment(name, mime, bytes)
}

@Preview(name = "Home · dark", showBackground = true, widthDp = 393, heightDp = 852)
@Composable
fun HomeDarkPreview() {
    FiestaTheme(true) {
        Column(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
            TopBar("My subscriptions", false, {}, {}, {}, {}, {}, false, {})
            HomeWelcome(PanelCatalog.webPanels.take(4), {}, {}, Modifier.weight(1f))
            PromptComposer("", {}, PanelCatalog.webPanels.take(4), null, {}, {}, {}, {}, {})
        }
    }
}

@Preview(name = "Answers · dark", showBackground = true, widthDp = 393, heightDp = 852)
@Composable
fun AnswersDarkPreview() {
    FiestaTheme(true) {
        Column(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
            TopBar("My subscriptions", false, {}, {}, {}, {}, {}, false, {})
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.End) {
                Text("How will AI change mobile apps?", Modifier.clip(RoundedCornerShape(19.dp)).background(FiestaAccent).padding(horizontal = 13.dp, vertical = 10.dp), color = Color.White, fontSize = 14.sp)
            }
            Row(Modifier.fillMaxWidth().height(440.dp).horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                PreviewAnswerCard("ChatGPT", "Sent ✓", "AI is likely to make mobile apps more personal and capable.\n\n**Three shifts to watch:**\n• Natural conversation\n• On-device assistance\n• Adaptive interfaces", Modifier.width(330.dp).padding(start = 16.dp, bottom = 2.dp))
                PreviewAnswerCard("Claude", "typing…", "A useful way to think about the shift is that apps become collaborators.\n\nThey can adapt to a person’s goals while keeping the person in control.", Modifier.width(330.dp).padding(end = 16.dp, bottom = 2.dp))
            }
            PageIndicatorPreview()
            Spacer(Modifier.weight(1f))
            PromptComposer("Ask a follow-up…", {}, PanelCatalog.webPanels.take(4), null, {}, {}, {}, {}, {})
        }
    }
}

@Preview(name = "Answers · light", showBackground = true, widthDp = 393, heightDp = 852)
@Composable
fun AnswersLightPreview() {
    FiestaTheme(false) {
        Column(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
            TopBar("My subscriptions", false, {}, {}, {}, {}, {}, false, {})
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.End) {
                Text("How will AI change mobile apps?", Modifier.clip(RoundedCornerShape(19.dp)).background(FiestaAccent).padding(horizontal = 13.dp, vertical = 10.dp), color = Color.White, fontSize = 14.sp)
            }
            Row(Modifier.fillMaxWidth().height(440.dp).horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                PreviewAnswerCard("ChatGPT", "Sent ✓", "AI is likely to make mobile apps more personal and capable.\n\n**Three shifts to watch:**\n• Natural conversation\n• On-device assistance\n• Adaptive interfaces", Modifier.width(330.dp).padding(start = 16.dp, bottom = 2.dp))
                PreviewAnswerCard("Claude", "typing…", "A useful way to think about the shift is that apps become collaborators.\n\nThey can adapt to a person’s goals while keeping the person in control.", Modifier.width(330.dp).padding(end = 16.dp, bottom = 2.dp))
            }
            PageIndicatorPreview()
            Spacer(Modifier.weight(1f))
            PromptComposer("Ask a follow-up…", {}, PanelCatalog.webPanels.take(4), null, {}, {}, {}, {}, {})
        }
    }
}

@Preview(name = "Model picker", showBackground = true, widthDp = 393, heightDp = 852)
@Composable
fun PickerPreview() {
    FiestaTheme(true) {
        Column(Modifier.fillMaxSize().background(FiestaDarkBackground)) {
            Text("OTT24x7 AI", Modifier.padding(20.dp), color = FiestaMuted)
            Spacer(Modifier.weight(1f))
            Column(Modifier.fillMaxWidth().weight(4f).clip(RoundedCornerShape(topStart = 26.dp, topEnd = 26.dp)).background(MaterialTheme.colorScheme.surface).padding(horizontal = 16.dp, vertical = 14.dp)) {
                Box(Modifier.width(40.dp).height(4.dp).align(Alignment.CenterHorizontally).clip(CircleShape).background(FiestaMuted.copy(alpha = 0.5f)))
                Row(Modifier.fillMaxWidth().padding(top = 12.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Choose AIs", fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                        Text("4 selected · Max 8", color = FiestaMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 3.dp))
                    }
                    Button(onClick = {}, shape = RoundedCornerShape(18.dp)) { Text("Done", fontSize = 13.sp) }
                }
                Text("My subscriptions (Web)", color = FiestaMuted, fontSize = 11.sp, modifier = Modifier.padding(top = 8.dp, bottom = 3.dp))
                PanelCatalog.webPanels.take(4).forEach { PreviewModelRow(it.name, true) }
                Text("Signed-in", color = FiestaMuted, fontSize = 11.sp, modifier = Modifier.padding(top = 5.dp))
                PanelCatalog.webPanels.drop(4).take(1).forEach { PreviewModelRow(it.name, false) }
                Text("API models", color = FiestaMuted, fontSize = 11.sp, modifier = Modifier.padding(top = 5.dp))
                PreviewModelRow("OpenRouter · GPT-4o", false, "OpenAI-compatible · API")
            }
        }
    }
}

@Preview(name = "Final answer sheet", showBackground = true, widthDp = 393, heightDp = 700)
@Composable
fun FinalPreview() {
    FiestaTheme(true) {
        Column(Modifier.fillMaxSize().background(FiestaDarkBackground)) {
            Spacer(Modifier.weight(1f))
            Column(Modifier.fillMaxWidth().weight(3f).clip(RoundedCornerShape(topStart = 26.dp, topEnd = 26.dp)).background(MaterialTheme.colorScheme.surface).padding(20.dp)) {
                Box(Modifier.width(40.dp).height(4.dp).align(Alignment.CenterHorizontally).clip(CircleShape).background(FiestaMuted.copy(alpha = 0.5f)))
                Row(Modifier.fillMaxWidth().padding(top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) { Text("Final answer · Claude", fontSize = 16.sp, fontWeight = FontWeight.SemiBold); Text("Combined from your selected models", color = FiestaMuted, fontSize = 12.sp) }
                    Text("Copy", color = FiestaAccent, fontSize = 12.sp); Spacer(Modifier.width(8.dp)); Text("Re-run", color = FiestaAccent, fontSize = 12.sp)
                    IconButton(onClick = {}, modifier = Modifier.size(28.dp)) { Icon(Icons.Default.Close, "Close", tint = FiestaMuted, modifier = Modifier.size(16.dp)) }
                }
                Spacer(Modifier.height(15.dp))
                MarkdownText("# A clearer mobile future\n\nAI will make apps more **personal**, more conversational, and better at helping people finish tasks. The best experiences will keep users in control and show how each answer was formed.", Modifier.fillMaxWidth())
            }
        }
    }
}

@Composable
private fun PageIndicatorPreview() {
    Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
        Text("1/4", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
        Spacer(Modifier.width(9.dp))
        repeat(4) { index ->
            Box(Modifier.padding(horizontal = 2.dp).size(width = if (index == 0) 16.dp else 6.dp, height = 6.dp).clip(CircleShape).background(if (index == 0) FiestaAccent else MaterialTheme.colorScheme.outline))
        }
    }
}

@Composable
private fun PreviewAnswerCard(title: String, status: String, answer: String, modifier: Modifier = Modifier) {
    Card(modifier, shape = RoundedCornerShape(20.dp), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxSize()) {
            Row(Modifier.fillMaxWidth().padding(start = 12.dp, end = 10.dp, top = 10.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                ModelAvatar(title, Modifier.size(24.dp)); Text(title, Modifier.padding(start = 8.dp), fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                Surface(Modifier.padding(start = 6.dp), color = MaterialTheme.colorScheme.surfaceVariant, shape = RoundedCornerShape(6.dp), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline)) {
                    Text("WEB", Modifier.padding(horizontal = 5.dp, vertical = 2.dp), color = FiestaMuted, fontSize = 9.sp)
                }
                Spacer(Modifier.weight(1f))
                Text(status, color = if (status.startsWith("Sent")) Color(0xFF53C991) else FiestaMuted, fontSize = 10.sp)
            }
            MarkdownText(answer, Modifier.weight(1f).padding(horizontal = 14.dp))
            Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp), horizontalArrangement = Arrangement.End) { Text("Copy    ↻    Expand", color = FiestaMuted, fontSize = 11.sp) }
        }
    }
}

@Preview(name = "History drawer", showBackground = true, widthDp = 393, heightDp = 852)
@Composable
fun HistoryPreview() {
    FiestaTheme(true) {
        ModalNavigationDrawer(
            drawerState = rememberDrawerState(initialValue = DrawerValue.Open),
            drawerContent = {
                HistoryDrawerContent(
                    history = listOf("How will AI change mobile apps?", "Plan a weekend in Kyoto", "Compare these project ideas"),
                    onSelectHistory = {},
                    onSettings = {}
                )
            }
        ) { Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) }
    }
}

@Preview(name = "Settings", showBackground = true, widthDp = 393, heightDp = 852)
@Composable
fun SettingsPreview() {
    FiestaTheme(true) {
        val colors = MaterialTheme.colorScheme
        Box(Modifier.fillMaxSize().background(colors.background)) {
            Column(
                Modifier.fillMaxWidth().fillMaxHeight(0.94f).align(Alignment.BottomCenter)
                    .clip(RoundedCornerShape(topStart = 26.dp, topEnd = 26.dp)).background(colors.surface)
                    .verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 24.dp)
            ) {
                Box(Modifier.padding(top = 12.dp).width(40.dp).height(4.dp).align(Alignment.CenterHorizontally).clip(CircleShape).background(colors.outline))
                Row(Modifier.fillMaxWidth().padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = {}, modifier = Modifier.size(36.dp)) { Icon(Icons.Default.ArrowBack, "Back", tint = colors.onSurface, modifier = Modifier.size(20.dp)) }
                    Text("Settings", fontSize = 20.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(start = 3.dp))
                }
                SettingsSection("Appearance") {
                    SettingsRow("Theme") {
                        Row(Modifier.clip(RoundedCornerShape(10.dp)).background(colors.background).padding(2.dp)) {
                            listOf("Dark", "Light", "System").forEachIndexed { index, value ->
                                Surface(shape = RoundedCornerShape(8.dp), color = if (index == 0) colors.surfaceVariant else Color.Transparent) {
                                    Text(value, Modifier.padding(horizontal = 8.dp, vertical = 7.dp), fontSize = 10.sp, color = if (index == 0) colors.onSurface else colors.onSurfaceVariant)
                                }
                            }
                        }
                    }
                }
                SettingsSection("Panels") {
                    SettingsRow("Read web panel answers", "Let Combine read replies when you tap it.") {
                        Box(Modifier.size(width = 36.dp, height = 20.dp).clip(CircleShape).background(FiestaAccent), contentAlignment = Alignment.CenterEnd) {
                            Box(Modifier.padding(horizontal = 2.dp).size(16.dp).clip(CircleShape).background(Color.White))
                        }
                    }
                }
                SettingsSection("Custom endpoints") {
                    Column(Modifier.fillMaxWidth().padding(12.dp)) {
                        Text("OpenAI-compatible · /v1/chat/completions", color = colors.onSurfaceVariant, fontSize = 12.sp, modifier = Modifier.padding(bottom = 7.dp))
                        listOf("Name" to "My OpenRouter", "Base URL" to "https://openrouter.ai/api/v1", "API key" to "Paste an API key", "Model ID" to "Model name").forEach { (label, value) ->
                            SettingsFieldPreview(label, value)
                        }
                        Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Surface(Modifier.weight(1f), shape = RoundedCornerShape(12.dp), color = colors.surface, border = BorderStroke(1.dp, colors.outline)) {
                                Text("Test", Modifier.padding(vertical = 10.dp), textAlign = TextAlign.Center, color = colors.onSurface, fontSize = 13.sp)
                            }
                            Surface(Modifier.weight(1f), shape = RoundedCornerShape(12.dp), color = FiestaAccent) {
                                Text("＋  Add model", Modifier.padding(vertical = 10.dp), textAlign = TextAlign.Center, color = Color.White, fontSize = 13.sp)
                            }
                        }
                    }
                }
                SettingsSection("Panel logins") {
                    PanelCatalog.webPanels.take(3).forEach { panel -> SettingsRow(panel.name) { Text("Clear login", color = FiestaAccent, fontSize = 12.sp) } }
                }
            }
        }
    }
}

@Composable
private fun SettingsFieldPreview(label: String, value: String) {
    val colors = MaterialTheme.colorScheme
    Column(Modifier.fillMaxWidth().padding(top = 6.dp)) {
        Text(label, color = colors.onSurfaceVariant, fontSize = 11.sp, modifier = Modifier.padding(start = 3.dp, bottom = 4.dp))
        Surface(shape = RoundedCornerShape(11.dp), color = colors.background, border = BorderStroke(1.dp, colors.outline)) {
            Text(value, Modifier.fillMaxWidth().padding(horizontal = 11.dp, vertical = 10.dp), fontSize = 13.sp, color = if (label == "API key") colors.onSurfaceVariant else colors.onSurface)
        }
    }
}

@Composable
private fun PreviewModelRow(name: String, selected: Boolean, description: String = "$name · Web") {
    Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 7.dp), verticalAlignment = Alignment.CenterVertically) {
        ModelAvatar(name, Modifier.size(32.dp)); Column(Modifier.weight(1f).padding(start = 10.dp)) { Text(name, fontSize = 14.sp); Text(description, color = FiestaMuted, fontSize = 11.sp) }
        Box(Modifier.size(width = 36.dp, height = 20.dp).clip(CircleShape).background(if (selected) FiestaAccent else MaterialTheme.colorScheme.outline), contentAlignment = if (selected) Alignment.CenterEnd else Alignment.CenterStart) {
            Box(Modifier.padding(horizontal = 2.dp).size(16.dp).clip(CircleShape).background(Color.White))
        }
    }
}
