package app.notecircle

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import app.notecircle.data.model.NoteDto
import app.notecircle.ui.feed.FeedScreen
import app.notecircle.ui.theme.AmberPrimary
import app.notecircle.ui.theme.NoteCircleTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            NoteCircleTheme {
                val navController = rememberNavController()
                var selectedTab by remember { mutableStateOf(0) }
                val sampleNotes = remember { mutableStateListOf<NoteDto>() }

                Scaffold(
                    modifier = Modifier.fillMaxSize(),
                    bottomBar = {
                        NavigationBar(
                            containerColor = MaterialTheme.colorScheme.surface
                        ) {
                            NavigationBarItem(
                                selected = selectedTab == 0,
                                onClick = {
                                    selectedTab = 0
                                    navController.navigate("feed")
                                },
                                label = { Text("Circle") },
                                icon = { Text("🏠") },
                                colors = NavigationBarItemDefaults.colors(indicatorColor = AmberPrimary.copy(alpha = 0.2f))
                            )
                            NavigationBarItem(
                                selected = selectedTab == 1,
                                onClick = {
                                    selectedTab = 1
                                    navController.navigate("chat")
                                },
                                label = { Text("Chat") },
                                icon = { Text("💬") },
                                colors = NavigationBarItemDefaults.colors(indicatorColor = AmberPrimary.copy(alpha = 0.2f))
                            )
                            NavigationBarItem(
                                selected = selectedTab == 2,
                                onClick = {
                                    selectedTab = 2
                                    navController.navigate("profile")
                                },
                                label = { Text("Profile") },
                                icon = { Text("👤") },
                                colors = NavigationBarItemDefaults.colors(indicatorColor = AmberPrimary.copy(alpha = 0.2f))
                            )
                        }
                    }
                ) { innerPadding ->
                    NavHost(
                        navController = navController,
                        startDestination = "feed",
                        modifier = Modifier.padding(innerPadding)
                    ) {
                        composable("feed") {
                            FeedScreen(
                                notes = sampleNotes,
                                isLoading = false,
                                onRefresh = {},
                                onPostNoteClick = {}
                            )
                        }
                        composable("chat") {
                            Text("Chat Tab - Select Conversation", modifier = Modifier.padding(innerPadding))
                        }
                        composable("profile") {
                            Text("Profile Tab", modifier = Modifier.padding(innerPadding))
                        }
                    }
                }
            }
        }
    }
}
