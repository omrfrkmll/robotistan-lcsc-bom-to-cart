/**
 * Robotistan Pro Client API
 * Unified API client supporting:
 * 1. Ultra-fast Live JSON Search (/srv/service/product/searchAll/{code})
 * 2. Deep Multi-Page Search with exact LCSC code verification (/arama?q={code}&ps={page})
 * 3. MOQ, packaging step, price, and pre-order detection
 * 4. Direct shopping cart integration (/srv/service/cart/add-to-cart/)
 */

(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    root.RobotistanApi = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  let cachedCsrfToken = null;

  function getCsrfToken() {
    if (cachedCsrfToken) return cachedCsrfToken;

    if (typeof window !== "undefined" && window.CART_CSRF_TOKEN) {
      cachedCsrfToken = window.CART_CSRF_TOKEN;
      return cachedCsrfToken;
    }

    if (typeof document !== "undefined" && document.documentElement) {
      const match = document.documentElement.innerHTML.match(/var\s+CART_CSRF_TOKEN\s*=\s*['"]([a-f0-9]+)['"]/i);
      if (match && match[1]) {
        cachedCsrfToken = match[1];
        return cachedCsrfToken;
      }
    }

    return null;
  }

  function safeUnquote(s) {
    s = s.trim();
    if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
      s = s.slice(1, -1);
    }
    return s.replace(/\\"/g, '"').replace(/\\\//g, '/').replace(/\\\\/g, '\\');
  }

  function parseNumberPrice(val) {
    if (typeof val === "number" && !isNaN(val)) return val;
    if (typeof val === "string") {
      const clean = val.replace(/[^\d,\.]/g, "").replace(",", ".");
      const parsed = parseFloat(clean);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  /**
   * Deep multi-page catalog search on robotistanpro.com
   * Checks pages 1..4 for exact LCSC/Supplier code match
   */
  async function searchCatalogMultiPage(cleanCode) {
    const maxPages = 4;
    let matchedProduct = null;
    let matchedHtml = "";

    for (let page = 1; page <= maxPages; page++) {
      const queryUrl = "https://robotistanpro.com/arama?q=" + encodeURIComponent(cleanCode) + (page > 1 ? "&ps=" + page : "");
      const response = await fetch(queryUrl, {
        method: "GET",
        headers: {
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        },
        credentials: "include"
      });

      if (!response.ok) {
        if (page === 1) {
          return {
            success: false,
            error: `HTTP Hata: ${response.status} (${response.statusText})`
          };
        }
        break;
      }

      const html = await response.text();

      // Check and update CSRF Token
      const csrfMatch = html.match(/var\s+CART_CSRF_TOKEN\s*=\s*['"]([a-f0-9]+)['"]/i);
      if (csrfMatch && csrfMatch[1]) {
        cachedCsrfToken = csrfMatch[1];
      }

      // Parse PRODUCT_DATA array from page scripts
      const productMatches = [...html.matchAll(/PRODUCT_DATA\.push\(JSON\.parse\((.*?)\)\);/g)];
      if (productMatches.length === 0) {
        break;
      }

      for (const m of productMatches) {
        try {
          const parsed = JSON.parse(safeUnquote(m[1]));
          const pCode = String(parsed.code || "").toUpperCase();
          const sCode = String(parsed.supplier_code || "").toUpperCase();
          const pName = String(parsed.name || "").toUpperCase();
          const isMatch = pCode === cleanCode || sCode === cleanCode || pName.includes(cleanCode);
          if (isMatch) {
            matchedProduct = parsed;
            matchedHtml = html;
            break;
          }
        } catch (e) {}
      }

      if (matchedProduct) break;
      if (productMatches.length < 30) break;
    }

    if (!matchedProduct) {
      return {
        success: false,
        notFound: true,
        error: "Ürün Robotistan Pro'da bulunamadı",
        code: cleanCode
      };
    }

    // Extract MOQ and step from product card input
    let moq = 1;
    let step = 1;
    let stockDisplay = "";

    const inputRegex = new RegExp(`<input[^>]*id=["\']product-count-${matchedProduct.id}[^"\']*["\'][^>]*>`, "i");
    const inputMatch = matchedHtml.match(inputRegex);
    if (inputMatch) {
      const tag = inputMatch[0];
      const minMatch = tag.match(/min=["\'](\d+)["\']/i);
      const stepMatch = tag.match(/step=["\'](\d+)["\']/i);
      if (minMatch) moq = parseInt(minMatch[1], 10) || 1;
      if (stepMatch) step = parseInt(stepMatch[1], 10) || 1;
    }

    // Check pre-order / zero stock condition
    const isZeroStock = (matchedProduct.quantity <= 0);
    const isAvailable = matchedProduct.available !== false && !isZeroStock;
    const isPreorder = isZeroStock || !isAvailable;

    if (isPreorder) {
      stockDisplay = "Temin Edilecek (Ön Sipariş)";
    } else {
      const stockRegex = /<span[^>]*class=["\'][^"\']*text-green-600[^"\']*["\'][^>]*>([\s\S]*?)<\/span>/i;
      const stockMatch = matchedHtml.match(stockRegex);
      if (stockMatch) {
        stockDisplay = stockMatch[1].replace(/\s+/g, " ").trim();
      } else {
        stockDisplay = `${matchedProduct.quantity.toLocaleString("tr-TR")} adet`;
      }
    }

    let productUrl = matchedProduct.url || "";
    if (productUrl && !productUrl.startsWith("http")) {
      productUrl = productUrl.startsWith("/") ? `https://robotistanpro.com${productUrl}` : `https://robotistanpro.com/${productUrl}`;
    }

    const priceWithoutVat = parseNumberPrice(matchedProduct.sale_price || matchedProduct.price);
    const priceWithVat = parseNumberPrice(matchedProduct.total_sale_price || matchedProduct.total_price) || Number((priceWithoutVat * 1.2).toFixed(2));

    return {
      success: true,
      notFound: false,
      code: cleanCode,
      product: {
        id: String(matchedProduct.id),
        name: matchedProduct.name,
        code: matchedProduct.code || cleanCode,
        supplierCode: matchedProduct.supplier_code || "",
        price: priceWithoutVat,
        totalPriceWithVat: priceWithVat,
        currency: matchedProduct.currency || "USD",
        currencyTarget: matchedProduct.currency_target || "TL",
        stock: matchedProduct.quantity,
        isPreorder: isPreorder,
        available: isAvailable,
        stockDisplay: stockDisplay,
        stockUnit: `Adet ${moq}-${step}`,
        url: productUrl,
        image: matchedProduct.image || "",
        brand: matchedProduct.brand || ""
      },
      moq: moq,
      step: step,
      csrfToken: cachedCsrfToken
    };
  }

  /**
   * Search Product:
   * 1. Calls fast JSON Live Search API (/srv/service/product/searchAll/{code})
   * 2. If options.deepSearch === true and item not found, runs multi-page catalog search.
   */
  async function searchProduct(code, options = {}) {
    if (!code || typeof code !== "string") {
      return { success: false, error: "Geçersiz komponent kodu" };
    }

    const cleanCode = code.trim().toUpperCase();
    const deepSearch = options.deepSearch === true;

    // 1. Fast JSON Search Attempt (searchAll)
    try {
      const fastUrl = "https://robotistanpro.com/srv/service/product/searchAll/" + encodeURIComponent(cleanCode);
      const fastRes = await fetch(fastUrl, {
        method: "GET",
        headers: {
          "Accept": "application/json, text/plain, */*"
        },
        credentials: "include"
      });

      if (fastRes.ok) {
        const rawJson = await fastRes.json().catch(() => null);
        const products = Array.isArray(rawJson) ? rawJson : (rawJson?.products || rawJson?.data || []);

        let exactMatch = null;
        for (const p of products) {
          const pCode = String(p.product_code || p.code || "").trim().toUpperCase();
          const sCode = String(p.supplier_product_code || p.supplier_code || "").trim().toUpperCase();
          if (pCode === cleanCode || sCode === cleanCode) {
            exactMatch = p;
            break;
          }
        }

        // Title fallback if exact code match was not in SKU fields
        if (!exactMatch) {
          for (const p of products) {
            const title = String(p.title || p.name || "").trim().toUpperCase();
            if (title.includes(cleanCode)) {
              exactMatch = p;
              break;
            }
          }
        }

        if (exactMatch) {
          // Parse MOQ and step from stock_unit (e.g. "Adet 50-50" or "Adet 5-5")
          let moq = 1;
          let step = 1;
          const unitStr = String(exactMatch.stock_unit || "");
          const unitMatch = unitStr.match(/(\d+)\s*-\s*(\d+)/);
          if (unitMatch) {
            moq = parseInt(unitMatch[1], 10) || 1;
            step = parseInt(unitMatch[2], 10) || 1;
          }

          const stockFlag = exactMatch.stock !== undefined ? Number(exactMatch.stock) : 1;
          const isZeroStock = (stockFlag === 0 || exactMatch.stock_status === "Tükendi" || exactMatch.stock_unit === "Tükendi");
          const isPreorder = isZeroStock;

          const priceWithoutVat = parseNumberPrice(exactMatch.price_sell !== undefined ? exactMatch.price_sell : exactMatch.price_without_vat);
          let priceWithVat = parseNumberPrice(exactMatch.price_sell_with_vat || exactMatch.price_with_vat);
          if (!priceWithVat && priceWithoutVat) {
            priceWithVat = Number((priceWithoutVat * 1.2).toFixed(2));
          }

          let productUrl = exactMatch.url || "";
          if (productUrl && !productUrl.startsWith("http")) {
            productUrl = productUrl.startsWith("/") ? `https://robotistanpro.com${productUrl}` : `https://robotistanpro.com/${productUrl}`;
          }

          let imageUrl = exactMatch.image || exactMatch.image_url || "";
          if (imageUrl && !imageUrl.startsWith("http")) {
            imageUrl = imageUrl.startsWith("/") ? `https://robotistanpro.com${imageUrl}` : `https://robotistanpro.com/${imageUrl}`;
          }

          return {
            success: true,
            notFound: false,
            code: cleanCode,
            product: {
              id: String(exactMatch.id || ""),
              name: exactMatch.title || exactMatch.name || cleanCode,
              code: exactMatch.product_code || exactMatch.code || cleanCode,
              supplierCode: exactMatch.supplier_product_code || exactMatch.supplier_code || cleanCode,
              price: priceWithoutVat,
              totalPriceWithVat: priceWithVat,
              currency: exactMatch.currency || "USD",
              currencyTarget: exactMatch.currency_target || "TL",
              stock: isZeroStock ? 0 : 1,
              isPreorder: isPreorder,
              available: !isZeroStock,
              stockDisplay: isPreorder ? "Temin Edilecek (Ön Sipariş)" : "Stokta Var",
              stockUnit: exactMatch.stock_unit || `Adet ${moq}-${step}`,
              url: productUrl,
              image: imageUrl,
              brand: exactMatch.brand || ""
            },
            moq: moq,
            step: step,
            csrfToken: getCsrfToken()
          };
        }
      }
    } catch (e) {
      // Ignore network error on fast attempt
    }

    // 2. If deep search is enabled (e.g. BOM drawer on Robotistan Pro or popup), traverse multi-page catalog
    if (deepSearch) {
      return searchCatalogMultiPage(cleanCode);
    }

    // Otherwise, fast search concluded that the product does not exist in top results
    return {
      success: false,
      notFound: true,
      code: cleanCode,
      error: "Ürün Robotistan Pro'da bulunamadı"
    };
  }

  /**
   * Add a single item to the user's Robotistan Pro shopping cart
   */
  async function addToCart({ productId, quantity, variantId = 0, csrfToken = null }) {
    if (!productId) {
      return { success: false, error: "Ürün ID'si bulunamadı" };
    }

    const token = csrfToken || getCsrfToken();
    const formData = new FormData();
    formData.append("productId", productId);
    formData.append("variantId", variantId);
    formData.append("quantity", Math.max(1, parseInt(quantity, 10) || 1));
    if (token) {
      formData.append("csrfToken", token);
    }

    try {
      const response = await fetch("https://robotistanpro.com/srv/service/cart/add-to-cart/", {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: {
          "X-Requested-With": "XMLHttpRequest"
        }
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        return {
          success: false,
          error: data?.statusText || `HTTP Hata: ${response.status}`,
          raw: data
        };
      }

      if (data && (data.status === false || data.status === 0)) {
        const errorText = data.statusText || "";
        const isPreorder =
          errorText.includes("Mevcut Stok : 0") ||
          errorText.includes("stok bulunmamaktadır") ||
          errorText.includes("stok");
        return {
          success: false,
          isPreorder: isPreorder,
          error: errorText || "Sepete eklenirken mağaza tarafından reddedildi",
          raw: data
        };
      }

      return {
        success: true,
        data: data
      };
    } catch (err) {
      return {
        success: false,
        error: "Bağlantı hatası: " + err.message
      };
    }
  }

  return {
    getCsrfToken,
    searchProduct,
    searchCatalogMultiPage,
    addToCart
  };
});
