package com.ott24x7.ai.ui

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.itemsIndexed
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Book
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Code
import androidx.compose.material.icons.filled.CompareArrows
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Flight
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Palette
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Divider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import com.ott24x7.ai.R
import com.ott24x7.ai.MainActivity
import com.ott24x7.ai.data.ApiClient
import com.ott24x7.ai.data.ApiEndpoint
import com.ott24x7.ai.data.ExaSource
import com.ott24x7.ai.data.GeneratedImage
import com.ott24x7.ai.data.HistoryGroup
import com.ott24x7.ai.data.HistoryGrouping
import com.ott24x7.ai.data.HistoryTurn
import com.ott24x7.ai.data.PanelDefinition
import com.ott24x7.ai.data.PanelKind
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.net.URL
import java.util.Base64

enum class MainTab { HOME, COMPARE, STUDIO, GUIDE, SETTINGS, HISTORY }

@Composable
fun AppBottomBar(selected: MainTab, onSelect: (MainTab) -> Unit) {
    val tabs = listOf(
        Triple(MainTab.HOME, R.string.nav_home, Icons.Default.Home),
        Triple(MainTab.COMPARE, R.string.nav_compare, Icons.Default.CompareArrows),
        Triple(MainTab.STUDIO, R.string.nav_studio, Icons.Default.AutoAwesome),
        Triple(MainTab.GUIDE, R.string.nav_guide, Icons.Default.Book),
        Triple(MainTab.SETTINGS, R.string.nav_settings, Icons.Default.Settings)
    )
    NavigationBar(modifier = Modifier.navigationBarsPadding(), containerColor = MaterialTheme.colorScheme.surface) {
        tabs.forEach { (tab, label, icon) ->
            NavigationBarItem(
                selected = selected == tab,
                onClick = { onSelect(tab) },
                icon = { Icon(icon, contentDescription = null) },
                label = { Text(stringResource(label), fontSize = 10.sp, maxLines = 1) },
                alwaysShowLabel = true
            )
        }
    }
}

@Composable
fun ComparePreviewV2() {
    Column(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).padding(top = 14.dp)) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Debounce search", Modifier.weight(1f), fontSize = 19.sp, fontWeight = FontWeight.SemiBold)
            Text("Cards", Modifier.clip(CircleShape).background(MaterialTheme.colorScheme.surfaceVariant).clickable {}.padding(horizontal = 10.dp, vertical = 7.dp), fontSize = 11.sp, color = MaterialTheme.colorScheme.primary)
            Text("Stack", Modifier.clickable {}.padding(horizontal = 10.dp, vertical = 7.dp), fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Row(Modifier.fillMaxWidth().padding(top = 14.dp, bottom = 11.dp), horizontalArrangement = Arrangement.End) {
            Surface(color = MaterialTheme.colorScheme.primary, shape = RoundedCornerShape(18.dp)) { Text("How do I debounce a search input in React?", Modifier.padding(11.dp), color = Color.White, fontSize = 12.sp) }
        }
        Row(Modifier.fillMaxSize().horizontalScroll(rememberScrollState()).padding(horizontal = 10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            PreviewAnswerCard("ChatGPT", "Sent ✓", "**A simple hook works well:**\n\n```ts\nuseDebounce(value, 300)\n```\n\n- Cancel old timeouts on cleanup.\n- Keep the input responsive.", Modifier.width(310.dp).height(550.dp))
            PreviewAnswerCard("Claude", "typing…", "A 300ms delay is a useful starting point.\n\n| Delay | Feel |\n| --- | --- |\n| 150ms | Fast |\n| 300ms | Balanced |", Modifier.width(310.dp).height(550.dp))
        }
    }
}

@Composable
fun FinalAnswerPreviewV2() {
    val colors = MaterialTheme.colorScheme
    Column(Modifier.fillMaxSize().background(colors.background)) {
        Spacer(Modifier.weight(1f))
        Column(Modifier.fillMaxWidth().weight(4f).clip(RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp)).background(colors.surface).padding(16.dp)) {
            Box(Modifier.align(Alignment.CenterHorizontally).width(40.dp).height(5.dp).clip(CircleShape).background(colors.outline))
            Row(Modifier.fillMaxWidth().padding(top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) { Text("Final answer", fontWeight = FontWeight.SemiBold); Text("Judge: Claude Haiku · from 3 answers", color = colors.onSurfaceVariant, fontSize = 11.sp) }
                Text("Judge⌄   Copy   Share", color = colors.primary, fontSize = 10.sp)
            }
            listOf("Best answer" to "Use a **300ms** debounce and cancel stale requests with `AbortController`.", "Where they agree" to "• Clear the timeout on cleanup\n• Debounce the value", "Where they differ" to "Some prefer a small hook; others use lodash.debounce.").forEach { (title, body) ->
                Card(Modifier.fillMaxWidth().padding(top = 9.dp), shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = colors.surfaceVariant)) {
                    Column(Modifier.padding(11.dp)) { Text(title.uppercase(), color = colors.primary, fontSize = 10.sp, fontWeight = FontWeight.SemiBold); MarkdownText(body, Modifier.padding(top = 5.dp)) }
                }
            }
        }
    }
}

@Composable
fun WebSearchPreviewV2() {
    val colors = MaterialTheme.colorScheme
    Column(Modifier.fillMaxSize().background(colors.background).padding(16.dp)) {
        Text("Phone cameras 2026", fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
        Text("Searched the web · 5 sources", Modifier.padding(top = 10.dp), color = colors.onSurfaceVariant, fontSize = 11.sp)
        Card(Modifier.fillMaxWidth().padding(top = 10.dp), colors = CardDefaults.cardColors(containerColor = colors.surface), shape = RoundedCornerShape(22.dp)) {
            Column(Modifier.padding(14.dp)) {
                Text("Claude · API", fontWeight = FontWeight.SemiBold)
                MarkdownText("Reviewers give the **Pixel 11** an edge in low light [1], while the iPhone wins on video [2].", Modifier.padding(top = 9.dp))
                Divider(Modifier.padding(vertical = 9.dp))
                Text("Sources (2)", fontWeight = FontWeight.Medium, fontSize = 12.sp)
                listOf("[1] theverge.com", "[2] dxomark.com").forEach { Text(it, Modifier.padding(top = 8.dp), color = colors.primary, fontSize = 12.sp) }
            }
        }
    }
}

@Composable
fun ModelPickerPreviewV2() {
    val colors = MaterialTheme.colorScheme
    Column(Modifier.fillMaxSize().background(colors.background).padding(16.dp)) {
        Spacer(Modifier.weight(1f))
        Column(Modifier.fillMaxWidth().weight(4f).clip(RoundedCornerShape(topStart = 26.dp, topEnd = 26.dp)).background(colors.surface).padding(14.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) { Column(Modifier.weight(1f)) { Text("Choose AIs", fontWeight = FontWeight.SemiBold, fontSize = 18.sp); Text("4 selected · Max 8", color = colors.onSurfaceVariant, fontSize = 11.sp) }; Button(onClick = {}) { Text("Done") } }
            Text("Web (your logins)", Modifier.padding(top = 13.dp, bottom = 5.dp), color = colors.onSurfaceVariant, fontSize = 11.sp)
            listOf("ChatGPT", "Claude", "Gemini", "DeepSeek").forEach { name -> Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) { ModelAvatar(name, Modifier.size(31.dp)); Text(name, Modifier.weight(1f).padding(start = 10.dp), fontSize = 13.sp); Text("↑  ↓", color = colors.onSurfaceVariant, fontSize = 11.sp); Switch(true, {}) } }
            Divider(Modifier.padding(vertical = 5.dp))
            Text("API models", color = colors.onSurfaceVariant, fontSize = 11.sp)
            Row(Modifier.fillMaxWidth().padding(top = 9.dp), verticalAlignment = Alignment.CenterVertically) { ModelAvatar("OpenRouter", Modifier.size(31.dp)); Text("OpenRouter · GPT-4o", Modifier.padding(start = 10.dp), fontSize = 13.sp); Spacer(Modifier.weight(1f)); Switch(false, {}) }
        }
    }
}

@Composable
fun HomeDashboard(
    panels: List<PanelDefinition>,
    recent: List<String>,
    onOpenPicker: () -> Unit,
    onSuggestion: (String) -> Unit,
    onRecent: (String) -> Unit,
    onHistory: () -> Unit
) {
    val colors = MaterialTheme.colorScheme
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp)) {
        Text(stringResource(R.string.home_greeting), color = colors.onSurfaceVariant, fontSize = 13.sp, modifier = Modifier.padding(top = 12.dp))
        Text(stringResource(R.string.home_title), fontSize = 27.sp, lineHeight = 32.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 3.dp, bottom = 13.dp))
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            panels.forEach { panel ->
                Surface(onClick = onOpenPicker, shape = CircleShape, color = colors.surface, border = androidx.compose.foundation.BorderStroke(1.dp, colors.outline)) {
                    Row(Modifier.padding(horizontal = 11.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                        ModelAvatar(panel.name, Modifier.size(19.dp))
                        Text(panel.name, Modifier.padding(start = 6.dp), fontSize = 12.sp, maxLines = 1)
                        Box(Modifier.padding(start = 6.dp).size(6.dp).clip(CircleShape).background(if (panel.kind == PanelKind.API) Color(0xFF53C991) else Color(0xFFE5A94F)))
                    }
                }
            }
        }
        Row(Modifier.fillMaxWidth().padding(top = 14.dp), horizontalArrangement = Arrangement.spacedBy(11.dp)) {
            QuickPromptCard(R.string.quick_plan_trip, R.string.quick_trip_sub, Icons.Default.Flight, Modifier.weight(1f)) { onSuggestion("Plan a 3-day trip to Goa") }
            QuickPromptCard(R.string.quick_fix_code, R.string.quick_code_sub, Icons.Default.Code, Modifier.weight(1f)) { onSuggestion("Help me fix this code: ") }
        }
        Row(Modifier.fillMaxWidth().padding(top = 11.dp), horizontalArrangement = Arrangement.spacedBy(11.dp)) {
            QuickPromptCard(R.string.quick_write_post, R.string.quick_post_sub, Icons.Default.AutoAwesome, Modifier.weight(1f)) { onSuggestion("Write a LinkedIn post about ") }
            QuickPromptCard(R.string.quick_explain, R.string.quick_explain_sub, Icons.Default.Lightbulb, Modifier.weight(1f)) { onSuggestion("Explain this simply: ") }
        }
        Row(Modifier.fillMaxWidth().padding(top = 20.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(stringResource(R.string.recent_title), Modifier.weight(1f), fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
            TextButton(onClick = onHistory) { Text(stringResource(R.string.see_all), fontSize = 12.sp) }
        }
        Card(shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = colors.surface)) {
            if (recent.isEmpty()) {
                Text(stringResource(R.string.recent_empty), Modifier.padding(16.dp), color = colors.onSurfaceVariant, fontSize = 13.sp)
            } else recent.take(3).forEachIndexed { index, title ->
                Row(Modifier.fillMaxWidth().heightIn(min = 54.dp).clickable { onRecent(title) }.padding(horizontal = 14.dp, vertical = 9.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.SmartToy, null, tint = colors.onSurfaceVariant, modifier = Modifier.size(17.dp))
                    Text(title, Modifier.weight(1f).padding(horizontal = 10.dp), maxLines = 1, overflow = TextOverflow.Ellipsis, fontSize = 13.sp)
                    Text(listOf("2m", "1h", "Yday")[index], color = colors.onSurfaceVariant, fontSize = 10.sp)
                }
                if (index < recent.take(3).lastIndex) Divider(color = colors.outline.copy(alpha = 0.55f), modifier = Modifier.padding(start = 42.dp))
            }
        }
        Spacer(Modifier.height(16.dp))
    }
}

@Composable
private fun QuickPromptCard(title: Int, subtitle: Int, icon: androidx.compose.ui.graphics.vector.ImageVector, modifier: Modifier, onClick: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    Card(onClick = onClick, modifier = modifier.height(104.dp), shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = colors.surface), border = androidx.compose.foundation.BorderStroke(1.dp, colors.outline)) {
        Column(Modifier.fillMaxSize().padding(13.dp), verticalArrangement = Arrangement.SpaceBetween) {
            Box(Modifier.size(32.dp).clip(RoundedCornerShape(11.dp)).background(colors.primary.copy(alpha = 0.15f)), contentAlignment = Alignment.Center) { Icon(icon, null, tint = colors.primary, modifier = Modifier.size(17.dp)) }
            Column {
                Text(stringResource(title), fontSize = 13.sp, fontWeight = FontWeight.Medium)
                Text(stringResource(subtitle), fontSize = 10.sp, color = colors.onSurfaceVariant)
            }
        }
    }
}

@Composable
fun HistoryScreenV2(turns: List<HistoryTurn>, onDelete: (HistoryTurn) -> Unit, onOpen: (HistoryTurn) -> Unit) {
    val colors = MaterialTheme.colorScheme
    var query by remember { mutableStateOf("") }
    val groups = listOf(
        HistoryGroup.TODAY to R.string.today,
        HistoryGroup.YESTERDAY to R.string.yesterday,
        HistoryGroup.LAST_7_DAYS to R.string.last_7_days,
        HistoryGroup.OLDER to R.string.older
    )
    Column(Modifier.fillMaxSize()) {
        Text(stringResource(R.string.history_title), Modifier.padding(start = 18.dp, top = 18.dp, bottom = 12.dp), fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
        OutlinedTextField(query, { query = it }, Modifier.fillMaxWidth().padding(horizontal = 16.dp), singleLine = true, placeholder = { Text(stringResource(R.string.search_chats)) }, leadingIcon = { Icon(Icons.Default.Search, null) }, shape = RoundedCornerShape(18.dp))
        LazyColumn(Modifier.fillMaxSize().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            val filtered = turns.filter { it.prompt.contains(query, true) || it.answers.any { answer -> answer.text.contains(query, true) } }
            groups.forEach { (group, label) ->
                val items = filtered.filter { HistoryGrouping.group(it.timestamp, System.currentTimeMillis()) == group }
                if (items.isNotEmpty()) {
                    item { Text(stringResource(label), Modifier.padding(start = 2.dp, top = 15.dp, bottom = 3.dp), color = colors.onSurfaceVariant, fontSize = 12.sp, fontWeight = FontWeight.Medium) }
                    items(items, key = { "${it.timestamp}:${it.prompt}" }) { turn ->
                        var dragOffset by remember(turn.timestamp) { mutableFloatStateOf(0f) }
                        Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = colors.surface), border = androidx.compose.foundation.BorderStroke(1.dp, colors.outline)) {
                            Row(Modifier.fillMaxWidth().pointerInput(turn.timestamp) {
                                detectHorizontalDragGestures(onHorizontalDrag = { _, amount -> dragOffset = (dragOffset + amount).coerceIn(-110f, 0f) }, onDragEnd = { if (dragOffset < -75f) onDelete(turn); dragOffset = 0f })
                            }.clickable { onOpen(turn) }.padding(13.dp), verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f)) {
                                    Text(turn.prompt, maxLines = 1, overflow = TextOverflow.Ellipsis, fontSize = 14.sp)
                                    Text(stringResource(R.string.history_models, turn.answers.size, stringResource(if (turn.finalAnswer.isNotBlank()) R.string.history_final else R.string.history_compare)), Modifier.padding(top = 4.dp), color = colors.onSurfaceVariant, fontSize = 11.sp)
                                }
                                IconButton(onClick = { onDelete(turn) }) { Icon(Icons.Default.Delete, stringResource(R.string.delete), tint = colors.onSurfaceVariant) }
                            }
                        }
                    }
                }
            }
            if (filtered.isEmpty()) item { Text(stringResource(R.string.no_history), Modifier.padding(top = 36.dp).fillMaxWidth(), textAlign = androidx.compose.ui.text.style.TextAlign.Center, color = colors.onSurfaceVariant) }
            item { Spacer(Modifier.height(16.dp)) }
        }
    }
}

private data class GuideItem(val label: Int, val title: Int, val body: Int, val image: Int)

private val guideItems = listOf(
    GuideItem(R.string.guide_sign_in, R.string.guide_step_signin_title, R.string.guide_step_signin_body, R.drawable.guide_home),
    GuideItem(R.string.guide_first_prompt, R.string.guide_step_send_title, R.string.guide_step_send_body, R.drawable.guide_answers),
    GuideItem(R.string.guide_columns, R.string.guide_step_layout_title, R.string.guide_step_layout_body, R.drawable.guide_answers_light),
    GuideItem(R.string.guide_combine, R.string.guide_step_combine_title, R.string.guide_step_combine_body, R.drawable.guide_final),
    GuideItem(R.string.guide_judge, R.string.guide_step_judge_title, R.string.guide_step_judge_body, R.drawable.guide_picker),
    GuideItem(R.string.guide_web, R.string.guide_step_web_title, R.string.guide_step_web_body, R.drawable.guide_sources),
    GuideItem(R.string.guide_provider, R.string.guide_step_api_title, R.string.guide_step_api_body, R.drawable.guide_settings),
    GuideItem(R.string.guide_studio, R.string.guide_step_studio_title, R.string.guide_step_studio_body, R.drawable.guide_history)
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GuideScreenV2(done: List<Boolean>, onToggle: (Int) -> Unit, onMarkDone: (Int) -> Unit = onToggle) {
    val colors = MaterialTheme.colorScheme
    var open by remember { mutableIntStateOf(-1) }
    val progress = done.count { it }.coerceAtMost(GuideChecklistSize)
    Column(Modifier.fillMaxSize()) {
        Text(stringResource(R.string.nav_guide), Modifier.padding(start = 18.dp, top = 18.dp, bottom = 12.dp), fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
        Card(Modifier.fillMaxWidth().padding(horizontal = 16.dp), shape = RoundedCornerShape(24.dp), colors = CardDefaults.cardColors(containerColor = colors.surface)) {
            Row(Modifier.padding(17.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(72.dp), contentAlignment = Alignment.Center) {
                    Canvas(Modifier.fillMaxSize()) {
                        drawArc(colors.outline, -90f, 360f, false, style = androidx.compose.ui.graphics.drawscope.Stroke(8.dp.toPx()))
                        drawArc(colors.primary, -90f, 360f * progress / GuideChecklistSize, false, style = androidx.compose.ui.graphics.drawscope.Stroke(8.dp.toPx(), cap = androidx.compose.ui.graphics.StrokeCap.Round))
                    }
                    Text(stringResource(R.string.guide_progress_compact, progress), fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                }
                Column(Modifier.padding(start = 15.dp)) {
                    Text(stringResource(R.string.guide_progress, progress), fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                    Text(stringResource(R.string.guide_subtitle), Modifier.padding(top = 4.dp), color = colors.onSurfaceVariant, fontSize = 12.sp)
                }
            }
        }
        LazyColumn(Modifier.fillMaxSize().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(guideItems.size) { index ->
                Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = colors.surface), border = androidx.compose.foundation.BorderStroke(1.dp, colors.outline)) {
                    Row(Modifier.fillMaxWidth().padding(start = 12.dp, end = 7.dp, top = 8.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                        androidx.compose.material3.Checkbox(checked = done.getOrElse(index) { false }, onCheckedChange = { onToggle(index) })
                        Text(stringResource(guideItems[index].label), Modifier.weight(1f).padding(horizontal = 5.dp), fontSize = 12.sp, lineHeight = 16.sp)
                        TextButton(onClick = { open = index }) { Text(stringResource(R.string.show_me), fontSize = 11.sp) }
                    }
                }
            }
        }
    }
    if (open >= 0) {
        val step = guideItems[open]
        ModalBottomSheet(onDismissRequest = { open = -1 }, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = false)) {
            Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(bottom = 28.dp)) {
                Text(stringResource(step.title), fontSize = 19.sp, fontWeight = FontWeight.SemiBold)
                Text(stringResource(step.body), Modifier.padding(top = 6.dp), color = colors.onSurfaceVariant, fontSize = 13.sp, lineHeight = 19.sp)
                androidx.compose.foundation.Image(painterResource(step.image), null, Modifier.fillMaxWidth().padding(top = 15.dp).clip(RoundedCornerShape(18.dp)).height(170.dp), contentScale = androidx.compose.ui.layout.ContentScale.Crop)
                Button(onClick = { onMarkDone(open); open = -1 }, Modifier.fillMaxWidth().padding(top = 14.dp)) { Text(stringResource(R.string.mark_done)) }
            }
        }
    }
}

private const val GuideChecklistSize = 8

@Composable
fun SettingsScreenV2(
    panels: List<PanelDefinition>,
    selectedIds: List<String>,
    endpoints: List<ApiEndpoint>,
    themeMode: String,
    accentColor: Long,
    exaKey: String,
    webDefault: Boolean,
    judgeId: String?,
    testMessage: String,
    testing: Boolean,
    onPickModels: () -> Unit,
    onManageEndpoints: () -> Unit,
    onTheme: (String) -> Unit,
    onAccent: (Long) -> Unit,
    onExaKey: (String) -> Unit,
    onWebDefault: (Boolean) -> Unit,
    onTestExa: (String) -> Unit,
    onJudge: (String) -> Unit,
    onClearLogins: () -> Unit,
    onOpenUrl: (String) -> Unit
) {
    val colors = MaterialTheme.colorScheme
    var judgeMenu by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 12.dp)) {
        Text(stringResource(R.string.nav_settings), fontSize = 23.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(bottom = 12.dp))
        Card(shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = colors.surface)) {
            Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Check, null, tint = Color(0xFF53C991), modifier = Modifier.size(23.dp))
                Column(Modifier.padding(start = 10.dp)) { Text(stringResource(R.string.no_signup), fontWeight = FontWeight.Medium); Text(stringResource(R.string.local_logins), fontSize = 11.sp, color = colors.onSurfaceVariant) }
            }
        }
        SettingsGroup(stringResource(R.string.settings_ai)) {
            SettingsActionRow(stringResource(R.string.settings_ai), stringResource(R.string.selected_count, selectedIds.size), Icons.Default.SmartToy) { onPickModels() }
            Divider(color = colors.outline)
            SettingsActionRow(stringResource(R.string.settings_api), stringResource(R.string.endpoint_count, endpoints.size), Icons.Default.Tune) { onManageEndpoints() }
            Divider(color = colors.outline)
            Box {
                SettingsActionRow(stringResource(R.string.settings_judge), endpoints.firstOrNull { it.id == judgeId }?.name ?: stringResource(R.string.choose_api_model), Icons.Default.AutoAwesome) { judgeMenu = true }
                androidx.compose.material3.DropdownMenu(judgeMenu, { judgeMenu = false }) {
                    endpoints.forEach { endpoint -> androidx.compose.material3.DropdownMenuItem(text = { Text(endpoint.name) }, onClick = { onJudge(endpoint.id); judgeMenu = false }) }
                    if (endpoints.isEmpty()) androidx.compose.material3.DropdownMenuItem(text = { Text(stringResource(R.string.add_api_model)) }, onClick = { judgeMenu = false; onManageEndpoints() })
                }
            }
        }
        SettingsGroup(stringResource(R.string.settings_web)) {
            SettingsSwitchRow(stringResource(R.string.web_default), Icons.Default.Search, webDefault, onWebDefault)
            OutlinedTextField(exaKey, onExaKey, Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 7.dp), label = { Text(stringResource(R.string.exa_key)) }, placeholder = { Text(stringResource(R.string.exa_key_hint)) }, singleLine = true, visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password))
            if (testMessage.isNotBlank()) Text(testMessage, Modifier.padding(horizontal = 14.dp, vertical = 3.dp), color = if (testing) colors.onSurfaceVariant else colors.primary, fontSize = 11.sp)
            OutlinedButton(onClick = { onTestExa(exaKey) }, enabled = exaKey.isNotBlank() && !testing, modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 7.dp)) { Text(if (testing) stringResource(R.string.testing) else stringResource(R.string.test)) }
        }
        SettingsGroup(stringResource(R.string.appearance)) {
            Row(Modifier.fillMaxWidth().padding(8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf("dark" to R.string.dark, "light" to R.string.light, "system" to R.string.system).forEach { (value, label) ->
                    OutlinedButton(onClick = { onTheme(value) }, Modifier.weight(1f)) { Text(stringResource(label), fontSize = 11.sp, color = if (themeMode == value) colors.primary else colors.onSurface) }
                }
            }
            SettingsActionRow(stringResource(R.string.accent), "", Icons.Default.Palette) {}
            Row(Modifier.fillMaxWidth().padding(horizontal = 15.dp, vertical = 6.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                listOf(0xFF7C5CFF, 0xFFFF6B6B, 0xFF21A5A5, 0xFFFFA629, 0xFFDB4D9C).forEach { swatch ->
                    Box(Modifier.size(34.dp).clip(CircleShape).background(Color(swatch)).clickable { onAccent(swatch) }, contentAlignment = Alignment.Center) { if (accentColor == swatch) Icon(Icons.Default.Check, null, tint = Color.White, modifier = Modifier.size(18.dp)) }
                }
            }
        }
        SettingsGroup(stringResource(R.string.language)) {
            SettingsActionRow(stringResource(R.string.language), stringResource(R.string.english), Icons.Default.Book) {}
            Divider(color = colors.outline)
                    SettingsActionRow(stringResource(R.string.clear_logins), stringResource(R.string.clear), Icons.Default.Delete) { onClearLogins() }
            Divider(color = colors.outline)
            SettingsActionRow(stringResource(R.string.about), stringResource(R.string.app_version), Icons.Default.SmartToy) {}
            SettingsActionRow(stringResource(R.string.open_source), "GitHub", Icons.Default.Share) { onOpenUrl("https://github.com/ott24x7-oss/ott24x7-ai") }
        }
        Row(Modifier.fillMaxWidth().padding(top = 12.dp, bottom = 22.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            PromoCard("ott24x7.com", R.string.promo_streaming, Modifier.weight(1f)) { onOpenUrl("https://ott24x7.com") }
            PromoCard("keys24x7.com", R.string.promo_software, Modifier.weight(1f)) { onOpenUrl("https://keys24x7.com") }
        }
    }
}

@Composable
private fun SettingsGroup(title: String, content: @Composable () -> Unit) {
    Text(title.uppercase(), Modifier.padding(start = 7.dp, top = 17.dp, bottom = 6.dp), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp, letterSpacing = 0.7.sp)
    Card(shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) { Column { content() } }
}

@Composable
private fun SettingsActionRow(label: String, value: String, icon: androidx.compose.ui.graphics.vector.ImageVector, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().heightIn(min = 51.dp).clickable { onClick() }.padding(horizontal = 13.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
        Text(label, Modifier.weight(1f).padding(start = 11.dp), fontSize = 13.sp)
        Text(value, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
    }
}

@Composable
private fun SettingsSwitchRow(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().heightIn(min = 56.dp).clickable { onCheckedChange(!checked) }.padding(horizontal = 13.dp, vertical = 7.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
        Text(label, Modifier.weight(1f).padding(start = 11.dp), fontSize = 13.sp)
        Switch(checked, onCheckedChange)
    }
}

@Composable
private fun PromoCard(title: String, subtitle: Int, modifier: Modifier, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = modifier, shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
        Column(Modifier.padding(13.dp)) { Icon(Icons.Default.AutoAwesome, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(16.dp)); Text(title, Modifier.padding(top = 11.dp), fontSize = 13.sp, fontWeight = FontWeight.Medium); Text(stringResource(subtitle), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp) }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun OnboardingScreenV2(onDone: (List<String>) -> Unit) {
    var pickStep by remember { mutableStateOf(false) }
    val pager = rememberPagerState(pageCount = { 3 })
    val pagerScope = rememberCoroutineScope()
    var picked by remember { mutableStateOf(PanelDefinitionDefaults.toSet()) }
    val ids = listOf("chatgpt", "claude", "gemini", "deepseek")
    Column(Modifier.fillMaxSize().padding(horizontal = 24.dp, vertical = 14.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(stringResource(R.string.brand_name), Modifier.weight(1f), color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
            TextButton(onClick = { onDone(if (pickStep) picked.toList() else ids) }) { Text(stringResource(R.string.skip)) }
        }
        if (!pickStep) {
            HorizontalPager(state = pager, modifier = Modifier.weight(1f), userScrollEnabled = true) { page ->
                val title = when (page) { 0 -> R.string.onboard_page1_title; 1 -> R.string.onboard_page2_title; else -> R.string.onboard_page3_title }
                val body = when (page) { 0 -> R.string.onboard_page1_body; 1 -> R.string.onboard_page2_body; else -> R.string.onboard_page3_body }
                Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.Center) {
                    Box(Modifier.fillMaxWidth().height(250.dp).clip(RoundedCornerShape(30.dp)).background(MaterialTheme.colorScheme.surfaceVariant), contentAlignment = Alignment.Center) { Icon(if (page == 2) Icons.Default.AutoAwesome else Icons.Default.SmartToy, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(76.dp)) }
                    Text(stringResource(title), Modifier.padding(top = 26.dp), fontSize = 27.sp, lineHeight = 32.sp, fontWeight = FontWeight.SemiBold)
                    Text(stringResource(body), Modifier.padding(top = 11.dp), fontSize = 14.sp, lineHeight = 21.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Row(Modifier.fillMaxWidth().padding(vertical = 12.dp), horizontalArrangement = Arrangement.Center) { repeat(3) { i -> Box(Modifier.padding(3.dp).size(if (pager.currentPage == i) 18.dp else 7.dp, 7.dp).clip(CircleShape).background(if (pager.currentPage == i) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline)) } }
            Button(onClick = { if (pager.currentPage < 2) pagerScope.launch { pager.animateScrollToPage(pager.currentPage + 1) } else pickStep = true }, Modifier.fillMaxWidth().height(52.dp)) { Text(stringResource(if (pager.currentPage == 2) R.string.get_started else R.string.next)) }
        } else {
            Text(stringResource(R.string.pick_ais), Modifier.padding(top = 18.dp), fontSize = 27.sp, fontWeight = FontWeight.SemiBold)
            Text(stringResource(R.string.pick_ais_hint), Modifier.padding(top = 6.dp), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
            listOf("ChatGPT", "Claude", "Gemini", "DeepSeek").forEachIndexed { index, name ->
                val id = ids[index]
                Card(onClick = { picked = if (id in picked) picked - id else picked + id }, Modifier.fillMaxWidth().padding(top = 10.dp), shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = if (id in picked) MaterialTheme.colorScheme.primary.copy(alpha = .12f) else MaterialTheme.colorScheme.surface)) {
                    Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) { ModelAvatar(name, Modifier.size(34.dp)); Text(name, Modifier.weight(1f).padding(start = 11.dp), fontWeight = FontWeight.Medium); if (id in picked) Icon(Icons.Default.Check, null, tint = MaterialTheme.colorScheme.primary) }
                }
            }
            Spacer(Modifier.weight(1f))
            Button(onClick = { onDone(picked.toList()) }, Modifier.fillMaxWidth().height(52.dp)) { Text(stringResource(R.string.continue_count, picked.size)) }
        }
    }
}

private val PanelDefinitionDefaults = setOf("chatgpt", "claude", "gemini", "deepseek")

private data class StudioEntry(val image: GeneratedImage, val prompt: String, val label: String, val size: String)

@Composable
fun StudioScreenV2(endpoints: List<ApiEndpoint>, onOpenSettings: () -> Unit, onFirstImage: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var prompt by remember { mutableStateOf("") }
    var style by remember { mutableStateOf("Poster") }
    var size by remember { mutableStateOf("1:1") }
    var modelId by remember { mutableStateOf(endpoints.firstOrNull()?.id.orEmpty()) }
    var loading by remember { mutableStateOf(false) }
    var selected by remember { mutableStateOf<StudioEntry?>(null) }
    var error by remember { mutableStateOf("") }
    val entries = remember { mutableStateListOf<StudioEntry>() }
    val apiEndpoints = endpoints.filter { it.imageModelId.isNotBlank() }
    val model = apiEndpoints.firstOrNull { it.id == modelId } ?: apiEndpoints.firstOrNull()
    val colors = MaterialTheme.colorScheme
    fun generateImage(submitted: String, requestedStyle: String, requestedSize: String) {
        val endpoint = model ?: return
        val styleHint = mapOf("Photo" to "photorealistic photograph", "Poster" to "cinematic poster design", "Logo" to "clean vector logo", "Anime" to "anime illustration", "3D" to "high quality 3D render")[requestedStyle].orEmpty()
        val fullPrompt = "$submitted, $styleHint"
        loading = true
        error = ""
        scope.launch {
            val generated = runCatching { withContext(Dispatchers.IO) { ApiClient.generateImages(endpoint, fullPrompt, requestedSize, modelId = endpoint.imageModelId) } }
            generated.onSuccess { result ->
                if (result.isEmpty()) error = context.getString(R.string.image_no_results)
                else {
                    result.forEach { entries.add(0, StudioEntry(it, submitted, requestedStyle, requestedSize)) }
                    prompt = ""
                    onFirstImage()
                }
            }.onFailure { error = it.message?.take(120).orEmpty().ifBlank { context.getString(R.string.image_generation_failed) } }
            loading = false
        }
    }
    if (selected != null) {
        val entry = selected!!
        StudioDetail(
            entry,
            onBack = { selected = null },
            onUsePrompt = { prompt = entry.prompt; style = entry.label; size = entry.size; selected = null },
            onRegenerate = { style = entry.label; size = entry.size; prompt = entry.prompt; selected = null; generateImage(entry.prompt, entry.label, entry.size) },
            context = context
        )
        return
    }
    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 10.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(stringResource(R.string.nav_studio), Modifier.weight(1f), fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
            if (model != null) {
                var menu by remember { mutableStateOf(false) }
                TextButton(onClick = { menu = true }) { Text(model.name, maxLines = 1); androidx.compose.material3.DropdownMenu(menu, { menu = false }) { apiEndpoints.forEach { endpoint -> androidx.compose.material3.DropdownMenuItem(text = { Text(endpoint.name) }, onClick = { modelId = endpoint.id; menu = false }) } } }
            }
        }
        if (apiEndpoints.isEmpty()) {
            Column(Modifier.weight(1f).fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                Icon(Icons.Default.Image, null, tint = colors.primary, modifier = Modifier.size(45.dp))
                Text(stringResource(R.string.image_empty_title), Modifier.padding(top = 14.dp), fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                Text(stringResource(R.string.image_empty_body), Modifier.padding(top = 7.dp), color = colors.onSurfaceVariant, fontSize = 13.sp, lineHeight = 19.sp, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                Button(onClick = onOpenSettings, Modifier.padding(top = 16.dp)) { Text(stringResource(R.string.open_settings)) }
            }
        } else {
            OutlinedTextField(prompt, { prompt = it }, Modifier.fillMaxWidth(), placeholder = { Text(stringResource(R.string.image_prompt)) }, minLines = 3, maxLines = 5, shape = RoundedCornerShape(22.dp))
            Text(stringResource(R.string.style), Modifier.padding(start = 2.dp, top = 12.dp, bottom = 6.dp), fontWeight = FontWeight.Medium, fontSize = 12.sp)
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                listOf(R.string.photo, R.string.poster, R.string.logo, R.string.anime, R.string.three_d).forEach { labelId ->
                    val label = stringResource(labelId)
                    ChoiceChip(label, style == label) { style = label }
                }
            }
            Text(stringResource(R.string.size), Modifier.padding(start = 2.dp, top = 10.dp, bottom = 6.dp), fontWeight = FontWeight.Medium, fontSize = 12.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) { listOf(R.string.size_square, R.string.size_portrait, R.string.size_landscape).forEach { labelId -> val label = stringResource(labelId); ChoiceChip(label, size == label) { size = label } } }
            Button(onClick = {
                val submitted = prompt.trim()
                if (model == null || submitted.isBlank() || loading) return@Button
                generateImage(submitted, style, size)
            }, enabled = model != null && prompt.isNotBlank() && !loading, modifier = Modifier.fillMaxWidth().padding(top = 12.dp).height(52.dp), shape = RoundedCornerShape(18.dp)) {
                if (loading) CircularProgressIndicator(Modifier.size(18.dp), color = Color.White, strokeWidth = 2.dp) else Icon(Icons.Default.AutoAwesome, null)
                Text(stringResource(if (loading) R.string.generating else R.string.generate), Modifier.padding(start = 8.dp))
            }
            if (error.isNotBlank()) Text(error, Modifier.padding(top = 6.dp), color = colors.error, fontSize = 12.sp)
            Text(stringResource(R.string.results), Modifier.padding(top = 13.dp, bottom = 7.dp), fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            if (entries.isEmpty() && !loading) {
                Column(Modifier.weight(1f).fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                    Icon(Icons.Default.Image, null, tint = colors.onSurfaceVariant, modifier = Modifier.size(30.dp))
                    Text(stringResource(R.string.no_images_yet), Modifier.padding(top = 9.dp), color = colors.onSurfaceVariant, fontSize = 12.sp)
                }
            } else LazyVerticalGrid(columns = GridCells.Fixed(2), modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(9.dp), horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                if (loading) items(2) { Box(Modifier.fillMaxWidth().aspectRatio(1f).clip(RoundedCornerShape(17.dp)).background(colors.surfaceVariant), contentAlignment = Alignment.Center) { CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp) } }
                itemsIndexed(entries) { _, entry ->
                    Card(onClick = { selected = entry }, shape = RoundedCornerShape(17.dp)) { ImageContent(entry.image, Modifier.fillMaxWidth().aspectRatio(1f)) }
                }
            }
        }
    }
}

@Composable
private fun ChoiceChip(label: String, selected: Boolean, onClick: () -> Unit) {
    Surface(onClick = onClick, shape = CircleShape, color = if (selected) MaterialTheme.colorScheme.primary.copy(alpha = .16f) else MaterialTheme.colorScheme.surface, border = androidx.compose.foundation.BorderStroke(1.dp, if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline)) {
        Text(label, Modifier.padding(horizontal = 13.dp, vertical = 8.dp), fontSize = 12.sp, color = if (selected) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun ImageContent(image: GeneratedImage, modifier: Modifier = Modifier) {
    val bitmap by produceState<Bitmap?>(initialValue = null, image.url, image.base64) {
        value = withContext(Dispatchers.IO) {
            runCatching {
                if (image.base64.isNotBlank()) BitmapFactory.decodeByteArray(Base64.getDecoder().decode(image.base64), 0, Base64.getDecoder().decode(image.base64).size)
                else URL(image.url).openStream().use(BitmapFactory::decodeStream)
            }.getOrNull()
        }
    }
    if (bitmap != null) androidx.compose.foundation.Image(bitmap!!.asImageBitmap(), null, modifier, contentScale = androidx.compose.ui.layout.ContentScale.Crop)
    else Box(modifier.background(MaterialTheme.colorScheme.surfaceVariant), contentAlignment = Alignment.Center) { Icon(Icons.Default.Image, null, tint = MaterialTheme.colorScheme.onSurfaceVariant) }
}

@Composable
private fun StudioDetail(entry: StudioEntry, onBack: () -> Unit, onUsePrompt: () -> Unit, onRegenerate: () -> Unit, context: Context) {
    val scope = rememberCoroutineScope()
    var message by remember { mutableStateOf("") }
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) { TextButton(onClick = onBack) { Text(stringResource(R.string.studio_back)) }; Spacer(Modifier.weight(1f)); Text(entry.label, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        ImageContent(entry.image, Modifier.fillMaxWidth().weight(1f).clip(RoundedCornerShape(22.dp)))
        Text(entry.prompt, Modifier.padding(vertical = 12.dp), fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (message.isNotBlank()) Text(message, fontSize = 12.sp, color = MaterialTheme.colorScheme.primary)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        TextButton(onClick = {
            val save = {
                scope.launch { message = runCatching { saveImage(context, entry.image) }.fold({ context.getString(R.string.saved_gallery) }, { context.getString(R.string.image_save_failed) }) }
            }
            if (context is MainActivity) context.requestLegacyGalleryPermission { granted ->
                if (granted) save() else message = context.getString(R.string.gallery_permission_denied)
            } else save()
        }) { Text(stringResource(R.string.save_gallery)) }
            TextButton(onClick = { scope.launch { runCatching { shareImage(context, entry.image) }.onFailure { message = context.getString(R.string.image_share_failed) } } }) { Text(stringResource(R.string.share)) }
            TextButton(onClick = onUsePrompt) { Text(stringResource(R.string.use_as_prompt)) }
            TextButton(onClick = onRegenerate) { Text(stringResource(R.string.regenerate)) }
        }
    }
}

private suspend fun imageBytes(image: GeneratedImage): ByteArray = withContext(Dispatchers.IO) {
    if (image.base64.isNotBlank()) Base64.getDecoder().decode(image.base64) else URL(image.url).openStream().use { it.readBytes() }
}

private suspend fun saveImage(context: Context, image: GeneratedImage): Uri = withContext(Dispatchers.IO) {
    val values = ContentValues().apply {
        put(MediaStore.Images.Media.DISPLAY_NAME, "ott24x7-${System.currentTimeMillis()}.png")
        put(MediaStore.Images.Media.MIME_TYPE, "image/png")
        if (Build.VERSION.SDK_INT >= 29) {
            put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/OTT24x7 AI")
            put(MediaStore.Images.Media.IS_PENDING, 1)
        }
    }
    val uri = context.contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values) ?: error("No gallery item")
    context.contentResolver.openOutputStream(uri)?.use { it.write(imageBytes(image)) } ?: error("No gallery stream")
    if (Build.VERSION.SDK_INT >= 29) context.contentResolver.update(uri, ContentValues().apply { put(MediaStore.Images.Media.IS_PENDING, 0) }, null, null)
    uri
}

private suspend fun shareImage(context: Context, image: GeneratedImage) {
    val file = withContext(Dispatchers.IO) {
        File(context.cacheDir, "shared-image-${System.currentTimeMillis()}.png").apply { writeBytes(imageBytes(image)) }
    }
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type = "image/png"; putExtra(Intent.EXTRA_STREAM, uri); addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION) }, context.getString(R.string.share)))
}

