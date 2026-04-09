import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Image, Plus, X, Check, Minus, CheckSquare, Square, Trash2, FolderMinus, Upload, Download, Pencil, Lock, Globe } from 'lucide-react';
import MasonryGrid from '../components/MasonryGrid';
import Lightbox from '../components/Lightbox';
import BulkRenameModal from '../components/BulkRenameModal';
import { albumsApi, photosApi } from '../api';
import { useAuth } from '../context/AuthContext';

export default function AlbumView() {
  const { id } = useParams();
  const { user } = useAuth();
  const [album, setAlbum] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [allPhotos, setAllPhotos] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [quickUploading, setQuickUploading] = useState(false);
  const [showBulkRename, setShowBulkRename] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const quickUploadRef = useRef(null);

  useEffect(() => {
    albumsApi.getOne(id)
      .then(setAlbum)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const openPicker = async () => {
    setShowPicker(true);
    setPickerLoading(true);
    setSelectedIds(new Set());
    try {
      const data = await photosApi.getAll({ limit: 50 });
      setAllPhotos(data.photos);
    } catch (err) {
      console.error(err);
    } finally {
      setPickerLoading(false);
    }
  };

  const togglePhoto = (photoId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  };

  const handleAddPhotos = async () => {
    if (selectedIds.size === 0) return;
    setSaving(true);
    try {
      const promises = [...selectedIds].map(photoId =>
        photosApi.update(photoId, { album_id: Number(id) })
      );
      await Promise.all(promises);
      // Refresh album
      const updated = await albumsApi.getOne(id);
      setAlbum(updated);
      setShowPicker(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveFromAlbum = async (photoId) => {
    try {
      await photosApi.update(photoId, { album_id: null });
      setAlbum(prev => ({
        ...prev,
        photos: prev.photos.filter(p => p.id !== photoId)
      }));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = (photoId) => {
    setAlbum(prev => ({
      ...prev,
      photos: prev.photos.filter(p => p.id !== photoId)
    }));
  };

  const handleUpdate = (updatedPhoto) => {
    setAlbum(prev => ({
      ...prev,
      photos: prev.photos.map(p => p.id === updatedPhoto.id ? { ...p, ...updatedPhoto } : p)
    }));
  };

  const handleRenamePhoto = async (photoId, newTitle) => {
    try {
      await photosApi.update(photoId, { title: newTitle });
      setAlbum(prev => ({
        ...prev,
        photos: prev.photos.map(p => p.id === photoId ? { ...p, title: newTitle } : p)
      }));
    } catch (err) {
      alert(err.message);
    }
  };

  const handlePermanentDelete = async (photo) => {
    if (!confirm(`Permanently delete "${photo.title}"? This cannot be undone.`)) return;
    try {
      await photosApi.delete(photo.id);
      setAlbum(prev => ({
        ...prev,
        photos: prev.photos.filter(p => p.id !== photo.id)
      }));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRemove = async (photo) => {
    if (!confirm(`Remove "${photo.title}" from this album? The photo will not be deleted.`)) return;
    await handleRemoveFromAlbum(photo.id);
  };

  const isOwner = user && album && user.id === album.user_id;

  const toggleBulkSelect = (photoId) => {
    setBulkSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  };

  const bulkSelectAll = () => {
    if (album && bulkSelectedIds.size === album.photos.length) {
      setBulkSelectedIds(new Set());
    } else if (album) {
      setBulkSelectedIds(new Set(album.photos.map(p => p.id)));
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setBulkSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (bulkSelectedIds.size === 0) return;
    if (!confirm(`Permanently delete ${bulkSelectedIds.size} photo${bulkSelectedIds.size > 1 ? 's' : ''}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      await Promise.all([...bulkSelectedIds].map(pid => photosApi.delete(pid)));
      setAlbum(prev => ({ ...prev, photos: prev.photos.filter(p => !bulkSelectedIds.has(p.id)) }));
      exitSelectMode();
    } catch (err) {
      alert(err.message);
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleBulkRemove = async () => {
    if (bulkSelectedIds.size === 0) return;
    if (!confirm(`Remove ${bulkSelectedIds.size} photo${bulkSelectedIds.size > 1 ? 's' : ''} from this album?`)) return;
    setBulkDeleting(true);
    try {
      await Promise.all([...bulkSelectedIds].map(pid => photosApi.update(pid, { album_id: null })));
      setAlbum(prev => ({ ...prev, photos: prev.photos.filter(p => !bulkSelectedIds.has(p.id)) }));
      exitSelectMode();
    } catch (err) {
      alert(err.message);
    } finally {
      setBulkDeleting(false);
    }
  };

  const startEditTitle = () => {
    setTitleDraft(album.title);
    setEditingTitle(true);
  };

  const saveTitle = async () => {
    if (!titleDraft.trim()) return;
    try {
      await albumsApi.update(id, { title: titleDraft.trim() });
      setAlbum(prev => ({ ...prev, title: titleDraft.trim() }));
      setEditingTitle(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleBulkDownload = async () => {
    if (bulkSelectedIds.size === 0) return;
    setBulkDownloading(true);
    try {
      await photosApi.bulkDownload([...bulkSelectedIds]);
    } catch (err) {
      alert(err.message);
    } finally {
      setBulkDownloading(false);
    }
  };

  const handleQuickUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setQuickUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach(f => formData.append('photos', f));
      formData.append('album_id', id);
      await photosApi.upload(formData);
      const updated = await albumsApi.getOne(id);
      setAlbum(updated);
    } catch (err) {
      alert(err.message);
    } finally {
      setQuickUploading(false);
      if (quickUploadRef.current) quickUploadRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!album) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold mb-2">Album not found</h2>
        <Link to="/albums" className="text-violet-500 hover:underline">Back to albums</Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <Link to="/albums" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-violet-500 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Albums
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            {editingTitle ? (
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                  autoFocus
                  className="text-3xl font-bold bg-transparent border-b-2 border-violet-500 focus:outline-none dark:text-white"
                />
                <button onClick={saveTitle} className="p-1.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors">
                  <Check className="w-5 h-5" />
                </button>
                <button onClick={() => setEditingTitle(false)} className="p-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-2 group/title">
                <h1 className="text-3xl font-bold">{album.title}</h1>
                {isOwner && (
                  <button
                    onClick={startEditTitle}
                    className="p-1.5 rounded-full text-gray-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 opacity-0 group-hover/title:opacity-100 transition-all"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
            {album.description && (
              <p className="text-gray-500 dark:text-gray-400 mb-2">{album.description}</p>
            )}
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <span className="flex items-center gap-1">
                <Image className="w-4 h-4" /> {album.photos.length} photos
              </span>
              <span>by {album.username}</span>
              {isOwner ? (
                <button
                  onClick={async () => {
                    const newVis = album.visibility === 'public' ? 'private' : 'public';
                    try {
                      await albumsApi.update(album.id, { visibility: newVis });
                      setAlbum(prev => ({ ...prev, visibility: newVis }));
                    } catch (err) { alert(err.message); }
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold uppercase transition-all ${
                    album.visibility === 'public'
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                  title={`Click to make ${album.visibility === 'public' ? 'private' : 'public'}`}
                >
                  {album.visibility === 'public' ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  {album.visibility || 'private'}
                </button>
              ) : (
                <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold uppercase ${
                  album.visibility === 'public'
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                }`}>
                  {album.visibility === 'public' ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  {album.visibility || 'private'}
                </span>
              )}
            </div>
          </div>
          {isOwner && (
            <div className="flex items-center gap-2 shrink-0">
              <input ref={quickUploadRef} type="file" multiple accept="image/*" onChange={handleQuickUpload} className="hidden" />
              <button
                onClick={() => quickUploadRef.current?.click()}
                disabled={quickUploading}
                className="btn-secondary flex items-center gap-2 text-sm !px-4 !py-2 disabled:opacity-50"
              >
                {quickUploading ? (
                  <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" /> Uploading...</span>
                ) : (
                  <span className="flex items-center gap-2"><Upload className="w-4 h-4" /> Quick Upload</span>
                )}
              </button>
              <button onClick={openPicker} className="btn-primary flex items-center gap-2 text-sm !px-4 !py-2">
                <Plus className="w-4 h-4" /> Add Existing
              </button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Bulk action bar */}
      {isOwner && album.photos.length > 0 && (
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <button
            onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              selectMode
                ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            {selectMode ? 'Selecting...' : 'Select'}
          </button>

          <AnimatePresence>
            {selectMode && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-2 flex-wrap"
              >
                <button onClick={bulkSelectAll} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <Square className="w-4 h-4" />
                  {bulkSelectedIds.size === album.photos.length ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-sm text-gray-500">{bulkSelectedIds.size} selected</span>
                <button
                  onClick={handleBulkRemove}
                  disabled={bulkSelectedIds.size === 0 || bulkDeleting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-yellow-50 dark:bg-yellow-950/30 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-950/50 disabled:opacity-40 transition-all"
                >
                  <FolderMinus className="w-4 h-4" /> Remove
                </button>
                <button
                  onClick={handleBulkDownload}
                  disabled={bulkSelectedIds.size === 0 || bulkDownloading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/50 disabled:opacity-40 transition-all"
                >
                  {bulkDownloading ? (
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Download
                </button>
                <button
                  onClick={() => setShowBulkRename(true)}
                  disabled={bulkSelectedIds.size === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-950/50 disabled:opacity-40 transition-all"
                >
                  <Pencil className="w-4 h-4" /> Rename
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkSelectedIds.size === 0 || bulkDeleting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50 disabled:opacity-40 transition-all"
                >
                  {bulkDeleting ? (
                    <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Delete
                </button>
                <button onClick={exitSelectMode} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Photos */}
      <MasonryGrid
        photos={album.photos}
        onPhotoClick={setSelectedPhoto}
        onRemoveFromAlbum={isOwner && !selectMode ? handleRemove : undefined}
        onPermanentDelete={isOwner && !selectMode ? handlePermanentDelete : undefined}
        onRename={isOwner ? handleRenamePhoto : undefined}
        selectMode={selectMode}
        selectedIds={bulkSelectedIds}
        onToggleSelect={toggleBulkSelect}
      />

      {/* Lightbox */}
      {selectedPhoto && (
        <Lightbox
          photo={selectedPhoto}
          photos={album.photos}
          onClose={() => setSelectedPhoto(null)}
          onDelete={handleDelete}
          onNavigate={setSelectedPhoto}
          onUpdate={handleUpdate}
        />
      )}

      {/* Bulk Rename Modal */}
      <AnimatePresence>
        {showBulkRename && (
          <BulkRenameModal
            photos={album.photos.filter(p => bulkSelectedIds.has(p.id))}
            onClose={() => setShowBulkRename(false)}
            onComplete={(renamedPhotos, albumId) => {
              setAlbum(prev => ({
                ...prev,
                photos: prev.photos.map(p => {
                  const renamed = renamedPhotos.find(r => r.id === p.id);
                  return renamed ? { ...p, title: renamed.title, album_id: albumId } : p;
                })
              }));
              setShowBulkRename(false);
              exitSelectMode();
            }}
          />
        )}
      </AnimatePresence>

      {/* Photo Picker Modal */}
      <AnimatePresence>
        {showPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowPicker(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <h2 className="text-xl font-bold">Add Photos to "{album.title}"</h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select photos to add'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {allPhotos.length > 0 && (
                    <button
                      onClick={() => {
                        const addable = allPhotos.filter(p => p.album_id !== Number(id)).map(p => p.id);
                        if (selectedIds.size === addable.length) {
                          setSelectedIds(new Set());
                        } else {
                          setSelectedIds(new Set(addable));
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 text-violet-600 dark:text-violet-400 transition-colors"
                    >
                      {selectedIds.size === allPhotos.filter(p => p.album_id !== Number(id)).length && selectedIds.size > 0 ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
                  <button onClick={() => setShowPicker(false)} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Photo Grid */}
              <div className="flex-1 overflow-y-auto p-4">
                {pickerLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : allPhotos.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <p>No photos found. Upload some photos first.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {allPhotos.map((photo) => {
                      const isInAlbum = photo.album_id === Number(id);
                      const isSelected = selectedIds.has(photo.id);
                      return (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() => !isInAlbum && togglePhoto(photo.id)}
                          disabled={isInAlbum}
                          className={`relative aspect-square rounded-xl overflow-hidden transition-all duration-200 ${
                            isInAlbum
                              ? 'opacity-50 cursor-not-allowed ring-2 ring-green-500'
                              : isSelected
                              ? 'ring-3 ring-violet-500 scale-[0.95]'
                              : 'hover:ring-2 hover:ring-violet-300 hover:scale-[0.97]'
                          }`}
                        >
                          <img
                            src={`/uploads/thumbs/${photo.thumbnail}`}
                            alt={photo.title}
                            className="w-full h-full object-cover"
                          />
                          {isInAlbum && (
                            <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                              <div className="bg-green-500 rounded-full p-1">
                                <Check className="w-4 h-4 text-white" />
                              </div>
                            </div>
                          )}
                          {isSelected && !isInAlbum && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute inset-0 bg-violet-500/30 flex items-center justify-center"
                            >
                              <div className="bg-violet-500 rounded-full p-1">
                                <Check className="w-4 h-4 text-white" />
                              </div>
                            </motion.div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
                            <p className="text-white text-xs truncate">{photo.title}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <span className="text-sm text-gray-500">
                  Photos already in this album are marked with <Check className="w-3 h-3 inline text-green-500" />
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setShowPicker(false)} className="btn-secondary">Cancel</button>
                  <button
                    onClick={handleAddPhotos}
                    disabled={selectedIds.size === 0 || saving}
                    className="btn-primary disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Add {selectedIds.size > 0 ? selectedIds.size : ''} Photo{selectedIds.size !== 1 ? 's' : ''}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
