package hk.mm7lab.watchcat

import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.wear.compose.material.Colors
import androidx.wear.compose.material.MaterialTheme

@Composable
fun WatchTheme(content: @Composable () -> Unit) =
    MaterialTheme(colors = Colors(primary = Color(0xFFF3A35C), secondary = WaterBlue), content = content)
