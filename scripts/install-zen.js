#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

console.log("==========================================");
console.log("Zen Browser - Eklenti Derleme ve Kurulumu");
console.log("==========================================\n");

// 1. Build XPI
console.log("1. Eklenti derleniyor (.xpi)...");
const distDir = path.join(__dirname, "..", "dist");
fs.mkdirSync(distDir, { recursive: true });

execSync(
  "pnpm dlx web-ext build --overwrite-dest --filename robotistan-bom-to-cart_ilteray.xpi --artifacts-dir ./dist",
  { stdio: "inherit" }
);

const xpiPath = path.join(distDir, "robotistan-bom-to-cart_ilteray.xpi");
console.log(`\n✓ Derleme tamamlandı: ${xpiPath}`);

// 2. Find Zen Browser profile directory
console.log("\n2. Zen Browser profili aranıyor...");
const zenDir = path.join(os.homedir(), ".zen");
let targetExtDir = null;

if (fs.existsSync(zenDir)) {
  const dirs = fs.readdirSync(zenDir);
  const releaseProfile =
    dirs.find((d) => d.includes("Default (release)")) ||
    dirs.find((d) => d.includes("default"));

  if (releaseProfile) {
    targetExtDir = path.join(zenDir, releaseProfile, "extensions");
  }
}

if (targetExtDir) {
  fs.mkdirSync(targetExtDir, { recursive: true });
  const targetXpi = path.join(targetExtDir, "robotistan-bom-to-cart@ilteray.xpi");
  fs.copyFileSync(xpiPath, targetXpi);
  console.log(`✓ Eklenti Zen profilinizin 'extensions' klasörüne kalıcı olarak kopyalandı:`);
  console.log(`  ${targetXpi}`);
}

console.log("\n---------------------------------------------------------");
console.log("Kalıcı Kullanım İçin:");
console.log("Zen Browser'da bir defaya mahsus şu adımı uygulayabilirsiniz:");
console.log("1. Zen Browser'da 'about:addons' sayfasına gidin.");
console.log("2. Sağ üstteki ⚙ (Çark) simgesine tıklayıp 'Dosyadan Eklenti Kur...' deyin.");
console.log(`3. Şu dosyayı seçin: ${xpiPath}`);
console.log("Bu işlemden sonra eklenti tarayıcıyı kapatsanız da kalıcı kalacaktır!");
console.log("---------------------------------------------------------\n");
