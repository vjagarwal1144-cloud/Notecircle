package app.notecircle.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val AmberPrimary = Color(0xFFD97706)
val AmberDark = Color(0xFFB45309)
val WarmBackgroundLight = Color(0xFFFAF8F5)
val WarmCardLight = Color(0xFFFFFFFF)
val WarmTextPrimaryLight = Color(0xFF1C1917)
val WarmTextSecondaryLight = Color(0xFF78716C)

val DarkBackground = Color(0xFF131211)
val DarkCard = Color(0xFF1C1A18)
val DarkTextPrimary = Color(0xFFF5F5F4)
val DarkTextSecondary = Color(0xFFA8A29E)

private val LightColorScheme = lightColorScheme(
    primary = AmberPrimary,
    onPrimary = Color.White,
    background = WarmBackgroundLight,
    surface = WarmCardLight,
    onBackground = WarmTextPrimaryLight,
    onSurface = WarmTextPrimaryLight
)

private val DarkColorScheme = darkColorScheme(
    primary = AmberPrimary,
    onPrimary = Color.White,
    background = DarkBackground,
    surface = DarkCard,
    onBackground = DarkTextPrimary,
    onSurface = DarkTextPrimary
)

@Composable
fun NoteCircleTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme
    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}
