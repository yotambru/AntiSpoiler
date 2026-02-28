// Anti-Spoiler Extension - Background Service Worker

// Keep service worker alive by listening to messages
chrome.runtime.onConnect.addListener((port) => {
  console.log('Connected to extension');
  port.onDisconnect.addListener(() => {
    console.log('Disconnected from extension');
  });
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('Anti-Spoiler Extension installed');
  checkAndShowPopup();
  checkForNewGame(); // Check for new games on install
});

// Check on browser startup
chrome.runtime.onStartup.addListener(() => {
  checkAndShowPopup();
  checkForNewGame(); // Also check for new games on startup
});

// Clear badge; enabled state is controlled by the popup toggle
function checkAndShowPopup() {
  chrome.action.setBadgeText({ text: '' });
}

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle ping to check if background script is ready
  if (request.action === 'ping') {
    sendResponse({ success: true, ready: true });
    return false;
  }
  
  if (request.action === 'getStats') {
    // Could implement stats tracking here
    sendResponse({ success: true });
    return false;
  }
  
  // Handle popup window close - check if we should show it again
  if (request.action === 'popupClosed') {
    checkAndShowPopup();
  }
  
  // Handle new game - reset to default state (blocking enabled)
  if (request.action === 'setNewGame') {
    const newGame = request.game || {};
    const gameDate = newGame.date || new Date().toISOString().split('T')[0];
    
    chrome.storage.local.set({
      currentGame: {
        ...newGame,
        watched: false
      },
      lastGameDate: gameDate,
      seenLastGame: false,
      enabled: true // Blocking always on
    }, () => {
      chrome.action.setBadgeText({ text: '' });
      sendResponse({ success: true });
    });
    return true; // Keep channel open for async response
  }
  
  // Handle marking game as watched (blocking stays on)
  if (request.action === 'markGameWatched') {
    chrome.storage.local.get(['currentGame'], (result) => {
      const currentGame = result.currentGame;
      if (currentGame) {
        const gameDate = currentGame.date || new Date().toISOString().split('T')[0];
        chrome.storage.local.set({
          currentGame: {
            ...currentGame,
            watched: true
          },
          lastGameDate: gameDate,
          seenLastGame: true,
          enabled: true // Blocking always on
        }, () => {
          chrome.action.setBadgeText({ text: '' });
          sendResponse({ success: true });
        });
      } else {
        chrome.storage.local.set({
          seenLastGame: true,
          enabled: true // Blocking always on
        }, () => {
          chrome.action.setBadgeText({ text: '' });
          sendResponse({ success: true });
        });
      }
    });
    return true; // Keep channel open for async response
  }
  
  // Handle finding similar/related keywords
  if (request.action === 'findSimilarKeywords') {
    const keyword = request.keyword;
    if (!keyword) {
      sendResponse({ success: false, error: 'No keyword provided' });
      return false;
    }
    
    // Use async/await pattern to ensure response is sent
    (async () => {
      try {
        const similarKeywords = await findSimilarKeywords(keyword);
        sendResponse({ success: true, similarKeywords });
      } catch (error) {
        console.error('Error finding similar keywords:', error);
        sendResponse({ success: false, error: error.message || 'Unknown error' });
      }
    })();
    
    return true; // Keep channel open for async response
  }
  
  // Return false for unhandled messages
  return false;
});

// Choose Wikidata search language from keyword script so e.g. "ביבי" -> he, "Bibi" -> en
function getSearchLanguageForKeyword(keyword) {
  if (!keyword || typeof keyword !== 'string') return 'en';
  const t = keyword.trim();
  if (!t.length) return 'en';
  // Hebrew (including optional niqqud)
  if (/[\u0590-\u05FF]/.test(t)) return 'he';
  // Arabic
  if (/[\u0600-\u06FF]/.test(t)) return 'ar';
  // Cyrillic
  if (/[\u0400-\u04FF]/.test(t)) return 'ru';
  // Thai
  if (/[\u0E00-\u0E7F]/.test(t)) return 'th';
  // Japanese (Hiragana/Katakana)
  if (/[\u3040-\u30FF]/.test(t)) return 'ja';
  // Chinese (CJK)
  if (/[\u4E00-\u9FFF]/.test(t)) return 'zh';
  // Korean Hangul
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(t)) return 'ko';
  // Default Latin etc. -> English
  return 'en';
}

// Function to find similar/related keywords using Wikidata API
async function findSimilarKeywords(keyword) {
  console.log('[Background] Starting search for:', keyword);
  const similarKeywords = [];
  const seenKeywords = new Set([keyword.toLowerCase()]);
  
  try {
    // Step 1: Search for the entity in Wikidata
    // API expects a single language for search; pick from script so "ביבי" uses he, "Bibi" uses en
    const searchLang = getSearchLanguageForKeyword(keyword);
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(keyword)}&language=${searchLang}&format=json&origin=*`;
    
    console.log('[Background] Searching Wikidata:', searchUrl);
    const searchResponse = await fetch(searchUrl);
    
    if (!searchResponse.ok) {
      console.warn('[Background] Wikidata search failed with status:', searchResponse.status);
      return getSimpleFallbackKeywords(keyword);
    }
    
    const searchData = await searchResponse.json();
    console.log('[Background] Wikidata search results:', searchData);
    
    if (!searchData.search || searchData.search.length === 0) {
      console.log('[Background] No Wikidata results found');
      return getSimpleFallbackKeywords(keyword);
    }
    
    const entityId = searchData.search[0].id;
    console.log('[Background] Found entity ID:', entityId);
    
    // Step 2: Get entity details (labels & aliases in all languages)
    const entityUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${entityId}&format=json&origin=*&props=labels|aliases`;
    
    const entityResponse = await fetch(entityUrl);
    if (!entityResponse.ok) {
      console.warn('[Background] Failed to get entity details');
      return getSimpleFallbackKeywords(keyword);
    }
    
    const entityData = await entityResponse.json();
    const entity = entityData.entities?.[entityId];
    
    if (!entity) {
      return getSimpleFallbackKeywords(keyword);
    }
    
    const labels = entity.labels || {};
    console.log('[Background] Entity labels:', labels);
    
    // Reason used for name variants so popup adds them to the same basket
    const REASON_EN = 'English name';
    const REASON_OTHER = 'Alias/nickname';
    
    function addNameVariant(keyword, reason) {
      if (!keyword || typeof keyword !== 'string') return;
      const k = keyword.trim();
      if (!k) return;
      const lower = k.toLowerCase();
      if (seenKeywords.has(lower)) return;
      seenKeywords.add(lower);
      similarKeywords.push({ keyword: k, reason });
    }
    
    // Only source language + English (no other languages)
    const sourceLang = searchLang;
    const allowedLangs = new Set([ 'en', sourceLang ]);
    
    // Labels: only source language and English
    const labelEntries = Object.entries(labels || {});
    for (const [lang, obj] of labelEntries) {
      if (!allowedLangs.has(lang)) continue;
      const value = obj?.value;
      if (value && typeof value === 'string') {
        const reason = lang === 'en' ? REASON_EN : REASON_OTHER;
        addNameVariant(value, reason);
        if (lang === 'en') {
          addNameVariant(value.toLowerCase(), REASON_EN);
          addNameVariant(value.replace(/\b\w/g, c => c.toUpperCase()), REASON_EN);
        }
      }
    }
    
    // Aliases: only source language and English
    const aliasesByLang = entity.aliases || {};
    for (const [lang, aliasList] of Object.entries(aliasesByLang)) {
      if (!allowedLangs.has(lang) || !Array.isArray(aliasList)) continue;
      const labelForLang = labels?.[lang]?.value || '';
      const lastName = labelForLang ? labelForLang.trim().split(/\s+/).pop() : '';
      const isEnglish = lang === 'en';
      for (const item of aliasList) {
        const aliasValue = item?.value;
        if (!aliasValue || typeof aliasValue !== 'string') continue;
        const a = aliasValue.trim();
        addNameVariant(a, REASON_OTHER);
        if (isEnglish) {
          addNameVariant(a.toLowerCase(), REASON_OTHER);
          addNameVariant(a.replace(/\b\w/g, c => c.toUpperCase()), REASON_OTHER);
        }
        if (lastName && a !== labelForLang) {
          const composite = a + ' ' + lastName;
          addNameVariant(composite, REASON_OTHER);
          if (isEnglish) {
            addNameVariant(composite.toLowerCase(), REASON_OTHER);
            addNameVariant(composite.replace(/\b\w/g, c => c.toUpperCase()), REASON_OTHER);
          }
        }
      }
    }
    
    // Only name variants (labels + aliases). No related entities (position, residence, team, etc.).
    // Filter out less relevant suggestions (e.g. job titles, places, roles from other code paths)
    const LESS_RELEVANT_REASONS = new Set([
      'Position', 'Work location', 'Residence', 'Office held', 'Place',
      'Occupation', 'Profession', 'Role', 'Title', 'Location', 'City', 'Country', 'Employer'
    ]);
    const filtered = similarKeywords.filter(
      (s) => !s.reason || !LESS_RELEVANT_REASONS.has(s.reason.trim())
    );
    // Limit to most relevant: cap total suggestions
    const MAX_SUGGESTIONS = 10;
    const limited = filtered.slice(0, MAX_SUGGESTIONS);

    console.log('[Background] Total keywords found:', similarKeywords.length, 'after filter:', limited.length);

    // If we found some keywords, return them
    if (limited.length > 0) {
      console.log('[Background] Returning keywords:', limited);
      return limited;
    }
    
    // No name variants from Wikidata - try simple fallback only (no AI - don't invent translations)
    console.log('[Background] No name variants from Wikidata, trying simple fallback only');
    const simpleFallback = getSimpleFallbackKeywords(keyword);
    return simpleFallback;
    
  } catch (error) {
    console.error('[Background] Error in findSimilarKeywords:', error);
    // Only try simple fallback - do not use AI to invent translations
    try {
      return getSimpleFallbackKeywords(keyword);
    } catch (e) {
      return [];
    }
  }
}

// No hardcoded name list - all variants come from Wikidata (any language + English).
function getSimpleFallbackKeywords(keyword) {
  return [];
}

// Fallback function using OpenAI API (if API key is configured)
async function findSimilarKeywordsWithAI(keyword) {
  console.log('[Background] Trying AI fallback for:', keyword);
  
  // First try simple fallback
  const simpleFallback = getSimpleFallbackKeywords(keyword);
  if (simpleFallback.length > 0) {
    console.log('[Background] Found simple fallback keywords:', simpleFallback);
    return simpleFallback;
  }
  
  try {
    // Check if OpenAI API key is configured
    const result = await new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(['openaiApiKey'], (data) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(data);
          }
        });
      } catch (e) {
        reject(e);
      }
    });
    
    const apiKey = result?.openaiApiKey;
    if (!apiKey || apiKey.trim() === '') {
      // No API key, return empty array
      console.log('[Background] No OpenAI API key configured');
      // Try simple fallback even if no API key
      return [];
    }
    
    console.log('[Background] OpenAI API key found, making request');
    
    // Use OpenAI API to find similar keywords
    console.log('[Background] Making OpenAI API request');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that finds related keywords and terms. Return only a JSON array of objects with "keyword" and "reason" fields. Be concise and relevant.'
          },
          {
            role: 'user',
            content: `Find 3-5 related keywords or terms for "${keyword}" that might appear in news articles or social media. Include related people, organizations, teams, places, or events. Return as JSON array: [{"keyword": "term", "reason": "why it's related"}]`
          }
        ],
        max_tokens: 200,
        temperature: 0.7
      })
    });
    
    console.log('[Background] OpenAI API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.warn('[Background] OpenAI API error response:', errorText);
      
      // Try to parse error details
      let errorMessage = 'OpenAI API request failed';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorMessage;
      } catch (e) {
        // If we can't parse, use status text
        errorMessage = `OpenAI API error: ${response.status} ${response.statusText}`;
      }
      
      console.warn('[Background] OpenAI API error (non-critical):', errorMessage);
      // Don't throw - return empty array so simple fallback can be used
      // This is not a critical error - the simple fallback will handle it
      return [];
    }
    
    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    console.log('[Background] OpenAI response content:', content);
    
    if (content) {
      try {
        const keywords = JSON.parse(content);
        console.log('[Background] Parsed keywords:', keywords);
        return Array.isArray(keywords) ? keywords : [];
      } catch (e) {
        console.error('[Background] Failed to parse OpenAI response:', e);
        // If parsing fails, try to extract keywords from text
        return [];
      }
    }
    
    console.log('[Background] No content in OpenAI response');
    return [];
  } catch (error) {
    // Log as warning, not error, since we have fallback
    console.warn('[Background] Error in findSimilarKeywordsWithAI (non-critical):', error.message || error);
    // On error, return empty array - the calling function will handle fallback
    return []; // Always return an array, even on error
  }
}

// Function to check if there's a new game that should trigger blocking
function checkForNewGame() {
  chrome.storage.local.get(['currentGame', 'lastGameDate'], (result) => {
    if (!result) result = {};
    const currentGame = result.currentGame;
    const lastGameDate = result.lastGameDate;
    const today = new Date().toISOString().split('T')[0];
    
    // If there's a current game with a date that has passed, it's a new game
    if (currentGame && currentGame.date) {
      const gameDate = currentGame.date;
      
      // If game date is today or in the past, and user hasn't watched it, enable blocking
      if (gameDate <= today && !currentGame.watched) {
        // Update lastGameDate to the game date if it's newer
        if (!lastGameDate || gameDate > lastGameDate) {
          chrome.storage.local.set({
            lastGameDate: gameDate,
            seenLastGame: false,
            enabled: true
          }, () => {
            chrome.action.setBadgeText({ text: '' });
          });
        }
      }
    }
  });
}

// Check for new games periodically (every hour)
setInterval(() => {
  checkForNewGame();
}, 60 * 60 * 1000); // Check every hour

// Check for new games on startup
checkForNewGame();

// Listen for storage changes to detect new games
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.currentGame) {
    const newGame = changes.currentGame.newValue;
    const oldGame = changes.currentGame.oldValue;
    
    // If it's a new game (different ID or date), reset to default state
    if (newGame && (!oldGame || newGame.id !== oldGame.id || newGame.date !== oldGame.date)) {
      const gameDate = newGame.date || new Date().toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      
      // If game date is today or in the past, enable blocking
      if (gameDate <= today) {
        chrome.storage.local.set({
          lastGameDate: gameDate,
          seenLastGame: false,
          enabled: true
        }, () => {
          chrome.action.setBadgeText({ text: '' });
        });
      }
    }
  }
  
  // Also handle lastGameDate changes (when game date is updated)
  if (namespace === 'local' && changes.lastGameDate) {
    const newDate = changes.lastGameDate.newValue;
    const oldDate = changes.lastGameDate.oldValue;
    
    // If date changed, reset to default state
    if (newDate && newDate !== oldDate) {
      chrome.storage.local.set({
        seenLastGame: false,
        enabled: true
      }, () => {
        chrome.action.setBadgeText({ text: '' });
      });
    }
  }
});
