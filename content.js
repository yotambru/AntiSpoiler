// Anti-Spoiler Extension - Content Script
// Blocks spoiler content based on custom keywords

(function() {
  'use strict';

  // Default keywords to filter (case-insensitive)
  const defaultKeywords = [

  ];
  
  // Combined keywords (default + custom)
  let keywords = [...defaultKeywords];

  // Keywords that use date-based filtering (e.g. sports/TV - only hide content after last game)
  let dynamicBlockingKeywords = {};

  // Map expansion -> flag for dynamic blocking lookup (expansions use their flag's setting)
  let expansionToFlag = {};

  // CSS class for hidden elements
  const HIDDEN_CLASS = 'anti-spoiler-hidden';
  
  
  // Last game date (will be loaded from storage)
  let lastGameDate = null;
  
  // Style to inject
  const hideStyle = `
    .${HIDDEN_CLASS} {
      position: relative !important;
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.85) 0%, rgba(118, 75, 162, 0.85) 100%) !important;
      border: none !important;
      border-radius: 12px !important;
      padding: 0 !important;
      /* Preserve original display type - don't change it */
      /* Don't force display property - let original display be preserved */
      /* Preserve original dimensions - don't force width/height */
      width: auto !important;
      height: auto !important;
      max-width: 100% !important;
      /* Limit maximum height to prevent oversized spoilers */
      max-height: 600px !important;
      min-height: 0 !important;
      min-width: 0 !important;
      overflow: hidden !important;
      box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3) !important;
      box-sizing: border-box !important;
      /* Don't add extra spacing */
      margin: 0 !important;
      vertical-align: top !important;
      /* Prevent element from growing beyond original size */
      flex-shrink: 0 !important;
      flex-grow: 0 !important;
    }
    
    /* For elements that should remain block-level, override to block but keep dimensions */
    article.${HIDDEN_CLASS},
    div.${HIDDEN_CLASS}:not([style*="display: inline"]):not([style*="display:inline"]),
    section.${HIDDEN_CLASS},
    li.${HIDDEN_CLASS} {
      display: block !important;
      width: auto !important;
      height: auto !important;
      max-width: 100% !important;
      /* Limit maximum height to prevent oversized spoilers */
      max-height: 600px !important;
      box-sizing: border-box !important;
    }
    
    /* For inline elements, preserve inline display */
    span.${HIDDEN_CLASS},
    a.${HIDDEN_CLASS},
    em.${HIDDEN_CLASS},
    strong.${HIDDEN_CLASS},
    b.${HIDDEN_CLASS},
    i.${HIDDEN_CLASS} {
      display: inline !important;
      box-sizing: border-box !important;
    }
    
    /* Hide all content with blur - including nested descendants */
    .${HIDDEN_CLASS} * {
      filter: blur(20px) !important;
      opacity: 0.05 !important;
      pointer-events: none !important;
    }
    
    /* Hide text */
    .${HIDDEN_CLASS} {
      color: transparent !important;
      text-shadow: 0 0 20px rgba(0, 0, 0, 1) !important;
    }
    
    /* Style for images - blur and minimal background, preserve original size */
    .${HIDDEN_CLASS} img,
    .${HIDDEN_CLASS} picture img,
    .${HIDDEN_CLASS} video,
    img.${HIDDEN_CLASS},
    picture.${HIDDEN_CLASS},
    video.${HIDDEN_CLASS} {
      filter: blur(24px) brightness(0.4) !important;
      opacity: 0.1 !important;
      position: relative !important;
      /* Preserve original image dimensions */
      width: auto !important;
      height: auto !important;
      max-width: 100% !important;
      min-height: 0 !important;
      min-width: 0 !important;
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.9) 0%, rgba(118, 75, 162, 0.9) 100%) !important;
    }
    
    /* For elements containing images - preserve original size but limit max size */
    .${HIDDEN_CLASS}:has(img),
    .${HIDDEN_CLASS}:has(picture),
    .${HIDDEN_CLASS}:has(video) {
      position: relative !important;
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.9) 0%, rgba(118, 75, 162, 0.9) 100%) !important;
      /* Preserve original dimensions but limit max size */
      width: auto !important;
      height: auto !important;
      max-width: 100% !important;
      /* Limit maximum height to prevent oversized spoilers */
      max-height: 600px !important;
      min-height: 0 !important;
      border-radius: 12px !important;
      box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3) !important;
    }
    
    /* For images directly hidden - preserve original dimensions */
    img.${HIDDEN_CLASS},
    picture.${HIDDEN_CLASS},
    video.${HIDDEN_CLASS} {
      width: auto !important;
      height: auto !important;
      max-width: 100% !important;
      min-height: 0 !important;
      min-width: 0 !important;
      border-radius: 12px !important;
    }
    
    /* Hide iframes and svg completely */
    .${HIDDEN_CLASS} iframe,
    .${HIDDEN_CLASS} svg,
    iframe.${HIDDEN_CLASS},
    svg.${HIDDEN_CLASS} {
      display: none !important;
    }
    
    /* Indication which keyword caused the block (badge on the overlay) */
    .${HIDDEN_CLASS}[data-anti-spoiler-keyword]::after {
      content: attr(data-anti-spoiler-keyword) !important;
      display: block !important;
      position: absolute !important;
      top: 8px !important;
      left: 8px !important;
      right: 8px !important;
      padding: 6px 10px !important;
      background: rgba(0, 0, 0, 0.55) !important;
      color: #fff !important;
      font-size: 12px !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      border-radius: 8px !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      z-index: 1 !important;
      pointer-events: none !important;
      filter: none !important;
      opacity: 1 !important;
      box-sizing: border-box !important;
    }
  `;

  // Inject CSS
  function injectStyles() {
    try {
      const styleId = 'anti-spoiler-styles';
      if (document.getElementById(styleId)) return;
      
      if (!document.head) {
        // If head doesn't exist, try again later
        setTimeout(injectStyles, 10);
        return;
      }
      
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = hideStyle;
      document.head.appendChild(style);
    } catch (e) {
      // Ignore errors - styles might already be injected
    }
  }

  // Load custom keywords from storage and combine with default keywords
  function loadKeywords(callback) {
    if (!isChromeContextValid()) {
      keywords = [...defaultKeywords];
      dynamicBlockingKeywords = {};
      if (callback) callback();
      return;
    }
    
    try {
      chrome.storage.local.get(['customKeywords', 'keywordExpansions', 'dynamicBlockingKeywords'], (result) => {
        try {
          const customKeywords = result.customKeywords || [];
          const expansions = result.keywordExpansions || {};
          // Combine default + flag words + expansions (expansions used for blocking, not displayed)
          const expanded = [...customKeywords];
          expansionToFlag = {};
          for (const flag of customKeywords) {
            const expList = expansions[flag];
            if (expList && Array.isArray(expList)) {
              expanded.push(...expList);
              for (const exp of expList) {
                expansionToFlag[exp] = flag;
              }
            }
          }
          keywords = [...defaultKeywords, ...expanded];
          dynamicBlockingKeywords = result.dynamicBlockingKeywords || {};
        } catch (e) {
          // If loading fails, use default keywords
          keywords = [...defaultKeywords];
          dynamicBlockingKeywords = {};
          expansionToFlag = {};
        }
        if (callback) callback();
      });
    } catch (e) {
      // If storage access fails, use default keywords
      keywords = [...defaultKeywords];
      dynamicBlockingKeywords = {};
      if (callback) callback();
    }
  }
  
  // Check if text contains any keywords
  function containsKeywords(text) {
    if (!text || typeof text !== 'string') return false;
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
  }

  // Return the first keyword that matches the text (for showing which keyword caused the block)
  function getMatchedKeyword(text) {
    if (!text || typeof text !== 'string') return null;
    const lowerText = text.toLowerCase();
    for (let i = 0; i < keywords.length; i++) {
      if (lowerText.includes(keywords[i].toLowerCase())) return keywords[i];
    }
    return null;
  }

  // Only apply date filter for keywords that use dynamic blocking (e.g. sports/TV).
  // Regular keywords (e.g. political figures) are always hidden when matched.
  // Expansions use their flag word's dynamic blocking setting.
  function shouldApplyDateFilterForKeyword(matchedKeyword) {
    const flag = expansionToFlag[matchedKeyword] || matchedKeyword;
    return !!(dynamicBlockingKeywords && flag && dynamicBlockingKeywords[flag]);
  }

  // Mark element as hidden and set which keyword triggered it (for badge display)
  function markElementHidden(element) {
    if (!element || !element.classList) return;
    element.classList.add(HIDDEN_CLASS);
    const kw = getMatchedKeyword(element.textContent || '');
    if (kw) element.setAttribute('data-anti-spoiler-keyword', kw);
  }

  // Parse relative timestamps in Hebrew (e.g., "לפני יומיים", "לפני 10 שעות")
  function parseRelativeTimestamp(text) {
    if (!text || typeof text !== 'string') return null;
    
    // Clean text: remove extra whitespace, normalize
    const cleanedText = text.replace(/\s+/g, ' ').trim();
    const lowerText = cleanedText.toLowerCase();
    const now = new Date();
    
    // Hebrew relative time patterns
    // Note: Using more flexible regex to handle various spacing and text variations
    const patterns = [
      // "לפני יומיים" (2 days ago) - check this first as it's a common pattern
      { regex: /לפני\s*יומיים/, unit: 'days', value: 2 },
      // "לפני יום אחד" (1 day ago)
      { regex: /לפני\s*יום\s*אחד/, unit: 'days', value: 1 },
      // "לפני X ימים" (X days ago)
      { regex: /לפני\s*(\d+)\s*ימים?/, unit: 'days' },
      // "לפני X שעות" (X hours ago)
      { regex: /לפני\s*(\d+)\s*שעות?/, unit: 'hours' },
      // "לפני X דקות" (X minutes ago)
      { regex: /לפני\s*(\d+)\s*דקות?/, unit: 'minutes' },
      // "לפני שבועיים" (2 weeks ago)
      { regex: /לפני\s*שבועיים/, unit: 'days', value: 14 },
      // "לפני שבוע" (1 week ago)
      { regex: /לפני\s*שבוע/, unit: 'days', value: 7 },
      // "לפני חודשיים" (2 months ago)
      { regex: /לפני\s*חודשיים/, unit: 'months', value: 2 },
      // "לפני חודש" (1 month ago)
      { regex: /לפני\s*חודש/, unit: 'months', value: 1 },
      // English patterns for compatibility
      { regex: /(\d+)\s+hours?\s+ago/i, unit: 'hours' },
      { regex: /(\d+)\s+minutes?\s+ago/i, unit: 'minutes' },
      { regex: /(\d+)\s+days?\s+ago/i, unit: 'days' },
      { regex: /yesterday/i, unit: 'days', value: 1 },
      { regex: /(\d+)\s+weeks?\s+ago/i, unit: 'days', multiplier: 7 },
      { regex: /(\d+)\s+months?\s+ago/i, unit: 'months' },
    ];
    
    // Try matching against both original and lowercase text
    const textsToCheck = [cleanedText, lowerText];
    
    for (const textToMatch of textsToCheck) {
      for (const pattern of patterns) {
        const match = textToMatch.match(pattern.regex);
        if (match) {
          let value = pattern.value !== undefined ? pattern.value : parseInt(match[1]);
          if (isNaN(value)) continue;
          
          if (pattern.multiplier) {
            value = value * pattern.multiplier;
          }
          
          const date = new Date(now);
          
          switch (pattern.unit) {
            case 'minutes':
              date.setMinutes(date.getMinutes() - value);
              break;
            case 'hours':
              date.setHours(date.getHours() - value);
              break;
            case 'days':
              date.setDate(date.getDate() - value);
              break;
            case 'months':
              date.setMonth(date.getMonth() - value);
              break;
          }
          
          return date;
        }
      }
    }
    
    return null;
  }

  // Extract date from element (checks time tags, meta tags, and text patterns)
  function extractDateFromElement(element) {
    try {
      // Check for <time> element with datetime attribute
      const timeElement = element.querySelector('time[datetime]');
      if (timeElement) {
        const datetime = timeElement.getAttribute('datetime');
        if (datetime) {
          const date = parseDate(datetime);
          if (date) return date;
        }
      }
      
      // Check if element itself is a time element
      if (element.tagName === 'TIME' && element.getAttribute('datetime')) {
        const date = parseDate(element.getAttribute('datetime'));
        if (date) return date;
      }
      
      // Check for meta tags with date information
      const metaDate = element.querySelector('meta[property="article:published_time"], meta[property="og:published_time"], meta[name="publish-date"], meta[name="date"]');
      if (metaDate) {
        const content = metaDate.getAttribute('content');
        if (content) {
          const date = parseDate(content);
          if (date) return date;
        }
      }
      
      // Check parent elements for date information
      let parent = element.parentElement;
      let depth = 0;
      while (parent && depth < 5) {
        // Check for time element in parent
        const parentTime = parent.querySelector('time[datetime]');
        if (parentTime) {
          const datetime = parentTime.getAttribute('datetime');
          if (datetime) {
            const date = parseDate(datetime);
            if (date) return date;
          }
        }
        
        // Check for date in data attributes
        const dataDate = parent.getAttribute('data-date') || parent.getAttribute('data-published');
        if (dataDate) {
          const date = parseDate(dataDate);
          if (date) return date;
        }
        
        parent = parent.parentElement;
        depth++;
      }
      
      // Try to parse relative timestamps from text content
      // First check element itself, then check parents and siblings
      const elementsToCheck = [element];
      let parentEl = element.parentElement;
      let checkDepth = 0;
      while (parentEl && checkDepth < 3) {
        elementsToCheck.push(parentEl);
        
        // Also check siblings for relative timestamps (common in Google search results)
        if (parentEl.parentElement) {
          const siblings = Array.from(parentEl.parentElement.children || []);
          // Check up to 5 siblings (before and after)
          const currentIndex = siblings.indexOf(parentEl);
          if (currentIndex >= 0) {
            for (let i = Math.max(0, currentIndex - 2); i <= Math.min(siblings.length - 1, currentIndex + 2); i++) {
              if (i !== currentIndex && siblings[i]) {
                elementsToCheck.push(siblings[i]);
              }
            }
          }
        }
        
        parentEl = parentEl.parentElement;
        checkDepth++;
      }
      
      // Also check direct siblings of the element
      if (element.parentElement) {
        const directSiblings = Array.from(element.parentElement.children || []);
        const currentIndex = directSiblings.indexOf(element);
        if (currentIndex >= 0) {
          for (let i = Math.max(0, currentIndex - 3); i <= Math.min(directSiblings.length - 1, currentIndex + 3); i++) {
            if (i !== currentIndex && directSiblings[i]) {
              elementsToCheck.push(directSiblings[i]);
            }
          }
        }
      }
      
      for (const elToCheck of elementsToCheck) {
        const textContent = elToCheck.textContent || '';
        
        // Try relative timestamp first (more common in Google search results)
        const relativeDate = parseRelativeTimestamp(textContent);
        if (relativeDate) {
          return relativeDate;
        }
        
        // More comprehensive date patterns
        const datePatterns = [
          // DD/MM/YYYY or MM/DD/YYYY
          /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
          // YYYY-MM-DD
          /(\d{4})-(\d{1,2})-(\d{1,2})/,
          // DD.MM.YYYY
          /(\d{1,2})\.(\d{1,2})\.(\d{4})/,
          // January 7, 2025 or Jan 7, 2025
          /(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})/i,
          // 7 January 2025 or 7 Jan 2025
          /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec),?\s+(\d{4})/i,
        ];
        
        for (const pattern of datePatterns) {
          const match = textContent.match(pattern);
          if (match) {
            let date;
            if (pattern === datePatterns[0]) {
              // DD/MM/YYYY or MM/DD/YYYY - try both formats
              const day = parseInt(match[1]);
              const month = parseInt(match[2]);
              const year = parseInt(match[3]);
              // Try DD/MM/YYYY first (more common in Hebrew/European format)
              date = new Date(year, month - 1, day);
              // If date seems invalid (e.g., month > 12), try MM/DD/YYYY
              if (month > 12 || day > 31) {
                date = new Date(year, day - 1, month);
              }
            } else if (pattern === datePatterns[1]) {
              // YYYY-MM-DD
              date = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
            } else if (pattern === datePatterns[2]) {
              // DD.MM.YYYY
              date = new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
            } else if (pattern === datePatterns[3] || pattern === datePatterns[4]) {
              // Month name format
              const monthNames = {
                'january': 0, 'jan': 0,
                'february': 1, 'feb': 1,
                'march': 2, 'mar': 2,
                'april': 3, 'apr': 3,
                'may': 4,
                'june': 5, 'jun': 5,
                'july': 6, 'jul': 6,
                'august': 7, 'aug': 7,
                'september': 8, 'sep': 8,
                'october': 9, 'oct': 9,
                'november': 10, 'nov': 10,
                'december': 11, 'dec': 11
              };
              
              let month, day, year;
              if (pattern === datePatterns[3]) {
                // "January 7, 2025"
                month = monthNames[match[1].toLowerCase()];
                day = parseInt(match[2]);
                year = parseInt(match[3]);
              } else {
                // "7 January 2025"
                day = parseInt(match[1]);
                month = monthNames[match[2].toLowerCase()];
                year = parseInt(match[3]);
              }
              
              if (month !== undefined) {
                date = new Date(year, month, day);
              }
            }
            
            if (date && !isNaN(date.getTime())) {
              return date;
            }
          }
        }
      }
      
      return null;
    } catch (e) {
      return null;
    }
  }

  // Parse various date formats
  function parseDate(dateString) {
    if (!dateString) return null;
    
    try {
      // Try ISO format first
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date;
      }
      
      // Try other common formats
      const formats = [
        dateString.trim(),
        dateString.replace(/T.*/, ''), // Remove time part
      ];
      
      for (const format of formats) {
        const parsed = new Date(format);
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      }
      
      return null;
    } catch (e) {
      return null;
    }
  }

  // Check if content date is after last game date
  function isContentAfterLastGame(element) {
    // Default to January 9, 2025 if no date is set
    const defaultLastGameDate = '2025-01-09';
    const gameDateToUse = lastGameDate || defaultLastGameDate;
    
    try {
      const contentDate = extractDateFromElement(element);
      
      // If we can't find a date, be more conservative - check if element has timestamp text
      // If element clearly has date-related text but we couldn't parse it, don't filter
      if (!contentDate) {
        // Check element itself and its parents/siblings for date-like text
        const elementsToCheck = [element];
        let parentEl = element.parentElement;
        let checkDepth = 0;
        while (parentEl && checkDepth < 3) {
          elementsToCheck.push(parentEl);
          // Also check siblings
          if (parentEl.parentElement) {
            const siblings = Array.from(parentEl.parentElement.children || []);
            const currentIndex = siblings.indexOf(parentEl);
            if (currentIndex >= 0) {
              for (let i = Math.max(0, currentIndex - 2); i <= Math.min(siblings.length - 1, currentIndex + 2); i++) {
                if (i !== currentIndex && siblings[i]) {
                  elementsToCheck.push(siblings[i]);
                }
              }
            }
          }
          parentEl = parentEl.parentElement;
          checkDepth++;
        }
        
        // Check all collected elements for date-like text
        let hasDateLikeText = false;
        for (const elToCheck of elementsToCheck) {
          const textContent = (elToCheck.textContent || '').toLowerCase();
          // Check if there's date-like text (numbers that could be dates) or relative timestamps
          if (/\d{1,2}[\/\.]\d{1,2}[\/\.]\d{4}/.test(textContent) ||
              /(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(textContent) ||
              /לפני\s*/.test(textContent) || // Hebrew relative timestamps (more flexible)
              /\d+\s+(hours?|minutes?|days?|weeks?|months?)\s+ago/i.test(textContent)) { // English relative timestamps
            hasDateLikeText = true;
            break;
          }
        }
        
        // If there's date-like text but we couldn't parse it, don't filter (safer)
        // Only filter if there's no indication of a date at all
        if (hasDateLikeText) {
          return false; // Don't filter if we see date-like text but couldn't parse
        }
        
        // If no date indication at all, filter it (to be safe)
        return true;
      }
      
      // Compare dates (only date, ignore time)
      const lastGame = new Date(gameDateToUse);
      lastGame.setHours(0, 0, 0, 0);
      
      const content = new Date(contentDate);
      content.setHours(0, 0, 0, 0);
      
      // Filter if content is AFTER last game date (not equal to)
      // This means content from January 9, 2025 or before will be shown
      // Content from January 10, 2025 onwards will be blocked
      return content > lastGame;
    } catch (e) {
      // If date parsing fails, be conservative - don't filter
      return false;
    }
  }

  // Check if image should be hidden based on its container
  function shouldHideImage(imageElement) {
    try {
      if (!imageElement || imageElement.tagName !== 'IMG' && imageElement.tagName !== 'VIDEO' && imageElement.tagName !== 'PICTURE') {
        return false;
      }
      
      // Check if already hidden
      if (imageElement.classList && imageElement.classList.contains(HIDDEN_CLASS)) return false;
      
      // Check image attributes first
      const attributes = ['alt', 'title', 'aria-label', 'src'];
      for (const attr of attributes) {
        try {
          const attrValue = imageElement.getAttribute(attr);
          if (attrValue && containsKeywords(attrValue)) {
            const matchedKw = getMatchedKeyword(attrValue);
            return shouldApplyDateFilterForKeyword(matchedKw) ? isContentAfterLastGame(imageElement) : true;
          }
        } catch (e) {
          continue;
        }
      }
      
      // Check parent containers for keywords, but only for small containers
      // Don't hide images from large articles just because the article mentions a keyword
      let parent = imageElement.parentElement;
      let depth = 0;
      const maxDepth = 5;
      
      while (parent && depth < maxDepth) {
        // Skip body and html
        if (parent.tagName === 'BODY' || parent.tagName === 'HTML' || 
            parent === document.body || parent === document.documentElement) {
          break;
        }
        
        // Check parent's text content - but only for small containers (like figure captions)
        try {
          const parentText = parent.textContent || '';
          if (parentText && containsKeywords(parentText)) {
            // Only hide if parent is a small container (like figure, figcaption, or small div)
            // Large containers (like articles) may contain images of teammates
            const textLength = parentText.length;
            const isSmallContainer = parent.tagName === 'FIGURE' || 
                                     parent.tagName === 'FIGCAPTION' ||
                                     parent.tagName === 'CAPTION' ||
                                     textLength < 500; // Only small containers
            
            if (isSmallContainer) {
              const matchedKw = getMatchedKeyword(parentText);
              return shouldApplyDateFilterForKeyword(matchedKw) ? isContentAfterLastGame(parent) : true;
            }
            // For larger containers, don't hide images unless they're directly related
            // (which we already checked above with image attributes)
          }
        } catch (e) {
          // Continue checking parents
        }
        
        // Check parent's attributes
        const parentAttributes = ['aria-label', 'title', 'alt'];
        for (const attr of parentAttributes) {
          try {
            const attrValue = parent.getAttribute(attr);
            if (attrValue && containsKeywords(attrValue)) {
              const matchedKw = getMatchedKeyword(attrValue);
              return shouldApplyDateFilterForKeyword(matchedKw) ? isContentAfterLastGame(parent) : true;
            }
          } catch (e) {
            continue;
          }
        }
        
        parent = parent.parentElement;
        depth++;
      }
      
      return false;
    } catch (e) {
      return false;
    }
  }

  // Check if element contains YouTube's main video (traverses Shadow DOM)
  function elementContainsYouTubeMainVideo(element) {
    try {
      if (!element || !element.querySelector) return false;
      const check = (root) => {
        if (!root) return false;
        try {
          if (root.querySelector) {
            const found = root.querySelector('#movie_player, #primary, ytd-player');
            if (found) return true;
          }
          if (root.id === 'movie_player' || root.id === 'primary') return true;
          const tag = (root.tagName || '').toLowerCase();
          if (tag === 'ytd-player' || tag === 'video') return true;
        } catch (e) { /* ignore */ }
        return false;
      };
      const traverse = (root, depth) => {
        if (!root || depth > 12) return false;
        if (check(root)) return true;
        try {
          const children = root.querySelectorAll ? root.querySelectorAll('*') : [];
          for (const child of children) {
            if (child.shadowRoot && traverse(child.shadowRoot, depth + 1)) return true;
            if (traverse(child, depth + 1)) return true;
          }
        } catch (e) { /* ignore */ }
        return false;
      };
      return traverse(element, 0);
    } catch (e) {
      return false;
    }
  }

  // Check if element is part of YouTube's search/header interface (should not be hidden)
  // When user searches "X" on YouTube, the search term appears in the DOM - we must not block
  // the main video just because it shares a parent with the search UI
  function isYouTubeSearchInterface(element) {
    try {
      if (!element) return false;
      const hostname = window.location.hostname || '';
      if (!hostname.includes('youtube.com') && !hostname.includes('youtu.be')) return false;
      
      const tagName = (element.tagName || '').toLowerCase();
      const role = (element.getAttribute('role') || '').toLowerCase();
      const type = (element.getAttribute('type') || '').toLowerCase();
      
      // Skip search inputs and combobox
      if (tagName === 'input' && (type === 'text' || type === 'search')) return true;
      if (tagName === 'textarea') return true;
      if (role === 'combobox' || role === 'searchbox') return true;
      
      // Skip YouTube custom elements: ytd-search (search bar), ytd-masthead (header), chips
      if (tagName === 'ytd-search' || tagName === 'ytd-masthead' || tagName === 'ytd-chip-cloud-renderer') return true;
      
      // Skip elements that contain search input
      try {
        const searchInputs = element.querySelectorAll('input[type="text"], input[type="search"], [role="combobox"], [role="searchbox"], ytd-search');
        if (searchInputs.length > 0) return true;
      } catch (e) { /* ignore */ }
      
      // Check parents - if inside ytd-search, ytd-masthead, or chip cloud, skip
      let parent = element.parentElement;
      for (let d = 0; parent && d < 10; d++) {
        const pTag = (parent.tagName || '').toLowerCase();
        if (pTag === 'ytd-search' || pTag === 'ytd-masthead' || pTag === 'ytd-chip-cloud-renderer') return true;
        parent = parent.parentElement;
      }
      
      // Elements in top 220px are likely header/search area (chips, search bar)
      try {
        const rect = element.getBoundingClientRect();
        if (rect.top >= 0 && rect.top < 220) {
          const inHeader = element.closest('ytd-masthead, ytd-search, header, [role="banner"]');
          if (inHeader) return true;
        }
      } catch (e) { /* ignore */ }
      
      return false;
    } catch (e) {
      return false;
    }
  }

  // Check if element is part of Google's search interface (should not be hidden)
  function isGoogleSearchInterface(element) {
    try {
      if (!element) return false;
      
      // Check if we're on Google
      const isGooglePage = window.location.hostname.includes('google.com') || 
                          window.location.hostname.includes('google.co.il');
      if (!isGooglePage) return false;
      
      // Check if element is part of search input/interface
      const tagName = element.tagName || '';
      const role = element.getAttribute('role') || '';
      const type = element.getAttribute('type') || '';
      const name = element.getAttribute('name') || '';
      const id = element.getAttribute('id') || '';
      const className = element.className || '';
      const classStr = typeof className === 'string' ? className : '';
      
      // Skip search input boxes
      if (tagName === 'INPUT' && (type === 'text' || type === 'search')) return true;
      if (tagName === 'TEXTAREA') return true;
      if (role === 'combobox' || role === 'searchbox') return true;
      if (name === 'q' || name === 'search') return true;
      
      // Skip Google-specific UI elements - expanded list
      if (id.includes('search') || id.includes('gs_') || id.includes('gb_') || 
          id.includes('APjFqb') || id.includes('tsf')) return true;
      
      // More comprehensive Google class name checks
      const googleClasses = [
        'gLFyf', 'RNNXgb', 'a4bIc', 'RNmpXc', 'SDkEP', 'RNNXgb',
        'A8SBwf', 'RNNXgb', 'emcav', 'T47uwc', 'iblpc', 'CqAVzb',
        'lJ9FBc', 'gNO89b', 'Tg7LZd', 'z1asCe', 'MZy1Rb', 'hsuHs',
        'RNNXgb', 'SDkEP', 'gLFyf', 'gsfi', 'lst', 'lsb'
      ];
      
      for (const googleClass of googleClasses) {
        if (classStr.includes(googleClass)) return true;
      }
      
      // Check if element contains a search input (children check)
      try {
        const searchInputs = element.querySelectorAll('input[type="text"], input[type="search"], textarea[name="q"], textarea[name="search"], [role="combobox"], [role="searchbox"]');
        if (searchInputs.length > 0) return true;
      } catch (e) {
        // Ignore query errors
      }
      
      // Check parent elements - increased depth to 8 levels
      let parent = element.parentElement;
      let depth = 0;
      while (parent && depth < 8) {
        const parentTagName = parent.tagName || '';
        const parentRole = parent.getAttribute('role') || '';
        const parentId = parent.getAttribute('id') || '';
        const parentClass = parent.className || '';
        const parentClassStr = typeof parentClass === 'string' ? parentClass : '';
        const parentName = parent.getAttribute('name') || '';
        
        // Check if parent is a form (especially search forms)
        if (parentTagName === 'FORM') {
          const formAction = parent.getAttribute('action') || '';
          if (formAction.includes('/search') || parentName === 'f' || parentId.includes('tsf')) {
            return true;
          }
        }
        
        if (parentRole === 'combobox' || parentRole === 'searchbox') return true;
        if (parentId.includes('search') || parentId.includes('gs_') || parentId.includes('gb_') ||
            parentId.includes('APjFqb') || parentId.includes('tsf')) return true;
        if (parentName === 'q' || parentName === 'search' || parentName === 'f') return true;
        
        // Check parent classes
        for (const googleClass of googleClasses) {
          if (parentClassStr.includes(googleClass)) return true;
        }
        
        // Check if parent contains search inputs
        try {
          const parentSearchInputs = parent.querySelectorAll('input[type="text"], input[type="search"], textarea[name="q"], textarea[name="search"], [role="combobox"], [role="searchbox"]');
          if (parentSearchInputs.length > 0) return true;
        } catch (e) {
          // Ignore query errors
        }
        
        parent = parent.parentElement;
        depth++;
      }
      
      // Also check if element is near the top of the page (likely part of search interface)
      try {
        const rect = element.getBoundingClientRect();
        // If element is in the top 200px of the page, be more cautious
        if (rect.top >= 0 && rect.top < 200) {
          // Check if it's likely part of the header/search area
          const headerElements = element.closest('header, [role="banner"], form, #searchform, #tsf');
          if (headerElements) return true;
        }
      } catch (e) {
        // Ignore bounding rect errors
      }
      
      return false;
    } catch (e) {
      return false;
    }
  }

  // Check if element should be hidden
  function shouldHideElement(element) {
    try {
      // Skip if already hidden
      if (!element.classList || element.classList.contains(HIDDEN_CLASS)) return false;
      
      // Skip script and style tags
      if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE') return false;
      
      // Skip Google search interface elements (search box, navigation, etc.)
      if (isGoogleSearchInterface(element)) return false;
      
      // Skip YouTube search/header - user's search term in bar/chips must not block main video
      if (isYouTubeSearchInterface(element)) return false;
      
      // Also check if element contains search interface elements - don't hide containers with search boxes
      try {
        const searchInputs = element.querySelectorAll('input[type="text"], input[type="search"], textarea[name="q"], textarea[name="search"], [role="combobox"], [role="searchbox"], form, ytd-search');
        if (searchInputs.length > 0) {
          for (const input of searchInputs) {
            if (isGoogleSearchInterface(input) || isYouTubeSearchInterface(input)) {
              return false; // Don't hide if it contains a search interface element
            }
          }
        }
      } catch (e) {
        // Ignore query errors
      }
      
      // Check images separately
      if (element.tagName === 'IMG' || element.tagName === 'VIDEO' || element.tagName === 'PICTURE') {
        return shouldHideImage(element);
      }
      
      // Skip very large containers (body, html, main containers)
      const largeContainers = ['BODY', 'HTML', 'MAIN', 'ARTICLE', 'SECTION'];
      if (largeContainers.includes(element.tagName)) return false;
      
      // Get direct text content (without children's text)
      let directText = '';
      try {
        directText = Array.from(element.childNodes || [])
          .filter(node => node.nodeType === Node.TEXT_NODE)
          .map(node => node.textContent || '')
          .join(' ')
          .trim();
      } catch (e) {
        // If we can't get child nodes, skip
      }
      
      // Get all text content from element
      let textContent = '';
      try {
        textContent = element.textContent || '';
      } catch (e) {
        // If we can't get text content, skip
        return false;
      }
      
      // Check if content contains keywords
      let hasKeywords = false;
      
      // Check direct text first (text that's directly in this element, not in children)
      if (directText && containsKeywords(directText)) {
        hasKeywords = true;
      }
      
      // If element has too much text (more than 500 chars), it's probably a container
      // Check only direct text or small elements
      const isLargeContainer = textContent.length > 500;
      
      // For small elements, check all text content
      if (!isLargeContainer && textContent && containsKeywords(textContent)) {
        // But only consider if it's a leaf node or has very few children
        try {
          const childElements = element.querySelectorAll('*');
          if (childElements.length < 10) {
            hasKeywords = true;
          }
        } catch (e) {
          // If querySelector fails, assume it's a small element
          hasKeywords = true;
        }
      }
      
      // Check attributes (alt, title, aria-label, etc.)
      if (!hasKeywords) {
        const attributes = ['alt', 'title', 'aria-label', 'placeholder', 'value'];
        for (const attr of attributes) {
          try {
            const attrValue = element.getAttribute(attr);
            if (attrValue && containsKeywords(attrValue)) {
              hasKeywords = true;
              break;
            }
          } catch (e) {
            // Skip this attribute if we can't read it
            continue;
          }
        }
      }
      
      // If no keywords found, don't hide
      if (!hasKeywords) return false;
      
      // For dynamic keywords (sports/TV), only hide content after last game date.
      // For regular keywords (e.g. political figures), always hide when matched.
      let matchedKeyword = getMatchedKeyword(textContent || directText || '');
      if (!matchedKeyword) {
        for (const attr of ['alt', 'title', 'aria-label', 'placeholder', 'value']) {
          const v = element.getAttribute(attr);
          if (v) { matchedKeyword = getMatchedKeyword(v); if (matchedKeyword) break; }
        }
      }
      if (shouldApplyDateFilterForKeyword(matchedKeyword)) {
        return isContentAfterLastGame(element);
      }
      // YouTube: never hide element that contains the primary video player (incl. Shadow DOM)
      // (keyword may come from search chips, not from the video itself)
      const hostname = window.location.hostname || '';
      if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
        const tag = (element.tagName || '').toLowerCase();
        if (tag === 'ytd-watch-flexy' || tag === 'ytd-player') return false;
        if (elementContainsYouTubeMainVideo(element)) return false;
      }
      return true; // Always hide for non-dynamic keywords
    } catch (e) {
      // If anything fails, don't hide the element
      return false;
    }
  }

  // Hide all text elements in the same container as the matched element
  function hideRelatedTextElements(element) {
    try {
      if (!element || !element.parentElement) return;
      
      // First, get the element's position to find nearby text elements
      let elementRect;
      try {
        elementRect = element.getBoundingClientRect();
      } catch (e) {
        elementRect = null;
      }
      
      // Find the meaningful parent container (article, news item, etc.)
      // Common containers: article, div with specific classes, a (link), li (list item)
      let parent = element.parentElement;
      let depth = 0;
      const maxDepth = 8; // Reduced depth to be more precise
      const meaningfulContainers = ['ARTICLE', 'LI', 'DIV', 'A', 'SECTION', 'FIGURE'];
      let bestContainer = null;
      let bestContainerScore = 0;
      
      // First, try to find the best meaningful container (smallest one that makes sense)
      while (parent && depth < maxDepth) {
        // Skip body and html
        if (parent.tagName === 'BODY' || parent.tagName === 'HTML' || 
            parent === document.body || parent === document.documentElement) {
          break;
        }
        
        // Check if this is a meaningful container
        const isMeaningful = meaningfulContainers.includes(parent.tagName) ||
                             parent.classList.length > 0 ||
                             parent.getAttribute('role') === 'article' ||
                             parent.getAttribute('itemprop') ||
                             parent.querySelector('img, picture, video') ||
                             (parent.textContent && parent.textContent.length > 50);
        
        if (isMeaningful) {
          // Score this container: prefer smaller, more specific containers
          const textLength = (parent.textContent || '').length;
          let score = 0;
          
          // Prefer ARTICLE tags
          if (parent.tagName === 'ARTICLE') score += 1000;
          // Prefer containers with article role
          if (parent.getAttribute('role') === 'article') score += 500;
          // Prefer containers with classes (likely structured content)
          if (parent.classList.length > 0) score += 100;
          // Prefer containers with images (likely news items)
          if (parent.querySelector('img, picture, video')) score += 200;
          // Prefer smaller containers (more precise) - penalize very large containers
          if (textLength > 100 && textLength < 3000) {
            score += (3000 - textLength) / 10; // Smaller containers score higher
          } else if (textLength >= 3000) {
            score -= 500; // Penalize very large containers
          }
          
          // If this is a better container, remember it
          if (score > bestContainerScore) {
            bestContainer = parent;
            bestContainerScore = score;
          }
        }
        
        parent = parent.parentElement;
        depth++;
      }
      
      // Use the best container we found, or fall back to direct parent
      if (bestContainer) {
        parent = bestContainer;
      } else {
        // Last resort: use the direct parent
        parent = element.parentElement;
      }
      
      // Only hide if parent is reasonable size (not too large)
      const parentTextLength = (parent.textContent || '').length;
      const MAX_SPOILER_HEIGHT = 600; // pixels
      const MAX_SPOILER_WIDTH = window.innerWidth * 0.95; // 95% of viewport width
      
      // Check physical size of parent container
      let parentTooLarge = false;
      try {
        const parentRect = parent.getBoundingClientRect();
        if (parentRect.height > MAX_SPOILER_HEIGHT || parentRect.width > MAX_SPOILER_WIDTH) {
          parentTooLarge = true;
        }
      } catch (e) {
        // If we can't get rect, continue with text length check
      }
      
      if (parentTextLength > 5000 || parentTooLarge) {
        // If parent is too large, only hide the element itself and its immediate children
        // This prevents hiding entire page sections
        if (element.classList && !element.classList.contains(HIDDEN_CLASS)) {
          markElementHidden(element);
        }
        return;
      }
      
      // Since the element we're hiding already passed the date check in shouldHideElement,
      // we know this container contains spoiler content. Hide all text elements in it.
      if (parent) {
        try {
          // Skip if the container itself is part of Google/YouTube search interface
          if (isGoogleSearchInterface(parent) || isYouTubeSearchInterface(parent)) {
            return;
          }
          
          // YouTube: never hide a container that includes the primary video player (incl. Shadow DOM)
          // (prevents blocking main video when search term appears in chips/sidebar)
          const hostname = window.location.hostname || '';
          if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
            if (elementContainsYouTubeMainVideo(parent)) {
              // Only hide the element itself, not the whole container
              if (element.classList && !element.classList.contains(HIDDEN_CLASS)) {
                markElementHidden(element);
              }
              return;
            }
          }
          
          // Also check if container contains search interface elements - don't hide if it does
          try {
            const containerSearchInputs = parent.querySelectorAll('input[type="text"], input[type="search"], textarea[name="q"], textarea[name="search"], [role="combobox"], [role="searchbox"], form, ytd-search');
            if (containerSearchInputs.length > 0) {
              for (const input of containerSearchInputs) {
                if (isGoogleSearchInterface(input) || isYouTubeSearchInterface(input)) {
                  return; // Don't hide container if it contains search interface elements
                }
              }
            }
          } catch (e) {
            // Ignore query errors
          }
          
          // Before hiding the parent container, check for sibling elements that contain accompanying text
          // These are elements that are siblings of the element or its direct parent, positioned below/after it
          try {
            const elementRect = element.getBoundingClientRect();
            
            // Find the direct parent of the element to check its siblings
            let directParent = element.parentElement;
            if (directParent && directParent !== parent && directParent !== document.body && directParent !== document.documentElement) {
              // Check siblings of the direct parent (these might be accompanying text elements)
              const siblings = Array.from(directParent.parentElement?.children || []);
              const directParentIndex = siblings.indexOf(directParent);
              
              if (directParentIndex >= 0) {
                // Check siblings that come after the direct parent (below it visually)
                // Only check the next 2-3 siblings to avoid hiding unrelated content
                for (let i = directParentIndex + 1; i < Math.min(siblings.length, directParentIndex + 3); i++) {
                  const sibling = siblings[i];
                  if (!sibling || sibling === element || sibling === directParent) continue;
                  
                  // Skip if already hidden
                  if (sibling.classList && sibling.classList.contains(HIDDEN_CLASS)) continue;
                  
                  // Skip if it's part of Google search interface
                  if (isGoogleSearchInterface(sibling) || isYouTubeSearchInterface(sibling)) continue;
                  
                  // Check if sibling contains text that looks like accompanying text
                  const siblingText = (sibling.textContent || '').trim();
                  const siblingTextLength = siblingText.length;
                  
                  // Accompanying text is typically short to medium (10-1000 characters)
                  // Be more lenient with length to catch more cases
                  if (siblingTextLength >= 10 && siblingTextLength <= 1000) {
                    try {
                      const siblingRect = sibling.getBoundingClientRect();
                      
                      // Check if sibling is visually close (within 300px vertically - more lenient)
                      const verticalDistance = Math.abs(siblingRect.top - elementRect.bottom);
                      const isCloseVertically = verticalDistance < 300;
                      
                      // Also check if they're in similar horizontal position (same column)
                      // Be more lenient - only need 30% overlap
                      const horizontalOverlap = Math.max(0, 
                        Math.min(elementRect.right, siblingRect.right) - 
                        Math.max(elementRect.left, siblingRect.left)
                      );
                      const minWidth = Math.min(elementRect.width, siblingRect.width);
                      const isSameColumn = horizontalOverlap > minWidth * 0.3 || horizontalOverlap > 100;
                      
                      if (isCloseVertically && isSameColumn) {
                        // This looks like accompanying text - hide it
                        markElementHidden(sibling);
                      }
                    } catch (e) {
                      // If we can't check position, hide it anyway if it's reasonable size
                      if (siblingTextLength >= 10 && siblingTextLength <= 500) {
                        markElementHidden(sibling);
                      }
                    }
                  }
                }
              }
            }
            
            // Also check siblings of the element itself (if element is directly in parent)
            if (element.parentElement === parent) {
              const elementSiblings = Array.from(parent.children || []);
              const elementIndex = elementSiblings.indexOf(element);
              
              if (elementIndex >= 0) {
                // Check siblings that come after the element
                // Only check the next 2-3 siblings to avoid hiding unrelated content
                for (let i = elementIndex + 1; i < Math.min(elementSiblings.length, elementIndex + 3); i++) {
                  const sibling = elementSiblings[i];
                  if (!sibling || sibling === element) continue;
                  
                  // Skip if already hidden
                  if (sibling.classList && sibling.classList.contains(HIDDEN_CLASS)) continue;
                  
                  // Skip if it's part of Google search interface
                  if (isGoogleSearchInterface(sibling) || isYouTubeSearchInterface(sibling)) continue;
                  
                  // Check if sibling contains text that looks like accompanying text
                  const siblingText = (sibling.textContent || '').trim();
                  const siblingTextLength = siblingText.length;
                  
                  if (siblingTextLength >= 10 && siblingTextLength <= 1000) {
                    try {
                      const siblingRect = sibling.getBoundingClientRect();
                      
                      // Check if sibling is visually close (within 300px vertically)
                      const verticalDistance = Math.abs(siblingRect.top - elementRect.bottom);
                      const isCloseVertically = verticalDistance < 300;
                      
                      // Also check if they're in similar horizontal position
                      const horizontalOverlap = Math.max(0, 
                        Math.min(elementRect.right, siblingRect.right) - 
                        Math.max(elementRect.left, siblingRect.left)
                      );
                      const minWidth = Math.min(elementRect.width, siblingRect.width);
                      const isSameColumn = horizontalOverlap > minWidth * 0.3 || horizontalOverlap > 100;
                      
                      if (isCloseVertically && isSameColumn) {
                        // This looks like accompanying text - hide it
                        markElementHidden(sibling);
                      }
                    } catch (e) {
                      // If we can't check position, hide it anyway if it's reasonable size
                      if (siblingTextLength >= 10 && siblingTextLength <= 500) {
                        markElementHidden(sibling);
                      }
                    }
                  }
                }
              }
            }
            
            // Also check all elements in the parent container that are positioned below the element
            // This catches cases where the accompanying text is nested deeper
            try {
              const allParentElements = parent.querySelectorAll('*');
              for (const candidate of allParentElements) {
                // Skip if already hidden
                if (candidate.classList && candidate.classList.contains(HIDDEN_CLASS)) continue;
                
                // Skip if it's the element itself or contains the element
                if (candidate === element || candidate.contains(element)) continue;
                
                // Skip if it's part of Google search interface
                if (isGoogleSearchInterface(candidate) || isYouTubeSearchInterface(candidate)) continue;
                
                // Skip script and style tags
                if (candidate.tagName === 'SCRIPT' || candidate.tagName === 'STYLE') continue;
                
                // Skip images (handled separately)
                if (candidate.tagName === 'IMG' || candidate.tagName === 'VIDEO' || candidate.tagName === 'PICTURE') continue;
                
                const candidateText = (candidate.textContent || '').trim();
                const candidateTextLength = candidateText.length;
                
                // Check if it's reasonable accompanying text length
                if (candidateTextLength >= 10 && candidateTextLength <= 1000) {
                  try {
                    const candidateRect = candidate.getBoundingClientRect();
                    
                    // Check if candidate is visually positioned below the element
                    const isBelow = candidateRect.top >= elementRect.bottom;
                    const verticalDistance = candidateRect.top - elementRect.bottom;
                    const isCloseVertically = isBelow && verticalDistance < 300;
                    
                    // Check horizontal overlap
                    const horizontalOverlap = Math.max(0, 
                      Math.min(elementRect.right, candidateRect.right) - 
                      Math.max(elementRect.left, candidateRect.left)
                    );
                    const minWidth = Math.min(elementRect.width, candidateRect.width);
                    const isSameColumn = horizontalOverlap > minWidth * 0.3 || horizontalOverlap > 100;
                    
                    if (isCloseVertically && isSameColumn) {
                      // This looks like accompanying text - hide it
                      markElementHidden(candidate);
                    }
                  } catch (e) {
                    // Ignore errors
                  }
                }
              }
            } catch (e) {
              // Ignore errors when checking all elements
            }
          } catch (e) {
            // Ignore errors when checking siblings
          }
          
          // Before hiding the parent container, ensure all accompanying text is hidden
          // This includes any text elements in the parent that are positioned below the element
          // But only check direct children and immediate descendants to avoid hiding unrelated content
          try {
            const elementRect = element.getBoundingClientRect();
            
            // First, check direct children of parent that come after the element
            const parentChildren = Array.from(parent.children || []);
            const elementIndex = parentChildren.indexOf(element);
            
            if (elementIndex >= 0) {
              // Only check the next 1-2 direct children
              for (let i = elementIndex + 1; i < Math.min(parentChildren.length, elementIndex + 2); i++) {
                const child = parentChildren[i];
                if (!child || child === element) continue;
                
                // Skip if already hidden
                if (child.classList && child.classList.contains(HIDDEN_CLASS)) continue;
                
                // Skip if it's part of Google search interface
                if (isGoogleSearchInterface(child) || isYouTubeSearchInterface(child)) continue;
                
                // Skip script and style tags
                if (child.tagName === 'SCRIPT' || child.tagName === 'STYLE') continue;
                
                // Skip images
                if (child.tagName === 'IMG' || child.tagName === 'VIDEO' || child.tagName === 'PICTURE') continue;
                
                const textContent = (child.textContent || '').trim();
                if (textContent.length === 0) continue;
                
                try {
                  const childRect = child.getBoundingClientRect();
                  
                  // Check if this child is positioned below the element
                  const isBelow = childRect.top >= elementRect.bottom;
                  const verticalDistance = childRect.top - elementRect.bottom;
                  
                  // Hide if it's below and within reasonable distance (200px - more restrictive)
                  if (isBelow && verticalDistance < 200) {
                    // Also check if there's any horizontal overlap
                    const horizontalOverlap = Math.max(0, 
                      Math.min(elementRect.right, childRect.right) - 
                      Math.max(elementRect.left, childRect.left)
                    );
                    
                    // Hide if there's significant overlap (at least 50% or 100px)
                    const minWidth = Math.min(elementRect.width, childRect.width);
                    if (horizontalOverlap > minWidth * 0.5 || horizontalOverlap > 100) {
                      markElementHidden(child);
                    }
                  }
                } catch (e) {
                  // Ignore errors
                }
              }
            }
            
            // Also check for text elements within the same direct parent as the element
            // but only if they're immediate children or grandchildren
            if (element.parentElement === parent) {
              const directParentChildren = Array.from(element.parentElement.children || []);
              const directElementIndex = directParentChildren.indexOf(element);
              
              if (directElementIndex >= 0) {
                // Only check the next 1-2 siblings
                for (let i = directElementIndex + 1; i < Math.min(directParentChildren.length, directElementIndex + 2); i++) {
                  const sibling = directParentChildren[i];
                  if (!sibling || sibling === element) continue;
                  
                  // Skip if already hidden
                  if (sibling.classList && sibling.classList.contains(HIDDEN_CLASS)) continue;
                  
                  // Skip if it's part of Google/YouTube search interface
                  if (isGoogleSearchInterface(sibling) || isYouTubeSearchInterface(sibling)) continue;
                  
                  // Skip script and style tags
                  if (sibling.tagName === 'SCRIPT' || sibling.tagName === 'STYLE') continue;
                  
                  // Skip images
                  if (sibling.tagName === 'IMG' || sibling.tagName === 'VIDEO' || sibling.tagName === 'PICTURE') continue;
                  
                  const siblingText = (sibling.textContent || '').trim();
                  if (siblingText.length === 0) continue;
                  
                  // Hide sibling if it has reasonable text length (likely accompanying text)
                  if (siblingText.length >= 10 && siblingText.length <= 500) {
                    try {
                      const siblingRect = sibling.getBoundingClientRect();
                      const verticalDistance = siblingRect.top - elementRect.bottom;
                      
                      // Hide if very close (within 150px)
                      if (verticalDistance >= 0 && verticalDistance < 150) {
                        markElementHidden(sibling);
                      }
                    } catch (e) {
                      // If we can't check position, hide it anyway if reasonable size
                      markElementHidden(sibling);
                    }
                  }
                }
              }
            }
          } catch (e) {
            // Ignore errors
          }
          
          // Also check siblings of the parent container - they might contain accompanying text
          try {
            const elementRect = element.getBoundingClientRect();
            if (parent.parentElement && parent.parentElement !== document.body && parent.parentElement !== document.documentElement) {
              const parentSiblings = Array.from(parent.parentElement.children || []);
              const parentIndex = parentSiblings.indexOf(parent);
              
              if (parentIndex >= 0) {
                // Check siblings that come after the parent (below it visually)
                // Only check the next 1-2 siblings to avoid hiding unrelated content
                for (let i = parentIndex + 1; i < Math.min(parentSiblings.length, parentIndex + 2); i++) {
                  const sibling = parentSiblings[i];
                  if (!sibling || sibling === parent || sibling === element) continue;
                  
                  // Skip if already hidden
                  if (sibling.classList && sibling.classList.contains(HIDDEN_CLASS)) continue;
                  
                  // Skip if it's part of Google/YouTube search interface
                  if (isGoogleSearchInterface(sibling) || isYouTubeSearchInterface(sibling)) continue;
                  
                  const siblingText = (sibling.textContent || '').trim();
                  if (siblingText.length >= 10 && siblingText.length <= 1000) {
                    try {
                      const siblingRect = sibling.getBoundingClientRect();
                      
                      // Check if sibling is visually close (within 400px vertically)
                      const verticalDistance = Math.abs(siblingRect.top - elementRect.bottom);
                      const isCloseVertically = verticalDistance < 400;
                      
                      // Check horizontal overlap
                      const horizontalOverlap = Math.max(0, 
                        Math.min(elementRect.right, siblingRect.right) - 
                        Math.max(elementRect.left, siblingRect.left)
                      );
                      const minWidth = Math.min(elementRect.width, siblingRect.width);
                      const isSameColumn = horizontalOverlap > minWidth * 0.2 || horizontalOverlap > 50;
                      
                      if (isCloseVertically && isSameColumn) {
                        // This looks like accompanying text - hide it
                        markElementHidden(sibling);
                      }
                    } catch (e) {
                      // If we can't check position, hide it anyway if it's reasonable size
                      if (siblingText.length >= 10 && siblingText.length <= 500) {
                        markElementHidden(sibling);
                      }
                    }
                  }
                }
              }
            }
          } catch (e) {
            // Ignore errors
          }
          
          // First, hide the parent container itself (this will hide all its content)
          // Since the element we're hiding already passed the date check, we know this container
          // contains spoiler content and should be hidden regardless of its own date check
          if (parent.classList && !parent.classList.contains(HIDDEN_CLASS)) {
            markElementHidden(parent);
            
            // Apply size limits to the container to prevent oversized spoilers
            requestAnimationFrame(() => {
              try {
                const MAX_SPOILER_HEIGHT = 600; // pixels
                const MAX_SPOILER_WIDTH = window.innerWidth * 0.95; // 95% of viewport width
                
                const rect = parent.getBoundingClientRect();
                if (rect.height > MAX_SPOILER_HEIGHT) {
                  parent.style.maxHeight = MAX_SPOILER_HEIGHT + 'px';
                  parent.style.height = MAX_SPOILER_HEIGHT + 'px';
                  parent.style.overflow = 'hidden';
                }
                if (rect.width > MAX_SPOILER_WIDTH) {
                  parent.style.maxWidth = MAX_SPOILER_WIDTH + 'px';
                  parent.style.width = MAX_SPOILER_WIDTH + 'px';
                }
              } catch (e) {
                // Ignore errors
              }
            });
          }
          
          // Also explicitly hide all text-containing elements within the container
          // This ensures everything is hidden even if the container CSS doesn't catch it
          const allElements = parent.querySelectorAll('*');
          
          allElements.forEach(el => {
            // Skip if already hidden
            if (el.classList && el.classList.contains(HIDDEN_CLASS)) return;
            
            // Skip script and style tags
            if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
            
            // Skip Google search interface elements
            if (isGoogleSearchInterface(el) || isYouTubeSearchInterface(el)) return;
            
            // Skip images (handled separately by hideRelatedImages)
            if (el.tagName === 'IMG' || el.tagName === 'VIDEO' || el.tagName === 'PICTURE') return;
            
            // Check if element has text content (including nested text)
            const text = el.textContent || '';
            const directText = Array.from(el.childNodes || [])
              .filter(node => node.nodeType === Node.TEXT_NODE)
              .map(node => node.textContent || '')
              .join(' ')
              .trim();
            
            // Hide if it has meaningful text (more than just whitespace)
            // Also hide elements that contain text nodes even if they're nested
            // Be more aggressive - hide any element with text, even if it's just a few characters
            if (text.trim().length > 0 || directText.trim().length > 0) {
              markElementHidden(el);
            }
          });
          
          // Also check for text nodes that might not be wrapped in elements
          // and ensure all P, SPAN, DIV, and other text containers are hidden
          const textContainers = parent.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6, li, td, th, label, a, strong, em, b, i, u, article, section, header, footer, main, aside, blockquote, pre, code');
          textContainers.forEach(container => {
            if (container.classList && !container.classList.contains(HIDDEN_CLASS)) {
              // Skip if it's part of Google search interface
              if (isGoogleSearchInterface(container) || isYouTubeSearchInterface(container)) return;
              
              // Skip if it's an image container
              if (container.tagName === 'IMG' || container.tagName === 'VIDEO' || container.tagName === 'PICTURE') return;
              
              // Hide if it has text content
              const text = container.textContent || '';
              if (text.trim().length > 0) {
                markElementHidden(container);
              }
            }
          });
          
          // Also use TreeWalker to find all text nodes and wrap them if needed
          // This ensures we catch text that's not in any container
          try {
            const walker = document.createTreeWalker(
              parent,
              NodeFilter.SHOW_TEXT,
              {
                acceptNode: function(node) {
                  // Skip if parent is already hidden
                  if (node.parentElement && node.parentElement.classList.contains(HIDDEN_CLASS)) {
                    return NodeFilter.FILTER_REJECT;
                  }
                  // Skip if text is empty or just whitespace
                  if (!node.textContent || !node.textContent.trim()) {
                    return NodeFilter.FILTER_REJECT;
                  }
                  // Skip if in script or style
                  if (node.parentElement && 
                      (node.parentElement.tagName === 'SCRIPT' || node.parentElement.tagName === 'STYLE')) {
                    return NodeFilter.FILTER_REJECT;
                  }
                  // Skip if in Google search interface
                  if (node.parentElement && (isGoogleSearchInterface(node.parentElement) || isYouTubeSearchInterface(node.parentElement))) {
                    return NodeFilter.FILTER_REJECT;
                  }
                  return NodeFilter.FILTER_ACCEPT;
                }
              }
            );
            
            const textNodesToWrap = [];
            let textNode;
            while (textNode = walker.nextNode()) {
              textNodesToWrap.push(textNode);
            }
            
            // Wrap text nodes in spans with hidden class
            textNodesToWrap.forEach(textNode => {
              try {
                if (textNode.parentElement && !textNode.parentElement.classList.contains(HIDDEN_CLASS)) {
                  const span = document.createElement('span');
                  markElementHidden(span);
                  textNode.parentElement.insertBefore(span, textNode);
                  span.appendChild(textNode);
                }
              } catch (e) {
                // Ignore errors when wrapping text nodes
              }
            });
          } catch (e) {
            // Ignore errors when processing text nodes
          }
        } catch (e) {
          // Ignore errors when querying elements
        }
      }
    } catch (e) {
      // If hiding related text fails, ignore it
    }
  }

  // Hide images in related elements (parent container and siblings)
  function hideRelatedImages(element) {
    try {
      if (!element || !element.parentElement) return;
      
      // Find the meaningful parent container (article, news item, etc.)
      // Common containers: article, div with specific classes, a (link), li (list item)
      let parent = element.parentElement;
      let depth = 0;
      const maxDepth = 6;
      const meaningfulContainers = ['ARTICLE', 'LI', 'DIV', 'A', 'SECTION', 'FIGURE'];
      
      // First, try to find a meaningful container
      while (parent && depth < maxDepth) {
        // Check if this is a meaningful container
        const isMeaningful = meaningfulContainers.includes(parent.tagName) ||
                             parent.classList.length > 0 ||
                             parent.getAttribute('role') === 'article' ||
                             parent.getAttribute('itemprop') ||
                             parent.querySelector('img, picture, video');
        
        if (isMeaningful) {
          // Only hide images that are directly related to keywords (check each image individually)
          // Don't hide images of teammates just because they're in the same article
          try {
            const images = parent.querySelectorAll('img, picture img, video');
            images.forEach(img => {
              if (img && img.classList && !img.classList.contains(HIDDEN_CLASS)) {
                // Only hide if the image itself is related to keywords (checked by shouldHideImage)
                if (shouldHideImage(img)) {
                  // Find the closest meaningful container for the image
                  let imgContainer = img.parentElement;
                  let imgDepth = 0;
                  const maxImgDepth = 3;
                  
                  while (imgContainer && imgDepth < maxImgDepth) {
                    // Stop if we've reached the parent container we're already hiding
                    if (imgContainer === parent) {
                      // Image is already in the container we're hiding, so it will be hidden
                      break;
                    }
                    
                    // Check if this is a good container to hide
                    if (imgContainer.tagName !== 'BODY' && 
                        imgContainer.tagName !== 'HTML' &&
                        imgContainer !== document.body && 
                        imgContainer !== document.documentElement &&
                        (meaningfulContainers.includes(imgContainer.tagName) || 
                         imgContainer.classList.length > 0)) {
                      // Hide this container
                      if (!imgContainer.classList.contains(HIDDEN_CLASS)) {
                        markElementHidden(imgContainer);
                      }
                      break;
                    }
                    
                    imgContainer = imgContainer.parentElement;
                    imgDepth++;
                  }
                  
                  // If we didn't find a good container, hide the image directly
                  if (imgDepth >= maxImgDepth || !imgContainer || 
                      imgContainer === document.body || imgContainer === document.documentElement) {
                    if (img.classList && !img.classList.contains(HIDDEN_CLASS)) {
                      markElementHidden(img);
                    }
                  }
                }
              }
            });
          } catch (e) {
            // Ignore errors when querying images
          }
          
          // Also check direct siblings for images (common in Google search results)
          if (parent.parentElement) {
            try {
              const siblings = Array.from(parent.parentElement.children || []);
              siblings.forEach(sibling => {
                if (sibling !== parent && sibling !== element) {
                  // Check if sibling is part of the same item (e.g., thumbnail + text)
                  // Look for images in sibling
                  const siblingImages = sibling.querySelectorAll('img, picture img, video');
                  if (siblingImages.length > 0) {
                    // Check if sibling is visually close (same level, similar structure)
                    const siblingRect = sibling.getBoundingClientRect();
                    const elementRect = element.getBoundingClientRect();
                    const parentRect = parent.getBoundingClientRect();
                    
                    // If sibling is visually close to the element or parent, check its images
                    const isClose = Math.abs(siblingRect.top - elementRect.top) < 200 ||
                                   Math.abs(siblingRect.top - parentRect.top) < 200;
                    
                    if (isClose) {
                      siblingImages.forEach(img => {
                        if (img && img.classList && !img.classList.contains(HIDDEN_CLASS)) {
                          // Only hide if the image itself is related to keywords
                          if (shouldHideImage(img)) {
                            let imgContainer = img.parentElement;
                            let imgDepth = 0;
                            const maxImgDepth = 2;
                            
                            while (imgContainer && imgDepth < maxImgDepth) {
                              if (imgContainer.tagName !== 'BODY' && 
                                  imgContainer.tagName !== 'HTML' &&
                                  imgContainer !== document.body && 
                                  imgContainer !== document.documentElement) {
                                if (!imgContainer.classList.contains(HIDDEN_CLASS)) {
                                  markElementHidden(imgContainer);
                                }
                                break;
                              }
                              imgContainer = imgContainer.parentElement;
                              imgDepth++;
                            }
                            
                            if (imgDepth >= maxImgDepth || !imgContainer || 
                                imgContainer === document.body || imgContainer === document.documentElement) {
                              if (img.classList && !img.classList.contains(HIDDEN_CLASS)) {
                                markElementHidden(img);
                              }
                            }
                          }
                        }
                      });
                    }
                  }
                }
              });
            } catch (e) {
              // Ignore errors when checking siblings
            }
          }
          
          // Found a meaningful container, stop here
          break;
        }
        
        parent = parent.parentElement;
        depth++;
      }
    } catch (e) {
      // If hiding related images fails, ignore it
    }
  }

  // Hide element and show emoji instead
  function hideElement(element) {
    try {
      if (!element || !element.classList) return;
      if (element.classList.contains(HIDDEN_CLASS)) return;
      
      // Store original content in data attribute (for potential future use)
      try {
        if (!element.dataset.originalText) {
          element.dataset.originalText = element.textContent || '';
        }
        
        // Store original dimensions and display to preserve them
        const computedStyle = window.getComputedStyle(element);
        if (!element.dataset.originalDisplay) {
          element.dataset.originalDisplay = computedStyle.display || '';
        }
        
        // Store original dimensions BEFORE adding the hidden class
        const rect = element.getBoundingClientRect();
        if (!element.dataset.originalWidth && rect.width > 0) {
          element.dataset.originalWidth = rect.width + 'px';
        }
        if (!element.dataset.originalHeight && rect.height > 0) {
          element.dataset.originalHeight = rect.height + 'px';
        }
        
        // Store original max-width and max-height if they exist
        const maxWidth = computedStyle.maxWidth;
        const maxHeight = computedStyle.maxHeight;
        if (maxWidth && maxWidth !== 'none' && !element.dataset.originalMaxWidth) {
          element.dataset.originalMaxWidth = maxWidth;
        }
        if (maxHeight && maxHeight !== 'none' && !element.dataset.originalMaxHeight) {
          element.dataset.originalMaxHeight = maxHeight;
        }
      } catch (e) {
        // If we can't set dataset, continue anyway
      }
      
      // Add the hidden class (CSS will handle showing emoji and marking content)
      markElementHidden(element);
      
      // Maximum allowed dimensions for spoiler blocks (to prevent oversized blocks)
      const MAX_SPOILER_HEIGHT = 600; // pixels
      const MAX_SPOILER_WIDTH = window.innerWidth * 0.95; // 95% of viewport width
      
      // Apply original dimensions if they were stored to prevent size changes
      // Use requestAnimationFrame to ensure CSS has been applied
      requestAnimationFrame(() => {
        try {
          const rect = element.getBoundingClientRect();
          const currentWidth = rect.width;
          const currentHeight = rect.height;
          
          // Always enforce maximum size limits, regardless of original size
          if (currentHeight > MAX_SPOILER_HEIGHT) {
            element.style.maxHeight = MAX_SPOILER_HEIGHT + 'px';
            element.style.height = MAX_SPOILER_HEIGHT + 'px';
            element.style.overflow = 'hidden';
          }
          
          if (currentWidth > MAX_SPOILER_WIDTH) {
            element.style.maxWidth = MAX_SPOILER_WIDTH + 'px';
            element.style.width = MAX_SPOILER_WIDTH + 'px';
          }
          
          // If we have original dimensions stored, try to preserve them (but still respect max limits)
          if (element.dataset.originalWidth && element.dataset.originalHeight) {
            const originalWidth = parseFloat(element.dataset.originalWidth);
            const originalHeight = parseFloat(element.dataset.originalHeight);
            
            if (!isNaN(originalWidth) && !isNaN(originalHeight)) {
              // Only constrain to original size if it's smaller than max, and current is larger than original
              const maxAllowedWidth = Math.min(originalWidth, MAX_SPOILER_WIDTH);
              const maxAllowedHeight = Math.min(originalHeight, MAX_SPOILER_HEIGHT);
              
              if (currentWidth > maxAllowedWidth * 1.05) {
                element.style.maxWidth = maxAllowedWidth + 'px';
                element.style.width = maxAllowedWidth + 'px';
              }
              if (currentHeight > maxAllowedHeight * 1.05) {
                element.style.maxHeight = maxAllowedHeight + 'px';
                element.style.height = maxAllowedHeight + 'px';
                element.style.overflow = 'hidden';
              }
            }
          }
        } catch (e) {
          // If applying dimensions fails, continue anyway
        }
      });
      
      // Also hide all text elements in the same container
      hideRelatedTextElements(element);
      
      // Also hide images in related elements (parent, siblings)
      hideRelatedImages(element);
    } catch (e) {
      // If hiding fails, ignore it
    }
  }

  // Process a single element
  function processElement(element) {
    try {
      if (!element || element.nodeType !== Node.ELEMENT_NODE || !isEnabled) return false;
      
      if (shouldHideElement(element)) {
        hideElement(element);
        return true; // Element was hidden
      }
      
      return false;
    } catch (e) {
      // If processing fails, return false
      return false;
    }
  }

  // Process all elements on the page (more efficient - process from leaves to root)
  function filterPage() {
    try {
      if (!document.body) return 0;
      
      // Get all elements, but process them in reverse order (children first)
      let allElements;
      try {
        allElements = Array.from(document.querySelectorAll('*:not(script):not(style):not(html):not(head):not(body)'));
      } catch (e) {
        // If querySelector fails, context might be invalid
        return 0;
      }
      
      // Process in reverse to handle children before parents
      let hiddenCount = 0;
      for (let i = allElements.length - 1; i >= 0; i--) {
        try {
          const element = allElements[i];
          // Skip if element is invalid or context is broken
          if (!element || !element.classList) continue;
          
          // Skip if element or any parent is already hidden
          try {
            if (element.classList.contains(HIDDEN_CLASS)) continue;
            if (element.closest && element.closest(`.${HIDDEN_CLASS}`)) continue;
          } catch (e) {
            // If element is detached or invalid, skip it
            continue;
          }
          
          if (processElement(element)) {
            hiddenCount++;
          }
        } catch (e) {
          // Skip this element if processing fails
          continue;
        }
      }
      
      return hiddenCount;
    } catch (e) {
      // If filterPage fails completely, return 0
      return 0;
    }
  }

  // Observer for dynamically added content
  let observer;
  
  function startObserver() {
    if (observer) {
      try {
        observer.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
    }
    if (!document.body) return;
    
    try {
      observer = new MutationObserver(mutations => {
        // Use a small delay to batch multiple mutations
        setTimeout(() => {
          // Check if context is still valid
          if (!document.body || !isEnabled) return;
          
          try {
            mutations.forEach(mutation => {
              mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                  // Skip if already hidden or parent is hidden
                  if (node.classList && node.classList.contains(HIDDEN_CLASS)) return;
                  if (node.closest && node.closest(`.${HIDDEN_CLASS}`)) return;
                  
                  // Process the new node
                  if (processElement(node)) return; // If node was hidden, don't process children
                  
                  // Process all children of the new node (in reverse order)
                  const children = Array.from(node.querySelectorAll('*'));
                  for (let i = children.length - 1; i >= 0; i--) {
                    const child = children[i];
                    if (child.classList && child.classList.contains(HIDDEN_CLASS)) continue;
                    if (child.closest && child.closest(`.${HIDDEN_CLASS}`)) continue;
                    processElement(child);
                  }
                }
              });
            });
          } catch (e) {
            // Ignore errors in mutation processing
            console.warn('Anti-Spoiler: Error processing mutations', e);
          }
        }, 50);
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    } catch (e) {
      console.warn('Anti-Spoiler: Could not start observer', e);
    }
  }

  // Check if extension is enabled
  let isEnabled = true;
  
  // Helper function to safely check chrome APIs
  function isChromeContextValid() {
    try {
      if (typeof chrome === 'undefined') return false;
      if (!chrome.storage || !chrome.storage.local) return false;
      if (!chrome.runtime) return false;
      
      // Try to access runtime.id - if it throws, context is invalid
      try {
        const id = chrome.runtime.id;
        return !!id; // Return true if id exists
      } catch (e) {
        return false;
      }
    } catch (e) {
      return false;
    }
  }
  
  function checkEnabled() {
    // Always inject styles first
    injectStyles();
    
    // Check if chrome.storage is available and context is valid
    if (!isChromeContextValid()) {
      // If storage is not available, default to enabled and proceed
      keywords = [...defaultKeywords];
      isEnabled = true;
      lastGameDate = null; // No date filter
      if (document.body) {
        filterPage();
        startObserver();
      }
      return;
    }
    
    // Load keywords first, then check enabled state
    loadKeywords(() => {
      // After keywords are loaded, check enabled state
      try {
        chrome.storage.local.get(['enabled', 'lastGameDate'], (result) => {
        // Check if context is still valid in callback
        try {
          // Check for runtime errors first
          if (chrome.runtime && chrome.runtime.lastError) {
            // Context invalidated, default to enabled
            isEnabled = true;
            lastGameDate = null;
            if (document.body) {
              filterPage();
              startObserver();
            }
            return;
          }
          
          // Check if context is still valid
          if (!isChromeContextValid()) {
            // Context invalidated, default to enabled
            isEnabled = true;
            lastGameDate = null;
            if (document.body) {
              filterPage();
              startObserver();
            }
            return;
          }
          
          // Load last game date, default to January 9, 2025 if not set
          lastGameDate = result.lastGameDate || '2025-01-09';
          
          isEnabled = result && result.enabled !== false; // Default to enabled
          if (isEnabled) {
            if (document.body) {
              filterPage();
              startObserver();
            }
          } else {
            // Remove hidden class from all elements
            if (document.body) {
              try {
                document.querySelectorAll(`.${HIDDEN_CLASS}`).forEach(el => {
                  el.classList.remove(HIDDEN_CLASS);
                });
              } catch (e) {
                // Ignore errors
              }
            }
            if (observer) {
              try {
                observer.disconnect();
              } catch (e) {
                // Ignore disconnect errors
              }
            }
          }
        } catch (e) {
          // If callback fails, default to enabled
          isEnabled = true;
          lastGameDate = null;
          if (document.body) {
            filterPage();
            startObserver();
          }
        }
        });
      } catch (e) {
        // If storage fails, default to enabled
        isEnabled = true;
        lastGameDate = null;
        if (document.body) {
          filterPage();
          startObserver();
        }
      }
    });
  }

  // Inject styles immediately (before DOM is ready)
  if (document.head) {
    injectStyles();
  } else {
    // If head doesn't exist yet, wait for it
    const styleObserver = new MutationObserver(() => {
      if (document.head) {
        injectStyles();
        styleObserver.disconnect();
      }
    });
    styleObserver.observe(document.documentElement, { childList: true });
  }

  // Initialize
  function init() {
    // Skip chrome:// and extension pages
    const url = window.location.href;
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || 
        url.startsWith('about:') || url.startsWith('moz-extension://')) {
      return;
    }
    
    // Keywords will be loaded in checkEnabled()
    
    // Start filtering as soon as body exists
    function tryInit() {
      if (document.body) {
        checkEnabled();
      } else {
        // Wait for body to be created
        const bodyObserver = new MutationObserver(() => {
          if (document.body) {
            checkEnabled();
            bodyObserver.disconnect();
          }
        });
        if (document.documentElement) {
          bodyObserver.observe(document.documentElement, { childList: true });
        }
        // Also try after a short delay
        setTimeout(() => {
          if (document.body && isEnabled) {
            checkEnabled();
          }
        }, 10);
      }
    }
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', tryInit);
      // Also try immediately in case DOMContentLoaded already fired
      tryInit();
    } else {
      tryInit();
    }
  }

  // Start filtering immediately
  init();
  
  // Listen for messages from popup to reload keywords
  if (isChromeContextValid()) {
    try {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'reloadKeywords') {
          loadKeywords(() => {
            // Re-filter the page with new keywords after they're loaded
            setTimeout(() => {
              if (document.body && isEnabled) {
                // Remove all hidden classes first
                try {
                  document.querySelectorAll(`.${HIDDEN_CLASS}`).forEach(el => {
                    el.classList.remove(HIDDEN_CLASS);
                  });
                } catch (e) {
                  // Ignore errors
                }
                // Re-filter with new keywords
                filterPage();
              }
            }, 100);
          });
          sendResponse({ success: true });
        }
        return true; // Keep channel open for async response
      });
    } catch (e) {
      // Ignore if listener can't be added
    }
  }
  
  // Listen for storage changes (when user toggles extension or changes date)
  if (isChromeContextValid()) {
    try {
      chrome.storage.onChanged.addListener((changes, namespace) => {
        try {
          if (namespace === 'local') {
            if (changes.enabled || changes.lastGameDate || changes.seenLastGame) {
              checkEnabled();
            }
            // Reload keywords when customKeywords, keywordExpansions, or dynamicBlockingKeywords change
            if (changes.customKeywords || changes.keywordExpansions || changes.dynamicBlockingKeywords) {
              loadKeywords(() => {
                // Re-filter the page with new keywords after they're loaded
                setTimeout(() => {
                  if (document.body && isEnabled) {
                    // Remove all hidden classes first
                    try {
                      document.querySelectorAll(`.${HIDDEN_CLASS}`).forEach(el => {
                        el.classList.remove(HIDDEN_CLASS);
                      });
                    } catch (e) {
                      // Ignore errors
                    }
                    // Re-filter with new keywords
                    filterPage();
                  }
                }, 100);
              });
            }
          }
        } catch (e) {
          // Ignore errors in listener callback
        }
      });
    } catch (e) {
      // Ignore if listener can't be added
    }
  }
  
  // Re-filter when page visibility changes (for SPAs)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      setTimeout(() => filterPage(), 100);
    }
  });

  // Re-filter when window finishes loading (catches server-rendered or late content)
  window.addEventListener('load', () => {
    setTimeout(() => {
      if (document.body && isEnabled) filterPage();
    }, 150);
  });

  // Delayed re-filter for dynamically loaded content (e.g. Google knowledge panel, SPAs)
  [2000, 4500, 8000].forEach(delay => {
    setTimeout(() => {
      if (document.body && isEnabled) filterPage();
    }, delay);
  });

})();
