/**
 * SignalScan - Storage Utility
 * Manages synchronized extension settings and local scan history.
 */

export const DEFAULT_SETTINGS = Object.freeze({
  pair: 'BTCUSDT',
  provider: 'binance', // 'binance' | 'twelvedata'
  threshold: 75,       // confidence cutoff (0-100)
  sound: true,         // WebAudio cue on lock/reveal
  autoScan: false,     // rescan on new candle
  accentColor: '#00ff9d', // neon green default (#00ff9d, #00d2ff, #a855f7, #ffb800)
  buttonSize: 44,      // 40, 44, 52
  buttonPos: { right: 24, bottom: 24 },
  cardPos: null,       // custom dragged popup position { left, top }
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
});

/**
 * Safely accesses chrome.storage, falling back to local or memory.
 */
function getStorageArea() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    return chrome.storage.sync || chrome.storage.local;
  }
  return null;
}

/**
 * Load all settings merged with defaults.
 * @returns {Promise<typeof DEFAULT_SETTINGS>}
 */
export async function loadSettings() {
  const area = getStorageArea();
  if (!area) {
    try {
      const raw = localStorage.getItem('signalscan_settings');
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  return new Promise((resolve) => {
    try {
      area.get(DEFAULT_SETTINGS, (items) => {
        void chrome.runtime?.lastError;
        resolve({ ...DEFAULT_SETTINGS, ...(items || {}) });
      });
    } catch {
      resolve({ ...DEFAULT_SETTINGS });
    }
  });
}

/**
 * Save partial settings updates with safe fallback and zero unhandled rejections.
 * @param {Partial<typeof DEFAULT_SETTINGS>} patch
 * @returns {Promise<void>}
 */
export async function saveSettings(patch) {
  const area = getStorageArea();
  if (!area) {
    try {
      const current = await loadSettings();
      const updated = { ...current, ...patch };
      localStorage.setItem('signalscan_settings', JSON.stringify(updated));
    } catch {}
    return;
  }

  return new Promise((resolve) => {
    try {
      area.set(patch, () => {
        if (chrome.runtime?.lastError) {
          try {
            chrome.storage.local?.set(patch, () => {
              void chrome.runtime?.lastError;
              resolve();
            });
          } catch {
            resolve();
          }
        } else {
          resolve();
        }
      });
    } catch {
      resolve();
    }
  });
}

/**
 * Load the last 10 scan results from local history.
 */
export async function loadHistory() {
  const localArea = typeof chrome !== 'undefined' && chrome.storage ? chrome.storage.local : null;
  if (!localArea) {
    try {
      const raw = localStorage.getItem('signalscan_history');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  return new Promise((resolve) => {
    try {
      localArea.get({ signalscan_history: [] }, (res) => {
        void chrome.runtime?.lastError;
        resolve(res?.signalscan_history || []);
      });
    } catch {
      resolve([]);
    }
  });
}

/**
 * Record a new scan result, keeping only the most recent 10 items.
 */
export async function pushHistory(entry) {
  const history = await loadHistory();
  const updated = [entry, ...history].slice(0, 10);

  const localArea = typeof chrome !== 'undefined' && chrome.storage ? chrome.storage.local : null;
  if (!localArea) {
    try {
      localStorage.setItem('signalscan_history', JSON.stringify(updated));
    } catch {}
    return updated;
  }

  return new Promise((resolve) => {
    try {
      localArea.set({ signalscan_history: updated }, () => {
        void chrome.runtime?.lastError;
        resolve(updated);
      });
    } catch {
      resolve(updated);
    }
  });
}

/**
 * Update the most recent pending history record with closing price & win/loss.
 */
export async function resolveLastHistoryEntry(exitPrice) {
  const history = await loadHistory();
  if (!history.length) return history;

  const pending = history.find((h) => h.exitPrice === null && h.direction !== 'NEUTRAL');
  if (!pending) return history;

  pending.exitPrice = exitPrice;
  if (pending.direction === 'UP') {
    pending.won = exitPrice > pending.entryPrice;
  } else if (pending.direction === 'DOWN') {
    pending.won = exitPrice < pending.entryPrice;
  }

  const localArea = typeof chrome !== 'undefined' && chrome.storage ? chrome.storage.local : null;
  if (!localArea) {
    try {
      localStorage.setItem('signalscan_history', JSON.stringify(history));
    } catch {}
    return history;
  }

  return new Promise((resolve) => {
    try {
      localArea.set({ signalscan_history: history }, () => {
        void chrome.runtime?.lastError;
        resolve(history);
      });
    } catch {
      resolve(history);
    }
  });
}
