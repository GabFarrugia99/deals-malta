const { firefox } = require('playwright');
const fs = require('fs');

const DB_FILE = 'prices.json';

function loadDb() {
  if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE));
  return { products: [], history: {} };
}

function saveDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function extractPrice(text) {
  if (!text) return null;
  const match = text.match(/([\d,]+\.\d{2})/);
  return match ? parseFloat(match[1].replace(/,/g, '')) : null;
}

async function scrapeScan() {
  console.log('🔍 Scraping Scan Malta...\n');
  
  const browser = await firefox.launch({ headless: true });
  const page = await browser.newPage();
  
  const products = [];
  
  try {
    // Go directly to iPhone category
    await page.goto('https://www.scanmalta.com/shop/smartphones/android-apple-smartphones/iphone.html', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    await page.waitForTimeout(3000);
    
    console.log(`Page: ${await page.title()}`);
    
    // Get all product items
    const items = await page.locator('.item').all();
    console.log(`Found ${items.length} products\n`);
    
    for (const item of items) {
      try {
        const name = await item.locator('.product-name').textContent().catch(() => null);
        const priceText = await item.locator('.price').textContent().catch(() => null);
        const link = await item.locator('a').first().getAttribute('href').catch(() => null);
        
        if (name && priceText) {
          const price = extractPrice(priceText);
          if (price && price > 100) { // Filter out accessories
            products.push({
              id: `scan_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 40)}`,
              store: 'Scan Malta',
              name: name.trim(),
              price: price,
              url: link ? `https://www.scanmalta.com${link}` : null,
              scrapedAt: new Date().toISOString()
            });
            console.log(`✓ ${name.trim().substring(0, 55)}... €${price}`);
          }
        }
      } catch (e) {}
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  }
  
  await browser.close();
  return products;
}

async function main() {
  const db = loadDb();
  console.log(`💾 DB: ${db.products.length} existing products\n`);
  
  const products = await scrapeScan();
  
  console.log(`\n✅ Scraped ${products.length} iPhone products\n`);
  
  // Detect price drops
  const existing = new Map(db.products.map(p => [p.id, p]));
  const drops = [];
  
  for (const p of products) {
    const old = existing.get(p.id);
    if (old && old.price > p.price) {
      drops.push({ name: p.name, old: old.price, new: p.price, save: old.price - p.price });
    }
  }
  
  if (drops.length > 0) {
    console.log('🔥 PRICE DROPS:');
    drops.forEach(d => console.log(`  📉 ${d.name.substring(0, 50)}: €${d.old} → €${d.new} (save €${d.save.toFixed(2)})`));
  } else {
    console.log('📊 No price drops (first run or prices stable)');
  }
  
  // Save
  db.products = [...db.products.filter(p => !products.find(np => np.id === p.id)), ...products];
  saveDb(db);
  console.log(`\n💾 Total tracked: ${db.products.length} products`);
}

main().catch(console.error);
