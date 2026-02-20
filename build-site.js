const fs = require('fs');

const DB_FILE = 'prices.json';

function loadDb() {
  if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE));
  return { products: [] };
}

function buildSite() {
  const db = loadDb();
  const products = db.products || [];
  
  console.log(`Building site with ${products.length} products...`);
  
  // Group by category
  const byCategory = {};
  for (const p of products) {
    const cat = p.category || 'Other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(p);
  }
  
  // Sort each category by price
  for (const cat in byCategory) {
    byCategory[cat].sort((a, b) => a.price - b.price);
  }
  
  // Get stats
  const stores = [...new Set(products.map(p => p.store))];
  const cheapestProduct = products.length > 0 ? products.reduce((min, p) => p.price < min.price ? p : min) : null;
  
  // Build category sections
  let categorySections = '';
  for (const [category, items] of Object.entries(byCategory).sort((a, b) => b[1].length - a[1].length)) {
    categorySections += `
      <section class="category">
        <h2>${category} <span class="count">(${items.length})</span></h2>
        <div class="products">
          ${items.map((p, i) => `
            <div class="product ${i === 0 ? 'best-deal' : ''}">
              ${p.imageLocal ? `<div class="product-image"><img src="${p.imageLocal}" alt="${escapeHtml(p.name)}" loading="lazy"></div>` : ''}
              <div class="product-info">
                <div class="product-name">
                  ${escapeHtml(p.name)}
                  ${i === 0 ? '<span class="badge badge-deal">BEST DEAL</span>' : ''}
                </div>
                <div class="product-meta">
                  <span class="store">${p.store}</span>
                  ${p.url ? `<a href="${p.url}" target="_blank" class="view-btn">View →</a>` : ''}
                </div>
              </div>
              <div class="product-price">
                <div class="price">€${p.price.toFixed(2)}</div>
                ${p.priceText !== `€${p.price.toFixed(2)}` ? `<div class="original">${p.priceText}</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Deals Malta - Electronics Price Tracker</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%);
      color: #fff;
      line-height: 1.6;
      min-height: 100vh;
    }
    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
    
    header { 
      text-align: center; 
      padding: 60px 20px 40px;
      background: linear-gradient(90deg, #00d4ff, #7b2cbf);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    header h1 { font-size: 3rem; font-weight: 700; }
    header p { 
      color: #888; 
      margin-top: 10px; 
      font-size: 1.1rem;
      -webkit-text-fill-color: #888;
    }
    
    .stats { 
      display: grid; 
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
      gap: 20px; 
      margin: 40px 0; 
    }
    .stat { 
      background: rgba(255,255,255,0.05); 
      padding: 25px; 
      border-radius: 16px; 
      text-align: center;
      border: 1px solid rgba(255,255,255,0.1);
      backdrop-filter: blur(10px);
    }
    .stat-value { font-size: 2.5rem; font-weight: 700; color: #00d4ff; }
    .stat-label { color: #888; font-size: 0.95rem; margin-top: 5px; }
    
    .category { margin: 40px 0; }
    .category h2 { 
      font-size: 1.5rem; 
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid rgba(0,212,255,0.3);
    }
    .category h2 .count { color: #888; font-size: 1rem; font-weight: 400; }
    
    .products { display: grid; gap: 12px; }
    .product { 
      background: rgba(255,255,255,0.03); 
      padding: 15px 20px; 
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 15px;
      border: 1px solid rgba(255,255,255,0.05);
      transition: all 0.2s;
    }
    .product:hover { 
      background: rgba(255,255,255,0.06);
      border-color: rgba(0,212,255,0.2);
    }
    .product.best-deal { border-color: rgba(0,255,136,0.3); }
    
    .product-image { 
      width: 80px; 
      height: 80px; 
      flex-shrink: 0;
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .product-image img { 
      max-width: 100%; 
      max-height: 100%; 
      object-fit: contain;
    }
    
    .product-info { flex: 1; min-width: 0; }
    .product-name { 
      font-size: 1.1rem; 
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .product-meta { 
      margin-top: 8px;
      display: flex;
      gap: 15px;
      align-items: center;
    }
    .store { color: #888; font-size: 0.85rem; }
    .view-btn {
      color: #00d4ff;
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 500;
    }
    .view-btn:hover { text-decoration: underline; }
    
    .product-price { text-align: right; }
    .price { font-size: 1.6rem; font-weight: 700; color: #00ff88; }
    .original { color: #666; font-size: 0.85rem; text-decoration: line-through; }
    
    .badge { 
      display: inline-block; 
      padding: 4px 12px; 
      border-radius: 20px; 
      font-size: 0.7rem; 
      font-weight: 700;
      background: #ff006e;
      color: white;
    }
    
    .updated { 
      text-align: center; 
      color: #666; 
      margin: 60px 0 40px; 
      font-size: 0.9rem;
    }
    
    @media (max-width: 768px) {
      header h1 { font-size: 2rem; }
      .product { flex-direction: column; align-items: flex-start; gap: 15px; }
      .product-price { text-align: left; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🔥 Deals Malta</h1>
      <p>Compare electronics prices across Malta retailers</p>
    </header>
    
    <div class="stats">
      <div class="stat">
        <div class="stat-value">${products.length}</div>
        <div class="stat-label">Products Tracked</div>
      </div>
      <div class="stat">
        <div class="stat-value">${stores.length}</div>
        <div class="stat-label">Stores</div>
      </div>
      <div class="stat">
        <div class="stat-value">${Object.keys(byCategory).length}</div>
        <div class="stat-label">Categories</div>
      </div>
      <div class="stat">
        <div class="stat-value">${cheapestProduct ? '€' + Math.round(cheapestProduct.price) : '-'}</div>
        <div class="stat-label">Cheapest Item</div>
      </div>
    </div>
    
    ${categorySections}
    
    <div class="updated">
      Last updated: ${db.lastUpdated ? new Date(db.lastUpdated).toLocaleString('en-MT', { dateStyle: 'medium', timeStyle: 'short' }) : 'Never'}
    </div>
  </div>
</body>
</html>`;

  fs.writeFileSync('index.html', html);
  console.log('✅ Site built: index.html');
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Run if called directly
if (require.main === module) {
  buildSite();
}

module.exports = buildSite;
