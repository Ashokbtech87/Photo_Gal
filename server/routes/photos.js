const express = require('express');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const db = require('../db');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
const thumbsDir = path.join(uploadsDir, 'thumbs');

// Ensure thumbs directory exists
if (!fs.existsSync(thumbsDir)) {
  fs.mkdirSync(thumbsDir, { recursive: true });
}

// Upload photos (single or multiple)
router.post('/', authMiddleware, upload.array('photos', 20), upload.validateFiles, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const { title, description, album_id, tags } = req.body;
    const photos = [];

    for (const file of req.files) {
      // Generate thumbnail
      const thumbName = `thumb_${file.filename}`;
      const thumbPath = path.join(thumbsDir, thumbName);

      const metadata = await sharp(file.path).metadata();

      await sharp(file.path)
        .resize(600, null, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toFile(thumbPath);

      // Also create a blur placeholder (tiny, preserve ratio)
      const blurName = `blur_${path.parse(file.filename).name}.jpg`;
      const blurPath = path.join(thumbsDir, blurName);
      await sharp(file.path)
        .resize(30, null, { fit: 'inside' })
        .blur(2)
        .jpeg({ quality: 30 })
        .toFile(blurPath);

      const result = db.prepare(`
        INSERT INTO photos (user_id, album_id, title, description, filename, thumbnail, original_name, width, height, size, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        req.user.id,
        album_id || null,
        title || file.originalname.replace(/\.[^.]+$/, ''),
        description || '',
        file.filename,
        thumbName,
        file.originalname,
        metadata.width || 0,
        metadata.height || 0,
        file.size,
        JSON.stringify(tags ? (typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : tags) : [])
      );

      photos.push({
        id: result.lastInsertRowid,
        filename: file.filename,
        thumbnail: thumbName,
        title: title || file.originalname.replace(/\.[^.]+$/, ''),
        width: metadata.width,
        height: metadata.height
      });
    }

    res.status(201).json({ photos });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload photos' });
  }
});

// Get all photos (paginated)
router.get('/', optionalAuth, (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const search = req.query.search || '';
  const album_id = req.query.album_id;

  let query = `
    SELECT p.*, u.username 
    FROM photos p 
    JOIN users u ON p.user_id = u.id
  `;
  const params = [];
  const conditions = [];

  if (search) {
    conditions.push(`(p.title LIKE ? OR p.description LIKE ? OR p.tags LIKE ?)`);
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  if (album_id) {
    conditions.push('p.album_id = ?');
    params.push(album_id);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  const countQuery = query.replace('p.*, u.username', 'COUNT(*) as total');
  const total = db.prepare(countQuery).get(...params).total;

  query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const photos = db.prepare(query).all(...params);

  res.json({
    photos: photos.map(p => ({ ...p, tags: JSON.parse(p.tags || '[]') })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// Get single photo
router.get('/:id', optionalAuth, (req, res) => {
  const photo = db.prepare(`
    SELECT p.*, u.username 
    FROM photos p 
    JOIN users u ON p.user_id = u.id 
    WHERE p.id = ?
  `).get(req.params.id);

  if (!photo) return res.status(404).json({ error: 'Photo not found' });

  photo.tags = JSON.parse(photo.tags || '[]');
  res.json(photo);
});

// Update photo
router.put('/:id', authMiddleware, (req, res) => {
  const photo = db.prepare('SELECT * FROM photos WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!photo) return res.status(404).json({ error: 'Photo not found or unauthorized' });

  const { title, description, album_id, tags } = req.body;

  db.prepare(`
    UPDATE photos SET title = ?, description = ?, album_id = ?, tags = ? WHERE id = ?
  `).run(
    title ?? photo.title,
    description ?? photo.description,
    album_id !== undefined ? album_id : photo.album_id,
    tags ? JSON.stringify(tags) : photo.tags,
    req.params.id
  );

  res.json({ message: 'Photo updated' });
});

// Delete photo
router.delete('/:id', authMiddleware, (req, res) => {
  const photo = db.prepare('SELECT * FROM photos WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!photo) return res.status(404).json({ error: 'Photo not found or unauthorized' });

  // Delete files
  const filePath = path.join(uploadsDir, photo.filename);
  const thumbPath = path.join(thumbsDir, photo.thumbnail);
  const blurPath = path.join(thumbsDir, `blur_${path.parse(photo.filename).name}.jpg`);

  [filePath, thumbPath, blurPath].forEach(p => {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });

  db.prepare('DELETE FROM photos WHERE id = ?').run(req.params.id);
  res.json({ message: 'Photo deleted' });
});

// Bulk download as zip
router.post('/download', optionalAuth, (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No photo IDs provided' });
  }
  if (ids.length > 100) {
    return res.status(400).json({ error: 'Maximum 100 photos per download' });
  }

  const placeholders = ids.map(() => '?').join(',');
  const photos = db.prepare(`SELECT * FROM photos WHERE id IN (${placeholders})`).all(...ids);

  if (photos.length === 0) {
    return res.status(404).json({ error: 'No photos found' });
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="lumina-photos-${Date.now()}.zip"`);

  const archive = archiver('zip', { zlib: { level: 5 } });
  archive.on('error', (err) => res.status(500).json({ error: err.message }));
  archive.pipe(res);

  for (const photo of photos) {
    const filePath = path.join(uploadsDir, photo.filename);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(photo.filename);
      const safeName = photo.original_name || `${photo.title.replace(/[^a-zA-Z0-9_-]/g, '_')}${ext}`;
      archive.file(filePath, { name: safeName });
    }
  }

  archive.finalize();
});

module.exports = router;
