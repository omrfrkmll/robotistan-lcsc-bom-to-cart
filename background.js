/**
 * Robotistan Pro - LCSC & KiCad Supply Assistant
 * Background Script (Firefox / Zen Browser WebExtension Manifest V3)
 */

/* global RobotistanApi */

const browserAPI = typeof browser !== "undefined" ? browser : chrome;

// Cache settings
const CACHE_KEY = "rb_stock_cache";
const SETTINGS_KEY = "rb_settings";
const POSITIVE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours for verified items
const NOT_FOUND_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes for NOT_FOUND (re-evaluates quickly)
const RATE_STORAGE_KEY = "rb_usd_try_rate";
const RATE_TIME_KEY = "rb_rate_time";

let memoryCache = new Map();
let currentCurrency = "TL";
let isStrictMatch = true;
let usdTryRate = 35.0; // Sane fallback until updated via live API

// Concurrency queue & in-flight tracking
const MAX_CONCURRENT_REQUESTS = 6;
let activeRequestsCount = 0;
const requestQueue = [];
const inFlightRequests = new Map();

// Live USD/TRY Exchange Rate Fetcher
async function fetchUsdRate(force = false) {
  try {
    const data = await browserAPI.storage.local.get([RATE_STORAGE_KEY, RATE_TIME_KEY]);
    const now = Date.now();
    if (!force && data[RATE_STORAGE_KEY] && data[RATE_TIME_KEY] && (now - data[RATE_TIME_KEY] < 6 * 60 * 60 * 1000)) {
      usdTryRate = parseFloat(data[RATE_STORAGE_KEY]);
      return;
    }

    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    if (res.ok) {
      const json = await res.json();
      if (json && json.rates && json.rates.TRY) {
        usdTryRate = parseFloat(json.rates.TRY);
        await browserAPI.storage.local.set({
          [RATE_STORAGE_KEY]: usdTryRate,
          [RATE_TIME_KEY]: now
        });
        console.log(`[Robotistan Supply Assistant] Güncel USD/TRY kuru: ${usdTryRate}`);
      }
    }
  } catch (e) {
    console.warn("[Robotistan Supply Assistant] Kur çekilemedi, varsayılan:", usdTryRate, e);
  }
}

// Currency format helpers
function formatUsd(amount) {
  if (typeof amount !== "number" || isNaN(amount) || amount <= 0) return "$0.00";
  if (amount < 0.01) return "$" + amount.toFixed(4);
  if (amount < 1.0) return "$" + amount.toFixed(3);
  return "$" + amount.toFixed(2);
}

function formatTl(amount) {
  if (typeof amount !== "number" || isNaN(amount) || amount <= 0) return "0.00 ₺";
  return amount.toFixed(2) + " ₺";
}

// Broadcast stock update to open browser tabs (e.g. LCSC pages)
function broadcastStockUpdate(result) {
  try {
    browserAPI.tabs.query({}, (tabs) => {
      for (const tab of tabs || []) {
        if (tab.id) {
          browserAPI.tabs.sendMessage(tab.id, {
            action: "STOCK_UPDATE",
            data: result
          }).catch(() => {});
        }
      }
    });
  } catch (e) {}
}

// Initialize cache, exchange rate, and settings
(async function init() {
  try {
    await fetchUsdRate();

    const data = await browserAPI.storage.local.get([CACHE_KEY, SETTINGS_KEY]);
    if (data[SETTINGS_KEY]) {
      currentCurrency = data[SETTINGS_KEY].currency || "TL";
      isStrictMatch = data[SETTINGS_KEY].strictMatch !== false;
    }
    if (data[CACHE_KEY]) {
      const now = Date.now();
      for (const [code, entry] of Object.entries(data[CACHE_KEY])) {
        // Purge old NOT_FOUND entries on startup so new matching rules re-evaluate them immediately!
        if (entry.status === "NOT_FOUND") continue;
        if (now - entry.timestamp < POSITIVE_CACHE_TTL_MS) {
          memoryCache.set(code, entry);
        }
      }
    }
    console.log(
      `[Robotistan Supply Assistant] Arka plan başlatıldı. Önbellekte ${memoryCache.size} onaylı ürün var. Kur: 1 USD = ${usdTryRate} TL`
    );
  } catch (err) {
    console.error("[Robotistan Supply Assistant] Başlatma hatası:", err);
  }
})();

// Debounced cache persistence
let persistTimeout = null;
function debouncePersist() {
  if (persistTimeout) clearTimeout(persistTimeout);
  persistTimeout = setTimeout(persistCache, 2000);
}

async function persistCache() {
  try {
    const cacheObj = {};
    for (const [code, entry] of memoryCache.entries()) {
      cacheObj[code] = entry;
    }
    await browserAPI.storage.local.set({ [CACHE_KEY]: cacheObj });
  } catch (e) {
    console.warn("[Robotistan Supply Assistant] Önbellek yazılamadı:", e);
  }
}

// Queue runner
function processQueue() {
  if (activeRequestsCount >= MAX_CONCURRENT_REQUESTS || requestQueue.length === 0) {
    return;
  }
  const { code, resolve, reject, deepSearch } = requestQueue.shift();
  activeRequestsCount++;

  let fetchPromise = inFlightRequests.get(code);
  if (!fetchPromise) {
    fetchPromise = fetchStockData(code, deepSearch).finally(() => {
      inFlightRequests.delete(code);
    });
    inFlightRequests.set(code, fetchPromise);
  }

  fetchPromise
    .then(resolve)
    .catch(reject)
    .finally(() => {
      activeRequestsCount--;
      setTimeout(processQueue, 15);
    });
}

function queueStockCheck(code, highPriority = false, deepSearch = false, forceRefresh = false) {
  return new Promise((resolve, reject) => {
    const cleanCode = code.trim().toUpperCase();

    // Check memory cache with differentiated TTLs
    const cached = memoryCache.get(cleanCode);
    if (cached && !forceRefresh) {
      const ttl = cached.status === "NOT_FOUND" ? NOT_FOUND_CACHE_TTL_MS : POSITIVE_CACHE_TTL_MS;
      if (Date.now() - cached.timestamp < ttl) {
        return resolve(cached);
      }
    }

    if (inFlightRequests.has(cleanCode) && !forceRefresh) {
      return inFlightRequests.get(cleanCode).then(resolve).catch(reject);
    }

    const queueItem = { code: cleanCode, resolve, reject, deepSearch };
    if (highPriority) {
      requestQueue.unshift(queueItem);
    } else {
      requestQueue.push(queueItem);
    }
    processQueue();
  });
}

/**
 * Fetch product data using unified RobotistanApi with Dual Currency calculation
 */
async function fetchStockData(cleanCode, deepSearch = false) {
  try {
    const res = await RobotistanApi.searchProduct(cleanCode, { deepSearch });

    let result = {
      timestamp: Date.now(),
      query: cleanCode,
      status: "NOT_FOUND",
      product: null,
      searchUrl: `https://robotistanpro.com/arama?q=${encodeURIComponent(cleanCode)}`
    };

    if (res.success && res.product) {
      const p = res.product;
      let status = "IN_STOCK";

      if (p.isPreorder || p.stock <= 0) {
        status = "PREORDER";
      } else if (!p.available) {
        status = "OUT_OF_STOCK";
      }

      // Calculate Dual Currency (USD & TL)
      const rate = usdTryRate > 0 ? usdTryRate : 35.0;
      const tlWithVat =
        typeof p.totalPriceWithVat === "number"
          ? p.totalPriceWithVat
          : parseFloat(String(p.totalPriceWithVat).replace(",", ".")) || 0;
      const tlWithoutVat =
        typeof p.price === "number"
          ? p.price
          : parseFloat(String(p.price).replace(",", ".")) || 0;

      const usdWithVat = tlWithVat > 0 ? tlWithVat / rate : 0;
      const usdWithoutVat = tlWithoutVat > 0 ? tlWithoutVat / rate : 0;

      const usdFormatted = formatUsd(usdWithVat);
      const tlFormatted = formatTl(tlWithVat);
      const priceDualDisplay = `${usdFormatted} / ${tlFormatted}`;

      result.status = status;
      result.product = {
        id: String(p.id),
        title: p.name || cleanCode,
        code: p.code || cleanCode,
        supplier_code: p.supplierCode || cleanCode,
        price_tl: tlWithVat,
        price_tl_no_vat: tlWithoutVat,
        price_usd: usdWithVat,
        price_usd_no_vat: usdWithoutVat,
        price_without_vat: `${tlWithoutVat.toFixed(2)} TL`,
        price_with_vat: `${tlWithVat.toFixed(2)} TL`,
        price_usd_formatted: usdFormatted,
        price_usd_no_vat_formatted: formatUsd(usdWithoutVat),
        price_tl_formatted: tlFormatted,
        price_tl_no_vat_formatted: formatTl(tlWithoutVat),
        price_dual: priceDualDisplay,
        rate: rate,
        currency: p.currency || currentCurrency,
        stock: p.stock,
        isPreorder: p.isPreorder,
        stock_status:
          status === "IN_STOCK"
            ? "Stokta Var"
            : status === "PREORDER"
            ? "Temin Edilecek (Ön Sipariş)"
            : "Tükendi",
        stock_unit: p.stockUnit || `Adet ${res.moq || 1}-${res.step || 1}`,
        moq: res.moq || 1,
        step: res.step || 1,
        url: p.url,
        image_url: p.image
      };

      // Broadcast found stock data to active LCSC tabs so badges update live
      broadcastStockUpdate(result);
    }

    memoryCache.set(cleanCode, result);
    debouncePersist();
    return result;
  } catch (error) {
    console.error(`[Robotistan Supply Assistant] ${cleanCode} sorgu hatası:`, error);
    const errorResult = {
      timestamp: Date.now(),
      query: cleanCode,
      status: "NOT_FOUND",
      error: error.message,
      product: null,
      searchUrl: `https://robotistanpro.com/arama?q=${encodeURIComponent(cleanCode)}`
    };
    return errorResult;
  }
}

// Message Listener
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "CHECK_STOCK") {
    queueStockCheck(
      message.code,
      message.priority,
      message.deepSearch || false,
      message.forceRefresh || false
    )
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ status: "NOT_FOUND", error: err.message }));
    return true; // asynchronous response
  }

  if (message.action === "RESCAN_CODES") {
    const codes = Array.isArray(message.codes) ? message.codes : [];
    let count = 0;
    for (const rawCode of codes) {
      const code = String(rawCode).trim().toUpperCase();
      memoryCache.delete(code);
      queueStockCheck(code, false, true, true);
      count++;
    }
    sendResponse({ success: true, count });
    return false;
  }

  if (message.action === "GET_BATCH_CACHE") {
    const codes = Array.isArray(message.codes) ? message.codes : [];
    const results = {};
    const now = Date.now();
    for (const rawCode of codes) {
      const code = String(rawCode).trim().toUpperCase();
      const cached = memoryCache.get(code);
      if (cached) {
        const ttl = cached.status === "NOT_FOUND" ? NOT_FOUND_CACHE_TTL_MS : POSITIVE_CACHE_TTL_MS;
        if (now - cached.timestamp < ttl) {
          results[code] = cached;
        }
      }
    }
    sendResponse(results);
    return false;
  }

  if (message.action === "ADD_TO_CART") {
    RobotistanApi.addToCart({
      productId: message.productId,
      quantity: message.quantity || 1,
      variantId: message.variantId || 0
    })
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.action === "SET_CURRENCY") {
    currentCurrency = message.currency || "TL";
    fetch(`https://robotistanpro.com/srv/shopping/shopping/set-currency/${currentCurrency}`, {
      method: "POST"
    })
      .catch(() => {})
      .finally(() => {
        memoryCache.clear();
        browserAPI.storage.local.set({
          [CACHE_KEY]: {},
          [SETTINGS_KEY]: { currency: currentCurrency, strictMatch: isStrictMatch }
        });
        sendResponse({ success: true, currency: currentCurrency });
      });
    return true;
  }

  if (message.action === "GET_SETTINGS") {
    sendResponse({
      currency: currentCurrency,
      usdTryRate: usdTryRate,
      cacheCount: memoryCache.size
    });
    return false;
  }

  if (message.action === "CLEAR_CACHE") {
    memoryCache.clear();
    browserAPI.storage.local.set({ [CACHE_KEY]: {} });
    sendResponse({ success: true });
    return false;
  }

  if (message.action === "TOGGLE_BOM_PANEL") {
    browserAPI.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        browserAPI.tabs.sendMessage(tabs[0].id, { action: "TOGGLE_BOM_PANEL" });
      }
    });
    sendResponse({ success: true });
    return false;
  }

  return false;
});
