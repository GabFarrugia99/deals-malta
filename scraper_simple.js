const { firefox } = require('playwright');
const fs = require('fs');

const DB_FILE = 'prices.json';

function loadDb() {
  if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE));
  return { products: [] };
}

function saveDb(db) {
  db.lastUpdated = new Date().toISOString();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

async function scrape() {
  console.log('🔍 Scraping Scan Malta iPhones...\n');
  
  const browser = await firefox.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto('https://www.scanmalta.com/shop/smartphones/android-apple-smartphones/iphone.html', { 
      waitUntil: 'domcontentloaded'
    });
    await page.waitForTimeout(4000);
    
    // Extract with JavaScript evaluation
    const products = await page.evaluate(() => {
      const items = [];
      document.querySelectorAll('.item').forEach(item => {
        const nameEl = item.querySelector('.product-name');
        const priceEl = item.querySelector('.price');
        const linkEl = item.querySelector('a');
        
        if (nameEl && priceEl) {
          const name = nameEl.textContent.trim();
          const priceText = priceEl.textContent.trim();
          const priceMatch = priceText.match(/([\d,]+\.\d{2})/);
          const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : null;
          
          if (price && price > 200) {
            items.push({
              name: name,
              price: price,
              priceText: priceText,
              url: linkEl ? linkEl.href : null
            });
          }
        }
      });
      return items;
    });
    
    console.log(`Found ${products.length} products:\n`);
    products.forEach((p, i) => {
      console.log(`${i+1}. ${p.name.substring(0, 50)}...`);
      console.log(`   Price: €${p.price}`);
    });
    
    await browser.close();
    
    // Format for DB
    return products.map((p, i) => ({
      id: `scan_iphone_${i}`,
      store: 'Scan Malta',
      name: p.name,
      price: p.price,
      priceText: p.priceText,
      url: p.url,
      scrapedAt: new Date().toISOString()
    }));
    
  } catch (err) {
    console.error('Error:', err.message);
    await browser.close();
    return [];
  }
}

async function main() {
  const db = loadDb();
  const products = await scrape();
  
  if (products.length > 0) {
    db.products = products;
    saveDb(db);
    console.log(`\n✅ Saved ${products.length} products to ${DB_FILE}`);
  }
}

main();
