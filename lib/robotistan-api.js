/**
 * Robotistan Pro Client API
 * Handles searching products by LCSC code, fetching MOQ/pricing/stock,
 * multi-page traversal for short codes, pre-order detection,
 * and adding items directly to the user's Robotistan Pro cart.
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

    // Try reading from meta tag or cookie or DOM scripts
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

  /**
   * Search a product on Robotistan Pro by its LCSC / Supplier code.
   * If not found on page 1 (common for short codes matching multiple prefixes),
   * paginates up to 4 pages to find the exact match.
   */
  async function searchProduct(code) {
    if (!code || typeof code !== "string") {
      return { success: false, error: "Geçersiz komponent kodu" };
    }

    const cleanCode = code.trim().toUpperCase();

    try {
      let matchedProduct = null;
      let matchedHtml = "";
      const maxPages = 4;

      for (let page = 1; page <= maxPages; page++) {
        const queryUrl = "/arama?q=" + encodeURIComponent(cleanCode) + (page > 1 ? "&ps=" + page : "");
        const response = await fetch(queryUrl, {
          method: "GET",
          headers: {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
          },
          credentials: "same-origin"
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

        // Parse PRODUCT_DATA array from page scripts without eval
        const productMatches = [...html.matchAll(/PRODUCT_DATA\.push\(JSON\.parse\((.*?)\)\);/g)];
        if (productMatches.length === 0) {
          break;
        }

        for (const m of productMatches) {
          try {
            const parsed = JSON.parse(safeUnquote(m[1]));
            const isMatch = (parsed.code && parsed.code.toUpperCase() === cleanCode) ||
                            (parsed.supplier_code && parsed.supplier_code.toUpperCase() === cleanCode);
            if (isMatch) {
              matchedProduct = parsed;
              matchedHtml = html;
              break;
            }
          } catch (e) {
            // ignore parse error on individual item
          }
        }

        if (matchedProduct) {
          break;
        }

        // If page has fewer than 30 items, there are no subsequent pages
        if (productMatches.length < 30) {
          break;
        }
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
        // Extract visual stock tag if present
        const stockRegex = /<span[^>]*class=["\'][^"\']*text-green-600[^"\']*["\'][^>]*>([\s\S]*?)<\/span>/i;
        const stockMatch = matchedHtml.match(stockRegex);
        if (stockMatch) {
          stockDisplay = stockMatch[1].replace(/\s+/g, " ").trim();
        } else {
          stockDisplay = `${matchedProduct.quantity.toLocaleString("tr-TR")} adet`;
        }
      }

      return {
        success: true,
        notFound: false,
        code: cleanCode,
        product: {
          id: matchedProduct.id,
          name: matchedProduct.name,
          code: matchedProduct.code || cleanCode,
          supplierCode: matchedProduct.supplier_code || "",
          price: matchedProduct.sale_price,
          totalPriceWithVat: matchedProduct.total_sale_price || matchedProduct.total_price,
          currency: matchedProduct.currency || "USD",
          currencyTarget: matchedProduct.currency_target || "TL",
          stock: matchedProduct.quantity,
          isPreorder: isPreorder,
          available: isAvailable,
          stockDisplay: stockDisplay,
          url: matchedProduct.url ? (matchedProduct.url.startsWith("/") ? matchedProduct.url : "/" + matchedProduct.url) : "",
          image: matchedProduct.image || "",
          brand: matchedProduct.brand || ""
        },
        moq: moq,
        step: step,
        csrfToken: cachedCsrfToken
      };
    } catch (err) {
      return {
        success: false,
        error: `Arama sırasında hata: ${err.message}`
      };
    }
  }

  /**
   * Add a single item to the cart on Robotistan Pro
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
      const response = await fetch("/srv/service/cart/add-to-cart/", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
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
        const isPreorder = errorText.includes("Mevcut Stok : 0") ||
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
        message: data?.statusText || "Sepete eklendi",
        cartCount: data?.cartCount,
        cartTotal: data?.cartTotal,
        raw: data
      };
    } catch (err) {
      return {
        success: false,
        error: `Sepete ekleme hatası: ${err.message}`
      };
    }
  }

  return {
    getCsrfToken,
    searchProduct,
    addToCart
  };
});
