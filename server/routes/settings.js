const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Get user settings
router.get('/', authMiddleware, (req, res) => {
  let settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.user.id);
  if (!settings) {
    db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(req.user.id);
    settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.user.id);
  }
  // Mask API key for security
  const masked = settings.api_key
    ? settings.api_key.slice(0, 6) + '•'.repeat(Math.max(0, settings.api_key.length - 10)) + settings.api_key.slice(-4)
    : '';
  res.json({ ...settings, api_key_masked: masked, api_key: undefined });
});

// Update user settings
router.put('/', authMiddleware, (req, res) => {
  const { ai_provider, api_key, custom_endpoint, tryon_model, gradio_fn_name } = req.body;

  let settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.user.id);
  if (!settings) {
    db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(req.user.id);
    settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.user.id);
  }

  db.prepare(`
    UPDATE user_settings SET
      ai_provider = ?,
      api_key = ?,
      custom_endpoint = ?,
      tryon_model = ?,
      gradio_fn_name = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(
    ai_provider ?? settings.ai_provider,
    api_key !== undefined ? api_key : settings.api_key,
    custom_endpoint ?? settings.custom_endpoint,
    tryon_model ?? settings.tryon_model,
    gradio_fn_name ?? (settings.gradio_fn_name || ''),
    req.user.id
  );

  res.json({ message: 'Settings updated' });
});

// Verify API key by making a test call
router.post('/verify', authMiddleware, async (req, res) => {
  const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.user.id);
  if (!settings || !settings.api_key) {
    return res.status(400).json({ error: 'No API key configured' });
  }

  try {
    if (settings.ai_provider === 'replicate') {
      const response = await fetch('https://api.replicate.com/v1/account', {
        headers: { 'Authorization': `Bearer ${settings.api_key}` }
      });
      if (!response.ok) return res.status(401).json({ error: 'Invalid Replicate API key' });
      const data = await response.json();
      return res.json({ valid: true, username: data.username });
    }
    if (settings.ai_provider === 'gradio') {
      // Test Gradio connection by fetching the space info
      let baseUrl = (settings.custom_endpoint || '').replace(/\/+$/, '');
      if (!baseUrl) return res.status(400).json({ error: 'No Gradio Space URL configured' });
      if (!baseUrl.startsWith('http')) {
        baseUrl = `https://${baseUrl.replace('/', '-').toLowerCase()}.hf.space`;
      }
      const headers = {};
      if (settings.api_key) headers['Authorization'] = `Bearer ${settings.api_key}`;
      const response = await fetch(`${baseUrl}/info`, { headers });
      if (response.ok) {
        return res.json({ valid: true, message: `Connected to Gradio app at ${baseUrl}` });
      }
      // Fallback: try /api/info
      const response2 = await fetch(`${baseUrl}/api/info`, { headers });
      if (response2.ok) {
        return res.json({ valid: true, message: `Connected to Gradio app at ${baseUrl}` });
      }
      return res.json({ valid: true, message: 'Space URL saved (could not verify — may work at runtime)' });
    }
    res.json({ valid: true, message: 'Key saved (custom endpoint — not verified)' });
  } catch (err) {
    res.status(500).json({ error: 'Verification failed: ' + err.message });
  }
});

module.exports = router;
