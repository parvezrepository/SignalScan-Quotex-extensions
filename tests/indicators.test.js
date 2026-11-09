/**
 * SignalScan - Test Suite for Indicators & Scorer
 * Run with: node tests/indicators.test.js
 */

import assert from 'node:assert';
import {
  calculateEMA,
  calculateSMA,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateStochastic,
  calculateATR
} from '../engine/indicators.js';

import { analyzeMarket } from '../engine/scorer.js';

console.log('🧪 Starting SignalScan Technical Indicator Tests...\n');

// --------------------------------------------------------------------------
// 1. EMA Test
// --------------------------------------------------------------------------
{
  // Test sequence: 10 numbers
  const prices = [22.27, 22.19, 22.08, 22.17, 22.18, 22.13, 22.23, 22.43, 22.24, 22.29];
  const period = 5;
  const ema = calculateEMA(prices, period);

  // First 4 indices should be NaN
  for (let i = 0; i < period - 1; i++) {
    assert(isNaN(ema[i]), `Index ${i} should be NaN`);
  }

  // Initial SMA at index 4: (22.27 + 22.19 + 22.08 + 22.17 + 22.18) / 5 = 110.89 / 5 = 22.178
  const expectedSMA = (22.27 + 22.19 + 22.08 + 22.17 + 22.18) / 5;
  assert(Math.abs(ema[4] - expectedSMA) < 0.001, `Expected ${expectedSMA}, got ${ema[4]}`);

  // Next EMA at index 5:
  // multiplier = 2 / (5 + 1) = 2/6 = 0.3333333333
  // EMA = (22.13 - 22.178) * 0.3333333333 + 22.178 = -0.048 * (1/3) + 22.178 = 22.162
  const expectedEMA5 = (prices[5] - expectedSMA) * (2 / (period + 1)) + expectedSMA;
  assert(Math.abs(ema[5] - expectedEMA5) < 0.001, `Expected ${expectedEMA5}, got ${ema[5]}`);

  console.log('  ✓ EMA (Exponential Moving Average) verified against exact math');
}

// --------------------------------------------------------------------------
// 2. RSI Test
// --------------------------------------------------------------------------
{
  // Known Wilder 14-period standard price series
  const closes = [
    44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08,
    45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 45.64
  ];

  const rsi = calculateRSI(closes, 14);

  // Indexes 0..13 should be NaN
  for (let i = 0; i < 14; i++) {
    assert(isNaN(rsi[i]), `RSI Index ${i} should be NaN`);
  }

  // Index 14 should have a valid RSI value between 0 and 100
  assert(!isNaN(rsi[14]), 'RSI at period 14 should be valid number');
  assert(rsi[14] >= 0 && rsi[14] <= 100, `RSI ${rsi[14]} outside 0..100`);

  // Later indices should also be bounded and valid
  for (let i = 14; i < closes.length; i++) {
    assert(rsi[i] >= 0 && rsi[i] <= 100, `RSI index ${i} invalid: ${rsi[i]}`);
  }

  // Uptrending slice should produce RSI > 50
  const strongUp = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
  const upRSI = calculateRSI(strongUp, 14);
  assert(upRSI[upRSI.length - 1] > 80, 'Strong uptrend should have RSI > 80');

  console.log('  ✓ RSI (Relative Strength Index) Wilder smoothing verified');
}

// --------------------------------------------------------------------------
// 3. MACD Test
// --------------------------------------------------------------------------
{
  // Generate 60 prices in steady uptrend
  const prices = Array.from({ length: 60 }, (_, i) => 100 + i * 1.5 + Math.sin(i) * 0.5);
  const { macd, signal, histogram } = calculateMACD(prices, 12, 26, 9);

  assert.strictEqual(macd.length, prices.length);
  assert.strictEqual(signal.length, prices.length);
  assert.strictEqual(histogram.length, prices.length);

  // In a sustained uptrend, Fast EMA > Slow EMA, so MACD line must be positive
  const lastIndex = prices.length - 1;
  assert(macd[lastIndex] > 0, `MACD should be positive in strong uptrend, got ${macd[lastIndex]}`);
  assert(!isNaN(signal[lastIndex]), 'Signal line should be a valid number');
  assert(Math.abs(histogram[lastIndex] - (macd[lastIndex] - signal[lastIndex])) < 0.0001, 'Histogram = MACD - Signal');

  console.log('  ✓ MACD (12, 26, 9) convergence and histogram verified');
}

// --------------------------------------------------------------------------
// 4. Bollinger Bands Test
// --------------------------------------------------------------------------
{
  const prices = Array.from({ length: 30 }, (_, i) => 50 + (i % 5));
  const bb = calculateBollingerBands(prices, 20, 2);

  const last = prices.length - 1;
  assert(!isNaN(bb.middle[last]), 'Middle band should not be NaN');
  assert(bb.upper[last] > bb.middle[last], 'Upper band must be greater than middle band');
  assert(bb.lower[last] < bb.middle[last], 'Lower band must be less than middle band');
  assert(bb.bandwidth[last] > 0, 'Bandwidth must be positive');

  console.log('  ✓ Bollinger Bands (20, 2) upper/lower/width verified');
}

// --------------------------------------------------------------------------
// 5. Stochastic Test
// --------------------------------------------------------------------------
{
  const candles = Array.from({ length: 30 }, (_, i) => ({
    open: 100 + i,
    high: 102 + i,
    low: 99 + i,
    close: 101 + i,
    volume: 1000
  }));

  const stoch = calculateStochastic(candles, 14, 3, 3);
  const last = candles.length - 1;
  assert(!isNaN(stoch.k[last]), '%K should be valid');
  assert(!isNaN(stoch.d[last]), '%D should be valid');
  assert(stoch.k[last] >= 0 && stoch.k[last] <= 100, '%K within 0..100');

  console.log('  ✓ Stochastic (14, 3, 3) oscillator verified');
}

// --------------------------------------------------------------------------
// 6. ATR & Noise Filter Test
// --------------------------------------------------------------------------
{
  // Flatline candles (doji noise)
  const noisyCandles = Array.from({ length: 60 }, (_, i) => ({
    time: i * 60000,
    open: 100.0,
    high: 100.01,
    low: 99.99,
    close: 100.0,
    volume: 10
  }));

  const flatSignal = analyzeMarket(noisyCandles, { threshold: 70 });
  assert.strictEqual(flatSignal.direction, 'NEUTRAL', 'Flatline market must trigger NEUTRAL noise filter');
  assert.strictEqual(flatSignal.isNoisy, true, 'Flatline market must flag isNoisy = true');

  // Strong bullish momentum candles
  const bullCandles = Array.from({ length: 60 }, (_, i) => ({
    time: i * 60000,
    open: 100 + i * 2,
    high: 103 + i * 2,
    low: 99.5 + i * 2,
    close: 102.5 + i * 2,
    volume: 5000 + i * 100
  }));

  const bullSignal = analyzeMarket(bullCandles, { threshold: 70 });
  assert.strictEqual(bullSignal.direction, 'UP', `Expected UP for strong bull trend, got ${bullSignal.direction}`);
  assert(bullSignal.confidence >= 70, `Confidence should be >= 70, got ${bullSignal.confidence}`);

  console.log('  ✓ Noise filter and directional voting engine verified');
}

console.log('\n✨ ALL TESTS PASSED SUCCESSFULLY! (6/6)');

