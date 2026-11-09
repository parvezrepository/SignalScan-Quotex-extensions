/**
 * SignalScan - Technical Analysis Indicators Engine
 * Pure JavaScript, zero dependencies, high performance.
 * Processes arrays of candle objects: { time, open, high, low, close, volume }
 */

/**
 * Exponential Moving Average (EMA)
 * @param {number[]} values
 * @param {number} period
 * @returns {number[]} array of same length, padded with NaN before index period - 1
 */
export function calculateEMA(values, period) {
  const result = new Array(values.length).fill(NaN);
  if (!values || values.length < period || period <= 0) return result;

  // Initial SMA for first value
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  let prevEMA = sum / period;
  result[period - 1] = prevEMA;

  const multiplier = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    const current = (values[i] - prevEMA) * multiplier + prevEMA;
    result[i] = current;
    prevEMA = current;
  }

  return result;
}

/**
 * Simple Moving Average (SMA)
 * @param {number[]} values
 * @param {number} period
 * @returns {number[]}
 */
export function calculateSMA(values, period) {
  const result = new Array(values.length).fill(NaN);
  if (!values || values.length < period || period <= 0) return result;

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  result[period - 1] = sum / period;

  for (let i = period; i < values.length; i++) {
    sum += values[i] - values[i - period];
    result[i] = sum / period;
  }

  return result;
}

/**
 * Relative Strength Index (RSI) using Wilder's Smoothing
 * @param {number[]} closes
 * @param {number} period default 14
 * @returns {number[]} 0..100
 */
export function calculateRSI(closes, period = 14) {
  const result = new Array(closes.length).fill(NaN);
  if (!closes || closes.length <= period) return result;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) {
      gains += diff;
    } else {
      losses += -diff;
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  if (avgLoss === 0) {
    result[period] = 100;
  } else {
    const rs = avgGain / avgLoss;
    result[period] = 100 - (100 / (1 + rs));
  }

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const currentGain = diff > 0 ? diff : 0;
    const currentLoss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

    if (avgLoss === 0) {
      result[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      result[i] = 100 - (100 / (1 + rs));
    }
  }

  return result;
}

/**
 * MACD (12, 26, 9)
 * @param {number[]} closes
 * @param {number} fastPeriod default 12
 * @param {number} slowPeriod default 26
 * @param {number} signalPeriod default 9
 * @returns {{ macd: number[], signal: number[], histogram: number[] }}
 */
export function calculateMACD(closes, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const fastEMA = calculateEMA(closes, fastPeriod);
  const slowEMA = calculateEMA(closes, slowPeriod);

  const macdLine = new Array(closes.length).fill(NaN);
  for (let i = 0; i < closes.length; i++) {
    if (!isNaN(fastEMA[i]) && !isNaN(slowEMA[i])) {
      macdLine[i] = fastEMA[i] - slowEMA[i];
    }
  }

  // Calculate EMA of the valid MACD line values
  const validStartIndex = slowPeriod - 1;
  const validMacd = macdLine.slice(validStartIndex);
  const validSignal = calculateEMA(validMacd, signalPeriod);

  const signalLine = new Array(closes.length).fill(NaN);
  const histogram = new Array(closes.length).fill(NaN);

  for (let i = 0; i < validSignal.length; i++) {
    const originalIndex = i + validStartIndex;
    signalLine[originalIndex] = validSignal[i];
    if (!isNaN(macdLine[originalIndex]) && !isNaN(validSignal[i])) {
      histogram[originalIndex] = macdLine[originalIndex] - validSignal[i];
    }
  }

  return { macd: macdLine, signal: signalLine, histogram };
}

/**
 * Bollinger Bands (20, 2)
 * @param {number[]} closes
 * @param {number} period default 20
 * @param {number} stdDevMultiplier default 2
 * @returns {{ upper: number[], middle: number[], lower: number[], percentB: number[], bandwidth: number[] }}
 */
export function calculateBollingerBands(closes, period = 20, stdDevMultiplier = 2) {
  const middle = calculateSMA(closes, period);
  const upper = new Array(closes.length).fill(NaN);
  const lower = new Array(closes.length).fill(NaN);
  const percentB = new Array(closes.length).fill(NaN);
  const bandwidth = new Array(closes.length).fill(NaN);

  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = middle[i];

    let varianceSum = 0;
    for (let j = 0; j < slice.length; j++) {
      varianceSum += Math.pow(slice[j] - mean, 2);
    }
    const stdDev = Math.sqrt(varianceSum / period);

    upper[i] = mean + stdDevMultiplier * stdDev;
    lower[i] = mean - stdDevMultiplier * stdDev;

    const diff = upper[i] - lower[i];
    percentB[i] = diff !== 0 ? (closes[i] - lower[i]) / diff : 0.5;
    bandwidth[i] = mean !== 0 ? diff / mean : 0;
  }

  return { upper, middle, lower, percentB, bandwidth };
}

/**
 * Stochastic Oscillator (14, 3, 3)
 * @param {Array<{ high: number, low: number, close: number }>} candles
 * @param {number} kPeriod default 14
 * @param {number} kSmoothing default 3
 * @param {number} dPeriod default 3
 * @returns {{ k: number[], d: number[] }}
 */
export function calculateStochastic(candles, kPeriod = 14, kSmoothing = 3, dPeriod = 3) {
  const len = candles.length;
  const rawK = new Array(len).fill(NaN);

  for (let i = kPeriod - 1; i < len; i++) {
    let highestHigh = -Infinity;
    let lowestLow = Infinity;

    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (candles[j].high > highestHigh) highestHigh = candles[j].high;
      if (candles[j].low < lowestLow) lowestLow = candles[j].low;
    }

    const range = highestHigh - lowestLow;
    rawK[i] = range === 0 ? 50 : ((candles[i].close - lowestLow) / range) * 100;
  }

  // Smooth rawK to get %K
  const validRawK = [];
  const validIndices = [];
  for (let i = 0; i < len; i++) {
    if (!isNaN(rawK[i])) {
      validRawK.push(rawK[i]);
      validIndices.push(i);
    }
  }

  const smoothedValidK = calculateSMA(validRawK, kSmoothing);
  const kLine = new Array(len).fill(NaN);
  for (let i = 0; i < smoothedValidK.length; i++) {
    kLine[validIndices[i]] = smoothedValidK[i];
  }

  // Calculate %D as SMA of %K
  const validK = [];
  const validKIndices = [];
  for (let i = 0; i < len; i++) {
    if (!isNaN(kLine[i])) {
      validK.push(kLine[i]);
      validKIndices.push(i);
    }
  }

  const smoothedValidD = calculateSMA(validK, dPeriod);
  const dLine = new Array(len).fill(NaN);
  for (let i = 0; i < smoothedValidD.length; i++) {
    dLine[validKIndices[i]] = smoothedValidD[i];
  }

  return { k: kLine, d: dLine };
}

/**
 * Average True Range (ATR, 14)
 * @param {Array<{ high: number, low: number, close: number }>} candles
 * @param {number} period default 14
 * @returns {number[]}
 */
export function calculateATR(candles, period = 14) {
  const len = candles.length;
  const result = new Array(len).fill(NaN);
  if (len < period + 1) return result;

  const tr = new Array(len).fill(0);
  tr[0] = candles[0].high - candles[0].low;

  for (let i = 1; i < len; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const prevC = candles[i - 1].close;
    tr[i] = Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC));
  }

  // First ATR is simple SMA of first 'period' TR values
  let sum = 0;
  for (let i = 1; i <= period; i++) {
    sum += tr[i];
  }
  let prevATR = sum / period;
  result[period] = prevATR;

  // Wilder's smoothing
  for (let i = period + 1; i < len; i++) {
    prevATR = (prevATR * (period - 1) + tr[i]) / period;
    result[i] = prevATR;
  }

  return result;
}

/**
 * Volume-Weighted Average Price (VWAP)
 * @param {Array<{ high: number, low: number, close: number, volume: number }>} candles
 * @returns {number[]}
 */
export function calculateVWAP(candles) {
  const len = candles.length;
  const result = new Array(len).fill(NaN);
  let cumTPV = 0;
  let cumVol = 0;

  for (let i = 0; i < len; i++) {
    const c = candles[i];
    const typicalPrice = (c.high + c.low + c.close) / 3;
    const vol = c.volume > 0 ? c.volume : 1;

    cumTPV += typicalPrice * vol;
    cumVol += vol;

    result[i] = cumVol > 0 ? cumTPV / cumVol : typicalPrice;
  }

  return result;
}

/**
 * Volume Spike Detection
 * @param {Array<{ volume: number }>} candles
 * @param {number} period default 20
 * @param {number} thresholdMultiplier default 1.8
 * @returns {{ isSpike: boolean, ratio: number }}
 */
export function detectVolumeSpike(candles, period = 20, thresholdMultiplier = 1.8) {
  if (candles.length < period + 1) return { isSpike: false, ratio: 1 };

  const volumes = candles.map((c) => c.volume);
  const currentVolume = volumes[volumes.length - 1];
  const slice = volumes.slice(volumes.length - 1 - period, volumes.length - 1);
  const avg = slice.reduce((a, b) => a + b, 0) / period;

  const ratio = avg > 0 ? currentVolume / avg : 1;
  return {
    isSpike: ratio >= thresholdMultiplier,
    ratio
  };
}

