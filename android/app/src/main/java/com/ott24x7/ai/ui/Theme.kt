package com.ott24x7.ai.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val FiestaAccent = Color(0xFF7C5CFF)
val FiestaDarkBackground = Color(0xFF0B0D11)
val FiestaDarkSurface = Color(0xFF12151B)
val FiestaDarkBorder = Color(0xFF1F2430)
val FiestaDarkText = Color(0xFFECEEF2)
val FiestaMuted = Color(0xFF8A93A6)

private val DarkColors = darkColorScheme(
    primary = FiestaAccent,
    onPrimary = Color.White,
    background = FiestaDarkBackground,
    onBackground = FiestaDarkText,
    surface = FiestaDarkSurface,
    onSurface = FiestaDarkText,
    surfaceVariant = Color(0xFF191D26),
    onSurfaceVariant = FiestaMuted,
    outline = FiestaDarkBorder
)

private val LightColors = lightColorScheme(
    primary = FiestaAccent,
    onPrimary = Color.White,
    background = Color(0xFFF7F7FA),
    onBackground = Color(0xFF171820),
    surface = Color.White,
    onSurface = Color(0xFF171820),
    surfaceVariant = Color(0xFFF0EFF5),
    onSurfaceVariant = Color(0xFF676B78),
    outline = Color(0xFFE3E2EA)
)

@Composable
fun FiestaTheme(dark: Boolean, accent: Color = FiestaAccent, content: @Composable () -> Unit) {
    val base = if (dark) DarkColors else LightColors
    val colors = base.copy(primary = accent, secondary = accent, tertiary = accent)
    MaterialTheme(colorScheme = colors) {
        Surface(color = colors.background, contentColor = colors.onBackground) {
            content()
        }
    }
}
