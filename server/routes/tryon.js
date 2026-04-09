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
const tryonDir = path.join(uploadsDir, 'tryon');
[tryonDir].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// Helper: convert local image to base64 data URI
function imageToDataUri(filePath) {
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

// Helper: download image from URL and save locally
async function downloadImage(url, destPath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download result image: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
  return buffer;
}

// Generate virtual try-on
router.post('/generate', authMiddleware, async (req, res) => {
  const { person_photo_id, garment_photo_id, category, prompt } = req.body;

  if (!person_photo_id || !garment_photo_id) {
    return res.status(400).json({ error: 'Person and garment photos are required' });
  }

  // Get user settings
  const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.user.id);
  if (!settings || !settings.api_key) {
    return res.status(400).json({ error: 'Please configure your AI API key in Settings first' });
  }

  // Get photo records
  const personPhoto = db.prepare('SELECT * FROM photos WHERE id = ?').get(person_photo_id);
  const garmentPhoto = db.prepare('SELECT * FROM photos WHERE id = ?').get(garment_photo_id);
  if (!personPhoto || !garmentPhoto) {
    return res.status(404).json({ error: 'Photo not found' });
  }

  const personPath = path.join(uploadsDir, personPhoto.filename);
  const garmentPath = path.join(uploadsDir, garmentPhoto.filename);
  if (!fs.existsSync(personPath) || !fs.existsSync(garmentPath)) {
    return res.status(404).json({ error: 'Image file not found on disk' });
  }

  try {
    let resultUrl;

    if (settings.ai_provider === 'replicate') {
      resultUrl = await runReplicateTryOn(settings, personPath, garmentPath, category || 'upper_body', prompt || '');
    } else if (settings.ai_provider === 'gradio') {
      resultUrl = await runGradioTryOn(settings, personPath, garmentPath, category || 'upper_body', prompt || '');
    } else if (settings.ai_provider === 'custom') {
      resultUrl = await runCustomTryOn(settings, personPath, garmentPath, category || 'upper_body', prompt || '');
    } else {
      return res.status(400).json({ error: 'Unknown AI provider' });
    }

    // Download & save result
    const resultFilename = `tryon_${uuidv4()}.jpg`;
    const resultPath = path.join(tryonDir, resultFilename);
    await downloadImage(resultUrl, resultPath);

    // Generate thumbnail
    const thumbFilename = `tryon_thumb_${uuidv4()}.jpg`;
    const thumbPath = path.join(thumbsDir, thumbFilename);
    await sharp(resultPath)
      .resize(600, null, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toFile(thumbPath);

    // Save to DB
    const result = db.prepare(`
      INSERT INTO tryon_results (user_id, person_photo_id, garment_photo_id, result_filename, result_thumbnail, category, prompt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, person_photo_id, garment_photo_id, resultFilename, thumbFilename, category || 'upper_body', prompt || '');

    res.json({
      id: result.lastInsertRowid,
      result_filename: resultFilename,
      result_thumbnail: thumbFilename,
      category,
      status: 'completed'
    });
  } catch (err) {
    console.error('Try-on error:', err);
    res.status(500).json({ error: err.message || 'Virtual try-on failed' });
  }
});

// Replicate API integration (IDM-VTON / similar models)
async function runReplicateTryOn(settings, personPath, garmentPath, category, prompt) {
  const model = settings.tryon_model || 'cuuupid/idm-vton:c871bb9b046c1b1f6e867a07a816c7deaaac5975cc9cc767caa138f83e80baaf';

  const personUri = imageToDataUri(personPath);
  const garmentUri = imageToDataUri(garmentPath);

  // Create prediction
  const createRes = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${settings.api_key}`,
      'Content-Type': 'application/json',
      'Prefer': 'wait'
    },
    body: JSON.stringify({
      version: model.includes(':') ? model.split(':')[1] : model,
      input: {
        human_img: personUri,
        garm_img: garmentUri,
        garment_des: prompt || 'A clothing item',
        category: category,
        is_checked: true,
        is_checked_crop: false,
        denoise_steps: 30,
        seed: 42
      }
    })
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err.detail || err.title || `Replicate API error (${createRes.status})`);
  }

  let prediction = await createRes.json();

  // Poll if not using Prefer: wait or still processing
  let attempts = 0;
  while (prediction.status === 'starting' || prediction.status === 'processing') {
    if (attempts++ > 120) throw new Error('Try-on timed out (>2 min)');
    await new Promise(r => setTimeout(r, 2000));
    const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { 'Authorization': `Bearer ${settings.api_key}` }
    });
    prediction = await pollRes.json();
  }

  if (prediction.status === 'failed') {
    throw new Error(prediction.error || 'Try-on generation failed');
  }

  // Output can be a string URL or array of URLs
  const output = prediction.output;
  if (Array.isArray(output)) return output[0];
  if (typeof output === 'string') return output;
  throw new Error('Unexpected output format from API');
}

// Custom endpoint integration
async function runCustomTryOn(settings, personPath, garmentPath, category, prompt) {
  if (!settings.custom_endpoint) throw new Error('Custom API endpoint not configured');

  const personUri = imageToDataUri(personPath);
  const garmentUri = imageToDataUri(garmentPath);

  const response = await fetch(settings.custom_endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${settings.api_key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      person_image: personUri,
      garment_image: garmentUri,
      category,
      prompt
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Custom API error (${response.status})`);
  }

  const data = await response.json();
  return data.result_url || data.output || data.url || data.image;
}

// Gradio / Hugging Face Spaces integration
async function runGradioTryOn(settings, personPath, garmentPath, category, prompt) {
  if (!settings.custom_endpoint) throw new Error('Gradio Space URL not configured');

  // Normalize the base URL (remove trailing slashes)
  let baseUrl = settings.custom_endpoint.replace(/\/+$/, '');

  // If it's a HF space short name (e.g. "yisol/IDM-VTON"), convert to full URL
  if (!baseUrl.startsWith('http')) {
    baseUrl = `https://${baseUrl.replace('/', '-').toLowerCase()}.hf.space`;
  }

  const personUri = imageToDataUri(personPath);
  const garmentUri = imageToDataUri(garmentPath);

  // Determine the function endpoint name
  const fnName = settings.gradio_fn_name || '/tryon';
  const apiPath = fnName.startsWith('/') ? fnName : `/${fnName}`;

  // Build headers
  const headers = { 'Content-Type': 'application/json' };
  if (settings.api_key) {
    headers['Authorization'] = `Bearer ${settings.api_key}`;
  }

  // First, try the Gradio /api/predict or /run/<fn> format
  // Gradio apps typically accept: { data: [...args] }
  const gradioPayload = {
    data: [personUri, garmentUri, prompt || 'A clothing item', category]
  };

  // Try /api/<fn_name> first (newer Gradio format)
  let response = await fetch(`${baseUrl}/api${apiPath}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(gradioPayload)
  });

  // Fallback to /run/<fn_name> (older Gradio format)
  if (!response.ok && response.status === 404) {
    response = await fetch(`${baseUrl}/run${apiPath}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(gradioPayload)
    });
  }

  // Fallback to /api/predict
  if (!response.ok && response.status === 404) {
    response = await fetch(`${baseUrl}/api/predict`, {
      method: 'POST',
      headers,
      body: JSON.stringify(gradioPayload)
    });
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Gradio API error (${response.status}): ${errText.slice(0, 200)}`);
  }

  const data = await response.json();

  // Gradio returns { data: [...] } — extract the result image
  const results = data.data || data;
  for (const item of (Array.isArray(results) ? results : [results])) {
    // Could be a URL string
    if (typeof item === 'string' && (item.startsWith('http') || item.startsWith('data:image'))) {
      return item;
    }
    // Could be a Gradio file object { url: '...', path: '...' }
    if (item && typeof item === 'object') {
      if (item.url) return item.url.startsWith('http') ? item.url : `${baseUrl}/file=${item.url}`;
      if (item.path) return `${baseUrl}/file=${item.path}`;
      if (item.name) return `${baseUrl}/file=${item.name}`;
      // Handle base64 in object
      if (item.data && typeof item.data === 'string') return item.data;
    }
  }

  throw new Error('Could not extract result image from Gradio response');
}

// Get try-on results
router.get('/results', authMiddleware, (req, res) => {
  const results = db.prepare(`
    SELECT t.*,
      p1.title as person_title, p1.thumbnail as person_thumb,
      p2.title as garment_title, p2.thumbnail as garment_thumb
    FROM tryon_results t
    LEFT JOIN photos p1 ON t.person_photo_id = p1.id
    LEFT JOIN photos p2 ON t.garment_photo_id = p2.id
    WHERE t.user_id = ?
    ORDER BY t.created_at DESC
  `).all(req.user.id);

  res.json(results);
});

// Delete try-on result
router.delete('/results/:id', authMiddleware, (req, res) => {
  const result = db.prepare('SELECT * FROM tryon_results WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!result) return res.status(404).json({ error: 'Result not found' });

  // Clean files
  const resultPath = path.join(tryonDir, result.result_filename);
  const thumbPath = path.join(thumbsDir, result.result_thumbnail);
  [resultPath, thumbPath].forEach(p => { if (fs.existsSync(p)) fs.unlinkSync(p); });

  db.prepare('DELETE FROM tryon_results WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

// Save try-on result to gallery as a regular photo
router.post('/results/:id/save', authMiddleware, async (req, res) => {
  const result = db.prepare('SELECT * FROM tryon_results WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!result) return res.status(404).json({ error: 'Result not found' });

  const { album_id, title } = req.body;
  const srcPath = path.join(tryonDir, result.result_filename);
  if (!fs.existsSync(srcPath)) return res.status(404).json({ error: 'Result file not found' });

  // Copy to uploads
  const newFilename = `${uuidv4()}.jpg`;
  const destPath = path.join(uploadsDir, newFilename);
  fs.copyFileSync(srcPath, destPath);

  // Thumbnail
  const thumbName = `thumb_${newFilename}`;
  const thumbPath = path.join(thumbsDir, thumbName);
  const metadata = await sharp(destPath).metadata();
  await sharp(destPath).resize(600, null, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(thumbPath);

  // Blur placeholder
  const blurName = `blur_${path.parse(newFilename).name}.jpg`;
  await sharp(destPath).resize(30, null, { fit: 'inside' }).blur(2).jpeg({ quality: 30 }).toFile(path.join(thumbsDir, blurName));

  const insert = db.prepare(`
    INSERT INTO photos (user_id, album_id, title, description, filename, thumbnail, original_name, width, height, size, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.user.id,
    album_id || null,
    title || 'Virtual Try-On Result',
    'Generated by AI Virtual Try-On',
    newFilename, thumbName, `tryon_${result.id}.jpg`,
    metadata.width || 0, metadata.height || 0,
    fs.statSync(destPath).size,
    JSON.stringify(['ai-generated', 'virtual-tryon'])
  );

  res.json({ id: insert.lastInsertRowid, filename: newFilename, thumbnail: thumbName });
});

module.exports = router;
