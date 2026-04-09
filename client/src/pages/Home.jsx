import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, CheckSquare, X, Trash2, Upload, Square, Download, Pencil } from 'lucide-react';
import MasonryGrid from '../components/MasonryGrid';
import Lightbox from '../components/Lightbox';
import BulkRenameModal from '../components/BulkRenameModal';
import { photosApi } from '../api';
import { useInfiniteScroll } from '../hooks/useIntersection';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user } = useAuth();
  const [photos, setPhotos] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [quickUploading, setQuickUploading] = useState(false);
  const [showBulkRename, setShowBulkRename] = useState(false);
  const quickUploadRef = useRef(null);

  const fetchPhotos = useCallback(async (pageNum = 1, searchQuery = '') => {
    try {
      setLoading(true);
      const data = await photosApi.getAll({ page: pageNum, limit: 20, search: searchQuery });
      if (pageNum === 1) {
        setPhotos(data.photos);
      } else {
        setPhotos(prev => [...prev, ...data.photos]);
      }
      setHasMore(pageNum < data.pagination.pages);
    } catch (err) {
      console.error('Failed to fetch photos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPhotos(1, search);
    setPage(1);
  }, [search, fetchPhotos]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchPhotos(nextPage, search);
    }
  }, [loading, hasMore, page, search, fetchPhotos]);

  const lastRef = useInfiniteScroll(loadMore);

  const handleDelete = (photoId) => {
    setPhotos(prev => prev.filter(p => p.id !== photoId));
  };

  const handleUpdate = (updatedPhoto) => {
    setPhotos(prev => prev.map(p => p.id === updatedPhoto.id ? { ...p, ...updatedPhoto } : p));
  };

  const handleRenamePhoto = async (photoId, newTitle) => {
    try {
      await photosApi.update(photoId, { title: newTitle });
      setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, title: newTitle } : p));
    } catch (err) {
      alert(err.message);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === photos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(photos.map(p => p.id)));
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Permanently delete ${selectedIds.size} photo${selectedIds.size > 1 ? 's' : ''}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      await Promise.all([...selectedIds].map(id => photosApi.delete(id)));
      setPhotos(prev => prev.filter(p => !selectedIds.has(p.id)));
      exitSelectMode();
    } catch (err) {
      alert(err.message);
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleBulkDownload = async () => {
    if (selectedIds.size === 0) return;
    setBulkDownloading(true);
    try {
      await photosApi.bulkDownload([...selectedIds]);
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
      await photosApi.upload(formData);
      // Refresh
      fetchPhotos(1, search);
      setPage(1);
    } catch (err) {
      alert(err.message);
    } finally {
      setQuickUploading(false);
      if (quickUploadRef.current) quickUploadRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen">
      {/* Hero — Unsplash/Pinterest inspired, compact */}
      <div className="bg-gradient-to-b from-violet-50 via-white to-transparent dark:from-gray-900 dark:via-gray-950 dark:to-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="pt-8 pb-6 sm:pt-12 sm:pb-8 text-center"
          >
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-3">
              <span className="bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-400 dark:to-indigo-400 bg-clip-text text-transparent">
                Explore stunning photos
              </span>
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm sm:text-base max-w-lg mx-auto">
              Discover, upload, and organize your visual stories
            </p>

            {/* Search bar — centered like Pinterest */}
            <div className="max-w-xl mx-auto relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search photos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-sm focus:shadow-md focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all text-sm"
              />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-[1800px] mx-auto px-3 sm:px-4 lg:px-6 pb-12">

        {/* Action bar */}
        {user && photos.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-between mb-5 mt-2 flex-wrap gap-3"
          >
            <div className="flex items-center gap-2">
              <button
                onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectMode
                    ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400'
                }`}
              >
                <CheckSquare className="w-4 h-4" />
                {selectMode ? 'Selecting' : 'Select'}
              </button>

              <AnimatePresence>
                {selectMode && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="flex items-center gap-2"
                  >
                    <button onClick={selectAll} className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                      <Square className="w-4 h-4" />
                      {selectedIds.size === photos.length ? 'None' : 'All'}
                    </button>
                    <span className="text-sm text-gray-400 tabular-nums">{selectedIds.size}</span>
                    <button
                      onClick={handleBulkDownload}
                      disabled={selectedIds.size === 0 || bulkDownloading}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-blue-50 dark:bg-blue-950/30 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-30 transition-all"
                    >
                      {bulkDownloading ? (
                        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      Download
                    </button>
                    <button
                      onClick={() => setShowBulkRename(true)}
                      disabled={selectedIds.size === 0}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-violet-50 dark:bg-violet-950/30 text-violet-600 hover:bg-violet-100 dark:hover:bg-violet-900/30 disabled:opacity-30 transition-all"
                    >
                      <Pencil className="w-4 h-4" />
                      Rename
                    </button>
                    <button
                      onClick={handleBulkDelete}
                      disabled={selectedIds.size === 0 || bulkDeleting}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-red-50 dark:bg-red-950/30 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-30 transition-all"
                    >
                      {bulkDeleting ? (
                        <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      Delete
                    </button>
                    <button onClick={exitSelectMode} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-400">
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Quick upload */}
            <div>
              <input ref={quickUploadRef} type="file" multiple accept="image/*" onChange={handleQuickUpload} className="hidden" />
              <button
                onClick={() => quickUploadRef.current?.click()}
                disabled={quickUploading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 disabled:opacity-50 transition-all"
              >
                {quickUploading ? (
                  <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Uploading...</span>
                ) : (
                  <span className="flex items-center gap-2"><Upload className="w-4 h-4" /> Upload</span>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* Gallery */}
        <MasonryGrid
          photos={photos}
          onPhotoClick={setSelectedPhoto}
          onRename={user ? handleRenamePhoto : undefined}
          selectMode={selectMode}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
        />

        {/* Infinite scroll sentinel */}
        {hasMore && <div ref={lastRef} className="h-10" />}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-[3px] border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Lightbox */}
      {selectedPhoto && (
        <Lightbox
          photo={selectedPhoto}
          photos={photos}
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
            photos={photos.filter(p => selectedIds.has(p.id))}
            onClose={() => setShowBulkRename(false)}
            onComplete={(renamedPhotos, albumId) => {
              setPhotos(prev => prev.map(p => {
                const renamed = renamedPhotos.find(r => r.id === p.id);
                return renamed ? { ...p, title: renamed.title, album_id: albumId } : p;
              }));
              setShowBulkRename(false);
              exitSelectMode();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
