/**
 * Robotistan Pro - Supply Assistant Popup Script
 */

const browserAPI = typeof browser !== "undefined" ? browser : chrome;

document.addEventListener("DOMContentLoaded", async () => {
  // Elements
  const quickSearchInput = document.getElementById("quick-search-input");
  const quickSearchBtn = document.getElementById("quick-search-btn");
  const quickSearchResult = document.getElementById("quick-search-result");

  const contextRobotistan = document.getElementById("context-robotistan");
  const contextLcsc = document.getElementById("context-lcsc");
  const contextOther = document.getElementById("context-other");

  const openBomBtn = document.getElementById("open-bom-btn");
  const goRobotistanCartBtn = document.getElementById("go-robotistan-cart-btn");
  const navRobotistan = document.getElementById("nav-robotistan");
  const navLcsc = document.getElementById("nav-lcsc");

  const currencyBtns = document.querySelectorAll(".currency-btn");
  const cacheStatsText = document.getElementById("cache-stats-text");
  const clearCacheBtn = document.getElementById("clear-cache-btn");

  // 1. Detect Active Tab Context
  let activeTab = null;
  try {
    const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs.length > 0) activeTab = tabs[0];
  } catch (err) {}

  const currentUrl = activeTab?.url || "";
  const isRobotistan = currentUrl.includes("robotistanpro.com");
  const isLcsc = currentUrl.includes("lcsc.com");

  if (isRobotistan) {
    contextRobotistan.style.display = "flex";
    contextLcsc.style.display = "none";
    contextOther.style.display = "none";
  } else if (isLcsc) {
    contextRobotistan.style.display = "none";
    contextLcsc.style.display = "flex";
    contextOther.style.display = "none";
  } else {
    contextRobotistan.style.display = "none";
    contextLcsc.style.display = "none";
    contextOther.style.display = "flex";
  }

  // Action listeners
  if (openBomBtn) {
    openBomBtn.addEventListener("click", () => {
      if (activeTab) {
        browserAPI.tabs.sendMessage(activeTab.id, { action: "TOGGLE_BOM_PANEL" });
      }
      window.close();
    });
  }

  if (goRobotistanCartBtn) {
    goRobotistanCartBtn.addEventListener("click", () => {
      browserAPI.tabs.create({ url: "https://robotistanpro.com/sepet" });
      window.close();
    });
  }

  if (navRobotistan) {
    navRobotistan.addEventListener("click", () => {
      browserAPI.tabs.create({ url: "https://robotistanpro.com" });
      window.close();
    });
  }

  if (navLcsc) {
    navLcsc.addEventListener("click", () => {
      browserAPI.tabs.create({ url: "https://www.lcsc.com" });
      window.close();
    });
  }

  // 2. Settings & Cache info
  browserAPI.runtime.sendMessage({ action: "GET_SETTINGS" }, (res) => {
    if (res) {
      if (res.currency) {
        currencyBtns.forEach((btn) => {
          btn.classList.toggle("active", btn.dataset.currency === res.currency);
        });
      }
      if (cacheStatsText && res.cacheCount !== undefined) {
        cacheStatsText.textContent = `Önbellek: ${res.cacheCount} ürün`;
      }
    }
  });

  currencyBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const cur = btn.dataset.currency;
      currencyBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      browserAPI.runtime.sendMessage({ action: "SET_CURRENCY", currency: cur });
    });
  });

  if (clearCacheBtn) {
    clearCacheBtn.addEventListener("click", () => {
      browserAPI.runtime.sendMessage({ action: "CLEAR_CACHE" }, () => {
        if (cacheStatsText) cacheStatsText.textContent = "Önbellek: 0 ürün";
      });
    });
  }

  // 3. Quick Search Logic
  async function performQuickSearch() {
    const rawVal = quickSearchInput.value.trim().toUpperCase();
    if (!rawVal) return;

    quickSearchResult.style.display = "flex";
    quickSearchResult.innerHTML = `<span style="font-size:11.5px; color:#64748b;">Sorgulanıyor...</span>`;

    browserAPI.runtime.sendMessage({ action: "CHECK_STOCK", code: rawVal, priority: true }, (res) => {
      if (!res || res.status === "NOT_FOUND" || !res.product) {
        quickSearchResult.innerHTML = `
          <div class="res-header">
            <span class="res-badge out-of-stock">Bulunamadı</span>
            <span style="font-size:11px; color:#64748b;">${rawVal}</span>
          </div>
          <div style="font-size:11px; color:#64748b;">Ürün Robotistan Pro kataloğunda bulunamadı.</div>
          <a href="https://robotistanpro.com/arama?q=${encodeURIComponent(rawVal)}" target="_blank" class="footer-link" style="font-size:11px;">Robotistan'da Ara ➔</a>
        `;
        return;
      }

      const p = res.product;
      const isInStock = res.status === "IN_STOCK";
      const isPreorder = res.status === "PREORDER";
      const badgeClass = isInStock ? "in-stock" : isPreorder ? "preorder" : "out-of-stock";
      const badgeText = isInStock ? "Stokta Var" : isPreorder ? "Ön Sipariş" : "Tükendi";

      quickSearchResult.innerHTML = `
        <div class="res-header">
          <span class="res-badge ${badgeClass}">${badgeText}</span>
          <span class="res-price">${p.price_with_vat || "-"}</span>
        </div>
        <div class="res-title">${p.title || p.code}</div>
        <div class="res-details">
          <span>Paket: ${p.stock_unit || "-"}</span>
          <span>Kod: ${p.code}</span>
        </div>
        <div class="res-actions">
          ${
            isInStock
              ? `<button class="res-cart-btn" id="res-add-cart-btn" data-product-id="${p.id}" data-moq="${p.moq || 1}">
                   🛒 Robotistan Sepetime Ekle
                 </button>`
              : ""
          }
          <a href="${p.url}" target="_blank" class="btn btn-secondary btn-sm" style="text-decoration:none;">İncele ➔</a>
        </div>
      `;

      if (isInStock) {
        const cartBtn = quickSearchResult.querySelector("#res-add-cart-btn");
        if (cartBtn) {
          cartBtn.addEventListener("click", () => {
            cartBtn.disabled = true;
            cartBtn.textContent = "Ekleniyor...";
            browserAPI.runtime.sendMessage(
              { action: "ADD_TO_CART", productId: p.id, quantity: p.moq || 1 },
              (cartRes) => {
                if (cartRes && cartRes.success) {
                  cartBtn.classList.add("added");
                  cartBtn.textContent = "✓ Sepete Eklendi!";
                } else {
                  cartBtn.disabled = false;
                  cartBtn.textContent = "Hata! Tekrar Dene";
                }
              }
            );
          });
        }
      }
    });
  }

  quickSearchBtn.addEventListener("click", performQuickSearch);
  quickSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") performQuickSearch();
  });
});
