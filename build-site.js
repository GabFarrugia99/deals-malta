const fs = require('fs');
const DB_FILE = 'prices.json';

function loadDb() {
  if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE));
  return { products: [], matches: {}, history: {} };
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildSite() {
  const db = loadDb();
  const products = db.products || [];
  const matches = db.matches || {};
  const history = db.history || {};
  
  console.log(`Building site: ${products.length} products, ${Object.keys(matches).length} matches`);
  
  // Group by category
  const byCategory = {};
  for (const p of products) {
    const cat = p.category || 'Other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(p);
  }
  for (const cat in byCategory) byCategory[cat].sort((a, b) => a.price - b.price);
  
  const stores = [...new Set(products.map(p => p.store))];
  
  // Build comparison section
  let comparisonSection = '';
  if (Object.keys(matches).length > 0) {
    comparisonSection = `
      <section class="comparisons">
        <h2>🔥 Price Comparisons</h2>
        <p class="section-desc">Same product, different stores — find the best deal</p>
        <div class="comparison-grid">
          ${Object.entries(matches).slice(0, 20).map(([key, items]) => {
            const cheapest = items[0];
            const savings = items[items.length - 1].price - cheapest.price;
            return `
              <div class="comparison-card">
                <div class="comparison-header">
                  ${cheapest.imageLocal ? `<img src="${cheapest.imageLocal}" alt="" class="comparison-img">` : ''}
                  <div>
                    <h3>${escapeHtml(cheapest.name.substring(0, 50))}</h3>
                    <div class="savings">Save up to €${savings.toFixed(0)} by comparing!</div>
                  </div>
                </div>
                <div class="store-prices">
                  ${items.map((p, i) => `
                    <div class="store-price ${i === 0 ? 'best' : ''}">
                      <span class="store-name">${p.store}</span>
                      <span class="store-cost">€${p.price.toFixed(2)}</span>
                      ${i === 0 ? '<span class="best-badge">BEST</span>' : ''}
                      ${p.url ? `<a href="${p.url}" target="_blank" class="buy-btn">Buy →</a>` : ''}
                    </div>
                  `).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>
    `;
  }
  
  // Build category sections
  let categorySections = '';
  for (const [category, items] of Object.entries(byCategory).sort((a, b) => b[1].length - a[1].length)) {
    categorySections += `
      <section class="category" data-category="${category}">
        <h2>${category} <span class="count">${items.length}</span></h2>
        <div class="products">
          ${items.map((p, i) => `
            <div class="product ${i === 0 ? 'best-deal' : ''}" data-store="${p.store}" data-name="${escapeHtml(p.name.toLowerCase())}">
              ${p.imageLocal ? `<div class="product-image"><img src="${p.imageLocal}" alt="" loading="lazy"></div>` : ''}
              <div class="product-info">
                <div class="product-name">${escapeHtml(p.name)}${i === 0 ? '<span class="badge">BEST</span>' : ''}</div>
                <div class="product-meta">
                  <span class="store">${p.store}</span>
                  ${p.url ? `<a href="${p.url}" target="_blank" class="view-btn">View →</a>` : ''}
                </div>
              </div>
              <div class="product-price">
                <div class="price">€${p.price.toFixed(2)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }
  
  // Build history chart data
  const historyDates = Object.keys(history).sort().slice(-14);
  const historyData = historyDates.map(d => ({ date: d, count: history[d]?.count || 0 }));
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#0f0f23">
  <title>Deals Malta - Electronics Price Tracker</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="manifest" href="manifest.json">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%); color: #fff; line-height: 1.6; min-height: 100vh; }
    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
    
    header { text-align: center; padding: 60px 20px 40px; }
    header h1 { font-size: 3rem; font-weight: 700; background: linear-gradient(90deg, #00d4ff, #7b2cbf); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    header p { color: #888; margin-top: 10px; font-size: 1.1rem; }
    
    .search-box { max-width: 600px; margin: 0 auto 40px; position: relative; }
    .search-box input { width: 100%; padding: 15px 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: #fff; font-size: 1rem; }
    .search-box input::placeholder { color: #666; }
    .search-box input:focus { outline: none; border-color: #00d4ff; }
    
    .filters { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-bottom: 40px; }
    .filter-btn { padding: 8px 16px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: #888; cursor: pointer; transition: all 0.2s; }
    .filter-btn:hover, .filter-btn.active { background: #00d4ff; color: #0f0f23; border-color: #00d4ff; }
    
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 40px 0; }
    .stat { background: rgba(255,255,255,0.05); padding: 20px; border-radius: 12px; text-align: center; border: 1px solid rgba(255,255,255,0.1); }
    .stat-value { font-size: 2rem; font-weight: 700; color: #00d4ff; }
    .stat-label { color: #888; font-size: 0.85rem; }
    
    .comparisons { margin: 40px 0; }
    .comparisons h2 { font-size: 1.8rem; margin-bottom: 10px; }
    .section-desc { color: #888; margin-bottom: 25px; }
    .comparison-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px; }
    .comparison-card { background: rgba(255,255,255,0.05); border-radius: 16px; padding: 20px; border: 1px solid rgba(255,255,255,0.1); }
    .comparison-header { display: flex; gap: 15px; margin-bottom: 15px; }
    .comparison-img { width: 60px; height: 60px; object-fit: contain; border-radius: 8px; background: rgba(255,255,255,0.05); }
    .comparison-header h3 { font-size: 1rem; margin-bottom: 5px; }
    .savings { color: #00ff88; font-size: 0.85rem; font-weight: 500; }
    .store-prices { display: flex; flex-direction: column; gap: 8px; }
    .store-price { display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.03); }
    .store-price.best { background: rgba(0,255,136,0.1); border: 1px solid rgba(0,255,136,0.2); }
    .store-name { flex: 1; font-size: 0.9rem; }
    .store-cost { font-weight: 600; font-size: 1.1rem; }
    .store-price.best .store-cost { color: #00ff88; }
    .best-badge { background: #00ff88; color: #0f0f23; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; font-weight: 700; }
    .buy-btn { color: #00d4ff; text-decoration: none; font-size: 0.85rem; }
    
    .category { margin: 40px 0; }
    .category h2 { font-size: 1.5rem; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid rgba(0,212,255,0.3); display: flex; align-items: center; gap: 10px; }
    .category h2 .count { color: #888; font-size: 0.9rem; font-weight: 400; }
    .products { display: grid; gap: 12px; }
    .product { background: rgba(255,255,255,0.03); padding: 15px; border-radius: 12px; display: flex; align-items: center; gap: 15px; border: 1px solid rgba(255,255,255,0.05); transition: all 0.2s; }
    .product:hover { background: rgba(255,255,255,0.06); border-color: rgba(0,212,255,0.2); }
    .product.best-deal { border-color: rgba(0,255,136,0.3); }
    .product.hidden { display: none; }
    .product-image { width: 70px; height: 70px; flex-shrink: 0; background: rgba(255,255,255,0.05); border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .product-image img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .product-info { flex: 1; min-width: 0; }
    .product-name { font-size: 1rem; font-weight: 600; display: flex; align-items: center; gap: 8px; }
    .product-meta { margin-top: 5px; display: flex; gap: 15px; align-items: center; }
    .store { color: #888; font-size: 0.8rem; }
    .view-btn { color: #00d4ff; text-decoration: none; font-size: 0.8rem; }
    .product-price { text-align: right; }
    .price { font-size: 1.4rem; font-weight: 700; color: #00ff88; }
    .badge { background: #ff006e; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.65rem; font-weight: 700; }
    
    .updated { text-align: center; color: #666; margin: 60px 0 40px; font-size: 0.9rem; }
    
    @media (max-width: 768px) {
      header h1 { font-size: 2rem; }
      .comparison-grid { grid-template-columns: 1fr; }
      .product { flex-wrap: wrap; }
      .product-price { width: 100%; text-align: left; margin-top: 10px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🔥 Deals Malta</h1>
      <p>Compare electronics prices across Malta retailers</p>
    </header>
    
    <div class="search-box">
      <input type="text" id="search" placeholder="Search products..." autocomplete="off">
    </div>
    
    <div class="filters">
      <button class="filter-btn active" data-filter="all">All</button>
      ${stores.map(s => `<button class="filter-btn" data-filter="${s}">${s}</button>`).join('')}
    </div>
    
    <div class="stats">
      <div class="stat"><div class="stat-value">${products.length}</div><div class="stat-label">Products</div></div>
      <div class="stat"><div class="stat-value">${stores.length}</div><div class="stat-label">Stores</div></div>
      <div class="stat"><div class="stat-value">${Object.keys(matches).length}</div><div class="stat-label">Comparisons</div></div>
      <div class="stat"><div class="stat-value">${Object.keys(byCategory).length}</div><div class="stat-label">Categories</div></div>
    </div>
    
    ${comparisonSection}
    
    ${categorySections}
    
    <div class="updated">Last updated: ${db.lastUpdated ? new Date(db.lastUpdated).toLocaleString('en-MT') : 'Never'}</div>
  </div>
  
  <script>
    // Search functionality
    const searchInput = document.getElementById('search');
    searchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      document.querySelectorAll('.product').forEach(p => {
        const name = p.dataset.name;
        const store = p.dataset.store;
        p.classList.toggle('hidden', !name.includes(term) && !store.toLowerCase().includes(term));
      });
      document.querySelectorAll('.category').forEach(c => {
        const visible = c.querySelectorAll('.product:not(.hidden)').length > 0;
        c.style.display = visible ? 'block' : 'none';
      });
    });
    
    // Store filter
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.filter;
        document.querySelectorAll('.product').forEach(p => {
          if (filter === 'all') {
            p.classList.remove('hidden');
          } else {
            p.classList.toggle('hidden', p.dataset.store !== filter);
          }
        });
      });
    });
    
    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  </script>
</body>
</html>`;

  fs.writeFileSync('index.html', html);
  console.log('✅ Site built: index.html');
  
  // Create manifest.json for PWA
  const manifest = {
    name: 'Deals Malta',
    short_name: 'DealsMT',
    description: 'Compare electronics prices across Malta retailers',
    start_url: '/deals-malta/',
    display: 'standalone',
    background_color: '#0f0f23',
    theme_color: '#0f0f23',
    icons: [{ src: 'icon.png', sizes: '192x192', type: 'image/png' }]
  };
  fs.writeFileSync('manifest.json', JSON.stringify(manifest, null, 2));
  
  // Create simple service worker
  const sw = `self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('fetch', e => e.respondWith(fetch(e.request).catch(() => caches.match(e.request))));`;
  fs.writeFileSync('sw.js', sw);
}

buildSite();
