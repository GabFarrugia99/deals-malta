// Telegram bot for price drop alerts
// Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in GitHub Secrets

const fs = require('fs');
const https = require('https');

const DB_FILE = 'prices.json';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function loadDb() {
  if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE));
  return { products: [], history: {} };
}

async function sendTelegramMessage(text) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.log('Telegram not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.');
    return;
  }
  
  const data = JSON.stringify({
    chat_id: CHAT_ID,
    text: text,
    parse_mode: 'Markdown',
    disable_web_page_preview: true
  });
  
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    }, (res) => {
      let response = '';
      res.on('data', chunk => response += chunk);
      res.on('end', () => {
        console.log('Telegram response:', response);
        resolve(response);
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function checkAndNotify() {
  const db = loadDb();
  
  if (!db.lastAlertCheck) db.lastAlertCheck = new Date(0).toISOString();
  
  // Load previous products to compare
  const previous = db.previousProducts || [];
  const current = db.products || [];
  
  const prevMap = new Map(previous.map(p => [p.id, p]));
  const drops = [];
  const newProducts = [];
  
  for (const p of current) {
    const old = prevMap.get(p.id);
    if (old) {
      if (old.price > p.price) {
        drops.push({
          name: p.name,
          store: p.store,
          oldPrice: old.price,
          newPrice: p.price,
          savings: old.price - p.price,
          url: p.url
        });
      }
    } else if (new Date(p.scrapedAt) > new Date(db.lastAlertCheck)) {
      newProducts.push(p);
    }
  }
  
  let message = '';
  
  if (drops.length > 0) {
    message += `🔥 *${drops.length} PRICE DROP${drops.length > 1 ? 'S' : ''} DETECTED!*\n\n`;
    drops.slice(0, 5).forEach(d => {
      message += `📉 *${d.name.substring(0, 50)}*\n`;
      message += `   ${d.store}: €${d.oldPrice.toFixed(2)} → *€${d.newPrice.toFixed(2)}*\n`;
      message += `   💰 Save €${d.savings.toFixed(2)}\n`;
      if (d.url) message += `   [View Deal](${d.url})\n`;
      message += `\n`;
    });
  }
  
  if (newProducts.length > 0 && newProducts.length <= 10) {
    message += `\n🆕 *${newProducts.length} NEW PRODUCTS*\n\n`;
    newProducts.slice(0, 5).forEach(p => {
      message += `• ${p.name.substring(0, 40)} - €${p.price.toFixed(2)}\n`;
    });
  }
  
  if (message) {
    message += `\n[View All Deals](https://gabfarrugia99.github.io/deals-malta)`;
    await sendTelegramMessage(message);
    console.log('Price alert sent!');
  } else {
    console.log('No price changes to report.');
  }
  
  // Save current as previous for next run
  db.previousProducts = current;
  db.lastAlertCheck = new Date().toISOString();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// Run if called directly
if (require.main === module) {
  checkAndNotify().catch(console.error);
}

module.exports = { checkAndNotify, sendTelegramMessage };
