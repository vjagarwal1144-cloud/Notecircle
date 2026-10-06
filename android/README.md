# NoteCircle — Native Android Architecture Specification

This repository contains the complete specification and Jetpack Compose implementation for the native Android application of **NoteCircle**. Both the Android application and the Responsive Web application share the exact same backend API, database schemas, authentication system, privacy validation rules, temporary note expiration engine, and private chat.

## 1. Android Technology Stack
- **Language**: Kotlin 2.0+
- **UI Toolkit**: Jetpack Compose + Material 3 (Calm, Minimal, Low-pressure Theme)
- **Architecture**: Modern Android Architecture (UI Layer -> ViewModel -> Repository -> Network)
- **Dependency Injection**: Hilt (Dagger)
- **Concurrency**: Kotlin Coroutines + StateFlow / SharedFlow
- **Networking**: Retrofit 2 + OkHttp 4 with Persistent Token Authenticator
- **Push Notifications**: Firebase Cloud Messaging (FCM)
- **Local Storage**: EncryptedSharedPreferences (Jetpack Security) + Room (offline cache strictly for own draft notes)

## 2. API Contract & Endpoints
The Android app communicates with the same NoteCircle backend:
- `POST /api/auth/login` - Authenticate with email/username and password
- `POST /api/auth/register` - Create private account
- `GET /api/notes/feed` - Fetch temporary notes from approved connections
- `POST /api/notes` - Post note (10-second fast composer)
- `POST /api/notes/{id}/reaction` - React with emoji
- `POST /api/notes/{id}/reply` - Reply to private note
- `GET /api/chat/conversations` - List active conversations with participants' live status notes
- `GET /api/chat/conversations/{id}/messages` - Fetch encrypted messages
- `POST /api/chat/conversations/{id}/messages` - Send message with DND status checking
- `GET /api/connections/pending` - Incoming & outgoing follow requests
- `POST /api/connections/requests/{id}/accept` - Approve follow request
- `GET /api/users/profile/{username}` - Retrieve privacy-redacted profile

## 3. Directory Structure
```
android/
├── app/
│   ├── src/main/java/app/notecircle/
│   │   ├── data/
│   │   │   ├── api/NoteCircleApiService.kt
│   │   │   ├── model/NoteDto.kt
│   │   │   └── repository/NotesRepository.kt
│   │   ├── ui/
│   │   │   ├── theme/Theme.kt
│   │   │   ├── feed/FeedScreen.kt
│   │   │   ├── feed/FeedViewModel.kt
│   │   │   ├── composer/NoteComposerScreen.kt
│   │   │   ├── chat/ChatScreen.kt
│   │   │   └── profile/ProfileScreen.kt
│   │   └── MainActivity.kt
└── build.gradle.kts
```

## 4. Key Kotlin Implementation: NoteCircleApiService.kt
```kotlin
package app.notecircle.data.api

import retrofit2.http.*

interface NoteCircleApiService {
    @GET("api/notes/feed")
    suspend fun getFeed(): FeedResponse

    @POST("api/notes")
    suspend fun createNote(@Body request: CreateNoteRequest): NoteResponse

    @POST("api/notes/{id}/reaction")
    suspend fun toggleReaction(@Path("id") noteId: String, @Body body: Map<String, String>): NoteResponse

    @GET("api/chat/conversations")
    suspend fun getConversations(): ConversationsResponse

    @POST("api/chat/conversations/{id}/messages")
    suspend fun sendMessage(
        @Path("id") convId: String,
        @Body message: SendMessageRequest
    ): MessageResponse

    @GET("api/connections/pending")
    suspend fun getPendingRequests(): PendingRequestsResponse
}
```

## 5. Jetpack Compose NoteCard Component
```kotlin
@Composable
fun NoteCard(
    note: Note,
    onReact: (String) -> Unit,
    onReply: (String) -> Unit,
    onAuthorClick: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                AsyncImage(
                    model = note.author.avatarUrl,
                    contentDescription = note.author.displayName,
                    modifier = Modifier.size(40.dp).clip(CircleShape)
                )
                Spacer(modifier = Modifier.width(10.dp))
                Column {
                    Text(text = note.author.displayName, style = MaterialTheme.typography.titleSmall)
                    Text(text = "@${note.author.username} · Expires ${note.expiresAt}", style = MaterialTheme.typography.bodySmall)
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(text = "${note.emoji} ${note.categoryLabel}", style = MaterialTheme.typography.labelMedium)
            Text(text = note.text, style = MaterialTheme.typography.bodyMedium)
        }
    }
}
```
