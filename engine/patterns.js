/**
 * SignalScan - Candlestick Pattern Recognition & Market Structure
 * Pure JS detection for high-probability price action patterns.
 */

/**
 * Helper to get candle geometry
 */
function getCandleMetrics(c) {
  const body = Math.abs(c.close - c.open);
  const range = c.high - c.low;
  const upperWick = c.high - Math.max(c.open, c.close);
  const lowerWick = Math.min(c.open, c.close) - c.low;
  const isBullish = c.close > c.open;
  const isBearish = c.close < c.open;

  return { body, range, upperWick, lowerWick, isBullish, isBearish };
}

/**
 * Detect single and multi-candle patterns on the most recent candles.
 * Returns score contribution (-100..+100) and pattern details.
 * @param {Array<{ open: number, high: number, low: number, close: number }>} candles
 * @returns {{ pattern: string|null, bias: 'BULLISH'|'BEARISH'|'NEUTRAL', score: number }}
 */
export function detectPatterns(candles) {
  if (!candles || candles.length < 3) {
    return { pattern: null, bias: 'NEUTRAL', score: 0 };
  }

  const n = candles.length;
  const c0 = candles[n - 1]; // current candle
  const c1 = candles[n - 2]; // previous candle
  const c2 = candles[n - 3]; // 2 candles ago

  const m0 = getCandleMetrics(c0);
  const m1 = getCandleMetrics(c1);
  const m2 = getCandleMetrics(c2);

  // 1. Morning Star (Bullish Reversal 3-bar)
  if (
    m2.isBearish &&
    m2.body > m2.range * 0.5 &&
    m1.body < m2.body * 0.4 &&
    m0.isBullish &&
    c0.close > c2.open - m2.body * 0.5
  ) {
    return { pattern: 'MORNING_STAR', bias: 'BULLISH', score: 90 };
  }

  // 2. Evening Star (Bearish Reversal 3-bar)
  if (
    m2.isBullish &&
    m2.body > m2.range * 0.5 &&
    m1.body < m2.body * 0.4 &&
    m0.isBearish &&
    c0.close < c2.open + m2.body * 0.5
  ) {
    return { pattern: 'EVENING_STAR', bias: 'BEARISH', score: -90 };
  }

  // 3. Bullish Engulfing
  if (
    m1.isBearish &&
    m0.isBullish &&
    c0.close >= c1.open &&
    c0.open <= c1.close &&
    m0.body > m1.body * 1.1
  ) {
    return { pattern: 'BULLISH_ENGULFING', bias: 'BULLISH', score: 80 };
  }

  // 4. Bearish Engulfing
  if (
    m1.isBullish &&
    m0.isBearish &&
    c0.close <= c1.open &&
    c0.open >= c1.close &&
    m0.body > m1.body * 1.1
  ) {
    return { pattern: 'BEARISH_ENGULFING', bias: 'BEARISH', score: -80 };
  }

  // 5. Hammer / Bullish Pin Bar
  if (
    m0.lowerWick >= m0.body * 2 &&
    m0.upperWick <= m0.range * 0.15 &&
    m0.range > 0
  ) {
    return { pattern: 'HAMMER_PIN', bias: 'BULLISH', score: 65 };
  }

  // 6. Shooting Star / Bearish Pin Bar
  if (
    m0.upperWick >= m0.body * 2 &&
    m0.lowerWick <= m0.range * 0.15 &&
    m0.range > 0
  ) {
    return { pattern: 'SHOOTING_STAR', bias: 'BEARISH', score: -65 };
  }

  // 7. Doji (Indecision)
  if (m0.range > 0 && m0.body <= m0.range * 0.1) {
    return { pattern: 'DOJI', bias: 'NEUTRAL', score: 0 };
  }

  return { pattern: null, bias: 'NEUTRAL', score: 0 };
}

/**
 * Support & Resistance Level Finder
 * Scans local swing pivots over last 30-50 candles.
 */
export function findSupportResistance(candles, lookback = 30) {
  if (candles.length < 10) return { support: 0, resistance: 0 };

  const slice = candles.slice(-lookback);
  let highest = -Infinity;
  let lowest = Infinity;

  for (let i = 2; i < slice.length - 2; i++) {
    const c = slice[i];
    // Local swing high
    if (
      c.high > slice[i - 1].high &&
      c.high > slice[i - 2].high &&
      c.high > slice[i + 1].high &&
      c.high > slice[i + 2].high
    ) {
      if (c.high > highest) highest = c.high;
    }

    // Local swing low
    if (
      c.low < slice[i - 1].low &&
      c.low < slice[i - 2].low &&
      c.low < slice[i + 1].low &&
      c.low < slice[i + 2].low
    ) {
      if (c.low < lowest) lowest = c.low;
    }
  }

  const currentPrice = candles[candles.length - 1].close;
  if (!isFinite(highest)) highest = Math.max(...slice.map((c) => c.high));
  if (!isFinite(lowest)) lowest = Math.min(...slice.map((c) => c.low));

  return {
    support: lowest,
    resistance: highest,
    nearSupport: Math.abs(currentPrice - lowest) < (highest - lowest) * 0.15,
    nearResistance: Math.abs(currentPrice - highest) < (highest - lowest) * 0.15
  };
}

/**
 * 30-Candle Trend Filter
 * Evaluates market structure (higher-highs/higher-lows vs lower-highs/lower-lows).
 * @returns {{ slope: number, trend: 'UP'|'DOWN'|'RANGING', strength: number }}
 */
export function analyzeTrend(candles, period = 30) {
  if (candles.length < period) {
    return { slope: 0, trend: 'RANGING', strength: 0 };
  }

  const slice = candles.slice(-period);
  const closes = slice.map((c) => c.close);

  // Linear regression slope
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  const n = closes.length;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += closes[i];
    sumXY += i * closes[i];
    sumXX += i * i;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const avgPrice = sumY / n;
  const normalizedSlope = (slope / avgPrice) * 1000; // per 1000 candles

  let trend = 'RANGING';
  if (normalizedSlope > 0.3) trend = 'UP';
  else if (normalizedSlope < -0.3) trend = 'DOWN';

  return {
    slope: normalizedSlope,
    trend,
    strength: Math.min(100, Math.abs(normalizedSlope) * 70)
  };
}

