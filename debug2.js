const { firefox } = require('playwright');

async function debug() {
  const browser = await firefox.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('https://www.scanmalta.com/shop/smartphones/android-apple-smartphones/iphone.html', { 
    waitUntil: 'networkidle'
  });
  await page.waitForTimeout(5000);
  
  // Get page structure
  const html = await page.content();
  console.log('Page length:', html.length);
  
  // Check if .item exists
  const itemCount = await page.locator('.item').count();
  console.log('.item count:', itemCount);
  
  // Try to get text from first few items
  const items = await page.locator('.item').all();
  console.log('\nFirst 3 items:');
  for (let i = 0; i < Math.min(3, items.length); i++) {
    const text = await items[i].textContent();
    console.log(`\n--- Item ${i} ---`);
    console.log(text?.substring(0, 300));
  }
  
  // Screenshot
  await page.screenshot({ path: 'iphone_page.png', fullPage: true });
  console.log('\nScreenshot saved: iphone_page.png');
  
  await browser.close();
}

debug().catch(console.error);
