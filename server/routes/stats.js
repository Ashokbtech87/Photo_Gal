const express = require('express');
const router = express.Router();
const db = require('../db');

// Create stats table
db.exec(`
  CREATE TABLE IF NOT EXISTS site_stats (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    total_visits INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  INSERT OR IGNORE INTO site_stats (id, total_visits) VALUES (1, 0);
`);

// Track live SSE connections
const liveClients = new Set();

// Record a visit (called once per page load)
router.post('/visit', (req, res) => {
  db.prepare('UPDATE site_stats SET total_visits = total_visits + 1, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run();
  const stats = db.prepare('SELECT total_visits FROM site_stats WHERE id = 1').get();
  // Broadcast updated total to all live clients
  broadcastLiveCount(stats.total_visits);
  res.json({ totalVisits: stats.total_visits });
});

// Get current stats
router.get('/', (req, res) => {
  const stats = db.prepare('SELECT total_visits FROM site_stats WHERE id = 1').get();
  res.json({
    totalVisits: stats?.total_visits || 0,
    liveUsers: liveClients.size,
  });
});

// SSE endpoint for live user count
router.get('/live', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Add this client
  liveClients.add(res);

  // Send initial count
  const stats = db.prepare('SELECT total_visits FROM site_stats WHERE id = 1').get();
  res.write(`data: ${JSON.stringify({ liveUsers: liveClients.size, totalVisits: stats?.total_visits || 0 })}\n\n`);

  // Broadcast updated live count to ALL clients
  broadcastLiveCount(stats?.total_visits || 0);

  // Clean up on disconnect
  req.on('close', () => {
    liveClients.delete(res);
    const s = db.prepare('SELECT total_visits FROM site_stats WHERE id = 1').get();
    broadcastLiveCount(s?.total_visits || 0);
  });
});

function broadcastLiveCount(totalVisits) {
  const data = JSON.stringify({ liveUsers: liveClients.size, totalVisits });
  for (const client of liveClients) {
    try {
      client.write(`data: ${data}\n\n`);
    } catch {
      liveClients.delete(client);
    }
  }
}

// ── Country code → DDG region mapping ──────────────────────────────
const COUNTRY_TO_REGION = {
  US: 'us-en', GB: 'gb-en', IN: 'in-en', CA: 'ca-en', AU: 'au-en',
  DE: 'de-de', FR: 'fr-fr', JP: 'jp-jp', BR: 'br-pt', RU: 'ru-ru',
  ZA: 'za-en', SG: 'sg-en', AE: 'ae-ar', SA: 'sa-ar', KR: 'kr-kr',
  IT: 'it-it', ES: 'es-es', MX: 'mx-es', NL: 'nl-nl', SE: 'se-sv',
  NO: 'no-no', PL: 'pl-pl', TR: 'tr-tr', ID: 'id-en', TH: 'th-th',
  PH: 'ph-en', MY: 'my-en', NG: 'ng-en', KE: 'ke-en', EG: 'eg-ar',
  PK: 'pk-en', BD: 'bd-en', LK: 'lk-en', NZ: 'nz-en', IE: 'ie-en',
  IL: 'il-he', CH: 'ch-de', AT: 'at-de', BE: 'be-fr', CN: 'cn-zh',
  TW: 'tw-zh', HK: 'hk-zh', AR: 'ar-es', CO: 'co-es', CL: 'cl-es',
};

// ── IP Geolocation — auto-detect user's location ───────────────────
router.get('/geolocate', async (req, res) => {
  try {
    // Get the real client IP (behind proxy: x-forwarded-for, otherwise remoteAddress)
    let ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
    ip = ip.replace(/^::ffff:/, '');
    const isLocal = !ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.');

    // Use ipinfo.io (free, HTTPS, reliable)
    const apiUrl = isLocal ? 'https://ipinfo.io/json' : `https://ipinfo.io/${ip}/json`;
    const geoRes = await fetch(apiUrl);
    const geo = await geoRes.json();

    if (!geo.country) {
      return res.json({ detected: false, region: 'wt-wt', country: 'Worldwide' });
    }

    const regionCode = COUNTRY_TO_REGION[geo.country] || 'wt-wt';
    const [lat, lon] = (geo.loc || '0,0').split(',').map(Number);

    // Map country code to full name
    const COUNTRY_NAMES = {
      US: 'United States', GB: 'United Kingdom', IN: 'India', CA: 'Canada', AU: 'Australia',
      DE: 'Germany', FR: 'France', JP: 'Japan', BR: 'Brazil', RU: 'Russia',
      ZA: 'South Africa', SG: 'Singapore', AE: 'UAE', SA: 'Saudi Arabia', KR: 'South Korea',
      IT: 'Italy', ES: 'Spain', MX: 'Mexico', NL: 'Netherlands', SE: 'Sweden',
      NO: 'Norway', PL: 'Poland', TR: 'Turkey', ID: 'Indonesia', TH: 'Thailand',
      PH: 'Philippines', MY: 'Malaysia', NG: 'Nigeria', KE: 'Kenya', EG: 'Egypt',
      PK: 'Pakistan', BD: 'Bangladesh', LK: 'Sri Lanka', NZ: 'New Zealand', IE: 'Ireland',
      IL: 'Israel', CH: 'Switzerland', AT: 'Austria', BE: 'Belgium', CN: 'China',
      TW: 'Taiwan', HK: 'Hong Kong', AR: 'Argentina', CO: 'Colombia', CL: 'Chile',
    };

    res.json({
      detected: true,
      ip: geo.ip,
      city: geo.city,
      region: regionCode,
      regionName: geo.region,
      country: COUNTRY_NAMES[geo.country] || geo.country,
      countryCode: geo.country,
      lat,
      lon,
      timezone: geo.timezone,
      isp: geo.org || '',
      postal: geo.postal || '',
    });
  } catch (err) {
    console.error('Geolocation error:', err.message);
    res.json({ detected: false, region: 'wt-wt', country: 'Worldwide' });
  }
});

module.exports = router;
