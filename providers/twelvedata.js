/**
 * SignalScan - TwelveData Provider (Forex / Gold / Indices)
 * REST candle fetcher with live poll fallback.
 */

export class TwelveDataProvider {
  constructor(symbol = 'EUR/USD', apiKey = '', onUpdate = null) {
    this.symbol = symbol;
    this.apiKey = apiKey;
    this.onUpdate = onUpdate;
    this.candles = [];
    this.pollInterval = null;
    this.isDestroyed = false;
  }

  setSymbol(symbol, apiKey) {
    this.symbol = symbol;
    if (apiKey !== undefined) this.apiKey = apiKey;
    this.candles = [];
  }

  /**
   * Fetch 1-minute historical candles from TwelveData.
   */
  async fetchKlines(limit = 200) {
    if (!this.apiKey) {
      throw new Error('TwelveData API key required for forex/gold pairs');
    }

    const cleanSymbol = encodeURIComponent(this.symbol);
    const url = `https://api.twelvedata.com/time_series?symbol=${cleanSymbol}&interval=1min&outputsize=${limit}&apikey=${this.apiKey}`;

    let data = null;

    if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.runtime?.sendMessage) {
      try {
        const bgResponse = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: 'PROXY_FETCH', url }, (res) => {
            if (chrome.runtime?.lastError) {
              resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
              resolve(res || { success: false });
            }
          });
        });
        if (bgResponse && bgResponse.success && bgResponse.data) {
          data = bgResponse.data;
        }
      } catch (_) {}
    }

    if (!data) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          data = await res.json();
        }
      } catch (_) {}
    }

    if (!data || data.status === 'error' || !Array.isArray(data.values)) {
      throw new Error(data?.message || 'Invalid response from TwelveData');
    }

    // TwelveData returns values newest first -> reverse to chronological order
    const raw = [...data.values].reverse();

    this.candles = raw.map((item) => ({
      time: new Date(item.datetime).getTime(),
      open: parseFloat(item.open),
      high: parseFloat(item.high),
      low: parseFloat(item.low),
      close: parseFloat(item.close),
      volume: parseFloat(item.volume) || 1
    }));

    return this.candles;
  }

  startPolling(intervalMs = 15000) {
    this.stopPolling();
    this.pollInterval = setInterval(async () => {
      if (this.isDestroyed) return;
      try {
        await this.fetchKlines(200);
        if (typeof this.onUpdate === 'function') {
          this.onUpdate(this.candles, this.candles[this.candles.length - 1]);
        }
      } catch (e) {
        console.warn('[SignalScan] TwelveData poll failed:', e);
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

