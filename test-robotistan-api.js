const https = require("https");

function fetchSearch(code) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "robotistanpro.com",
      path: "/arama?q=" + encodeURIComponent(code),
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        resolve(data);
      });
    });

    req.on("error", reject);
    req.end();
  });
}

function parseSearchResult(html, code) {
  // Extract CSRF token
  const csrfMatch = html.match(/var\s+CART_CSRF_TOKEN\s*=\s*['"]([a-f0-9]+)['"]/i);
  const csrfToken = csrfMatch ? csrfMatch[1] : null;

  // Extract PRODUCT_DATA
  const productMatches = [...html.matchAll(/PRODUCT_DATA\.push\(JSON\.parse\((.*?)\)\);/g)];
  let matchedProduct = null;

  for (const m of productMatches) {
    try {
      let s = m[1].trim();
      if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
        s = s.slice(1, -1);
      }
      s = s.replace(/\\"/g, '"').replace(/\\\//g, '/').replace(/\\\\/g, '\\');
      const parsed = JSON.parse(s);
      if (parsed.code && parsed.code.toUpperCase() === code.toUpperCase()) {
        matchedProduct = parsed;
        break;
      }
      if (!matchedProduct) matchedProduct = parsed; // fallback to first
    } catch (e) {}
  }

  // Extract MOQ / step from the product card input
  let moq = 1;
  let step = 1;
  if (matchedProduct) {
    // Look for product-count-ID input
    const inputRegex = new RegExp(`<input[^>]*id=["\']product-count-${matchedProduct.id}[^"\']*["\'][^>]*>`, "i");
    const inputMatch = html.match(inputRegex);
    if (inputMatch) {
      const tag = inputMatch[0];
      const minMatch = tag.match(/min=["\'](\d+)["\']/i);
      const stepMatch = tag.match(/step=["\'](\d+)["\']/i);
      if (minMatch) moq = parseInt(minMatch[1], 10) || 1;
      if (stepMatch) step = parseInt(stepMatch[1], 10) || 1;
    }
  }

  return {
    csrfToken,
    product: matchedProduct,
    moq,
    step
  };
}

async function run() {
  const testCodes = ["C347222", "C529578", "C77055"];
  console.log("Testing Robotistan Pro product search & MOQ extraction...\n");

  for (const code of testCodes) {
    try {
      const html = await fetchSearch(code);
      const res = parseSearchResult(html, code);
      if (res.product) {
        console.log(`[FOUND] ${code}:`);
        console.log(`  ID: ${res.product.id}`);
        console.log(`  Name: ${res.product.name}`);
        console.log(`  Unit Price: ${res.product.sale_price} TL (inc. VAT: ${res.product.total_sale_price} TL)`);
        console.log(`  Stock: ${res.product.quantity}`);
        console.log(`  MOQ (Min): ${res.moq}, Pack Step: ${res.step}`);
      } else {
        console.log(`[NOT FOUND] ${code}`);
      }
    } catch (err) {
      console.error(`[ERROR] ${code}:`, err.message);
    }
  }
}

run();
