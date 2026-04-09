const express = require('express');
const router = express.Router();
const db = require('../db');
const crypto = require('crypto');

// ── Tables ─────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS site_stats (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    total_visits INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  INSERT OR IGNORE INTO site_stats (id, total_visits) VALUES (1, 0);

  CREATE TABLE IF NOT EXISTS page_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    page TEXT NOT NULL,
    referrer TEXT DEFAULT '',
    user_agent TEXT DEFAULT '',
    country TEXT DEFAULT '',
    city TEXT DEFAULT '',
    device TEXT DEFAULT 'desktop',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_pv_session ON page_views(session_id);
  CREATE INDEX IF NOT EXISTS idx_pv_date ON page_views(created_at);
  CREATE INDEX IF NOT EXISTS idx_pv_page ON page_views(page);
`);

// Track live SSE connections
const liveClients = new Set();

// ── Helper: detect device type from user-agent ─────────────────────
function detectDevice(ua) {
  if (!ua) return 'unknown';
  if (/mobile|android|iphone|ipad|ipod/i.test(ua)) return 'mobile';
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  return 'desktop';
}

// ── POST /visit — Record a visit + page view ───────────────────────
router.post('/visit', (req, res) => {
  db.prepare('UPDATE site_stats SET total_visits = total_visits + 1, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run();
  const stats = db.prepare('SELECT total_visits FROM site_stats WHERE id = 1').get();

  // Record page view
  const { page, referrer, sessionId } = req.body;
  const ua = req.headers['user-agent'] || '';
  const sid = sessionId || crypto.randomUUID();

  try {
    db.prepare(`INSERT INTO page_views (session_id, page, referrer, user_agent, device, created_at) 
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`)
      .run(sid, page || '/', referrer || '', ua, detectDevice(ua));
  } catch { /* ignore logging errors */ }

  broadcastLiveCount(stats.total_visits);
  res.json({ totalVisits: stats.total_visits, sessionId: sid });
});

// ── POST /pageview — Track page navigation (SPA) ──────────────────
router.post('/pageview', (req, res) => {
  const { page, sessionId, referrer } = req.body;
  if (!page || !sessionId) return res.status(400).json({ error: 'page and sessionId required' });
  const ua = req.headers['user-agent'] || '';
  try {
    db.prepare(`INSERT INTO page_views (session_id, page, referrer, user_agent, device, created_at) 
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`)
      .run(sessionId, page, referrer || '', ua, detectDevice(ua));
  } catch { /* ignore */ }
  res.json({ ok: true });
});

// ── GET / — Current stats summary ──────────────────────────────────
router.get('/', (req, res) => {
  const stats = db.prepare('SELECT total_visits FROM site_stats WHERE id = 1').get();

  // Today's stats
  const today = db.prepare(`SELECT COUNT(*) as views, COUNT(DISTINCT session_id) as sessions 
                            FROM page_views WHERE date(created_at) = date('now')`).get();
  // This week
  const week = db.prepare(`SELECT COUNT(*) as views, COUNT(DISTINCT session_id) as sessions 
                           FROM page_views WHERE created_at >= datetime('now', '-7 days')`).get();
  // Top pages (last 7 days)
  const topPages = db.prepare(`SELECT page, COUNT(*) as views FROM page_views 
                               WHERE created_at >= datetime('now', '-7 days')
                               GROUP BY page ORDER BY views DESC LIMIT 10`).all();
  // Device breakdown
  const devices = db.prepare(`SELECT device, COUNT(*) as count FROM page_views 
                              WHERE created_at >= datetime('now', '-7 days')
                              GROUP BY device ORDER BY count DESC`).all();
  // Top referrers
  const referrers = db.prepare(`SELECT referrer, COUNT(*) as count FROM page_views 
                                WHERE referrer != '' AND created_at >= datetime('now', '-7 days')
                                GROUP BY referrer ORDER BY count DESC LIMIT 10`).all();

  res.json({
    totalVisits: stats?.total_visits || 0,
    liveUsers: liveClients.size,
    today: { views: today?.views || 0, sessions: today?.sessions || 0 },
    week: { views: week?.views || 0, sessions: week?.sessions || 0 },
    topPages,
    devices,
    referrers,
  });
});

// ── GET /live — SSE for real-time live user count ──────────────────
router.get('/live', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  liveClients.add(res);
  const stats = db.prepare('SELECT total_visits FROM site_stats WHERE id = 1').get();
  res.write(`data: ${JSON.stringify({ liveUsers: liveClients.size, totalVisits: stats?.total_visits || 0 })}\n\n`);
  broadcastLiveCount(stats?.total_visits || 0);

  req.on('close', () => {
    liveClients.delete(res);
    const s = db.prepare('SELECT total_visits FROM site_stats WHERE id = 1').get();
    broadcastLiveCount(s?.total_visits || 0);
  });
});

function broadcastLiveCount(totalVisits) {
  const data = JSON.stringify({ liveUsers: liveClients.size, totalVisits });
  for (const client of liveClients) {
    try { client.write(`data: ${data}\n\n`); } catch { liveClients.delete(client); }
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
