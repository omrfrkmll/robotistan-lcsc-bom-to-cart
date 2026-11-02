/**
 * KiCad BOM Parser for Robotistan Pro Cart Extension
 * Supports:
 *  1. Interactive HTML BOM (ibom.html)
 *  2. KiCad CSV / TSV / TXT BOM
 */

(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    const LZString = require("./lz-string.js");
    module.exports = factory(LZString);
  } else {
    root.BomParser = factory(root.LZString);
  }
})(typeof self !== "undefined" ? self : this, function (LZString) {
  "use strict";

  const LCSC_REGEX = /\b(C\d{3,10})\b/i;
  const EXACT_LCSC_REGEX = /^C\d{3,10}$/i;

  function parseIbom(htmlContent) {
    const match = htmlContent.match(/var pcbdata = JSON\.parse\(LZString\.decompressFromBase64\("([^"]+)"\)\)/);
    if (!match || !match[1]) {
      throw new Error("Geçerli bir Interactive HTML BOM (ibom.html) içeriği bulunamadı.");
    }

    if (!LZString) {
      throw new Error("LZString kütüphanesi yüklenemedi.");
    }

    const decompressed = LZString.decompressFromBase64(match[1]);
    if (!decompressed) {
      throw new Error("ibom verisi açılamadı (decompress hatası).");
    }

    const pcbdata = JSON.parse(decompressed);
    const bomData = pcbdata.bom || {};
    const fields = bomData.fields || {};
    const groups = bomData.both || bomData.F || [];

    const items = [];
    let itemId = 1;

    for (const group of groups) {
      if (!Array.isArray(group) || group.length === 0) continue;

      const refs = group.map((g) => g[0]).filter(Boolean);
      const fieldIdx = group[0][1];
      const fieldArray = fields[fieldIdx] || [];

      const value = fieldArray[0] || "";
      const footprint = fieldArray[1] || "";

      // Find LCSC Part Number in fields array
      let lcsc = "";
      for (let i = 2; i < fieldArray.length; i++) {
        const val = String(fieldArray[i] || "").trim();
        if (EXACT_LCSC_REGEX.test(val)) {
          lcsc = val.toUpperCase();
          break;
        }
      }

      // If not found in extra fields, try regex in all field strings or value
      if (!lcsc) {
        for (const item of fieldArray) {
          const m = String(item).match(LCSC_REGEX);
          if (m) {
            lcsc = m[1].toUpperCase();
            break;
          }
        }
      }

      const count = refs.length;
      const refStr = refs.join(", ");

      items.push({
        id: itemId++,
        references: refs,
        refString: refStr,
        value: value,
        footprint: footprint,
        lcsc: lcsc,
        qtyPerPcb: count,
        hasLcsc: Boolean(lcsc),
        selected: Boolean(lcsc), // default checked if it has LCSC code
        status: lcsc ? "ready" : "missing_code", // ready, missing_code, searching, found, not_found, added, error
        productInfo: null,
        targetQty: count,
        note: lcsc ? "" : "LCSC kodu yok (örn. montaj deliği / pin header)"
      });
    }

    return {
      type: "ibom",
      projectName: pcbdata.metadata?.title || "KiCad Projesi",
      date: pcbdata.metadata?.date || "",
      totalComponents: items.reduce((acc, it) => acc + it.qtyPerPcb, 0),
      uniqueParts: items.length,
      partsWithLcsc: items.filter((it) => it.hasLcsc).length,
      items: items
    };
  }

  function parseCsv(csvContent) {
    const lines = csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      throw new Error("CSV dosyası boş veya yetersiz satır içeriyor.");
    }

    // Auto-detect delimiter: comma, semicolon, tab
    const firstLine = lines[0];
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semiCount = (firstLine.match(/;/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;

    let delimiter = ",";
    if (semiCount > commaCount && semiCount > tabCount) delimiter = ";";
    else if (tabCount > commaCount && tabCount > semiCount) delimiter = "\t";

    function splitRow(row) {
      const result = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < row.length; i++) {
        const char = row[i];
        if (char === '"' || char === "'") {
          if (inQuotes && row[i + 1] === char) {
            current += char;
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    }

    const headers = splitRow(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9#]/g, ""));

    let refCol = headers.findIndex((h) => h.includes("ref") || h.includes("designator"));
    let qtyCol = headers.findIndex((h) => h.includes("qty") || h.includes("quantity") || h.includes("count"));
    let valCol = headers.findIndex((h) => h.includes("val") || h.includes("comment") || h.includes("description"));
    let footCol = headers.findIndex((h) => h.includes("footprint") || h.includes("package"));
    let lcscCol = headers.findIndex((h) => h.includes("lcsc") || h.includes("supplierpart") || h.includes("code"));

    const items = [];
    let itemId = 1;

    for (let i = 1; i < lines.length; i++) {
      const row = splitRow(lines[i]);
      if (row.length === 0 || row.every((c) => !c)) continue; // ignore completely empty row

      let refStr = refCol !== -1 ? row[refCol] || "" : "";
      let val = valCol !== -1 ? row[valCol] || "" : "";
      let foot = footCol !== -1 ? row[footCol] || "" : "";
      let lcsc = lcscCol !== -1 ? (row[lcscCol] || "").trim() : "";

      // Try regex search across row if LCSC not directly found
      if (!EXACT_LCSC_REGEX.test(lcsc)) {
        for (const cell of row) {
          const m = String(cell).match(LCSC_REGEX);
          if (m) {
            lcsc = m[1].toUpperCase();
            break;
          }
        }
      } else {
        lcsc = lcsc.toUpperCase();
      }

      // Quantity calculation
      let qty = 1;
      if (qtyCol !== -1 && row[qtyCol]) {
        const parsedQty = parseInt(row[qtyCol], 10);
        if (!isNaN(parsedQty) && parsedQty > 0) qty = parsedQty;
      } else if (refStr) {
        const splitRefs = refStr.split(/[,;\s]+/).filter(Boolean);
        if (splitRefs.length > 0) qty = splitRefs.length;
      }

      const refs = refStr ? refStr.split(/[,;\s]+/).filter(Boolean) : [];

      items.push({
        id: itemId++,
        references: refs,
        refString: refStr,
        value: val,
        footprint: foot,
        lcsc: lcsc,
        qtyPerPcb: qty,
        hasLcsc: Boolean(lcsc),
        selected: Boolean(lcsc),
        status: lcsc ? "ready" : "missing_code",
        productInfo: null,
        targetQty: qty,
        note: lcsc ? "" : "LCSC kodu eksik / boş satır"
      });
    }

    return {
      type: "csv",
      projectName: "BOM Dosyası",
      date: new Date().toLocaleDateString("tr-TR"),
      totalComponents: items.reduce((acc, it) => acc + it.qtyPerPcb, 0),
      uniqueParts: items.length,
      partsWithLcsc: items.filter((it) => it.hasLcsc).length,
      items: items
    };
  }

  function parse(content, fileName = "") {
    if (!content || typeof content !== "string") {
      throw new Error("Geçerli bir dosya içeriği sağlanmadı.");
    }

    const trimmed = content.trim();
    if (trimmed.includes("ibom_version") || trimmed.includes("Interactive HTML BOM") || trimmed.includes("var pcbdata =")) {
      return parseIbom(trimmed);
    } else {
      return parseCsv(trimmed);
    }
  }

  /**
   * Calculates the required quantity taking PCB count and Robotistan MOQ/step into account.
   */
  function calculateOrderQty(qtyPerPcb, pcbCount, moq = 1, step = 1, bufferPercent = 0) {
    const pcb = Math.max(1, parseInt(pcbCount, 10) || 1);
    let needed = qtyPerPcb * pcb;

    if (bufferPercent > 0) {
      needed = Math.ceil(needed * (1 + bufferPercent / 100));
    }

    const min = Math.max(1, parseInt(moq, 10) || 1);
    const stp = Math.max(1, parseInt(step, 10) || 1);

    let target = needed;
    if (target < min) {
      target = min;
    }

    if (stp > 1) {
      target = Math.ceil(target / stp) * stp;
    }

    return {
      neededQty: needed,
      moq: min,
      step: stp,
      orderQty: target,
      isMoqAdjusted: target > needed
    };
  }

  return {
    parse,
    parseIbom,
    parseCsv,
    calculateOrderQty
  };
});
