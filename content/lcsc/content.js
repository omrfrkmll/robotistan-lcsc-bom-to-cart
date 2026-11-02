/**
 * Robotistan Pro - LCSC Supply Assistant
 * Content Script (Runs on https://*.lcsc.com/* and https://lcsc.com/*)
 * Real-time Robotistan stock & price badges with 1-click Cart addition
 */

(function () {
  "use strict";

  console.log("[Robotistan Supply Assistant] LCSC içerik betiği yüklendi: " + window.location.href);

  const browserAPI = typeof browser !== "undefined" ? browser : chrome;

  const ICONS = {
    spinner: `<svg class="rb-svg-spinner" viewBox="0 0 24 24" width="11" height="11">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="32" stroke-linecap="round"/>
    </svg>`,
    cart: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
    </svg>`,
    check: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>`
  };

  function extractLcscCode(str) {
    if (!str) return null;
    const s = String(str).trim();
    const m =
      s.match(/(?:^|[_/\s\-\:\.\#])(C\d{4,10})(?:\.html|[_/\s\-\:\.]|$)/i) ||
      s.match(/\b(C\d{4,10})\b/i) ||
      s.match(/(C\d{4,10})/i);
    return m ? m[1].toUpperCase() : null;
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Floating Portal Tooltip
  let floatingTooltip = null;
  let currentHoveredBadge = null;
  let hideTooltipTimeout = null;

  function getOrCreateFloatingTooltip() {
    if (!floatingTooltip) {
      floatingTooltip = document.createElement("div");
      floatingTooltip.id = "rb-floating-tooltip";
      floatingTooltip.className = "rb-floating-tooltip rb-tooltip-hidden";

      // Keep tooltip alive when mouse moves over it
      floatingTooltip.addEventListener("mouseenter", () => {
        if (hideTooltipTimeout) clearTimeout(hideTooltipTimeout);
      });

      floatingTooltip.addEventListener("mouseleave", () => {
        hideTooltip(100);
      });

      document.body.appendChild(floatingTooltip);
    }
    return floatingTooltip;
  }

  function showTooltip(badge, result) {
    if (!badge || !result) return;
    if (hideTooltipTimeout) clearTimeout(hideTooltipTimeout);
    currentHoveredBadge = badge;

    const tooltip = getOrCreateFloatingTooltip();
    const code = result.query || badge.getAttribute("data-rb-code");
    const p = result.product;

    let contentHtml = "";

    if (result.status === "IN_STOCK" && p) {
      const defaultQty = p.moq || 1;
      const stepQty = p.step || 1;

      contentHtml = `
        <div class="rb-tooltip-header">
          <span style="color:#10b981;">●</span>
          <span>Robotistan Pro: Stokta Var</span>
        </div>
        <div class="rb-tooltip-title">${escapeHtml(p.title || "")}</div>
        <div class="rb-tooltip-details">
          <div><span>KDV Dahil:</span> <strong>${escapeHtml(p.price_with_vat || "-")}</strong></div>
          ${p.price_without_vat ? `<div><span>KDV Hariç:</span> <strong>${escapeHtml(p.price_without_vat)} ${escapeHtml(p.currency || "TL")}</strong></div>` : ""}
          <div><span>Paket Kuralı:</span> <strong>${escapeHtml(p.stock_unit || `Adet ${defaultQty}-${stepQty}`)}</strong></div>
          <div><span>LCSC / Stok Kodu:</span> <strong>${escapeHtml(p.code || code)}</strong></div>
        </div>

        <!-- 1-Click Add to Robotistan Cart Action Row -->
        <div class="rb-tooltip-cart-row">
          <div class="rb-tooltip-qty-wrapper">
            <span class="rb-qty-label">Adet:</span>
            <input type="number" class="rb-tooltip-qty" id="rb-card-qty-${p.id}" value="${defaultQty}" min="${defaultQty}" step="${stepQty}">
          </div>
          <button class="rb-tooltip-cart-btn" id="rb-card-btn-${p.id}" data-product-id="${p.id}">
            ${ICONS.cart}
            <span>Robotistan Sepetime Ekle</span>
          </button>
        </div>
        <div class="rb-cart-feedback" id="rb-cart-feedback-${p.id}" style="display:none;"></div>

        <div class="rb-tooltip-footer">
          <a href="${p.url || `https://robotistanpro.com/arama?q=${encodeURIComponent(code)}`}" target="_blank" class="rb-tooltip-action">
            Robotistan'da Ürünü İncele ➔
          </a>
        </div>
      `;
    } else if (result.status === "PREORDER" && p) {
      contentHtml = `
        <div class="rb-tooltip-header">
          <span style="color:#f59e0b;">✈️</span>
          <span>Robotistan Pro: Ön Sipariş (Temin Edilecek)</span>
        </div>
        <div class="rb-tooltip-title">${escapeHtml(p.title || "")}</div>
        <div class="rb-tooltip-details">
          <div><span>Birim Fiyat:</span> <strong>${escapeHtml(p.price_with_vat || "Belirtilmemiş")}</strong></div>
          <div><span>Tedarikçi Stoğu:</span> <strong style="color:#f59e0b;">0 (Temin Edilecek)</strong></div>
          <div><span>Paket Kuralı:</span> <strong>${escapeHtml(p.stock_unit || "-")}</strong></div>
        </div>
        <div class="rb-tooltip-note">Bu ürün online sepet yerine kurumsal proforma/BOM teklif formu ile temin edilir.</div>
        <div class="rb-tooltip-footer">
          <a href="${p.url || `https://robotistanpro.com/arama?q=${encodeURIComponent(code)}`}" target="_blank" class="rb-tooltip-action">
            Robotistan'da İncele ➔
          </a>
        </div>
      `;
    } else if (result.status === "OUT_OF_STOCK" && p) {
      contentHtml = `
        <div class="rb-tooltip-header">
          <span style="color:#ef4444;">●</span>
          <span>Robotistan Pro: Tükendi</span>
        </div>
        <div class="rb-tooltip-title">${escapeHtml(p.title || "")}</div>
        <div class="rb-tooltip-details">
          <div><span>Fiyat:</span> <strong>${escapeHtml(p.price_with_vat || "-")}</strong></div>
          <div><span>Stok:</span> <strong style="color:#f87171;">Tükendi</strong></div>
          <div><span>Paket:</span> <strong>${escapeHtml(p.stock_unit || "-")}</strong></div>
        </div>
        <div class="rb-tooltip-footer">
          <a href="${p.url || `https://robotistanpro.com/arama?q=${encodeURIComponent(code)}`}" target="_blank" class="rb-tooltip-action">
            Robotistan'da Gör ➔
          </a>
        </div>
      `;
    } else if (result.status === "LOADING") {
      contentHtml = `
        <div class="rb-tooltip-header">
          ${ICONS.spinner}
          <span>Sorgulanıyor...</span>
        </div>
        <div class="rb-tooltip-title">Robotistan Pro stok ve fiyat durumu kontrol ediliyor.</div>
      `;
    } else {
      // NOT FOUND
      contentHtml = `
        <div class="rb-tooltip-header">
          <span style="color:#71717a;">●</span>
          <span>Robotistan'da Bulunamadı</span>
        </div>
        <div class="rb-tooltip-title"><strong>${escapeHtml(code)}</strong> kodlu parça Robotistan Pro kataloğunda bulunamadı.</div>
        <div class="rb-tooltip-footer">
          <a href="${result.searchUrl}" target="_blank" class="rb-tooltip-action">Robotistan'da Manuel Ara ➔</a>
        </div>
      `;
    }

    tooltip.innerHTML = contentHtml;

    // Attach Add to Cart listener if in stock
    if (result.status === "IN_STOCK" && p) {
      const addBtn = tooltip.querySelector(`#rb-card-btn-${p.id}`);
      const qtyInput = tooltip.querySelector(`#rb-card-qty-${p.id}`);
      const feedback = tooltip.querySelector(`#rb-cart-feedback-${p.id}`);

      if (addBtn && qtyInput) {
        addBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
          addBtn.disabled = true;
          addBtn.innerHTML = `${ICONS.spinner} <span>Ekleniyor...</span>`;

          browserAPI.runtime.sendMessage(
            { action: "ADD_TO_CART", productId: p.id, quantity: qty },
            (res) => {
              addBtn.disabled = false;
              if (res && res.success) {
                addBtn.innerHTML = `${ICONS.check} <span>Sepete Eklendi!</span>`;
                addBtn.style.backgroundColor = "#16a34a";
                if (feedback) {
                  feedback.style.display = "block";
                  feedback.innerHTML = `✓ ${qty} adet sepete eklendi! <a href="https://robotistanpro.com/sepet" target="_blank">Sepeti Aç ➔</a>`;
                }
              } else {
                addBtn.innerHTML = `<span>Hata!</span>`;
                if (feedback) {
                  feedback.style.display = "block";
                  feedback.style.color = "#f87171";
                  feedback.textContent = res?.error || "Sepete eklenemedi.";
                }
              }
            }
          );
        });
      }
    }

    // Position tooltip
    const badgeRect = badge.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    const tooltipWidth = tooltipRect.width || 280;
    const tooltipHeight = tooltipRect.height || 180;

    let top = 0;
    let isBelow = false;

    if (badgeRect.top < 340) {
      top = badgeRect.bottom + 8;
      isBelow = true;
    } else {
      top = badgeRect.top - tooltipHeight - 8;
      isBelow = false;
    }

    let left = badgeRect.left + badgeRect.width / 2 - tooltipWidth / 2;
    left = Math.max(10, Math.min(left, window.innerWidth - tooltipWidth - 10));

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
    tooltip.classList.toggle("rb-tooltip-below", isBelow);
    tooltip.classList.remove("rb-tooltip-hidden");
  }

  function hideTooltip(gracePeriod = 0) {
    if (gracePeriod > 0) {
      hideTooltipTimeout = setTimeout(doHideTooltip, gracePeriod);
    } else {
      doHideTooltip();
    }
  }

  function doHideTooltip() {
    currentHoveredBadge = null;
    if (floatingTooltip) {
      floatingTooltip.classList.add("rb-tooltip-hidden");
    }
  }

  // Memory cache of requested codes on the active page
  const requestedCodes = new Map();
  const codeSubscribers = new Map();

  // Lazy loading observer
  const viewportObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const badge = entry.target;
          viewportObserver.unobserve(badge);
          const code = badge.getAttribute("data-rb-code");
          if (code) {
            checkStock(code, badge, true);
          }
        }
      }
    },
    {
      rootMargin: "350px 0px 350px 0px",
      threshold: 0.01
    }
  );

  function createBadgeElement(code) {
    const badge = document.createElement("a");
    badge.className = "rb-stock-badge rb-badge-loading";
    badge.setAttribute("data-rb-code", code);
    badge.setAttribute("target", "_blank");
    badge.setAttribute("rel", "noopener noreferrer");
    badge.href = `https://robotistanpro.com/arama?q=${encodeURIComponent(code)}`;

    badge.innerHTML = `
      ${ICONS.spinner}
      <span class="rb-badge-text">Sorgulanıyor</span>
    `;

    badge.addEventListener("mouseenter", () => {
      const data = badge._rbResult || { status: "LOADING", query: code };
      showTooltip(badge, data);
    });

    badge.addEventListener("mouseleave", () => {
      hideTooltip(250); // 250ms grace period so user can hover into the tooltip
    });

    badge.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    return badge;
  }

  function updateBadgeElement(badge, result) {
    if (!badge || !result) return;
    badge._rbResult = result;

    const code = result.query || badge.getAttribute("data-rb-code");
    badge.classList.remove(
      "rb-badge-loading",
      "rb-badge-in-stock",
      "rb-badge-preorder",
      "rb-badge-out-of-stock",
      "rb-badge-not-found"
    );

    if (result.status === "IN_STOCK" && result.product) {
      const p = result.product;
      badge.classList.add("rb-badge-in-stock");
      badge.href = p.url || `https://robotistanpro.com/arama?q=${encodeURIComponent(code)}`;
      const priceText = p.price_with_vat || (p.price_without_vat ? `${Number(p.price_without_vat).toFixed(2)} TL` : "Stokta");

      badge.innerHTML = `
        <span class="rb-status-dot"></span>
        <span class="rb-badge-text">${priceText}</span>
      `;
    } else if (result.status === "PREORDER" && result.product) {
      badge.classList.add("rb-badge-preorder");
      badge.href = result.product.url || `https://robotistanpro.com/arama?q=${encodeURIComponent(code)}`;

      badge.innerHTML = `
        <span class="rb-status-dot"></span>
        <span class="rb-badge-text">✈️ Ön Sipariş</span>
      `;
    } else if (result.status === "OUT_OF_STOCK" && result.product) {
      badge.classList.add("rb-badge-out-of-stock");
      badge.href = result.product.url || `https://robotistanpro.com/arama?q=${encodeURIComponent(code)}`;

      badge.innerHTML = `
        <span class="rb-status-dot"></span>
        <span class="rb-badge-text">Tükendi</span>
      `;
    } else {
      badge.classList.add("rb-badge-not-found");
      badge.href = result.searchUrl || `https://robotistanpro.com/arama?q=${encodeURIComponent(code)}`;

      badge.innerHTML = `
        <span class="rb-badge-text">Yok</span>
      `;
    }

    if (currentHoveredBadge === badge) {
      showTooltip(badge, result);
    }
  }

  function checkStock(code, badgeElement, isHighPriority = false) {
    if (requestedCodes.has(code)) {
      const cached = requestedCodes.get(code);
      if (badgeElement) {
        updateBadgeElement(badgeElement, cached);
      }
      return;
    }

    if (codeSubscribers.has(code)) {
      if (badgeElement) {
        codeSubscribers.get(code).add(badgeElement);
      }
      return;
    }

    const subs = new Set();
    if (badgeElement) subs.add(badgeElement);
    codeSubscribers.set(code, subs);

    function handleResponse(response) {
      requestedCodes.set(code, response);
      const subscribers = codeSubscribers.get(code);
      if (subscribers) {
        subscribers.forEach((b) => updateBadgeElement(b, response));
        codeSubscribers.delete(code);
      }
    }

    try {
      const res = browserAPI.runtime.sendMessage(
        { action: "CHECK_STOCK", code: code, priority: isHighPriority },
        (cbResponse) => {
          if (cbResponse) handleResponse(cbResponse);
        }
      );

      if (res && typeof res.then === "function") {
        res
          .then((promiseResponse) => {
            if (promiseResponse) handleResponse(promiseResponse);
          })
          .catch(() => {
            handleResponse({ status: "NOT_FOUND", query: code });
          });
      }
    } catch (e) {
      handleResponse({ status: "NOT_FOUND", query: code });
    }
  }

  function applyBatchResults(batchResults) {
    for (const [code, entry] of Object.entries(batchResults)) {
      if (!entry) continue;
      requestedCodes.set(code, entry);
      const badges = document.querySelectorAll(`.rb-stock-badge[data-rb-code="${code}"]`);
      badges.forEach((b) => {
        viewportObserver.unobserve(b);
        updateBadgeElement(b, entry);
      });
    }
  }

  function scanAndInject() {
    // Select all potential product containers across LCSC list, table, and grid layouts
    const containers = document.querySelectorAll(
      'tr, [id^="productId"], [data-product-id], .product-item, .product-card, .product-item-wrap, .v-data-table__wrapper tr, .el-table__row, .ant-table-row, div[class*="product-item"], div[class*="productCard"], div[class*="product_card"]'
    );

    const newItems = [];
    const uncachedCodes = new Set();

    containers.forEach((container) => {
      const existingBadges = container.querySelectorAll(".rb-stock-badge");
      if (existingBadges.length > 1) {
        for (let i = 1; i < existingBadges.length; i++) {
          const row = existingBadges[i].closest(".rb-badge-row");
          if (row) row.remove();
          else existingBadges[i].remove();
        }
      }
      if (existingBadges.length > 0) return;

      let lcscCode = null;

      // 1. Check data-spm cbh link
      const cbhLink = container.querySelector('a[data-spm*="cbh"], a[data-spm$="cbh"]');
      if (cbhLink) {
        lcscCode =
          extractLcscCode(cbhLink.textContent) ||
          extractLcscCode(cbhLink.getAttribute("title")) ||
          extractLcscCode(cbhLink.getAttribute("href"));
      }

      // 2. Strict C-code text in anchors/spans/cells
      if (!lcscCode) {
        const allTextEls = container.querySelectorAll("a, span, td, div");
        for (const el of allTextEls) {
          if (el.children.length > 2) continue; // Skip large nested containers
          const text = el.textContent.trim();
          if (/^C\d{4,10}$/i.test(text)) {
            lcscCode = text.toUpperCase();
            break;
          }
        }
      }

      // 3. Product detail links (excluding image thumbnails)
      if (!lcscCode) {
        const links = container.querySelectorAll('a[href*="/product-detail/"]');
        for (const link of links) {
          if (link.querySelector("img") || !link.textContent.trim()) continue;
          const code =
            extractLcscCode(link.textContent) ||
            extractLcscCode(link.getAttribute("title")) ||
            extractLcscCode(link.getAttribute("href"));
          if (code) {
            lcscCode = code;
            break;
          }
        }
      }

      if (!lcscCode) return;

      newItems.push({ container, code: lcscCode, cbhLink });
      if (!requestedCodes.has(lcscCode)) {
        uncachedCodes.add(lcscCode);
      }
    });

    newItems.forEach(({ container, code, cbhLink }) => {
      const badge = createBadgeElement(code);
      const badgeRow = document.createElement("div");
      badgeRow.className = "rb-badge-row";
      badgeRow.appendChild(badge);

      const textColumn = container.querySelector(".ml-3") || (cbhLink ? cbhLink.closest(".ml-3") : null);

      if (textColumn) {
        let lcscBlock = cbhLink;
        while (
          lcscBlock &&
          lcscBlock.parentElement &&
          lcscBlock.parentElement !== textColumn &&
          lcscBlock.parentElement !== container
        ) {
          lcscBlock = lcscBlock.parentElement;
        }

        if (lcscBlock && lcscBlock.parentElement === textColumn) {
          if (lcscBlock.nextSibling) {
            textColumn.insertBefore(badgeRow, lcscBlock.nextSibling);
          } else {
            textColumn.appendChild(badgeRow);
          }
        } else {
          textColumn.appendChild(badgeRow);
        }
      } else {
        // Fallback: Find target element to insert right after
        let targetEl = cbhLink;
        if (!targetEl) {
          const detailLinks = container.querySelectorAll('a[href*="/product-detail/"]');
          for (const l of detailLinks) {
            if (!l.querySelector("img") && l.textContent.trim()) {
              targetEl = l;
              break;
            }
          }
        }

        if (targetEl) {
          const targetBlock = targetEl.closest("div, p, span") || targetEl;
          if (targetBlock.nextSibling) {
            targetBlock.parentNode.insertBefore(badgeRow, targetBlock.nextSibling);
          } else {
            targetBlock.parentNode.appendChild(badgeRow);
          }
        } else {
          container.appendChild(badgeRow);
        }
      }

      // Check if already in viewport or preload area
      const rect = badge.getBoundingClientRect();
      if (rect.top < window.innerHeight + 250 && rect.bottom > -100) {
        checkStock(code, badge, true);
      } else {
        viewportObserver.observe(badge);
      }
    });

    if (newItems.length > 0) {
      console.log(`[Robotistan Supply Assistant] ${newItems.length} yeni LCSC ürününe rozet eklendi.`);
    }

    // Batch query background cache for discovered items
    if (uncachedCodes.size > 0) {
      browserAPI.runtime.sendMessage(
        { action: "GET_BATCH_CACHE", codes: Array.from(uncachedCodes) },
        (cachedBatch) => {
          if (cachedBatch && typeof cachedBatch === "object") {
            applyBatchResults(cachedBatch);
          }
        }
      );
    }
  }

  /**
   * Prominent stock card for Product Detail page (shadcn Card style with 1-click cart addition)
   */
  function injectDetailPageCard(code) {
    if (document.getElementById("rb-detail-card")) return;

    const titleContainer =
      document.querySelector("h1") ||
      document.querySelector(".product-title") ||
      document.querySelector(".title-wrap") ||
      document.querySelector('[data-spm="xh"]');

    if (!titleContainer) return;

    const card = document.createElement("div");
    card.id = "rb-detail-card";
    card.className = "rb-detail-stock-card";
    card.innerHTML = `
      <div class="rb-detail-header">
        <div class="rb-detail-brand">
          <span style="color:#f97316; font-weight:700;">Robotistan Pro</span>
          <span>Tedarik Durumu</span>
        </div>
        <div class="rb-detail-code">LCSC Kodu: <strong>${escapeHtml(code)}</strong></div>
      </div>
      <div class="rb-detail-body" id="rb-detail-body">
        ${ICONS.spinner}
        <span style="margin-left: 6px; font-size: 12px; color:#71717a;">Robotistan Pro üzerinden canlı sorgulanıyor...</span>
      </div>
    `;

    if (titleContainer.parentNode) {
      titleContainer.parentNode.insertBefore(card, titleContainer.nextSibling);
    }

    function handleDetailResult(result) {
      const body = document.getElementById("rb-detail-body");
      if (!body || !result) return;

      if (result.status === "IN_STOCK" && result.product) {
        const p = result.product;
        card.classList.add("rb-detail-card-in-stock");
        const defaultQty = p.moq || 1;
        const stepQty = p.step || 1;

        body.innerHTML = `
          <div class="rb-detail-row">
            <div class="rb-detail-price">${escapeHtml(p.price_with_vat || "")}</div>
            <div class="rb-stock-badge rb-badge-in-stock" style="margin-left:0;">
              <span class="rb-status-dot"></span>
              <span>Stokta Var</span>
            </div>
          </div>
          <div class="rb-detail-meta">
            <div><span>KDV Hariç:</span> <strong>${p.price_without_vat ? `${Number(p.price_without_vat).toFixed(2)} ${p.currency || "TL"}` : "-"}</strong></div>
            <div><span>Paket Kuralı:</span> <strong>${escapeHtml(p.stock_unit || `Adet ${defaultQty}-${stepQty}`)}</strong></div>
            <div><span>Robotistan Ürün Adı:</span> <strong>${escapeHtml(p.title || "")}</strong></div>
          </div>

          <!-- Direct Add to Cart Action Row -->
          <div class="rb-tooltip-cart-row" style="margin-top: 8px; margin-bottom: 8px;">
            <div class="rb-tooltip-qty-wrapper">
              <span class="rb-qty-label" style="color:#ffffff;">Adet:</span>
              <input type="number" class="rb-tooltip-qty" id="rb-detail-qty-${p.id}" value="${defaultQty}" min="${defaultQty}" step="${stepQty}">
            </div>
            <button class="rb-tooltip-cart-btn" id="rb-detail-btn-${p.id}">
              ${ICONS.cart}
              <span>Robotistan Sepetime Ekle</span>
            </button>
          </div>
          <div class="rb-cart-feedback" id="rb-detail-feedback-${p.id}" style="display:none;"></div>

          <div style="margin-top: 6px;">
            <a href="${p.url || `https://robotistanpro.com/arama?q=${encodeURIComponent(code)}`}" target="_blank" rel="noopener noreferrer" class="rb-detail-btn">
              Robotistan Pro'da Aç ➔
            </a>
          </div>
        `;

        const addBtn = body.querySelector(`#rb-detail-btn-${p.id}`);
        const qtyInput = body.querySelector(`#rb-detail-qty-${p.id}`);
        const feedback = body.querySelector(`#rb-detail-feedback-${p.id}`);

        if (addBtn && qtyInput) {
          addBtn.addEventListener("click", () => {
            const qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
            addBtn.disabled = true;
            addBtn.innerHTML = `${ICONS.spinner} <span>Ekleniyor...</span>`;

            browserAPI.runtime.sendMessage(
              { action: "ADD_TO_CART", productId: p.id, quantity: qty },
              (res) => {
                addBtn.disabled = false;
                if (res && res.success) {
                  addBtn.innerHTML = `${ICONS.check} <span>Sepete Eklendi!</span>`;
                  addBtn.style.backgroundColor = "#16a34a";
                  if (feedback) {
                    feedback.style.display = "block";
                    feedback.innerHTML = `✓ ${qty} adet sepete eklendi! <a href="https://robotistanpro.com/sepet" target="_blank">Sepeti Aç ➔</a>`;
                  }
                } else {
                  addBtn.innerHTML = `<span>Hata!</span>`;
                  if (feedback) {
                    feedback.style.display = "block";
                    feedback.style.color = "#f87171";
                    feedback.textContent = res?.error || "Sepete eklenemedi.";
                  }
                }
              }
            );
          });
        }
      } else if (result.status === "PREORDER" && result.product) {
        const p = result.product;
        card.classList.add("rb-detail-card-preorder");
        body.innerHTML = `
          <div class="rb-detail-row">
            <div class="rb-detail-price">${escapeHtml(p.price_with_vat || "Fiyat Belirtilmemiş")}</div>
            <div class="rb-stock-badge rb-badge-preorder" style="margin-left:0;">
              <span class="rb-status-dot"></span>
              <span>✈️ Ön Sipariş (Temin Edilecek)</span>
            </div>
          </div>
          <div class="rb-detail-meta">
            <div><span>Paket Kuralı:</span> <strong>${escapeHtml(p.stock_unit || "-")}</strong></div>
            <div><span>Robotistan Ürün Adı:</span> <strong>${escapeHtml(p.title || "")}</strong></div>
            <p style="color:#d97706; margin-top: 4px; font-size: 11.5px;">Bu ürün online mağaza stoğunda sıfırdır, kurumsal proforma/teklif listesi ile Robotistan tarafından temin edilir.</p>
          </div>
          <a href="${p.url || result.searchUrl}" target="_blank" rel="noopener noreferrer" class="rb-detail-btn rb-btn-secondary">
            Robotistan Pro Sayfasını Gör ➔
          </a>
        `;
      } else if (result.status === "OUT_OF_STOCK" && result.product) {
        const p = result.product;
        card.classList.add("rb-detail-card-out-of-stock");
        body.innerHTML = `
          <div class="rb-detail-row">
            <div class="rb-detail-price">${escapeHtml(p.price_with_vat || "Fiyat Belirtilmemiş")}</div>
            <div class="rb-stock-badge rb-badge-out-of-stock" style="margin-left:0;">
              <span class="rb-status-dot"></span>
              <span>Tükendi</span>
            </div>
          </div>
          <div class="rb-detail-meta">
            <div><span>Paket Kuralı:</span> <strong>${escapeHtml(p.stock_unit || "-")}</strong></div>
            <div><span>Robotistan Ürün Adı:</span> <strong>${escapeHtml(p.title || "")}</strong></div>
          </div>
          <a href="${p.url || result.searchUrl}" target="_blank" rel="noopener noreferrer" class="rb-detail-btn rb-btn-secondary">
            Robotistan Pro Sayfasını Gör ➔
          </a>
        `;
      } else {
        card.classList.add("rb-detail-card-not-found");
        body.innerHTML = `
          <div class="rb-detail-row">
            <div class="rb-stock-badge rb-badge-not-found" style="margin-left:0;">
              <span>Robotistan'da Yok</span>
            </div>
          </div>
          <div class="rb-detail-meta">
            <p style="color:#71717a;">Bu LCSC koduna (${escapeHtml(code)}) ait bir ürün Robotistan Pro'da bulunamadı.</p>
          </div>
          <a href="${result.searchUrl}" target="_blank" rel="noopener noreferrer" class="rb-detail-btn rb-btn-secondary">
            Robotistan'da Manuel Ara ➔
          </a>
        `;
      }
    }

    if (requestedCodes.has(code)) {
      handleDetailResult(requestedCodes.get(code));
    } else {
      browserAPI.runtime.sendMessage(
        { action: "CHECK_STOCK", code: code, priority: true },
        (res) => {
          if (res) handleDetailResult(res);
        }
      );
    }
  }

  function scanDetailPage() {
    if (!window.location.pathname.includes("/product-detail/")) return;
    const detailCode = extractLcscCode(window.location.pathname);
    if (detailCode) {
      injectDetailPageCard(detailCode);
    }
  }

  let debounceTimer = null;
  function debouncedScan() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      scanAndInject();
      scanDetailPage();
    }, 100);
  }

  // Observe DOM mutations for dynamic content loading
  const observer = new MutationObserver((mutations) => {
    let shouldScan = false;
    for (const m of mutations) {
      if (m.addedNodes.length > 0) {
        shouldScan = true;
        break;
      }
    }
    if (shouldScan) debouncedScan();
  });

  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });

  // Observe URL changes (LCSC Single Page App navigation)
  let lastUrl = window.location.href;
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      debouncedScan();
    }
  }, 500);

  // Hide tooltip on scroll
  window.addEventListener("scroll", () => hideTooltip(0), { passive: true });

  // Initial runs
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      debouncedScan();
      setTimeout(debouncedScan, 500);
      setTimeout(debouncedScan, 1500);
    });
  } else {
    debouncedScan();
    setTimeout(debouncedScan, 500);
    setTimeout(debouncedScan, 1500);
  }
})();
