/**
 * SignalScan - Cinematic Scan Canvas Animation
 * High-performance 60fps canvas renderer implementing the 4-phase scanning sequence.
 */

import { getCandleCountdown } from '../utils/format.js';

export class ScanAnimator {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} options
   */
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.options = {
      accentColor: '#00ff9d',
      dangerColor: '#ff3b5c',
      onLock: null,
      onReveal: null,
      ...options
    };

    this.rafId = null;
    this.startTime = null;
    this.phase = 'IDLE'; // 'IDLE' | 'LOADING' | 'SCANNING' | 'COMPLETE'
    this.candles = [];
    this.signal = null;
    this.particles = [];
    this.explosionParticles = [];
    this.hasTriggeredLock = false;
    this.hasTriggeredReveal = false;
    this.reducedMotion = false;

    // Check prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia) {
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    this.setupResolution();
  }

  setupResolution() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || 260;
    const h = rect.height || 180;

    this.width = w;
    this.height = h;

    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);
  }

  setTheme(accentColor) {
    if (accentColor) this.options.accentColor = accentColor;
  }

  startLoading() {
    this.stop();
    this.phase = 'LOADING';
    this.startTime = performance.now();
    this.loop();
  }

  showIdle() {
    this.stop();
    this.phase = 'IDLE';
    this.setupResolution();
    this.startTime = performance.now();
    this.loop();
  }

  showExistingSignal(signal, candles = null) {
    if (candles && candles.length) this.candles = candles.slice(-28);
    this.signal = signal;
    this.phase = 'COMPLETE';
    this.setupResolution();
    this.loop();
  }

  /**
   * Start the complete 4-phase scan sequence.
   * Total duration: ~3.8s
   */
  startScan(candles, signal) {
    this.stop();
    this.setupResolution();
    this.candles = candles.slice(-28); // Focus on last 28 candles for crisp display
    this.signal = signal;
    this.phase = 'SCANNING';
    this.startTime = performance.now();
    this.hasTriggeredLock = false;
    this.hasTriggeredReveal = false;
    this.particles = [];
    this.explosionParticles = [];

    // Pre-populate ambient scan particles
    for (let i = 0; i < 18; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -0.3 - Math.random() * 0.6,
        size: Math.random() * 2 + 1,
        alpha: Math.random() * 0.7 + 0.3
      });
    }

    this.loop();
  }

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  loop() {
    this.render();
    this.rafId = requestAnimationFrame(() => this.loop());
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const now = performance.now();
    const elapsed = now - (this.startTime || now);

    ctx.clearRect(0, 0, w, h);

    if (this.phase === 'IDLE') {
      this.renderIdle(elapsed);
      return;
    }

    if (this.phase === 'LOADING') {
      this.renderSkeleton(elapsed);
      return;
    }

    if (this.phase === 'COMPLETE' && this.signal) {
      this.renderCandles(this.candles.length, 0.4, 1);
      this.renderResultOverlay(1.0);
      return;
    }

    if (this.phase !== 'SCANNING') return;

    if (this.reducedMotion) {
      // Simplified static render for accessibility
      this.renderCandles(this.candles.length, 1);
      if (elapsed > 1000 && !this.hasTriggeredReveal) {
        this.hasTriggeredReveal = true;
        this.options.onReveal?.(this.signal);
      }
      this.renderResultOverlay(1);
      return;
    }

    // Timeline durations (in ms):
    // Phase 1 (0..900): Boot & candle draw
    // Phase 2 (900..2800): Neon sweep & indicator lines
    // Phase 3 (2800..3600): Lock on target candle + haptic shake
    // Phase 4 (3600+): Explode reticle + reveal signal & ghost candle

    let shakeX = 0;
    let shakeY = 0;

    if (elapsed >= 2800 && elapsed < 3500) {
      // Subtle 2px haptic shake
      shakeX = (Math.random() - 0.5) * 2;
      shakeY = (Math.random() - 0.5) * 2;
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // Background Shimmer Grid
    this.renderGrid(elapsed);

    // Compute candle scaling
    const candleCount = this.candles.length;
    let visibleCandles = candleCount;
    let scanProgress = 0;

    if (elapsed < 900) {
      // Phase 1: Boot
      const p1 = elapsed / 900;
      visibleCandles = Math.max(1, Math.floor(candleCount * p1));
      this.renderCandles(visibleCandles, 0.4);
    } else if (elapsed < 2800) {
      // Phase 2: Scan
      const p2 = (elapsed - 900) / 1900;
      scanProgress = p2;
      this.renderCandles(candleCount, 1, scanProgress);
      this.renderIndicators(scanProgress);
      this.renderScanSweep(scanProgress);
      this.renderScanParticles(scanProgress);
    } else if (elapsed < 3600) {
      // Phase 3: Lock
      const p3 = (elapsed - 2800) / 800;
      this.renderCandles(candleCount, 1, 1);
      this.renderIndicators(1);
      this.renderLockReticle(p3);

      if (!this.hasTriggeredLock) {
        this.hasTriggeredLock = true;
        this.options.onLock?.();
      }
    } else {
      // Phase 4: Reveal
      const p4 = Math.min(1, (elapsed - 3600) / 600);
      this.renderCandles(candleCount, 0.5, 1);
      this.renderGhostCandle(p4);
      this.renderExplosion(p4);
      this.renderResultOverlay(p4);

      if (!this.hasTriggeredReveal) {
        this.hasTriggeredReveal = true;
        this.options.onReveal?.(this.signal);
      }
    }

    ctx.restore();
  }

  /**
   * Shimmering skeleton while loading market data
   */
  renderSkeleton(elapsed) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    const grad = ctx.createLinearGradient(0, 0, w, 0);
    const shimmerPos = (elapsed % 1400) / 1400;
    grad.addColorStop(Math.max(0, shimmerPos - 0.3), 'rgba(255, 255, 255, 0.04)');
    grad.addColorStop(shimmerPos, 'rgba(0, 255, 157, 0.16)');
    grad.addColorStop(Math.min(1, shimmerPos + 0.3), 'rgba(255, 255, 255, 0.04)');

    ctx.fillStyle = grad;
    const barWidth = 6;
    const count = 16;
    const gap = (w - 30) / count;

    for (let i = 0; i < count; i++) {
      const bh = 20 + Math.sin(i * 0.7) * 35 + 25;
      const x = 15 + i * gap;
      const y = h / 2 - bh / 2;
      ctx.fillRect(x, y, barWidth, bh);
    }
  }

  /**
   * Ready / Idle screen waiting for user click
   */
  renderIdle(elapsed) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const cx = w / 2;
    const cy = h / 2 - 4;
    const color = this.options.accentColor || '#00ff9d';

    this.renderGrid(elapsed);

    // Glowing target radar pulse
    const pulse = Math.sin(elapsed * 0.0035);
    const radius = 32 + pulse * 3.5;

    ctx.save();
    ctx.translate(cx, cy);

    // Outer subtle ring
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 46, 0, Math.PI * 2);
    ctx.stroke();

    // Concentric dashed scanning circle
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14 + pulse * 6;
    ctx.lineWidth = 1.8;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Crosshairs
    const arm = 12;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -arm - radius);
    ctx.lineTo(0, -radius + 4);
    ctx.moveTo(0, radius - 4);
    ctx.lineTo(0, radius + arm);
    ctx.moveTo(-arm - radius, 0);
    ctx.lineTo(-radius + 4, 0);
    ctx.moveTo(radius - 4, 0);
    ctx.lineTo(radius + arm, 0);
    ctx.stroke();

    // Center pulsating scan icon
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(-5, -8);
    ctx.lineTo(7, 0);
    ctx.lineTo(-5, 8);
    ctx.closePath();
    ctx.fill();

    // Callout text: "CLICK TO SCAN"
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.font = '800 11px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CLICK TO SCAN', 0, 50);

    ctx.restore();
  }

  /**
   * Subtle hex/dot grid background
   */
  renderGrid(elapsed) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const pulse = 0.04 + Math.sin(elapsed * 0.002) * 0.02;

    ctx.strokeStyle = `rgba(255, 255, 255, ${pulse})`;
    ctx.lineWidth = 1;

    // Horizontal guidelines
    for (let y = 30; y < h; y += 35) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Vertical dashed lines
    ctx.setLineDash([2, 6]);
    for (let x = 40; x < w; x += 45) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  /**
   * Map candles into canvas coordinates
   */
  getCandleCoords(candle, index, total) {
    const w = this.width;
    const h = this.height;
    const padX = 14;
    const padY = 24;

    const plotW = w - padX * 2;
    const plotH = h - padY * 2;

    const highs = this.candles.map((c) => c.high);
    const lows = this.candles.map((c) => c.low);
    const minP = Math.min(...lows);
    const maxP = Math.max(...highs);
    const range = maxP - minP || 1;

    const step = plotW / (total - 1 || 1);
    const x = padX + index * step;

    const getY = (val) => padY + (1 - (val - minP) / range) * plotH;

    return {
      x,
      yOpen: getY(candle.open),
      yClose: getY(candle.close),
      yHigh: getY(candle.high),
      yLow: getY(candle.low),
      step
    };
  }

  /**
   * Render candle bars with 3D cylindrical gradients & glowing wicks
   */
  renderCandles(count, opacity = 1, scanProgress = 1) {
    const ctx = this.ctx;
    const total = this.candles.length;
    const scanX = this.width * scanProgress;

    for (let i = 0; i < count; i++) {
      const c = this.candles[i];
      const coords = this.getCandleCoords(c, i, total);
      const isBull = c.close >= c.open;
      const isScanned = coords.x <= scanX;

      const top = Math.min(coords.yOpen, coords.yClose);
      const bottom = Math.max(coords.yOpen, coords.yClose);
      const bodyH = Math.max(2.5, bottom - top);
      const bw = Math.max(3, Math.min(8, coords.step * 0.68));

      ctx.save();
      const alpha = isScanned ? opacity : opacity * 0.35;
      ctx.globalAlpha = alpha;

      // 3D Cylindrical Gradient for Candle Body
      const bodyGrad = ctx.createLinearGradient(0, top, 0, bottom);
      if (isBull) {
        bodyGrad.addColorStop(0, '#00ffc4');
        bodyGrad.addColorStop(1, '#00995e');
      } else {
        bodyGrad.addColorStop(0, '#ff4769');
        bodyGrad.addColorStop(1, '#a80d2a');
      }

      // Glowing Candle Wick
      ctx.strokeStyle = isBull ? '#00ffc4' : '#ff4769';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.yHigh);
      ctx.lineTo(coords.x, coords.yLow);
      ctx.stroke();

      // Candle Body with subtle specular rim
      ctx.fillStyle = bodyGrad;
      ctx.fillRect(coords.x - bw / 2, top, bw, bodyH);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(coords.x - bw / 2, top, bw, bodyH);

      // Active leading edge bloom
      if (i === count - 1 && opacity < 1) {
        ctx.shadowColor = isBull ? this.options.accentColor : this.options.dangerColor;
        ctx.shadowBlur = 10;
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  /**
   * Overlays: Dual neon EMA curves with cubic smoothing & S/R levels
   */
  renderIndicators(scanProgress) {
    const ctx = this.ctx;
    const total = this.candles.length;
    const sweepX = this.width * scanProgress;

    ctx.save();

    // 1. Support & Resistance levels
    const highs = this.candles.map((c) => c.high);
    const lows = this.candles.map((c) => c.low);
    const maxP = Math.max(...highs);
    const minP = Math.min(...lows);
    const range = maxP - minP || 1;

    const padY = 24;
    const plotH = this.height - padY * 2;
    const getY = (val) => padY + (1 - (val - minP) / range) * plotH;

    const resY = getY(maxP * 0.999);
    const supY = getY(minP * 1.001);

    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1;

    // Resistance line (Crimson neon)
    ctx.strokeStyle = 'rgba(255, 59, 92, 0.45)';
    ctx.shadowColor = '#ff3b5c';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(10, resY);
    ctx.lineTo(sweepX, resY);
    ctx.stroke();

    // Support line (Emerald neon)
    ctx.strokeStyle = 'rgba(0, 255, 157, 0.45)';
    ctx.shadowColor = '#00ff9d';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(10, supY);
    ctx.lineTo(sweepX, supY);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.shadowBlur = 0;

    // 2. Smooth Fast EMA Ribbon (Cyan neon)
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#00d2ff';
    ctx.shadowColor = '#00d2ff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    for (let i = 0; i < total; i++) {
      const coords = this.getCandleCoords(this.candles[i], i, total);
      if (coords.x > sweepX) break;
      const smoothY = (coords.yOpen + coords.yClose) / 2 + Math.sin(i * 0.45) * 3.5;
      if (i === 0) ctx.moveTo(coords.x, smoothY);
      else ctx.lineTo(coords.x, smoothY);
    }
    ctx.stroke();

    // 3. Trend Golden EMA Ribbon
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = 'rgba(255, 184, 0, 0.75)';
    ctx.shadowColor = '#ffb800';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    for (let i = 0; i < total; i++) {
      const coords = this.getCandleCoords(this.candles[i], i, total);
      if (coords.x > sweepX) break;
      const trendY = (coords.yOpen + coords.yClose) / 2 - Math.sin(i * 0.3) * 5;
      if (i === 0) ctx.moveTo(coords.x, trendY);
      else ctx.lineTo(coords.x, trendY);
    }
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Vertical glowing neon scan line with horizontal anamorphic streak
   */
  renderScanSweep(scanProgress) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const scanX = w * scanProgress;

    ctx.save();

    // Trailing Energy Envelope
    const trailGrad = ctx.createLinearGradient(scanX - 65, 0, scanX, 0);
    trailGrad.addColorStop(0, 'rgba(0, 255, 157, 0)');
    trailGrad.addColorStop(0.65, 'rgba(0, 255, 157, 0.08)');
    trailGrad.addColorStop(1, 'rgba(0, 255, 157, 0.38)');

    ctx.fillStyle = trailGrad;
    ctx.fillRect(Math.max(0, scanX - 65), 0, 65, h);

    // Neon Halo Line
    ctx.strokeStyle = this.options.accentColor;
    ctx.lineWidth = 4;
    ctx.shadowColor = this.options.accentColor;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(scanX, 0);
    ctx.lineTo(scanX, h);
    ctx.stroke();

    // Pure White Diamond Laser Core
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8;
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(scanX, 0);
    ctx.lineTo(scanX, h);
    ctx.stroke();

    // Anamorphic horizontal flare spark at midpoint
    const midY = h / 2;
    const flareW = 60;
    const flareGrad = ctx.createLinearGradient(scanX - flareW, midY, scanX + flareW, midY);
    flareGrad.addColorStop(0, 'rgba(0, 255, 157, 0)');
    flareGrad.addColorStop(0.5, '#ffffff');
    flareGrad.addColorStop(1, 'rgba(0, 255, 157, 0)');
    ctx.fillStyle = flareGrad;
    ctx.fillRect(scanX - flareW, midY - 1, flareW * 2, 2);

    ctx.restore();
  }

  /**
   * Floating data particles drifting from scan line
   */
  renderScanParticles(scanProgress) {
    const ctx = this.ctx;
    const scanX = this.width * scanProgress;

    ctx.save();
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;

      if (p.y < 0) {
        p.y = this.height;
        p.x = scanX + (Math.random() - 0.5) * 20;
      }

      ctx.fillStyle = this.options.accentColor;
      ctx.globalAlpha = p.alpha * 0.7;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Phase 3: Targeting reticle locking onto the last candle
   */
  renderLockReticle(progress) {
    const ctx = this.ctx;
    const total = this.candles.length;
    const last = this.candles[total - 1];
    const coords = this.getCandleCoords(last, total - 1, total);

    const targetX = coords.x;
    const targetY = (coords.yHigh + coords.yLow) / 2;

    // Reticle radius shrinks as it locks
    const r = 28 - progress * 16;
    const rot = progress * Math.PI;

    ctx.save();
    ctx.translate(targetX, targetY);
    ctx.rotate(rot);

    ctx.strokeStyle = this.options.accentColor;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = this.options.accentColor;
    ctx.shadowBlur = 10;

    // Four corner brackets
    const arm = 6;
    [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].forEach((angle) => {
      ctx.save();
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(r, r - arm);
      ctx.lineTo(r, r);
      ctx.lineTo(r - arm, r);
      ctx.stroke();
      ctx.restore();
    });

    // Center crosshair
    ctx.beginPath();
    ctx.arc(0, 0, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.restore();

    // Pulse flash at completion
    if (progress > 0.8) {
      const flashAlpha = (progress - 0.8) * 1.5;
      ctx.fillStyle = `rgba(0, 255, 157, ${Math.min(0.2, flashAlpha)})`;
      ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  /**
   * Explosion of reticle into bursting sparks
   */
  renderExplosion(progress) {
    if (this.explosionParticles.length === 0) {
      const total = this.candles.length;
      const coords = this.getCandleCoords(this.candles[total - 1], total - 1, total);
      const targetX = coords.x;
      const targetY = (coords.yHigh + coords.yLow) / 2;

      for (let i = 0; i < 24; i++) {
        const angle = (i / 24) * Math.PI * 2;
        const speed = Math.random() * 3 + 2;
        this.explosionParticles.push({
          x: targetX,
          y: targetY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1
        });
      }
    }

    const ctx = this.ctx;
    ctx.save();
    for (const ep of this.explosionParticles) {
      ep.x += ep.vx;
      ep.y += ep.vy;
      ep.alpha = Math.max(0, 1 - progress);

      ctx.fillStyle = this.options.accentColor;
      ctx.globalAlpha = ep.alpha;
      ctx.beginPath();
      ctx.arc(ep.x, ep.y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Projected ghost candle for next period
   */
  renderGhostCandle(progress) {
    if (!this.signal || !this.signal.projectedNext) return;

    const ctx = this.ctx;
    const total = this.candles.length;
    const lastCoords = this.getCandleCoords(this.candles[total - 1], total - 1, total);

    const ghostX = lastCoords.x + lastCoords.step * 1.1;
    if (ghostX > this.width - 8) return;

    const isUp = this.signal.direction === 'UP';
    const isDown = this.signal.direction === 'DOWN';
    const color = isUp ? this.options.accentColor : isDown ? this.options.dangerColor : '#888888';

    const diff = isUp ? -18 : isDown ? 18 : 0;
    const top = isUp ? lastCoords.yClose + diff : lastCoords.yClose;
    const h = Math.abs(diff) * progress;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.5 * progress;
    ctx.setLineDash([2, 2]);

    // Ghost body
    ctx.strokeRect(ghostX - 4, top, 8, Math.max(4, h));

    // Ghost projection arrow
    ctx.beginPath();
    ctx.moveTo(ghostX, lastCoords.yClose);
    ctx.lineTo(ghostX, lastCoords.yClose + diff);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Morph into final signal display on canvas
   * Features a MASSIVE glowing 3D-effect directional arrow and dual-track confidence ring.
   */
  renderResultOverlay(progress) {
    if (!this.signal) return;

    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const isUp = this.signal.direction === 'UP';
    const color = isUp ? this.options.accentColor : this.options.dangerColor;

    ctx.save();

    // 1. Deep cinematic carbon vignette with directional color bloom
    const cx = w / 2;
    const cy = h / 2 - 2;

    const bgGrad = ctx.createRadialGradient(cx, cy, 15, cx, cy, w * 0.75);
    if (isUp) {
      bgGrad.addColorStop(0, 'rgba(0, 255, 157, 0.18)');
      bgGrad.addColorStop(0.5, 'rgba(10, 16, 24, 0.78)');
      bgGrad.addColorStop(1, 'rgba(7, 10, 15, 0.96)');
    } else {
      bgGrad.addColorStop(0, 'rgba(255, 59, 92, 0.18)');
      bgGrad.addColorStop(0.5, 'rgba(20, 10, 14, 0.78)');
      bgGrad.addColorStop(1, 'rgba(7, 10, 15, 0.96)');
    }

    ctx.fillStyle = bgGrad;
    ctx.globalAlpha = Math.min(1, progress * 1.25);
    ctx.fillRect(0, 0, w, h);

    // 2. Dual-Track Neon Confidence Ring
    const radius = 52;
    const conf = this.signal.confidence || 82;
    const endAngle = -Math.PI / 2 + (Math.PI * 2 * (conf / 100)) * progress;

    // Outer subtle ambient ring
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Segmented perimeter tick marks
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (radius + 4), cy + Math.sin(a) * (radius + 4));
      ctx.lineTo(cx + Math.cos(a) * (radius + 7), cy + Math.sin(a) * (radius + 7));
      ctx.stroke();
    }

    // Glowing active progress arc
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 24;
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2, endAngle);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // 3. MASSIVE Glowing Directional Arrow
    ctx.save();
    ctx.translate(cx, cy - 8);

    // Pop-in scale bounce
    const scale = Math.min(1, progress * 1.15);
    ctx.scale(scale, scale);

    // Multi-layered outer bloom
    ctx.shadowColor = color;
    ctx.shadowBlur = 35;
    ctx.fillStyle = color;

    // Draw giant bold chevron arrow
    ctx.beginPath();
    if (isUp) {
      // Bold UP Arrow (32px wide, 36px tall)
      ctx.moveTo(0, -26);
      ctx.lineTo(24, -2);
      ctx.lineTo(12, -2);
      ctx.lineTo(12, 18);
      ctx.lineTo(-12, 18);
      ctx.lineTo(-12, -2);
      ctx.lineTo(-24, -2);
    } else {
      // Bold DOWN Arrow (32px wide, 36px tall)
      ctx.moveTo(0, 26);
      ctx.lineTo(24, 2);
      ctx.lineTo(12, 2);
      ctx.lineTo(12, -18);
      ctx.lineTo(-12, -18);
      ctx.lineTo(-12, 2);
      ctx.lineTo(-24, 2);
    }
    ctx.closePath();
    ctx.fill();

    // Inner bright white laser core highlight for 3D neon look
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    if (isUp) {
      ctx.moveTo(0, -22);
      ctx.lineTo(16, -4);
      ctx.lineTo(7, -4);
      ctx.lineTo(7, 14);
      ctx.lineTo(-7, 14);
      ctx.lineTo(-7, -4);
      ctx.lineTo(-16, -4);
    } else {
      ctx.moveTo(0, 22);
      ctx.lineTo(16, 4);
      ctx.lineTo(7, 4);
      ctx.lineTo(7, -14);
      ctx.lineTo(-7, -14);
      ctx.lineTo(-7, 4);
      ctx.lineTo(-16, 4);
    }
    ctx.closePath();
    ctx.globalAlpha = 0.55 * progress;
    ctx.fill();

    ctx.restore();

    // 4. Ultra-clean typography: Confidence % & Action callout
    ctx.shadowBlur = 12;
    ctx.shadowColor = color;
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 16px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const displayConf = Math.round(conf * progress);
    ctx.fillText(`${displayConf}%`, cx, cy + 34);

    // Callout subtitle with live candle countdown
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    ctx.font = '800 12px system-ui, -apple-system, sans-serif';
    if ('letterSpacing' in ctx) {
      try { ctx.letterSpacing = '1px'; } catch (_) {}
    }
    const countdown = getCandleCountdown();
    const actionText = isUp ? 'CALL ▲' : 'PUT ▼';
    ctx.fillText(`${actionText}  [ ${countdown}s ]`, cx, cy + 48);

    ctx.restore();
  }
}

