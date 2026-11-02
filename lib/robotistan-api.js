/**
 * Robotistan Pro Client API
 * Handles searching products by LCSC code, fetching MOQ/pricing/stock,
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
    const match = document.documentElement.innerHTML.match(/var\s+CART_CSRF_TOKEN\s*=\s*['"]([a-f0-9]+)['"]/i);
    if (match && match[1]) {
      cachedCsrfToken = match[1];
      return cachedCsrfToken;
    }

    return null;
  }

  /**
   * Search a product on Robotistan Pro by its LCSC / Supplier code
   */
  async function searchProduct(code) {
    if (!code || typeof code !== "string") {
      return { success: false, error: "Geçersiz komponent kodu" };
    }

    const cleanCode = code.trim().toUpperCase();

    try {
      const response = await fetch("/arama?q=" + encodeURIComponent(cleanCode), {
        method: "GET",
        headers: {
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        },
        credentials: "same-origin"
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP Hata: ${response.status} (${response.statusText})`
        };
      }

      const html = await response.text();

      // Check and update CSRF Token
      const csrfMatch = html.match(/var\s+CART_CSRF_TOKEN\s*=\s*['"]([a-f0-9]+)['"]/i);
      if (csrfMatch && csrfMatch[1]) {
        cachedCsrfToken = csrfMatch[1];
      }

      // Parse PRODUCT_DATA array from page scripts without eval
      const productMatches = [...html.matchAll(/PRODUCT_DATA\.push\(JSON\.parse\((.*?)\)\);/g)];
      let matchedProduct = null;

      function safeUnquote(s) {
        s = s.trim();
        if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
          s = s.slice(1, -1);
        }
        return s.replace(/\\"/g, '"').replace(/\\\//g, '/').replace(/\\\\/g, '\\');
      }

      for (const m of productMatches) {
        try {
          const parsed = JSON.parse(safeUnquote(m[1]));
          if (parsed.code && parsed.code.toUpperCase() === cleanCode) {
            matchedProduct = parsed;
            break;
          }
          if (parsed.supplier_code && parsed.supplier_code.toUpperCase() === cleanCode) {
            matchedProduct = parsed;
            break;
          }
          if (!matchedProduct) {
            matchedProduct = parsed;
          }
        } catch (e) {
          // ignore parse error on malformed string
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
      const inputMatch = html.match(inputRegex);
      if (inputMatch) {
        const tag = inputMatch[0];
        const minMatch = tag.match(/min=["\'](\d+)["\']/i);
        const stepMatch = tag.match(/step=["\'](\d+)["\']/i);
        if (minMatch) moq = parseInt(minMatch[1], 10) || 1;
        if (stepMatch) step = parseInt(stepMatch[1], 10) || 1;
      }

      // Extract visual stock tag if present
      const stockRegex = /<span[^>]*class=["\'][^"\']*text-green-600[^"\']*["\'][^>]*>([\s\S]*?)<\/span>/i;
      const stockMatch = html.match(stockRegex);
      if (stockMatch) {
        stockDisplay = stockMatch[1].replace(/\s+/g, " ").trim();
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
          stockDisplay: stockDisplay || `${matchedProduct.quantity} adet`,
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

      if (data && data.status === false) {
        return {
          success: false,
          error: data.statusText || "Sepete eklenirken mağaza tarafından reddedildi",
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
