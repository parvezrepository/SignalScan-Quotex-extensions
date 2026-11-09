/**
 * SignalScan - Quotex Live Candle Provider
 * Connects directly to the live Quotex M1 candle API endpoint.
 * URL: https://akashqxpro.bdtraderpro.xyz/private/qbot/qx.php?pair={PAIR}&timeframe=M1&count={COUNT}
 */

/**
 * Convert any detected display pair (e.g. AUD/NZD (OTC), USD/INR (OTC))
 * to the API parameter format (e.g. AUDNZD_otc, USDINR_otc).
 * @param {string} rawPair
 * @returns {string}
 */
export function toApiPairSymbol(rawPair) {
  if (!rawPair) return 'AUDNZD_otc';
  const isOTC = /\(OTC\)|OTC/i.test(rawPair);
  const clean = rawPair.replace(/\(OTC\)|OTC/gi, '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  return `${clean}${isOTC ? '_otc' : ''}`;
}

export class QuotexApiProvider {
  constructor(symbol = 'AUD/NZD (OTC)', onUpdate = null) {
    this.symbol = symbol;
    this.onUpdate = onUpdate;
    this.candles = [];
    this.pollInterval = null;
    this.isDestroyed = false;
  }

  setSymbol(symbol) {
    this.symbol = symbol;
    this.candles = [];
  }

  /**
   * Fetch 1-minute historical candles from the Quotex Live Candle API.
   * Uses background proxy to guarantee zero CSP network errors on broker pages.
   * @param {number} limit
   * @returns {Promise<Array<{ time: number, open: number, high: number, low: number, close: number, volume: number }>>}
   */
  async fetchKlines(limit = 100) {
    const apiSymbol = toApiPairSymbol(this.symbol);
    const url = `https://akashqxpro.bdtraderpro.xyz/private/qbot/qx.php?pair=${encodeURIComponent(apiSymbol)}&timeframe=M1&count=${limit}`;

    let json = null;

    // Method 1: Extension Background Fetch Proxy (Bypasses webpage CSP with zero console errors)
    if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.runtime?.sendMessage) {
      try {
        const bgResponse = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: 'PROXY_FETCH', url }, (res) => {
            if (chrome.runtime?.lastError) {
              resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
              resolve(res || { success: false, error: 'Empty proxy response' });
            }
          });
        });

        if (bgResponse && bgResponse.success && bgResponse.data) {
          json = bgResponse.data;
        }
      } catch (_) {
        // Fallback to direct fetch
      }
    }

    // Method 2: Direct Fetch fallback (for test scripts / non-CSP pages)
    if (!json) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          json = await res.json();
        }
      } catch (_) {}
    }

    if (!json || !json.success || !Array.isArray(json.data) || json.data.length === 0) {
      throw new Error(`No candle data returned for ${apiSymbol}`);
    }

    // API returns candles newest first -> reverse to chronological order
    const raw = json.data.slice().reverse();

    this.candles = raw.map((item) => {
      let timeMs = 0;
      if (typeof item.epoch === 'number' && item.epoch > 0) {
        timeMs = item.epoch * 1000;
      } else if (item.time) {
        timeMs = new Date(item.time).getTime();
      } else {
        timeMs = Date.now();
      }

      return {
        time: timeMs,
        open: parseFloat(item.open),
        high: parseFloat(item.high),
        low: parseFloat(item.low),
        close: parseFloat(item.close),
        volume: parseFloat(item.volume) || 100
      };
    });

    return this.candles;
  }

  startPolling(intervalMs = 4000) {
    this.stopPolling();
    this.pollInterval = setInterval(async () => {
      if (this.isDestroyed) return;
      try {
        await this.fetchKlines(100);
        if (this.candles.length > 0 && typeof this.onUpdate === 'function') {
          this.onUpdate(this.candles, this.candles[this.candles.length - 1]);
        }
      } catch (err) {
        // silent retry on poll
      }
    }, intervalMs);
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  destroy() {
    this.isDestroyed = true;
    this.stopPolling();
    this.candles = [];
    this.onUpdate = null;
  }
}

