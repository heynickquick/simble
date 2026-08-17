package com.simble.gateway

import android.Manifest
import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.simble.gateway.databinding.ActivityMainBinding
import com.simble.gateway.util.Preferences

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private val prefs by lazy { Preferences(this) }

    private val requestPerms = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        val allGranted = results.values.all { it }
        updateStatusUi()
        if (allGranted && prefs.isSetupComplete()) {
            ensureServiceRunning()
        } else {
            Toast.makeText(this, "Permissions required for SMS gateway", Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnSetup.setOnClickListener { startActivity(Intent(this, SetupActivity::class.java)) }
        binding.btnStartStop.setOnClickListener { onStartStopClicked() }
        binding.btnRequestBattery.setOnClickListener { requestBatteryOptimization() }
        binding.btnUnpair.setOnClickListener { unpair() }

        refresh()
    }

    override fun onResume() {
        super.onResume()
        refresh()
    }

    private fun refresh() {
        if (!prefs.isSetupComplete()) {
            startActivity(Intent(this, SetupActivity::class.java))
            finish()
            return
        }
        if (!hasAllPerms()) {
            requestPerms.launch(REQUIRED_PERMS)
        } else {
            ensureServiceRunning()
        }
        updateStatusUi()
    }

    private fun updateStatusUi() {
        binding.tvServer.text = "Server: ${prefs.serverUrl}"
        binding.tvDevice.text = "Device: ${prefs.deviceName}"
        binding.tvToken.text = "Token: ${prefs.deviceToken.take(20)}…"
        binding.tvSent.text = "Messages sent: ${prefs.messagesSent}"
        binding.tvDelivered.text = "Delivered: ${prefs.messagesDelivered}"
        binding.tvFailed.text = "Failed: ${prefs.messagesFailed}"

        val running = isServiceRunning()
        binding.tvService.text = if (running) "Service: RUNNING" else "Service: STOPPED"
        binding.btnStartStop.text = if (running) "Stop service" else "Start service"
    }

    private fun onStartStopClicked() {
        if (isServiceRunning()) {
            stopService(Intent(this, SmsGatewayService::class.java))
        } else {
            ensureServiceRunning()
        }
        refresh()
    }

    private fun ensureServiceRunning() {
        if (isServiceRunning()) return
        val intent = Intent(this, SmsGatewayService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    private fun isServiceRunning(): Boolean {
        val am = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        return am.getRunningServices(Int.MAX_VALUE).any { it.service.className == SmsGatewayService::class.java.name }
    }

    private fun hasAllPerms(): Boolean = REQUIRED_PERMS.all {
        ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED
    }

    private fun requestBatteryOptimization() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
            intent.data = Uri.parse("package:$packageName")
            try { startActivity(intent) } catch (_: Exception) {}
        }
    }

    private fun unpair() {
        stopService(Intent(this, SmsGatewayService::class.java))
        prefs.clear()
        startActivity(Intent(this, SetupActivity::class.java))
        finish()
    }

    companion object {
        val REQUIRED_PERMS = arrayOf(
            Manifest.permission.SEND_SMS,
            Manifest.permission.CAMERA,
            Manifest.permission.POST_NOTIFICATIONS,
            Manifest.permission.READ_PHONE_STATE,
        )
    }
}
