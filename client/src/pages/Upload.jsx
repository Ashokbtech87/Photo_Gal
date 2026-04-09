import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload as UploadIcon, X, Image, Tag, FolderOpen, Plus, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { photosApi, albumsApi } from '../api';

export default function Upload() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const dropRef = useRef(null);

  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [albumId, setAlbumId] = useState('');
  const [albums, setAlbums] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    albumsApi.getAll().then(setAlbums).catch(() => {});
  }, [user, navigate]);

  const handleFiles = (newFiles) => {
    const imageFiles = Array.from(newFiles).filter(f => f.type.startsWith('image/'));
    setFiles(prev => [...prev, ...imageFiles]);

    imageFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviews(prev => [...prev, { name: file.name, url: e.target.result, size: file.size }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (files.length === 0) return;

    setUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      files.forEach(f => formData.append('photos', f));
      if (title) formData.append('title', title);
      if (description) formData.append('description', description);
      if (tags) formData.append('tags', tags);
      if (albumId) formData.append('album_id', albumId);

      // Simulate progress
      const interval = setInterval(() => {
        setProgress(p => Math.min(p + Math.random() * 15, 90));
      }, 200);

      await photosApi.upload(formData);

      clearInterval(interval);
      setProgress(100);
      setSuccess(true);

      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="text-center"
        >
          <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Upload Complete!</h2>
          <p className="text-gray-500">Redirecting to gallery...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold mb-8">Upload Photos</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Drop zone */}
          <div
            ref={dropRef}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all duration-300 ${
              dragOver
                ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/20 scale-[1.02]'
                : 'border-gray-300 dark:border-gray-700 hover:border-violet-400 hover:bg-gray-50 dark:hover:bg-gray-900/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />
            <motion.div
              animate={dragOver ? { scale: 1.1, y: -5 } : { scale: 1, y: 0 }}
              className="inline-flex p-4 rounded-2xl bg-violet-100 dark:bg-violet-900/30 mb-4"
            >
              <UploadIcon className="w-8 h-8 text-violet-500" />
            </motion.div>
            <h3 className="text-lg font-semibold mb-1">Drop images here or click to browse</h3>
            <p className="text-sm text-gray-500">Supports JPG, PNG, GIF, WebP up to 20MB each</p>
          </div>

          {/* Previews */}
          <AnimatePresence>
            {previews.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
              >
                {previews.map((preview, index) => (
                  <motion.div
                    key={preview.name + index}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="relative group rounded-2xl overflow-hidden aspect-square bg-gray-100 dark:bg-gray-800"
                  >
                    <img src={preview.url} alt={preview.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                        className="p-2 bg-red-500 rounded-full text-white hover:bg-red-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
                      <p className="text-white text-xs truncate">{preview.name}</p>
                      <p className="text-white/60 text-xs">{(preview.size / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Details */}
          {previews.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Title</label>
                <div className="relative">
                  <Image className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Give your photos a title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="input-field !pl-12"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Description</label>
                <textarea
                  placeholder="Add a description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="input-field resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Tags</label>
                  <div className="relative">
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="nature, sunset, landscape"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      className="input-field !pl-12"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Album</label>
                  <div className="relative">
                    <FolderOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <select
                      value={albumId}
                      onChange={(e) => setAlbumId(e.target.value)}
                      className="input-field !pl-12 appearance-none"
                    >
                      <option value="">No album</option>
                      {albums.map(a => (
                        <option key={a.id} value={a.id}>{a.title}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Progress */}
              {uploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Uploading...</span>
                    <span className="font-medium">{Math.round(progress)}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full"
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={uploading || files.length === 0}
                className="btn-primary w-full !py-3 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <UploadIcon className="w-5 h-5" />
                Upload {files.length} photo{files.length !== 1 ? 's' : ''}
              </button>
            </motion.div>
          )}
        </form>
      </motion.div>
    </div>
  );
}
