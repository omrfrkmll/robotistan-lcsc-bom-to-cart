/**
 * Robotistan Pro - KiCad BOM to Cart Content Script
 * Injected on robotistanpro.com
 */

(function () {
  "use strict";

  // Prevent multiple injections
  if (window.__RB_BOM_INITIALIZED__) return;
  window.__RB_BOM_INITIALIZED__ = true;

  let bomData = null;
  let pcbCount = 10;
  let bufferPercent = 0;
  let activeFilter = "lcsc"; // 'all', 'lcsc', 'in_stock', 'preorder', 'empty'
  let isProcessing = false;

  // Icons
  const ICONS = {
    cpu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>`,
    upload: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
    cart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>`,
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    clipboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>`,
    plane: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>`
  };

  function initUI() {
    // 1. Floating Button
    const floatBtn = document.createElement("button");
    floatBtn.id = "rb-bom-floating-btn";
    floatBtn.innerHTML = `
      ${ICONS.cpu}
      <span>KiCad BOM Aktar</span>
      <span class="rb-badge" id="rb-btn-badge" style="display:none;">0</span>
    `;
    floatBtn.addEventListener("click", toggleDrawer);
    document.body.appendChild(floatBtn);

    // 2. Drawer Overlay
    const overlay = document.createElement("div");
    overlay.id = "rb-bom-drawer-overlay";
    overlay.innerHTML = `
      <div id="rb-bom-drawer">
        <!-- Header -->
        <div class="rb-header">
          <div class="rb-title-group">
            <div class="rb-logo-icon">${ICONS.cpu}</div>
            <div>
              <h3 class="rb-title">KiCad BOM -> Robotistan Pro Sepeti</h3>
              <p class="rb-subtitle">BOM listesini yükleyin, PCB adedi ve MOQ katlarına göre otomatik sepete ekleyin</p>
            </div>
          </div>
          <button class="rb-close-btn" id="rb-close-btn" title="Kapat (ESC)">
            ${ICONS.close}
          </button>
        </div>

        <!-- Body -->
        <div class="rb-body" id="rb-body">
          <!-- Dropzone -->
          <div class="rb-dropzone" id="rb-dropzone">
            <input type="file" id="rb-file-input" class="rb-file-input" accept=".html,.csv,.tsv,.txt">
            <div class="rb-dropzone-content">
              ${ICONS.upload}
              <div class="rb-dropzone-title">KiCad BOM dosyasını buraya sürükleyin veya seçin</div>
              <div class="rb-dropzone-desc">ibom.html (Interactive HTML BOM) veya KiCad CSV/TSV formatları desteklenir</div>
            </div>
          </div>

          <!-- Summary & Settings Section (hidden initially) -->
          <div id="rb-loaded-section" style="display: none; display: flex; flex-direction: column; gap: 16px;">
            <!-- Summary card -->
            <div class="rb-summary-card">
              <div class="rb-summary-info">
                <div class="rb-stat">
                  <span class="rb-stat-label">Proje</span>
                  <span class="rb-stat-value" id="rb-stat-project">-</span>
                </div>
                <div class="rb-stat">
                  <span class="rb-stat-label">1 Karttaki Parça</span>
                  <span class="rb-stat-value" id="rb-stat-total">0</span>
                </div>
                <div class="rb-stat">
                  <span class="rb-stat-label">Benzersiz Parça</span>
                  <span class="rb-stat-value" id="rb-stat-unique">0</span>
                </div>
                <div class="rb-stat">
                  <span class="rb-stat-label">LCSC Kodlu</span>
                  <span class="rb-stat-value" style="color:#15803d;" id="rb-stat-lcsc">0</span>
                </div>
                <div class="rb-stat">
                  <span class="rb-stat-label">Stokta Olan</span>
                  <span class="rb-stat-value" style="color:#15803d;" id="rb-stat-instock">-</span>
                </div>
                <div class="rb-stat">
                  <span class="rb-stat-label">Ön Sipariş</span>
                  <span class="rb-stat-value" style="color:#d97706;" id="rb-stat-preorder">-</span>
                </div>
                <div class="rb-stat">
                  <span class="rb-stat-label">Kodsuz / Boş</span>
                  <span class="rb-stat-value" style="color:#64748b;" id="rb-stat-empty">0</span>
                </div>
              </div>
              <button class="rb-btn-text" id="rb-change-file-btn">Farklı Dosya Seç</button>
            </div>

            <!-- Config Bar -->
            <div class="rb-config-bar">
              <div class="rb-config-group">
                <span class="rb-config-label">Hedef PCB Adedi:</span>
                <div class="rb-stepper">
                  <button class="rb-stepper-btn" id="rb-pcb-minus">−</button>
                  <input type="number" class="rb-stepper-input" id="rb-pcb-count" value="10" min="1" max="10000">
                  <button class="rb-stepper-btn" id="rb-pcb-plus">+</button>
                </div>
                <div class="rb-presets">
                  <button class="rb-preset-btn" data-pcb="1">1</button>
                  <button class="rb-preset-btn" data-pcb="5">5</button>
                  <button class="rb-preset-btn active" data-pcb="10">10</button>
                  <button class="rb-preset-btn" data-pcb="25">25</button>
                  <button class="rb-preset-btn" data-pcb="50">50</button>
                  <button class="rb-preset-btn" data-pcb="100">100</button>
                </div>
              </div>

              <div class="rb-config-group">
                <span class="rb-config-label">SMD Fire / Yedek Payı:</span>
                <select class="rb-select" id="rb-buffer-select">
                  <option value="0" selected>%0 (Tam Adet)</option>
                  <option value="5">%5 (Tavsiye Edilen)</option>
                  <option value="10">%10</option>
                </select>
              </div>
            </div>

            <!-- Filter Bar -->
            <div class="rb-filter-bar">
              <div class="rb-tabs">
                <button class="rb-tab active" data-filter="lcsc" id="rb-tab-lcsc">LCSC Kodlular (<span id="rb-tab-lcsc-count">0</span>)</button>
                <button class="rb-tab" data-filter="in_stock" id="rb-tab-instock">Stokta Olanlar (<span id="rb-tab-instock-count">0</span>)</button>
                <button class="rb-tab rb-tab-preorder" data-filter="preorder" id="rb-tab-preorder">✈️ Ön Sipariş (<span id="rb-tab-preorder-count">0</span>)</button>
                <button class="rb-tab" data-filter="empty" id="rb-tab-empty">Kodsuz / Boş (<span id="rb-tab-empty-count">0</span>)</button>
                <button class="rb-tab" data-filter="all" id="rb-tab-all">Tümü (<span id="rb-tab-all-count">0</span>)</button>
              </div>
              <div class="rb-selection-ops">
                <button class="rb-btn-text" id="rb-copy-preorder-top-btn" style="display: none; color:#b45309; font-weight:700;">
                  📋 Ön Siparişleri Kopyala
                </button>
                <button class="rb-btn-text" id="rb-select-all-btn">Tümünü Seç</button>
                <button class="rb-btn-text" id="rb-deselect-all-btn">Kaldır</button>
              </div>
            </div>

            <!-- Table -->
            <div class="rb-table-container">
              <table class="rb-table">
                <thead>
                  <tr>
                    <th style="width: 36px;"><input type="checkbox" id="rb-th-check" checked></th>
                    <th>LCSC Kodu</th>
                    <th>Değer / Parça</th>
                    <th>Kılıf & Pozisyonlar</th>
                    <th style="text-align:center;">1 Kart</th>
                    <th style="text-align:center;">Hedef İhtiyaç</th>
                    <th style="text-align:center;">Sepet Adedi (MOQ)</th>
                    <th>Robotistan Durumu</th>
                  </tr>
                </thead>
                <tbody id="rb-table-body">
                  <!-- Rows injected dynamically -->
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Footer / Action Row -->
        <div class="rb-footer" id="rb-footer" style="display: none;">
          <div class="rb-progress-bar-container" id="rb-progress-container">
            <div class="rb-progress-bar" id="rb-progress-bar"></div>
          </div>

          <div class="rb-action-row">
            <div class="rb-action-stats">
              <span class="rb-action-stats-title" id="rb-stats-summary">Seçili: 0 komponent</span>
              <span class="rb-action-stats-desc" id="rb-stats-price">Tahmini Tutar: -</span>
            </div>

            <div class="rb-buttons-group">
              <button class="rb-btn rb-btn-outline" id="rb-copy-preorder-btn" style="display: none;">
                ${ICONS.clipboard}
                <span>Ön Sipariş Listesini Kopyala (<span id="rb-btn-preorder-badge">0</span>)</span>
              </button>
              <button class="rb-btn rb-btn-secondary" id="rb-fetch-info-btn">
                ${ICONS.search}
                <span>1. Robotistan'da Sorgula ve MOQ Hesapla</span>
              </button>
              <button class="rb-btn rb-btn-primary" id="rb-add-cart-btn">
                ${ICONS.cart}
                <span>2. Sepete Ekle</span>
              </button>
              <a href="/sepet" target="_blank" class="rb-btn rb-btn-success" id="rb-go-cart-btn" style="display: none; text-decoration: none;">
                ${ICONS.check}
                <span>Sepete Git</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Event listeners
    setupEventListeners(overlay);

    // Load cached state if available
    loadStoredState();
  }

  function setupEventListeners(overlay) {
    // Close button & overlay click
    const closeBtn = overlay.querySelector("#rb-close-btn");
    closeBtn.addEventListener("click", () => setDrawerOpen(false));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) setDrawerOpen(false);
    });

    // ESC to close
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.classList.contains("rb-open")) {
        setDrawerOpen(false);
      }
    });

    // File input & dropzone
    const dropzone = overlay.querySelector("#rb-dropzone");
    const fileInput = overlay.querySelector("#rb-file-input");

    dropzone.addEventListener("click", () => fileInput.click());
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("rb-dragover");
    });
    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("rb-dragover");
    });
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("rb-dragover");
      if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
      }
    });
    fileInput.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
      }
    });

    // Change file button
    overlay.querySelector("#rb-change-file-btn").addEventListener("click", () => {
      fileInput.value = "";
      fileInput.click();
    });

    // Stepper & presets
    const pcbInput = overlay.querySelector("#rb-pcb-count");
    overlay.querySelector("#rb-pcb-minus").addEventListener("click", () => {
      const val = Math.max(1, (parseInt(pcbInput.value, 10) || 1) - 1);
      setPcbCount(val);
    });
    overlay.querySelector("#rb-pcb-plus").addEventListener("click", () => {
      const val = (parseInt(pcbInput.value, 10) || 1) + 1;
      setPcbCount(val);
    });
    pcbInput.addEventListener("change", () => {
      const val = Math.max(1, parseInt(pcbInput.value, 10) || 1);
      setPcbCount(val);
    });

    overlay.querySelectorAll(".rb-preset-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const val = parseInt(btn.dataset.pcb, 10);
        setPcbCount(val);
      });
    });

    // Buffer percentage
    const bufferSelect = overlay.querySelector("#rb-buffer-select");
    bufferSelect.addEventListener("change", () => {
      bufferPercent = parseInt(bufferSelect.value, 10) || 0;
      recalculateQuantities();
      renderTable();
    });

    // Filters
    overlay.querySelectorAll(".rb-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        overlay.querySelectorAll(".rb-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        activeFilter = tab.dataset.filter;
        renderTable();
      });
    });

    // Select all / Deselect all
    overlay.querySelector("#rb-select-all-btn").addEventListener("click", () => {
      setSelectionForVisible(true);
    });
    overlay.querySelector("#rb-deselect-all-btn").addEventListener("click", () => {
      setSelectionForVisible(false);
    });
    overlay.querySelector("#rb-th-check").addEventListener("change", (e) => {
      setSelectionForVisible(e.target.checked);
    });

    // Copy Pre-order List buttons
    overlay.querySelector("#rb-copy-preorder-btn").addEventListener("click", copyPreorderList);
    overlay.querySelector("#rb-copy-preorder-top-btn").addEventListener("click", copyPreorderList);

    // Actions
    overlay.querySelector("#rb-fetch-info-btn").addEventListener("click", fetchRobotistanInfo);
    overlay.querySelector("#rb-add-cart-btn").addEventListener("click", addSelectedToCart);
  }

  function setDrawerOpen(isOpen) {
    const overlay = document.querySelector("#rb-bom-drawer-overlay");
    if (!overlay) return;
    if (isOpen) {
      overlay.classList.add("rb-open");
    } else {
      overlay.classList.remove("rb-open");
    }
  }

  function toggleDrawer() {
    const overlay = document.querySelector("#rb-bom-drawer-overlay");
    if (!overlay) return;
    setDrawerOpen(!overlay.classList.contains("rb-open"));
  }

  function setPcbCount(val) {
    pcbCount = val;
    const pcbInput = document.querySelector("#rb-pcb-count");
    if (pcbInput) pcbInput.value = val;

    document.querySelectorAll(".rb-preset-btn").forEach((btn) => {
      if (parseInt(btn.dataset.pcb, 10) === val) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    recalculateQuantities();
    renderTable();
    updateActionStats();
    saveState();
  }

  function handleFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      try {
        bomData = window.BomParser.parse(content, file.name);
        recalculateQuantities();
        renderLoadedBOM();
        saveState();
      } catch (err) {
        alert("BOM dosyası işlenirken hata oluştu: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  function recalculateQuantities() {
    if (!bomData || !bomData.items) return;

    for (const item of bomData.items) {
      const moq = item.productInfo?.moq || 1;
      const step = item.productInfo?.step || 1;
      const calc = window.BomParser.calculateOrderQty(item.qtyPerPcb, pcbCount, moq, step, bufferPercent);

      item.calculatedNeeded = calc.neededQty;
      item.targetQty = calc.orderQty;
      item.isMoqAdjusted = calc.isMoqAdjusted;
      item.moq = calc.moq;
      item.step = calc.step;
    }
  }

  function updateCounts() {
    if (!bomData || !bomData.items) return;

    const lcscItems = bomData.items.filter((x) => x.hasLcsc);
    const inStockItems = lcscItems.filter(
      (x) => x.productInfo && !x.productInfo.isPreorder && x.productInfo.stock > 0
    );
    const preorderItems = lcscItems.filter(
      (x) => x.productInfo?.isPreorder || x.status === "preorder_rejected"
    );
    const emptyItems = bomData.items.filter((x) => !x.hasLcsc);

    const lcscTabCount = document.querySelector("#rb-tab-lcsc-count");
    if (lcscTabCount) lcscTabCount.textContent = lcscItems.length;

    const instockTabCount = document.querySelector("#rb-tab-instock-count");
    if (instockTabCount) instockTabCount.textContent = inStockItems.length;

    const preorderTabCount = document.querySelector("#rb-tab-preorder-count");
    if (preorderTabCount) preorderTabCount.textContent = preorderItems.length;

    const emptyTabCount = document.querySelector("#rb-tab-empty-count");
    if (emptyTabCount) emptyTabCount.textContent = emptyItems.length;

    const allTabCount = document.querySelector("#rb-tab-all-count");
    if (allTabCount) allTabCount.textContent = bomData.items.length;

    // Summary card stats
    const statInstock = document.querySelector("#rb-stat-instock");
    if (statInstock) {
      statInstock.textContent = inStockItems.length > 0 ? inStockItems.length : "-";
    }
    const statPreorder = document.querySelector("#rb-stat-preorder");
    if (statPreorder) {
      statPreorder.textContent = preorderItems.length > 0 ? preorderItems.length : (inStockItems.length > 0 ? "0" : "-");
    }

    // Preorder copy buttons visibility
    const preorderBtn = document.querySelector("#rb-copy-preorder-btn");
    const preorderBadge = document.querySelector("#rb-btn-preorder-badge");
    const preorderTopBtn = document.querySelector("#rb-copy-preorder-top-btn");

    if (preorderItems.length > 0) {
      if (preorderBtn) preorderBtn.style.display = "inline-flex";
      if (preorderBadge) preorderBadge.textContent = preorderItems.length;
      if (preorderTopBtn) preorderTopBtn.style.display = "inline-flex";
    } else {
      if (preorderBtn) preorderBtn.style.display = "none";
      if (preorderTopBtn) preorderTopBtn.style.display = "none";
    }
  }

  function renderLoadedBOM() {
    if (!bomData) return;

    document.querySelector("#rb-loaded-section").style.display = "flex";
    document.querySelector("#rb-footer").style.display = "flex";

    document.querySelector("#rb-stat-project").textContent = bomData.projectName || "Proje";
    document.querySelector("#rb-stat-total").textContent = bomData.totalComponents;
    document.querySelector("#rb-stat-unique").textContent = bomData.uniqueParts;
    document.querySelector("#rb-stat-lcsc").textContent = bomData.partsWithLcsc;
    document.querySelector("#rb-stat-empty").textContent = bomData.uniqueParts - bomData.partsWithLcsc;

    const badge = document.querySelector("#rb-btn-badge");
    if (badge) {
      badge.textContent = bomData.partsWithLcsc;
      badge.style.display = "inline-block";
    }

    updateCounts();
    renderTable();
    updateActionStats();
  }

  function getVisibleItems() {
    if (!bomData || !bomData.items) return [];

    if (activeFilter === "lcsc") {
      return bomData.items.filter((it) => it.hasLcsc);
    } else if (activeFilter === "in_stock") {
      return bomData.items.filter(
        (it) => it.hasLcsc && it.productInfo && !it.productInfo.isPreorder && it.productInfo.stock > 0
      );
    } else if (activeFilter === "preorder") {
      return bomData.items.filter(
        (it) => it.hasLcsc && (it.productInfo?.isPreorder || it.status === "preorder_rejected")
      );
    } else if (activeFilter === "empty") {
      return bomData.items.filter((it) => !it.hasLcsc);
    }
    return bomData.items;
  }

  function setSelectionForVisible(isSelected) {
    const visible = getVisibleItems();
    visible.forEach((it) => (it.selected = isSelected));
    renderTable();
    updateActionStats();
  }

  function renderTable() {
    const tbody = document.querySelector("#rb-table-body");
    if (!tbody || !bomData) return;

    const visibleItems = getVisibleItems();
    tbody.innerHTML = "";

    if (visibleItems.length === 0) {
      let emptyMsg = "Bu filtreye uygun komponent bulunamadı.";
      if (activeFilter === "preorder") {
        emptyMsg = "Ön sipariş statüsünde veya temin edilecek komponent bulunmuyor.";
      } else if (activeFilter === "in_stock") {
        emptyMsg = "Henüz sorgulama yapılmadı veya stokta parça bulunamadı.";
      }
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 24px; color:#64748b;">${emptyMsg}</td></tr>`;
      return;
    }

    for (const item of visibleItems) {
      const tr = document.createElement("tr");
      if (!item.hasLcsc) tr.classList.add("rb-row-empty");
      if (item.productInfo?.isPreorder || item.status === "preorder_rejected") {
        tr.classList.add("rb-row-preorder");
      }

      // Status text & badge class
      let statusHtml = "";
      if (item.status === "searching") {
        statusHtml = `<span class="rb-status-badge rb-status-searching">Sorgulanıyor...</span>`;
      } else if (item.status === "found") {
        const price = item.productInfo?.totalPriceWithVat
          ? `${Number(item.productInfo.totalPriceWithVat).toFixed(2)} ₺`
          : "Fiyat Al";

        if (item.productInfo?.isPreorder) {
          statusHtml = `
            <div>
              <span class="rb-status-badge rb-status-preorder">✈️ Ön Sipariş (Temin Edilecek)</span>
              <div class="rb-sub-text" style="color:#b45309; margin-top:2px;">Tedarikçi Stoğu: 0 (${price})</div>
            </div>
          `;
        } else {
          const stock = item.productInfo?.stockDisplay || "Mevcut";
          statusHtml = `
            <div>
              <span class="rb-status-badge rb-status-found">Stokta (${price})</span>
              <div class="rb-sub-text" style="color:#15803d; margin-top:2px;">Stok: ${stock}</div>
            </div>
          `;
        }
      } else if (item.status === "preorder_rejected") {
        statusHtml = `
          <div>
            <span class="rb-status-badge rb-status-preorder-rejected">✈️ Ön Sipariş (Eklenemedi)</span>
            <div class="rb-sub-text" style="color:#b45309; margin-top:2px;">Stok 0 - Proforma teklifi alın</div>
          </div>
        `;
      } else if (item.status === "not_found") {
        statusHtml = `<span class="rb-status-badge rb-status-not_found">Robotistan'da Yok</span>`;
      } else if (item.status === "added") {
        statusHtml = `<span class="rb-status-badge rb-status-added">${ICONS.check} Sepete Eklendi</span>`;
      } else if (item.status === "missing_code") {
        statusHtml = `<span class="rb-status-badge rb-status-missing_code">Kod Eksik</span>`;
      } else {
        statusHtml = `<span class="rb-status-badge rb-status-ready">Hazır</span>`;
      }

      // LCSC cell with editable option if empty
      let lcscContent = "";
      if (item.hasLcsc) {
        lcscContent = `
          <span class="rb-code-cell">
            <a href="https://robotistanpro.com/arama?q=${item.lcsc}" target="_blank" title="Robotistan'da Ara">
              ${item.lcsc}
            </a>
          </span>
        `;
      } else {
        lcscContent = `
          <input type="text" class="rb-qty-input" style="width: 80px; font-weight:600; text-align:left; padding:0 4px;" 
                 placeholder="C..." data-item-id="${item.id}" data-action="set-lcsc">
        `;
      }

      // MOQ pill
      let moqPill = "";
      if (item.isMoqAdjusted) {
        moqPill = `<div class="rb-moq-pill" title="MOQ: ${item.moq}, Paket Katı: ${item.step}">MOQ: +${item.targetQty - item.calculatedNeeded} adet</div>`;
      } else if (item.productInfo && (item.moq > 1 || item.step > 1)) {
        moqPill = `<div class="rb-sub-text">MOQ: ${item.moq} | Kat: ${item.step}</div>`;
      }

      tr.innerHTML = `
        <td>
          <input type="checkbox" class="rb-item-check" data-item-id="${item.id}" ${item.selected ? "checked" : ""}>
        </td>
        <td>${lcscContent}</td>
        <td>
          <div class="rb-val-cell" title="${item.value}">${item.value || "-"}</div>
          ${item.productInfo?.name ? `<div class="rb-sub-text" style="color:#0369a1;">${item.productInfo.name}</div>` : ""}
        </td>
        <td>
          <div class="rb-sub-text" style="font-weight:600; color:#334155;">${item.footprint || "-"}</div>
          <div class="rb-sub-text" title="${item.refString}" style="max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${item.refString}
          </div>
        </td>
        <td style="text-align:center; font-weight:700;">${item.qtyPerPcb}</td>
        <td style="text-align:center;">
          <span style="font-weight:700; color:#475569;">${item.calculatedNeeded}</span>
        </td>
        <td style="text-align:center;">
          <input type="number" class="rb-qty-input" data-item-id="${item.id}" data-action="set-target-qty" 
                 value="${item.targetQty}" min="1" step="${item.step || 1}">
          ${moqPill}
        </td>
        <td>${statusHtml}</td>
      `;

      tbody.appendChild(tr);
    }

    // Bind row input listeners
    tbody.querySelectorAll(".rb-item-check").forEach((ck) => {
      ck.addEventListener("change", (e) => {
        const id = parseInt(ck.dataset.itemId, 10);
        const item = bomData.items.find((x) => x.id === id);
        if (item) {
          item.selected = e.target.checked;
          updateActionStats();
        }
      });
    });

    tbody.querySelectorAll('[data-action="set-target-qty"]').forEach((input) => {
      input.addEventListener("change", (e) => {
        const id = parseInt(input.dataset.itemId, 10);
        const item = bomData.items.find((x) => x.id === id);
        if (item) {
          item.targetQty = Math.max(1, parseInt(e.target.value, 10) || 1);
          updateActionStats();
        }
      });
    });

    tbody.querySelectorAll('[data-action="set-lcsc"]').forEach((input) => {
      input.addEventListener("change", (e) => {
        const id = parseInt(input.dataset.itemId, 10);
        const item = bomData.items.find((x) => x.id === id);
        const val = e.target.value.trim().toUpperCase();
        if (item && val) {
          item.lcsc = val;
          item.hasLcsc = true;
          item.selected = true;
          item.status = "ready";
          bomData.partsWithLcsc = bomData.items.filter((x) => x.hasLcsc).length;
          renderLoadedBOM();
        }
      });
    });
  }

  function updateActionStats() {
    if (!bomData) return;

    const selectedItems = bomData.items.filter((it) => it.selected);
    const totalComponents = selectedItems.reduce((acc, it) => acc + (it.targetQty || 0), 0);

    let totalPrice = 0;
    let hasPrices = false;
    for (const item of selectedItems) {
      if (item.productInfo && item.productInfo.totalPriceWithVat) {
        totalPrice += item.productInfo.totalPriceWithVat * (item.targetQty || 1);
        hasPrices = true;
      }
    }

    const summaryText = `Seçili: ${selectedItems.length} parça (${totalComponents.toLocaleString()} toplam adet)`;
    document.querySelector("#rb-stats-summary").textContent = summaryText;

    if (hasPrices) {
      document.querySelector("#rb-stats-price").textContent = `Tahmini Tutar (KDV Dahil): ~${totalPrice.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
    } else {
      document.querySelector("#rb-stats-price").textContent = "Fiyatları görmek için '1. Robotistan'da Sorgula' butonuna basın";
    }
  }

  /**
   * Batch query product data, MOQ, packaging step, price, stock, and preorder status from Robotistan Pro
   */
  async function fetchRobotistanInfo() {
    if (isProcessing || !bomData) return;
    const selectedItems = bomData.items.filter((it) => it.selected && it.hasLcsc);

    if (selectedItems.length === 0) {
      alert("Sorgulamak için geçerli LCSC koduna sahip en az bir parça seçmelisiniz.");
      return;
    }

    isProcessing = true;
    const btn = document.querySelector("#rb-fetch-info-btn");
    btn.disabled = true;

    const progressContainer = document.querySelector("#rb-progress-container");
    const progressBar = document.querySelector("#rb-progress-bar");
    progressContainer.classList.add("active");
    progressBar.style.width = "0%";

    let done = 0;
    for (const item of selectedItems) {
      item.status = "searching";
      renderTable();

      try {
        const res = await window.RobotistanApi.searchProduct(item.lcsc);
        if (res.success && res.product) {
          item.productInfo = res.product;
          item.moq = res.moq;
          item.step = res.step;
          item.status = "found";

          // Recalculate MOQ & step adjusted quantity
          const calc = window.BomParser.calculateOrderQty(
            item.qtyPerPcb,
            pcbCount,
            res.moq,
            res.step,
            bufferPercent
          );
          item.targetQty = calc.orderQty;
          item.isMoqAdjusted = calc.isMoqAdjusted;
        } else {
          item.status = "not_found";
        }
      } catch (err) {
        item.status = "not_found";
      }

      done++;
      progressBar.style.width = `${Math.round((done / selectedItems.length) * 100)}%`;
      updateCounts();
      renderTable();
      updateActionStats();

      // Small delay between requests to be polite to the server
      await new Promise((r) => setTimeout(r, 60));
    }

    setTimeout(() => {
      progressContainer.classList.remove("active");
    }, 1000);

    isProcessing = false;
    btn.disabled = false;
    updateCounts();
    saveState();
  }

  /**
   * Copy out-of-stock / pre-order items list to clipboard for quote request
   */
  function copyPreorderList() {
    if (!bomData) return;

    const preorderItems = bomData.items.filter(
      (x) => x.hasLcsc && (x.productInfo?.isPreorder || x.status === "preorder_rejected")
    );

    if (preorderItems.length === 0) {
      alert("Ön sipariş veya temin edilecek statüsünde komponent bulunmuyor.");
      return;
    }

    let text = `=================================================================\n`;
    text += `ROBOTİSTAN PRO - ÖN SİPARİŞ / TEMİN EDİLECEK PARÇA TALEBİ\n`;
    text += `Proje: ${bomData.projectName || "KiCad Projesi"}\n`;
    text += `Hedef Kart Adedi: ${pcbCount} PCB\n`;
    text += `Oluşturulma Tarihi: ${new Date().toLocaleString("tr-TR")}\n`;
    text += `=================================================================\n\n`;
    text += `LCSC Kodu\tParça Değeri\tRobotistan Ürün Adı\tTalep Adedi\tKılıf\tPozisyonlar\n`;

    for (const it of preorderItems) {
      const name = it.productInfo?.name || it.value || "-";
      text += `${it.lcsc}\t${it.value || "-"}\t${name}\t${it.targetQty} adet\t${it.footprint || "-"}\t${it.refString || "-"}\n`;
    }

    text += `\n-----------------------------------------------------------------\n`;
    text += `Toplam Ön Sipariş Komponent Sayısı: ${preorderItems.length} çeşit\n`;
    text += `Not: Bu parçalar online sepet sisteminde 'Mevcut Stok: 0' (Temin Edilecek) olduğu için doğrudan sepete eklenememektedir. Kurumsal satış / teklif birimi üzerinden proforma talep edilmelidir.\n`;

    navigator.clipboard.writeText(text).then(() => {
      alert(
        `✓ ${preorderItems.length} adet Ön Sipariş komponenti panoya kopyalandı!\n\nRobotistan Pro satış birimine veya teklif formuna yapıştırarak talep oluşturabilirsiniz.`
      );
    }).catch(() => {
      window.prompt("Ön sipariş listesini kopyalayın (Ctrl+C):", text);
    });
  }

  /**
   * Add selected confirmed items to the active Robotistan Pro cart
   */
  async function addSelectedToCart() {
    if (isProcessing || !bomData) return;

    // Filter items ready to add
    const itemsToAdd = bomData.items.filter(
      (it) => it.selected && it.hasLcsc && it.productInfo && it.productInfo.id
    );

    if (itemsToAdd.length === 0) {
      alert("Önce '1. Robotistan'da Sorgula' butonuna basarak ürünlerin Robotistan Pro'daki karşılıklarını sorgulamalısınız.");
      return;
    }

    const inStockItems = itemsToAdd.filter(
      (it) => !it.productInfo.isPreorder && it.productInfo.stock > 0
    );
    const preorderItems = itemsToAdd.filter(
      (it) => it.productInfo.isPreorder || it.productInfo.stock <= 0
    );

    let confirmMsg = `${itemsToAdd.length} seçili parçadan:\n`;
    confirmMsg += `✓ ${inStockItems.length} adedi stokta ve doğrudan sepete eklenecektir.\n`;
    if (preorderItems.length > 0) {
      confirmMsg += `✈️ ${preorderItems.length} adedi 'Ön Sipariş / Temin Edilecek' (Stok: 0) statüsündedir.\n(Robotistan Pro online sepeti 0 stoklu ürünleri reddeder, bu parçalar 'Ön Sipariş Listesi'ne ayrılacaktır.)\n\n`;
    }
    confirmMsg += `Stoktaki ürünlerin sepete eklenmesini onaylıyor musunuz?`;

    if (!confirm(confirmMsg)) return;

    isProcessing = true;
    const addBtn = document.querySelector("#rb-add-cart-btn");
    addBtn.disabled = true;

    const progressContainer = document.querySelector("#rb-progress-container");
    const progressBar = document.querySelector("#rb-progress-bar");
    progressContainer.classList.add("active");
    progressBar.style.width = "0%";

    let addedCount = 0;
    let preorderSkippedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < itemsToAdd.length; i++) {
      const item = itemsToAdd[i];

      // If already known as preorder, skip web cart add attempt to prevent T-Soft error
      if (item.productInfo.isPreorder || item.productInfo.stock <= 0) {
        item.status = "preorder_rejected";
        preorderSkippedCount++;
        progressBar.style.width = `${Math.round(((i + 1) / itemsToAdd.length) * 100)}%`;
        renderTable();
        continue;
      }

      try {
        const res = await window.RobotistanApi.addToCart({
          productId: item.productInfo.id,
          quantity: item.targetQty,
          variantId: 0
        });

        if (res.success) {
          item.status = "added";
          addedCount++;
        } else if (res.isPreorder) {
          item.status = "preorder_rejected";
          item.productInfo.isPreorder = true;
          preorderSkippedCount++;
        } else {
          console.warn(`Parça sepete eklenemedi (${item.lcsc}):`, res.error);
          failedCount++;
        }
      } catch (err) {
        failedCount++;
      }

      progressBar.style.width = `${Math.round(((i + 1) / itemsToAdd.length) * 100)}%`;
      renderTable();

      // Delay between adds so T-Soft session can handle items comfortably
      await new Promise((r) => setTimeout(r, 180));
    }

    isProcessing = false;
    addBtn.disabled = false;
    updateCounts();

    // Show Go to Cart button
    if (addedCount > 0) {
      document.querySelector("#rb-go-cart-btn").style.display = "inline-flex";
    }

    let resultMsg = `İşlem Tamamlandı!\n\n✓ ${addedCount} parça başarıyla sepete eklendi.`;
    if (preorderSkippedCount > 0) {
      resultMsg += `\n✈️ ${preorderSkippedCount} parça 'Ön Sipariş' (Stok: 0) olduğu için online sepete eklenemedi. Bu parçaları 'Ön Sipariş Listesini Kopyala' butonundan alabilirsiniz.`;
    }
    if (failedCount > 0) {
      resultMsg += `\n⚠ ${failedCount} parça mağaza hatası nedeniyle eklenemedi.`;
    }

    alert(resultMsg);
    saveState();
  }

  // Storage helper
  function saveState() {
    if (!bomData) return;
    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
          rb_bom_state: {
            bomData,
            pcbCount,
            bufferPercent
          }
        });
      }
    } catch (e) {}
  }

  function loadStoredState() {
    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(["rb_bom_state"], (result) => {
          if (result && result.rb_bom_state) {
            const state = result.rb_bom_state;
            if (state.bomData) {
              bomData = state.bomData;
              pcbCount = state.pcbCount || 10;
              bufferPercent = state.bufferPercent || 0;

              const pcbInput = document.querySelector("#rb-pcb-count");
              if (pcbInput) pcbInput.value = pcbCount;

              renderLoadedBOM();
            }
          }
        });
      }
    } catch (e) {}
  }

  // Listen to background messages
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "TOGGLE_BOM_PANEL") {
        toggleDrawer();
        sendResponse({ success: true });
      }
    });
  }

  // Initialize UI once DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initUI);
  } else {
    initUI();
  }
})();
