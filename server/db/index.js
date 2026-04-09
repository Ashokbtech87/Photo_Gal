const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'gallery.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    avatar TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS albums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    cover_photo_id INTEGER DEFAULT NULL,
    visibility TEXT DEFAULT 'private',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    album_id INTEGER DEFAULT NULL,
    title TEXT NOT NULL DEFAULT 'Untitled',
    description TEXT DEFAULT '',
    filename TEXT NOT NULL,
    thumbnail TEXT NOT NULL,
    original_name TEXT NOT NULL,
    width INTEGER DEFAULT 0,
    height INTEGER DEFAULT 0,
    size INTEGER DEFAULT 0,
    tags TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_photos_user ON photos(user_id);
  CREATE INDEX IF NOT EXISTS idx_photos_album ON photos(album_id);
  CREATE INDEX IF NOT EXISTS idx_albums_user ON albums(user_id);

  CREATE TABLE IF NOT EXISTS user_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    ai_provider TEXT DEFAULT 'replicate',
    api_key TEXT DEFAULT '',
    custom_endpoint TEXT DEFAULT '',
    tryon_model TEXT DEFAULT 'cuuupid/idm-vton:c871bb9b046c1b1f6e867a07a816c7deaaac5975cc9cc767caa138f83e80baaf',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tryon_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    person_photo_id INTEGER,
    garment_photo_id INTEGER,
    result_filename TEXT NOT NULL,
    result_thumbnail TEXT NOT NULL,
    category TEXT DEFAULT 'upper_body',
    status TEXT DEFAULT 'completed',
    prompt TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (person_photo_id) REFERENCES photos(id) ON DELETE SET NULL,
    FOREIGN KEY (garment_photo_id) REFERENCES photos(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_tryon_user ON tryon_results(user_id);

  CREATE TABLE IF NOT EXISTS news_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT UNIQUE NOT NULL,
    data TEXT NOT NULL,
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration: add visibility column to albums if missing
try {
  db.prepare("SELECT visibility FROM albums LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE albums ADD COLUMN visibility TEXT DEFAULT 'private'");
}

// Migration: add gradio_fn_name column to user_settings if missing
try {
  db.prepare("SELECT gradio_fn_name FROM user_settings LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE user_settings ADD COLUMN gradio_fn_name TEXT DEFAULT ''");
}

module.exports = db;
