package app.notecircle.data.repository

import app.notecircle.data.api.NoteCircleApiService
import app.notecircle.data.model.FeedResponse
import app.notecircle.data.model.NoteDto
import app.notecircle.data.model.PostNoteRequest
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

class NoteCircleRepository(
    private val baseUrl: String,
    private val authTokenProvider: () -> String?
) {
    private val api: NoteCircleApiService by lazy {
        val client = OkHttpClient.Builder()
            .addInterceptor { chain ->
                val request = chain.request().newBuilder()
                val token = authTokenProvider()
                if (!token.isNullOrEmpty()) {
                    request.addHeader("Authorization", "Bearer $token")
                }
                chain.proceed(request.build())
            }
            .addInterceptor(HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            })
            .build()

        Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(NoteCircleApiService::class.java)
    }

    fun getFeed(): Flow<Result<List<NoteDto>>> = flow {
        try {
            val response = api.getFeed()
            if (response.isSuccessful && response.body() != null) {
                emit(Result.success(response.body()!!.notes))
            } else {
                emit(Result.failure(Exception("Failed to load feed: ${response.code()}")))
            }
        } catch (e: Exception) {
            emit(Result.failure(e))
        }
    }

    suspend fun postNote(
        emoji: String,
        category: String,
        categoryLabel: String,
        text: String,
        audience: String,
        durationHours: Int = 24
    ): Result<NoteDto> {
        return try {
            val req = PostNoteRequest(emoji, category, categoryLabel, text, audience, durationHours)
            val response = api.postNote(req)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Note post failed with HTTP ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
