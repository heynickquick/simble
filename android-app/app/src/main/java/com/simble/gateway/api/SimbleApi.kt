package com.simble.gateway.api

import android.content.Context
import com.simble.gateway.util.Preferences
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class SimbleApi(private val ctx: Context) {
    private val prefs by lazy { Preferences(ctx) }

    private suspend fun http(method: String, path: String, body: JSONObject? = null, timeoutSec: Int = 30): JSONObject? =
        withContext(Dispatchers.IO) {
            val base = prefs.serverUrl.trimEnd('/')
            val url = URL("$base$path")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = method
                connectTimeout = 10_000
                readTimeout = timeoutSec * 1000
                doInput = true
                if (body != null) {
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                }
            }
            try {
                if (body != null) {
                    conn.outputStream.use { it.write(body.toString().toByteArray()) }
                }
                if (conn.responseCode in 200..299) {
                    val text = conn.inputStream.bufferedReader().use { it.readText() }
                    if (text.isBlank()) null else JSONObject(text)
                } else null
            } catch (e: Exception) {
                null
            } finally {
                conn.disconnect()
            }
        }

    /** Long-poll for the next queued message. Returns null on timeout. */
    suspend fun poll(deviceToken: String, timeoutSec: Int = 35): JSONObject? =
        http("GET", "/devices/$deviceToken/poll", null, timeoutSec)

    /** Report delivery status for a message. */
    suspend fun reportDelivery(deviceToken: String, messageId: String, status: String, error: String? = null) {
        val body = JSONObject().put("status", status)
        if (error != null) body.put("error", error)
        http("POST", "/devices/$deviceToken/messages/$messageId/report", body)
    }

    /** Heartbeat to keep device marked online. */
    suspend fun heartbeat(deviceToken: String, batteryLevel: Int? = null) {
        val body = JSONObject()
        if (batteryLevel != null) body.put("batteryLevel", batteryLevel)
        body.put("networkType", "wifi")
        http("POST", "/devices/$deviceToken/heartbeat", body)
    }
}
