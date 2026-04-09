import { useState, useEffect, useRef, useCallback } from 'react';
import PhotoCard from './PhotoCard';

function useColumns() {
  const [cols, setCols] = useState(4);
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w >= 1536) setCols(5);
      else if (w >= 1024) setCols(4);
      else if (w >= 768) setCols(3);
      else setCols(2);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return cols;
}

// Distribute photos left-to-right into the shortest column (like Pinterest)
function distributeToColumns(photos, numCols) {
  const columns = Array.from({ length: numCols }, () => []);
  const heights = new Array(numCols).fill(0);

  for (const photo of photos) {
    const rawRatio = photo.width && photo.height ? (photo.height / photo.width) : 0.75;
    const ratio = Math.min(1.4, Math.max(0.6, rawRatio));
    // Find shortest column
    let shortest = 0;
    for (let i = 1; i < numCols; i++) {
      if (heights[i] < heights[shortest]) shortest = i;
    }
    columns[shortest].push(photo);
    heights[shortest] += ratio + 0.15; // 0.15 accounts for caption height
  }
  return columns;
}

export default function MasonryGrid({ photos, onPhotoClick, onRemoveFromAlbum, onPermanentDelete, onRename, selectMode, selectedIds, onToggleSelect }) {
  const numCols = useColumns();

  if (!photos || photos.length === 0) {
    return (
      <div className="text-center py-24">
        <div className="text-6xl mb-4 grayscale opacity-40">📷</div>
        <h3 className="text-lg font-semibold text-gray-400 dark:text-gray-500">No photos yet</h3>
        <p className="text-gray-400 dark:text-gray-600 mt-1 text-sm">Upload some photos to get started</p>
      </div>
    );
  }

  const columns = distributeToColumns(photos, numCols);
  // Build a flat index map so each photo gets its original index for stagger animation
  const indexMap = new Map();
  photos.forEach((p, i) => indexMap.set(p.id, i));

  return (
    <div className="flex gap-3 md:gap-4">
      {columns.map((col, colIdx) => (
        <div key={colIdx} className="flex-1 min-w-0">
          {col.map((photo) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              index={indexMap.get(photo.id)}
              onClick={onPhotoClick}
              onRemoveFromAlbum={onRemoveFromAlbum}
              onPermanentDelete={onPermanentDelete}
              onRename={onRename}
              selectMode={selectMode}
              isSelected={selectedIds ? selectedIds.has(photo.id) : false}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
