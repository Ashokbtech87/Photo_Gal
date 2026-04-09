import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Pencil, FolderOpen, Plus, Check, Image } from 'lucide-react';
import { albumsApi, photosApi } from '../api';

export default function BulkRenameModal({ photos, onClose, onComplete }) {
  const [baseName, setBaseName] = useState('');
  const [startNum, setStartNum] = useState(1);
  const [albums, setAlbums] = useState([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState('');
  const [albumMode, setAlbumMode] = useState('existing'); // 'existing' | 'new'
  const [newAlbumTitle, setNewAlbumTitle] = useState('');
  const [newAlbumDesc, setNewAlbumDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingAlbums, setLoadingAlbums] = useState(true);

  useEffect(() => {
    albumsApi.getAll()
      .then((data) => {
        setAlbums(data);
        if (data.length === 0) setAlbumMode('new');
      })
      .catch(console.error)
      .finally(() => setLoadingAlbums(false));
  }, []);

  const padLen = Math.max(3, String(photos.length + startNum - 1).length);

  const preview = useMemo(() => {
    if (!baseName.trim()) return [];
    return photos.map((p, i) => {
      const num = String(startNum + i).padStart(padLen, '0');
      const ext = (p.original_name || p.filename || '').replace(/^.*\./, '.');
      return { id: p.id, oldTitle: p.title, newTitle: `${baseName.trim()}_${num}`, ext };
    });
  }, [baseName, startNum, photos, padLen]);

  const isValid = baseName.trim() &&
    ((albumMode === 'existing' && selectedAlbumId) || (albumMode === 'new' && newAlbumTitle.trim()));

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      let albumId;
      if (albumMode === 'new') {
        const album = await albumsApi.create({ title: newAlbumTitle.trim(), description: newAlbumDesc.trim() });
        albumId = album.id;
      } else {
        albumId = Number(selectedAlbumId);
      }

      // Rename all photos and assign to album
      const updates = preview.map(p =>
        photosApi.update(p.id, { title: p.newTitle, album_id: albumId })
      );
      await Promise.all(updates);

      onComplete(preview.map(p => ({ id: p.id, title: p.newTitle })), albumId);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <Pencil className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Bulk Rename</h2>
              <p className="text-xs text-gray-500">{photos.length} photo{photos.length > 1 ? 's' : ''} selected</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Naming */}
          <div>
            <label className="block text-sm font-semibold mb-2">Base Name</label>
            <input
              type="text"
              value={baseName}
              onChange={(e) => setBaseName(e.target.value)}
              placeholder="e.g. vacation, wedding, nature"
              autoFocus
              className="input-field"
            />
            <div className="flex items-center gap-3 mt-2">
              <label className="text-xs text-gray-500">Start number:</label>
              <input
                type="number"
                min={1}
                value={startNum}
                onChange={(e) => setStartNum(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 px-2 py-1 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              />
            </div>
            {baseName.trim() && (
              <p className="text-xs text-gray-400 mt-2">
                Pattern: <span className="font-mono text-violet-500">{baseName.trim()}_{"0".repeat(padLen - 1)}1</span>,{" "}
                <span className="font-mono text-violet-500">{baseName.trim()}_{"0".repeat(padLen - 1)}2</span>, ...
              </p>
            )}
          </div>

          {/* Album selection — mandatory */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Assign to Album <span className="text-red-500">*</span>
            </label>

            {/* Mode tabs */}
            <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl mb-3">
              <button
                onClick={() => setAlbumMode('existing')}
                disabled={albums.length === 0}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  albumMode === 'existing'
                    ? 'bg-white dark:bg-gray-700 shadow-sm text-violet-600 dark:text-violet-400'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-40'
                }`}
              >
                <FolderOpen className="w-4 h-4" /> Existing
              </button>
              <button
                onClick={() => setAlbumMode('new')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  albumMode === 'new'
                    ? 'bg-white dark:bg-gray-700 shadow-sm text-violet-600 dark:text-violet-400'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Plus className="w-4 h-4" /> New Album
              </button>
            </div>

            {albumMode === 'existing' ? (
              loadingAlbums ? (
                <div className="flex justify-center py-4">
                  <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : albums.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-3">No albums yet. Create a new one above.</p>
              ) : (
                <select
                  value={selectedAlbumId}
                  onChange={(e) => setSelectedAlbumId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                >
                  <option value="">Select an album...</option>
                  {albums.map(a => (
                    <option key={a.id} value={a.id}>{a.title} ({a.photo_count} photos)</option>
                  ))}
                </select>
              )
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={newAlbumTitle}
                  onChange={(e) => setNewAlbumTitle(e.target.value)}
                  placeholder="Album title"
                  className="input-field"
                />
                <textarea
                  value={newAlbumDesc}
                  onChange={(e) => setNewAlbumDesc(e.target.value)}
                  placeholder="Description (optional)"
                  rows={2}
                  className="input-field resize-none"
                />
              </div>
            )}
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div>
              <label className="block text-sm font-semibold mb-2">Preview</label>
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 max-h-48 overflow-y-auto">
                {preview.slice(0, 20).map((p, i) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 px-3 py-2 text-xs ${
                      i > 0 ? 'border-t border-gray-100 dark:border-gray-700/50' : ''
                    }`}
                  >
                    <Image className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="text-gray-400 truncate flex-1">{p.oldTitle}</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-violet-600 dark:text-violet-400 font-mono font-medium truncate flex-1 text-right">
                      {p.newTitle}{p.ext}
                    </span>
                  </div>
                ))}
                {preview.length > 20 && (
                  <div className="px-3 py-2 text-xs text-gray-400 text-center border-t border-gray-100 dark:border-gray-700/50">
                    ... and {preview.length - 20} more
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
          <button onClick={onClose} className="btn-secondary text-sm !px-4 !py-2">Cancel</button>
          <button
            onClick={handleSave}
            disabled={!isValid || saving}
            className="btn-primary text-sm !px-5 !py-2 flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Renaming...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Rename {photos.length} Photo{photos.length > 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
