const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  }
});

// ── Magic byte validation — prevents fake file extensions ──────────
const MAGIC_BYTES = {
  'ffd8ff':   'image/jpeg',          // JPEG
  '89504e47': 'image/png',           // PNG
  '47494638': 'image/gif',           // GIF
  '52494646': 'image/webp',          // WEBP (RIFF header)
  '00000020': 'image/avif',          // AVIF (ftyp)
  '0000001c': 'image/avif',          // AVIF variant
};

function validateMagicBytes(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(8);
    fs.readSync(fd, buf, 0, 8, 0);
    fs.closeSync(fd);
    const hex = buf.toString('hex').toLowerCase();
    return Object.keys(MAGIC_BYTES).some(magic => hex.startsWith(magic));
  } catch {
    return false;
  }
}

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif'];
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedMime = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];

  if (!allowed.includes(ext)) {
    return cb(new Error('Only image files (jpg, png, gif, webp, avif) are allowed'));
  }
  if (!allowedMime.includes(file.mimetype)) {
    return cb(new Error('Invalid MIME type — only images allowed'));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB max per file
    files: 20,                   // Max 20 files per request
  }
});

// Post-upload validation middleware — checks magic bytes after file is saved
upload.validateFiles = (req, res, next) => {
  if (!req.files) return next();
  for (const file of req.files) {
    if (!validateMagicBytes(file.path)) {
      // Delete the fake file
      try { fs.unlinkSync(file.path); } catch {}
      return res.status(400).json({ error: `File "${file.originalname}" is not a valid image (content mismatch)` });
    }
  }
  next();
};

module.exports = upload;
