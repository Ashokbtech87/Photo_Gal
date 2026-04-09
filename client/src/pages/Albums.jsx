import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, FolderOpen, Image, Trash2, Pencil, Check, X, Lock, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { albumsApi } from '../api';

export default function Albums() {
  const { user } = useAuth();
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newVisibility, setNewVisibility] = useState('private');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  useEffect(() => {
    albumsApi.getAll()
      .then(setAlbums)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const album = await albumsApi.create({ title: newTitle, description: newDesc, visibility: newVisibility });
      setAlbums(prev => [{ ...album, photo_count: 0, cover_thumb: null, username: user.username, visibility: newVisibility }, ...prev]);
      setNewTitle('');
      setNewDesc('');
      setNewVisibility('private');
      setShowCreate(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this album? Photos will not be deleted.')) return;
    try {
      await albumsApi.delete(id);
      setAlbums(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  const startRename = (album) => {
    setEditingId(album.id);
    setEditTitle(album.title);
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const saveRename = async (id) => {
    if (!editTitle.trim()) return;
    try {
      await albumsApi.update(id, { title: editTitle.trim() });
      setAlbums(prev => prev.map(a => a.id === id ? { ...a, title: editTitle.trim() } : a));
      setEditingId(null);
      setEditTitle('');
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <motion.h1
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-3xl font-bold"
        >
          Albums
        </motion.h1>
        {user && (
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => setShowCreate(!showCreate)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> New Album
          </motion.button>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <motion.form
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          onSubmit={handleCreate}
          className="glass-strong rounded-2xl p-6 mb-8 space-y-4"
        >
          <input
            type="text"
            placeholder="Album title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="input-field"
            required
            autoFocus
          />
          <textarea
            placeholder="Description (optional)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            rows={2}
            className="input-field resize-none"
          />
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Visibility</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setNewVisibility('private')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                  newVisibility === 'private'
                    ? 'border-gray-500 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                    : 'border-gray-200 dark:border-gray-700 text-gray-400 hover:border-gray-300'
                }`}
              >
                <Lock className="w-4 h-4" /> Private
              </button>
              <button
                type="button"
                onClick={() => setNewVisibility('public')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                  newVisibility === 'public'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-400 hover:border-gray-300'
                }`}
              >
                <Globe className="w-4 h-4" /> Public
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={creating} className="btn-primary disabled:opacity-50">
              {creating ? 'Creating...' : 'Create Album'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </motion.form>
      )}

      {/* Albums grid */}
      {albums.length === 0 ? (
        <div className="text-center py-20">
          <FolderOpen className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-500 dark:text-gray-400">No albums yet</h3>
          <p className="text-gray-400 dark:text-gray-500 mt-2">Create an album to organize your photos</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {albums.map((album, index) => (
            <motion.div
              key={album.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="relative group"
            >
              <Link
                to={`/albums/${album.id}`}
                className="block relative overflow-hidden rounded-2xl bg-gray-100 dark:bg-gray-800 aspect-[4/3] shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                {album.cover_thumb ? (
                  <img
                    src={`/uploads/thumbs/${album.cover_thumb}`}
                    alt={album.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FolderOpen className="w-16 h-16 text-gray-300 dark:text-gray-600" />
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent">
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    {editingId === album.id ? (
                      <div className="flex items-center gap-2" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveRename(album.id); if (e.key === 'Escape') cancelRename(); }}
                          autoFocus
                          className="flex-1 px-3 py-1.5 bg-white/20 backdrop-blur-md border border-white/30 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                        />
                        <button onClick={() => saveRename(album.id)} className="p-1.5 rounded-full bg-green-500/80 hover:bg-green-500 text-white transition-colors">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={cancelRename} className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <h3 className="text-white font-bold text-lg">{album.title}</h3>
                    )}
                    {album.description && (
                      <p className="text-white/70 text-sm mt-1 line-clamp-2">{album.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-white/60 text-sm">
                      <span className="flex items-center gap-1">
                        <Image className="w-4 h-4" /> {album.photo_count} photos
                      </span>
                      <span>by {album.username}</span>
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                        album.visibility === 'public'
                          ? 'bg-emerald-500/30 text-emerald-200'
                          : 'bg-gray-500/30 text-gray-300'
                      }`}>
                        {album.visibility === 'public' ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        {album.visibility || 'private'}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>

              {user && user.id === album.user_id && (
                <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200">
                  <button
                    onClick={async (e) => {
                      e.preventDefault(); e.stopPropagation();
                      const newVis = album.visibility === 'public' ? 'private' : 'public';
                      try {
                        await albumsApi.update(album.id, { visibility: newVis });
                        setAlbums(prev => prev.map(a => a.id === album.id ? { ...a, visibility: newVis } : a));
                      } catch (err) { alert(err.message); }
                    }}
                    className={`p-2 rounded-full text-white transition-colors ${
                      album.visibility === 'public' ? 'bg-emerald-500/70 hover:bg-emerald-600' : 'bg-black/40 hover:bg-gray-500'
                    }`}
                    title={album.visibility === 'public' ? 'Make Private' : 'Make Public'}
                  >
                    {album.visibility === 'public' ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); startRename(album); }}
                    className="p-2 rounded-full bg-black/40 hover:bg-violet-500 text-white transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(album.id); }}
                    className="p-2 rounded-full bg-black/40 hover:bg-red-500 text-white transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
