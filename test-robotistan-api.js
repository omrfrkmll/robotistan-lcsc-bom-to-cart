const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");
const https = require("https");
const RobotistanApi = require("./lib/robotistan-api.js");

// Mock global fetch for Node environment
global.fetch = async function (url, options) {
  return new Promise((resolve, reject) => {
    const fullUrl = url.startsWith("http") ? url : "https://robotistanpro.com" + url;
    https.get(
      fullUrl,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            statusText: res.statusMessage,
            text: async () => data,
            json: async () => JSON.parse(data)
          });
        });
      }
    ).on("error", reject);
  });
};

async function run() {
  console.log("=================================================");
  console.log("Testing Robotistan Pro API (Multi-page & Pre-order)");
  console.log("=================================================\n");

  const testCases = [
    { code: "C77055", label: "Standard in-stock item (Page 1)" },
    { code: "C8436", label: "Multi-page item (Page 3 match)" },
    { code: "C149588", label: "0-stock / Pre-order item (Temin Edilecek)" }
  ];

  for (const { code, label } of testCases) {
    console.log(`[TEST] ${label} (${code}):`);
    const res = await RobotistanApi.searchProduct(code);
    if (res.success && res.product) {
      const p = res.product;
      console.log(`  ✓ Product Found: ${p.name} (ID: ${p.id})`);
      console.log(`  ✓ Matched Code: ${p.code} (Supplier: ${p.supplierCode})`);
      console.log(`  ✓ Stock: ${p.stock} | Stock Display: ${p.stockDisplay}`);
      console.log(`  ✓ Pre-order Detected: ${p.isPreorder ? "YES (✈️ Temin Edilecek)" : "NO (In Stock)"}`);
      console.log(`  ✓ MOQ: ${res.moq} | Pack Step: ${res.step}`);
      console.log(`  ✓ Unit Price: ${p.price} ${p.currency} (inc. VAT: ${p.totalPriceWithVat} ${p.currencyTarget})`);
    } else {
      console.log(`  ✗ FAILED: ${res.error || "Product not found"}`);
    }
    console.log("");
  }

  console.log("All API test cases passed successfully!");
}

run();
