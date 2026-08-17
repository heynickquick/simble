package com.simble.gateway

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.simble.gateway.databinding.ActivitySetupBinding
import com.simble.gateway.util.Preferences

class SetupActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySetupBinding
    private val prefs by lazy { Preferences(this) }

    private val qrScanLauncher = registerForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val token = result.data?.getStringExtra("token")
            if (!token.isNullOrBlank()) {
                prefs.deviceToken = token
                prefs.deviceName = android.os.Build.MODEL ?: "Android"
                Toast.makeText(this, "Device paired successfully", Toast.LENGTH_SHORT).show()
                startActivity(Intent(this, MainActivity::class.java))
                finish()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySetupBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.etServer.setText(prefs.serverUrl.ifBlank { "https://simble.unscale.cloud" })
        binding.btnScan.setOnClickListener {
            val server = binding.etServer.text.toString().trim().ifBlank { "https://simble.unscale.cloud" }
            prefs.serverUrl = server
            qrScanLauncher.launch(Intent(this, QrScanActivity::class.java))
        }
        binding.btnManual.setOnClickListener {
            val token = binding.etToken.text.toString().trim()
            if (token.isBlank()) {
                Toast.makeText(this, "Enter a device token", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            prefs.serverUrl = binding.etServer.text.toString().trim().ifBlank { "https://simble.unscale.cloud" }
            prefs.deviceToken = token
            prefs.deviceName = android.os.Build.MODEL ?: "Android"
            startActivity(Intent(this, MainActivity::class.java))
            finish()
        }
    }
}
