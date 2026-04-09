const express = require('express');
const db = require('../db');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();
const OLLAMA_BASE = process.env.OLLAMA_URL || 'http://localhost:11434';

// ── Country/Region codes for DuckDuckGo ───────────────────────────
const REGIONS = {
  'wt-wt': 'Worldwide',
  'us-en': 'United States', 'gb-en': 'United Kingdom', 'in-en': 'India',
  'ca-en': 'Canada', 'au-en': 'Australia', 'de-de': 'Germany',
  'fr-fr': 'France', 'jp-jp': 'Japan', 'br-pt': 'Brazil',
  'ru-ru': 'Russia', 'za-en': 'South Africa', 'sg-en': 'Singapore',
  'ae-ar': 'UAE', 'sa-ar': 'Saudi Arabia', 'kr-kr': 'South Korea',
  'it-it': 'Italy', 'es-es': 'Spain', 'mx-es': 'Mexico',
  'nl-nl': 'Netherlands', 'se-sv': 'Sweden', 'no-no': 'Norway',
  'pl-pl': 'Poland', 'tr-tr': 'Turkey', 'id-en': 'Indonesia',
  'th-th': 'Thailand', 'ph-en': 'Philippines', 'my-en': 'Malaysia',
  'ng-en': 'Nigeria', 'ke-en': 'Kenya', 'eg-ar': 'Egypt',
  'pk-en': 'Pakistan', 'bd-en': 'Bangladesh', 'lk-en': 'Sri Lanka',
  'nz-en': 'New Zealand', 'ie-en': 'Ireland', 'il-he': 'Israel',
  'ch-de': 'Switzerland', 'at-de': 'Austria', 'be-fr': 'Belgium',
  'cn-zh': 'China', 'tw-zh': 'Taiwan', 'hk-zh': 'Hong Kong',
  'ar-es': 'Argentina', 'co-es': 'Colombia', 'cl-es': 'Chile',
};

// ── Helper: call Ollama ────────────────────────────────────────────
async function callOllama(model, prompt) {
  const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
  });
  if (!res.ok) throw new Error(`Ollama error (${res.status})`);
  const data = await res.json();
  return data.response || '';
}

// ── Helper: fetch news from DuckDuckGo ─────────────────────────────
async function fetchDDGNews(query, count = 10, region = 'wt-wt', dateFilter = '') {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  // Get vqd token
  const tokenUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iar=news&ia=news`;
  const tokenRes = await fetch(tokenUrl, { headers });
  if (!tokenRes.ok) throw new Error(`DDG token fetch failed (${tokenRes.status})`);
  const html = await tokenRes.text();
  const vqdMatch = html.match(/vqd=["']?([^"'&]+)/);
  if (!vqdMatch) throw new Error('Could not get DDG search token');

  // Fetch news results with region (dateFilter: '' = all time, 'd' = day, 'w' = week)
  const df = dateFilter ? `&df=${dateFilter}` : '';
  const newsUrl = `https://duckduckgo.com/news.js?l=${region}&o=json&noamp=1&q=${encodeURIComponent(query)}&vqd=${vqdMatch[1]}${df}`;
  const newsRes = await fetch(newsUrl, {
    headers: { ...headers, 'Referer': 'https://duckduckgo.com/' },
  });
  if (!newsRes.ok) throw new Error(`DDG news fetch failed (${newsRes.status})`);
  const data = await newsRes.json();
  return (data.results || []).slice(0, count);
}

// ── Helper: fetch news images from DuckDuckGo Images ───────────────
async function fetchDDGImages(query, count = 5, region = 'wt-wt') {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  const tokenUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`;
  const tokenRes = await fetch(tokenUrl, { headers });
  if (!tokenRes.ok) return [];
  const html = await tokenRes.text();
  const vqdMatch = html.match(/vqd=["']?([^"'&]+)/);
  if (!vqdMatch) return [];

  const imgUrl = `https://duckduckgo.com/i.js?l=${region}&o=json&q=${encodeURIComponent(query)}&vqd=${vqdMatch[1]}&p=1`;
  const imgRes = await fetch(imgUrl, {
    headers: { ...headers, 'Referer': 'https://duckduckgo.com/' },
  });
  if (!imgRes.ok) return [];
  const data = await imgRes.json();
  return (data.results || []).slice(0, count);
}

// ── Helper: fetch videos from DuckDuckGo Videos ────────────────────
async function fetchDDGVideos(query, count = 20, region = 'wt-wt') {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  const tokenUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=videos&ia=videos`;
  const tokenRes = await fetch(tokenUrl, { headers });
  if (!tokenRes.ok) throw new Error(`DDG video token failed (${tokenRes.status})`);
  const html = await tokenRes.text();
  const vqdMatch = html.match(/vqd=["']?([^"'&]+)/);
  if (!vqdMatch) throw new Error('Could not get DDG video token');

  const vidUrl = `https://duckduckgo.com/v.js?l=${region}&o=json&noamp=1&q=${encodeURIComponent(query)}&vqd=${vqdMatch[1]}&f=,,,&p=1`;
  const vidRes = await fetch(vidUrl, {
    headers: { ...headers, 'Referer': 'https://duckduckgo.com/' },
  });
  if (!vidRes.ok) throw new Error(`DDG video fetch failed (${vidRes.status})`);
  const data = await vidRes.json();

  return (data.results || []).slice(0, count).map(v => {
    // Extract YouTube video ID from content URL or embed
    let youtubeId = null;
    const ytMatch = (v.content || '').match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) youtubeId = ytMatch[1];
    if (!youtubeId) {
      const embedMatch = (v.content || v.embed_url || '').match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
      if (embedMatch) youtubeId = embedMatch[1];
    }

    return {
      title: v.title || 'Untitled',
      description: v.description || '',
      url: v.content || '',
      embed_url: v.embed_url || '',
      publisher: v.publisher || v.uploader || 'Unknown',
      uploader: v.uploader || v.publisher || '',
      duration: v.duration || '',
      views: v.statistics ? v.statistics.viewCount : (v.views || null),
      published: v.published || '',
      thumbnail: v.images?.large || v.images?.medium || v.images?.small || v.image || '',
      youtubeId,
      isYouTube: !!youtubeId,
    };
  });
}

// ── Video category definitions ─────────────────────────────────────
const VIDEO_CATEGORIES = {
  trending: { label: '📈 Trending', queries: ['trending videos today', 'most popular videos right now', 'live tv channels streaming now', 'top trending videos this week'] },
  livetv: { label: '📹 Live TV', queries: ['live tv channel streaming now', 'live news channel 24x7', 'live tv today', 'live streaming channel'] },
  entertainment: { label: '🎭 Entertainment', queries: ['entertainment videos trending', 'funny viral videos today', 'best entertainment clips'] },
  movies: { label: '🎬 Movies', queries: ['new movie trailers', 'latest movie reviews', 'upcoming movies'] },
  viral: { label: '🔥 Viral Videos', queries: ['viral videos today', 'trending videos this week', 'most viewed videos today'] },
  news: { label: '📺 News Channels', queries: ['live news channel', 'breaking news today', 'news headlines today live'] },
  music: { label: '🎵 Music', queries: ['new music videos', 'trending music this week', 'top music videos'] },
  sports: { label: '⚽ Sports', queries: ['sports highlights today', 'best sports moments', 'live sports'] },
};

// ── Helper: time ago string ────────────────────────────────────────
function timeAgo(timestamp) {
  const now = Date.now() / 1000;
  const diff = now - timestamp;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── GET /api/news/feed — Get cached news feed ──────────────────────
router.get('/feed', optionalAuth, async (req, res) => {
  try {
    const category = req.query.category || 'top';
    const region = req.query.region || 'wt-wt';
    const cacheKey = `${category}:${region}`;

    // Check cache (10 minutes = 600 seconds)
    const cached = db.prepare(
      `SELECT * FROM news_cache WHERE category = ? AND fetched_at > datetime('now', '-10 minutes') ORDER BY fetched_at DESC LIMIT 1`
    ).get(cacheKey);

    if (cached) {
      return res.json(JSON.parse(cached.data));
    }

    // No cache — trigger a refresh
    const feed = await generateNewsFeed(category, region);
    
    // Cache the result
    db.prepare(
      `INSERT OR REPLACE INTO news_cache (category, data, fetched_at) VALUES (?, ?, datetime('now'))`
    ).run(cacheKey, JSON.stringify(feed));

    res.json(feed);
  } catch (err) {
    console.error('News feed error:', err);
    const region = req.query.region || 'wt-wt';
    const cacheKey = `${req.query.category || 'top'}:${region}`;
    const stale = db.prepare(
      `SELECT * FROM news_cache WHERE category = ? ORDER BY fetched_at DESC LIMIT 1`
    ).get(cacheKey);
    if (stale) {
      return res.json({ ...JSON.parse(stale.data), stale: true });
    }
    res.status(500).json({ error: err.message || 'Failed to fetch news' });
  }
});

// ── GET /api/news/countries — Available countries ──────────────────
router.get('/countries', (req, res) => {
  res.json(Object.entries(REGIONS).map(([code, name]) => ({ code, name })));
});

// ── GET /api/news/categories — Available categories ────────────────
router.get('/categories', (req, res) => {
  res.json([
    { id: 'top', label: '🔥 Top Stories', query: 'top breaking news today' },
    { id: 'world', label: '🌍 World', query: 'world news international' },
    { id: 'tech', label: '💻 Technology', query: 'technology news latest' },
    { id: 'business', label: '💰 Business', query: 'business finance economy news' },
    { id: 'sports', label: '⚽ Sports', query: 'sports news results today' },
    { id: 'entertainment', label: '🎬 Entertainment', query: 'entertainment celebrity movies news' },
    { id: 'science', label: '🔬 Science', query: 'science research discovery news' },
    { id: 'health', label: '🏥 Health', query: 'health medical wellness news' },
    { id: 'videos', label: '▶️ Trending Videos', query: null },
  ]);
});

// ── GET /api/news/video-categories ─────────────────────────────────
router.get('/video-categories', (req, res) => {
  res.json(Object.entries(VIDEO_CATEGORIES).map(([id, v]) => ({ id, label: v.label })));
});

// ── GET /api/news/videos — Fetch videos by category ────────────────
router.get('/videos', async (req, res) => {
  const { category, region } = req.query;
  const cat = category || 'entertainment';
  const reg = region || 'wt-wt';
  const countryName = REGIONS[reg] || 'World';
  const catDef = VIDEO_CATEGORIES[cat] || VIDEO_CATEGORIES.entertainment;

  // Check cache (15 min)
  const cacheKey = `videos:${cat}:${reg}`;
  const cached = db.prepare(`SELECT data, fetched_at FROM news_cache WHERE category = ? AND datetime(fetched_at, '+15 minutes') > datetime('now')`).get(cacheKey);
  if (cached) {
    try { return res.json(JSON.parse(cached.data)); } catch {}
  }

  try {
    // Fetch videos from multiple queries in parallel
    const queries = catDef.queries.map(q => reg !== 'wt-wt' ? `${q} ${countryName}` : q);
    const allResults = await Promise.all(
      queries.map(q => fetchDDGVideos(q, 15, reg).catch(() => []))
    );

    // Merge, dedupe by URL, prioritize YouTube
    const seen = new Set();
    let videos = [];
    for (const batch of allResults) {
      for (const v of batch) {
        const key = v.youtubeId || v.url;
        if (!seen.has(key) && key) {
          seen.add(key);
          videos.push(v);
        }
      }
    }

    // Filter out old videos — only keep those published within the last 30 days
    // Always keep live streams regardless of date
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const isLiveTitle = (t) => /\blive\b/i.test(t);
    videos = videos.filter(v => {
      if (isLiveTitle(v.title)) return true; // always keep live streams
      if (!v.published) return true; // keep if no date (could be live/recent)
      const pubDate = new Date(v.published).getTime();
      return !isNaN(pubDate) && pubDate >= thirtyDaysAgo;
    });

    // Sort: live streams first, then newest, then YouTube priority
    videos.sort((a, b) => {
      const aLive = isLiveTitle(a.title) ? 1 : 0;
      const bLive = isLiveTitle(b.title) ? 1 : 0;
      if (aLive !== bLive) return bLive - aLive; // live first
      const dateA = a.published ? new Date(a.published).getTime() : Date.now();
      const dateB = b.published ? new Date(b.published).getTime() : Date.now();
      if (Math.abs(dateA - dateB) > 86400000) return dateB - dateA; // >1 day apart: newest first
      if (a.isYouTube && !b.isYouTube) return -1;
      if (!a.isYouTube && b.isYouTube) return 1;
      return dateB - dateA;
    });

    const result = {
      category: cat,
      categoryLabel: catDef.label,
      region: reg,
      countryName,
      videos: videos.slice(0, 30),
      totalVideos: videos.length,
      lastUpdated: new Date().toISOString(),
    };

    // Cache result
    db.prepare(`INSERT OR REPLACE INTO news_cache (category, data, fetched_at) VALUES (?, ?, datetime('now'))`).run(cacheKey, JSON.stringify(result));

    res.json(result);
  } catch (err) {
    console.error('Video fetch error:', err);
    // Try stale cache
    const stale = db.prepare(`SELECT data FROM news_cache WHERE category = ?`).get(cacheKey);
    if (stale) {
      try {
        const data = JSON.parse(stale.data);
        data.stale = true;
        return res.json(data);
      } catch {}
    }
    res.status(500).json({ error: err.message || 'Failed to fetch videos' });
  }
});

// ── POST /api/news/refresh — Force refresh a category ──────────────
router.post('/refresh', optionalAuth, async (req, res) => {
  const { category, region } = req.body;
  const cat = category || 'top';
  const reg = region || 'wt-wt';
  const cacheKey = `${cat}:${reg}`;
  try {
    // Clear cache for this category+region
    db.prepare(`DELETE FROM news_cache WHERE category = ?`).run(cacheKey);
    
    const feed = await generateNewsFeed(cat, reg);
    db.prepare(
      `INSERT OR REPLACE INTO news_cache (category, data, fetched_at) VALUES (?, ?, datetime('now'))`
    ).run(cacheKey, JSON.stringify(feed));

    res.json(feed);
  } catch (err) {
    console.error('News refresh error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Core: Generate news feed using DDG + Ollama ────────────────────
async function generateNewsFeed(category, region = 'wt-wt') {
  const countryName = REGIONS[region] || 'World';
  const CATEGORIES = {
    top: `top breaking news today ${countryName}`,
    world: 'world news international today',
    tech: `technology AI software hardware news today ${countryName}`,
    business: `business finance stock market economy news today ${countryName}`,
    sports: `sports results today ${countryName}`,
    entertainment: `entertainment movies celebrity music news today ${countryName}`,
    science: 'science space research discovery news today',
    health: `health medical wellness news today ${countryName}`,
  };

  const searchQuery = CATEGORIES[category] || CATEGORIES.top;
  const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Step 1: Fetch raw news from DuckDuckGo
  let rawNews = [];
  try {
    rawNews = await fetchDDGNews(searchQuery, 20, region, 'd');
  } catch (err) {
    console.error('DDG news fetch error:', err.message);
  }

  // Step 2: Also fetch news images
  let newsImages = [];
  try {
    newsImages = await fetchDDGImages(`${searchQuery} ${currentDate.split(',')[0]}`, 15, region);
  } catch (err) {
    console.error('DDG image fetch error:', err.message);
  }

  // Step 3: Build articles from DDG news results
  const articles = rawNews.map((item, i) => {
    // Try to match an image to this article
    const matchedImage = newsImages.find(img =>
      img.title && item.title &&
      (img.title.toLowerCase().includes(item.title.split(' ').slice(0, 3).join(' ').toLowerCase()) ||
       item.title.toLowerCase().includes(img.title.split(' ').slice(0, 3).join(' ').toLowerCase()))
    );

    return {
      id: `${category}-${Date.now()}-${i}`,
      title: item.title || 'Untitled',
      excerpt: item.excerpt || item.body || '',
      source: item.source || 'Unknown',
      url: item.url || '#',
      image: item.image || (matchedImage ? matchedImage.image || matchedImage.thumbnail : null),
      timestamp: item.date ? Math.floor(new Date(item.date * 1000 || item.date).getTime() / 1000) : Math.floor(Date.now() / 1000),
      timeAgo: item.date ? timeAgo(typeof item.date === 'number' ? item.date : Math.floor(new Date(item.date).getTime() / 1000)) : 'recently',
      category,
      featured: i === 0,
    };
  });

  // Step 4: For articles without images, try to get images
  const noImageArticles = articles.filter(a => !a.image);
  if (noImageArticles.length > 0 && newsImages.length > 0) {
    let imgIdx = 0;
    for (const article of noImageArticles) {
      if (imgIdx < newsImages.length) {
        article.image = newsImages[imgIdx].image || newsImages[imgIdx].thumbnail;
        imgIdx++;
      }
    }
  }

  // Step 5: Try Ollama for quick analysis/categorization (optional enhancement)
  let aiSummary = '';
  try {
    const titles = articles.slice(0, 8).map(a => a.title).join('\n');
    const ollamaPrompt = `Today is ${currentDate}. Here are the top news headlines:\n\n${titles}\n\nWrite a single SHORT sentence (max 15 words) summarizing the main theme of today's news. Just the sentence, nothing else:`;
    aiSummary = await callOllama(process.env.OLLAMA_MODEL || 'gemma4:31b-cloud', ollamaPrompt);
    aiSummary = aiSummary.replace(/^["']|["']$/g, '').trim();
    if (aiSummary.length > 150) aiSummary = aiSummary.slice(0, 150) + '...';
  } catch (err) {
    console.error('Ollama summary error (non-critical):', err.message);
    aiSummary = `Latest ${category === 'top' ? '' : category + ' '}news from ${countryName}`;
  }

  return {
    category,
    region,
    countryName,
    articles,
    aiSummary,
    lastUpdated: new Date().toISOString(),
    totalArticles: articles.length,
  };
}

// ── Helper: DuckDuckGo web search (text results) ───────────────────
async function fetchDDGWeb(query, count = 15) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  // Use DuckDuckGo HTML lite for web results
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`DDG web search failed (${res.status})`);
  const html = await res.text();

  // Parse results — DDG lite uses redirect URLs: //duckduckgo.com/l/?uddg=<encoded_url>
  const results = [];
  const snippetRegex = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;

  // Match result-link anchors (class="result-link") — href is a DDG redirect
  const linkRegex = /<a[^>]+class="result-link"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null && results.length < count) {
    let href = match[1];
    const title = match[2].replace(/<[^>]+>/g, '').trim();
    // Extract real URL from DDG redirect
    const uddgMatch = href.match(/uddg=([^&]+)/);
    if (uddgMatch) {
      href = decodeURIComponent(uddgMatch[1]);
    }
    if (href && title && href.startsWith('http')) {
      results.push({ url: href, title });
    }
  }

  // Fallback: match nofollow anchors
  if (results.length === 0) {
    const nfRegex = /<a[^>]+rel="nofollow"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    while ((match = nfRegex.exec(html)) !== null && results.length < count) {
      let href = match[1];
      const title = match[2].replace(/<[^>]+>/g, '').trim();
      const uddgMatch = href.match(/uddg=([^&]+)/);
      if (uddgMatch) {
        href = decodeURIComponent(uddgMatch[1]);
      }
      if (href && title && href.startsWith('http') && !href.includes('duckduckgo.com') && title.length > 5) {
        results.push({ url: href, title });
      }
    }
  }

  // Get snippets
  const snippets = [];
  let sMatch;
  while ((sMatch = snippetRegex.exec(html)) !== null) {
    snippets.push(sMatch[1].replace(/<[^>]+>/g, '').trim());
  }

  return results.map((r, i) => ({
    ...r,
    snippet: snippets[i] || '',
    source: new URL(r.url).hostname.replace('www.', ''),
    type: 'web',
  }));
}

// ── POST /api/news/search — Web search with results + images ───────
router.post('/search', optionalAuth, async (req, res) => {
  const { query, type, region } = req.body;
  if (!query || query.trim().length < 2) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  const q = query.trim();
  const reg = region || 'wt-wt';
  const searchType = type || 'all'; // 'all', 'news', 'web', 'images'

  try {
    const results = { query: q, type: searchType, webResults: [], newsResults: [], imageResults: [] };

    // Fetch in parallel based on type
    const promises = [];

    if (searchType === 'all' || searchType === 'web') {
      promises.push(
        fetchDDGWeb(q, 12)
          .then(r => { results.webResults = r; })
          .catch(err => { console.error('Web search error:', err.message); })
      );
    }

    if (searchType === 'all' || searchType === 'news') {
      promises.push(
        fetchDDGNews(q, 12, reg)
          .then(r => {
            results.newsResults = r.map((item, i) => ({
              id: `search-news-${i}`,
              title: item.title || '',
              excerpt: item.excerpt || item.body || '',
              source: item.source || 'Unknown',
              url: item.url || '#',
              image: item.image || null,
              timeAgo: item.date ? timeAgo(typeof item.date === 'number' ? item.date : Math.floor(new Date(item.date).getTime() / 1000)) : '',
              type: 'news',
            }));
          })
          .catch(err => { console.error('News search error:', err.message); })
      );
    }

    if (searchType === 'all' || searchType === 'images') {
      promises.push(
        fetchDDGImages(q, 20, reg)
          .then(r => {
            results.imageResults = r.map(img => ({
              url: img.image,
              thumb: img.thumbnail,
              title: img.title || q,
              source: img.source || new URL(img.url || img.image).hostname.replace('www.', ''),
              sourceUrl: img.url || img.image,
              width: img.width || 800,
              height: img.height || 600,
              type: 'image',
            }));
          })
          .catch(err => { console.error('Image search error:', err.message); })
      );
    }

    await Promise.all(promises);

    // Build external search links
    results.externalLinks = [
      { name: 'Google', icon: '🔍', url: `https://www.google.com/search?q=${encodeURIComponent(q)}` },
      { name: 'Google News', icon: '📰', url: `https://news.google.com/search?q=${encodeURIComponent(q)}` },
      { name: 'Google Images', icon: '🖼️', url: `https://www.google.com/search?q=${encodeURIComponent(q)}&tbm=isch` },
      { name: 'Bing', icon: '🌐', url: `https://www.bing.com/search?q=${encodeURIComponent(q)}` },
      { name: 'Bing News', icon: '📋', url: `https://www.bing.com/news/search?q=${encodeURIComponent(q)}` },
      { name: 'MSN', icon: '📡', url: `https://www.msn.com/en-us/search?q=${encodeURIComponent(q)}` },
      { name: 'DuckDuckGo', icon: '🦆', url: `https://duckduckgo.com/?q=${encodeURIComponent(q)}` },
      { name: 'YouTube', icon: '▶️', url: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}` },
    ];

    res.json(results);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: err.message || 'Search failed' });
  }
});

module.exports = router;
