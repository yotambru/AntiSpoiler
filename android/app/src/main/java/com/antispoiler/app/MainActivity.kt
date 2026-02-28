package com.antispoiler.app

import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Bundle
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import java.util.HashSet

class MainActivity : AppCompatActivity() {

    private lateinit var serviceStatusText: TextView
    private lateinit var enableServiceButton: Button
    private lateinit var seenGameCheckbox: CheckBox
    private lateinit var keywordInput: EditText
    private lateinit var addKeywordButton: Button
    private lateinit var keywordsRecyclerView: RecyclerView
    
    private lateinit var prefs: SharedPreferences
    private val keywordsAdapter = KeywordsAdapter(mutableListOf()) { keyword ->
        removeKeyword(keyword)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        prefs = getSharedPreferences("AntiSpoiler", Context.MODE_PRIVATE)
        
        setupUI()
        loadSettings()
        checkServiceStatus()
    }

    private fun setupUI() {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 32, 32, 32)
        }

        // Service status
        serviceStatusText = TextView(this).apply {
            text = "בודק מצב שירות..."
            textSize = 18f
            setPadding(0, 0, 0, 24)
        }
        layout.addView(serviceStatusText)

        // Enable service button
        enableServiceButton = Button(this).apply {
            text = "הפעל שירות נגישות"
            setOnClickListener {
                openAccessibilitySettings()
            }
        }
        layout.addView(enableServiceButton)

        // Seen game checkbox
        seenGameCheckbox = CheckBox(this).apply {
            text = "האם צפית במשחק האחרון?"
            setOnCheckedChangeListener { _, isChecked ->
                saveSeenGame(isChecked)
            }
        }
        layout.addView(seenGameCheckbox)

        // Keyword input section
        val keywordSection = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(0, 32, 0, 0)
        }

        val keywordLabel = TextView(this).apply {
            text = "מילות מפתח מותאמות אישית:"
            textSize = 16f
            setPadding(0, 0, 0, 16)
        }
        keywordSection.addView(keywordLabel)

        val inputLayout = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
        }

        keywordInput = EditText(this).apply {
            hint = "לדוגמה: בנימין נתניהו, ביבי..."
            layoutParams = LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.WRAP_CONTENT,
                1f
            )
        }
        inputLayout.addView(keywordInput)

        addKeywordButton = Button(this).apply {
            text = "הוסף"
            setOnClickListener {
                addKeyword()
            }
        }
        inputLayout.addView(addKeywordButton)

        keywordSection.addView(inputLayout)

        // Keywords list
        keywordsRecyclerView = RecyclerView(this).apply {
            layoutManager = LinearLayoutManager(this@MainActivity)
            adapter = keywordsAdapter
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                setMargins(0, 16, 0, 0)
            }
        }
        keywordSection.addView(keywordsRecyclerView)

        layout.addView(keywordSection)

        setContentView(layout)
    }

    private fun checkServiceStatus() {
        val accessibilityManager = getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager
        val enabledServices = accessibilityManager.getEnabledAccessibilityServiceList(
            AccessibilityServiceInfo.FEEDBACK_ALL_MASK
        )
        
        val isServiceEnabled = enabledServices.any { 
            it.resolveInfo.serviceInfo.packageName == packageName &&
            it.resolveInfo.serviceInfo.name == AntiSpoilerAccessibilityService::class.java.name
        }
        
        if (isServiceEnabled) {
            serviceStatusText.text = "שירות נגישות מופעל ✅"
            enableServiceButton.text = "פתח הגדרות נגישות"
        } else {
            serviceStatusText.text = "שירות נגישות כבוי ❌"
            enableServiceButton.text = "הפעל שירות נגישות"
        }
    }

    private fun openAccessibilitySettings() {
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
        startActivity(intent)
        Toast.makeText(this, "אנא הפעל את Anti-Spoiler בהגדרות נגישות", Toast.LENGTH_LONG).show()
    }

    private fun loadSettings() {
        // Load seen game status
        val seenLastGame = prefs.getBoolean("seenLastGame", false)
        seenGameCheckbox.isChecked = seenLastGame
        
        // Update enabled state based on seen game
        val enabled = !seenLastGame
        prefs.edit().putBoolean("enabled", enabled).apply()
        
        // Load keywords
        val customKeywords = prefs.getStringSet("customKeywords", emptySet()) ?: emptySet()
        keywordsAdapter.updateKeywords(customKeywords.toList())
    }

    private fun saveSeenGame(seen: Boolean) {
        prefs.edit()
            .putBoolean("seenLastGame", seen)
            .putBoolean("enabled", !seen)
            .apply()
        
        // Restart service to apply changes
        Toast.makeText(this, "הגדרות נשמרו", Toast.LENGTH_SHORT).show()
    }

    private fun addKeyword() {
        val keyword = keywordInput.text.toString().trim()
        if (keyword.isEmpty()) {
            Toast.makeText(this, "אנא הזן מילת מפתח", Toast.LENGTH_SHORT).show()
            return
        }
        
        val customKeywords = HashSet(prefs.getStringSet("customKeywords", emptySet()) ?: emptySet())
        
        // Check if keyword already exists (case-insensitive)
        val keywordLower = keyword.lowercase()
        if (customKeywords.any { it.lowercase() == keywordLower }) {
            Toast.makeText(this, "מילת המפתח כבר קיימת", Toast.LENGTH_SHORT).show()
            return
        }
        
        customKeywords.add(keyword)
        prefs.edit().putStringSet("customKeywords", customKeywords).apply()
        
        keywordInput.text.clear()
        keywordsAdapter.updateKeywords(customKeywords.toList())
        Toast.makeText(this, "מילת מפתח נוספה", Toast.LENGTH_SHORT).show()
    }

    private fun removeKeyword(keyword: String) {
        val customKeywords = HashSet(prefs.getStringSet("customKeywords", emptySet()) ?: emptySet())
        customKeywords.remove(keyword)
        prefs.edit().putStringSet("customKeywords", customKeywords).apply()
        keywordsAdapter.updateKeywords(customKeywords.toList())
        Toast.makeText(this, "מילת מפתח הוסרה", Toast.LENGTH_SHORT).show()
    }

    override fun onResume() {
        super.onResume()
        checkServiceStatus()
    }
}
