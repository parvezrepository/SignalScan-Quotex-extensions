/**
 * SignalScan - WebAudio Synthesizer
 * Generates futuristic, ultra-clean sound effects without external audio assets.
 */

let audioCtx = null;

function getContext() {
  if (!audioCtx && typeof window !== 'undefined') {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Play a futuristic targeting reticle lock pulse.
 */
export function playLockSound(enabled = true) {
  if (!enabled) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(480, now);
  osc.frequency.exponentialRampToValueAtTime(1440, now + 0.08);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.12);
}

/**
 * Play a rich cinematic chime on signal reveal.
 * @param {'UP'|'DOWN'|'NEUTRAL'} direction
 * @param {boolean} enabled
 */
export function playRevealSound(direction, enabled = true) {
  if (!enabled) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  if (direction === 'UP') {
    // Ascending pure dual chime (C6 -> G6)
    [1046.5, 1567.98].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.22, now + idx * 0.06 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.06 + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.45);
    });
  } else if (direction === 'DOWN') {
    // Descending warm resonant chime (G5 -> Eb5)
    [783.99, 622.25].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      // Low pass filter to soften sawtooth
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);

      osc.frequency.setValueAtTime(freq, now + idx * 0.07);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.18, now + idx * 0.07 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.07 + 0.48);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.48);
    });
  } else {
    // Neutral subtle double tick
    [400, 400].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.08, now + idx * 0.08 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.06);
    });
  }
}

/**
 * Subtle error tick.
 */
export function playErrorSound(enabled = true) {
  if (!enabled) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(140, now);
  osc.frequency.linearRampToValueAtTime(100, now + 0.15);

  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.15);
}

