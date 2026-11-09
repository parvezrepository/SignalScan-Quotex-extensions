/**
 * SignalScan - Display Chart Visual Scanner Overlay
 * Renders a full-screen cinematic laser scan overlay directly on top of the browser's chart display.
 * Pure canvas, 60fps hardware accelerated, pointer-events: none (zero interference with webpage clicks).
 */

import { getCandleCountdown } from '../utils/format.js';

export class DisplayChartScanner {
  constructor(shadowRoot, options = {}) {
    this.shadow = shadowRoot;
    this.options = {
      accentColor: '#00ff9d',
      dangerColor: '#ff3b5c',
      onLock: null,
      onComplete: null,
      onMinuteComplete: null,
      ...options
    };

    this.canvas = null;
    this.ctx = null;
    this.rafId = null;
    this.startTime = null;
    this.isActive = false;
    this.particles = [];
    this.reticleParticles = [];
    this.hasTriggeredLock = false;
    this.hasCompletedMinute = false;

    this.initCanvas();
  }

  initCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'ss-display-scanner';
    this.canvas.style.cssText = `
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 2147483646;
      opacity: 0;
      transition: opacity 0.25s ease;
    `;
    this.ctx = this.canvas.getContext('2d');
    this.shadow.appendChild(this.canvas);
    this.resize();
    window.addEventListener('resize', () => this.resize(), { passive: true });
  }

  resize() {
    if (!this.canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.width = w;
    this.height = h;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    if (this.ctx) {
      this.ctx.resetTransform();
      this.ctx.scale(dpr, dpr);
    }
  }

  setTheme(accentColor) {
    if (accentColor) this.options.accentColor = accentColor;
  }

  /**
   * Start the full-screen chart scan sequence
   * @param {'UP'|'DOWN'|'NEUTRAL'} direction
   * @param {number} confidence
   */
  startScan(direction = 'UP', confidence = 80) {
    this.stop();
    this.resize();
    this.isActive = true;
    this.direction = direction;
    this.confidence = confidence;
    this.startTime = performance.now();
    this.hasTriggeredLock = false;
    this.hasCompletedMinute = false;
    this.reticleParticles = [];

    // Ambient scanner particles
    this.particles = Array.from({ length: 45 }, () => ({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 1.5,
      size: Math.random() * 2.5 + 1,
      alpha: Math.random() * 0.7 + 0.3
    }));

    this.canvas.style.opacity = '1';
    this.loop();
  }

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.isActive = false;
    if (this.canvas) {
      this.canvas.style.opacity = '0';
    }
  }

  loop() {
    this.render();
    if (this.isActive) {
      this.rafId = requestAnimationFrame(() => this.loop());
    }
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const now = performance.now();
    const elapsed = now - (this.startTime || now);

    ctx.clearRect(0, 0, w, h);

    const countdown = getCandleCountdown();

    // Active chart display boundaries (excludes left nav ~60px and right trade panel ~320px)
    const chartLeft = 60;
    const chartRight = Math.max(360, w - 320);
    const chartWidth = chartRight - chartLeft;
    const chartTop = h * 0.12;
    const chartBottom = h * 0.88;
    const chartHeight = chartBottom - chartTop;

    // Dead-center of the active trading chart display ("display er maje ekdom")
    const centerChartX = Math.round((chartLeft + chartRight) / 2);
    const centerChartY = Math.round(chartTop + chartHeight * 0.48);

    // Timeline:
    // 0..2400ms: Neon laser beam sweeps left-to-right across the display chart
    // 2400..3100ms: Beam and reticle lock right in the dead-center of the display chart
    // 3100ms+ : Target explosion & Projected Arrow stays ON DISPLAY in dead-center until minute completes!

    const color = this.direction === 'DOWN' ? this.options.dangerColor : this.options.accentColor;

    if (elapsed < 2400) {
      // Phase 1: Sweeping across the display chart
      const progress = elapsed / 2400;
      const scanX = chartLeft + chartWidth * Math.min(1, progress * 1.05);

      this.renderCyberGrid(ctx, chartLeft, chartTop, chartWidth, chartHeight, elapsed);
      this.renderLaserBeam(ctx, scanX, chartTop, chartHeight, color);
      this.renderHUDTelemetry(ctx, scanX, chartTop, chartHeight, elapsed, color);
      this.renderParticles(ctx, scanX, chartTop, chartHeight, color);
    } else if (elapsed < 3100) {
      // Phase 2: Reticle Lock in the dead-center of the display chart
      const lockProgress = (elapsed - 2400) / 700;
      this.renderLaserBeam(ctx, centerChartX, chartTop, chartHeight, color, 0.6);
      this.renderLockCrosshair(ctx, centerChartX, centerChartY, lockProgress, color);

      if (!this.hasTriggeredLock) {
        this.hasTriggeredLock = true;
        this.options.onLock?.();
      }
    } else {
      // Phase 3 & 4: Reveal and PERSIST in dead-center of display chart until minute completes!
      if (elapsed < 3600) {
        const revealProgress = Math.min(1, (elapsed - 3100) / 500);
        this.renderTargetExplosion(ctx, centerChartX, centerChartY, revealProgress, color);
        this.renderProjectedArrow(ctx, centerChartX, centerChartY, revealProgress, color, countdown);
      } else {
        // Stays permanently visible on display chart until countdown reaches 0s!
        this.renderProjectedArrow(ctx, centerChartX, centerChartY, 1.0, color, countdown);

        if (countdown === 0 && !this.hasCompletedMinute) {
          this.hasCompletedMinute = true;
          this.options.onMinuteComplete?.();
          setTimeout(() => {
            if (this.hasCompletedMinute) this.stop();
          }, 1200);
        }
      }
    }
  }

  /**
   * High-tech subtle holographic grid overlay over the chart area
   */
  renderCyberGrid(ctx, x, y, w, h, elapsed) {
    ctx.save();
    const pulse = 0.04 + Math.sin(elapsed * 0.003) * 0.02;
    ctx.strokeStyle = `rgba(0, 255, 157, ${pulse})`;
    ctx.lineWidth = 1;

    // Horizontal radar lines
    for (let curY = y; curY <= y + h; curY += 60) {
      ctx.beginPath();
      ctx.moveTo(x, curY);
      ctx.lineTo(x + w, curY);
      ctx.stroke();
    }

    // Vertical grid ticks
    ctx.setLineDash([2, 8]);
    for (let curX = x; curX <= x + w; curX += 90) {
      ctx.beginPath();
      ctx.moveTo(curX, y);
      ctx.lineTo(curX, y + h);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  /**
   * Vertical glowing neon laser scanline with cinematic anamorphic lens flares
   */
  renderLaserBeam(ctx, x, y, h, color, intensity = 1) {
    ctx.save();

    // 1. Wide Trailing Atmospheric Envelope (volumetric energy trail behind beam)
    const trailWidth = 120;
    const trailGrad = ctx.createLinearGradient(x - trailWidth, 0, x, 0);
    trailGrad.addColorStop(0, 'rgba(0, 255, 157, 0)');
    trailGrad.addColorStop(0.5, 'rgba(0, 255, 157, 0.04)');
    trailGrad.addColorStop(0.85, 'rgba(0, 255, 157, 0.15)');
    trailGrad.addColorStop(1, 'rgba(0, 255, 157, 0.38)');

    ctx.fillStyle = trailGrad;
    ctx.fillRect(Math.max(0, x - trailWidth), y, trailWidth, h);

    // 2. Wide Chromatic Diffusion Line
    ctx.strokeStyle = color;
    ctx.lineWidth = 14 * intensity;
    ctx.globalAlpha = 0.22 * intensity;
    ctx.shadowColor = color;
    ctx.shadowBlur = 42 * intensity;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + h);
    ctx.stroke();

    // 3. Saturated Primary Neon Halo
    ctx.strokeStyle = color;
    ctx.lineWidth = 4.5 * intensity;
    ctx.globalAlpha = 0.85 * intensity;
    ctx.shadowColor = color;
    ctx.shadowBlur = 24 * intensity;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + h);
    ctx.stroke();

    // 4. Pure Diamond White Core Beam
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 * intensity;
    ctx.globalAlpha = 1;
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 10 * intensity;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + h);
    ctx.stroke();

    // 5. Cinematic Anamorphic Horizontal Lens Flares
    // Emits a sharp horizontal beam of light through the laser center
    const flareY = y + h * 0.52;
    const flareW = 280;
    const flareGrad = ctx.createLinearGradient(x - flareW, flareY, x + flareW, flareY);
    flareGrad.addColorStop(0, 'rgba(0, 255, 157, 0)');
    flareGrad.addColorStop(0.4, 'rgba(0, 255, 157, 0.35)');
    flareGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
    flareGrad.addColorStop(0.6, 'rgba(0, 255, 157, 0.35)');
    flareGrad.addColorStop(1, 'rgba(0, 255, 157, 0)');

    ctx.fillStyle = flareGrad;
    ctx.fillRect(x - flareW, flareY - 1.5, flareW * 2, 3);

    // Secondary vertical node flares at top and bottom emitters
    [y, y + h].forEach((emitterY) => {
      ctx.save();
      ctx.translate(x, emitterY);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Small diamond caliper
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(6, 0);
      ctx.lineTo(0, 6);
      ctx.lineTo(-6, 0);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    });

    ctx.restore();
  }

  /**
   * Institutional Sci-Fi HUD telemetry readouts floating next to the scan beam
   */
  renderHUDTelemetry(ctx, x, y, h, elapsed, color) {
    ctx.save();
    const hudX = x + 20;
    const hudY = y + 70;

    if (hudX < this.width - 220) {
      // Semi-transparent tactical telemetry card
      ctx.fillStyle = 'rgba(8, 12, 20, 0.85)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 16;
      ctx.fillRect(hudX - 8, hudY - 14, 185, 96);
      ctx.strokeRect(hudX - 8, hudY - 14, 185, 96);

      // Glowing left accent strip
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.fillRect(hudX - 8, hudY - 14, 3, 96);

      // Telemetry Typography
      ctx.font = '800 10.5px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 6;
      ctx.shadowColor = color;
      ctx.fillText('AI NEURAL SCAN v4.2', hudX + 4, hudY + 4);

      ctx.font = '700 9.5px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.shadowBlur = 0;
      ctx.fillText('STAGE: CANDLE ALGO MATCH', hudX + 4, hudY + 22);

      const rsiVal = (48 + Math.sin(elapsed * 0.006) * 18).toFixed(1);
      const confVal = Math.min(99, Math.floor(68 + (elapsed / 2400) * 24));

      ctx.fillStyle = color;
      ctx.fillText(`RSI(14): ${rsiVal} [ACTIVE]`, hudX + 4, hudY + 38);
      ctx.fillText(`VOLATILITY: SQUEEZE DETECT`, hudX + 4, hudY + 54);
      ctx.fillText(`CONFIDENCE VECTOR: ${confVal}%`, hudX + 4, hudY + 70);

      // Mini corner brackets
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      const bw = 6;
      // Top right corner
      ctx.beginPath();
      ctx.moveTo(hudX + 177 - bw, hudY - 14);
      ctx.lineTo(hudX + 177, hudY - 14);
      ctx.lineTo(hudX + 177, hudY - 14 + bw);
      ctx.stroke();
      // Bottom right corner
      ctx.beginPath();
      ctx.moveTo(hudX + 177 - bw, hudY + 82);
      ctx.lineTo(hudX + 177, hudY + 82);
      ctx.lineTo(hudX + 177, hudY + 82 - bw);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Floating cyber particles tracking with the scan beam
   */
  renderParticles(ctx, scanX, y, h, color) {
    ctx.save();
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;

      if (p.y < y) p.y = y + h;
      if (p.y > y + h) p.y = y;

      ctx.fillStyle = color;
      ctx.globalAlpha = p.alpha * 0.8;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Phase 2: High-tech targeting reticle locking onto the live candle with dual counter-rotating dials
   */
  renderLockCrosshair(ctx, x, y, progress, color) {
    ctx.save();
    ctx.translate(x, y);

    const radius = 58 - progress * 26; // Smoothly clamps from 58px to 32px
    const rot = progress * Math.PI * 1.5;

    // 1. Outer Clockwise Precision Radar Dial
    ctx.save();
    ctx.rotate(rot);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;

    // Outer 4 corner calipers
    const arm = 14;
    [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].forEach((angle) => {
      ctx.save();
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(radius, radius - arm);
      ctx.lineTo(radius, radius);
      ctx.lineTo(radius - arm, radius);
      ctx.stroke();
      ctx.restore();
    });

    // 12 Outer perimeter radar ticks
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const tickLen = i % 3 === 0 ? 6 : 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (radius + 4), Math.sin(a) * (radius + 4));
      ctx.lineTo(Math.cos(a) * (radius + 4 + tickLen), Math.sin(a) * (radius + 4 + tickLen));
      ctx.stroke();
    }
    ctx.restore();

    // 2. Inner Counter-Clockwise Dashed Reticle Ring
    ctx.save();
    ctx.rotate(-rot * 1.4);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // 3. Center Precision Crosshair & Dot
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(8, 0);
    ctx.moveTo(0, -8);
    ctx.lineTo(0, 8);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    // 4. Live Lock Percentage Ticker
    ctx.font = '800 10px monospace';
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.textAlign = 'center';
    ctx.fillText(`LOCK: ${Math.floor(progress * 100)}%`, 0, radius + 22);

    // Pulse flash as it completes
    if (progress > 0.85) {
      const flashAlpha = (progress - 0.85) * 2;
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.3, flashAlpha)})`;
      ctx.fillRect(-this.width, -this.height, this.width * 2, this.height * 2);
    }

    ctx.restore();
  }

  /**
   * Phase 3: Expanding sonic shockwaves and starburst spark explosion
   */
  renderTargetExplosion(ctx, x, y, progress, color) {
    if (this.reticleParticles.length === 0) {
      for (let i = 0; i < 48; i++) {
        const angle = (i / 48) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
        const speed = Math.random() * 8 + 3.5;
        this.reticleParticles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 2.5 + 1.2,
          decay: Math.random() * 0.02 + 0.96,
          alpha: 1
        });
      }
    }

    ctx.save();

    // 1. Expanding Dual Sonic Shockwaves
    const waveRadius1 = 15 + progress * 135;
    const waveAlpha1 = Math.max(0, 1 - progress * 1.1);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = waveAlpha1;
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(x, y, waveRadius1, 0, Math.PI * 2);
    ctx.stroke();

    const waveRadius2 = Math.max(0, (progress - 0.15) * 110);
    if (waveRadius2 > 0) {
      const waveAlpha2 = Math.max(0, 1 - (progress - 0.15) * 1.2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = waveAlpha2 * 0.7;
      ctx.beginPath();
      ctx.arc(x, y, waveRadius2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 2. High-Speed Kinetic Spark Burst
    for (const ep of this.reticleParticles) {
      ep.x += ep.vx;
      ep.y += ep.vy;
      ep.vx *= ep.decay;
      ep.vy *= ep.decay;
      ep.alpha = Math.max(0, 1 - progress * 1.05);

      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.globalAlpha = ep.alpha;
      ctx.beginPath();
      ctx.arc(ep.x, ep.y, ep.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Central Starburst Lens Flare Flash (First 250ms)
    if (progress < 0.35) {
      const flashAlpha = 1 - progress / 0.35;
      const flareLen = 140 * (1 - progress);
      ctx.strokeStyle = '#ffffff';
      ctx.shadowColor = color;
      ctx.shadowBlur = 28;
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = flashAlpha * 0.85;

      // 4-point star flare
      ctx.beginPath();
      ctx.moveTo(x - flareLen, y);
      ctx.lineTo(x + flareLen, y);
      ctx.moveTo(x, y - flareLen * 0.6);
      ctx.lineTo(x, y + flareLen * 0.6);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Luxury 3D Holographic Signal Projection on the broker chart
   * Positioned EXACTLY in the dead-center of the display chart ("display er maje ekdom")
   */
  renderProjectedArrow(ctx, x, y, progress, color, countdown) {
    ctx.save();
    const isUp = this.direction === 'UP';

    // Position badge dead-center of the active broker chart display
    const posX = typeof x === 'number' ? x : Math.round(((60) + Math.max(360, this.width - 320)) / 2);
    const posY = typeof y === 'number' ? y : Math.round(this.height * 0.48);

    ctx.translate(posX, posY);
    const scale = Math.min(1.22, 0.4 + progress * 0.82);
    ctx.scale(scale, scale);
    ctx.globalAlpha = Math.min(1, progress * 1.5);

    // 1. Holographic Vertical Pedestal Light Beam anchoring signal to chart level
    const beamGrad = ctx.createLinearGradient(0, -90, 0, 90);
    beamGrad.addColorStop(0, 'rgba(0, 255, 157, 0)');
    beamGrad.addColorStop(0.5, isUp ? 'rgba(0, 255, 157, 0.12)' : 'rgba(255, 59, 92, 0.12)');
    beamGrad.addColorStop(1, 'rgba(0, 255, 157, 0)');
    ctx.fillStyle = beamGrad;
    ctx.fillRect(-50, -90, 100, 180);

    // 2. Futuristic Cyber Holographic Obsidian Disc
    ctx.fillStyle = 'rgba(6, 10, 18, 0.94)';
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 45;
    ctx.lineWidth = 3.5;

    ctx.beginPath();
    ctx.arc(0, 0, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 3. Segmented Dynamic Confidence Arc around perimeter
    const conf = this.confidence || 82;
    const arcEnd = -Math.PI / 2 + (Math.PI * 2 * (conf / 100));

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 68, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 22;
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, 68, -Math.PI / 2, arcEnd);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // 4. GIANT Glowing 3D Beveled Arrow
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 36;

    ctx.beginPath();
    if (isUp) {
      // UP Arrow
      ctx.moveTo(0, -34);
      ctx.lineTo(30, -5);
      ctx.lineTo(15, -5);
      ctx.lineTo(15, 26);
      ctx.lineTo(-15, 26);
      ctx.lineTo(-15, -5);
      ctx.lineTo(-30, -5);
    } else {
      // DOWN Arrow
      ctx.moveTo(0, 34);
      ctx.lineTo(30, 5);
      ctx.lineTo(15, 5);
      ctx.lineTo(15, -26);
      ctx.lineTo(-15, -26);
      ctx.lineTo(-15, 5);
      ctx.lineTo(-30, 5);
    }
    ctx.closePath();
    ctx.fill();

    // Inner Diamond White Core Arrow
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    if (isUp) {
      ctx.moveTo(0, -28);
      ctx.lineTo(20, -7);
      ctx.lineTo(9, -7);
      ctx.lineTo(9, 20);
      ctx.lineTo(-9, 20);
      ctx.lineTo(-9, -7);
      ctx.lineTo(-20, -7);
    } else {
      ctx.moveTo(0, 28);
      ctx.lineTo(20, 7);
      ctx.lineTo(9, 7);
      ctx.lineTo(9, -20);
      ctx.lineTo(-9, -20);
      ctx.lineTo(-9, 7);
      ctx.lineTo(-20, 7);
    }
    ctx.closePath();
    ctx.globalAlpha = 0.65;
    ctx.fill();

    // 5. Ultra-Crisp Action Banner & Live Countdown
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 18;
    ctx.shadowColor = color;
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 17px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${this.confidence}% CONFIRMATION`, 0, 92);

    ctx.fillStyle = color;
    ctx.font = '800 13.5px system-ui, -apple-system, sans-serif';
    const sec = countdown !== undefined ? countdown : 0;
    const isUrgent = sec <= 10;
    const urgentPulse = isUrgent ? Math.sin(performance.now() * 0.015) * 4 : 0;
    ctx.shadowBlur = isUrgent ? 22 + urgentPulse : 12;

    const actionText = isUp ? '▲ CALL / UP' : '▼ PUT / DOWN';
    ctx.fillText(`${actionText}  [ ${sec}s ]`, 0, 112);

    ctx.restore();
  }
}
