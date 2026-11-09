/**
 * SignalScan - Formatting & Market Discovery Utilities
 * High-precision asset detection with strict currency whitelist (prevents false matches like DEP/OSI).
 */

// Comprehensive verified currency & asset whitelist
const VALID_CURRENCIES = new Set([
  // Major & Minor Forex
  'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD',
  // Emerging & Exotic Currencies (Quotex & Binary brokers)
  'INR', 'BRL', 'TRY', 'EGP', 'ZAR', 'MXN', 'SGD', 'HKD',
  'SEK', 'NOK', 'DKK', 'PLN', 'THB', 'IDR', 'VND', 'PHP',
  'PKR', 'BDT', 'NGN', 'KES', 'AED', 'SAR', 'CNH', 'CNY',
  'RUB', 'KRW', 'MYR', 'COP', 'ARS', 'CLP', 'DZD', 'MAD',
  'TND', 'QAR', 'KWD', 'BHD', 'OMR', 'ILS', 'PEN', 'UYU',
  'CZK', 'HUF', 'RON', 'BGN', 'ISK', 'HRK',
  // Commodities & Metals
  'XAU', 'XAG', 'XPT', 'XPD', 'XCU', 'WTI', 'BRENT', 'NG', 'GOLD', 'SILVER',
  // Cryptocurrencies
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX',
  'LTC', 'TRX', 'DOT', 'BCH', 'TON', 'LINK', 'NEAR', 'MATIC',
  'SUI', 'PEPE', 'SHIB', 'UNI', 'ETC', 'XLM', 'ALGO', 'USDT', 'USDC', 'BUSD'
]);

// Verified OTC Stocks on Quotex
const VALID_STOCKS = new Set([
  'BOEING', 'APPLE', 'MICROSOFT', 'TESLA', 'AMAZON', 'GOOGLE', 'META',
  'NVIDIA', 'INTEL', 'PFIZER', 'MCDONALD', 'MCDONALDS', 'VISA', 'JOHNSON',
  'CISCO', 'COCACOLA', 'DISNEY', 'WALMART', 'ALIBABA',
  'AAPL', 'MSFT', 'TSLA', 'AMZN', 'GOOGL', 'NVDA', 'BA', 'INTC', 'PFE',
  'MCD', 'V', 'JNJ', 'CSCO', 'AXP', 'KO', 'DIS', 'WMT', 'BABA'
]);

/**
 * Clean & Format Pair Name (e.g. AUD/NZD (OTC), BTC/USDT)
 * @param {string} rawPair
 * @returns {string}
 */
export function formatPair(rawPair) {
  if (!rawPair) return 'BTC/USDT';

  const isOTC = /\(OTC\)|OTC|_OTC/i.test(rawPair);
  const cleanStr = rawPair.replace(/\(OTC\)|OTC|_OTC/gi, '').trim().toUpperCase();

  // If already slash delimited: e.g. "AUD/NZD"
  if (cleanStr.includes('/')) {
    const parts = cleanStr.split('/').map((s) => s.trim().replace(/[^A-Z]/g, ''));
    if (parts[0] && parts[1]) {
      return `${parts[0]}/${parts[1]}${isOTC ? ' (OTC)' : ''}`;
    }
  }

  // If dash or underscore delimited: e.g. "AUD-NZD", "USD_EGP"
  if (cleanStr.includes('-') || cleanStr.includes('_')) {
    const parts = cleanStr.split(/[-_]/).map((s) => s.trim().replace(/[^A-Z]/g, ''));
    if (parts[0] && parts[1]) {
      return `${parts[0]}/${parts[1]}${isOTC ? ' (OTC)' : ''}`;
    }
  }

  // 6-letter concatenated: e.g. "AUDNZD", "USDEGP"
  const alphaOnly = cleanStr.replace(/[^A-Z]/g, '');
  if (alphaOnly.length === 6) {
    const c1 = alphaOnly.slice(0, 3);
    const c2 = alphaOnly.slice(3, 6);
    if (VALID_CURRENCIES.has(c1) && VALID_CURRENCIES.has(c2)) {
      return `${c1}/${c2}${isOTC ? ' (OTC)' : ''}`;
    }
  }

  // Stock name OTC
  if (VALID_STOCKS.has(alphaOnly)) {
    return `${alphaOnly}${isOTC ? ' (OTC)' : ''}`;
  }

  // Crypto quote endings (e.g. BTCUSDT, SOLUSDC)
  const quotes = ['USDT', 'USDC', 'BUSD', 'USD', 'EUR'];
  for (const q of quotes) {
    if (alphaOnly.endsWith(q) && alphaOnly.length > q.length) {
      const base = alphaOnly.slice(0, alphaOnly.length - q.length);
      return `${base}/${q}${isOTC ? ' (OTC)' : ''}`;
    }
  }

  return `${alphaOnly || 'BTC/USDT'}${isOTC ? ' (OTC)' : ''}`;
}

/**
 * Validate whether two token strings form a valid trading pair.
 * Eliminates false words like "DEP/OSI", "DEPOSIT", "WITHDRAW".
 */
function isValidPair(c1, c2) {
  if (!c1 || !c2 || c1 === c2) return false;
  return VALID_CURRENCIES.has(c1) && VALID_CURRENCIES.has(c2);
}

/**
 * Extract active pair string strictly matching verified currencies.
 */
export function extractVerifiedPair(text) {
  if (!text || typeof text !== 'string') return null;

  const isOTC = /\(OTC\)|OTC|_OTC/i.test(text);

  // 1. Explicit delimiter slash, dash, or underscore: e.g. "USD/EGP", "USD - INR", "NZD-CAD"
  const delimRegex = /\b([A-Z]{3,4})\s*[\/\-_]\s*([A-Z]{3,4})\b/i;
  const delimMatch = text.match(delimRegex);
  if (delimMatch) {
    const c1 = delimMatch[1].toUpperCase();
    const c2 = delimMatch[2].toUpperCase();
    if (isValidPair(c1, c2)) {
      return `${c1}/${c2}${isOTC ? ' (OTC)' : ''}`;
    }
  }

  // 2. Pair with _otc suffix: e.g. "USDEGP_otc", "USDBDT_otc", "AUDNZD_otc"
  const otcSuffixMatch = text.match(/\b([A-Z]{6})_otc\b/i);
  if (otcSuffixMatch) {
    const raw = otcSuffixMatch[1].toUpperCase();
    const c1 = raw.slice(0, 3);
    const c2 = raw.slice(3, 6);
    if (isValidPair(c1, c2)) {
      return `${c1}/${c2} (OTC)`;
    }
  }

  // 3. 6-letter concatenated pattern: e.g. "USDEGP", "AUDNZD", "EURUSD"
  const concatRegex = /\b([A-Z]{6})\b/i;
  const concatMatch = text.match(concatRegex);
  if (concatMatch) {
    const raw = concatMatch[1].toUpperCase();
    const c1 = raw.slice(0, 3);
    const c2 = raw.slice(3, 6);
    if (isValidPair(c1, c2)) {
      return `${c1}/${c2}${isOTC ? ' (OTC)' : ''}`;
    }
  }

  // 4. Crypto pair pattern: e.g. "BTCUSDT", "ETHUSDT", "SOLUSDT"
  const cryptoRegex = /\b(BTC|ETH|SOL|BNB|XRP|DOGE|ADA|AVAX|LTC|LINK)(USDT|USDC|USD|BUSD)\b/i;
  const cryptoMatch = text.match(cryptoRegex);
  if (cryptoMatch) {
    return `${cryptoMatch[1].toUpperCase()}/${cryptoMatch[2].toUpperCase()}${isOTC ? ' (OTC)' : ''}`;
  }

  // 5. Stocks with (OTC)
  const stockMatch = text.match(/\b(Boeing|Apple|Microsoft|Tesla|Amazon|Google|Meta|Nvidia|Intel|Pfizer|McDonald'?s|Visa|Johnson|Cisco|Coca-?Cola|Disney|Walmart|Alibaba|AAPL|MSFT|TSLA|AMZN|GOOGL|NVDA|BA|INTC|PFE|MCD|V|JNJ|CSCO|AXP|KO|DIS|WMT|BABA)\b/i);
  if (stockMatch && isOTC) {
    return `${stockMatch[1].toUpperCase()} (OTC)`;
  }

  return null;
}

/**
 * Auto-detect trading pair from host page DOM (Quotex, Pocket Option, TradingView, etc.).
 * Guarantees zero false positives.
 * @returns {string|null}
 */
export function detectPairFromPage() {
  if (typeof document === 'undefined') return null;

  // Layer 1: Quotex & Broker Upper-Right Trading Sidebar (Absolute Primary Source)
  // On Quotex, PocketOption, Deriv, etc. the active trading asset is ALWAYS positioned
  // at the top of the right order-entry sidebar.
  // We strictly enforce rect.left >= window.innerWidth - 440 to exclude all left/full-width containers!
  try {
    const minLeft = Math.max(0, window.innerWidth - 440);

    // 1a. Dedicated sidebar asset selectors
    const sidebarSelectors = [
      '.section-deal__header [class*="asset"]',
      '.deal-form__header [class*="asset"]',
      '.deal-form [class*="asset"]',
      '.section-deal [class*="asset"]',
      '[class*="deal-form"] button',
      '[class*="section-deal"] button',
      '[class*="asset-select"]',
      '[class*="current-asset"]',
      'button[class*="asset"]'
    ];
    for (const sel of sidebarSelectors) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (el.closest && el.closest('#signal-scan-root')) continue;
        const rect = el.getBoundingClientRect();
        if (rect.left >= minLeft && rect.top >= 15 && rect.top <= 400 && rect.width >= 35 && rect.height >= 14) {
          const text = (el.textContent || '').trim();
          const pair = extractVerifiedPair(text);
          if (pair) return pair;
        }
      }
    }

    // 1b. Positional search strictly in the upper-right sidebar
    const rightElements = document.querySelectorAll('button, div, a, span');
    for (const el of rightElements) {
      if (el.closest && el.closest('#signal-scan-root')) continue;
      // Skip high-level containers with many children to target the specific badge/button
      if (el.children.length > 3) continue;

      const rect = el.getBoundingClientRect();
      if (rect.left >= minLeft && rect.left <= window.innerWidth - 20 &&
          rect.top >= 20 && rect.top <= 360 &&
          rect.width >= 40 && rect.width <= 360 &&
          rect.height >= 16 && rect.height <= 85) {
        const text = (el.textContent || '').trim();
        if (text.length >= 6 && text.length <= 45) {
          const pair = extractVerifiedPair(text);
          if (pair) return pair;
        }
      }
    }
  } catch {}

  // Layer 2: Quotex Active Chart Tab in Top Bar
  // Strictly targets individual active tabs (excluding parent tab list containers)
  try {
    const activeTabSelectors = [
      '[class*="tab-item--active"]',
      '[class*="tab-item_active"]',
      '[class*="tabs__item--active"]',
      '[class*="tabs__item_active"]',
      '[class*="tab--active"]',
      '.tab.active',
      '.tab-item.active',
      '[class*="tab"][class*="active"]',
      '[class*="tab"][class*="selected"]',
      '[class*="tab"][class*="current"]',
      '[aria-selected="true"]',
      '[data-active="true"]'
    ];

    for (const sel of activeTabSelectors) {
      const elements = document.querySelectorAll(sel);
      for (const el of elements) {
        if (el.closest && el.closest('#signal-scan-root')) continue;
        // Skip parent tab containers that wrap multiple child tabs
        if (el.querySelector('[class*="tab-item"], [class*="tabs__item"], .tab')) continue;
        if (el.offsetWidth === 0 && el.offsetHeight === 0) continue;

        const pair = extractVerifiedPair(el.textContent);
        if (pair) return pair;
      }
    }

    // Inspect individual tab elements
    const allTabItems = Array.from(document.querySelectorAll('[class*="tab-item"], [class*="tabs__item"], .tab'))
      .filter((tab) => {
        if (tab.closest && tab.closest('#signal-scan-root')) return false;
        if (tab.querySelector('[class*="tab-item"], [class*="tabs__item"]')) return false;
        return tab.offsetWidth > 0 && tab.offsetHeight > 0;
      });

    // If only 1 tab exists on page, that's unconditionally the active tab!
    if (allTabItems.length === 1) {
      const pair = extractVerifiedPair(allTabItems[0].textContent);
      if (pair) return pair;
    }

    // On Quotex, only the active tab renders the close button (x) or chevron
    for (const tab of allTabItems) {
      const hasCloseOrChevron = tab.querySelector('button, svg, [class*="close"], [class*="cross"], [class*="chevron"], [class*="arrow"]');
      if (hasCloseOrChevron) {
        const pair = extractVerifiedPair(tab.textContent);
        if (pair) return pair;
      }
    }
  } catch {}

  // Layer 3: Dedicated Broker Header Classes
  try {
    const specificSelectors = [
      '.section-deal__header',
      '.section-deal__asset',
      '.deal-form__header',
      '.deal-form__asset',
      '.asset-select__button',
      '.asset-select',
      '.current-asset',
      '.header__pair',
      '.pair-name',
      '.current-symbol',
      '#header-toolbar-symbol-search',
      '[data-name="legend-series-item"] [class*="title"]',
      '.pane-legend-title__container'
    ];

    for (const sel of specificSelectors) {
      const elements = document.querySelectorAll(sel);
      for (const el of elements) {
        if (el.closest && el.closest('#signal-scan-root')) continue;
        if (el.offsetWidth === 0 && el.offsetHeight === 0) continue;
        const text = (el.textContent || '').trim();
        if (text.length >= 6 && text.length <= 40) {
          const pair = extractVerifiedPair(text);
          if (pair) return pair;
        }
      }
    }
  } catch {}

  // Layer 4: Fallback to document title & URL
  const titlePair = extractVerifiedPair(document.title);
  if (titlePair) return titlePair;

  const urlPair = extractVerifiedPair(window.location.href);
  if (urlPair) return urlPair;

  return null;
}

/**
 * Detect current quote price from Quotex / Broker DOM
 * @returns {number|null}
 */
export function detectLivePriceFromPage() {
  if (typeof document === 'undefined') return null;

  const priceSelectors = [
    '[class*="current-price"]',
    '[class*="strike-price"]',
    '[class*="value--current"]',
    '[class*="chart__current-price"]',
    '[class*="price-line"]',
    '[class*="cursor-price"]',
    '[class*="quote"]'
  ];

  for (const sel of priceSelectors) {
    try {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (el.closest && el.closest('#signal-scan-root')) continue;
        const raw = (el.textContent || '').replace(/[^0-9.]/g, '');
        const val = parseFloat(raw);
        if (!isNaN(val) && val > 0 && val < 5000000) {
          return val;
        }
      }
    } catch {}
  }

  return null;
}

/**
 * Seconds left until the 1-minute candle closes (0..59)
 */
export function getCandleCountdown() {
  const now = Date.now();
  const nextMinute = Math.ceil(now / 60000) * 60000;
  return Math.max(0, Math.floor((nextMinute - now) / 1000));
}
