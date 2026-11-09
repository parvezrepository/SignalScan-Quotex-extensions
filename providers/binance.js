/**
 * SignalScan - Binance Data Provider
 * Supports 1m Kline REST fetching + Live WebSocket Streaming + Exponential Backoff.
 */

export class BinanceProvider {
  constructor(symbol = 'BTCUSDT', onUpdate = null) {
    this.symbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
    this.onUpdate = onUpdate;
    this.candles = [];
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 8;
    this.baseDelay = 1500;
    this.isDestroyed = false;
  }

  /**
   * Set new symbol and reinitialize stream.
   */
  setSymbol(symbol) {
    const clean = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean === this.symbol) return;
    this.symbol = clean;
    this.candles = [];
    this.disconnectWS();
    this.connectWS();
  }

  /**
   * Fetch historical 200 1m candles.
   * Uses background proxy to guarantee zero CSP network errors on broker pages.
   */
  async fetchKlines(limit = 200) {
    const url = `https://api.binance.com/api/v3/klines?symbol=${this.symbol}&interval=1m&limit=${limit}`;

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

    if (!Array.isArray(data)) {
      throw new Error('Invalid candle data from Binance');
    }

    // Binance kline format:
    // [0: open time, 1: open, 2: high, 3: low, 4: close, 5: volume, 6: close time, ...]
    this.candles = data.map((item) => ({
      time: item[0],
      open: parseFloat(item[1]),
      high: parseFloat(item[2]),
      low: parseFloat(item[3]),
      close: parseFloat(item[4]),
      volume: parseFloat(item[5])
    }));

    return this.candles;
  }

  /**
   * Connect to Binance 1m Kline WebSocket stream.
   */
  connectWS() {
    if (this.isDestroyed) return;

    try {
      const streamName = `${this.symbol.toLowerCase()}@kline_1m`;
      const wsUrl = `wss://stream.binance.com:9443/ws/${streamName}`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg && msg.k) {
            this.handleKlineUpdate(msg.k);
          }
        } catch (e) {
          console.warn('[SignalScan] WS parse error:', e);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[SignalScan] WS error:', err);
      };

      this.ws.onclose = () => {
        if (!this.isDestroyed) {
          this.scheduleReconnect();
        }
      };
    } catch (e) {
      console.warn('[SignalScan] Failed to initiate WebSocket:', e);
      this.scheduleReconnect();
    }
  }

  /**
   * Handle incoming live kline tick.
   */
  handleKlineUpdate(k) {
    const candle = {
      time: k.t,
      open: parseFloat(k.o),
      high: parseFloat(k.h),
      low: parseFloat(k.l),
      close: parseFloat(k.c),
      volume: parseFloat(k.v)
    };

    if (this.candles.length === 0) {
      this.candles.push(candle);
    } else {
      const last = this.candles[this.candles.length - 1];
      if (last.time === candle.time) {
        // Update current forming candle
        this.candles[this.candles.length - 1] = candle;
      } else if (candle.time > last.time) {
        // New candle opened!
        this.candles.push(candle);
        if (this.candles.length > 250) {
          this.candles.shift();
        }
      }
    }

    if (typeof this.onUpdate === 'function') {
      this.onUpdate(this.candles, candle);
    }
  }

  /**
   * Exponential backoff reconnect.
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[SignalScan] Max WS reconnect attempts reached.');
      return;
    }
    const delay = Math.min(30000, this.baseDelay * Math.pow(1.8, this.reconnectAttempts));
    this.reconnectAttempts++;
    setTimeout(() => {
      if (!this.isDestroyed) {
        this.connectWS();
      }
    }, delay);
  }

  disconnectWS() {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  destroy() {
    this.isDestroyed = true;
    this.disconnectWS();
    this.candles = [];
    this.onUpdate = null;
  }
}

