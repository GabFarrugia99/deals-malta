const fs = require('fs');

// Build a static HTML site from the price data
function buildSite() {
  const db = JSON.parse(fs.readFileSync('prices.json', 'utf8'));
  
  const products = db.products || [];
  
  // Group by product name (remove duplicates)
  const uniqueProducts = [];
  const seen = new Set();
  
  for (const p of products) {
    const key = p.name.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueProducts.push(p);
    }
  }
  
  // Sort by price
  uniqueProducts.sort((a, b) => a.price - b.price);
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Malta Electronics Price Tracker</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f0f23;
      color: #fff;
      line-height: 1.6;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    header { text-align: center; padding: 40px 20px; }
    header h1 { font-size: 2.5rem; background: linear-gradient(90deg, #00d4ff, #7b2cbf); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    header p { color: #888; margin-top: 10px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; margin: 30px 0; }
    .stat { background: #1a1a2e; padding: 20px; border-radius: 12px; text-align: center; }
    .stat-value { font-size: 2rem; font-weight: bold; color: #00d4ff; }
    .stat-label { color: #888; font-size: 0.9rem; }
    .products { margin-top: 30px; }
    .product { 
      background: #1a1a2e; 
      margin: 15px 0; 
      padding: 20px; 
      border-radius: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: transform 0.2s;
    }
    .product:hover { transform: translateX(5px); }
    .product-info { flex: 1; }
    .product-name { font-size: 1.1rem; font-weight: 600; }
    .product-store { color: #888; font-size: 0.85rem; margin-top: 5px; }
    .product-price { text-align: right; }
    .price { font-size: 1.8rem; font-weight: bold; color: #00ff88; }
    .price-range { color: #888; font-size: 0.85rem; }
    .badge { 
      display: inline-block; 
      padding: 4px 12px; 
      border-radius: 20px; 
      font-size: 0.75rem; 
      font-weight: bold;
      margin-left: 10px;
    }
    .badge-deal { background: #ff006e; color: white; }
    .badge-new { background: #00d4ff; color: #0f0f23; }
    .updated { text-align: center; color: #666; margin-top: 40px; font-size: 0.9rem; }
    @media (max-width: 600px) {
      .product { flex-direction: column; align-items: flex-start; }
      .product-price { text-align: left; margin-top: 15px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>📱 Malta Electronics Price Tracker</h1>
      <p>Compare iPhone, MacBook & Apple prices across Malta retailers</p>
    </header>
    
    <div class="stats">
      <div class="stat">
        <div class="stat-value">${uniqueProducts.length}</div>
        <div class="stat-label">Products Tracked</div>
      </div>
      <div class="stat">
        <div class="stat-value">€${uniqueProducts.length > 0 ? uniqueProducts[0].price : 0}</div>
        <div class="stat-label">Cheapest iPhone</div>
      </div>
      <div class="stat">
        <div class="stat-value">1</div>
        <div class="stat-label">Stores Monitored</div>
      </div>
    </div>
    
    <div class="products">
      ${uniqueProducts.map((p, i) => `
        <div class="product">
          <div class="product-info">
            <div class="product-name">
              ${p.name}
              ${i === 0 ? '<span class="badge badge-deal">BEST DEAL</span>' : ''}
            </div>
            <div class="product-store">${p.store} • ${p.priceText}</div>
          </div>
          <div class="product-price">
            <div class="price">€${p.price}</div>
          </div>
        </div>
      `).join('')}
    </div>
    
    <div class="updated">
      Last updated: ${db.lastUpdated ? new Date(db.lastUpdated).toLocaleString('en-MT') : 'Never'}
    </div>
  </div>
</body>
</html>`;

  fs.writeFileSync('index.html', html);
  console.log('✅ Site built: index.html');
}

buildSite();
