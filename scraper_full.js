const { firefox } = require('playwright');
const fs = require('fs');

const DB_FILE = 'prices.json';

// Malta electronics stores with their category pages
const STORES = [
  {
    name: 'Scan Malta',
    baseUrl: 'https://www.scanmalta.com',
    categories: [
      '/shop/smartphones/android-apple-smartphones/iphone.html',
      '/shop/apple/macbook.html',
      '/shop/apple/ipad.html',
      '/shop/apple/apple-watch.html',
      '/shop/audio/headphones-earphones.html'
    ]
  },
  {
    name: 'Klikk',
    baseUrl: 'https://www.klikk.com.mt',
    categories: [
      '/mobile-phones',
      '/laptops-computers',
      '/tablets'
    ]
  },
  {
    name: 'Megatekk',
    baseUrl: 'https://www.megatekk.com.mt',
    categories: [
      '/phones',
      '/laptops',
      '/tablets'
    ]
  },
  {
    name: 'Intercomp',
    baseUrl: 'https://www.intercomp.com.mt',
    categories: [
      '/mobile-phones',
      '/computers/laptops',
      '/tablets'
    ]
  }
];

function loadDb() {
  if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE));
  return { products: [], history: {} };
}

function saveDb(db) {
  db.lastUpdated = new Date().toISOString();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

async function scrapeStore(store, browser) {
  console.log(`\n🔍 Scraping ${store.name}...`);
  const allProducts = [];
  
  for (const category of store.categories) {
    const url = `${store.baseUrl}${category}`;
    console.log(`  📁 ${category}`);
    
    const page = await browser.newPage();
    
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(3000);
      
      // Try multiple product selectors
      const selectors = [
        '.product-item',
        '.product',
        '.item.product',
        '[data-product-id]',
        '.grid-item',
        '.card'
      ];
      
      let products = [];
      
      for (const selector of selectors) {
        const count = await page.locator(selector).count().catch(() => 0);
        if (count > 0) {
          console.log(`    Found ${count} products with selector: ${selector}`);
          
          const items = await page.locator(selector).all();
          
          for (const item of items.slice(0, 50)) { // Limit per category
            try {
              const product = await extractProductData(item, store);
              if (product && product.price > 50) {
                products.push(product);
              }
            } catch (e) {}
          }
          break;
        }
      }
      
      console.log(`    ✅ Extracted ${products.length} products`);
      allProducts.push(...products);
      
    } catch (err) {
      console.log(`    ❌ Error: ${err.message}`);
    }
    
    await page.close();
  }
  
  return allProducts;
}

async function extractProductData(item, store) {
  // Try various selectors for name
  const nameSelectors = ['.product-name', 'h2', 'h3', '.name', 'a', '[class*="title"]', '[class*="name"]'];
  let name = null;
  
  for (const sel of nameSelectors) {
    name = await item.locator(sel).first().textContent().catch(() => null);
    if (name && name.trim().length > 3) break;
  }
  
  if (!name) return null;
  
  // Try various selectors for price
  const priceSelectors = ['.price', '.special-price', '[class*="price"]', '.current-price'];
  let priceText = null;
  
  for (const sel of priceSelectors) {
    priceText = await item.locator(sel).first().textContent().catch(() => null);
    if (priceText && priceText.match(/[€$£]|\d+/)) break;
  }
  
  if (!priceText) return null;
  
  // Extract numeric price
  const priceMatch = priceText.match(/([\d,]+\.?\d*)/);
  const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : null;
  
  if (!price || price < 50) return null;
  
  // Get URL
  const link = await item.locator('a').first().getAttribute('href').catch(() => null);
  const fullUrl = link ? (link.startsWith('http') ? link : `${store.baseUrl}${link}`) : null;
  
  return {
    id: `${store.name.toLowerCase().replace(/\s+/g, '_')}_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 40)}`,
    store: store.name,
    name: name.trim(),
    price: price,
    priceText: priceText.trim(),
    url: fullUrl,
    category: detectCategory(name),
    scrapedAt: new Date().toISOString()
  };
}

function detectCategory(name) {
  const lower = name.toLowerCase();
  if (lower.includes('iphone')) return 'iPhone';
  if (lower.includes('macbook') || lower.includes('mac')) return 'MacBook';
  if (lower.includes('ipad')) return 'iPad';
  if (lower.includes('watch')) return 'Apple Watch';
  if (lower.includes('airpods')) return 'AirPods';
  if (lower.includes('samsung') || lower.includes('galaxy')) return 'Samsung';
  if (lower.includes('pixel')) return 'Google Pixel';
  if (lower.includes('laptop') || lower.includes('notebook')) return 'Laptop';
  if (lower.includes('tablet')) return 'Tablet';
  if (lower.includes('headphone') || lower.includes('earbud')) return 'Audio';
  return 'Other';
}

async function main() {
  console.log('🚀 Malta Electronics Price Tracker - Full Scraper\n');
  console.log('=' .repeat(50));
  
  const db = loadDb();
  console.log(`\n💾 Loaded ${db.products.length} existing products`);
  
  const browser = await firefox.launch({ headless: true });
  const allProducts = [];
  
  for (const store of STORES) {
    const products = await scrapeStore(store, browser);
    allProducts.push(...products);
    console.log(`  📊 Total from ${store.name}: ${products.length}`);
  }
  
  await browser.close();
  
  console.log(`\n✅ Scraped ${allProducts.length} total products`);
  
  // Detect changes
  const existing = new Map(db.products.map(p => [p.id, p]));
  const newProducts = [];
  const priceDrops = [];
  
  for (const p of allProducts) {
    const old = existing.get(p.id);
    if (!old) {
      newProducts.push(p);
    } else if (old.price > p.price) {
      priceDrops.push({ ...p, oldPrice: old.price, savings: old.price - p.price });
    }
  }
  
  console.log(`\n📊 Changes:`);
  console.log(`  🆕 New: ${newProducts.length}`);
  console.log(`  📉 Price drops: ${priceDrops.length}`);
  
  if (priceDrops.length > 0) {
    console.log(`\n🔥 PRICE DROPS:`);
    priceDrops.slice(0, 10).forEach(p => {
      console.log(`  ${p.name}: €${p.oldPrice} → €${p.price} (save €${p.savings.toFixed(2)})`);
    });
  }
  
  // Save
  db.products = allProducts;
  if (!db.history) db.history = {};
  db.history[Date.now()] = { count: allProducts.length, new: newProducts.length, drops: priceDrops.length };
  
  saveDb(db);
  console.log(`\n💾 Saved to ${DB_FILE}`);
  
  // Build site
  console.log('\n🏗️  Building site...');
  require('./build-site.js');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
