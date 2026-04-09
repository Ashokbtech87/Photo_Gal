import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Check, ImageIcon } from 'lucide-react';
import { photosApi } from '../api';

export default function ImageSelector({ isOpen, onClose, onSelect, title, multiple = false, selectedIds = [] }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set(selectedIds));

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setSelected(new Set(selectedIds));
    photosApi.getAll({ limit: 100, search }).then(data => {
      setPhotos(data.photos);
    }).catch(console.error).finally(() => setLoading(false));
  }, [isOpen, search]);

  const toggle = (photo) => {
    if (multiple) {
      setSelected(prev => {
        const next = new Set(prev);
        if (next.has(photo.id)) next.delete(photo.id);
        else next.add(photo.id);
        return next;
      });
    } else {
      onSelect(photo);
      onClose();
    }
  };

  const handleConfirm = () => {
    const selectedPhotos = photos.filter(p => selected.has(p.id));
    onSelect(selectedPhotos);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h2 className="text-lg font-bold">{title || 'Select Photo'}</h2>
              {multiple && selected.size > 0 && (
                <p className="text-sm text-violet-500 mt-0.5">{selected.size} selected</p>
              )}
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search */}
          <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search photos..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              />
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : photos.length === 0 ? (
              <div className="text-center py-16">
                <ImageIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No photos found</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {photos.map(photo => {
                  const isSelected = selected.has(photo.id);
                  return (
                    <button
                      key={photo.id}
                      onClick={() => toggle(photo)}
                      className={`relative aspect-square rounded-xl overflow-hidden transition-all duration-200 group ${
                        isSelected
                          ? 'ring-[3px] ring-violet-500 scale-[0.95]'
                          : 'hover:ring-2 hover:ring-violet-300 hover:scale-[0.97]'
                      }`}
                    >
                      <img
                        src={`/uploads/thumbs/${photo.thumbnail}`}
                        alt={photo.title}
                        className="w-full h-full object-cover"
                      />
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute inset-0 bg-violet-500/25 flex items-center justify-center"
                        >
                          <div className="bg-violet-500 rounded-full p-1.5 shadow-lg">
                            <Check className="w-4 h-4 text-white" strokeWidth={3} />
                          </div>
                        </motion.div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 pt-6">
                        <p className="text-white text-xs truncate font-medium">{photo.title}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {multiple && (
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button onClick={onClose} className="btn-secondary text-sm !px-4 !py-2">Cancel</button>
              <button
                onClick={handleConfirm}
                disabled={selected.size === 0}
                className="btn-primary text-sm !px-5 !py-2 disabled:opacity-50"
              >
                Select {selected.size} Photo{selected.size !== 1 ? 's' : ''}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
