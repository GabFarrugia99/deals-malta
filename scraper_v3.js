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
      waitUntil: 'networkidle'
    });
    await page.waitForTimeout(3000);
    
    // Extract products using the correct selectors based on screenshot
    const products = await page.evaluate(() => {
      const items = [];
      
      // Find all product containers - looking for elements containing iPhone names
      const productElements = document.querySelectorAll('.product-item, .product-info, [class*="product"]');
      
      productElements.forEach(el => {
        // Get product name
        const nameEl = el.querySelector('h2, h3, .product-name, [class*="name"]');
        // Get price - looking for price elements
        const priceEl = el.querySelector('.price, [class*="price"], .special-price, .old-price');
        
        if (nameEl) {
          const name = nameEl.textContent.trim();
          const priceText = priceEl ? priceEl.textContent.trim() : '';
          
          // Extract price numbers
          const priceMatch = priceText.match(/€\s*([\d,]+\.?\d*)/);
          const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : null;
          
          if (name.toLowerCase().includes('iphone') && price && price > 200) {
            items.push({ name, price, priceText });
          }
        }
      });
      
      return items;
    });
    
    console.log(`Found ${products.length} iPhone products:\n`);
    products.forEach((p, i) => {
      console.log(`${i+1}. ${p.name.substring(0, 55)}`);
      console.log(`   💶 ${p.priceText} (€${p.price})`);
    });
    
    await browser.close();
    
    // Format for DB
    return products.map((p, i) => ({
      id: `scan_iphone_${Date.now()}_${i}`,
      store: 'Scan Malta',
      name: p.name,
      price: p.price,
      priceText: p.priceText,
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
    // Keep history
    if (!db.history) db.history = {};
    db.history[Date.now()] = products;
    
    // Update current products
    db.products = products;
    saveDb(db);
    console.log(`\n✅ Saved ${products.length} products to ${DB_FILE}`);
  } else {
    console.log('\n⚠️ No products found');
  }
}

main();
