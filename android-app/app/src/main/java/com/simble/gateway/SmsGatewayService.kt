package com.simble.gateway

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.telephony.SmsManager
import android.util.Log
import com.simble.gateway.api.SimbleApi
import com.simble.gateway.util.Preferences
import kotlinx.coroutines.*

class SmsGatewayService : Service() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val api by lazy { SimbleApi(this) }
    private val prefs by lazy { Preferences(this) }
    private var wakeLock: PowerManager.WakeLock? = null
    private var pollJob: Job? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        startForeground(NOTIF_ID, buildNotification("Starting…", 0, 0, 0))
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (pollJob?.isActive == true) return START_STICKY
        startPolling()
        return START_STICKY
    }

    private fun startPolling() {
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "simble:poller").apply {
            setReferenceCounted(false)
            acquire(60L * 60L * 1000L * 24L * 1000L) // 24h max
        }
        pollJob = scope.launch {
            while (isActive) {
                try {
                    pollOnce()
                } catch (e: Exception) {
                    Log.e(TAG, "poll error", e)
                }
                delay(5_000)
            }
        }
    }

    private suspend fun pollOnce() {
        val msg = api.poll(prefs.deviceToken, timeoutSec = 35) ?: return
        val to = msg.optString("to")
        val text = msg.optString("message")
        val id = msg.optString("id")
        if (to.isBlank() || text.isBlank() || id.isBlank()) return

        val (ok, error) = sendSms(to, text)
        if (ok) {
            api.reportDelivery(prefs.deviceToken, id, "delivered")
            prefs.messagesSent += 1
            prefs.messagesDelivered += 1
        } else {
            api.reportDelivery(prefs.deviceToken, id, "failed", error)
            prefs.messagesSent += 1
            prefs.messagesFailed += 1
        }
        updateNotification(prefs.messagesSent, prefs.messagesDelivered, prefs.messagesFailed)
    }

    private fun sendSms(to: String, text: String): Pair<Boolean, String?> {
        return try {
            val sm = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                getSystemService(SmsManager::class.java)
            } else {
                @Suppress("DEPRECATION")
                SmsManager.getDefault()
            }
            sm.sendTextMessage(to, null, text, null, null)
            true to null
        } catch (e: Exception) {
            false to e.message
        }
    }

    private fun buildNotification(text: String, sent: Int, delivered: Int, failed: Int): Notification {
        val nm = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "Simble Gateway", NotificationManager.IMPORTANCE_LOW)
            channel.description = "Simble SMS gateway"
            nm.createNotificationChannel(channel)
        }
        val pi = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        return builder
            .setContentTitle("Simble Gateway")
            .setContentText("$text · sent $sent / delivered $delivered / failed $failed")
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setContentIntent(pi)
            .setOngoing(true)
            .build()
    }

    private fun updateNotification(sent: Int, delivered: Int, failed: Int) {
        val nm = getSystemService(NotificationManager::class.java)
        nm.notify(NOTIF_ID, buildNotification("Running", sent, delivered, failed))
    }

    override fun onDestroy() {
        pollJob?.cancel()
        wakeLock?.release()
        scope.cancel()
        super.onDestroy()
    }

    companion object {
        private const val TAG = "SmsGatewayService"
        private const val CHANNEL_ID = "simble_gateway"
        private const val NOTIF_ID = 1
    }
}
