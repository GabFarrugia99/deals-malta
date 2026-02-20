const { firefox } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const DB_FILE = 'prices.json';
const IMAGES_DIR = 'images';
const HISTORY_DAYS = 30;

if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

const STORES = [
  { name: 'Scan Malta', baseUrl: 'https://www.scanmalta.com', categories: ['/shop/smartphones/android-apple-smartphones/iphone.html', '/shop/apple/macbook.html', '/shop/apple/ipad.html', '/shop/apple/apple-watch.html'] },
  { name: 'Klikk', baseUrl: 'https://www.klikk.com.mt', categories: ['/mobile-phones', '/laptops-computers', '/tablets'] },
  { name: 'Megatekk', baseUrl: 'https://www.megatekk.com.mt', categories: ['/phones', '/laptops', '/tablets'] },
  { name: 'Intercomp', baseUrl: 'https://www.intercomp.com.mt', categories: ['/mobile-phones', '/computers/laptops', '/tablets'] }
];

function loadDb() {
  if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE));
  return { products: [], history: {}, matches: {} };
}

function saveDb(db) {
  db.lastUpdated = new Date().toISOString();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// Normalize product name for matching
function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b(apple|samsung|google)\b/g, '')
    .replace(/\b(iphone|macbook|ipad|galaxy|pixel)\b/g, m => m)
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract key specs for matching
function extractSpecs(name) {
  const specs = {};
  const gbMatch = name.match(/(\d+)\s*gb/i);
  if (gbMatch) specs.storage = parseInt(gbMatch[1]);
  
  const modelMatch = name.match(/(iphone\s*\d+\s*(?:pro\s*max|pro|plus|e)?|macbook\s*(?:air|pro)?\s*\d+\.?\d*|ipad\s*(?:pro|air|mini)?\s*\d+|galaxy\s*s\d+|pixel\s*\d+)/i);
  if (modelMatch) specs.model = modelMatch[1].toLowerCase().replace(/\s+/g, '');
  
  return specs;
}

// Match products across stores
function matchProducts(products) {
  const matches = {};
  
  for (const p of products) {
    const specs = extractSpecs(p.name);
    if (!specs.model) continue;
    
    const key = `${specs.model}_${specs.storage || 'unknown'}`;
    if (!matches[key]) matches[key] = [];
    matches[key].push(p);
  }
  
  // Only keep matches with 2+ stores
  const result = {};
  for (const [key, items] of Object.entries(matches)) {
    if (items.length >= 2) {
      items.sort((a, b) => a.price - b.price);
      result[key] = items;
    }
  }
  
  return result;
}

async function downloadImage(url, filename) {
  if (!url) return null;
  if (url.startsWith('//')) url = 'https:' + url;
  else if (url.startsWith('/')) url = 'https://www.scanmalta.com' + url;
  
  const ext = path.extname(url).split('?')[0] || '.jpg';
  const safeName = filename.replace(/[^a-z0-9]/gi, '_').substring(0, 50) + ext;
  const filepath = path.join(IMAGES_DIR, safeName);
  
  if (fs.existsSync(filepath)) return `images/${safeName}`;
  
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const timeout = setTimeout(() => resolve(null), 10000);
    
    try {
      const req = client.get(url, { timeout: 10000 }, (res) => {
        clearTimeout(timeout);
        if (res.statusCode !== 200) { resolve(null); return; }
        
        const file = fs.createWriteStream(filepath);
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(`images/${safeName}`); });
        file.on('error', () => resolve(null));
      });
      req.on('error', () => { clearTimeout(timeout); resolve(null); });
    } catch (e) { clearTimeout(timeout); resolve(null); }
  });
}

async function scrapeStore(store, browser) {
  console.log(`\n🔍 ${store.name}`);
  const products = [];
  
  for (const category of store.categories) {
    const page = await browser.newPage();
    try {
      await page.goto(`${store.baseUrl}${category}`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(3000);
      
      const selectors = ['.product-item', '.product', '.item.product', '[data-product-id]', '.grid-item'];
      
      for (const selector of selectors) {
        const items = await page.locator(selector).all();
        if (items.length > 0) {
          console.log(`  📁 ${category}: ${items.length} items`);
          
          for (const item of items.slice(0, 25)) {
            const product = await extractProduct(item, store);
            if (product) {
              if (product.imageUrl) product.imageLocal = await downloadImage(product.imageUrl, product.id);
              products.push(product);
            }
          }
          break;
        }
      }
    } catch (e) {}
    await page.close();
  }
  
  return products;
}

async function extractProduct(item, store) {
  const name = await item.locator('.product-name, h2, h3, .name').first().textContent().catch(() => null);
  if (!name) return null;
  
  const priceText = await item.locator('.price, .special-price, [class*="price"]').first().textContent().catch(() => null);
  if (!priceText) return null;
  
  const priceMatch = priceText.match(/([\d,]+\.?\d*)/);
  const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : null;
  if (!price || price < 50) return null;
  
  const imgUrl = await item.locator('img').first().getAttribute('src').catch(() => 
    item.locator('img').first().getAttribute('data-src').catch(() => null));
  
  const link = await item.locator('a').first().getAttribute('href').catch(() => null);
  
  return {
    id: `${store.name.replace(/\s+/g, '_')}_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 30)}_${Date.now()}`,
    store: store.name,
    name: name.trim(),
    price, priceText: priceText.trim(),
    url: link ? (link.startsWith('http') ? link : `${store.baseUrl}${link}`) : null,
    imageUrl: imgUrl,
    category: detectCategory(name),
    specs: extractSpecs(name),
    scrapedAt: new Date().toISOString()
  };
}

function detectCategory(name) {
  const lower = name.toLowerCase();
  if (lower.includes('iphone')) return 'iPhone';
  if (lower.includes('macbook')) return 'MacBook';
  if (lower.includes('ipad')) return 'iPad';
  if (lower.includes('watch')) return 'Watch';
  if (lower.includes('airpods')) return 'Audio';
  if (lower.includes('samsung') || lower.includes('galaxy')) return 'Samsung';
  if (lower.includes('pixel')) return 'Google Pixel';
  if (lower.includes('laptop')) return 'Laptop';
  if (lower.includes('tablet')) return 'Tablet';
  return 'Other';
}

async function main() {
  console.log('🚀 Deals Malta - Full Scraper\n');
  
  const db = loadDb();
  console.log(`💾 Existing: ${db.products.length} products`);
  
  const browser = await firefox.launch({ headless: true });
  let allProducts = [];
  
  for (const store of STORES) {
    const products = await scrapeStore(store, browser);
    allProducts.push(...products);
  }
  
  await browser.close();
  
  console.log(`\n✅ Scraped ${allProducts.length} products`);
  
  // Match products across stores
  const matches = matchProducts(allProducts);
  console.log(`🔗 Matched ${Object.keys(matches).length} products across stores`);
  
  // Detect price changes
  const existing = new Map(db.products.map(p => [p.id, p]));
  const drops = [];
  
  for (const p of allProducts) {
    const old = existing.get(p.id);
    if (old && old.price > p.price) {
      drops.push({ name: p.name, store: p.store, old: old.price, new: p.price, savings: old.price - p.price });
    }
  }
  
  if (drops.length > 0) {
    console.log(`\n🔥 ${drops.length} PRICE DROPS!`);
    drops.slice(0, 5).forEach(d => console.log(`  📉 ${d.name.substring(0, 40)}: €${d.old} → €${d.new}`));
  }
  
  // Update history
  if (!db.history) db.history = {};
  const today = new Date().toISOString().split('T')[0];
  db.history[today] = { count: allProducts.length, matches: Object.keys(matches).length, drops: drops.length };
  
  // Keep only last 30 days of history
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - HISTORY_DAYS);
  db.history = Object.fromEntries(Object.entries(db.history).filter(([date]) => new Date(date) > cutoff));
  
  // Save
  db.products = allProducts;
  db.matches = matches;
  saveDb(db);
  
  console.log('\n💾 Saved');
  
  // Build site
  console.log('\n🏗️  Building site...');
  require('./build-site.js');
}

main().catch(console.error);
