const express = require('express');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
const thumbsDir = path.join(uploadsDir, 'thumbs');

const OLLAMA_BASE = process.env.OLLAMA_URL || 'http://localhost:11434';

// ── Helper: call Ollama ────────────────────────────────────────────
async function callOllama(model, prompt, stream = false) {
  const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ollama error (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.response || '';
}

// ── Helper: search images via Pexels ───────────────────────────────
async function searchPexels(query, count, apiKey) {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`;
  const res = await fetch(url, { headers: { Authorization: apiKey } });
  if (!res.ok) throw new Error(`Pexels API error: ${res.status}`);
  const data = await res.json();
  return (data.photos || []).map(p => ({
    url: p.src.large2x || p.src.large || p.src.original,
    thumb: p.src.medium,
    title: p.alt || query,
    photographer: p.photographer,
    source: 'pexels',
    sourceUrl: p.url,
    width: p.width,
    height: p.height,
  }));
}

// ── Helper: search images via Unsplash ─────────────────────────────
async function searchUnsplash(query, count, apiKey) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${count}`;
  const res = await fetch(url, { headers: { Authorization: `Client-ID ${apiKey}` } });
  if (!res.ok) throw new Error(`Unsplash API error: ${res.status}`);
  const data = await res.json();
  return (data.results || []).map(p => ({
    url: p.urls.regular || p.urls.full,
    thumb: p.urls.small,
    title: p.description || p.alt_description || query,
    photographer: p.user?.name || 'Unknown',
    source: 'unsplash',
    sourceUrl: p.links.html,
    width: p.width,
    height: p.height,
  }));
}

// ── Helper: search images via web (DuckDuckGo - no API key needed) ──
async function searchWebFree(query, count, options = {}) {
  const num = Math.min(count, 30);
  const { recency } = options; // 'day', 'week', 'month' or null
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  // Step 1: Get vqd token from DuckDuckGo
  const tokenUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`;
  const tokenRes = await fetch(tokenUrl, { headers });
  if (!tokenRes.ok) throw new Error(`Web search failed (${tokenRes.status})`);
  const html = await tokenRes.text();
  const vqdMatch = html.match(/vqd=["']?([^"'&]+)/);
  if (!vqdMatch) throw new Error('Could not get search token');

  // Build time filter: time:d (day), time:w (week), time:m (month)
  let filterStr = ',,,';
  if (recency === 'day') filterStr = ',,,time:d';
  else if (recency === 'week') filterStr = ',,,time:w';
  else if (recency === 'month') filterStr = ',,,time:m';

  // Step 2: Fetch image results
  const imgUrl = `https://duckduckgo.com/i.js?l=wt-wt&o=json&q=${encodeURIComponent(query)}&vqd=${vqdMatch[1]}&f=${encodeURIComponent(filterStr)}&p=1`;
  const imgRes = await fetch(imgUrl, {
    headers: { ...headers, 'Referer': 'https://duckduckgo.com/' },
  });
  if (!imgRes.ok) throw new Error(`Image search failed (${imgRes.status})`);
  const data = await imgRes.json();

  return (data.results || []).slice(0, num).map(r => ({
    url: r.image,
    thumb: r.thumbnail,
    title: r.title || query,
    photographer: new URL(r.url || r.image).hostname.replace('www.', ''),
    source: 'web',
    sourceUrl: r.url || r.image,
    width: r.width || 1024,
    height: r.height || 768,
  }));
}

// ── Helper: search images via Google Custom Search ─────────────────
async function searchGoogle(query, count, apiKey, cx) {
  // Google CSE returns max 10 per request
  const perPage = Math.min(count, 10);
  const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&searchType=image&num=${perPage}&key=${apiKey}&cx=${cx}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google API error (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.items || []).map(item => ({
    url: item.link,
    thumb: item.image?.thumbnailLink || item.link,
    title: item.title || item.snippet || query,
    photographer: item.displayLink || 'Google',
    source: 'google',
    sourceUrl: item.image?.contextLink || item.link,
    width: item.image?.width || 1024,
    height: item.image?.height || 1024,
  }));
}

// ── Helper: download image to disk ─────────────────────────────────
async function downloadAndSave(imageUrl, userId, albumId, title, tags) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const ext = '.jpg';
  const filename = `${uuidv4()}${ext}`;
  const filePath = path.join(uploadsDir, filename);
  fs.writeFileSync(filePath, buffer);

  // Generate thumbnail
  const thumbName = `thumb_${filename}`;
  const thumbPath = path.join(thumbsDir, thumbName);
  const metadata = await sharp(filePath).metadata();
  await sharp(filePath)
    .resize(600, null, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toFile(thumbPath);

  // Blur placeholder
  const blurName = `blur_${path.parse(filename).name}.jpg`;
  await sharp(filePath)
    .resize(30, null, { fit: 'inside' })
    .blur(2)
    .jpeg({ quality: 30 })
    .toFile(path.join(thumbsDir, blurName));

  const result = db.prepare(`
    INSERT INTO photos (user_id, album_id, title, description, filename, thumbnail, original_name, width, height, size, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId, albumId || null,
    title, 'Downloaded by AI Agent',
    filename, thumbName, `${title}${ext}`,
    metadata.width || 0, metadata.height || 0,
    buffer.length,
    JSON.stringify(tags || [])
  );

  return {
    id: result.lastInsertRowid,
    filename, thumbnail: thumbName,
    title, width: metadata.width, height: metadata.height,
  };
}

// ── Helper: search/generate via custom API ─────────────────────────
async function callCustomApi({ endpoint, apiKey, mode, headers: extraHeaders, bodyTemplate, query, count }) {
  const hdrs = { 'Content-Type': 'application/json' };
  if (apiKey) hdrs['Authorization'] = `Bearer ${apiKey}`;
  
  // Parse custom headers
  if (extraHeaders) {
    try {
      const parsed = JSON.parse(extraHeaders);
      Object.assign(hdrs, parsed);
    } catch (e) { /* ignore bad JSON */ }
  }

  // Build request body
  let body;
  if (bodyTemplate) {
    try {
      const filled = bodyTemplate
        .replace(/\{\{query\}\}/g, query)
        .replace(/\{\{count\}\}/g, String(count));
      body = filled;
      // Validate it's valid JSON
      JSON.parse(filled);
    } catch (e) {
      body = JSON.stringify({ prompt: query, query, n: count, per_page: count });
    }
  } else {
    body = mode === 'generate'
      ? JSON.stringify({ prompt: query, n: count })
      : JSON.stringify({ query, per_page: count });
  }

  const res = await fetch(endpoint, { method: 'POST', headers: hdrs, body });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Custom API error (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = await res.json();

  // Attempt to extract images from various response formats
  return extractImagesFromResponse(data, query, mode);
}

function extractImagesFromResponse(data, query, mode) {
  const images = [];

  // OpenAI DALL-E format: { data: [{ url, revised_prompt }] }
  if (data.data && Array.isArray(data.data)) {
    for (const item of data.data) {
      const url = item.url || item.src || item.image_url || item.output;
      if (url) {
        images.push({
          url,
          thumb: url,
          title: item.revised_prompt || item.prompt || item.title || item.alt || query,
          photographer: item.author || item.artist || 'Custom API',
          source: 'custom',
          sourceUrl: url,
          width: item.width || 1024,
          height: item.height || 1024,
        });
      }
    }
  }

  // Stability / generic: { artifacts: [{ base64 }] } or { images: [...] } or { results: [...] }
  const arr = data.artifacts || data.images || data.results || data.photos || data.hits || data.output;
  if (Array.isArray(arr) && images.length === 0) {
    for (const item of arr) {
      // Could be a string URL or an object
      if (typeof item === 'string') {
        images.push({ url: item, thumb: item, title: query, photographer: 'Custom API', source: 'custom', sourceUrl: item, width: 1024, height: 1024 });
      } else {
        const url = item.url || item.src || item.image_url || item.link || item.webformatURL || item.largeImageURL ||
                    (item.urls && (item.urls.regular || item.urls.full)) ||
                    (item.src && typeof item.src === 'object' && (item.src.large || item.src.original));
        if (url) {
          images.push({
            url,
            thumb: item.thumb || item.thumbnail || item.previewURL || (item.urls && item.urls.small) || (item.src && typeof item.src === 'object' && item.src.medium) || url,
            title: item.title || item.alt || item.description || item.alt_description || query,
            photographer: item.photographer || item.user?.name || item.author || 'Custom API',
            source: 'custom',
            sourceUrl: item.pageURL || item.link || url,
            width: item.width || item.imageWidth || 1024,
            height: item.height || item.imageHeight || 1024,
          });
        }
      }
    }
  }

  // Single image response: { url: "..." } or { image: "..." } or { output: "..." }
  if (images.length === 0) {
    const singleUrl = data.url || data.image || data.output || data.image_url;
    if (singleUrl) {
      images.push({ url: singleUrl, thumb: singleUrl, title: query, photographer: 'Custom API', source: 'custom', sourceUrl: singleUrl, width: 1024, height: 1024 });
    }
  }

  return images;
}

// ── POST /api/agent/search — AI-powered image search ───────────────
router.post('/search', authMiddleware, async (req, res) => {
  const { prompt, model, image_provider, image_api_key, count,
          google_cx, custom_endpoint, custom_mode, custom_headers, custom_body_template } = req.body;

  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
  
  const provider = image_provider || 'pexels';
  const isCustom = provider === 'custom';
  
  if (!isCustom && provider !== 'google_web' && !image_api_key) {
    return res.status(400).json({ error: 'Image search API key is required. Configure it in Agent settings.' });
  }
  if (isCustom && !custom_endpoint) {
    return res.status(400).json({ error: 'Custom API endpoint is required.' });
  }

  const ollamaModel = model || 'gemma4:31b-cloud';
  const maxCount = Math.min(Math.max(1, parseInt(count) || 10), 30);

  try {
    // Detect if the prompt is about news, current events, or trending topics
    const newsKeywords = /\b(news|trending|current|latest|today|recent|breaking|headlines|update|happening|events?|politics|election)\b/i;
    const isNewsQuery = newsKeywords.test(prompt);
    const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Step 1: Ask Ollama to extract search queries from the user prompt
    const analysisPrompt = isNewsQuery
      ? `You are a current events image search assistant. Today's date is ${currentDate}.

The user wants to find images related to NEWS or CURRENT EVENTS. You MUST generate search queries about SPECIFIC real-world topics, people, or events that are likely trending right now (as of ${currentDate}).

IMPORTANT RULES:
- Do NOT generate generic queries like "breaking news", "trending news today", or "news headlines"
- Instead, generate queries about SPECIFIC current topics (e.g., specific political events, world leaders, sports results, tech launches, natural disasters, cultural events)
- Include names of real people, places, or specific events
- Each query should find actual news photos, not stock "breaking news" graphics
- Generate exactly ${maxCount <= 10 ? '3' : '5'} queries, each on a new line, no numbering, no quotes, no extra text

User request: "${prompt}"

Specific current event search queries:`
      : `You are an image search assistant. The user wants to find images. Based on their request below, generate exactly ${maxCount <= 10 ? '1 to 3' : '3 to 5'} concise image search queries (each on a new line, no numbering, no quotes, no extra text).

User request: "${prompt}"

Search queries:`;

    const rawQueries = await callOllama(ollamaModel, analysisPrompt);
    const queries = rawQueries
      .split('\n')
      .map(q => q.replace(/^\d+[\.\)\-]\s*/, '').replace(/^["']|["']$/g, '').trim())
      .filter(q => q.length > 2 && q.length < 120);

    if (queries.length === 0) {
      return res.status(400).json({ error: 'AI could not generate search queries. Try rephrasing your prompt.' });
    }

    // Step 2: Search images using the configured provider
    const perQuery = Math.ceil(maxCount / queries.length);
    let allImages = [];

    for (const query of queries) {
      try {
        let images;
        if (isCustom) {
          images = await callCustomApi({
            endpoint: custom_endpoint,
            apiKey: image_api_key,
            mode: custom_mode || 'search',
            headers: custom_headers,
            bodyTemplate: custom_body_template,
            query,
            count: perQuery,
          });
        } else if (provider === 'google_web') {
          images = await searchWebFree(query, perQuery, { recency: isNewsQuery ? 'week' : null });
        } else if (provider === 'google') {
          images = await searchGoogle(query, perQuery, image_api_key, google_cx);
        } else if (provider === 'unsplash') {
          images = await searchUnsplash(query, perQuery, image_api_key);
        } else {
          images = await searchPexels(query, perQuery, image_api_key);
        }
        allImages.push(...images.map(img => ({ ...img, searchQuery: query })));
      } catch (err) {
        console.error(`Search error for "${query}":`, err.message);
      }
    }

    // Deduplicate by URL and limit to requested count
    const seen = new Set();
    allImages = allImages.filter(img => {
      if (seen.has(img.url)) return false;
      seen.add(img.url);
      return true;
    }).slice(0, maxCount);

    res.json({
      queries,
      images: allImages,
      total: allImages.length,
    });
  } catch (err) {
    console.error('Agent search error:', err);
    res.status(500).json({ error: err.message || 'Agent search failed' });
  }
});

// ── POST /api/agent/download — Download selected images to album ───
router.post('/download', authMiddleware, async (req, res) => {
  const { images, album_id, new_album_title, new_album_desc, tags, visibility } = req.body;

  if (!images || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'No images selected' });
  }

  try {
    // Create album if needed
    let targetAlbumId = album_id || null;
    if (new_album_title) {
      const vis = ['public', 'private'].includes(visibility) ? visibility : 'private';
      const result = db.prepare('INSERT INTO albums (user_id, title, description, visibility) VALUES (?, ?, ?, ?)').run(
        req.user.id, new_album_title, new_album_desc || '', vis
      );
      targetAlbumId = result.lastInsertRowid;
    }

    if (!targetAlbumId) {
      return res.status(400).json({ error: 'An album is required. Select existing or create new.' });
    }

    const downloaded = [];
    const errors = [];

    for (const img of images) {
      try {
        const photo = await downloadAndSave(
          img.url,
          req.user.id,
          targetAlbumId,
          img.title || 'Downloaded Image',
          tags || ['ai-agent', 'downloaded']
        );
        downloaded.push(photo);
      } catch (err) {
        errors.push({ url: img.url, error: err.message });
      }
    }

    res.json({
      album_id: targetAlbumId,
      downloaded: downloaded.length,
      errors: errors.length,
      photos: downloaded,
      errorDetails: errors,
    });
  } catch (err) {
    console.error('Agent download error:', err);
    res.status(500).json({ error: err.message || 'Download failed' });
  }
});

// ── POST /api/agent/chat — General chat with Ollama ────────────────
router.post('/chat', authMiddleware, async (req, res) => {
  const { prompt, model } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  try {
    const response = await callOllama(model || 'gemma4:31b-cloud', prompt);
    res.json({ response });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/agent/models — List available Ollama models ───────────
router.get('/models', authMiddleware, async (req, res) => {
  try {
    const r = await fetch(`${OLLAMA_BASE}/api/tags`);
    if (!r.ok) throw new Error(`Ollama unreachable (${r.status})`);
    const data = await r.json();
    res.json({ models: (data.models || []).map(m => ({ name: m.name, size: m.size })) });
  } catch (err) {
    res.status(500).json({ error: 'Cannot connect to Ollama. Is it running on localhost:11434?' });
  }
});

module.exports = router;
