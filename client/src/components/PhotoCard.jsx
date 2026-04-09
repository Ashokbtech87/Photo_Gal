import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Trash2, FolderMinus, Check, Download, ArrowUpRight, User, Pencil, X } from 'lucide-react';
import { useIntersectionObserver } from '../hooks/useIntersection';

export default function PhotoCard({ photo, index, onClick, onRemoveFromAlbum, onPermanentDelete, onRename, selectMode, isSelected, onToggleSelect }) {
  const [ref, isVisible] = useIntersectionObserver();
  const [loaded, setLoaded] = useState(false);
  const [naturalRatio, setNaturalRatio] = useState(null);
  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(photo.title || '');
  const imgRef = useRef(null);

  const thumbUrl = `/uploads/thumbs/${photo.thumbnail}`;
  const blurUrl = `/uploads/thumbs/blur_${photo.filename.replace(/\.[^.]+$/, '')}.jpg`;

  // Use actual stored dimensions, measure from image, or fallback
  // Clamp between 0.6 (wide) and 1.4 (tall) for even masonry columns
  const rawRatio = naturalRatio
    || (photo.width && photo.height ? (photo.height / photo.width) : null)
    || 0.75;
  const ratio = Math.min(1.4, Math.max(0.6, rawRatio));

  const handleLoad = (e) => {
    setLoaded(true);
    if (!photo.width || !photo.height) {
      const { naturalWidth, naturalHeight } = e.target;
      if (naturalWidth && naturalHeight) {
        setNaturalRatio(naturalHeight / naturalWidth);
      }
    }
  };

  const handleClick = () => {
    if (selectMode) {
      onToggleSelect(photo.id);
    } else {
      onClick(photo);
    }
  };

  const handleDownload = (e) => {
    e.stopPropagation();
    const a = document.createElement('a');
    a.href = `/uploads/${photo.filename}`;
    a.download = photo.original_name || photo.filename;
    a.click();
  };

  const startRename = (e) => {
    e.stopPropagation();
    setTitleDraft(photo.title || '');
    setEditing(true);
  };

  const saveRename = async (e) => {
    if (e) e.stopPropagation();
    if (!titleDraft.trim() || titleDraft.trim() === photo.title) {
      setEditing(false);
      return;
    }
    if (onRename) {
      await onRename(photo.id, titleDraft.trim());
    }
    setEditing(false);
  };

  const cancelRename = (e) => {
    if (e) e.stopPropagation();
    setEditing(false);
    setTitleDraft(photo.title || '');
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0 }}
      animate={isVisible ? { opacity: 1 } : {}}
      transition={{ duration: 0.5, delay: Math.min(index * 0.03, 0.15) }}
      className="mb-3 md:mb-4 group cursor-pointer"
      onClick={handleClick}
    >
      {/* Image container — natural aspect ratio */}
      <div
        className={`relative overflow-hidden rounded-[20px] bg-gray-100 dark:bg-gray-800/80 transition-all duration-300 ${
          selectMode && isSelected
            ? 'ring-[3px] ring-violet-500 ring-offset-2 ring-offset-gray-50 dark:ring-offset-gray-950 scale-[0.97]'
            : 'hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-black/30'
        }`}
        style={{ paddingBottom: `${ratio * 100}%` }}
      >
        {/* Blur-up placeholder */}
        <img
          src={blurUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover scale-105"
          style={{ filter: 'blur(12px)' }}
        />

        {/* Main image */}
        {isVisible && (
          <img
            ref={imgRef}
            src={thumbUrl}
            alt={photo.title}
            loading="lazy"
            onLoad={handleLoad}
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-out ${
              loaded ? 'opacity-100 scale-100' : 'opacity-0 scale-[1.02]'
            }`}
          />
        )}

        {/* Hover overlay — Pinterest style */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-all duration-200">
          {/* Top row: select checkbox / action buttons */}
          <div className="absolute top-0 left-0 right-0 p-3 flex items-start justify-between opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-0.5 group-hover:translate-y-0">
            <div className="flex gap-1.5">
              {selectMode && (
                <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shadow-md transition-all ${
                  isSelected ? 'bg-violet-500 border-violet-500' : 'bg-white/90 dark:bg-gray-900/90 border-gray-300 dark:border-gray-600'
                }`}>
                  {isSelected && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                </div>
              )}
              {!selectMode && onRemoveFromAlbum && (
                <button onClick={(e) => { e.stopPropagation(); onRemoveFromAlbum(photo); }} title="Remove from album"
                  className="w-8 h-8 rounded-full bg-white/90 dark:bg-gray-900/90 flex items-center justify-center hover:bg-yellow-50 dark:hover:bg-yellow-950 text-yellow-600 shadow-md transition-colors">
                  <FolderMinus className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex gap-1.5">
              {!selectMode && (
                <button onClick={handleDownload} title="Download"
                  className="w-8 h-8 rounded-full bg-white/90 dark:bg-gray-900/90 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 shadow-md transition-colors">
                  <Download className="w-4 h-4" />
                </button>
              )}
              {!selectMode && onRename && (
                <button onClick={startRename} title="Rename"
                  className="w-8 h-8 rounded-full bg-white/90 dark:bg-gray-900/90 flex items-center justify-center hover:bg-violet-50 dark:hover:bg-violet-950 text-violet-600 dark:text-violet-400 shadow-md transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
              )}
              {!selectMode && onPermanentDelete && (
                <button onClick={(e) => { e.stopPropagation(); onPermanentDelete(photo); }} title="Delete"
                  className="w-8 h-8 rounded-full bg-white/90 dark:bg-gray-900/90 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-950 text-red-500 shadow-md transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Bottom: title pill + open button */}
          {!selectMode && (
            <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-all duration-200">
              <div className="flex items-end justify-between gap-2">
                <span className="text-white text-xs font-medium bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-full truncate max-w-[75%]">
                  {photo.title}
                </span>
                <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-md flex-shrink-0">
                  <ArrowUpRight className="w-4 h-4 text-gray-800" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Always-visible select dot in select mode */}
        {selectMode && (
          <div className={`absolute top-3 left-3 z-20 w-7 h-7 rounded-full border-2 flex items-center justify-center shadow-md transition-all ${
            isSelected ? 'bg-violet-500 border-violet-500' : 'bg-white/80 dark:bg-gray-900/80 border-gray-300 dark:border-gray-600'
          }`}>
            {isSelected && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
          </div>
        )}
      </div>

      {/* Caption below image — Pinterest style */}
      <div className="px-1 pt-2 pb-0.5 h-14">
        {editing ? (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') cancelRename(); }}
              autoFocus
              className="flex-1 min-w-0 px-2 py-0.5 text-[13px] font-semibold bg-white dark:bg-gray-800 border border-violet-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            />
            <button onClick={saveRename} className="p-1 rounded-full text-green-500 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={cancelRename} className="p-1 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 leading-snug line-clamp-1">
            {photo.title}
          </p>
        )}
        <div className="flex items-center gap-1.5 mt-1">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center flex-shrink-0">
            <User className="w-2.5 h-2.5 text-white" />
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{photo.username}</span>
        </div>
      </div>
    </motion.div>
  );
}
