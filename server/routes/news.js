const express = require('express');
const db = require('../db');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();
const OLLAMA_BASE = process.env.OLLAMA_URL || 'http://localhost:11434';

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
async function fetchDDGNews(query, count = 10) {
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

  // Fetch news results
  const newsUrl = `https://duckduckgo.com/news.js?l=wt-wt&o=json&noamp=1&q=${encodeURIComponent(query)}&vqd=${vqdMatch[1]}&df=d`;
  const newsRes = await fetch(newsUrl, {
    headers: { ...headers, 'Referer': 'https://duckduckgo.com/' },
  });
  if (!newsRes.ok) throw new Error(`DDG news fetch failed (${newsRes.status})`);
  const data = await newsRes.json();
  return (data.results || []).slice(0, count);
}

// ── Helper: fetch news images from DuckDuckGo Images ───────────────
async function fetchDDGImages(query, count = 5) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  const tokenUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`;
  const tokenRes = await fetch(tokenUrl, { headers });
  if (!tokenRes.ok) return [];
  const html = await tokenRes.text();
  const vqdMatch = html.match(/vqd=["']?([^"'&]+)/);
  if (!vqdMatch) return [];

  const imgUrl = `https://duckduckgo.com/i.js?l=wt-wt&o=json&q=${encodeURIComponent(query)}&vqd=${vqdMatch[1]}&f=,,,time:d&p=1`;
  const imgRes = await fetch(imgUrl, {
    headers: { ...headers, 'Referer': 'https://duckduckgo.com/' },
  });
  if (!imgRes.ok) return [];
  const data = await imgRes.json();
  return (data.results || []).slice(0, count);
}

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

    // Check cache (10 minutes = 600 seconds)
    const cached = db.prepare(
      `SELECT * FROM news_cache WHERE category = ? AND fetched_at > datetime('now', '-10 minutes') ORDER BY fetched_at DESC LIMIT 1`
    ).get(category);

    if (cached) {
      return res.json(JSON.parse(cached.data));
    }

    // No cache — trigger a refresh
    const feed = await generateNewsFeed(category);
    
    // Cache the result
    db.prepare(
      `INSERT OR REPLACE INTO news_cache (category, data, fetched_at) VALUES (?, ?, datetime('now'))`
    ).run(category, JSON.stringify(feed));

    res.json(feed);
  } catch (err) {
    console.error('News feed error:', err);
    // Try to return stale cache on error
    const stale = db.prepare(
      `SELECT * FROM news_cache WHERE category = ? ORDER BY fetched_at DESC LIMIT 1`
    ).get(req.query.category || 'top');
    if (stale) {
      return res.json({ ...JSON.parse(stale.data), stale: true });
    }
    res.status(500).json({ error: err.message || 'Failed to fetch news' });
  }
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
  ]);
});

// ── POST /api/news/refresh — Force refresh a category ──────────────
router.post('/refresh', optionalAuth, async (req, res) => {
  const { category } = req.body;
  const cat = category || 'top';
  try {
    // Clear cache for this category
    db.prepare(`DELETE FROM news_cache WHERE category = ?`).run(cat);
    
    const feed = await generateNewsFeed(cat);
    db.prepare(
      `INSERT OR REPLACE INTO news_cache (category, data, fetched_at) VALUES (?, ?, datetime('now'))`
    ).run(cat, JSON.stringify(feed));

    res.json(feed);
  } catch (err) {
    console.error('News refresh error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Core: Generate news feed using DDG + Ollama ────────────────────
async function generateNewsFeed(category) {
  const CATEGORIES = {
    top: 'top breaking news today',
    world: 'world news international today',
    tech: 'technology AI software hardware news today',
    business: 'business finance stock market economy news today',
    sports: 'sports results cricket football NBA news today',
    entertainment: 'entertainment movies celebrity music news today',
    science: 'science space research discovery news today',
    health: 'health medical wellness news today',
  };

  const searchQuery = CATEGORIES[category] || CATEGORIES.top;
  const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Step 1: Fetch raw news from DuckDuckGo
  let rawNews = [];
  try {
    rawNews = await fetchDDGNews(searchQuery, 20);
  } catch (err) {
    console.error('DDG news fetch error:', err.message);
  }

  // Step 2: Also fetch news images
  let newsImages = [];
  try {
    newsImages = await fetchDDGImages(`${searchQuery} ${currentDate.split(',')[0]}`, 15);
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
    aiSummary = `Latest ${category === 'top' ? '' : category + ' '}news and updates`;
  }

  return {
    category,
    articles,
    aiSummary,
    lastUpdated: new Date().toISOString(),
    totalArticles: articles.length,
  };
}

module.exports = router;
