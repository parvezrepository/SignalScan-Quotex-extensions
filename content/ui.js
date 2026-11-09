/**
 * SignalScan - UI Component & Shadow DOM Manager
 * Generates ultra-minimalist, isolated user interface elements.
 */

import { formatPair, getCandleCountdown } from '../utils/format.js';

// MHB Logo embedded base64 or extension URL fallback
const MHB_LOGO = (typeof __MHB_LOGO__ !== 'undefined' && __MHB_LOGO__)
  ? __MHB_LOGO__
  : (typeof chrome !== 'undefined' && chrome.runtime?.getURL ? chrome.runtime.getURL('icons/mhb-logo.jpg') : '');

export class SignalScanUI {
  /**
   * @param {ShadowRoot} shadowRoot
   * @param {object} options
   */
  constructor(shadowRoot, options = {}) {
    this.shadow = shadowRoot;
    this.options = options;
    this.isOpen = false;
    this.isSettingsOpen = false;
    this.isDragging = false;
    this.hasMoved = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.btnStartX = 0;
    this.btnStartY = 0;

    // Freely draggable popup card state
    this.isCardDragging = false;
    this.cardStartX = 0;
    this.cardStartY = 0;
    this.cardInitLeft = 0;
    this.cardInitTop = 0;
    this.cardPos = options.cardPos || null;

    this.dom = {};
    this.initDOM();
  }

  initDOM() {
    // 1. Unified Launcher Widget (MHB Logo Button + Mini Settings Gear)
    const launcherWrap = document.createElement('div');
    launcherWrap.className = 'ss-launcher-wrap';
    launcherWrap.innerHTML = `
      <div class="ss-launcher" title="Click to Scan Market (MHB)">
        <div class="ss-launcher-ring"></div>
        <div class="ss-launcher-core">
          ${MHB_LOGO ? `<img class="ss-launcher-img" src="${MHB_LOGO}" alt="MHB" />` : `
          <svg class="ss-launcher-icon" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-dasharray="2 3" stroke-width="1.6" />
            <circle cx="12" cy="12" r="3.5" fill="currentColor" />
            <path d="M12 1v3M12 20v3M1 12h3M20 12h3" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>`}
        </div>
        <div class="ss-launcher-glow"></div>
      </div>
      <button class="ss-mini-settings-btn" title="Settings (CFG)">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      </button>
    `;

    // 2. Main Floating Card
    const card = document.createElement('div');
    card.className = 'ss-card';
    card.innerHTML = `
      <!-- Header -->
      <div class="ss-header">
        <div class="ss-header-left">
          <div class="ss-brand-badge" title="Developed by @PARVEZ_MHB">
            ${MHB_LOGO ? `<img class="ss-header-logo" src="${MHB_LOGO}" alt="Logo" />` : ''}
            <span class="ss-brand-name">MHB</span>
          </div>
          <span class="ss-pair-badge">
            <span class="ss-live-dot"></span>
            <span class="ss-pair-text">BTC/USDT</span>
          </span>
          <span class="ss-countdown-badge">--s</span>
        </div>
        <div class="ss-drag-handle"></div>
        <div class="ss-header-right">
          <button class="ss-btn-icon ss-rescan-btn" title="Rescan (Scan Market)">
            <svg viewBox="0 0 24 24"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          </button>
          <button class="ss-btn-icon ss-settings-btn" title="Settings">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
          <button class="ss-btn-icon ss-close-btn" title="Close">
            <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      <!-- Canvas Wrap -->
      <div class="ss-canvas-wrap">
        <canvas class="ss-canvas"></canvas>
      </div>

      <!-- Footer -->
      <div class="ss-footer">
        <div class="ss-history-dots"></div>
        <div class="ss-mode-badge">1M</div>
      </div>

      <!-- Slide-in Settings -->
      <div class="ss-settings-panel">
        <div class="ss-settings-header">
          <div class="ss-settings-title">
            <svg class="ss-row-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            <span>CFG</span>
          </div>
          <button class="ss-btn-icon ss-settings-back">
            <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="ss-settings-body">
          <!-- Pair Picker -->
          <div class="ss-row">
            <svg class="ss-row-icon" viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
            <select class="ss-select ss-pair-select">
              <optgroup label="Crypto">
                <option value="BTCUSDT">BTC/USDT</option>
                <option value="ETHUSDT">ETH/USDT</option>
                <option value="SOLUSDT">SOL/USDT</option>
                <option value="BNBUSDT">BNB/USDT</option>
              </optgroup>
              <optgroup label="Forex & Metals">
                <option value="EURUSD">EUR/USD</option>
                <option value="GBPUSD">GBP/USD</option>
                <option value="USDJPY">USD/JPY</option>
                <option value="XAUUSD">XAU/USD (Gold)</option>
              </optgroup>
            </select>
          </div>

          <!-- Threshold Slider -->
          <div class="ss-row">
            <svg class="ss-row-icon" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            <div class="ss-slider-wrap">
              <input type="range" class="ss-slider ss-threshold-slider" min="55" max="95" value="75">
              <span class="ss-slider-val ss-threshold-val">75%</span>
            </div>
          </div>

          <!-- Sound Toggle -->
          <div class="ss-row">
            <svg class="ss-row-icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            <div class="ss-toggle ss-sound-toggle ss-checked"><div class="ss-toggle-thumb"></div></div>
          </div>

          <!-- Auto Scan Toggle -->
          <div class="ss-row">
            <svg class="ss-row-icon" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            <div class="ss-toggle ss-auto-toggle"><div class="ss-toggle-thumb"></div></div>
          </div>

          <!-- Accent Swatches -->
          <div class="ss-row">
            <svg class="ss-row-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>
            <div class="ss-swatches">
              <div class="ss-swatch ss-active" data-color="#00ff9d" style="background:#00ff9d;"></div>
              <div class="ss-swatch" data-color="#00d2ff" style="background:#00d2ff;"></div>
              <div class="ss-swatch" data-color="#a855f7" style="background:#a855f7;"></div>
              <div class="ss-swatch" data-color="#ffb800" style="background:#ffb800;"></div>
            </div>
          </div>

          <!-- API Key Input -->
          <div class="ss-row">
            <svg class="ss-row-icon" viewBox="0 0 24 24"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
            <input type="password" class="ss-input ss-api-key" placeholder="12data API Key">
          </div>
        </div>

        <!-- 1-line disclaimer inside Settings only -->
        <div class="ss-disclaimer">Probabilistic analysis, not guaranteed.</div>
      </div>
    `;

    this.shadow.appendChild(launcherWrap);
    this.shadow.appendChild(card);

    this.dom = {
      launcherWrap,
      launcher: launcherWrap.querySelector('.ss-launcher'),
      miniSettingsBtn: launcherWrap.querySelector('.ss-mini-settings-btn'),
      card,
      header: card.querySelector('.ss-header'),
      canvas: card.querySelector('.ss-canvas'),
      canvasWrap: card.querySelector('.ss-canvas-wrap'),
      pairBadge: card.querySelector('.ss-pair-text') || card.querySelector('.ss-pair-badge'),
      countdownBadge: card.querySelector('.ss-countdown-badge'),
      historyDots: card.querySelector('.ss-history-dots'),
      rescanBtn: card.querySelector('.ss-rescan-btn'),
      settingsBtn: card.querySelector('.ss-settings-btn'),
      closeBtn: card.querySelector('.ss-close-btn'),
      settingsPanel: card.querySelector('.ss-settings-panel'),
      settingsBack: card.querySelector('.ss-settings-back'),
      pairSelect: card.querySelector('.ss-pair-select'),
      thresholdSlider: card.querySelector('.ss-threshold-slider'),
      thresholdVal: card.querySelector('.ss-threshold-val'),
      soundToggle: card.querySelector('.ss-sound-toggle'),
      autoToggle: card.querySelector('.ss-auto-toggle'),
      swatches: card.querySelectorAll('.ss-swatch'),
      apiKeyInput: card.querySelector('.ss-api-key')
    };

    this.bindEvents();
    this.startCountdownLoop();
  }

  bindEvents() {
    // Dragging & Click logic for launcher widget (MHB Logo + Mini Settings)
    const launcherWrap = this.dom.launcherWrap;
    const launcher = this.dom.launcher;
    const miniSettingsBtn = this.dom.miniSettingsBtn;

    launcher.addEventListener('pointerdown', (e) => {
      // Don't drag if clicking the mini settings button
      if (e.target.closest('.ss-mini-settings-btn')) return;

      this.isDragging = true;
      this.hasMoved = false;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      const rect = launcherWrap.getBoundingClientRect();
      this.btnStartX = rect.left;
      this.btnStartY = rect.top;
      try {
        launcher.setPointerCapture(e.pointerId);
      } catch (_) {}
    });

    launcher.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;

      if (Math.hypot(dx, dy) > 4) {
        this.hasMoved = true;
      }

      const wrapW = launcherWrap.offsetWidth || 56;
      const wrapH = launcherWrap.offsetHeight || 56;

      // Allow dragging freely ANYWHERE on the screen (including the middle), clamped within viewport
      const newLeft = Math.max(0, Math.min(window.innerWidth - wrapW, this.btnStartX + dx));
      const newTop = Math.max(0, Math.min(window.innerHeight - wrapH, this.btnStartY + dy));

      launcherWrap.style.left = `${newLeft}px`;
      launcherWrap.style.top = `${newTop}px`;
      launcherWrap.style.right = 'auto';
      launcherWrap.style.bottom = 'auto';
    });

    launcher.addEventListener('pointerup', (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      try {
        launcher.releasePointerCapture(e.pointerId);
      } catch (_) {}

      const finalRect = launcherWrap.getBoundingClientRect();
      const pos = {
        left: Math.round(finalRect.left),
        top: Math.round(finalRect.top)
      };

      this.options.onSettingChange?.({
        buttonPos: pos
      });

      if (!this.hasMoved) {
        // User clicked the MHB logo button!
        // "otherwise, popup logo te click korlei market scan howa soro korbe"
        if (!this.isOpen) {
          this.openCard();
        }
        // Immediately start market scan!
        this.options.onTriggerScan?.();
      } else if (this.isOpen && !this.cardPos) {
        // Keep card aligned with launcher if moved
        this.positionCard();
      }
    });

    // Mini Settings button click: Open settings directly!
    miniSettingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();

      if (!this.isOpen) {
        this.openCard();
        this.openSettings();
      } else if (!this.isSettingsOpen) {
        this.openSettings();
      } else {
        this.closeSettings();
      }
    });

    // Dragging logic for the popup card (allows moving it anywhere on the page)
    const card = this.dom.card;
    const header = this.dom.header;

    header.addEventListener('pointerdown', (e) => {
      // Don't drag if clicking buttons inside the header
      if (e.target.closest('button')) return;

      this.isCardDragging = true;
      this.cardStartX = e.clientX;
      this.cardStartY = e.clientY;
      const rect = card.getBoundingClientRect();
      this.cardInitLeft = rect.left;
      this.cardInitTop = rect.top;
      try {
        header.setPointerCapture(e.pointerId);
      } catch (_) {}
    });

    header.addEventListener('pointermove', (e) => {
      if (!this.isCardDragging) return;
      const dx = e.clientX - this.cardStartX;
      const dy = e.clientY - this.cardStartY;

      const cardW = card.offsetWidth || 276;
      const cardH = card.offsetHeight || 216;

      const newLeft = Math.max(10, Math.min(window.innerWidth - cardW - 10, this.cardInitLeft + dx));
      const newTop = Math.max(10, Math.min(window.innerHeight - cardH - 10, this.cardInitTop + dy));

      card.style.left = `${newLeft}px`;
      card.style.top = `${newTop}px`;
      card.style.right = 'auto';
      card.style.bottom = 'auto';
    });

    header.addEventListener('pointerup', (e) => {
      if (!this.isCardDragging) return;
      this.isCardDragging = false;
      try {
        header.releasePointerCapture(e.pointerId);
      } catch (_) {}

      const rect = card.getBoundingClientRect();
      this.cardPos = { left: Math.round(rect.left), top: Math.round(rect.top) };
      this.options.onSettingChange?.({ cardPos: this.cardPos });
    });

    // Tap canvas to rescan
    this.dom.canvasWrap.addEventListener('click', () => {
      if (!this.isSettingsOpen) {
        this.options.onTriggerScan?.();
      }
    });

    // Header buttons
    this.dom.rescanBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.options.onTriggerScan?.();
    });

    this.dom.settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openSettings();
    });

    this.dom.closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeCard();
    });

    this.dom.settingsBack.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeSettings();
    });

    // Settings controls
    this.dom.pairSelect.addEventListener('change', (e) => {
      this.options.onSettingChange?.({ pair: e.target.value });
    });

    this.dom.thresholdSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.dom.thresholdVal.textContent = `${val}%`;
      this.options.onSettingChange?.({ threshold: val });
    });

    this.dom.soundToggle.addEventListener('click', () => {
      const active = this.dom.soundToggle.classList.toggle('ss-checked');
      this.options.onSettingChange?.({ sound: active });
    });

    this.dom.autoToggle.addEventListener('click', () => {
      const active = this.dom.autoToggle.classList.toggle('ss-checked');
      this.options.onSettingChange?.({ autoScan: active });
    });

    this.dom.swatches.forEach((swatch) => {
      swatch.addEventListener('click', () => {
        this.dom.swatches.forEach((s) => s.classList.remove('ss-active'));
        swatch.classList.add('ss-active');
        const color = swatch.getAttribute('data-color');
        this.setAccentColor(color);
        this.options.onSettingChange?.({ accentColor: color });
      });
    });

    this.dom.apiKeyInput.addEventListener('change', (e) => {
      this.options.onSettingChange?.({ apiKeyTwelveData: e.target.value.trim() });
    });

    // Click outside to collapse back to trigger button
    document.addEventListener('pointerdown', (e) => {
      if (!this.isOpen) return;
      const path = e.composedPath();
      const wrap = this.dom.launcherWrap || this.dom.launcher;
      if (!path.includes(this.dom.card) && !path.includes(wrap)) {
        this.closeCard();
      }
    });
  }

  positionCard() {
    const card = this.dom.card;
    const cardW = card.offsetWidth || 272;
    const cardH = card.offsetHeight || 212;
    const pad = 12;

    // If user previously dragged card to a custom position, restore it
    if (this.cardPos && typeof this.cardPos.left === 'number' && typeof this.cardPos.top === 'number') {
      const left = Math.max(pad, Math.min(window.innerWidth - cardW - pad, this.cardPos.left));
      const top = Math.max(pad, Math.min(window.innerHeight - cardH - pad, this.cardPos.top));
      card.style.left = `${left}px`;
      card.style.top = `${top}px`;
      card.style.right = 'auto';
      card.style.bottom = 'auto';
      return;
    }

    const launcher = this.dom.launcherWrap || this.dom.launcher;
    const rect = launcher.getBoundingClientRect();

    // Center card horizontally around launcher
    let left = rect.left + (rect.width / 2) - (cardW / 2);
    let top = rect.top - cardH - pad;

    // Flip below if not enough room on top
    if (top < pad) {
      top = rect.bottom + pad;
    }
    // Clamp inside viewport
    if (left < pad) left = pad;
    if (left + cardW > window.innerWidth - pad) {
      left = window.innerWidth - cardW - pad;
    }
    if (top + cardH > window.innerHeight - pad) {
      top = window.innerHeight - cardH - pad;
    }
    if (top < pad) top = pad;

    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    card.style.right = 'auto';
    card.style.bottom = 'auto';
  }

  toggleCard() {
    if (this.isOpen) {
      this.closeCard();
    } else {
      this.openCard();
    }
  }

  openCard() {
    this.isOpen = true;
    this.positionCard();
    this.dom.card.classList.add('ss-visible');
    const wrap = this.dom.launcherWrap || this.dom.launcher;
    if (wrap) wrap.style.opacity = '0.6';
    this.options.onOpen?.();
  }

  closeCard() {
    this.isOpen = false;
    this.dom.card.classList.remove('ss-visible');
    const wrap = this.dom.launcherWrap || this.dom.launcher;
    if (wrap) wrap.style.opacity = '1';
    this.closeSettings();
    this.options.onClose?.();
  }

  openSettings() {
    this.isSettingsOpen = true;
    this.dom.settingsPanel.classList.add('ss-open');
  }

  closeSettings() {
    this.isSettingsOpen = false;
    this.dom.settingsPanel.classList.remove('ss-open');
  }

  triggerShake() {
    this.dom.card.classList.remove('ss-shake');
    // Force reflow
    void this.dom.card.offsetWidth;
    this.dom.card.classList.add('ss-shake');
  }

  setScanning(active) {
    const wrap = this.dom.launcherWrap || this.dom.launcher;
    if (active) {
      this.dom.launcher.classList.add('ss-scanning');
      wrap.classList.add('ss-scanning');
    } else {
      this.dom.launcher.classList.remove('ss-scanning');
      wrap.classList.remove('ss-scanning');
    }
  }

  setAccentColor(color) {
    this.shadow.host.style.setProperty('--ss-accent', color);
  }

  setButtonPosition(pos) {
    if (!pos) return;
    const wrap = this.dom.launcherWrap || this.dom.launcher;
    const btnW = wrap.offsetWidth || 52;
    const btnH = wrap.offsetHeight || 52;

    if (typeof pos.left === 'number' && typeof pos.top === 'number') {
      const left = Math.max(0, Math.min(window.innerWidth - btnW, pos.left));
      const top = Math.max(0, Math.min(window.innerHeight - btnH, pos.top));
      wrap.style.left = `${left}px`;
      wrap.style.top = `${top}px`;
      wrap.style.right = 'auto';
      wrap.style.bottom = 'auto';
    } else {
      const right = typeof pos.right === 'number' ? pos.right : 24;
      const bottom = typeof pos.bottom === 'number' ? pos.bottom : 24;
      wrap.style.left = 'auto';
      wrap.style.top = 'auto';
      wrap.style.right = `${right}px`;
      wrap.style.bottom = `${bottom}px`;
    }
  }

  setButtonSize(size) {
    this.shadow.host.style.setProperty('--ss-btn-size', `${size}px`);
  }

  updateSettingsValues(settings) {
    if (settings.pair) {
      const displayPair = formatPair(settings.pair);
      const textEl = this.dom.card?.querySelector('.ss-pair-text') || this.dom.pairBadge;
      if (textEl) {
        textEl.textContent = displayPair;
      }

      let found = false;
      for (const opt of this.dom.pairSelect.options) {
        if (opt.value === settings.pair) {
          found = true;
          break;
        }
      }
      if (!found) {
        const customOpt = document.createElement('option');
        customOpt.value = settings.pair;
        customOpt.textContent = displayPair;
        this.dom.pairSelect.appendChild(customOpt);
      }
      this.dom.pairSelect.value = settings.pair;
    }
    if (typeof settings.threshold === 'number') {
      this.dom.thresholdSlider.value = settings.threshold;
      this.dom.thresholdVal.textContent = `${settings.threshold}%`;
    }
    if (settings.sound !== undefined) {
      this.dom.soundToggle.classList.toggle('ss-checked', !!settings.sound);
    }
    if (settings.autoScan !== undefined) {
      this.dom.autoToggle.classList.toggle('ss-checked', !!settings.autoScan);
    }
    if (settings.accentColor) {
      this.setAccentColor(settings.accentColor);
      this.dom.swatches.forEach((s) => {
        s.classList.toggle('ss-active', s.getAttribute('data-color') === settings.accentColor);
      });
    }
    if (settings.buttonPos) {
      this.setButtonPosition(settings.buttonPos);
    }
    if (settings.cardPos) {
      this.cardPos = settings.cardPos;
      if (this.isOpen) {
        this.positionCard();
      }
    }
    if (settings.buttonSize) {
      this.setButtonSize(settings.buttonSize);
    }
    if (settings.apiKeyTwelveData !== undefined) {
      this.dom.apiKeyInput.value = settings.apiKeyTwelveData;
    }
  }

  renderHistoryDots(history = []) {
    const container = this.dom.historyDots;
    container.innerHTML = '';
    const slice = history.slice(0, 10);

    for (let i = 0; i < 10; i++) {
      const dot = document.createElement('div');
      dot.className = 'ss-dot';
      const item = slice[i];

      if (item) {
        if (item.won === true) {
          dot.classList.add('ss-win');
          dot.setAttribute('title', `${item.direction} (Won)`);
        } else if (item.won === false) {
          dot.classList.add('ss-loss');
          dot.setAttribute('title', `${item.direction} (Lost)`);
        } else {
          dot.classList.add('ss-pending');
          dot.setAttribute('title', `${item.direction} (Active)`);
        }
      }
      container.appendChild(dot);
    }
  }

  startCountdownLoop() {
    const updateCountdown = () => {
      const sec = getCandleCountdown();
      this.dom.countdownBadge.textContent = `${sec}s`;
      if (sec <= 5) {
        this.dom.countdownBadge.style.color = 'var(--ss-accent, #00ff9d)';
      } else {
        this.dom.countdownBadge.style.color = 'rgba(255, 255, 255, 0.5)';
      }
    };
    updateCountdown();
    setInterval(updateCountdown, 1000);
  }
}

