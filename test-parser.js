const fs = require("fs");
const path = require("path");
const BomParser = require("./lib/bom-parser.js");

const samplePath = "/home/ilteray/ILTERAY/Dairy-Tank-Controller/hardware/Dairy-Tank-Controller/bom/ibom.html";

console.log("Testing KiCad BOM Parser with sample file:", samplePath);

if (!fs.existsSync(samplePath)) {
  console.error("Sample file does not exist:", samplePath);
  process.exit(1);
}

const content = fs.readFileSync(samplePath, "utf-8");
const result = BomParser.parse(content, "ibom.html");

console.log("-----------------------------------------");
console.log("Project Name:", result.projectName);
console.log("Date:", result.date);
console.log("Total Components on 1 PCB:", result.totalComponents);
console.log("Unique BOM Rows (Groups):", result.uniqueParts);
console.log("Rows with valid LCSC Part #:", result.partsWithLcsc);
console.log("Rows missing LCSC Part # (Skipped/Empty):", result.uniqueParts - result.partsWithLcsc);
console.log("-----------------------------------------");

console.log("\nSample 5 items with LCSC codes:");
const sampleWithLcsc = result.items.filter(x => x.hasLcsc).slice(0, 5);
sampleWithLcsc.forEach(item => {
  console.log(`- [${item.lcsc}] Refs: ${item.refString} | Val: ${item.value} | Footprint: ${item.footprint} | Qty/PCB: ${item.qtyPerPcb}`);
});

console.log("\nItems without LCSC codes (empty rows):");
const emptyItems = result.items.filter(x => !x.hasLcsc);
emptyItems.forEach(item => {
  console.log(`- [EMPTY] Refs: ${item.refString} | Val: ${item.value} | Footprint: ${item.footprint} | Note: ${item.note}`);
});

console.log("\n-----------------------------------------");
console.log("Testing MOQ & PCB Batch Calculation for 10 PCBs:");
const pcbCount = 10;
const testMoqCases = [
  { item: sampleWithLcsc[0], moq: 100, step: 100 }, // e.g. 0603 resistor pack
  { item: sampleWithLcsc[1], moq: 1, step: 1 },     // e.g. IC / module
  { item: sampleWithLcsc[2], moq: 10, step: 10 }    // e.g. electrolytic cap
];

testMoqCases.forEach(({ item, moq, step }) => {
  const calc = BomParser.calculateOrderQty(item.qtyPerPcb, pcbCount, moq, step);
  console.log(`Part ${item.lcsc} (${item.value}):`);
  console.log(`  Qty/PCB: ${item.qtyPerPcb} x ${pcbCount} PCBs = Needed: ${calc.neededQty}`);
  console.log(`  Store MOQ: ${calc.moq}, Pack Step: ${calc.step}`);
  console.log(`  Final Order Qty: ${calc.orderQty} (MOQ Adjusted: ${calc.isMoqAdjusted})`);
});

console.log("\n✓ Parser test completed successfully!");
