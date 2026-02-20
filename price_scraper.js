const { firefox } = require('playwright');
const fs = require('fs');
const path = require('path');

// Database file
const DB_FILE = 'prices.json';

// Target products to search for
const TARGET_PRODUCTS = ['iPhone', 'MacBook', 'iPad', 'AirPods', 'Apple Watch'];

// Load existing database
function loadDatabase() {
  if (fs.existsSync(DB_FILE)) {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  }
  return { products: [], lastUpdated: null };
}

// Save database
function saveDatabase(db) {
  db.lastUpdated = new Date().toISOString();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// Extract price from text
function extractPrice(text) {
  if (!text) return null;
  // Match patterns like €1,299.00 or €1299 or 1,299.00€
  const match = text.match(/[€$£]?\s*([\d,]+\.?\d*)\s*[€$£]?/);
  if (match) {
    return parseFloat(match[1].replace(/,/g, ''));
  }
  return null;
}

// Clean product name
function cleanName(name) {
  return name.replace(/\s+/g, ' ').trim();
}

// Scrape Scan Malta
async function scrapeScanMalta() {
  console.log('🔍 Scraping Scan Malta...\n');
  
  const browser = await firefox.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0'
  });
  const page = await context.newPage();
  
  const products = [];
  
  try {
    // Go to homepage first
    await page.goto('https://www.scanmalta.com', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    console.log(`Page title: ${await page.title()}`);
    
    // Search for Apple products
    console.log('Searching for Apple products...\n');
    const searchBox = page.locator('input[name="q"]').first();
    await searchBox.fill('iPhone');
    await searchBox.press('Enter');
    
    // Wait for search results
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Try multiple selectors for products
    const possibleSelectors = ['.product', '.product-item', '.item', '[data-product]', '.grid-item'];
    let productSelector = null;
    
    for (const selector of possibleSelectors) {
      const count = await page.locator(selector).count().catch(() => 0);
      if (count > 0) {
        productSelector = selector;
        console.log(`Found products using selector: ${selector} (${count} items)\n`);
        break;
      }
    }
    
    if (!productSelector) {
      console.log('No product selector found, taking screenshot for debugging...');
      await page.screenshot({ path: 'debug_scan.png', fullPage: true });
      return products;
    }
    
    // Extract all products
    const productElements = await page.locator(productSelector).all();
    console.log(`Found ${productElements.length} products\n`);
    
    for (let i = 0; i < productElements.length; i++) {
      const el = productElements[i];
      
      try {
        const nameEl = el.locator('.product-name, .product-title, h3, h2').first();
        const priceEl = el.locator('.price, .product-price, .current-price, [class*="price"]').first();
        const linkEl = el.locator('a').first();
        
        const name = await nameEl.textContent().catch(() => null);
        const priceText = await priceEl.textContent().catch(() => null);
        const href = await linkEl.getAttribute('href').catch(() => null);
        
        if (name && priceText) {
          const cleanProductName = cleanName(name);
          const price = extractPrice(priceText);
          
          // Check if it's a target product
          const isTarget = TARGET_PRODUCTS.some(target => 
            cleanProductName.toLowerCase().includes(target.toLowerCase())
          );
          
          if (isTarget && price) {
            products.push({
              id: `scan_${cleanProductName.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 50)}`,
              store: 'Scan Malta',
              name: cleanProductName,
              price: price,
              priceText: priceText.trim(),
              url: href ? (href.startsWith('http') ? href : `https://www.scanmalta.com${href}`) : null,
              scrapedAt: new Date().toISOString()
            });
            
            console.log(`✓ ${cleanProductName}`);
            console.log(`  Price: €${price}`);
          }
        }
      } catch (err) {
        // Skip problematic items
      }
    }
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
  } finally {
    await browser.close();
  }
  
  return products;
}

// Check for price changes
function detectChanges(newProducts, db) {
  const changes = {
    new: [],
    dropped: [],
    increased: [],
    decreased: []
  };
  
  const existingMap = new Map(db.products.map(p => [p.id, p]));
  const newMap = new Map(newProducts.map(p => [p.id, p]));
  
  // Find new products
  for (const [id, product] of newMap) {
    if (!existingMap.has(id)) {
      changes.new.push(product);
    } else {
      const existing = existingMap.get(id);
      if (product.price < existing.price) {
        changes.decreased.push({
          ...product,
          oldPrice: existing.price,
          change: existing.price - product.price
        });
      } else if (product.price > existing.price) {
        changes.increased.push({
          ...product,
          oldPrice: existing.price,
          change: product.price - existing.price
        });
      }
    }
  }
  
  // Find dropped products
  for (const [id, product] of existingMap) {
    if (!newMap.has(id)) {
      changes.dropped.push(product);
    }
  }
  
  return changes;
}

// Main
async function main() {
  console.log('🚀 Malta Electronics Price Tracker\n');
  console.log('===================================\n');
  
  // Load database
  const db = loadDatabase();
  console.log(`Database loaded: ${db.products.length} existing products\n`);
  
  // Scrape
  const newProducts = await scrapeScanMalta();
  console.log(`\n✅ Scraped ${newProducts.length} target products\n`);
  
  // Detect changes
  const changes = detectChanges(newProducts, db);
  
  console.log('📊 Changes Detected:');
  console.log(`  New: ${changes.new.length}`);
  console.log(`  Price drops: ${changes.decreased.length}`);
  console.log(`  Price increases: ${changes.increased.length}`);
  console.log(`  Removed: ${changes.dropped.length}\n`);
  
  // Show price drops
  if (changes.decreased.length > 0) {
    console.log('🔥 PRICE DROPS:');
    changes.decreased.forEach(p => {
      console.log(`  📉 ${p.name}`);
      console.log(`     €${p.oldPrice} → €${p.price} (save €${p.change.toFixed(2)})`);
    });
    console.log();
  }
  
  // Show new products
  if (changes.new.length > 0) {
    console.log('🆕 NEW PRODUCTS:');
    changes.new.slice(0, 5).forEach(p => {
      console.log(`  ➕ ${p.name} - €${p.price}`);
    });
    console.log();
  }
  
  // Update database
  db.products = newProducts;
  saveDatabase(db);
  console.log('💾 Database updated\n');
  
  // Summary
  console.log('📈 Summary:');
  console.log(`  Total products tracked: ${newProducts.length}`);
  console.log(`  Last updated: ${db.lastUpdated}`);
}

main().catch(console.error);
