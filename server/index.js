const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Ensure uploads directories exist
const uploadsDir = path.join(__dirname, '..', 'uploads');
const thumbsDir = path.join(uploadsDir, 'thumbs');
const tryonDir = path.join(uploadsDir, 'tryon');
[uploadsDir, thumbsDir, tryonDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '50mb' }));

// Static files
app.use('/uploads', express.static(uploadsDir));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/photos', require('./routes/photos'));
app.use('/api/albums', require('./routes/albums'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/tryon', require('./routes/tryon'));
app.use('/api/agent', require('./routes/agent'));
app.use('/api/news', require('./routes/news'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const clientBuild = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientBuild));
  app.get('*', (req, res) => res.sendFile(path.join(clientBuild, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
