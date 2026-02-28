// Game Notification Script - Simple overlay that appears automatically

(function() {
  'use strict';
  
  // Helper function to safely check chrome APIs
  function isChromeContextValid() {
    try {
      if (typeof chrome === 'undefined') return false;
      
      // Safely check chrome.storage - accessing it can throw if context is invalidated
      try {
        if (!chrome.storage || !chrome.storage.local) return false;
      } catch (e) {
        return false;
      }
      
      // Safely check chrome.runtime - accessing it can throw if context is invalidated
      try {
        if (!chrome.runtime) return false;
      } catch (e) {
        return false;
      }
      
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
  
  // Check if notification should be shown
  function shouldShowNotification() {
    // Check if user has already answered for current game
    return new Promise((resolve) => {
      // Check if context is valid before making storage call
      if (!isChromeContextValid()) {
        console.log('[Anti-Spoiler] Extension context invalidated, skipping notification');
        resolve(false);
        return;
      }
      
      try {
        chrome.storage.local.get(['currentGame', 'lastNotificationShown', 'lastGameDate'], (result) => {
          try {
            // Check for runtime errors first
            if (chrome.runtime && chrome.runtime.lastError) {
              console.error('[Anti-Spoiler] Storage error:', chrome.runtime.lastError);
              resolve(false);
              return;
            }
            
            // Check if context is still valid in callback
            if (!isChromeContextValid()) {
              console.log('[Anti-Spoiler] Extension context invalidated in callback');
              resolve(false);
              return;
            }
            
            console.log('[Anti-Spoiler] Storage check:', result);
            
            const currentGame = result.currentGame;
            const lastNotificationShown = result.lastNotificationShown;
            const lastGameDate = result.lastGameDate;
            
            // If there's a current game and user hasn't watched it, show notification
            if (currentGame && !currentGame.watched) {
              console.log('[Anti-Spoiler] Current game found, not watched - showing notification');
              // Show notification (user can dismiss it, but it will show again on next page)
              resolve(true);
            } else if (lastGameDate && !currentGame) {
              // If there's a game date but no current game, create a default game
              console.log('[Anti-Spoiler] Game date found but no current game - creating default');
              const defaultGame = {
                id: 'default-game-' + lastGameDate,
                date: lastGameDate,
                watched: false
              };
              
              // Check context before set operation
              if (!isChromeContextValid()) {
                console.log('[Anti-Spoiler] Extension context invalidated before set');
                resolve(false);
                return;
              }
              
              try {
                chrome.storage.local.set({ currentGame: defaultGame }, () => {
                  try {
                    if (chrome.runtime && chrome.runtime.lastError) {
                      console.error('[Anti-Spoiler] Error setting default game:', chrome.runtime.lastError);
                      resolve(false);
                      return;
                    }
                    console.log('[Anti-Spoiler] Default game created');
                    resolve(true);
                  } catch (e) {
                    console.error('[Anti-Spoiler] Error in set callback:', e);
                    resolve(false);
                  }
                });
              } catch (e) {
                console.error('[Anti-Spoiler] Error calling storage.set:', e);
                resolve(false);
              }
            } else {
              console.log('[Anti-Spoiler] No game to show notification for');
              resolve(false);
            }
          } catch (e) {
            console.error('[Anti-Spoiler] Error in shouldShowNotification callback:', e);
            resolve(false);
          }
        });
      } catch (e) {
        console.error('[Anti-Spoiler] Error calling storage.get:', e);
        resolve(false);
      }
    });
  }
  
  // Find position for overlay on Google page
  function findGooglePosition() {
    // Look for Google logo - try multiple selectors
    let googleLogo = document.querySelector('img[alt="Google"]');
    if (!googleLogo) {
      googleLogo = document.querySelector('img[src*="google.com/images"]');
    }
    if (!googleLogo) {
      googleLogo = document.querySelector('a[aria-label*="Google"]');
    }
    if (!googleLogo) {
      // Try to find by text content
      const allLinks = Array.from(document.querySelectorAll('a'));
      googleLogo = allLinks.find(link => link.textContent && link.textContent.includes('Google'));
    }
    
    // Look for "AI mode" or similar button (Hebrew "מצב AI" or English "AI mode")
    let aiModeButton = Array.from(document.querySelectorAll('*')).find(el => 
      el.textContent && (
        el.textContent.trim() === 'AI mode' ||
        el.textContent.includes('AI mode') ||
        el.textContent.trim() === 'מצב AI' ||
        el.textContent.includes('מצב AI') ||
        (el.getAttribute('aria-label') && el.getAttribute('aria-label').includes('AI'))
      )
    );
    
    // Also try to find by looking for the search tabs area
    if (!aiModeButton) {
      const searchTabs = document.querySelector('[role="tablist"], .hdtb-mitem, [data-ved]');
      if (searchTabs) {
        const tabs = Array.from(searchTabs.querySelectorAll('*'));
        aiModeButton = tabs.find(el => 
          el.textContent && (el.textContent.includes('AI mode') || el.textContent.includes('מצב AI') || el.textContent.includes('AI'))
        );
      }
    }
    
    if (googleLogo && aiModeButton) {
      // Get position relative to Google logo and AI mode
      const logoRect = googleLogo.getBoundingClientRect();
      const aiRect = aiModeButton.getBoundingClientRect();
      
      // Position: below Google logo, to the left of AI mode
      // Calculate right position: distance from right edge
      const rightPosition = window.innerWidth - aiRect.left + 10;
      
      return {
        top: logoRect.bottom + 15,
        right: rightPosition,
        position: 'fixed'
      };
    }
    
    // Fallback: try to find search bar and position relative to it
    const searchBar = document.querySelector('input[type="text"][name="q"], textarea[name="q"], [role="combobox"]');
    if (searchBar) {
      const searchRect = searchBar.getBoundingClientRect();
      // Position below search bar, slightly to the right
      return {
        top: searchRect.bottom + 20,
        right: window.innerWidth - searchRect.right + 50,
        position: 'fixed'
      };
    }
    
    return null;
  }
  
  // Create and show notification overlay
  function showNotification() {
    console.log('[Anti-Spoiler] showNotification called');
    
    // Check if overlay already exists
    if (document.getElementById('anti-spoiler-game-notification-overlay')) {
      console.log('[Anti-Spoiler] Overlay already exists, skipping');
      return;
    }
    
    // Try to find Google-specific position
    const googlePos = findGooglePosition();
    
    // Create overlay element
    const overlay = document.createElement('div');
    overlay.id = 'anti-spoiler-game-notification-overlay';
    overlay.className = 'game-notification-overlay';
    
    // Set position based on whether we're on Google or not
    if (googlePos) {
      console.log('[Anti-Spoiler] Using Google-specific position:', googlePos);
      overlay.style.cssText = `
        position: ${googlePos.position};
        top: ${googlePos.top}px;
        right: ${googlePos.right}px;
        background: white;
        border-radius: 8px;
        padding: 10px 15px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        z-index: 999999;
        min-width: 200px;
        max-width: 250px;
        border: 2px solid #667eea;
        animation: slideIn 0.3s ease-out;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        direction: ltr;
        font-size: 13px;
      `;
    } else {
      // Default position (top right) - always show even if Google position not found
      console.log('[Anti-Spoiler] Using default position (top right)');
      overlay.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        border-radius: 8px;
        padding: 10px 15px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        z-index: 999999;
        min-width: 200px;
        max-width: 250px;
        border: 2px solid #667eea;
        animation: slideIn 0.3s ease-out;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        direction: ltr;
        font-size: 13px;
      `;
    }
    
    // Get game info
    // Check if context is valid before making storage call
    if (!isChromeContextValid()) {
      console.log('[Anti-Spoiler] Extension context invalidated, cannot show notification');
      return;
    }
    
    try {
      chrome.storage.local.get(['currentGame'], (result) => {
        try {
          // Check for runtime errors first
          if (chrome.runtime && chrome.runtime.lastError) {
            console.error('[Anti-Spoiler] Storage error in showNotification:', chrome.runtime.lastError);
            return;
          }
          
          // Check if context is still valid in callback
          if (!isChromeContextValid()) {
            console.log('[Anti-Spoiler] Extension context invalidated in showNotification callback');
            return;
          }
          
          const currentGame = result.currentGame;
          const gameTitle = currentGame ? (currentGame.matchup || 'The last game') : 'The last game';
          
          overlay.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
              <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; flex: 1; font-size: 13px; color: #333;">
                <input type="checkbox" id="anti-spoiler-watched-checkbox" style="width: 16px; height: 16px; cursor: pointer; accent-color: #667eea;">
                <span>Did you watch the last game?</span>
              </label>
              <button class="game-notification-close" style="background: none; border: none; font-size: 16px; color: #999; cursor: pointer; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; border-radius: 4px; padding: 0;">×</button>
            </div>
          `;
          
          // Add to page
          document.body.appendChild(overlay);
          console.log('[Anti-Spoiler] Overlay added to page');
          
          // Add CSS animation
          if (!document.getElementById('anti-spoiler-notification-style')) {
            const style = document.createElement('style');
            style.id = 'anti-spoiler-notification-style';
            style.textContent = `
              @keyframes slideIn {
                from {
                  transform: translateX(100%);
                  opacity: 0;
                }
                to {
                  transform: translateX(0);
                  opacity: 1;
                }
              }
              @keyframes slideOut {
                from {
                  transform: translateX(0);
                  opacity: 1;
                }
                to {
                  transform: translateX(100%);
                  opacity: 0;
                }
              }
              #anti-spoiler-game-notification-overlay {
                animation: slideIn 0.3s ease-out;
              }
            `;
            document.head.appendChild(style);
          }
          
          // Handle checkbox and close button
          const checkbox = overlay.querySelector('#anti-spoiler-watched-checkbox');
          const closeBtn = overlay.querySelector('.game-notification-close');
          
          checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
              markGameAsWatched();
              hideNotification();
            }
          });
          
          closeBtn.addEventListener('click', () => {
            hideNotification();
          });
          
          // Mark notification as shown
          if (isChromeContextValid()) {
            try {
              chrome.storage.local.get(['currentGame'], (result) => {
                try {
                  if (chrome.runtime && chrome.runtime.lastError) {
                    console.error('[Anti-Spoiler] Error getting currentGame for notification:', chrome.runtime.lastError);
                    return;
                  }
                  
                  if (!isChromeContextValid()) {
                    console.log('[Anti-Spoiler] Extension context invalidated when marking notification shown');
                    return;
                  }
                  
                  if (result.currentGame) {
                    try {
                      chrome.storage.local.set({ lastNotificationShown: result.currentGame.id }, () => {
                        try {
                          if (chrome.runtime && chrome.runtime.lastError) {
                            console.error('[Anti-Spoiler] Error setting lastNotificationShown:', chrome.runtime.lastError);
                          }
                        } catch (e) {
                          console.error('[Anti-Spoiler] Error in set callback:', e);
                        }
                      });
                    } catch (e) {
                      console.error('[Anti-Spoiler] Error calling storage.set:', e);
                    }
                  }
                } catch (e) {
                  console.error('[Anti-Spoiler] Error in get callback:', e);
                }
              });
            } catch (e) {
              console.error('[Anti-Spoiler] Error calling storage.get:', e);
            }
          }
        } catch (e) {
          console.error('[Anti-Spoiler] Error in showNotification callback:', e);
        }
      });
    } catch (e) {
      console.error('[Anti-Spoiler] Error calling storage.get in showNotification:', e);
    }
  }
  
  // Hide notification
  function hideNotification() {
    const overlay = document.getElementById('anti-spoiler-game-notification-overlay');
    if (overlay) {
      overlay.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => {
        overlay.remove();
      }, 300);
    }
  }
  
  // Mark game as watched
  function markGameAsWatched() {
    if (!isChromeContextValid()) {
      console.log('[Anti-Spoiler] Extension context invalidated, cannot mark game as watched');
      return;
    }
    
    try {
      chrome.runtime.sendMessage({ action: 'markGameWatched' }, (response) => {
        try {
          if (chrome.runtime && chrome.runtime.lastError) {
            console.error('Error marking game as watched:', chrome.runtime.lastError);
            return;
          }
          // Reload page to update filtering
          setTimeout(() => {
            window.location.reload();
          }, 500);
        } catch (e) {
          console.error('[Anti-Spoiler] Error in sendMessage callback:', e);
        }
      });
    } catch (e) {
      console.error('[Anti-Spoiler] Error calling sendMessage:', e);
    }
  }
  
  // Check and show notification when page loads
  function init() {
    console.log('[Anti-Spoiler] Initializing game notification...');
    
    // Check if context is valid before initializing
    if (!isChromeContextValid()) {
      console.log('[Anti-Spoiler] Extension context invalidated, skipping initialization');
      return;
    }
    
    if (document.body) {
      // Wait for page to fully load, especially for Google pages
      setTimeout(() => {
        shouldShowNotification().then((show) => {
          console.log('[Anti-Spoiler] Should show notification:', show);
          if (show) {
            // Try multiple times for Google pages (they load dynamically)
            let attempts = 0;
            const maxAttempts = 10; // Increased attempts
            
            const tryShow = () => {
              attempts++;
              console.log(`[Anti-Spoiler] Attempt ${attempts} to show notification...`);
              
              const googlePos = findGooglePosition();
              console.log('[Anti-Spoiler] Google position found:', googlePos);
              
              // Always show notification after max attempts, even if Google position not found
              if (googlePos || attempts >= maxAttempts) {
                console.log('[Anti-Spoiler] Showing notification...');
                showNotification();
              } else {
                // Wait a bit more and try again
                setTimeout(tryShow, 500);
              }
            };
            
            tryShow();
          }
        });
      }, 2000); // Increased initial delay
    } else {
      // Wait for body to be ready
      const observer = new MutationObserver(() => {
        if (document.body) {
          observer.disconnect();
          console.log('[Anti-Spoiler] Body ready, initializing...');
          setTimeout(() => {
            shouldShowNotification().then((show) => {
              console.log('[Anti-Spoiler] Should show notification:', show);
              if (show) {
                let attempts = 0;
                const maxAttempts = 10;
                
                const tryShow = () => {
                  attempts++;
                  console.log(`[Anti-Spoiler] Attempt ${attempts} to show notification...`);
                  
                  const googlePos = findGooglePosition();
                  console.log('[Anti-Spoiler] Google position found:', googlePos);
                  
                  if (googlePos || attempts >= maxAttempts) {
                    console.log('[Anti-Spoiler] Showing notification...');
                    showNotification();
                  } else {
                    setTimeout(tryShow, 500);
                  }
                };
                
                tryShow();
              }
            });
          }, 2000);
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  }
  
  // Initialize when script loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // Also listen for storage changes to show notification for new games
  if (isChromeContextValid()) {
    try {
      chrome.storage.onChanged.addListener((changes, namespace) => {
        try {
          // Check context validity in listener callback
          if (!isChromeContextValid()) {
            console.log('[Anti-Spoiler] Extension context invalidated in storage listener');
            return;
          }
          
          if (namespace === 'local' && (changes.currentGame || changes.lastGameDate)) {
            console.log('[Anti-Spoiler] Storage changed, checking if should show notification...');
            shouldShowNotification().then((show) => {
              if (show && !document.getElementById('anti-spoiler-game-notification-overlay')) {
                console.log('[Anti-Spoiler] Storage change triggered notification');
                setTimeout(() => {
                  let attempts = 0;
                  const maxAttempts = 5;
                  
                  const tryShow = () => {
                    attempts++;
                    const googlePos = findGooglePosition();
                    
                    if (googlePos || attempts >= maxAttempts) {
                      showNotification();
                    } else {
                      setTimeout(tryShow, 500);
                    }
                  };
                  
                  tryShow();
                }, 1000);
              }
            }).catch((error) => {
              console.error('[Anti-Spoiler] Error in storage change handler:', error);
            });
          }
        } catch (e) {
          console.error('[Anti-Spoiler] Error in storage listener callback:', e);
        }
      });
    } catch (e) {
      console.error('[Anti-Spoiler] Error setting up storage listener:', e);
    }
  }
  
  // Also check periodically in case page loads slowly
  setInterval(() => {
    try {
      // Check context validity before periodic check
      if (!isChromeContextValid()) {
        return;
      }
      
      if (!document.getElementById('anti-spoiler-game-notification-overlay')) {
        shouldShowNotification().then((show) => {
          if (show) {
            console.log('[Anti-Spoiler] Periodic check - should show notification');
            const googlePos = findGooglePosition();
            if (googlePos || document.readyState === 'complete') {
              showNotification();
            }
          }
        }).catch((error) => {
          console.error('[Anti-Spoiler] Error in periodic check:', error);
        });
      }
    } catch (e) {
      console.error('[Anti-Spoiler] Error in periodic check interval:', e);
    }
  }, 5000); // Check every 5 seconds
})();
