// Test script to manually set a new game
// Run this in the browser console on any page with the extension installed

// Set a new game for testing
chrome.runtime.sendMessage({
  action: 'setNewGame',
  game: {
    id: 'test-game-' + Date.now(),
    matchup: 'portland vs houston',
    date: new Date().toISOString().split('T')[0],
    watched: false
  }
}, (response) => {
  console.log('Game set:', response);
});
