/**
 * Robotistan Pro - LCSC & KiCad Supply Assistant
 * Background Script (Firefox / Zen Browser WebExtension Manifest V3)
 */

/* global RobotistanApi */

const browserAPI = typeof browser !== "undefined" ? browser : chrome;

// Cache settings
const CACHE_KEY = "rb_stock_cache";
const SETTINGS_KEY = "rb_settings";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

let memoryCache = new Map();
let currentCurrency = "TL";
let isStrictMatch = true;

// Concurrency queue & in-flight tracking
const MAX_CONCURRENT_REQUESTS = 6;
let activeRequestsCount = 0;
const requestQueue = [];
const inFlightRequests = new Map();

// Initialize cache and settings
(async function init() {
  try {
    const data = await browserAPI.storage.local.get([CACHE_KEY, SETTINGS_KEY]);
    if (data[SETTINGS_KEY]) {
      currentCurrency = data[SETTINGS_KEY].currency || "TL";
      isStrictMatch = data[SETTINGS_KEY].strictMatch !== false;
    }
    if (data[CACHE_KEY]) {
      const now = Date.now();
      for (const [code, entry] of Object.entries(data[CACHE_KEY])) {
        if (now - entry.timestamp < CACHE_TTL_MS) {
          memoryCache.set(code, entry);
        }
      }
    }
    console.log(
      `[Robotistan Supply Assistant] Arka plan başlatıldı. Önbellekte ${memoryCache.size} ürün var. Para birimi: ${currentCurrency}`
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

function queueStockCheck(code, highPriority = false, deepSearch = false) {
  return new Promise((resolve, reject) => {
    const cleanCode = code.trim().toUpperCase();

    // Check memory cache
    const cached = memoryCache.get(cleanCode);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return resolve(cached);
    }

    if (inFlightRequests.has(cleanCode)) {
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
 * Fetch product data using unified RobotistanApi
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

      let priceWithVatText = "";
      if (typeof p.totalPriceWithVat === "number") {
        priceWithVatText = `${p.totalPriceWithVat.toFixed(2)} TL`;
      } else if (p.totalPriceWithVat) {
        priceWithVatText = `${p.totalPriceWithVat} TL`;
      }

      let priceWithoutVatText = "";
      if (typeof p.price === "number") {
        priceWithoutVatText = `${p.price.toFixed(2)}`;
      } else if (p.price) {
        priceWithoutVatText = `${p.price}`;
      }

      result.status = status;
      result.product = {
        id: String(p.id),
        title: p.name || cleanCode,
        code: p.code || cleanCode,
        supplier_code: p.supplierCode || cleanCode,
        price_without_vat: priceWithoutVatText,
        price_with_vat: priceWithVatText,
        currency: p.currency || currentCurrency,
        stock: p.stock,
        isPreorder: p.isPreorder,
        stock_status: status === "IN_STOCK" ? "Stokta Var" : status === "PREORDER" ? "Temin Edilecek (Ön Sipariş)" : "Tükendi",
        stock_unit: p.stockUnit || `Adet ${res.moq || 1}-${res.step || 1}`,
        moq: res.moq || 1,
        step: res.step || 1,
        url: p.url,
        image_url: p.image
      };
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
    queueStockCheck(message.code, message.priority, message.deepSearch || false)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ status: "NOT_FOUND", error: err.message }));
    return true; // asynchronous response
  }

  if (message.action === "GET_BATCH_CACHE") {
    const codes = Array.isArray(message.codes) ? message.codes : [];
    const results = {};
    const now = Date.now();
    for (const rawCode of codes) {
      const code = String(rawCode).trim().toUpperCase();
      const cached = memoryCache.get(code);
      if (cached && now - cached.timestamp < CACHE_TTL_MS) {
        results[code] = cached;
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
    // Forward to active tab or find robotistanpro tab
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
