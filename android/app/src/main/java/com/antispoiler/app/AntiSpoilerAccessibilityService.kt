package com.antispoiler.app

import android.accessibilityservice.AccessibilityService
import android.graphics.PixelFormat
import android.graphics.Rect
import android.view.Gravity
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.FrameLayout
import android.content.Context
import android.content.SharedPreferences
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat

class AntiSpoilerAccessibilityService : AccessibilityService() {

    private lateinit var windowManager: WindowManager
    private val overlays = mutableMapOf<String, View>()
    private var keywords = mutableListOf<String>()
    private var isEnabled = true
    private var lastGameDate: String? = null

    // Default keywords (same as content.js) - empty by default, user adds their own
    private val defaultKeywords = emptyList<String>()

    override fun onServiceConnected() {
        super.onServiceConnected()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        loadSettings()
    }

    private fun loadSettings() {
        val prefs = getSharedPreferences("AntiSpoiler", Context.MODE_PRIVATE)
        isEnabled = prefs.getBoolean("enabled", true)
        lastGameDate = prefs.getString("lastGameDate", "2025-01-09")
        
        // Load keywords
        val customKeywords = prefs.getStringSet("customKeywords", emptySet()) ?: emptySet()
        keywords = (defaultKeywords + customKeywords).toMutableList()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (!isEnabled) {
            clearOverlays()
            return
        }
        
        event ?: return
        
        // Reload settings periodically (every 10 events to avoid overhead)
        if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            loadSettings()
        }
        
        // Only process content change events
        when (event.eventType) {
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED,
            AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED,
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
                // Clear existing overlays for this window
                clearOverlays()
                
                // Get root node and traverse
                val rootNode = rootInActiveWindow ?: return
                traverseAndFilter(rootNode)
            }
        }
    }

    private fun traverseAndFilter(node: AccessibilityNodeInfo) {
        try {
            // Check if node has text
            val text = node.text?.toString() ?: ""
            val contentDescription = node.contentDescription?.toString() ?: ""
            
            // Combine text sources
            val fullText = "$text $contentDescription".trim()
            
            if (fullText.isNotEmpty()) {
                // Check if text contains keywords (case-insensitive)
                val lowerText = fullText.lowercase()
                val containsKeyword = keywords.any { keyword ->
                    lowerText.contains(keyword.lowercase())
                }
                
                if (containsKeyword) {
                    // Get bounds of this node
                    val bounds = Rect()
                    node.getBoundsInWindow(bounds)
                    
                    // Only show overlay if bounds are valid and visible
                    if (bounds.isValid && bounds.width() > 0 && bounds.height() > 0 && node.isVisibleToUser) {
                        // Create unique ID for this overlay based on position and text
                        val overlayId = "${bounds.left}_${bounds.top}_${bounds.width()}_${bounds.height()}"
                        showOverlay(bounds, overlayId)
                    }
                }
            }
            
            // Traverse children
            for (i in 0 until node.childCount) {
                val child = node.getChild(i)
                child?.let {
                    traverseAndFilter(it)
                    it.recycle()
                }
            }
        } catch (e: Exception) {
            // Ignore errors and continue
        }
    }

    private fun showOverlay(bounds: Rect, overlayId: String) {
        // Skip if overlay already exists for this ID
        if (overlays.containsKey(overlayId)) return
        
        try {
            // Ensure minimum size
            val width = bounds.width().coerceAtLeast(10)
            val height = bounds.height().coerceAtLeast(10)
            
            // Create overlay view with gradient background (similar to CSS)
            val overlayView = FrameLayout(this).apply {
                layoutParams = ViewGroup.LayoutParams(width, height)
                
                // Create gradient drawable (same colors as CSS)
                background = GradientDrawable(
                    GradientDrawable.Orientation.TL_BR,
                    intArrayOf(
                        Color.parseColor("#667eea"),
                        Color.parseColor("#764ba2")
                    )
                ).apply {
                    cornerRadius = 12f
                    alpha = (0.85 * 255).toInt()
                }
                
                // Add blur effect if possible (API 31+)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    setRenderEffect(android.graphics.RenderEffect.createBlurEffect(
                        20f, 20f, android.graphics.Shader.TileMode.CLAMP
                    ))
                }
            }
            
            // Create window parameters
            val params = WindowManager.LayoutParams(
                width,
                height,
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY
                } else {
                    @Suppress("DEPRECATION")
                    WindowManager.LayoutParams.TYPE_SYSTEM_OVERLAY
                },
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                        WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                        WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
                PixelFormat.TRANSLUCENT
            ).apply {
                gravity = Gravity.TOP or Gravity.START
                x = bounds.left
                y = bounds.top
            }
            
            // Add overlay to window manager
            windowManager.addView(overlayView, params)
            overlays[overlayId] = overlayView
            
        } catch (e: Exception) {
            // Ignore errors (might be duplicate or invalid bounds)
        }
    }

    private fun clearOverlays() {
        overlays.values.forEach { view ->
            try {
                windowManager.removeView(view)
            } catch (e: Exception) {
                // Ignore errors
            }
        }
        overlays.clear()
    }

    override fun onInterrupt() {
        clearOverlays()
    }

    override fun onDestroy() {
        super.onDestroy()
        clearOverlays()
    }
}
