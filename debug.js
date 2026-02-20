const { firefox } = require('playwright');

async function debug() {
  const browser = await firefox.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('https://www.scanmalta.com/search?q=iPhone', { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);
  
  // Get page HTML
  const html = await page.content();
  console.log('Page length:', html.length);
  
  // Check for common product selectors
  const selectors = ['.product', '.product-item', '.item', '[data-product]', '.grid-item', '.card'];
  for (const sel of selectors) {
    const count = await page.locator(sel).count();
    if (count > 0) console.log(`${sel}: ${count} found`);
  }
  
  // Look for any links containing iPhone
  const links = await page.locator('a:has-text("iPhone")').all();
  console.log(`\nLinks with 'iPhone': ${links.length}`);
  
  for (const link of links.slice(0, 5)) {
    const text = await link.textContent();
    const href = await link.getAttribute('href');
    console.log(`  - ${text?.substring(0, 60)}... (${href})`);
  }
  
  // Save screenshot
  await page.screenshot({ path: 'scan_debug.png', fullPage: true });
  console.log('\nScreenshot saved: scan_debug.png');
  
  await browser.close();
}

debug().catch(console.error);
