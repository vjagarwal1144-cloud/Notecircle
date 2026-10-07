package app.notecircle.data.api

import app.notecircle.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface NoteCircleApiService {
    @GET("api/notes/feed")
    suspend fun getFeed(): Response<FeedResponse>

    @POST("api/notes")
    suspend fun postNote(@Body req: PostNoteRequest): Response<NoteDto>

    @POST("api/notes/{id}/reaction")
    suspend fun toggleReaction(
        @Path("id") noteId: String,
        @Body body: Map<String, String>
    ): Response<Map<String, Any>>

    @POST("api/notes/{id}/reply")
    suspend fun addReply(
        @Path("id") noteId: String,
        @Body body: Map<String, String>
    ): Response<Map<String, Any>>

    @GET("api/chat/conversations")
    suspend fun getConversations(): Response<ConversationsResponse>

    @GET("api/chat/conversations/{id}/messages")
    suspend fun getMessages(@Path("id") convId: String): Response<MessagesResponse>

    @POST("api/chat/conversations/{id}/messages")
    suspend fun sendMessage(
        @Path("id") convId: String,
        @Body req: SendMessageRequest
    ): Response<Map<String, Any>>

    @GET("api/auth/me")
    suspend fun getMe(): Response<Map<String, UserDto>>

    @POST("api/auth/login")
    suspend fun login(@Body body: Map<String, String>): Response<Map<String, Any>>
}
