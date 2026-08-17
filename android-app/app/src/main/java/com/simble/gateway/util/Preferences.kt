package com.simble.gateway.util

import android.content.Context
import android.content.SharedPreferences

class Preferences(ctx: Context) {
    private val sp: SharedPreferences = ctx.getSharedPreferences("simble_prefs", Context.MODE_PRIVATE)

    var serverUrl: String
        get() = sp.getString("server_url", "") ?: ""
        set(v) { sp.edit().putString("server_url", v).apply() }

    var deviceToken: String
        get() = sp.getString("device_token", "") ?: ""
        set(v) { sp.edit().putString("device_token", v).apply() }

    var deviceName: String
        get() = sp.getString("device_name", "") ?: ""
        set(v) { sp.edit().putString("device_name", v).apply() }

    var messagesSent: Int
        get() = sp.getInt("messages_sent", 0)
        set(v) { sp.edit().putInt("messages_sent", v).apply() }

    var messagesDelivered: Int
        get() = sp.getInt("messages_delivered", 0)
        set(v) { sp.edit().putInt("messages_delivered", v).apply() }

    var messagesFailed: Int
        get() = sp.getInt("messages_failed", 0)
        set(v) { sp.edit().putInt("messages_failed", v).apply() }

    fun isSetupComplete(): Boolean = deviceToken.startsWith("sim_") && deviceToken.length > 20

    fun clear() {
        sp.edit().clear().apply()
    }
}
