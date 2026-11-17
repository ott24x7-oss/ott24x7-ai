package com.ott24x7.ai.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.unit.dp
import com.ott24x7.ai.MainActivity
import com.ott24x7.ai.R
import com.ott24x7.ai.data.LoginCheckResult
import com.ott24x7.ai.data.PanelCatalog
import com.ott24x7.ai.data.PanelDefinition
import com.ott24x7.ai.data.PanelLoginStatus
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull

@Composable
fun AccountsScreen(
    activity: MainActivity,
    initialPanelId: String? = null,
    googleSignInPanel: String? = null,
    onOpenGoogleSignIn: (PanelDefinition) -> Unit,
    onBack: () -> Unit,
    onSignInOpened: () -> Unit
) {
    val settings = activity.secureSettings
    val panels = PanelCatalog.webPanels
    val statuses = remember {
        mutableStateMapOf<String, PanelLoginStatus>().apply {
            panels.forEach { panel -> this[panel.id] = settings.panelLoginStatus(panel.id) }
        }
    }
    val scope = rememberCoroutineScope()
    var signInPanelId by remember { mutableStateOf<String?>(initialPanelId) }
    var finishingSignIn by remember { mutableStateOf(false) }

    fun saveResult(panel: PanelDefinition, result: LoginCheckResult) {
        val status = when (result) {
            LoginCheckResult.SIGNED_IN -> PanelLoginStatus.SIGNED_IN
            LoginCheckResult.SIGNED_OUT -> PanelLoginStatus.SIGNED_OUT
            LoginCheckResult.UNKNOWN -> PanelLoginStatus.UNKNOWN
        }
        statuses[panel.id] = status
        settings.savePanelLoginStatus(panel.id, status)
    }

    fun checkPanels() {
        scope.launch {
            panels.chunked(3).forEach { batch ->
                batch.forEach { statuses[it.id] = PanelLoginStatus.CHECKING }
                coroutineScope {
                    batch.map { panel ->
                        async {
                            panel to (withTimeoutOrNull(5_000) { activity.checkPanelLogin(panel) } ?: LoginCheckResult.UNKNOWN)
                        }
                    }.awaitAll().forEach { (panel, result) -> saveResult(panel, result) }
                }
            }
        }
    }

    fun closeSignIn(panel: PanelDefinition) {
        if (finishingSignIn) return
        finishingSignIn = true
        statuses[panel.id] = PanelLoginStatus.CHECKING
        scope.launch {
            val result = withTimeoutOrNull(5_000) { activity.checkPanelLogin(panel) } ?: LoginCheckResult.UNKNOWN
            saveResult(panel, result)
            activity.restorePanelWebView(panel)
            finishingSignIn = false
            signInPanelId = null
        }
    }

    LaunchedEffect(Unit) {
        if (initialPanelId == null) checkPanels()
    }

    val signInPanel = panels.firstOrNull { it.id == signInPanelId }
    if (signInPanel != null) {
        BackHandler(enabled = !finishingSignIn) { closeSignIn(signInPanel) }
        PanelLoginScreen(
            activity = activity,
            panel = signInPanel,
            googleSignInRequired = googleSignInPanel == signInPanel.id,
            onOpenGoogleSignIn = { onOpenGoogleSignIn(signInPanel) },
            onDone = { closeSignIn(signInPanel) },
            onReload = { activity.preparePanelLogin(signInPanel).reload() }
        )
        return
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            Row(
                Modifier.fillMaxWidth().height(58.dp).padding(horizontal = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBack, modifier = Modifier.size(42.dp)) {
                    Icon(Icons.Default.ArrowBack, stringResource(R.string.back), tint = MaterialTheme.colorScheme.onSurface)
                }
                Column(Modifier.weight(1f).padding(start = 4.dp)) {
                    Text(stringResource(R.string.accounts_title), fontSize = 21.sp, fontWeight = FontWeight.SemiBold)
                    Text(stringResource(R.string.accounts_subtitle), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
                }
            }
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(10.dp),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp, vertical = 10.dp)
            ) {
                items(panels, key = { it.id }) { panel ->
                    AccountRow(
                        panel = panel,
                        status = statuses[panel.id] ?: PanelLoginStatus.UNKNOWN,
                        onSignIn = {
                            onSignInOpened()
                            signInPanelId = panel.id
                        },
                        onSignOut = {
                            activity.clearPanelLogin(panel)
                            statuses[panel.id] = PanelLoginStatus.SIGNED_OUT
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun AccountRow(
    panel: PanelDefinition,
    status: PanelLoginStatus,
    onSignIn: () -> Unit,
    onSignOut: () -> Unit
) {
    val colors = MaterialTheme.colorScheme
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        border = BorderStroke(1.dp, colors.outline),
        colors = CardDefaults.cardColors(containerColor = colors.surface)
    ) {
        Column(Modifier.fillMaxWidth().padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                ModelAvatar(panel.name, Modifier.size(42.dp))
                Column(Modifier.weight(1f).padding(start = 11.dp)) {
                    Text(panel.name, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                    Text(panel.description, color = colors.onSurfaceVariant, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                LoginStatusChip(status)
            }
            Row(Modifier.fillMaxWidth().padding(top = 12.dp), horizontalArrangement = Arrangement.End, verticalAlignment = Alignment.CenterVertically) {
                if (status == PanelLoginStatus.SIGNED_IN) TextButton(onClick = onSignOut) { Text(stringResource(R.string.sign_out)) }
                Button(onClick = onSignIn) { Text(stringResource(if (status == PanelLoginStatus.SIGNED_IN) R.string.open else R.string.sign_in)) }
            }
        }
    }
}

@Composable
private fun LoginStatusChip(status: PanelLoginStatus) {
    val colors = MaterialTheme.colorScheme
    val (label, tint) = when (status) {
        PanelLoginStatus.SIGNED_IN -> R.string.signed_in to Color(0xFF53C991)
        PanelLoginStatus.SIGNED_OUT -> R.string.not_signed_in to Color(0xFFE5A94F)
        PanelLoginStatus.CHECKING -> R.string.checking to colors.primary
        PanelLoginStatus.UNKNOWN -> R.string.unknown to colors.onSurfaceVariant
    }
    Surface(color = tint.copy(alpha = 0.14f), shape = CircleShape) {
        Text(stringResource(label), color = tint, fontSize = 10.sp, modifier = Modifier.padding(horizontal = 9.dp, vertical = 5.dp))
    }
}

@Composable
private fun PanelLoginScreen(
    activity: MainActivity,
    panel: PanelDefinition,
    googleSignInRequired: Boolean,
    onOpenGoogleSignIn: () -> Unit,
    onDone: () -> Unit,
    onReload: () -> Unit
) {
    val colors = MaterialTheme.colorScheme
    Column(Modifier.fillMaxSize().background(colors.background)) {
        Row(
            Modifier.fillMaxWidth().height(58.dp).padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onDone, modifier = Modifier.size(42.dp)) {
                Icon(Icons.Default.ArrowBack, stringResource(R.string.back), tint = colors.onSurface)
            }
            Text(panel.name, Modifier.weight(1f).padding(start = 4.dp), fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
            IconButton(onClick = onReload, modifier = Modifier.size(42.dp)) {
                Icon(Icons.Default.Refresh, stringResource(R.string.reload), tint = colors.onSurfaceVariant)
            }
            TextButton(onClick = onDone) { Text(stringResource(R.string.done)) }
        }
        Box(Modifier.fillMaxSize()) {
            AndroidView(
                factory = { activity.preparePanelLogin(panel) },
                modifier = Modifier.fillMaxSize(),
                update = { it.onResume() }
            )
            if (googleSignInRequired) {
                Column(
                    Modifier.align(Alignment.BottomCenter).fillMaxWidth().background(Color(0xE612151B)).padding(14.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(stringResource(R.string.google_sign_in_note), color = Color(0xFFECEEF2), fontSize = 12.sp)
                    TextButton(onClick = onOpenGoogleSignIn) { Text(stringResource(R.string.continue_chrome_sign_in), color = Color(0xFFB9A9FF), fontSize = 12.sp) }
                }
            }
        }
    }
}
