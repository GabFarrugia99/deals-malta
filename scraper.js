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
  console.log('🔍 Scraping Scan Malta for Apple products...\n');
  
  const browser = await firefox.launch({ headless: true });
  const page = await browser.newPage();
  
  const products = [];
  
  try {
    // Search for iPhone
    await page.goto('https://www.scanmalta.com/search?q=iPhone', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    // Get all product cards
    const items = await page.locator('.item').all();
    console.log(`Found ${items.length} products\n`);
    
    for (const item of items.slice(0, 30)) {
      try {
        const name = await item.locator('.product-name, h3, h2, .name').textContent().catch(() => null);
        const priceText = await item.locator('.price, .product-price').textContent().catch(() => null);
        const link = await item.locator('a').first().getAttribute('href').catch(() => null);
        
        if (name && priceText) {
          const price = extractPrice(priceText);
          if (price) {
            products.push({
              id: `scan_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 40)}`,
              store: 'Scan Malta',
              name: name.trim(),
              price: price,
              url: link ? `https://www.scanmalta.com${link}` : null,
              scrapedAt: new Date().toISOString()
            });
            console.log(`✓ ${name.trim().substring(0, 60)}... €${price}`);
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
  
  console.log(`\n✅ Scraped ${products.length} products\n`);
  
  // Simple change detection
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
    console.log('📊 No price drops detected');
  }
  
  // Save
  db.products = products;
  saveDb(db);
  console.log(`\n💾 Saved to ${DB_FILE}`);
}

main().catch(console.error);
