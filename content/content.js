/**
 * SignalScan - Content Script Master Controller
 * Injects isolated Shadow DOM, coordinates real-time data streaming, analysis, and canvas animations.
 */

import { loadSettings, saveSettings, loadHistory, pushHistory, resolveLastHistoryEntry } from '../utils/storage.js';
import { detectPairFromPage, getCandleCountdown } from '../utils/format.js';
import { playLockSound, playRevealSound, playErrorSound } from '../utils/audio.js';
import { analyzeMarket } from '../engine/scorer.js';
import { MarketDataProvider } from '../providers/market.js';
import { ScanAnimator } from './animation.js';
import { DisplayChartScanner } from './chart-scanner.js';
import { SignalScanUI } from './ui.js';

class SignalScanController {
  constructor() {
    this.hostEl = null;
    this.shadow = null;
    this.ui = null;
    this.animator = null;
    this.chartScanner = null;
    this.provider = null;
    this.settings = null;
    this.history = [];
    this.isScanning = false;
    this.currentSignal = null;
    this.lastCandleTime = null;
    this.domObserver = null;
    this.autoDetectTimer = null;
  }

  async init() {
    if (document.getElementById('signal-scan-root')) return;

    this.settings = await loadSettings();
    this.history = await loadHistory();

    // Auto-detect initial active asset from page
    const detectedPair = detectPairFromPage();
    if (detectedPair) {
      this.settings.pair = detectedPair;
    }

    this.mountShadowDOM();
    this.initProvider();
    this.listenMessages();
    this.startCandleMonitor();
    this.startDOMAssetWatcher();
  }

  mountShadowDOM() {
    this.hostEl = document.createElement('div');
    this.hostEl.id = 'signal-scan-root';
    this.shadow = this.hostEl.attachShadow({ mode: 'open' });

    // Inject styles
    const styleEl = document.createElement('style');
    let cssText = '';
    try {
      if (typeof __INLINED_STYLES__ !== 'undefined' && __INLINED_STYLES__) {
        cssText = __INLINED_STYLES__;
      }
    } catch {}

    if (cssText) {
      styleEl.textContent = cssText;
      this.shadow.appendChild(styleEl);
    } else {
      const linkEl = document.createElement('link');
      linkEl.rel = 'stylesheet';
      linkEl.href = chrome.runtime?.getURL ? chrome.runtime.getURL('content/styles.css') : '';
      this.shadow.appendChild(linkEl);
    }

    // Initialize UI
    this.ui = new SignalScanUI(this.shadow, {
      onTriggerScan: () => this.runScan(),
      onOpen: () => {
        this.checkDOMAssetChange();
        if (this.currentSignal) {
          this.animator?.showExistingSignal(this.currentSignal, this.provider?.candles);
        } else {
          this.animator?.showIdle();
        }
      },
      onClose: () => {
        // Keeps the display chart projection alive until current candle completes
      },
      onSettingChange: async (patch) => {
        this.settings = { ...this.settings, ...patch };
        await saveSettings(patch);

        if (patch.pair) {
          this.initProvider();
          this.currentSignal = null;
          this.chartScanner?.stop();
          this.animator?.showIdle();
        }
        if (patch.accentColor) {
          this.animator?.setTheme(patch.accentColor);
          this.chartScanner?.setTheme(patch.accentColor);
        }
      }
    });

    this.ui.updateSettingsValues(this.settings);
    this.ui.renderHistoryDots(this.history);

    // Initialize Card Animator
    this.animator = new ScanAnimator(this.ui.dom.canvas, {
      accentColor: this.settings.accentColor || '#00ff9d',
      onLock: () => {
        playLockSound(this.settings.sound);
      },
      onReveal: (signal) => {
        playRevealSound(signal.direction, this.settings.sound);
        this.recordSignalHistory(signal);
      }
    });

    // Initialize Full Display Chart Visual Scanner
    this.chartScanner = new DisplayChartScanner(this.shadow, {
      accentColor: this.settings.accentColor || '#00ff9d',
      onLock: () => {
        playLockSound(this.settings.sound);
      },
      onMinuteComplete: () => {
        // Standby when minute completes (no auto-scan; waits for user click)
      }
    });

    document.documentElement.appendChild(this.hostEl);
  }

  initProvider() {
    if (this.provider) {
      this.provider.destroy();
      this.provider = null;
    }

    const pair = this.settings.pair || 'BTCUSDT';
    this.provider = new MarketDataProvider(pair, this.settings.apiKeyTwelveData, (candles, latest) => {
      this.handleLiveCandle(candles, latest);
    });
  }

  /**
   * Continuous Real-Time DOM Asset Auto-Detection Watcher
   * Listens for tab switches, click events, and DOM mutations on Quotex/Brokers.
   */
  startDOMAssetWatcher() {
    // 1. High frequency polling (every 250ms) to instantly catch tab switches & asset selections
    this.autoDetectTimer = setInterval(() => {
      this.checkDOMAssetChange();
    }, 250);

    // 2. Click events on the page (tab clicks, asset dropdown clicks)
    window.addEventListener('click', () => {
      this.checkDOMAssetChange();
      setTimeout(() => this.checkDOMAssetChange(), 60);
      setTimeout(() => this.checkDOMAssetChange(), 180);
      setTimeout(() => this.checkDOMAssetChange(), 500);
    }, { passive: true });

    // 3. Pointer events (catches drag releases, tab clicks)
    window.addEventListener('pointerup', () => {
      setTimeout(() => this.checkDOMAssetChange(), 100);
    }, { passive: true });

    // 4. MutationObserver on broker tabs/header
    try {
      this.domObserver = new MutationObserver(() => {
        this.checkDOMAssetChange();
      });

      this.domObserver.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'aria-selected', 'data-active']
      });
    } catch {}
  }

  checkDOMAssetChange() {
    const detected = detectPairFromPage();
    if (detected && detected !== this.settings.pair) {
      console.log(`[SignalScan] Asset switch detected: ${this.settings.pair} -> ${detected}`);
      this.settings.pair = detected;
      saveSettings({ pair: detected });

      // Update UI badge to the new asset
      if (this.ui) {
        this.ui.updateSettingsValues(this.settings);
      }

      // Update provider to the new asset
      if (this.provider) {
        this.provider.setSymbol(detected, this.settings.apiKeyTwelveData);
      }

      // Clear previous signal so the new asset is fresh
      this.currentSignal = null;

      // Stop previous chart laser/arrow so it doesn't linger on the new chart
      if (this.chartScanner) {
        this.chartScanner.stop();
      }

      // Show idle / ready state on card - DO NOT auto-scan!
      if (this.animator && this.ui?.isOpen) {
        this.animator.showIdle();
      }
    }
  }

  async runScan() {
    if (this.isScanning) return;
    this.isScanning = true;
    this.ui.setScanning(true);
    this.animator.startLoading();

    // Auto-detect the exact active asset currently on the screen chart
    const activePair = detectPairFromPage() || this.settings.pair;
    if (activePair && activePair !== this.settings.pair) {
      console.log(`[SignalScan] Scan targeted active asset: ${activePair}`);
      this.settings.pair = activePair;
      saveSettings({ pair: activePair });
      this.ui?.updateSettingsValues(this.settings);
      this.provider?.setSymbol(activePair);
    }

    try {
      if (!this.provider) {
        this.initProvider();
      }

      const candles = await this.provider.fetchKlines(100);

      if (!candles || candles.length < 25) {
        throw new Error('Insufficient candle data');
      }

      const signal = analyzeMarket(candles, this.settings);
      this.currentSignal = signal;

      // 1. Start the spectacular visual scanner across the display's chart!
      this.chartScanner.startScan(signal.direction, signal.confidence);

      // 2. Synchronize the mini card animation
      this.animator.startScan(candles, signal);
    } catch (err) {
      console.warn('[SignalScan] Scan failed:', err);
      this.ui.triggerShake();
      playErrorSound(this.settings.sound);
      this.animator.stop();
      this.chartScanner?.stop();
    } finally {
      this.isScanning = false;
      this.ui.setScanning(false);
    }
  }

  async recordSignalHistory(signal) {
    if (!signal || !signal.lastCandle) return;

    const entry = {
      id: Math.random().toString(36).substring(2, 9),
      pair: this.settings.pair,
      timestamp: Date.now(),
      direction: signal.direction,
      confidence: signal.confidence,
      entryPrice: signal.lastCandle.close,
      exitPrice: null,
      won: null
    };

    this.history = await pushHistory(entry);
    this.ui.renderHistoryDots(this.history);
  }

  async handleLiveCandle(candles, latest) {
    if (!latest) return;

    if (this.lastCandleTime && latest.time > this.lastCandleTime) {
      const prevClose = candles[candles.length - 2]?.close || latest.open;
      this.history = await resolveLastHistoryEntry(prevClose);
      this.ui.renderHistoryDots(this.history);
    }
    this.lastCandleTime = latest.time;
  }

  startCandleMonitor() {
    // Keeps countdown and timer synchronized (strictly manual scan; clears expired signals on new minute)
    setInterval(() => {
      const sec = getCandleCountdown();
      if (sec === 59 && this.currentSignal) {
        this.currentSignal = null;
        if (this.animator && this.ui?.isOpen && !this.isScanning) {
          this.animator.showIdle();
        }
      }
    }, 1000);
  }

  listenMessages() {
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.type === 'TRIGGER_SCAN') {
          if (!this.ui.isOpen) {
            this.ui.openCard();
          } else {
            this.runScan();
          }
          sendResponse({ success: true });
        }
      });
    }
  }

  destroy() {
    if (this.autoDetectTimer) clearInterval(this.autoDetectTimer);
    if (this.domObserver) this.domObserver.disconnect();
    if (this.provider) this.provider.destroy();
    if (this.animator) this.animator.stop();
    if (this.chartScanner) this.chartScanner.stop();
    if (this.hostEl) this.hostEl.remove();
  }
}

if (typeof window !== 'undefined') {
  const controller = new SignalScanController();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => controller.init());
  } else {
    controller.init();
  }
}
