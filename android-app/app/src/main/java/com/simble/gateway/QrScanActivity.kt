package com.simble.gateway

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import com.simble.gateway.databinding.ActivityQrScanBinding

class QrScanActivity : AppCompatActivity() {

    private lateinit var binding: ActivityQrScanBinding

    private val scanLauncher = registerForActivityResult(ScanContract()) { result ->
        if (result.contents == null) {
            Toast.makeText(this, "Scan cancelled", Toast.LENGTH_SHORT).show()
            finish()
            return@registerForActivityResult
        }
        val raw = result.contents
        // Accept either "sim_xxxxx" or a URL containing the token
        val token = when {
            raw.startsWith("sim_") -> raw
            raw.contains("token=") -> raw.substringAfter("token=").substringBefore("&")
            raw.contains("/") -> raw.substringAfterLast("/")
            else -> raw
        }
        if (token.startsWith("sim_") && token.length > 20) {
            val data = Intent().putExtra("token", token)
            setResult(Activity.RESULT_OK, data)
        } else {
            Toast.makeText(this, "Invalid QR: $raw", Toast.LENGTH_LONG).show()
        }
        finish()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityQrScanBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnCancel.setOnClickListener { finish() }

        // Auto-start the scanner
        val opts = ScanOptions().setOrientationLocked(false).setBeepEnabled(true).setBarcodeImageEnabled(false)
        scanLauncher.launch(opts)
    }
}
