const { chromium, firefox } = require('playwright');

// Malta electronics retailers to scrape
const STORES = [
  { name: 'Klikk', url: 'https://www.klikk.com.mt', selector: null },
  { name: 'Megatekk', url: 'https://www.megatekk.com.mt', selector: null },
  { name: 'Scan', url: 'https://www.scanmalta.com', selector: null },
  { name: 'Intercomp', url: 'https://www.intercomp.com.mt', selector: null },
  { name: 'Apple Store Malta', url: 'https://www.apple.com/mt', selector: null }
];

async function testStore(store, browserType = 'firefox') {
  console.log(`\n🔍 Testing: ${store.name} (${store.url})`);
  
  const browser = await (browserType === 'firefox' ? firefox : chromium).launch({
    headless: true
  });
  
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0'
    });
    const page = await context.newPage();
    
    // Go to homepage
    const response = await page.goto(store.url, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    console.log(`  Status: ${response?.status() || 'unknown'}`);
    console.log(`  Title: ${await page.title()}`);
    
    // Try to find iPhone/MacBook links or search
    const searchSelectors = [
      'input[type="search"]',
      'input[name="search"]',
      'input[name="q"]',
      '.search-input',
      '#search',
      '[placeholder*="search" i]'
    ];
    
    let hasSearch = false;
    for (const sel of searchSelectors) {
      const found = await page.locator(sel).first().isVisible().catch(() => false);
      if (found) {
        console.log(`  ✓ Search box found: ${sel}`);
        hasSearch = true;
        break;
      }
    }
    
    if (!hasSearch) {
      console.log(`  ⚠ No search box found`);
    }
    
    // Check for product listings
    const productSelectors = [
      '.product',
      '.product-item',
      '[data-product]',
      '.item',
      '.grid-item'
    ];
    
    for (const sel of productSelectors) {
      const count = await page.locator(sel).count().catch(() => 0);
      if (count > 0) {
        console.log(`  ✓ Product elements found: ${sel} (${count} items)`);
        break;
      }
    }
    
    // Screenshot for debugging
    await page.screenshot({ 
      path: `screenshots/${store.name.toLowerCase().replace(/\s+/g, '_')}_home.png`,
      fullPage: false 
    });
    
    console.log(`  ✓ Screenshot saved`);
    
  } catch (error) {
    console.log(`  ✗ Error: ${error.message}`);
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('🚀 Malta Electronics Price Scraper - Site Test');
  console.log('================================================');
  
  // Create screenshots directory
  const fs = require('fs');
  if (!fs.existsSync('screenshots')) {
    fs.mkdirSync('screenshots');
  }
  
  for (const store of STORES) {
    await testStore(store, 'firefox');
    // Small delay between sites
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log('\n✅ Done! Check screenshots/ folder for results.');
}

main().catch(console.error);
