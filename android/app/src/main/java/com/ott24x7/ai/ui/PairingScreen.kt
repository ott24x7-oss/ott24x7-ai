package com.ott24x7.ai.ui

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import com.ott24x7.ai.MainActivity
import com.ott24x7.ai.R
import com.ott24x7.ai.data.ExportProvider
import com.ott24x7.ai.data.PairedPc
import com.ott24x7.ai.data.PairingApproval
import com.ott24x7.ai.data.PairingClient
import com.ott24x7.ai.data.PairingExpiredException
import com.ott24x7.ai.data.PairingProtocolException
import com.ott24x7.ai.data.PairingQrParser
import com.ott24x7.ai.data.PairingRejectedException
import com.ott24x7.ai.data.PairingSessionResult
import com.ott24x7.ai.data.PairingUnavailableException
import com.ott24x7.ai.data.ProviderExport
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import java.text.DateFormat
import java.util.Date

private enum class PairingState { IDLE, CONNECTING, APPROVAL, IMPORT, SUCCESS, ERROR }

@Composable
fun PairingScreen(
    activity: MainActivity,
    onBack: () -> Unit,
    onImported: (List<com.ott24x7.ai.data.ApiEndpoint>) -> Unit,
    onForgotten: (String) -> Unit
) {
    val context = LocalContext.current
    val settings = activity.secureSettings
    val scope = rememberCoroutineScope()
    val client = remember { PairingClient(settings.pairingIdentity()) }
    var state by remember { mutableStateOf(PairingState.IDLE) }
    var paste by remember { mutableStateOf("") }
    var approval by remember { mutableStateOf<PairingApproval?>(null) }
    var pending by remember { mutableStateOf<PairingSessionResult?>(null) }
    var selectedProviders by remember { mutableStateOf<Set<String>>(emptySet()) }
    var pairedPcs by remember { mutableStateOf(settings.pairedPcs()) }
    var errorMessage by remember { mutableStateOf<Int?>(null) }
    var forgetTarget by remember { mutableStateOf<PairedPc?>(null) }
    var runningJob by remember { mutableStateOf<Job?>(null) }

    fun showImport(result: PairingSessionResult) {
        pending = result
        selectedProviders = result.export.providers.filter { it.supported }.map(ExportProvider::id).toSet()
        state = PairingState.IMPORT
        pairedPcs = settings.pairedPcs()
    }

    fun startPairing(payload: String) {
        runningJob?.cancel()
        runningJob = scope.launch {
            state = PairingState.CONNECTING
            approval = null
            errorMessage = null
            try {
                val qr = PairingQrParser.parse(payload)
                state = PairingState.CONNECTING
                val result = client.pair(
                    qr,
                    onApproval = { next ->
                        approval = next
                        state = PairingState.APPROVAL
                    },
                    onApproved = { settings.savePairedPc(it); pairedPcs = settings.pairedPcs() }
                )
                settings.savePairedPc(result.pairedPc)
                showImport(result)
            } catch (error: PairingRejectedException) {
                state = PairingState.ERROR
                errorMessage = R.string.pc_pair_rejected
            } catch (error: PairingExpiredException) {
                state = PairingState.ERROR
                errorMessage = R.string.pc_pair_expired
            } catch (error: PairingUnavailableException) {
                state = PairingState.ERROR
                errorMessage = R.string.pc_pair_unavailable
            } catch (_: IllegalArgumentException) {
                state = PairingState.ERROR
                errorMessage = R.string.pc_pair_invalid_code
            } catch (_: PairingProtocolException) {
                state = PairingState.ERROR
                errorMessage = R.string.pc_pair_failed
            } catch (_: Exception) {
                state = PairingState.ERROR
                errorMessage = R.string.pc_pair_failed
            }
        }
    }

    val scanLauncher = rememberLauncherForActivityResult(ScanContract()) { result ->
        result.contents?.let(::startPairing)
    }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) scanLauncher.launch(ScanOptions().setPrompt(context.getString(R.string.pc_scan_hint)).setBeepEnabled(false))
    }

    fun scan() {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            scanLauncher.launch(ScanOptions().setPrompt(context.getString(R.string.pc_scan_hint)).setBeepEnabled(false))
        } else {
            permissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    fun importSelected() {
        val result = pending ?: return
        val selected = result.export.providers.filter { it.id in selectedProviders }
        val endpoints = selected.flatMap { it.toEndpoints(result.pairedPc.deviceId) }
        settings.savePairedPc(result.pairedPc.copy(importedProviderIds = selected.map(ExportProvider::id)))
        onImported(endpoints)
        pairedPcs = settings.pairedPcs()
        pending = null
        state = PairingState.SUCCESS
    }

    fun sync(pc: PairedPc) {
        runningJob?.cancel()
        runningJob = scope.launch {
            state = PairingState.CONNECTING
            errorMessage = null
            try {
                val result = client.sync(pc)
                settings.savePairedPc(result.pairedPc)
                showImport(result)
            } catch (_: PairingUnavailableException) {
                state = PairingState.ERROR
                errorMessage = R.string.pc_pair_unavailable
            } catch (_: Exception) {
                state = PairingState.ERROR
                errorMessage = R.string.pc_pair_sync_failed
            }
        }
    }

    BackHandler {
        if (state == PairingState.IDLE || state == PairingState.SUCCESS || state == PairingState.ERROR) {
            onBack()
        } else {
            runningJob?.cancel()
            pending = null
            approval = null
            state = PairingState.IDLE
        }
    }

    Scaffold(containerColor = MaterialTheme.colorScheme.background) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            Row(Modifier.fillMaxWidth().height(58.dp).padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack, modifier = Modifier.size(42.dp)) { Icon(Icons.Default.ArrowBack, stringResource(R.string.back)) }
                Column(Modifier.weight(1f).padding(start = 4.dp)) {
                    Text(stringResource(R.string.pc_pair_title), fontSize = 21.sp, fontWeight = FontWeight.SemiBold)
                    Text(stringResource(R.string.pc_pair_subtitle), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
                }
            }
            when (state) {
                PairingState.IDLE, PairingState.SUCCESS, PairingState.ERROR -> {
                    LazyColumn(
                        Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp, vertical = 10.dp)
                    ) {
                        if (state == PairingState.SUCCESS) item { PairingSuccessCard() }
                        if (state == PairingState.ERROR) item {
                            PairingErrorCard(errorMessage ?: R.string.pc_pair_failed, onRetry = { state = PairingState.IDLE })
                        }
                        item {
                            PairingHowToCard(
                                paste = paste,
                                onPaste = { paste = it },
                                onScan = ::scan,
                                onPastePairing = { startPairing(paste) }
                            )
                        }
                        if (pairedPcs.isNotEmpty()) {
                            item { Text(stringResource(R.string.pc_paired_title), fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 8.dp)) }
                            items(pairedPcs, key = { it.id }) { pc ->
                                PairedPcCard(pc, onSync = { sync(pc) }, onForget = { forgetTarget = pc })
                            }
                        }
                    }
                }
                PairingState.CONNECTING -> PairingProgress(stringResource(R.string.pc_pair_connecting))
                PairingState.APPROVAL -> PairingApprovalCard(approval)
                PairingState.IMPORT -> pending?.let { result ->
                    ProviderImportScreen(
                        export = result.export,
                        selected = selectedProviders,
                        onToggle = { id -> selectedProviders = if (id in selectedProviders) selectedProviders - id else selectedProviders + id },
                        onImport = ::importSelected
                    )
                }
            }
        }
    }

    forgetTarget?.let { pc ->
        AlertDialog(
            onDismissRequest = { forgetTarget = null },
            title = { Text(stringResource(R.string.pc_forget_title)) },
            text = { Text(stringResource(R.string.pc_forget_body, pc.name)) },
            confirmButton = {
                TextButton(onClick = {
                    settings.forgetPairedPc(pc.id)
                    onForgotten(pc.deviceId)
                    pairedPcs = settings.pairedPcs()
                    forgetTarget = null
                }) { Text(stringResource(R.string.pc_forget)) }
            },
            dismissButton = { TextButton(onClick = { forgetTarget = null }) { Text(stringResource(R.string.cancel)) } }
        )
    }
}

@Composable
private fun PairingHowToCard(paste: String, onPaste: (String) -> Unit, onScan: () -> Unit, onPastePairing: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    Card(shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = colors.surface), border = BorderStroke(1.dp, colors.outline)) {
        Column(Modifier.padding(16.dp)) {
            Text(stringResource(R.string.pc_scan_title), fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
            Text(stringResource(R.string.pc_scan_body), Modifier.padding(top = 5.dp), color = colors.onSurfaceVariant, fontSize = 12.sp, lineHeight = 18.sp)
            Button(onClick = onScan, Modifier.fillMaxWidth().padding(top = 13.dp)) {
                Icon(Icons.Default.QrCodeScanner, null, modifier = Modifier.size(18.dp)); Spacer(Modifier.size(7.dp)); Text(stringResource(R.string.pc_scan_qr))
            }
            Text(stringResource(R.string.pc_paste_title), fontWeight = FontWeight.Medium, modifier = Modifier.padding(top = 17.dp))
            OutlinedTextField(paste, onPaste, Modifier.fillMaxWidth().padding(top = 7.dp), minLines = 3, maxLines = 6, placeholder = { Text(stringResource(R.string.pc_paste_hint)) })
            OutlinedButton(onClick = onPastePairing, enabled = paste.isNotBlank(), modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) { Text(stringResource(R.string.pc_use_code)) }
        }
    }
}

@Composable
private fun PairingProgress(label: String) {
    Column(Modifier.fillMaxSize().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        CircularProgressIndicator()
        Text(label, Modifier.padding(top = 16.dp), fontSize = 15.sp, textAlign = TextAlign.Center)
    }
}

@Composable
private fun PairingApprovalCard(approval: PairingApproval?) {
    val colors = MaterialTheme.colorScheme
    Column(Modifier.fillMaxSize().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Text(stringResource(R.string.pc_approve_title), fontSize = 20.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
        Text(stringResource(R.string.pc_approve_body), Modifier.padding(top = 8.dp), color = colors.onSurfaceVariant, textAlign = TextAlign.Center)
        Text(approval?.verificationCode.orEmpty(), Modifier.padding(top = 20.dp), color = colors.primary, fontSize = 42.sp, fontWeight = FontWeight.Bold, letterSpacing = 5.sp)
        Text(stringResource(R.string.pc_approve_wait), Modifier.padding(top = 8.dp), color = colors.onSurfaceVariant, fontSize = 12.sp)
    }
}

@Composable
private fun PairingSuccessCard() {
    Card(shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
        Row(Modifier.fillMaxWidth().padding(15.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.CheckCircle, null, tint = MaterialTheme.colorScheme.primary)
            Text(stringResource(R.string.pc_pair_success), Modifier.padding(start = 10.dp), fontWeight = FontWeight.Medium)
        }
    }
}

@Composable
private fun PairingErrorCard(message: Int, onRetry: () -> Unit) {
    Card(shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) {
        Column(Modifier.padding(15.dp)) {
            Text(stringResource(message), color = MaterialTheme.colorScheme.onErrorContainer)
            TextButton(onClick = onRetry) { Text(stringResource(R.string.try_again)) }
        }
    }
}

@Composable
private fun ProviderImportScreen(export: ProviderExport, selected: Set<String>, onToggle: (String) -> Unit, onImport: () -> Unit) {
    val supported = export.providers.filter { it.supported }
    val unsupported = export.providers.filterNot { it.supported }
    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 10.dp)) {
        Text(stringResource(R.string.pc_import_title), fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
        Text(stringResource(R.string.pc_import_body), Modifier.padding(top = 5.dp), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
        LazyColumn(Modifier.weight(1f).padding(top = 10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(supported, key = { it.id }) { provider -> ProviderImportRow(provider, provider.id in selected, onToggle) }
            if (unsupported.isNotEmpty()) {
                item { Text(stringResource(R.string.pc_not_supported), Modifier.padding(top = 10.dp), fontWeight = FontWeight.SemiBold) }
                items(unsupported, key = { it.id }) { provider ->
                    Text(provider.name, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp, modifier = Modifier.padding(horizontal = 12.dp))
                }
            }
        }
        Button(onClick = onImport, enabled = selected.isNotEmpty(), modifier = Modifier.fillMaxWidth().padding(top = 10.dp)) { Text(stringResource(R.string.pc_import_button)) }
    }
}

@Composable
private fun ProviderImportRow(provider: ExportProvider, checked: Boolean, onToggle: (String) -> Unit) {
    Card(onClick = { onToggle(provider.id) }, shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline)) {
        Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Checkbox(checked, { onToggle(provider.id) })
            Column(Modifier.weight(1f).padding(start = 4.dp)) {
                Text(provider.name, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(pluralStringResource(R.plurals.pc_provider_models, provider.models.size, provider.models.size), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
            }
            Text(stringResource(if (provider.hasKey) R.string.pc_key_available else R.string.pc_no_key), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp)
        }
    }
}

@Composable
private fun PairedPcCard(pc: PairedPc, onSync: () -> Unit, onForget: () -> Unit) {
    Card(shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline)) {
        Column(Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(pc.name, fontWeight = FontWeight.SemiBold)
                    Text(stringResource(R.string.pc_last_sync, DateFormat.getDateTimeInstance().format(Date(pc.lastSyncAt))), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
                }
                IconButton(onClick = onForget) { Icon(Icons.Default.Delete, stringResource(R.string.pc_forget)) }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                TextButton(onClick = onSync) { Icon(Icons.Default.Refresh, null, modifier = Modifier.size(16.dp)); Spacer(Modifier.size(5.dp)); Text(stringResource(R.string.pc_sync_again)) }
            }
        }
    }
}
