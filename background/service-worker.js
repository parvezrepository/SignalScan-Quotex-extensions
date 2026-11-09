/**
 * SignalScan - Background Service Worker (Manifest V3)
 * Manages commands, lifecycle events, and proxy network requests across page CSP boundaries.
 */

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    const defaults = {
      pair: 'BTCUSDT',
      provider: 'binance',
      threshold: 75,
      sound: true,
      autoScan: false,
      accentColor: '#00ff9d',
      buttonSize: 44,
      buttonPos: { right: 24, bottom: 24 },
      apiKeyTwelveData: '',
      weights: {
        ema: 18,
        rsi: 16,
        macd: 16,
        bollinger: 14,
        stochastic: 12,
        patterns: 14,
        trend: 10
      }
    };
    try {
      chrome.storage.sync.set(defaults, () => {
        if (chrome.runtime?.lastError) {
          try {
            chrome.storage.local?.set(defaults);
          } catch (_) {}
        }
      });
    } catch (_) {}
  }
});

/**
 * Keyboard Shortcut: Alt+S
 * Sends TRIGGER_SCAN to active tab.
 */
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-scan') {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.id) {
        chrome.tabs.sendMessage(activeTab.id, { type: 'TRIGGER_SCAN' }, () => {
          // Consumes runtime.lastError safely if tab is not listening
          void chrome.runtime?.lastError;
        });
      }
    } catch (_) {}
  }
});

/**
 * Message Handler: Background Fetch Proxy
 * Bypasses host website CSP that blocks content scripts from calling external APIs.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.type === 'PROXY_FETCH' && request.url) {
    fetch(request.url)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }
        const data = await res.json();
        sendResponse({ success: true, data });
      })
      .catch((err) => {
        sendResponse({ success: false, error: err?.message || 'Network fetch failed' });
      });
    return true; // Keep message port open for async response
  }
  return false;
});

