// Anti-Spoiler Extension - Popup Script

// Feature flag: set to true to enable dynamic blocking UI in next release
const DYNAMIC_BLOCKING_ENABLED = false;

document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('closeBtn');
  const blockingToggle = document.getElementById('blockingToggle');
  const newKeywordInput = document.getElementById('newKeywordInput');
  const addKeywordBtn = document.getElementById('addKeywordBtn');
  const findSimilarBtn = document.getElementById('findSimilarBtn');
  const keywordsList = document.getElementById('keywordsList');
  const suggestionsContainer = document.getElementById('suggestionsContainer');
  const addKeywordContainer = document.querySelector('.add-keyword-container');
  const openaiApiKeyInput = document.getElementById('openaiApiKeyInput');
  const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
  
  // Load blocking (enabled) state and wire toggle
  chrome.storage.local.get(['enabled'], (result) => {
    const enabled = result.enabled !== false;
    blockingToggle.checked = enabled;
  });
  blockingToggle.addEventListener('change', () => {
    const enabled = blockingToggle.checked;
    chrome.storage.local.set({ enabled }, () => {
      notifyContentScriptReloadKeywords();
    });
  });
  
  // Debounce timer for keyword suggestions
  let suggestionTimer = null;
  
  // Load API key on page load
  chrome.storage.local.get(['openaiApiKey'], (result) => {
    if (result.openaiApiKey && openaiApiKeyInput) {
      openaiApiKeyInput.value = result.openaiApiKey;
    }
  });
  
  // Handle API key save
  if (saveApiKeyBtn) saveApiKeyBtn.addEventListener('click', () => {
    const apiKey = (openaiApiKeyInput && openaiApiKeyInput.value.trim()) || '';
    chrome.storage.local.set({ openaiApiKey: apiKey }, () => {
      // Show feedback
      const originalText = saveApiKeyBtn.textContent;
      saveApiKeyBtn.textContent = 'Saved!';
      saveApiKeyBtn.style.background = 'rgba(76, 175, 80, 0.8)';
      setTimeout(() => {
        saveApiKeyBtn.textContent = originalText;
        saveApiKeyBtn.style.background = '';
      }, 1500);
    });
  });
  
  // Handle close button click
  closeBtn.addEventListener('click', () => {
    chrome.windows.getCurrent((win) => {
      if (win && win.type === 'popup') {
        chrome.windows.remove(win.id);
      } else {
        window.close();
      }
    });
  });
  
  // Notify content script to reload keywords only on injectable pages (avoids errors on chrome:// etc.)
  function notifyContentScriptReloadKeywords() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0] || !tabs[0].url) return;
      const url = tabs[0].url;
      if (!url.startsWith('http://') && !url.startsWith('https://')) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: 'reloadKeywords' }, () => {
        if (chrome.runtime.lastError) {
          // Content script may not be loaded on this page yet - ignore
        }
      });
    });
  }

  // Load and display custom keywords
  function loadCustomKeywords() {
    chrome.storage.local.get(['customKeywords'], (result) => {
      const keywords = result.customKeywords || [];
      displayKeywords(keywords);
    });
  }
  
  // Display keywords in the list
  function displayKeywords(keywords) {
    keywordsList.innerHTML = '';
    
    if (keywords.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'empty-message';
      emptyMsg.textContent = 'No custom terms. Add a new term above.';
      keywordsList.appendChild(emptyMsg);
      return;
    }
    
    keywords.forEach((keyword, index) => {
      const keywordItem = document.createElement('div');
      keywordItem.className = 'keyword-item';
      
      const keywordText = document.createElement('span');
      keywordText.className = 'keyword-text';
      keywordText.textContent = keyword;
      
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-btn';
      removeBtn.textContent = '×';
      removeBtn.setAttribute('aria-label', `Remove ${keyword}`);
      removeBtn.addEventListener('click', () => {
        removeKeyword(index);
      });
      
      keywordItem.appendChild(keywordText);
      keywordItem.appendChild(removeBtn);
      keywordsList.appendChild(keywordItem);
    });
  }
  
  // Fetch similar keywords (aliases) from background - returns Promise<[{ keyword, reason }]>
  function fetchSimilarKeywordsPromise(keyword) {
    return new Promise((resolve) => {
      if (!chrome.runtime?.sendMessage) {
        resolve([]);
        return;
      }
      chrome.runtime.sendMessage(
        { action: 'findSimilarKeywords', keyword },
        (response) => {
          if (chrome.runtime.lastError || !response?.success || !response.similarKeywords) {
            resolve([]);
            return;
          }
          resolve(response.similarKeywords);
        }
      );
    });
  }

  // Reasons that are the same entity (name/alias), not related entities (team, occupation, etc.)
  const ALIAS_REASONS = new Set(['Hebrew name', 'English name', 'Alias/nickname']);

  // Track current suggestions and excluded words (user chose not to block these)
  let currentSuggestionsForKeyword = null;
  let excludedSuggestionsSet = new Set();

  // Add only the flag word (user-entered) to the list. Suggested terms are stored in
  // keywordExpansions for blocking but are NOT shown in the UI.
  async function addKeyword() {
    const keyword = newKeywordInput.value.trim();
    
    if (!keyword) {
      return;
    }
    
    chrome.storage.local.get(['customKeywords', 'keywordExpansions'], async (result) => {
      let keywords = result.customKeywords || [];
      const expansions = result.keywordExpansions || {};
      const existingLower = new Set(keywords.map(k => k.toLowerCase()));
      const keywordLower = keyword.toLowerCase();
      
      if (existingLower.has(keywordLower)) {
        newKeywordInput.style.borderColor = '#ff6b6b';
        setTimeout(() => {
          newKeywordInput.style.borderColor = '';
        }, 1000);
        return;
      }
      
      // Only the flag word goes to customKeywords (displayed list)
      keywords = [...keywords, keyword];
      
      // Build expansion list: prefer current suggestions, otherwise fetch from API
      let expansionList = [];
      if (currentSuggestionsForKeyword && currentSuggestionsForKeyword.keyword.toLowerCase() === keywordLower) {
        for (const s of currentSuggestionsForKeyword.suggestions) {
          const sk = s.keyword;
          if (!excludedSuggestionsSet.has(sk)) {
            expansionList.push(sk);
          }
        }
      }
      // If no suggestions loaded (user added before they appeared), fetch expansions now
      if (expansionList.length === 0) {
        const similar = await fetchSimilarKeywordsPromise(keyword);
        const existingSet = new Set([...existingLower, keywordLower]);
        for (const s of similar) {
          const sk = (s.keyword || s).trim();
          if (!sk) continue;
          const skLower = sk.toLowerCase();
          if (existingSet.has(skLower) || skLower === keywordLower) continue;
          if (s.reason && LESS_RELEVANT_REASONS.has(String(s.reason).trim())) continue;
          expansionList.push(sk);
          existingSet.add(skLower);
        }
      }
      if (expansionList.length > 0) {
        expansions[keyword] = expansionList;
      }
      
      const toStore = { customKeywords: keywords };
      if (Object.keys(expansions).length > 0) toStore.keywordExpansions = expansions;
      
      chrome.storage.local.set(toStore, async () => {
        newKeywordInput.value = '';
        currentSuggestionsForKeyword = null;
        excludedSuggestionsSet = new Set();
        loadCustomKeywords();
        notifyContentScriptReloadKeywords();
        hideSuggestions();
        const isDynamic = await isSportsOrTV(keyword);
        if (DYNAMIC_BLOCKING_ENABLED && isDynamic) {
          showDynamicBlockingPrompt(keyword);
        }
      });
    });
  }

  function removeDynamicBlockingFromAddRow() {
    const existing = addKeywordContainer?.querySelector('.dynamic-blocking-section');
    if (existing) existing.remove();
  }

  // Show only the dynamic blocking question (when adding directly without suggestions)
  function showDynamicBlockingPrompt(keyword) {
    chrome.storage.local.get(['dynamicBlockingKeywords'], (result) => {
      const dynamicPrefs = result.dynamicBlockingKeywords || {};
      removeDynamicBlockingFromAddRow();
      const dynamicSection = document.createElement('div');
      dynamicSection.className = 'dynamic-blocking-section';
      const dynamicLabel = document.createElement('div');
      dynamicLabel.className = 'question-line dynamic-blocking-label';
      dynamicLabel.setAttribute('role', 'button');
      dynamicLabel.setAttribute('tabindex', '0');
      dynamicLabel.setAttribute('aria-label', 'Dynamic blocking');
      const dynamicCheckboxFake = document.createElement('div');
      dynamicCheckboxFake.className = 'dynamic-blocking-checkbox-fake';
      dynamicCheckboxFake.setAttribute('aria-hidden', 'true');
      if (dynamicPrefs[keyword]) dynamicCheckboxFake.classList.add('checked');
      const dynamicText = document.createElement('span');
      dynamicText.className = 'dynamic-blocking-text';
      dynamicText.innerHTML = 'Dynamic<br>Blocking';
      const helpWrap = document.createElement('span');
      helpWrap.className = 'dynamic-blocking-help-wrap';
      helpWrap.addEventListener('click', (e) => e.stopPropagation());
      const helpIcon = document.createElement('span');
      helpIcon.className = 'dynamic-blocking-help';
      helpIcon.textContent = '?';
      const helpTooltip = document.createElement('span');
      helpTooltip.className = 'dynamic-blocking-tooltip';
      helpTooltip.textContent = "Content stays hidden after each game until you check the box to confirm you've seen the match result.";
      helpWrap.appendChild(helpIcon);
      helpWrap.appendChild(helpTooltip);
      dynamicLabel.appendChild(dynamicCheckboxFake);
      dynamicLabel.appendChild(dynamicText);
      dynamicLabel.appendChild(helpWrap);
      dynamicSection.appendChild(dynamicLabel);
      const saveDynamicPref = (checked) => {
        chrome.storage.local.get(['dynamicBlockingKeywords'], (storage) => {
          const prefs = { ...(storage.dynamicBlockingKeywords || {}) };
          prefs[keyword] = checked;
          chrome.storage.local.set({ dynamicBlockingKeywords: prefs });
        });
      };
      dynamicLabel.addEventListener('click', (e) => {
        if (e.target.closest('.dynamic-blocking-help-wrap')) return;
        e.preventDefault();
        e.stopPropagation();
        const isChecked = dynamicCheckboxFake.classList.toggle('checked');
        saveDynamicPref(isChecked);
      });
      dynamicLabel.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          const isChecked = dynamicCheckboxFake.classList.toggle('checked');
          saveDynamicPref(isChecked);
        }
      });
      dynamicSection.classList.add('dynamic-blocking-inline');
      addKeywordContainer?.appendChild(dynamicSection);
    });
  }

  // Remove a keyword (flag word) and its expansions
  function removeKeyword(index) {
    chrome.storage.local.get(['customKeywords', 'keywordExpansions'], (result) => {
      const keywords = result.customKeywords || [];
      const expansions = result.keywordExpansions || {};
      const removed = keywords[index];
      keywords.splice(index, 1);
      if (removed && expansions[removed]) {
        delete expansions[removed];
      }
      
      const toStore = { customKeywords: keywords };
      if (Object.keys(expansions).length > 0) toStore.keywordExpansions = expansions;
      else toStore.keywordExpansions = {};
      
      chrome.storage.local.set(toStore, () => {
        loadCustomKeywords();
        notifyContentScriptReloadKeywords();
      });
    });
  }
  
  // Handle add button click
  addKeywordBtn.addEventListener('click', addKeyword);
  
  // Handle find similar button click
  if (findSimilarBtn) findSimilarBtn.addEventListener('click', async () => {
    const keyword = newKeywordInput.value.trim();
    if (!keyword) {
      // Show feedback that input is empty
      newKeywordInput.style.borderColor = '#ff6b6b';
      setTimeout(() => {
        newKeywordInput.style.borderColor = '';
      }, 1000);
      return;
    }
    // Clear timer and search immediately
    if (suggestionTimer) {
      clearTimeout(suggestionTimer);
    }
    showSuggestionsLoading();
    
    // Check if background script is ready
    const isReady = await checkBackgroundScriptReady();
    if (!isReady) {
      showSuggestionsError('Server not available. Try again in a moment.');
      return;
    }
    
    findSimilarKeywords(keyword);
  });
  
  // Handle Enter key in input
  newKeywordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addKeyword();
    }
  });
  
  // Handle input changes to show suggestions
  newKeywordInput.addEventListener('input', (e) => {
    const keyword = e.target.value.trim();
    
    // Clear previous timer
    if (suggestionTimer) {
      clearTimeout(suggestionTimer);
    }
    
    // Hide suggestions if input is empty
    if (!keyword) {
      hideSuggestions();
      return;
    }
    
    // Show loading state
    showSuggestionsLoading();
    
    // Debounce: wait 500ms after user stops typing
    suggestionTimer = setTimeout(async () => {
      // Check if background script is ready before sending message
      const isReady = await checkBackgroundScriptReady();
      if (!isReady) {
        // Wait a bit and try once more
        setTimeout(async () => {
          const retryReady = await checkBackgroundScriptReady();
          if (retryReady) {
            findSimilarKeywords(keyword);
          } else {
            showSuggestionsError('Server not available. Try again in a moment.');
          }
        }, 300);
        return;
      }
      findSimilarKeywords(keyword);
    }, 500);
  });
  
  // Hide suggestions when clicking outside
  document.addEventListener('click', (e) => {
    // Don't hide if clicking on suggestions or input
    if (suggestionsContainer.contains(e.target) || 
        e.target === newKeywordInput || 
        e.target.closest('.suggestion-item')) {
      return;
    }
    hideSuggestions();
  });
  
  // Check if background script is ready
  function checkBackgroundScriptReady() {
    return new Promise((resolve) => {
      if (!chrome.runtime || !chrome.runtime.sendMessage) {
        resolve(false);
        return;
      }
      
      // Try to ping the background script
      chrome.runtime.sendMessage({ action: 'ping' }, (response) => {
        if (chrome.runtime.lastError) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }
  
  // Find similar keywords using background script
  function findSimilarKeywords(keyword, retryCount = 0) {
    console.log('Searching for similar keywords to:', keyword);
    
    // Check if runtime is available
    if (!chrome.runtime || !chrome.runtime.sendMessage) {
      showSuggestionsError('Extension not available. Try refreshing the page.');
      return;
    }
    
    chrome.runtime.sendMessage(
      { action: 'findSimilarKeywords', keyword },
      (response) => {
        // Check for runtime errors
        if (chrome.runtime.lastError) {
          const error = chrome.runtime.lastError.message;
          console.error('Runtime error:', error);
          
          // If it's a connection error and we haven't retried, try again after a short delay
          if (error.includes('Could not establish connection') && retryCount < 2) {
            console.log(`Retrying... (attempt ${retryCount + 1})`);
            setTimeout(() => {
              findSimilarKeywords(keyword, retryCount + 1);
            }, 500);
            return;
          }
          
          showSuggestionsError('Connection error. Make sure the extension is enabled.');
          return;
        }
        
        // Check if we got a valid response
        if (!response) {
          console.warn('No response received');
          if (retryCount < 2) {
            setTimeout(() => {
              findSimilarKeywords(keyword, retryCount + 1);
            }, 500);
            return;
          }
          showSuggestionsMessage('No response from server. Try again.');
          return;
        }
        
        console.log('Response:', response);
        
        if (response && response.success && response.similarKeywords) {
          console.log('Found similar keywords:', response.similarKeywords);
          if (response.similarKeywords.length > 0) {
            displaySuggestions(response.similarKeywords, keyword);
          } else {
            showSuggestionsMessage('No similar words found. Try another word or set an OpenAI API key.');
          }
        } else {
          const errorMsg = response?.error || 'No similar words found';
          console.warn('No suggestions found:', errorMsg);
          showSuggestionsMessage(`No similar words found. ${errorMsg}`);
        }
      }
    );
  }
  
  // Reasons that are less relevant (job titles, places, roles) - don't show these
  const LESS_RELEVANT_REASONS = new Set([
    'Position', 'Work location', 'Residence', 'Office held', 'Place',
    'Occupation', 'Profession', 'Role', 'Title', 'Location', 'City', 'Country', 'Employer'
  ]);

  // Detect if keyword is related to sports or TV (using Wikidata description)
  async function isSportsOrTV(keyword) {
    if (!keyword || !keyword.trim()) return false;
    try {
      const searchLang = /[\u0590-\u05FF]/.test(keyword.trim()) ? 'he' : 'en';
      const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(keyword.trim())}&language=${searchLang}&format=json&origin=*`;
      const res = await fetch(url);
      if (!res.ok) return false;
      const data = await res.json();
      const first = data?.search?.[0];
      const desc = (first?.description || '').toLowerCase();
      if (!desc) return false;
      const sportsTerms = ['player', 'athlete', 'basketball', 'football', 'soccer', 'sport', 'coach', 'league', 'team'];
      const tvTerms = ['television series', 'tv series', 'television program'];
      const isSports = sportsTerms.some(t => desc.includes(t));
      const isTV = tvTerms.some(t => desc.includes(t));
      return isSports || isTV;
    } catch {
      return false;
    }
  }

  // Display suggestions
  async function displaySuggestions(suggestions, originalKeyword) {
    console.log('[Popup] displaySuggestions called with:', suggestions, 'for keyword:', originalKeyword);

    const relevantSuggestions = (suggestions || []).filter(
      (s) => !s.reason || !LESS_RELEVANT_REASONS.has(String(s.reason).trim())
    );

    if (relevantSuggestions.length === 0) {
      showSuggestionsMessage('No similar words found');
      return;
    }

    suggestionsContainer.innerHTML = '';
    suggestionsContainer.style.display = 'block';
    removeDynamicBlockingFromAddRow();

    const [isDynamicEligible, result] = await Promise.all([
      isSportsOrTV(originalKeyword),
      new Promise((resolve) => chrome.storage.local.get(['customKeywords', 'dynamicBlockingKeywords'], resolve))
    ]);

    const existingKeywords = (result.customKeywords || []).map(k => k.toLowerCase());
    const dynamicPrefs = result.dynamicBlockingKeywords || {};

    if (DYNAMIC_BLOCKING_ENABLED && isDynamicEligible) {
      const dynamicSection = document.createElement('div');
      dynamicSection.className = 'dynamic-blocking-section';
      const dynamicLabel = document.createElement('div');
      dynamicLabel.className = 'question-line dynamic-blocking-label';
      dynamicLabel.setAttribute('role', 'button');
      dynamicLabel.setAttribute('tabindex', '0');
      dynamicLabel.setAttribute('aria-label', 'Dynamic blocking');
      const dynamicCheckboxFake = document.createElement('div');
      dynamicCheckboxFake.className = 'dynamic-blocking-checkbox-fake';
      dynamicCheckboxFake.setAttribute('aria-hidden', 'true');
      if (dynamicPrefs[originalKeyword]) dynamicCheckboxFake.classList.add('checked');
      const dynamicText = document.createElement('span');
      dynamicText.className = 'dynamic-blocking-text';
      dynamicText.innerHTML = 'Dynamic<br>Blocking';
      const helpWrap = document.createElement('span');
      helpWrap.className = 'dynamic-blocking-help-wrap';
      helpWrap.addEventListener('click', (e) => e.stopPropagation());
      const helpIcon = document.createElement('span');
      helpIcon.className = 'dynamic-blocking-help';
      helpIcon.textContent = '?';
      const helpTooltip = document.createElement('span');
      helpTooltip.className = 'dynamic-blocking-tooltip';
      helpTooltip.textContent = "Content stays hidden after each game until you check the box to confirm you've seen the match result.";
      helpWrap.appendChild(helpIcon);
      helpWrap.appendChild(helpTooltip);
      dynamicLabel.appendChild(dynamicCheckboxFake);
      dynamicLabel.appendChild(dynamicText);
      dynamicLabel.appendChild(helpWrap);
      dynamicSection.appendChild(dynamicLabel);
      const saveDynamicPref = (checked) => {
        chrome.storage.local.get(['dynamicBlockingKeywords'], (storage) => {
          const prefs = { ...(storage.dynamicBlockingKeywords || {}) };
          prefs[originalKeyword] = checked;
          chrome.storage.local.set({ dynamicBlockingKeywords: prefs });
        });
      };
      dynamicLabel.addEventListener('click', (e) => {
        if (e.target.closest('.dynamic-blocking-help-wrap')) return;
        e.preventDefault();
        e.stopPropagation();
        const isChecked = dynamicCheckboxFake.classList.toggle('checked');
        saveDynamicPref(isChecked);
      });
      dynamicLabel.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          const isChecked = dynamicCheckboxFake.classList.toggle('checked');
          saveDynamicPref(isChecked);
        }
      });
      dynamicSection.classList.add('dynamic-blocking-inline');
      addKeywordContainer?.appendChild(dynamicSection);
    }

    const filteredSuggestions = relevantSuggestions.filter(s => {
      const keywordLower = s.keyword.toLowerCase();
      return !existingKeywords.includes(keywordLower) &&
             keywordLower !== originalKeyword.toLowerCase();
    });
    const alreadyAddedSuggestions = relevantSuggestions.filter(s => {
      const keywordLower = s.keyword.toLowerCase();
      return existingKeywords.includes(keywordLower) ||
             keywordLower === originalKeyword.toLowerCase();
    });

    if (filteredSuggestions.length === 0 && alreadyAddedSuggestions.length === 0) {
      showSuggestionsMessage('No similar words found');
      return;
    }

    const similarWordsDropdown = document.createElement('div');
    similarWordsDropdown.className = 'similar-words-dropdown';

    const dropdownHeader = document.createElement('button');
    dropdownHeader.className = 'similar-words-dropdown-header';
    dropdownHeader.type = 'button';
    dropdownHeader.setAttribute('aria-expanded', 'false');
    const headerText = document.createElement('span');
    headerText.className = 'similar-words-dropdown-text';
    headerText.textContent = `Similar words for "${originalKeyword}"`;
    const chevron = document.createElement('span');
    chevron.className = 'similar-words-dropdown-chevron';
    chevron.textContent = '▶';
    dropdownHeader.appendChild(headerText);
    dropdownHeader.appendChild(chevron);

    const dropdownContent = document.createElement('div');
    dropdownContent.className = 'similar-words-dropdown-content';
    dropdownContent.hidden = true;

    dropdownHeader.addEventListener('click', () => {
      dropdownContent.hidden = !dropdownContent.hidden;
      dropdownHeader.setAttribute('aria-expanded', String(!dropdownContent.hidden));
      chevron.textContent = dropdownContent.hidden ? '▶' : '▼';
    });

    const listView = document.createElement('div');
    listView.className = 'similar-words-list';

    const updateBlockCount = () => {
      const toBlock = filteredSuggestions.filter(s => !excludedSuggestionsSet.has(s.keyword)).length;
      title.textContent = `Next ${toBlock} word${toBlock !== 1 ? 's' : ''} will be blocked too:`;
    };
    const title = document.createElement('div');
    title.className = 'suggestions-title';
    updateBlockCount();
    listView.appendChild(title);

    currentSuggestionsForKeyword = { keyword: originalKeyword, suggestions: [...filteredSuggestions] };
    excludedSuggestionsSet = new Set();

    const listContainer = document.createElement('div');
    listContainer.className = 'similar-words-list-container';

    filteredSuggestions.forEach((suggestion) => {
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      item.dataset.keyword = suggestion.keyword;

      const textSpan = document.createElement('span');
      textSpan.className = 'suggestion-text';
      textSpan.textContent = suggestion.keyword;
      textSpan.title = suggestion.reason || '';

      const excludeBtn = document.createElement('button');
      excludeBtn.className = 'suggestion-exclude-btn';
      excludeBtn.textContent = '−';
      excludeBtn.setAttribute('aria-label', `Don't block "${suggestion.keyword}"`);
      excludeBtn.title = "Don't block this word";
      excludeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const kw = suggestion.keyword;
        if (excludedSuggestionsSet.has(kw)) {
          excludedSuggestionsSet.delete(kw);
          item.classList.remove('suggestion-item-excluded');
          excludeBtn.textContent = '−';
          excludeBtn.title = "Don't block this word";
        } else {
          excludedSuggestionsSet.add(kw);
          item.classList.add('suggestion-item-excluded');
          excludeBtn.textContent = '+';
          excludeBtn.title = 'Include this word';
        }
        updateBlockCount();
      });

      item.appendChild(textSpan);
      item.appendChild(excludeBtn);
      listContainer.appendChild(item);
    });

    listView.appendChild(listContainer);

    if (alreadyAddedSuggestions.length > 0) {
      const alreadyLine = document.createElement('div');
      alreadyLine.className = 'suggestions-message';
      alreadyLine.style.marginTop = '4px';
      alreadyLine.textContent = `Already in list: ${alreadyAddedSuggestions.map(s => s.keyword).join(', ')}`;
      listView.appendChild(alreadyLine);
    }

    dropdownContent.appendChild(listView);
    similarWordsDropdown.appendChild(dropdownHeader);
    similarWordsDropdown.appendChild(dropdownContent);
    suggestionsContainer.appendChild(similarWordsDropdown);
  }
  
  // Show error message in suggestions container
  function showSuggestionsError(message) {
    suggestionsContainer.innerHTML = '';
    suggestionsContainer.style.display = 'block';
    
    const errorMsg = document.createElement('div');
    errorMsg.className = 'suggestions-error';
    errorMsg.textContent = message;
    suggestionsContainer.appendChild(errorMsg);
  }
  
  // Show info message in suggestions container
  function showSuggestionsMessage(message) {
    suggestionsContainer.innerHTML = '';
    suggestionsContainer.style.display = 'block';
    
    const infoMsg = document.createElement('div');
    infoMsg.className = 'suggestions-message';
    infoMsg.textContent = message;
    suggestionsContainer.appendChild(infoMsg);
  }
  
  // Show loading state for suggestions
  function showSuggestionsLoading() {
    suggestionsContainer.innerHTML = '';
    suggestionsContainer.style.display = 'block';
    
    const loading = document.createElement('div');
    loading.className = 'suggestions-loading';
    loading.textContent = 'Searching for similar words...';
    suggestionsContainer.appendChild(loading);
  }
  
  // Hide suggestions
  function hideSuggestions() {
    suggestionsContainer.style.display = 'none';
    suggestionsContainer.innerHTML = '';
    removeDynamicBlockingFromAddRow();
  }
  
  // Add a suggested keyword
  function addSuggestionKeyword(keyword) {
    newKeywordInput.value = keyword;
    addKeyword();
    hideSuggestions();
  }
  
  // Load keywords on page load
  loadCustomKeywords();
});
