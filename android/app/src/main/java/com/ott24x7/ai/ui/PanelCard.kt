package com.ott24x7.ai.ui

import android.webkit.WebView
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
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
import com.ott24x7.ai.data.DeliveryStatus
import com.ott24x7.ai.data.PanelAnswer
import com.ott24x7.ai.data.PanelDefinition
import com.ott24x7.ai.data.PanelKind

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
    modifier: Modifier = Modifier
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
                        Icon(Icons.Default.MoreVert, contentDescription = "${panel.name} options", tint = colors.onSurfaceVariant, modifier = Modifier.size(18.dp))
                    }
                    DropdownMenu(expanded = menuExpanded, onDismissRequest = { menuExpanded = false }) {
                        DropdownMenuItem(text = { Text("Clear login") }, onClick = { menuExpanded = false; onClearLogin() })
                        DropdownMenuItem(text = { Text("Open Google sign-in") }, onClick = { menuExpanded = false; onOpenGoogleCustomTab() })
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
                                Text("Google sign-in isn't allowed inside apps. Use email login, or sign in with a Chrome Custom Tab.", color = Color(0xFFECEEF2), fontSize = 12.sp, modifier = Modifier.padding(top = 2.dp))
                                TextButton(onClick = onOpenGoogleCustomTab) {
                                    Text("Continue with Chrome Custom Tab", color = Color(0xFFB9A9FF), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                }
                            } else {
                                Text("Sign in to ${panel.name} to send prompts", color = FiestaDarkText, fontSize = 13.sp)
                            }
                        }
                    }
                }
            } else {
                Box(Modifier.fillMaxWidth().height(bodyHeight).padding(horizontal = 16.dp, vertical = 12.dp)) {
                    if (answer.text.isBlank() && answer.loading) {
                        Text("Thinking…", color = colors.onSurfaceVariant, fontSize = 14.sp)
                    } else if (answer.text.isBlank() && answer.status == DeliveryStatus.ERROR) {
                        Text("The request could not be completed. Check the endpoint and try again.", color = colors.onSurfaceVariant, fontSize = 14.sp)
                    } else {
                        MarkdownText(answer.text, Modifier.fillMaxSize())
                    }
                    if (answer.loading && answer.text.isNotBlank()) {
                        Text("typing…", Modifier.align(Alignment.BottomEnd).padding(8.dp), color = colors.primary, fontSize = 11.sp)
                    }
                }
            }
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 7.dp, vertical = 3.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                IconButton(onClick = onCopy, modifier = Modifier.size(32.dp)) { Icon(Icons.Default.ContentCopy, "Copy answer", tint = colors.onSurfaceVariant, modifier = Modifier.size(16.dp)) }
                IconButton(onClick = onRegenerate, modifier = Modifier.size(32.dp)) { Icon(Icons.Default.Refresh, "Regenerate", tint = colors.onSurfaceVariant, modifier = Modifier.size(17.dp)) }
                Spacer(Modifier.weight(1f))
                IconButton(onClick = onExpand, modifier = Modifier.size(32.dp)) {
                    Icon(if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore, if (expanded) "Close full screen" else "Expand", tint = colors.onSurfaceVariant, modifier = Modifier.size(18.dp))
                }
            }
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
    val (label, color) = when {
        loading || status == DeliveryStatus.TYPING -> "typing…" to colors.primary
        status == DeliveryStatus.SENT -> "Sent ✓" to Color(0xFF53C991)
        status == DeliveryStatus.LOGIN_NEEDED -> "Sign in needed" to Color(0xFFE5A94F)
        status == DeliveryStatus.COPIED -> "Copied" to colors.onSurfaceVariant
        status == DeliveryStatus.ERROR -> "Try again" to Color(0xFFE57575)
        else -> "Ready" to colors.onSurfaceVariant
    }
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(5.dp).clip(CircleShape).background(color))
        Spacer(Modifier.width(4.dp))
        Text(label, color = color, fontSize = 10.sp, maxLines = 1)
    }
}

@Composable
fun MarkdownText(text: String, modifier: Modifier = Modifier) {
    val colors = MaterialTheme.colorScheme
    val annotated = remember(text, colors.onSurface, colors.primary) {
        buildAnnotatedString {
            val lines = text.split('\n')
            lines.forEachIndexed { lineIndex, line ->
                val heading = line.takeWhile { it == '#' }.length in 1..3 && line.contains(' ')
                val clean = if (heading) line.dropWhile { it == '#' }.trimStart() else line
                if (heading) withStyle(SpanStyle(fontWeight = FontWeight.Bold, fontSize = 18.sp, color = colors.onSurface)) { append(clean); append("\n") }
                else {
                    var cursor = 0
                    val pattern = Regex("(\\*\\*.+?\\*\\*|`[^`]+`)")
                    pattern.findAll(clean).forEach { match ->
                        append(clean.substring(cursor, match.range.first))
                        val value = match.value
                        if (value.startsWith("**")) withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = colors.onSurface)) { append(value.removePrefix("**").removeSuffix("**")) }
                        else withStyle(SpanStyle(fontFamily = FontFamily.Monospace, color = colors.primary, background = colors.surfaceVariant)) { append(value.removeSurrounding("`")) }
                        cursor = match.range.last + 1
                    }
                    append(clean.substring(cursor))
                    if (lineIndex < lines.lastIndex) append('\n')
                }
            }
        }
    }
    Text(annotated, modifier.verticalScroll(rememberScrollState()), fontSize = 14.sp, lineHeight = 21.sp, color = colors.onSurface)
}
