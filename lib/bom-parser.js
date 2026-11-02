/**
 * KiCad BOM Parser for Robotistan Pro Cart Extension
 * Supports:
 *  1. Interactive HTML BOM (ibom.html)
 *  2. KiCad CSV / TSV / TXT BOM (including KiCostX exports)
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

  // Common SMD footprint and package identifiers that are NOT LCSC part numbers
  const SMD_FOOTPRINT_CODES = new Set([
    "C01005", "C0201", "C0402", "C0603", "C0805", "C1206", "C1210", "C1808", "C1812", "C2010", "C2220", "C2512",
    "R01005", "R0201", "R0402", "R0603", "R0805", "R1206", "R1210", "R1812", "R2010", "R2512",
    "L0402", "L0603", "L0805", "L1206"
  ]);

  const LCSC_REGEX = /\b(C\d{3,10})\b/i;

  function isValidLcscPartNumber(code) {
    if (!code || typeof code !== "string") return false;
    const s = code.trim().toUpperCase();
    if (SMD_FOOTPRINT_CODES.has(s)) return false;
    // Reject 4-digit codes starting with C0 (e.g. C0402, C0603, C0805)
    if (/^C0\d{3}$/i.test(s)) return false;
    // Valid LCSC codes are C followed by 3 to 10 digits
    return /^C\d{3,10}$/i.test(s);
  }

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
        if (isValidLcscPartNumber(val)) {
          lcsc = val.toUpperCase();
          break;
        }
      }

      // If not found in extra fields, try regex in all field strings or value
      if (!lcsc) {
        for (let i = 0; i < fieldArray.length; i++) {
          if (i === 1) continue; // Skip footprint field
          const m = String(fieldArray[i]).match(LCSC_REGEX);
          if (m && isValidLcscPartNumber(m[1])) {
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
    // Strip UTF-8 Byte Order Mark (BOM) if present
    const cleaned = csvContent.replace(/^\uFEFF/, "").trim();
    const lines = cleaned
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      throw new Error("CSV dosyası boş veya yetersiz satır içeriyor.");
    }

    // Auto-detect delimiter or read sep= line (Excel / KiCostX header)
    let delimiter = ",";
    if (lines[0].toLowerCase().startsWith("sep=")) {
      const sepChar = lines[0].slice(4).trim();
      if (sepChar) delimiter = sepChar;
      lines.shift();
    } else {
      const firstLine = lines[0];
      const commaCount = (firstLine.match(/,/g) || []).length;
      const semiCount = (firstLine.match(/;/g) || []).length;
      const tabCount = (firstLine.match(/\t/g) || []).length;
      if (semiCount > commaCount && semiCount > tabCount) delimiter = ";";
      else if (tabCount > commaCount && tabCount > semiCount) delimiter = "\t";
    }

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

    // Dynamically locate the true header row
    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const testHeaders = splitRow(lines[i]).map((h) => h.toLowerCase().replace(/[^a-z0-9#]/g, ""));
      const matches = testHeaders.filter((h) =>
        h.includes("designator") || h.includes("ref") || h.includes("qty") ||
        h.includes("val") || h.includes("footprint") || h.includes("part") || h.includes("lcsc")
      );
      if (matches.length >= 2) {
        headerRowIndex = i;
        break;
      }
    }

    const rawHeaders = splitRow(lines[headerRowIndex]);
    const headers = rawHeaders.map((h) => h.toLowerCase().replace(/[^a-z0-9#]/g, ""));

    let refCol = headers.findIndex((h) => h.includes("designator") || h.includes("ref"));
    let qtyCol = headers.findIndex((h) => h === "qtyperboard" || h === "qtyperpcb" || h.includes("qtyper") || h === "qty" || h.includes("quantity") || h.includes("count"));
    let valCol = headers.findIndex((h) => h === "value" || h.includes("val") || h.includes("comment") || h.includes("description"));
    let footCol = headers.findIndex((h) => h.includes("footprint") || h.includes("package"));
    let mpnCol = headers.findIndex((h) => h.includes("mpn") || h.includes("mfgpart"));

    // LCSC column priority: lcscpart# -> lcsc -> supplierpart# -> jlcpart# -> code
    let lcscCol = headers.findIndex((h) => h.includes("lcscpart") || h === "lcsc");
    if (lcscCol === -1) lcscCol = headers.findIndex((h) => h.includes("lcsc"));
    if (lcscCol === -1) lcscCol = headers.findIndex((h) => h.includes("supplierpart"));
    if (lcscCol === -1) lcscCol = headers.findIndex((h) => h.includes("jlcpart"));
    if (lcscCol === -1) lcscCol = headers.findIndex((h) => h === "part" || h === "part#" || h.includes("code"));

    const items = [];
    let itemId = 1;

    for (let i = headerRowIndex + 1; i < lines.length; i++) {
      const row = splitRow(lines[i]);
      if (row.length === 0 || row.every((c) => !c)) continue; // ignore completely empty row

      let refStr = refCol !== -1 ? row[refCol] || "" : "";
      let val = valCol !== -1 ? row[valCol] || "" : "";
      let foot = footCol !== -1 ? row[footCol] || "" : "";
      let rawLcsc = lcscCol !== -1 ? (row[lcscCol] || "").trim() : "";
      let lcsc = isValidLcscPartNumber(rawLcsc) ? rawLcsc.toUpperCase() : "";

      // If not directly found in the LCSC column, search row BUT strictly skip footprint & designator columns!
      if (!lcsc) {
        for (let c = 0; c < row.length; c++) {
          if (c === footCol || c === refCol) continue;
          const cell = row[c];
          const m = String(cell).match(LCSC_REGEX);
          if (m && isValidLcscPartNumber(m[1])) {
            lcsc = m[1].toUpperCase();
            break;
          }
        }
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
      projectName: "KiCostX / KiCad BOM",
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
    calculateOrderQty,
    isValidLcscPartNumber
  };
});
