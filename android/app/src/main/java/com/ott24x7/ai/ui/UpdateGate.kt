package com.ott24x7.ai.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.ott24x7.ai.MainActivity
import com.ott24x7.ai.R
import com.ott24x7.ai.data.AppUpdate
import com.ott24x7.ai.data.UpdateDecision
import com.ott24x7.ai.data.UpdateInfo
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Checks version.json once per launch and shows an optional or blocking update prompt. */
@Composable
fun UpdateGate(activity: MainActivity) {
    var info by remember { mutableStateOf<UpdateInfo?>(null) }
    var decision by remember { mutableStateOf(UpdateDecision.NONE) }
    var dismissed by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        val fetched = withContext(Dispatchers.IO) { AppUpdate.fetch(activity.updateManifestUrl(), allowHttp = activity.isDebugBuild()) }
        info = fetched
        decision = AppUpdate.decide(activity.installedVersionCode(), fetched)
    }
    val current = info ?: return
    when (decision) {
        UpdateDecision.FORCED -> FiestaTheme(isSystemInDarkTheme()) { ForcedUpdateScreen(activity, current) }
        UpdateDecision.OPTIONAL -> if (!dismissed) {
            FiestaTheme(isSystemInDarkTheme()) { OptionalUpdateDialog(activity, current) { dismissed = true } }
        }
        UpdateDecision.NONE -> Unit
    }
}

@Composable
private fun OptionalUpdateDialog(activity: MainActivity, info: UpdateInfo, onLater: () -> Unit) {
    var installing by remember { mutableStateOf(false) }
    AlertDialog(
        onDismissRequest = { if (!installing) onLater() },
        title = { Text(stringResource(R.string.update_available_title, info.versionName)) },
        text = {
            Column {
                Text(info.notes.ifBlank { stringResource(R.string.update_default_notes) })
                if (installing) {
                    Spacer(Modifier.height(16.dp))
                    UpdateProgress(activity, info) { installing = false }
                }
            }
        },
        confirmButton = {
            if (!installing) Button(onClick = { installing = true }) { Text(stringResource(R.string.update_now)) }
        },
        dismissButton = {
            if (!installing) TextButton(onClick = onLater) { Text(stringResource(R.string.update_later)) }
        }
    )
}

@Composable
private fun ForcedUpdateScreen(activity: MainActivity, info: UpdateInfo) {
    var installing by remember { mutableStateOf(false) }
    BackHandler { activity.finish() }
    Box(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {}
            .safeDrawingPadding()
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Image(
                painter = painterResource(R.drawable.ott_logo),
                contentDescription = null,
                modifier = Modifier.size(88.dp).clip(RoundedCornerShape(24.dp))
            )
            Text(
                stringResource(R.string.update_required_title),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center
            )
            Text(
                stringResource(R.string.update_required_body, info.versionName),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )
            if (info.notes.isNotBlank()) {
                Text(
                    info.notes,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                        .padding(16.dp),
                    style = MaterialTheme.typography.bodyMedium
                )
            }
            if (installing) {
                UpdateProgress(activity, info) { installing = false }
            } else {
                Button(
                    onClick = { installing = true },
                    modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp),
                    shape = RoundedCornerShape(26.dp)
                ) { Text(stringResource(R.string.update_now)) }
                TextButton(onClick = { activity.openExternal(info.apkUrl) }) {
                    Text(stringResource(R.string.update_in_browser))
                }
            }
        }
    }
}

@Composable
private fun UpdateProgress(activity: MainActivity, info: UpdateInfo, onFailed: () -> Unit) {
    var progress by remember { mutableStateOf(0f) }
    var failed by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(info.apkUrl) {
        scope.launch {
            val apk = activity.updateApkFile()
            val ok = withContext(Dispatchers.IO) {
                runCatching { AppUpdate.download(info.apkUrl, apk) { progress = it } }.isSuccess
            }
            if (ok && activity.installApk(apk)) onFailed() else failed = true
        }
    }
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        if (failed) {
            Text(stringResource(R.string.update_failed), color = MaterialTheme.colorScheme.error, textAlign = TextAlign.Center)
            TextButton(onClick = { activity.openExternal(info.apkUrl); onFailed() }) {
                Text(stringResource(R.string.update_in_browser))
            }
        } else {
            LinearProgressIndicator(progress = { progress }, modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(8.dp))
            Text(stringResource(R.string.update_downloading, (progress * 100).toInt()), style = MaterialTheme.typography.bodySmall)
        }
    }
}
