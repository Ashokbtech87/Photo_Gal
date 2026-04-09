const express = require('express');
const db = require('../db');
const { authMiddleware, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Create album
router.post('/', authMiddleware, (req, res) => {
  const { title, description, visibility } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  const vis = ['public', 'private'].includes(visibility) ? visibility : 'private';

  const result = db.prepare('INSERT INTO albums (user_id, title, description, visibility) VALUES (?, ?, ?, ?)').run(
    req.user.id, title, description || '', vis
  );

  res.status(201).json({ id: result.lastInsertRowid, title, description: description || '', visibility: vis });
});

// Get all albums
router.get('/', optionalAuth, (req, res) => {
  const albums = db.prepare(`
    SELECT a.*, u.username,
      (SELECT COUNT(*) FROM photos WHERE album_id = a.id) as photo_count,
      (SELECT thumbnail FROM photos WHERE album_id = a.id ORDER BY created_at DESC LIMIT 1) as cover_thumb
    FROM albums a
    JOIN users u ON a.user_id = u.id
    ORDER BY a.created_at DESC
  `).all();

  res.json(albums);
});

// Get single album with photos
router.get('/:id', optionalAuth, (req, res) => {
  const album = db.prepare(`
    SELECT a.*, u.username
    FROM albums a
    JOIN users u ON a.user_id = u.id
    WHERE a.id = ?
  `).get(req.params.id);

  if (!album) return res.status(404).json({ error: 'Album not found' });

  const photos = db.prepare(`
    SELECT p.*, u.username FROM photos p
    JOIN users u ON p.user_id = u.id
    WHERE p.album_id = ?
    ORDER BY p.created_at DESC
  `).all(req.params.id);

  res.json({ ...album, photos: photos.map(p => ({ ...p, tags: JSON.parse(p.tags || '[]') })) });
});

// Update album
router.put('/:id', authMiddleware, (req, res) => {
  const album = db.prepare('SELECT * FROM albums WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!album) return res.status(404).json({ error: 'Album not found or unauthorized' });

  const { title, description, visibility } = req.body;
  const vis = visibility && ['public', 'private'].includes(visibility) ? visibility : album.visibility;
  db.prepare('UPDATE albums SET title = ?, description = ?, visibility = ? WHERE id = ?').run(
    title ?? album.title, description ?? album.description, vis, req.params.id
  );

  res.json({ message: 'Album updated', visibility: vis });
});

// Delete album
router.delete('/:id', authMiddleware, (req, res) => {
  const album = db.prepare('SELECT * FROM albums WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!album) return res.status(404).json({ error: 'Album not found or unauthorized' });

  db.prepare('UPDATE photos SET album_id = NULL WHERE album_id = ?').run(req.params.id);
  db.prepare('DELETE FROM albums WHERE id = ?').run(req.params.id);

  res.json({ message: 'Album deleted' });
});

module.exports = router;
