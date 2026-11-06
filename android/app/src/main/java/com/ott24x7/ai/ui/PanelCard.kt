package com.ott24x7.ai.ui

import android.webkit.WebView
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.ott24x7.ai.MainActivity
import com.ott24x7.ai.R
import com.ott24x7.ai.data.DeliveryStatus
import com.ott24x7.ai.data.PanelAnswer
import com.ott24x7.ai.data.PanelDefinition
import com.ott24x7.ai.data.PanelKind
import com.ott24x7.ai.data.CitationParser

@Composable
fun PanelCard(
    activity: MainActivity,
    panel: PanelDefinition,
    answer: PanelAnswer,
    bodyHeight: androidx.compose.ui.unit.Dp,
    expanded: Boolean,
    onCopy: () -> Unit,
    onRegenerate: () -> Unit,
    onExpand: () -> Unit,
    onClearLogin: () -> Unit,
    onOpenGoogleCustomTab: () -> Unit,
    googleSignInRequired: Boolean,
    modifier: Modifier = Modifier,
    onShare: () -> Unit = {}
) {
    val colors = MaterialTheme.colorScheme
    var menuExpanded by remember(panel.id) { mutableStateOf(false) }
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(20.dp),
        border = BorderStroke(1.dp, colors.outline),
        colors = CardDefaults.cardColors(containerColor = colors.surface)
    ) {
        Column(Modifier.fillMaxSize()) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(start = 12.dp, end = 4.dp, top = 9.dp, bottom = 7.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                ModelAvatar(panel.name, Modifier.size(24.dp))
                Text(panel.name, Modifier.padding(start = 8.dp), fontWeight = FontWeight.SemiBold, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Surface(
                    modifier = Modifier.padding(start = 6.dp),
                    color = colors.surfaceVariant,
                    shape = RoundedCornerShape(6.dp),
                    border = BorderStroke(1.dp, colors.outline)
                ) {
                    Text(if (panel.kind == PanelKind.WEB) "WEB" else "API", Modifier.padding(horizontal = 5.dp, vertical = 2.dp), fontSize = 9.sp, fontWeight = FontWeight.Medium, color = colors.onSurfaceVariant)
                }
                Spacer(Modifier.weight(1f))
                Box(Modifier.padding(end = 3.dp)) {
                    StatusLabel(answer.status, answer.loading)
                }
                Box {
                    IconButton(onClick = { menuExpanded = true }, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Default.MoreVert, contentDescription = stringResource(R.string.panel_options, panel.name), tint = colors.onSurfaceVariant, modifier = Modifier.size(18.dp))
                    }
                    DropdownMenu(expanded = menuExpanded, onDismissRequest = { menuExpanded = false }) {
                        DropdownMenuItem(text = { Text(stringResource(R.string.clear_login)) }, onClick = { menuExpanded = false; onClearLogin() })
                        DropdownMenuItem(text = { Text(stringResource(R.string.open_google_sign_in)) }, onClick = { menuExpanded = false; onOpenGoogleCustomTab() })
                    }
                }
            }
            if (panel.kind == PanelKind.WEB) {
                Box(Modifier.fillMaxWidth().height(bodyHeight).background(Color(0xFF0B0D11))) {
                    AndroidView(
                        factory = { context -> activity.webViewFor(if (expanded) panel.copy(id = "${panel.id}:expanded") else panel) },
                        modifier = Modifier.fillMaxSize(),
                        update = { view: WebView -> view.onResume() }
                    )
                    if (answer.status == DeliveryStatus.LOGIN_NEEDED || googleSignInRequired) {
                        Column(
                            Modifier.align(Alignment.BottomCenter).fillMaxWidth().background(Color(0xE612151B)).padding(14.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            if (googleSignInRequired) {
                                Text(stringResource(R.string.google_sign_in_note), color = Color(0xFFECEEF2), fontSize = 12.sp, modifier = Modifier.padding(top = 2.dp))
                                TextButton(onClick = onOpenGoogleCustomTab) {
                                    Text(stringResource(R.string.continue_chrome_sign_in), color = Color(0xFFB9A9FF), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                }
                            } else {
                                Text(stringResource(R.string.sign_in_to_panel, panel.name), color = FiestaDarkText, fontSize = 13.sp)
                            }
                        }
                    }
                }
            } else {
                Column(Modifier.fillMaxWidth().height(bodyHeight)) {
                    Box(Modifier.weight(1f).fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp)) {
                        if (answer.text.isBlank() && answer.loading) {
                            Text(stringResource(R.string.thinking), color = colors.onSurfaceVariant, fontSize = 14.sp)
                        } else if (answer.text.isBlank() && answer.status == DeliveryStatus.ERROR) {
                            Text(stringResource(R.string.api_request_failed), color = colors.onSurfaceVariant, fontSize = 14.sp)
                        } else {
                            MarkdownText(answer.text, Modifier.fillMaxSize())
                        }
                        if (answer.loading && answer.text.isNotBlank()) {
                            Text(stringResource(R.string.status_typing), Modifier.align(Alignment.BottomEnd).padding(8.dp), color = colors.primary, fontSize = 11.sp)
                        }
                    }
                    if (answer.sources.isNotEmpty()) CitationSourcesRow(answer.text, answer.sources, activity::openCustomTab)
                }
            }
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 7.dp, vertical = 3.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                IconButton(onClick = onCopy, modifier = Modifier.size(32.dp)) { Icon(Icons.Default.ContentCopy, stringResource(R.string.copy_answer), tint = colors.onSurfaceVariant, modifier = Modifier.size(16.dp)) }
                if (panel.kind == PanelKind.API) IconButton(onClick = onShare, modifier = Modifier.size(32.dp)) { Icon(Icons.Default.Share, stringResource(R.string.share_answer), tint = colors.onSurfaceVariant, modifier = Modifier.size(16.dp)) }
                IconButton(onClick = onRegenerate, modifier = Modifier.size(32.dp)) { Icon(Icons.Default.Refresh, stringResource(R.string.regenerate), tint = colors.onSurfaceVariant, modifier = Modifier.size(17.dp)) }
                Spacer(Modifier.weight(1f))
                IconButton(onClick = onExpand, modifier = Modifier.size(32.dp)) {
                    Icon(if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore, stringResource(if (expanded) R.string.close_full_screen else R.string.expand_answer), tint = colors.onSurfaceVariant, modifier = Modifier.size(18.dp))
                }
            }
        }
    }
}

@Composable
internal fun CitationSourcesRow(text: String, sources: List<com.ott24x7.ai.data.ExaSource>, onOpen: (String) -> Unit) {
    val colors = MaterialTheme.colorScheme
    var expanded by remember(text) { mutableStateOf(false) }
    val citations = CitationParser.indices(text, sources.size)
    Column(Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 4.dp)) {
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(5.dp)) {
            citations.forEach { number ->
                val source = sources[number - 1]
                AssistChip(onClick = { onOpen(source.url) }, label = { Text("[$number] ${source.domain}", fontSize = 10.sp, maxLines = 1) }, modifier = Modifier.height(31.dp), colors = AssistChipDefaults.assistChipColors(containerColor = colors.surfaceVariant))
            }
            TextButton(onClick = { expanded = !expanded }) { Text(stringResource(R.string.sources_count, sources.size), fontSize = 10.sp) }
        }
        if (expanded) sources.forEachIndexed { index, source ->
            Text("[${index + 1}] ${source.domain}", Modifier.fillMaxWidth().clickable { onOpen(source.url) }.padding(vertical = 4.dp), color = colors.primary, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
fun ModelAvatar(name: String, modifier: Modifier = Modifier) {
    val background = when (name.lowercase()) {
        "chatgpt" -> Color(0xFF1F8A70)
        "claude" -> Color(0xFFC77E4B)
        "gemini" -> Color(0xFF5275D6)
        "deepseek" -> Color(0xFF3479E8)
        "grok" -> Color(0xFF1D1D20)
        "copilot" -> Color(0xFF2476CE)
        "perplexity" -> Color(0xFF27A890)
        "meta ai" -> Color(0xFF4777E8)
        else -> FiestaAccent
    }
    Box(modifier.clip(CircleShape).background(background), contentAlignment = Alignment.Center) {
        Text(name.take(1).uppercase(), color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun StatusLabel(status: DeliveryStatus, loading: Boolean) {
    val colors = MaterialTheme.colorScheme
    val (labelId, color) = when {
        loading || status == DeliveryStatus.TYPING -> R.string.status_typing to colors.primary
        status == DeliveryStatus.SENT -> R.string.status_sent to Color(0xFF53C991)
        status == DeliveryStatus.LOGIN_NEEDED -> R.string.status_login_needed to Color(0xFFE5A94F)
        status == DeliveryStatus.COPIED -> R.string.copied to colors.onSurfaceVariant
        status == DeliveryStatus.ERROR -> R.string.status_try_again to Color(0xFFE57575)
        else -> R.string.status_ready to colors.onSurfaceVariant
    }
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(5.dp).clip(CircleShape).background(color))
        Spacer(Modifier.width(4.dp))
        Text(stringResource(labelId), color = color, fontSize = 10.sp, maxLines = 1)
    }
}

@Composable
fun MarkdownText(text: String, modifier: Modifier = Modifier) {
    val colors = MaterialTheme.colorScheme
    val lines = remember(text) { text.lines() }
    Column(modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(3.dp)) {
        var index = 0
        while (index < lines.size) {
            val line = lines[index]
            when {
                line.trimStart().startsWith("```") -> {
                    val code = mutableListOf<String>()
                    index++
                    while (index < lines.size && !lines[index].trimStart().startsWith("```")) { code += lines[index]; index++ }
                    if (index < lines.size) index++
                    CodeBlock(code.joinToString("\n"))
                }
                line.contains('|') && index + 1 < lines.size && lines[index + 1].contains("---") -> {
                    val tableLines = mutableListOf(line)
                    index += 2
                    while (index < lines.size && lines[index].contains('|')) { tableLines += lines[index]; index++ }
                    MarkdownTable(tableLines)
                }
                line.isBlank() -> { Spacer(Modifier.height(3.dp)); index++ }
                line.trimStart().startsWith("### ") || line.trimStart().startsWith("## ") || line.trimStart().startsWith("# ") -> {
                    val heading = line.trimStart().dropWhile { it == '#' }.trim()
                    Text(inlineMarkdown(heading, colors), fontSize = 18.sp, lineHeight = 24.sp, fontWeight = FontWeight.Bold, color = colors.onSurface, modifier = Modifier.padding(top = 7.dp, bottom = 2.dp))
                    index++
                }
                Regex("^\\s*[-*+]\\s+").containsMatchIn(line) -> {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
                        Text("•", Modifier.width(19.dp), color = colors.primary)
                        Text(inlineMarkdown(line.replaceFirst(Regex("^\\s*[-*+]\\s+"), ""), colors), fontSize = 14.sp, lineHeight = 21.sp, color = colors.onSurface)
                    }
                    index++
                }
                Regex("^\\s*\\d+[.)]\\s+").containsMatchIn(line) -> {
                    val marker = Regex("^\\s*(\\d+[.)])\\s+").find(line)?.groupValues?.get(1).orEmpty()
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
                        Text(marker, Modifier.width(25.dp), color = colors.primary, fontWeight = FontWeight.Medium)
                        Text(inlineMarkdown(line.replaceFirst(Regex("^\\s*\\d+[.)]\\s+"), ""), colors), fontSize = 14.sp, lineHeight = 21.sp, color = colors.onSurface)
                    }
                    index++
                }
                line.trimStart().startsWith("> ") -> {
                    Text(inlineMarkdown(line.trim().removePrefix("> "), colors), Modifier.fillMaxWidth().padding(start = 10.dp).clip(RoundedCornerShape(5.dp)).background(colors.surfaceVariant).padding(8.dp), fontSize = 13.sp, lineHeight = 20.sp, color = colors.onSurfaceVariant)
                    index++
                }
                else -> {
                    Text(inlineMarkdown(line, colors), fontSize = 14.sp, lineHeight = 21.sp, color = colors.onSurface)
                    index++
                }
            }
        }
    }
}

@Composable
private fun CodeBlock(code: String) {
    val colors = MaterialTheme.colorScheme
    val clipboard = LocalClipboardManager.current
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(colors.surfaceVariant)) {
        Row(Modifier.fillMaxWidth().padding(start = 10.dp, end = 3.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(stringResource(R.string.code), Modifier.weight(1f), color = colors.onSurfaceVariant, fontSize = 10.sp)
            IconButton(onClick = { clipboard.setText(AnnotatedString(code)) }, modifier = Modifier.size(32.dp)) { Icon(Icons.Default.ContentCopy, stringResource(R.string.copy_code), tint = colors.onSurfaceVariant, modifier = Modifier.size(15.dp)) }
        }
        Text(code, Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 10.dp, vertical = 7.dp), fontFamily = FontFamily.Monospace, fontSize = 12.sp, lineHeight = 18.sp, color = colors.onSurface)
    }
}

@Composable
private fun MarkdownTable(lines: List<String>) {
    val colors = MaterialTheme.colorScheme
    Column(Modifier.horizontalScroll(rememberScrollState()).clip(RoundedCornerShape(10.dp)).background(colors.surfaceVariant)) {
        lines.filterNot { it.contains("---") }.forEachIndexed { rowIndex, row ->
            val cells = row.trim().trim('|').split('|').map(String::trim)
            Row {
                cells.forEach { cell ->
                    Text(inlineMarkdown(cell, colors), Modifier.width(126.dp).padding(horizontal = 8.dp, vertical = 7.dp), fontSize = 12.sp, fontWeight = if (rowIndex == 0) FontWeight.SemiBold else FontWeight.Normal, color = colors.onSurface)
                }
            }
            if (rowIndex == 0) androidx.compose.material3.HorizontalDivider(color = colors.outline)
        }
    }
}

private fun inlineMarkdown(value: String, colors: androidx.compose.material3.ColorScheme) = buildAnnotatedString {
    val pattern = Regex("(\\*\\*.+?\\*\\*|`[^`]+`|\\*[^*]+\\*)")
    var cursor = 0
    pattern.findAll(value).forEach { match ->
        append(value.substring(cursor, match.range.first))
        val token = match.value
        when {
            token.startsWith("**") -> withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = colors.onSurface)) { append(token.removeSurrounding("**")) }
            token.startsWith("`") -> withStyle(SpanStyle(fontFamily = FontFamily.Monospace, color = colors.primary, background = colors.surfaceVariant)) { append(token.removeSurrounding("`")) }
            else -> withStyle(SpanStyle(fontWeight = FontWeight.Medium)) { append(token.removeSurrounding("*")) }
        }
        cursor = match.range.last + 1
    }
    append(value.substring(cursor))
}
