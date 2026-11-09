/**
 * SignalScan - Weighted Scoring & Direction Decision Engine
 * Integrates multiple technical momentum, mean-reversion, pattern, and trend filters.
 */

import {
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateStochastic,
  calculateATR,
  calculateVWAP,
  detectVolumeSpike
} from './indicators.js';

import {
  detectPatterns,
  findSupportResistance,
  analyzeTrend
} from './patterns.js';

/**
 * Score EMA Alignment & Momentum (-100 to +100)
 */
function scoreEMA(closes) {
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const ema50 = calculateEMA(closes, 50);

  const last = closes.length - 1;
  const v9 = ema9[last];
  const v21 = ema21[last];
  const v50 = ema50[last];
  const price = closes[last];

  if (isNaN(v9) || isNaN(v21) || isNaN(v50)) return 0;

  let score = 0;
  // Full bullish stack: Price > 9 > 21 > 50
  if (price > v9 && v9 > v21 && v21 > v50) {
    score = 95;
  } else if (price < v9 && v9 < v21 && v21 < v50) {
    // Full bearish stack: Price < 9 < 21 < 50
    score = -95;
  } else {
    // Partial alignment
    if (v9 > v21) score += 35;
    else score -= 35;

    if (price > v21) score += 25;
    else score -= 25;

    // Slope of EMA9
    const prev9 = ema9[last - 1];
    if (!isNaN(prev9)) {
      score += (v9 > prev9 ? 20 : -20);
    }
  }

  return Math.min(100, Math.max(-100, score));
}

/**
 * Score RSI (-100 to +100)
 * Evaluates overbought/oversold bounce, breakouts, and centerline momentum.
 */
function scoreRSI(closes) {
  const rsi = calculateRSI(closes, 14);
  const last = closes.length - 1;
  const current = rsi[last];
  const prev = rsi[last - 1];

  if (isNaN(current)) return 0;

  let score = 0;

  if (current >= 70) {
    // If RSI continues ascending or holds above 70, it's strong bullish continuation
    if (!isNaN(prev) && current >= prev) {
      score = 80;
    } else {
      // Rejection / cooling down
      score = -55;
    }
  } else if (current <= 30) {
    // If RSI continues falling or holds below 30, it's strong bearish continuation
    if (!isNaN(prev) && current <= prev) {
      score = -80;
    } else {
      // Bounce / recovery
      score = 55;
    }
  } else {
    // Momentum relative to 50 centerline
    const distance = (current - 50) * 2.2;
    const slope = !isNaN(prev) ? (current - prev) * 4 : 0;
    score = distance + slope;
  }

  return Math.min(100, Math.max(-100, score));
}

/**
 * Score MACD (-100 to +100)
 */
function scoreMACD(closes) {
  const { macd, signal, histogram } = calculateMACD(closes, 12, 26, 9);
  const last = closes.length - 1;

  const h0 = histogram[last];
  const h1 = histogram[last - 1];
  const m0 = macd[last];
  const s0 = signal[last];

  if (isNaN(m0)) return 0;

  let score = 0;

  // Zero-line bias
  if (m0 > 0) score += 30;
  else if (m0 < 0) score -= 30;

  // Signal line relation
  if (!isNaN(s0)) {
    if (m0 > s0) {
      score += 35;
      if (!isNaN(h1) && h1 <= 0 && h0 > 0) score += 35; // Fresh bullish cross
    } else if (m0 < s0) {
      score -= 35;
      if (!isNaN(h1) && h1 >= 0 && h0 < 0) score -= 35; // Fresh bearish cross
    }
  }

  // Histogram momentum
  if (!isNaN(h0) && !isNaN(h1)) {
    if (h0 > h1) score += 20;
    else if (h0 < h1) score -= 20;
  }

  return Math.min(100, Math.max(-100, score));
}

/**
 * Score Bollinger Bands (-100 to +100)
 */
function scoreBollinger(closes) {
  const { percentB } = calculateBollingerBands(closes, 20, 2);
  const last = closes.length - 1;
  const pb0 = percentB[last];
  const pb1 = percentB[last - 1];

  if (isNaN(pb0)) return 0;

  let score = 0;
  if (pb0 > 0.9) {
    // Walking the upper band (bull trend) vs upper rejection
    score = (!isNaN(pb1) && pb0 >= pb1) ? 75 : -45;
  } else if (pb0 < 0.1) {
    // Walking lower band (bear trend) vs lower bounce
    score = (!isNaN(pb1) && pb0 <= pb1) ? -75 : 45;
  } else {
    // Middle oscillation
    score = (pb0 - 0.5) * 80;
  }

  return Math.min(100, Math.max(-100, score));
}

/**
 * Score Stochastic Oscillator (-100 to +100)
 */
function scoreStochastic(candles) {
  const { k, d } = calculateStochastic(candles, 14, 3, 3);
  const last = candles.length - 1;
  const k0 = k[last];
  const d0 = d[last];
  const k1 = k[last - 1];
  const d1 = d[last - 1];

  if (isNaN(k0)) return 0;

  let score = 0;
  if (k0 > 75) {
    // Overbought zone: continuation if K >= D, bearish reversal if K crosses below D
    if (!isNaN(d0) && k0 < d0 && (!isNaN(k1) && k1 >= d1)) {
      score = -85; // fresh bearish cross
    } else {
      score = 65; // bullish continuation
    }
  } else if (k0 < 25) {
    // Oversold zone: continuation if K <= D, bullish reversal if K crosses above D
    if (!isNaN(d0) && k0 > d0 && (!isNaN(k1) && k1 <= d1)) {
      score = 85; // fresh bullish cross
    } else {
      score = -65; // bearish continuation
    }
  } else {
    score = (k0 - 50) * 1.6;
  }

  return Math.min(100, Math.max(-100, score));
}

/**
 * Score Volume & VWAP (-100 to +100)
 */
function scoreVWAP(candles) {
  const vwap = calculateVWAP(candles);
  const { isSpike } = detectVolumeSpike(candles, 20, 1.8);
  const last = candles.length - 1;
  const price = candles[last].close;
  const currentVWAP = vwap[last];

  if (isNaN(currentVWAP)) return 0;

  const diffPct = (price - currentVWAP) / currentVWAP;
  let score = Math.max(-60, Math.min(60, diffPct * 3000));

  if (isSpike) {
    // High volume confirms direction
    score *= 1.4;
  }

  return Math.min(100, Math.max(-100, score));
}

/**
 * Check for flat market noise or excessive erratic doji consolidation.
 */
function checkMarketNoise(candles, atr) {
  const last = candles.length - 1;
  const currentATR = atr[last];
  const price = candles[last].close;

  if (isNaN(currentATR) || price === 0) return false;

  // Relative ATR check (< 0.03% move per candle = flatline noise)
  const relativeATR = currentATR / price;
  if (relativeATR < 0.0003) return true;

  // Count dojis / zero-body candles in last 10 candles
  const recent = candles.slice(-10);
  let dojiCount = 0;
  for (const c of recent) {
    const range = c.high - c.low;
    const body = Math.abs(c.close - c.open);
    if (range > 0 && body / range < 0.12) {
      dojiCount++;
    }
  }

  // If more than 6 out of 10 candles are micro-dojis, market is sleeping
  return dojiCount >= 6;
}

/**
 * Main Analysis Entry Point
 * @param {Array<{ time: number, open: number, high: number, low: number, close: number, volume: number }>} candles
 * @param {object} settings
 * @returns {object} Final signal and analytics
 */
export function analyzeMarket(candles, settings = {}) {
  if (!candles || candles.length < 35) {
    return {
      direction: 'NEUTRAL',
      confidence: 50,
      rawScore: 0,
      isNoisy: true,
      lastCandle: candles?.[candles.length - 1] || null
    };
  }

  const closes = candles.map((c) => c.close);
  const atr = calculateATR(candles, 14);
  const isNoisy = checkMarketNoise(candles, atr);

  // Default indicator weights
  const weights = {
    ema: 18,
    rsi: 16,
    macd: 16,
    bollinger: 14,
    stochastic: 12,
    patterns: 14,
    trend: 10,
    ...(settings.weights || {})
  };

  // Run individual sub-analyses
  const sEMA = scoreEMA(closes);
  const sRSI = scoreRSI(closes);
  const sMACD = scoreMACD(closes);
  const sBB = scoreBollinger(closes);
  const sStoch = scoreStochastic(candles);
  const sPattern = detectPatterns(candles).score;
  const sTrend = analyzeTrend(candles, 30).strength * (analyzeTrend(candles, 30).trend === 'UP' ? 1 : analyzeTrend(candles, 30).trend === 'DOWN' ? -1 : 0);
  const sVWAP = scoreVWAP(candles);

  // Compute weighted sum
  // Patterns are conditional: if no reversal pattern is present (0), don't dilute strong trend continuation
  const patternWeight = sPattern !== 0 ? weights.patterns : 0;
  const totalWeight =
    weights.ema +
    weights.rsi +
    weights.macd +
    weights.bollinger +
    weights.stochastic +
    patternWeight +
    weights.trend;

  const weightedSum =
    sEMA * weights.ema +
    sRSI * weights.rsi +
    sMACD * weights.macd +
    sBB * weights.bollinger +
    sStoch * weights.stochastic +
    (sPattern !== 0 ? sPattern * weights.patterns : 0) +
    ((sTrend + sVWAP) / 2) * weights.trend;

  const rawScore = weightedSum / (totalWeight || 1);

  // Confluence multiplier: how many directional indicators agree on sign?
  const scores = [sEMA, sRSI, sMACD, sBB, sStoch, sTrend];
  if (sPattern !== 0) scores.push(sPattern);

  const bullCount = scores.filter((s) => s > 15).length;
  const bearCount = scores.filter((s) => s < -15).length;
  const agreement = Math.max(bullCount, bearCount);
  const confluenceRatio = agreement / scores.length; // e.g. 6/6 = 1.0

  // High confidence when indicators align unanimously with strong momentum
  let confidence = Math.round(50 + Math.abs(rawScore) * 0.35 + confluenceRatio * 15);
  confidence = Math.min(99, Math.max(50, confidence));

  // Decisive directional call: Always provide a bold, high-conviction UP or DOWN call
  let direction = rawScore >= 0 ? 'UP' : 'DOWN';
  if (isNoisy && Math.abs(rawScore) < 5) {
    direction = 'NEUTRAL';
  }

  let finalConfidence = Math.max(74, Math.min(97, confidence));

  const lastCandle = candles[candles.length - 1];
  const lastATR = atr[candles.length - 1] || (lastCandle.close * 0.001);

  // Project next candle target for ghost visual
  const projectedTarget =
    direction === 'UP'
      ? lastCandle.close + lastATR * 0.85
      : lastCandle.close - lastATR * 0.85;

  return {
    direction,
    confidence: finalConfidence,
    rawScore: Math.round(rawScore),
    isNoisy,
    lastCandle,
    projectedNext: {
      open: lastCandle.close,
      target: projectedTarget,
      direction
    },
    components: {
      ema: sEMA,
      rsi: sRSI,
      macd: sMACD,
      bollinger: sBB,
      stochastic: sStoch,
      patterns: sPattern,
      trend: sTrend
    }
  };
}
