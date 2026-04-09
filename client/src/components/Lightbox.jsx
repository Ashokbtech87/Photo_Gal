import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Download, Trash2, Tag, Calendar, Maximize2, FolderOpen, Check, Pencil } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { photosApi, albumsApi } from '../api';

export default function Lightbox({ photo, photos, onClose, onDelete, onNavigate, onUpdate }) {
  const { user } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [albums, setAlbums] = useState([]);
  const [selectedAlbum, setSelectedAlbum] = useState(photo.album_id || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(photo.title || '');
  const currentIndex = photos.findIndex(p => p.id === photo.id);

  useEffect(() => {
    setSelectedAlbum(photo.album_id || '');
    setSaved(false);
    setEditingTitle(false);
    setTitleDraft(photo.title || '');
  }, [photo.id, photo.album_id, photo.title]);

  useEffect(() => {
    if (showInfo && user) {
      albumsApi.getAll().then(setAlbums).catch(() => {});
    }
  }, [showInfo, user]);

  const handleAlbumChange = async (albumId) => {
    const newAlbumId = albumId === '' ? null : Number(albumId);
    setSelectedAlbum(albumId);
    setSaving(true);
    setSaved(false);
    try {
      await photosApi.update(photo.id, { album_id: newAlbumId });
      setSaved(true);
      if (onUpdate) onUpdate({ ...photo, album_id: newAlbumId });
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert(err.message);
      setSelectedAlbum(photo.album_id || '');
    } finally {
      setSaving(false);
    }
  };

  const saveTitle = async () => {
    if (!titleDraft.trim() || titleDraft.trim() === photo.title) {
      setEditingTitle(false);
      return;
    }
    try {
      await photosApi.update(photo.id, { title: titleDraft.trim() });
      if (onUpdate) onUpdate({ ...photo, title: titleDraft.trim() });
      setEditingTitle(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const goNext = useCallback(() => {
    if (currentIndex < photos.length - 1) {
      onNavigate(photos[currentIndex + 1]);
      setLoaded(false);
    }
  }, [currentIndex, photos, onNavigate]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      onNavigate(photos[currentIndex - 1]);
      setLoaded(false);
    }
  }, [currentIndex, photos, onNavigate]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose, goNext, goPrev]);

  const handleDelete = async () => {
    if (!confirm('Delete this photo?')) return;
    try {
      await photosApi.delete(photo.id);
      onDelete(photo.id);
      onClose();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = `/uploads/${photo.filename}`;
    a.download = photo.original_name || photo.filename;
    a.click();
  };

  const fullUrl = `/uploads/${photo.filename}`;
  const tags = Array.isArray(photo.tags) ? photo.tags : [];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
        onClick={onClose}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Top bar */}
        <div className="absolute top-4 left-4 right-16 z-10 flex items-center gap-2">
          <span className="text-white/70 text-sm">
            {currentIndex + 1} / {photos.length}
          </span>
          <div className="flex-1" />
          <button onClick={(e) => { e.stopPropagation(); handleDownload(); }} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
            <Download className="w-5 h-5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setShowInfo(!showInfo); }} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
            <Maximize2 className="w-5 h-5" />
          </button>
          {user && user.id === photo.user_id && (
            <button onClick={(e) => { e.stopPropagation(); handleDelete(); }} className="p-2 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-400 transition-colors">
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation arrows */}
        {currentIndex > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
        )}
        {currentIndex < photos.length - 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        )}

        {/* Image */}
        <motion.div
          key={photo.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.3 }}
          className="max-w-[90vw] max-h-[85vh] relative"
          onClick={(e) => e.stopPropagation()}
        >
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}
          <img
            src={fullUrl}
            alt={photo.title}
            onLoad={() => setLoaded(true)}
            className={`max-w-full max-h-[85vh] object-contain rounded-lg transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
        </motion.div>

        {/* Info panel */}
        <AnimatePresence>
          {showInfo && (
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className="absolute right-0 top-0 bottom-0 w-80 bg-gray-900/95 backdrop-blur-xl p-6 pt-16 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {user && user.id === photo.user_id ? (
                editingTitle ? (
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setEditingTitle(false); setTitleDraft(photo.title || ''); } }}
                      autoFocus
                      className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-600 rounded-lg text-white text-lg font-bold focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                    />
                    <button onClick={saveTitle} className="p-1.5 rounded-full bg-green-500/20 hover:bg-green-500/30 text-green-400 transition-colors">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => { setEditingTitle(false); setTitleDraft(photo.title || ''); }} className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-gray-400 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mb-2 group/ptitle">
                    <h2 className="text-xl font-bold text-white">{photo.title}</h2>
                    <button
                      onClick={() => setEditingTitle(true)}
                      className="p-1 rounded-full text-gray-500 hover:text-violet-400 hover:bg-violet-500/20 opacity-0 group-hover/ptitle:opacity-100 transition-all"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              ) : (
                <h2 className="text-xl font-bold text-white mb-2">{photo.title}</h2>
              )}
              {photo.description && (
                <p className="text-gray-400 text-sm mb-4">{photo.description}</p>
              )}

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-gray-400">
                  <Calendar className="w-4 h-4" />
                  {new Date(photo.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
                {photo.width && photo.height && (
                  <div className="text-gray-400">
                    {photo.width} × {photo.height} px
                  </div>
                )}
                {photo.size && (
                  <div className="text-gray-400">
                    {(photo.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                )}
                {tags.length > 0 && (
                  <div className="flex items-start gap-2">
                    <Tag className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((tag, i) => (
                        <span key={i} className="px-2 py-0.5 bg-violet-500/20 text-violet-300 rounded-full text-xs">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Album assignment */}
                {user && user.id === photo.user_id && (
                  <div className="pt-4 mt-4 border-t border-gray-700">
                    <label className="flex items-center gap-2 text-gray-300 text-sm font-medium mb-2">
                      <FolderOpen className="w-4 h-4" /> Album
                    </label>
                    <div className="relative">
                      <select
                        value={selectedAlbum}
                        onChange={(e) => handleAlbumChange(e.target.value)}
                        disabled={saving}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 disabled:opacity-50 appearance-none cursor-pointer"
                      >
                        <option value="">No album</option>
                        {albums.map(a => (
                          <option key={a.id} value={a.id}>{a.title}</option>
                        ))}
                      </select>
                      {saved && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute right-2 top-1/2 -translate-y-1/2"
                        >
                          <Check className="w-4 h-4 text-green-400" />
                        </motion.div>
                      )}
                    </div>
                    {saving && <p className="text-xs text-gray-500 mt-1">Saving...</p>}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom info */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center">
          <h3 className="text-white font-semibold">{photo.title}</h3>
          <p className="text-white/50 text-sm">by {photo.username}</p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
