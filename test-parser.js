const fs = require("fs");
const path = require("path");
const BomParser = require("./lib/bom-parser.js");

console.log("=========================================");
console.log("1. Testing KiCad iBOM (ibom.html)");
console.log("=========================================");

const ibomPath = "/home/ilteray/ILTERAY/Dairy-Tank-Controller/hardware/Dairy-Tank-Controller/bom/ibom.html";

if (fs.existsSync(ibomPath)) {
  const content = fs.readFileSync(ibomPath, "utf-8");
  const result = BomParser.parse(content, "ibom.html");

  console.log("Project Name:", result.projectName);
  console.log("Total Components on 1 PCB:", result.totalComponents);
  console.log("Unique BOM Rows:", result.uniqueParts);
  console.log("Rows with valid LCSC:", result.partsWithLcsc);
  console.log("Rows missing LCSC:", result.uniqueParts - result.partsWithLcsc);

  const sample = result.items.find(x => x.value.includes("GRM188R71H104KA93D"));
  console.log("Sample Capacitor Check:", {
    val: sample?.value,
    footprint: sample?.footprint,
    lcsc: sample?.lcsc
  });
}

console.log("\n=========================================");
console.log("2. Testing KiCostX CSV (Dairy-Tank-Controller_kicostx_bom.csv)");
console.log("=========================================");

const csvPath = "/home/ilteray/Dairy-Tank-Controller_kicostx_bom.csv";

if (fs.existsSync(csvPath)) {
  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const result = BomParser.parse(csvContent, "Dairy-Tank-Controller_kicostx_bom.csv");

  console.log("Project Name:", result.projectName);
  console.log("Total Components on 1 PCB:", result.totalComponents);
  console.log("Unique BOM Rows:", result.uniqueParts);
  console.log("Rows with valid LCSC:", result.partsWithLcsc);

  // Critical regression checks
  const badFootprints = result.items.filter(it => it.lcsc === "C0603" || it.lcsc === "C1206" || it.lcsc === "C0805");
  if (badFootprints.length > 0) {
    console.error("FAIL: Footprint matched as LCSC part number!", badFootprints);
    process.exit(1);
  } else {
    console.log("✓ SUCCESS: No footprints (C0603, C1206) mistaken as LCSC part numbers!");
  }

  const cap = result.items.find(it => it.value === "GRM188R71H104KA93D");
  console.log("✓ Item 2 (GRM188R71H104KA93D) LCSC Code:", cap?.lcsc, "| Expected: C77055 | Footprint:", cap?.footprint);

  if (cap?.lcsc !== "C77055") {
    console.error("FAIL: Expected C77055 for GRM188R71H104KA93D, got:", cap?.lcsc);
    process.exit(1);
  }
}

console.log("\n=========================================");
console.log("3. Testing MOQ & PCB Batch Calculation for 10 PCBs");
console.log("=========================================");

const calc = BomParser.calculateOrderQty(19, 10, 100, 100);
console.log(`Part C77055 (GRM188R71H104KA93D):`);
console.log(`  Qty/PCB: 19 x 10 PCBs = Needed: ${calc.neededQty}`);
console.log(`  Store MOQ: ${calc.moq}, Pack Step: ${calc.step}`);
console.log(`  Final Order Qty: ${calc.orderQty} (MOQ Adjusted: ${calc.isMoqAdjusted})`);

console.log("\nAll Parser tests passed successfully!");
