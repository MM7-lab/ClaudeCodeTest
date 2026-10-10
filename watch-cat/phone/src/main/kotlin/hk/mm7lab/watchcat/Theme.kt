package hk.mm7lab.watchcat

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Orange = Color(0xFFE88A3A)

private val Light = lightColorScheme(
    primary = Orange, onPrimary = Color.White,
    secondary = Color(0xFF2D8FC4), onSecondary = Color.White,
    background = Color(0xFFFFF8F0), surface = Color(0xFFFFF8F0),
    surfaceVariant = Color(0xFFF6E8D8), surfaceContainer = Color(0xFFF8EDE1),
)
private val Dark = darkColorScheme(
    primary = Color(0xFFF3A35C), onPrimary = Color(0xFF2B1600),
    secondary = WaterBlue, onSecondary = Color(0xFF00222F),
    background = Color(0xFF15161C), surface = Color(0xFF15161C),
    surfaceVariant = Color(0xFF242733), surfaceContainer = Color(0xFF1D1F27),
)

@Composable
fun PhoneTheme(content: @Composable () -> Unit) =
    MaterialTheme(colorScheme = if (isSystemInDarkTheme()) Dark else Light, content = content)
