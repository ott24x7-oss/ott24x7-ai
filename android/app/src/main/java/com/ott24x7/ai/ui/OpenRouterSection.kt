package com.ott24x7.ai.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ott24x7.ai.R
import com.ott24x7.ai.data.ApiEndpoint
import com.ott24x7.ai.data.OpenRouter
import com.ott24x7.ai.data.OpenRouterModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Settings block: paste an OpenRouter key, fetch its free models and add them to Compare with one tap. */
@Composable
fun OpenRouterSection(
    apiKey: String,
    endpoints: List<ApiEndpoint>,
    onApiKey: (String) -> Unit,
    onEndpointsChanged: (List<ApiEndpoint>) -> Unit,
    onOpenUrl: (String) -> Unit
) {
    val context = LocalContext.current
    val colors = MaterialTheme.colorScheme
    val scope = rememberCoroutineScope()
    var draftKey by remember { mutableStateOf(apiKey) }
    var models by remember { mutableStateOf(emptyList<OpenRouterModel>()) }
    var busy by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf("") }
    val addedIds = endpoints.filter(OpenRouter::isOpenRouterEndpoint).map(ApiEndpoint::modelId).toSet()

    fun fetch(key: String) {
        busy = true
        message = context.getString(R.string.openrouter_checking)
        scope.launch {
            val keyOk = withContext(Dispatchers.IO) { OpenRouter.verifyKey(key) }
            if (!keyOk) {
                message = context.getString(R.string.openrouter_key_invalid)
                busy = false
                return@launch
            }
            onApiKey(key)
            onEndpointsChanged(OpenRouter.withKey(endpoints, key))
            val fetched = withContext(Dispatchers.IO) { runCatching { OpenRouter.fetchFreeModels() } }
            fetched.onSuccess {
                models = it
                message = context.getString(R.string.openrouter_found, it.size)
            }.onFailure { message = context.getString(R.string.openrouter_fetch_failed) }
            busy = false
        }
    }

    LaunchedEffect(Unit) { if (apiKey.isNotBlank() && models.isEmpty()) fetch(apiKey) }

    Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(stringResource(R.string.openrouter_hint), fontSize = 12.sp, color = colors.onSurfaceVariant)
        OutlinedTextField(
            value = draftKey,
            onValueChange = { draftKey = it.trim() },
            modifier = Modifier.fillMaxWidth(),
            label = { Text(stringResource(R.string.openrouter_key)) },
            placeholder = { Text("sk-or-v1-…") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password)
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedButton(onClick = { fetch(draftKey) }, enabled = draftKey.isNotBlank() && !busy, modifier = Modifier.weight(1f)) {
                Text(stringResource(if (busy) R.string.testing else R.string.openrouter_fetch))
            }
            TextButton(onClick = { onOpenUrl("https://openrouter.ai/keys") }) { Text(stringResource(R.string.openrouter_get_key)) }
        }
        if (message.isNotBlank()) Text(message, fontSize = 12.sp, color = colors.primary)
        if (models.isNotEmpty()) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(stringResource(R.string.openrouter_added, addedIds.size), fontSize = 12.sp, color = colors.onSurfaceVariant)
                if (addedIds.isNotEmpty()) TextButton(onClick = { onEndpointsChanged(endpoints.filterNot(OpenRouter::isOpenRouterEndpoint)) }) {
                    Text(stringResource(R.string.openrouter_remove_all))
                }
            }
            models.forEach { model ->
                val added = model.id in addedIds
                Row(
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 48.dp)
                        .clickable {
                            onEndpointsChanged(
                                if (added) endpoints.filterNot { it.id == OpenRouter.endpointId(model.id) }
                                else endpoints + OpenRouter.endpointFor(model, draftKey.ifBlank { apiKey })
                            )
                        },
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Checkbox(checked = added, onCheckedChange = null, modifier = Modifier.padding(end = 10.dp))
                    Column(Modifier.weight(1f)) {
                        Text(model.name, fontSize = 14.sp)
                        Text(model.id, fontSize = 11.sp, color = colors.onSurfaceVariant)
                    }
                    Text(stringResource(R.string.openrouter_free), fontSize = 11.sp, color = colors.primary)
                }
            }
        }
    }
}
