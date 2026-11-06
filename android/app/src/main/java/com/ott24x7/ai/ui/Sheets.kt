package com.ott24x7.ai.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.SheetState
import androidx.compose.material3.Switch
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Color.Companion.White
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ott24x7.ai.data.ApiEndpoint
import com.ott24x7.ai.data.PanelDefinition
import com.ott24x7.ai.data.PanelKind
import com.ott24x7.ai.data.ExaSource
import com.ott24x7.ai.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.UUID

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ModelPickerSheet(
    panels: List<PanelDefinition>,
    selectedIds: List<String>,
    onToggle: (String) -> Unit,
    onDismiss: () -> Unit,
    onMove: (String, Boolean) -> Unit = { _, _ -> }
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val colors = MaterialTheme.colorScheme
    var search by remember { mutableStateOf("") }
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        shape = RoundedCornerShape(topStart = 26.dp, topEnd = 26.dp),
        containerColor = colors.surface,
        dragHandle = { SheetHandle() }
    ) {
        Column(Modifier.fillMaxWidth().fillMaxHeight(0.84f).padding(horizontal = 16.dp)) {
            Row(Modifier.fillMaxWidth().padding(top = 4.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(stringResource(R.string.choose_ais), fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                    Text(stringResource(R.string.max_eight, selectedIds.size), color = colors.onSurfaceVariant, fontSize = 12.sp, modifier = Modifier.padding(top = 3.dp))
                }
                Button(onClick = onDismiss, shape = RoundedCornerShape(18.dp), contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 17.dp, vertical = 8.dp)) { Text(stringResource(R.string.done), fontSize = 13.sp) }
            }
            OutlinedTextField(search, { search = it }, Modifier.fillMaxWidth().padding(bottom = 5.dp), singleLine = true, placeholder = { Text(stringResource(R.string.model_search)) }, leadingIcon = { Icon(Icons.Default.Search, null) }, shape = RoundedCornerShape(16.dp))
            LazyColumn(Modifier.weight(1f, fill = false)) {
                val visible = panels.filter { it.name.contains(search, ignoreCase = true) || it.description.contains(search, ignoreCase = true) }
                item { SectionHeading(stringResource(R.string.web_logins)) }
                items(visible.filter { it.kind == PanelKind.WEB }, key = { it.id }) { panel ->
                    ModelPickerRow(panel, panel.id in selectedIds, canAdd = selectedIds.size < 8 || panel.id in selectedIds,
                        onToggle = { onToggle(panel.id) }, onMoveUp = { onMove(panel.id, true) }, onMoveDown = { onMove(panel.id, false) })
                }
                if (visible.any { it.kind == PanelKind.API }) {
                    item { SectionHeading(stringResource(R.string.api_models)) }
                    items(visible.filter { it.kind == PanelKind.API }, key = { it.id }) { panel ->
                        ModelPickerRow(panel, panel.id in selectedIds, canAdd = selectedIds.size < 8 || panel.id in selectedIds,
                            onToggle = { onToggle(panel.id) }, onMoveUp = { onMove(panel.id, true) }, onMoveDown = { onMove(panel.id, false) })
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionHeading(text: String) {
    Text(text, color = MaterialTheme.colorScheme.primary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 12.dp, bottom = 5.dp))
}

@Composable
private fun ModelPickerRow(panel: PanelDefinition, selected: Boolean, canAdd: Boolean, onToggle: () -> Unit, onMoveUp: () -> Unit, onMoveDown: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
            .toggleable(value = selected, enabled = canAdd || selected, role = Role.Switch, onValueChange = { onToggle() })
            .padding(vertical = 8.dp, horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        ModelAvatar(panel.name, Modifier.size(32.dp))
        Column(Modifier.weight(1f).padding(start = 10.dp)) {
            Text(panel.name, fontWeight = FontWeight.Medium, fontSize = 14.sp)
            Text(panel.description, color = colors.onSurfaceVariant, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        if (selected) {
            IconButton(onClick = onMoveUp, modifier = Modifier.size(30.dp)) { Icon(Icons.Default.ArrowUpward, stringResource(R.string.move_model_up, panel.name), tint = colors.onSurfaceVariant, modifier = Modifier.size(14.dp)) }
            IconButton(onClick = onMoveDown, modifier = Modifier.size(30.dp)) { Icon(Icons.Default.ArrowDownward, stringResource(R.string.move_model_down, panel.name), tint = colors.onSurfaceVariant, modifier = Modifier.size(14.dp)) }
        }
        Box(
            Modifier.padding(horizontal = 2.dp).size(width = 36.dp, height = 20.dp).clip(CircleShape)
                .background(if (selected) colors.primary else colors.outline.copy(alpha = 0.65f))
                .border(1.dp, if (selected) colors.primary else colors.outline, CircleShape),
            contentAlignment = if (selected) Alignment.CenterEnd else Alignment.CenterStart
        ) {
            Box(Modifier.padding(horizontal = 2.dp).size(16.dp).clip(CircleShape).background(White))
        }
    }
}

@Composable
private fun SheetHandle() {
    Box(Modifier.padding(top = 9.dp, bottom = 4.dp).size(width = 40.dp, height = 4.dp).clip(CircleShape).background(MaterialTheme.colorScheme.outline))
}

@Composable
internal fun SettingsSection(title: String, content: @Composable ColumnScope.() -> Unit) {
    val colors = MaterialTheme.colorScheme
    Column(Modifier.fillMaxWidth().padding(top = 17.dp)) {
        Text(title.uppercase(), color = colors.onSurfaceVariant, fontSize = 11.sp, fontWeight = FontWeight.Medium, letterSpacing = 0.6.sp, modifier = Modifier.padding(start = 8.dp, bottom = 6.dp))
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(colors.surfaceVariant.copy(alpha = 0.45f))
                .border(1.dp, colors.outline, RoundedCornerShape(16.dp)),
            content = content
        )
    }
}

@Composable
internal fun SettingsRow(label: String, subtitle: String? = null, content: @Composable () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 13.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f).padding(end = 8.dp)) {
            Text(label, fontSize = 14.sp, fontWeight = FontWeight.Medium)
            if (subtitle != null) Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp, modifier = Modifier.padding(top = 2.dp))
        }
        content()
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsSheet(
    panels: List<PanelDefinition>,
    endpoints: List<ApiEndpoint>,
    themeMode: String,
    readWebAnswers: Boolean,
    onThemeMode: (String) -> Unit,
    onReadWebAnswers: (Boolean) -> Unit,
    onEndpointsChanged: (List<ApiEndpoint>) -> Unit,
    onClearLogin: (PanelDefinition) -> Unit,
    onOpenUrl: (String) -> Unit,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()
    val colors = MaterialTheme.colorScheme
    val context = LocalContext.current
    var name by remember { mutableStateOf("") }
    var baseUrl by remember { mutableStateOf("") }
    var apiKey by remember { mutableStateOf("") }
    var modelId by remember { mutableStateOf("") }
    var imageModelId by remember { mutableStateOf("") }
    var testMessage by remember { mutableStateOf("") }
    var testing by remember { mutableStateOf(false) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        shape = RoundedCornerShape(topStart = 26.dp, topEnd = 26.dp),
        containerColor = colors.surface,
        dragHandle = { SheetHandle() }
    ) {
        Column(Modifier.fillMaxWidth().fillMaxHeight(0.94f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 24.dp)) {
            Row(Modifier.fillMaxWidth().padding(top = 1.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onDismiss, modifier = Modifier.size(36.dp)) { Icon(Icons.Default.ArrowBack, stringResource(R.string.back), tint = colors.onSurface, modifier = Modifier.size(20.dp)) }
                Text(stringResource(R.string.nav_settings), fontSize = 20.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(start = 3.dp))
            }
            SettingsSection(stringResource(R.string.appearance)) {
                SettingsRow(stringResource(R.string.theme)) {
                    Row(Modifier.clip(RoundedCornerShape(10.dp)).background(colors.background).padding(2.dp), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                        listOf("dark" to R.string.dark, "light" to R.string.light, "system" to R.string.system).forEach { (value, label) ->
                            val selected = themeMode == value
                            Surface(
                                modifier = Modifier.clip(RoundedCornerShape(8.dp)).clickable { onThemeMode(value) },
                                color = if (selected) colors.surfaceVariant else Color.Transparent,
                                shape = RoundedCornerShape(8.dp)
                            ) { Text(stringResource(label), Modifier.padding(horizontal = 9.dp, vertical = 7.dp), color = if (selected) colors.onSurface else colors.onSurfaceVariant, fontSize = 11.sp) }
                        }
                    }
                }
            }
            SettingsSection(stringResource(R.string.settings_panels)) {
                SettingsRow(stringResource(R.string.read_web_answers), stringResource(R.string.read_web_answers_hint)) {
                    Switch(checked = readWebAnswers, onCheckedChange = onReadWebAnswers)
                }
            }
            SettingsSection(stringResource(R.string.settings_api)) {
                Column(Modifier.fillMaxWidth().padding(12.dp)) {
                    Text(stringResource(R.string.openai_compatible_endpoint), color = colors.onSurfaceVariant, fontSize = 12.sp, modifier = Modifier.padding(bottom = 8.dp))
                    endpoints.forEach { endpoint ->
                        Card(Modifier.fillMaxWidth().padding(vertical = 4.dp), colors = CardDefaults.cardColors(containerColor = colors.surfaceVariant)) {
                            Row(Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Key, null, tint = colors.primary)
                                Column(Modifier.weight(1f).padding(horizontal = 9.dp)) {
                                    Text(endpoint.name, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                                    Text("${endpoint.modelId} · ${endpoint.baseUrl}", fontSize = 11.sp, color = colors.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                }
                                IconButton(onClick = { onEndpointsChanged(endpoints.filterNot { it.id == endpoint.id }) }, modifier = Modifier.size(36.dp)) {
                                    Icon(Icons.Default.Delete, stringResource(R.string.remove_model, endpoint.name), tint = colors.onSurfaceVariant, modifier = Modifier.size(18.dp))
                                }
                            }
                        }
                    }
                    val fieldColors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = colors.primary,
                        unfocusedBorderColor = colors.outline,
                        focusedContainerColor = colors.background,
                        unfocusedContainerColor = colors.background
                    )
                    OutlinedTextField(name, { name = it }, Modifier.fillMaxWidth().padding(top = 4.dp), label = { Text(stringResource(R.string.endpoint_name)) }, singleLine = true, colors = fieldColors)
                    OutlinedTextField(baseUrl, { baseUrl = it }, Modifier.fillMaxWidth().padding(top = 6.dp), label = { Text(stringResource(R.string.base_url)) }, placeholder = { Text(stringResource(R.string.base_url_hint)) }, singleLine = true, colors = fieldColors)
                    OutlinedTextField(apiKey, { apiKey = it }, Modifier.fillMaxWidth().padding(top = 6.dp), label = { Text(stringResource(R.string.api_key)) }, singleLine = true, visualTransformation = PasswordVisualTransformation(), colors = fieldColors)
                    OutlinedTextField(modelId, { modelId = it }, Modifier.fillMaxWidth().padding(top = 6.dp), label = { Text(stringResource(R.string.model_id)) }, singleLine = true, colors = fieldColors)
                    OutlinedTextField(imageModelId, { imageModelId = it }, Modifier.fillMaxWidth().padding(top = 6.dp), label = { Text(stringResource(R.string.image_model_id)) }, singleLine = true, colors = fieldColors)
                    if (testMessage.isNotBlank()) Text(testMessage, color = if (testMessage.startsWith(context.getString(R.string.connected_prefix))) Color(0xFF53C991) else colors.error, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp))
                    Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(
                            enabled = !testing && baseUrl.isNotBlank() && apiKey.isNotBlank() && modelId.isNotBlank(),
                            onClick = {
                                testing = true
                                testMessage = context.getString(R.string.endpoint_testing)
                                val candidate = ApiEndpoint("test", name.ifBlank { modelId }, baseUrl, apiKey, modelId, imageModelId)
                                scope.launch {
                                    val result = runCatching { withContext(Dispatchers.IO) { com.ott24x7.ai.data.ApiClient.test(candidate) } }
                                    testing = false
                                    testMessage = result.fold(
                                        { context.getString(R.string.endpoint_connected, it.take(80)) },
                                        { context.getString(R.string.endpoint_connection_failed, it.message.orEmpty().take(120)) }
                                    )
                                }
                            }, modifier = Modifier.weight(1f), shape = RoundedCornerShape(12.dp)
                        ) { Text(stringResource(if (testing) R.string.testing else R.string.test)) }
                        Button(
                            enabled = name.isNotBlank() && baseUrl.isNotBlank() && apiKey.isNotBlank() && modelId.isNotBlank(),
                            onClick = {
                                val endpoint = ApiEndpoint(UUID.randomUUID().toString(), name.trim(), baseUrl.trim(), apiKey, modelId.trim(), imageModelId.trim())
                                onEndpointsChanged(endpoints + endpoint)
                                name = ""; baseUrl = ""; apiKey = ""; modelId = ""; imageModelId = ""; testMessage = context.getString(R.string.endpoint_saved_securely)
                            }, modifier = Modifier.weight(1f), shape = RoundedCornerShape(12.dp)
                        ) { Icon(Icons.Default.Add, null, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(4.dp)); Text(stringResource(R.string.add_model)) }
                    }
                }
            }
            SettingsSection(stringResource(R.string.panel_logins)) {
                panels.filter { it.kind == PanelKind.WEB }.forEach { panel ->
                    SettingsRow(panel.name) { TextButton(onClick = { onClearLogin(panel) }) { Text(stringResource(R.string.clear_login), fontSize = 12.sp) } }
                }
            }
            SettingsSection(stringResource(R.string.about)) {
                SettingsRow(stringResource(R.string.brand_name), stringResource(R.string.app_version)) { }
                SettingsRow(stringResource(R.string.ai_tools)) { TextButton(onClick = { onOpenUrl("https://ott24x7.com") }) { Text(stringResource(R.string.ai_tools_domain), fontSize = 12.sp) } }
                SettingsRow(stringResource(R.string.windows_office_keys)) { TextButton(onClick = { onOpenUrl("https://keys24x7.com") }) { Text(stringResource(R.string.software_keys_domain), fontSize = 12.sp) } }
                SettingsRow(stringResource(R.string.agpl_source)) {
                    TextButton(onClick = { onOpenUrl("https://github.com/ott24x7-oss/ott24x7-ai") }) {
                        Icon(Icons.Default.OpenInNew, null, modifier = Modifier.size(14.dp)); Spacer(Modifier.width(4.dp)); Text(stringResource(R.string.github), fontSize = 12.sp)
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CombineSheet(
    endpoints: List<ApiEndpoint>,
    answer: String,
    loading: Boolean,
    judgeId: String?,
    onJudgeSelected: (String) -> Unit,
    onCombine: () -> Unit,
    onCopy: () -> Unit,
    onReRun: () -> Unit,
    onSettings: () -> Unit,
    onDismiss: () -> Unit,
    onShare: () -> Unit = {},
    sources: List<ExaSource> = emptyList(),
    onOpenSource: (String) -> Unit = {}
) {
    val sheetState: SheetState = rememberModalBottomSheetState(skipPartiallyExpanded = false)
    val colors = MaterialTheme.colorScheme
    var judgeMenu by remember { mutableStateOf(false) }
    val judge = endpoints.firstOrNull { it.id == judgeId } ?: endpoints.firstOrNull()
    val sections = remember(answer) { splitFinalAnswer(answer) }
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        shape = RoundedCornerShape(topStart = 26.dp, topEnd = 26.dp),
        containerColor = colors.surface,
        dragHandle = { SheetHandle() }
    ) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 24.dp)) {
            if (answer.isNotBlank()) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(stringResource(R.string.final_answer_judge, judge?.name ?: stringResource(R.string.judge)), fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                        Text(stringResource(R.string.combined_from_models), color = colors.onSurfaceVariant, fontSize = 12.sp)
                    }
                    Box {
                        TextButton(onClick = { judgeMenu = true }, contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 5.dp, vertical = 5.dp)) { Text(stringResource(R.string.judge), fontSize = 12.sp) }
                        DropdownMenu(expanded = judgeMenu, onDismissRequest = { judgeMenu = false }) {
                            endpoints.forEach { endpoint -> DropdownMenuItem(text = { Text(endpoint.name) }, onClick = { judgeMenu = false; onJudgeSelected(endpoint.id) }) }
                        }
                    }
                    TextButton(onClick = onCopy, contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 7.dp, vertical = 5.dp)) { Text(stringResource(R.string.copy), fontSize = 12.sp) }
                    IconButton(onClick = onShare, modifier = Modifier.size(32.dp)) { Icon(Icons.Default.Share, stringResource(R.string.share_final_answer), tint = colors.onSurfaceVariant, modifier = Modifier.size(16.dp)) }
                    TextButton(onClick = onReRun, contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 7.dp, vertical = 5.dp)) { Text(stringResource(R.string.rerun), fontSize = 12.sp) }
                    IconButton(onClick = onDismiss, modifier = Modifier.size(32.dp)) { Icon(Icons.Default.Close, stringResource(R.string.close), tint = colors.onSurfaceVariant, modifier = Modifier.size(17.dp)) }
                }
                Spacer(Modifier.height(10.dp))
                Column(Modifier.fillMaxWidth().heightIn(max = 460.dp).verticalScroll(rememberScrollState()).padding(bottom = 12.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                    FinalSection(R.string.best_answer, sections["Best answer"].orEmpty().ifBlank { answer }, colors.primary)
                    FinalSection(R.string.where_agree, sections["Where they agree"].orEmpty().ifBlank { stringResource(R.string.no_agreement) }, Color(0xFF53C991))
                    FinalSection(R.string.where_differ, sections["Where they differ"].orEmpty().ifBlank { stringResource(R.string.no_differences) }, Color(0xFFE5A94F))
                    if (sources.isNotEmpty()) CitationSourcesRow(answer, sources, onOpenSource)
                }
            } else {
                Text(stringResource(R.string.combine_answers), fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                Text(stringResource(R.string.choose_api_judge), color = colors.onSurfaceVariant, fontSize = 13.sp, modifier = Modifier.padding(top = 4.dp, bottom = 12.dp))
                if (endpoints.isEmpty()) {
                    Text(stringResource(R.string.add_api_settings), color = colors.onSurfaceVariant, fontSize = 13.sp)
                    Button(onClick = onSettings, modifier = Modifier.padding(top = 10.dp)) { Text(stringResource(R.string.open_settings)) }
                } else {
                    OutlinedButton(onClick = { judgeMenu = true }, modifier = Modifier.fillMaxWidth()) {
                        Text(judge?.name ?: stringResource(R.string.choose_judge_model), Modifier.weight(1f))
                        DropdownMenu(expanded = judgeMenu, onDismissRequest = { judgeMenu = false }) {
                            endpoints.forEach { endpoint ->
                                DropdownMenuItem(text = { Text("${endpoint.name} · ${endpoint.modelId}") }, onClick = { judgeMenu = false; onJudgeSelected(endpoint.id) })
                            }
                        }
                    }
                    Button(onClick = onCombine, enabled = !loading && judge != null, modifier = Modifier.fillMaxWidth().padding(top = 10.dp), shape = RoundedCornerShape(16.dp)) {
                        Text(stringResource(if (loading) R.string.combining else R.string.combine_answers))
                    }
                }
            }
        }
    }
}

@Composable
private fun FinalSection(title: Int, body: String, accent: Color) {
    val colors = MaterialTheme.colorScheme
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(colors.surfaceVariant.copy(alpha = .55f)).border(1.dp, accent.copy(alpha = .32f), RoundedCornerShape(18.dp)).padding(12.dp)) {
        Text(stringResource(title).uppercase(), color = accent, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, letterSpacing = .6.sp)
        MarkdownText(body, Modifier.fillMaxWidth().padding(top = 6.dp))
    }
}

private fun splitFinalAnswer(answer: String): Map<String, String> {
    val headings = listOf("Best answer", "Where they agree", "Where they differ")
    val lines = answer.lines()
    val found = mutableMapOf<String, String>()
    var current: String? = null
    val content = mutableListOf<String>()
    fun save() { current?.let { found[it] = content.joinToString("\n").trim() }; content.clear() }
    lines.forEach { line ->
        val heading = headings.firstOrNull { line.trim().removePrefix("#").trim().equals(it, ignoreCase = true) }
        if (heading != null) { save(); current = heading }
        else if (current != null) content += line
    }
    save()
    return found
}
