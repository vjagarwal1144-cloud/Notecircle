package app.notecircle.data.model

import com.google.gson.annotations.SerializedName

data class UserDto(
    val id: String,
    val username: String,
    val displayName: String,
    val email: String? = null,
    val phone: String? = null,
    val avatarUrl: String? = null,
    val bio: String? = null,
    val city: String? = null,
    val workplace: String? = null,
    val isPrivate: Boolean = true,
    val availability: UserAvailabilityDto? = null
)

data class UserAvailabilityDto(
    val code: String,
    val label: String,
    val emoji: String,
    val customStatus: String? = null,
    val strictDnd: Boolean = false,
    val expiresAt: String? = null
)

data class NoteDto(
    val id: String,
    val userId: String,
    val authorUsername: String,
    val authorDisplayName: String,
    val authorAvatarUrl: String? = null,
    val emoji: String,
    val category: String,
    val categoryLabel: String,
    val text: String,
    val audience: String,
    val isDnd: Boolean = false,
    val reactions: List<NoteReactionDto> = emptyList(),
    val replies: List<NoteReplyDto> = emptyList(),
    val expiresAt: String? = null,
    val createdAt: String
)

data class NoteReactionDto(
    val userId: String,
    val username: String,
    val emoji: String,
    val createdAt: String
)

data class NoteReplyDto(
    val id: String,
    val userId: String,
    val username: String,
    val displayName: String,
    val text: String,
    val createdAt: String
)

data class FeedResponse(
    val notes: List<NoteDto>
)

data class ConversationDto(
    val id: String,
    val type: String,
    val title: String? = null,
    val participantIds: List<String>,
    val participants: List<UserDto>,
    val lastMessage: MessageDto? = null,
    val updatedAt: String
)

data class MessageDto(
    val id: String,
    val conversationId: String,
    val senderId: String,
    val senderName: String,
    val text: String,
    val encryptedPayload: String? = null,
    val isDeleted: Boolean = false,
    val reactions: Map<String, String>? = null,
    val createdAt: String
)

data class ConversationsResponse(
    val conversations: List<ConversationDto>
)

data class MessagesResponse(
    val messages: List<MessageDto>
)

data class PostNoteRequest(
    val emoji: String,
    val category: String,
    val categoryLabel: String,
    val text: String,
    val audience: String,
    val durationHours: Int = 24
)

data class SendMessageRequest(
    val text: String,
    val encryptedPayload: String
)
