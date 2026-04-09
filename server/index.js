const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Ensure uploads directories exist
const uploadsDir = path.join(__dirname, '..', 'uploads');
const thumbsDir = path.join(uploadsDir, 'thumbs');
const tryonDir = path.join(uploadsDir, 'tryon');
[uploadsDir, thumbsDir, tryonDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for correct IP behind reverse proxies (Render, Railway, etc.)
app.set('trust proxy', 1);

// Security headers (allow inline for Vite dev, relax in dev)
app.use(helmet({
  contentSecurityPolicy: false,    // SPA handles this
  crossOriginEmbedderPolicy: false // Allow YouTube embeds
}));

// Gzip compression — reduces bandwidth 60-80%
app.use(compression());

// ── Rate Limiters (free, in-memory) ────────────────────────────────
// General API: 100 req/min per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again in a minute' },
});

// Auth: 10 attempts/15min per IP (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, try again in 15 minutes' },
});

// Search/News: 30 req/min per IP (DuckDuckGo rate protection)
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Search rate limit reached, try again shortly' },
});

// Upload: 20 uploads/5min per IP
const uploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: { error: 'Upload limit reached, try again in a few minutes' },
});

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(null, true); // Allow all in dev; tighten in production
  },
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));

// Apply rate limiters
app.use('/api/auth', authLimiter);
app.use('/api/photos', uploadLimiter);
app.use('/api/news/search', searchLimiter);
app.use('/api/news/feed', searchLimiter);
app.use('/api/news/refresh', searchLimiter);
app.use('/api/news/videos', searchLimiter);
app.use('/api/agent', searchLimiter);
app.use('/api', apiLimiter);

// Static files — cache images for 7 days
app.use('/uploads', express.static(uploadsDir, {
  maxAge: '7d',
  etag: true,
  lastModified: true,
}));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/photos', require('./routes/photos'));
app.use('/api/albums', require('./routes/albums'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/tryon', require('./routes/tryon'));
app.use('/api/agent', require('./routes/agent'));
app.use('/api/news', require('./routes/news'));
app.use('/api/stats', require('./routes/stats'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const clientBuild = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientBuild, { maxAge: '1d' }));
  app.get('*', (req, res) => res.sendFile(path.join(clientBuild, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
