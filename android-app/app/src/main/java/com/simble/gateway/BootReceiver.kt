package com.simble.gateway

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import com.simble.gateway.util.Preferences

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val prefs = Preferences(context)
        if (!prefs.isSetupComplete()) return
        val svc = Intent(context, SmsGatewayService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(svc)
        } else {
            context.startService(svc)
        }
    }
}
