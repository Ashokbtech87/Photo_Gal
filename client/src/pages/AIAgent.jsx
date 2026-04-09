import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Send, Search, Download, Check, X, ImageIcon, FolderOpen,
  Plus, Settings, Loader2, AlertCircle, CheckCircle2, Sparkles, Globe, Eye
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { agentApi, albumsApi } from '../api';

const IMAGE_PROVIDERS = [
  { id: 'google_web', name: 'Web Search (Free)', icon: '🌐' },
  { id: 'pexels', name: 'Pexels', icon: '📸', keyUrl: 'https://www.pexels.com/api/new/' },
  { id: 'unsplash', name: 'Unsplash', icon: '🖼️', keyUrl: 'https://unsplash.com/developers' },
  { id: 'google', name: 'Google API', icon: '🔍', keyUrl: 'https://developers.google.com/custom-search/v1/introduction' },
  { id: 'custom', name: 'Custom API', icon: '🔗' },
];

export default function AIAgent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // Config
  const [showConfig, setShowConfig] = useState(false);
  const [ollamaModel, setOllamaModel] = useState(() => localStorage.getItem('agent_ollama_model') || 'gemma4:31b-cloud');
  const [availableModels, setAvailableModels] = useState([]);
  const [imageProvider, setImageProvider] = useState(() => localStorage.getItem('agent_image_provider') || 'pexels');
  const [imageApiKey, setImageApiKey] = useState(() => localStorage.getItem('agent_image_key') || '');
  const [imageCount, setImageCount] = useState(() => parseInt(localStorage.getItem('agent_image_count')) || 10);
  const [ollamaConnected, setOllamaConnected] = useState(null);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const modelInputRef = useRef(null);

  // Google search config
  const [googleCx, setGoogleCx] = useState(() => localStorage.getItem('agent_google_cx') || '');

  // Custom provider config
  const [customEndpoint, setCustomEndpoint] = useState(() => localStorage.getItem('agent_custom_endpoint') || '');
  const [customApiKey, setCustomApiKey] = useState(() => localStorage.getItem('agent_custom_key') || '');
  const [customMode, setCustomMode] = useState(() => localStorage.getItem('agent_custom_mode') || 'search');
  const [customHeaders, setCustomHeaders] = useState(() => localStorage.getItem('agent_custom_headers') || '');
  const [customBodyTemplate, setCustomBodyTemplate] = useState(() => localStorage.getItem('agent_custom_body') || '');

  // Chat state
  const [messages, setMessages] = useState([
    {
      role: 'agent',
      type: 'welcome',
      content: 'Hi! I\'m your AI Image Agent powered by Ollama. Tell me what kind of images you\'re looking for, and I\'ll search the web, let you pick the best ones, and save them to your album.\n\nExample: *"Find me 10 stunning mountain landscape photos at sunset"*',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Search results & selection
  const [searchResults, setSearchResults] = useState(null);
  const [selectedImages, setSelectedImages] = useState(new Set());

  // Album & download
  const [albums, setAlbums] = useState([]);
  const [albumMode, setAlbumMode] = useState('new');
  const [selectedAlbumId, setSelectedAlbumId] = useState('');
  const [newAlbumTitle, setNewAlbumTitle] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [autoSave, setAutoSave] = useState(() => localStorage.getItem('agent_auto_save') === 'true');
  const [albumVisibility, setAlbumVisibility] = useState(() => localStorage.getItem('agent_album_visibility') || 'private');

  // Preview
  const [previewImg, setPreviewImg] = useState(null);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    // Check Ollama connection & load models
    agentApi.getModels().then(data => {
      setOllamaConnected(true);
      setAvailableModels(data.models || []);
    }).catch(() => {
      setOllamaConnected(false);
    });
    albumsApi.getAll().then(setAlbums).catch(() => {});
  }, [user, navigate]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, searchResults]);

  const saveApiKey = (key) => {
    setImageApiKey(key);
    localStorage.setItem('agent_image_key', key);
  };

  const saveModel = (val) => {
    setOllamaModel(val);
    localStorage.setItem('agent_ollama_model', val);
  };

  const saveImageCount = (val) => {
    const n = Math.min(30, Math.max(1, parseInt(val) || 10));
    setImageCount(n);
    localStorage.setItem('agent_image_count', String(n));
  };

  const saveProvider = (id) => {
    setImageProvider(id);
    localStorage.setItem('agent_image_provider', id);
  };

  const saveCustom = (key, val, setter) => {
    setter(val);
    localStorage.setItem(key, val);
  };

  const addMessage = (msg) => setMessages(prev => [...prev, msg]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setSearchResults(null);
    setSelectedImages(new Set());

    addMessage({ role: 'user', content: text });

    if (!imageApiKey && imageProvider !== 'custom' && imageProvider !== 'google_web') {
      addMessage({
        role: 'agent', type: 'error',
        content: 'Please configure your image search API key first. Click the ⚙️ button above to set up Pexels or Unsplash API access.',
      });
      return;
    }
    if (imageProvider === 'custom' && !customEndpoint) {
      addMessage({
        role: 'agent', type: 'error',
        content: 'Please configure your custom API endpoint first. Click the ⚙️ button above.',
      });
      return;
    }

    setLoading(true);
    addMessage({ role: 'agent', type: 'thinking', content: 'Analyzing your request with AI...' });

    try {
      const data = await agentApi.search({
        prompt: text,
        model: ollamaModel,
        image_provider: imageProvider,
        image_api_key: imageProvider === 'custom' ? customApiKey : imageApiKey,
        count: imageCount,
        ...(imageProvider === 'google' && { google_cx: googleCx }),
        ...(imageProvider === 'custom' && {
          custom_endpoint: customEndpoint,
          custom_mode: customMode,
          custom_headers: customHeaders,
          custom_body_template: customBodyTemplate,
        }),
      });

      // Remove thinking message
      setMessages(prev => prev.filter(m => m.type !== 'thinking'));

      addMessage({
        role: 'agent', type: 'queries',
        content: `🔍 AI generated ${data.queries.length} search ${data.queries.length === 1 ? 'query' : 'queries'}:\n${data.queries.map(q => `• ${q}`).join('\n')}`,
      });

      if (data.images.length > 0) {
        setSearchResults(data);
        setSelectedImages(new Set(data.images.map((_, i) => i)));
        setNewAlbumTitle(text.slice(0, 60));

        if (autoSave) {
          // Auto-save all images to a new album
          addMessage({
            role: 'agent', type: 'results',
            content: `Found **${data.images.length}** images! Auto-saving to album...`,
          });
          try {
            const dlData = await agentApi.download({
              images: data.images,
              album_id: albumMode === 'existing' && selectedAlbumId ? Number(selectedAlbumId) : null,
              new_album_title: albumMode === 'existing' && selectedAlbumId ? null : text.slice(0, 60),
              new_album_desc: '',
              tags: ['ai-agent', 'auto-saved'],
              visibility: albumVisibility,
            });
            addMessage({
              role: 'agent', type: 'success',
              content: `✅ Auto-saved **${dlData.downloaded}** images to album (${albumVisibility})!${dlData.errors > 0 ? ` (${dlData.errors} failed)` : ''}\n\n[View Album →](/albums/${dlData.album_id})`,
              albumId: dlData.album_id,
            });
            setSearchResults(null);
            setSelectedImages(new Set());
            albumsApi.getAll().then(setAlbums).catch(() => {});
          } catch (dlErr) {
            addMessage({ role: 'agent', type: 'error', content: `Auto-save failed: ${dlErr.message}. You can still manually download.` });
          }
        } else {
          addMessage({
            role: 'agent', type: 'results',
            content: `Found **${data.images.length}** images! All are pre-selected. Deselect any you don't want, choose an album, and hit Download.`,
          });
        }
      } else {
        addMessage({
          role: 'agent', type: 'error',
          content: 'No images found. Try a different description or check your API key.',
        });
      }
    } catch (err) {
      setMessages(prev => prev.filter(m => m.type !== 'thinking'));
      addMessage({ role: 'agent', type: 'error', content: `Error: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const toggleImage = (idx) => {
    setSelectedImages(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (!searchResults) return;
    if (selectedImages.size === searchResults.images.length) {
      setSelectedImages(new Set());
    } else {
      setSelectedImages(new Set(searchResults.images.map((_, i) => i)));
    }
  };

  const handleDownload = async () => {
    if (selectedImages.size === 0) return;
    const hasAlbum = albumMode === 'existing' ? !!selectedAlbumId : !!newAlbumTitle.trim();
    if (!hasAlbum) {
      alert('Please select or create an album.');
      return;
    }

    setDownloading(true);
    addMessage({ role: 'agent', type: 'thinking', content: `Downloading ${selectedImages.size} images...` });

    try {
      const selected = searchResults.images.filter((_, i) => selectedImages.has(i));
      const data = await agentApi.download({
        images: selected,
        album_id: albumMode === 'existing' ? Number(selectedAlbumId) : null,
        new_album_title: albumMode === 'new' ? newAlbumTitle.trim() : null,
        new_album_desc: '',
        tags: ['ai-agent', 'downloaded'],
        visibility: albumVisibility,
      });

      setMessages(prev => prev.filter(m => m.type !== 'thinking'));

      addMessage({
        role: 'agent', type: 'success',
        content: `✅ Downloaded **${data.downloaded}** images to album!${data.errors > 0 ? ` (${data.errors} failed)` : ''}\n\n[View Album →](/albums/${data.album_id})`,
        albumId: data.album_id,
      });

      setSearchResults(null);
      setSelectedImages(new Set());
      // Refresh albums
      albumsApi.getAll().then(setAlbums).catch(() => {});
    } catch (err) {
      setMessages(prev => prev.filter(m => m.type !== 'thinking'));
      addMessage({ role: 'agent', type: 'error', content: `Download failed: ${err.message}` });
    } finally {
      setDownloading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-b from-emerald-50 via-teal-50/30 to-transparent dark:from-gray-900 dark:via-gray-950 dark:to-transparent">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-3">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">
                  <span className="bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
                    AI Image Agent
                  </span>
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`w-2 h-2 rounded-full ${ollamaConnected ? 'bg-green-500' : ollamaConnected === false ? 'bg-red-500' : 'bg-yellow-500'}`} />
                  <span className="text-xs text-gray-500">
                    {ollamaConnected ? `Ollama · ${ollamaModel}` : ollamaConnected === false ? 'Ollama not connected' : 'Checking...'}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowConfig(!showConfig)}
              className={`p-2.5 rounded-xl transition-colors ${showConfig ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400'}`}
            >
              <Settings className="w-5 h-5" />
            </button>
          </motion.div>
        </div>
      </div>

      {/* Config panel */}
      <AnimatePresence>
        {showConfig && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-4">
              <div className="glass-strong rounded-2xl p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Ollama Model */}
                  <div className="relative">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Ollama Model</label>
                    <div className="relative">
                      <input
                        ref={modelInputRef}
                        type="text"
                        value={ollamaModel}
                        onChange={(e) => saveModel(e.target.value)}
                        onFocus={() => setModelDropdownOpen(true)}
                        onBlur={() => setTimeout(() => setModelDropdownOpen(false), 200)}
                        className="w-full px-3 py-2 pr-8 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                        placeholder="Type or select a model..."
                      />
                      {availableModels.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setModelDropdownOpen(p => !p)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          <svg className={`w-4 h-4 transition-transform ${modelDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
                        </button>
                      )}
                    </div>
                    <AnimatePresence>
                      {modelDropdownOpen && availableModels.length > 0 && (
                        <motion.ul
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.15 }}
                          className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-48 overflow-y-auto"
                        >
                          {availableModels
                            .filter(m => m.name.toLowerCase().includes(ollamaModel.toLowerCase()) || ollamaModel === m.name)
                            .map(m => (
                              <li
                                key={m.name}
                                onMouseDown={() => { saveModel(m.name); setModelDropdownOpen(false); }}
                                className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                                  m.name === ollamaModel
                                    ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-medium'
                                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                {m.name}
                              </li>
                            ))}
                          {availableModels.filter(m => m.name.toLowerCase().includes(ollamaModel.toLowerCase()) || ollamaModel === m.name).length === 0 && (
                            <li className="px-3 py-2 text-sm text-gray-400 italic">No matching models</li>
                          )}
                        </motion.ul>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Image count */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Images per search</label>
                    <input
                      type="number" min={1} max={30}
                      value={imageCount}
                      onChange={(e) => saveImageCount(e.target.value)}
                      className="input-field text-sm"
                    />
                  </div>
                </div>

                {/* Image Provider */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Image Search Provider</label>
                  <div className="flex gap-2 flex-wrap">
                    {IMAGE_PROVIDERS.map(p => (
                      <button
                        key={p.id}
                        onClick={() => saveProvider(p.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                          imageProvider === p.id
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <span>{p.icon}</span> {p.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Standard provider API Key */}
                {imageProvider !== 'custom' && imageProvider !== 'google_web' && (
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                      {IMAGE_PROVIDERS.find(p => p.id === imageProvider)?.name} API Key
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={imageApiKey}
                        onChange={(e) => saveApiKey(e.target.value)}
                        placeholder={imageProvider === 'google' ? 'Google Custom Search API key' : `Enter your ${imageProvider} API key`}
                        className="input-field text-sm flex-1"
                      />
                      <a
                        href={IMAGE_PROVIDERS.find(p => p.id === imageProvider)?.keyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary text-xs !px-3 !py-2 flex items-center gap-1 whitespace-nowrap"
                      >
                        <Globe className="w-3.5 h-3.5" /> Get Key
                      </a>
                    </div>
                  </div>
                )}

                {/* Google Web — no key needed */}
                {imageProvider === 'google_web' && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                    <span className="text-emerald-600 dark:text-emerald-400 text-sm">✅ No API key required — searches the web for images directly.</span>
                  </div>
                )}

                {/* Google Search Engine ID */}
                {imageProvider === 'google' && (
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                      Search Engine ID (CX)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={googleCx}
                        onChange={(e) => { setGoogleCx(e.target.value); localStorage.setItem('agent_google_cx', e.target.value); }}
                        placeholder="Enter your Custom Search Engine ID"
                        className="input-field text-sm flex-1"
                      />
                      <a
                        href="https://programmablesearchengine.google.com/controlpanel/all"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary text-xs !px-3 !py-2 flex items-center gap-1 whitespace-nowrap"
                      >
                        <Globe className="w-3.5 h-3.5" /> Create CX
                      </a>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">Create a Programmable Search Engine with "Image search" ON, then copy the Search Engine ID.</p>
                  </div>
                )}

                {/* Custom API Config */}
                {imageProvider === 'custom' && (
                  <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">🔗 Custom API Configuration</span>
                    </div>

                    {/* Mode toggle */}
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Mode</label>
                      <div className="flex gap-2">
                        {[{ id: 'search', label: '🔍 Search Images', desc: 'Search & fetch existing images' }, { id: 'generate', label: '🎨 Generate Images', desc: 'AI-generate images from prompt' }].map(m => (
                          <button
                            key={m.id}
                            onClick={() => saveCustom('agent_custom_mode', m.id, setCustomMode)}
                            className={`flex-1 px-3 py-2.5 rounded-xl border-2 text-xs font-medium transition-all text-left ${
                              customMode === m.id
                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                            }`}
                          >
                            <div>{m.label}</div>
                            <div className="text-[10px] text-gray-400 mt-0.5">{m.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Endpoint URL */}
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">API Endpoint URL</label>
                      <input
                        type="url"
                        value={customEndpoint}
                        onChange={(e) => saveCustom('agent_custom_endpoint', e.target.value, setCustomEndpoint)}
                        placeholder={customMode === 'generate' ? 'https://api.openai.com/v1/images/generations' : 'https://api.example.com/v1/search'}
                        className="input-field text-sm"
                      />
                    </div>

                    {/* API Key */}
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">API Key <span className="text-gray-400 text-[10px] normal-case">(optional)</span></label>
                      <input
                        type="password"
                        value={customApiKey}
                        onChange={(e) => saveCustom('agent_custom_key', e.target.value, setCustomApiKey)}
                        placeholder="Bearer token or API key"
                        className="input-field text-sm"
                      />
                    </div>

                    {/* Custom Headers */}
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                        Custom Headers <span className="text-gray-400 text-[10px] normal-case">(JSON, optional)</span>
                      </label>
                      <input
                        type="text"
                        value={customHeaders}
                        onChange={(e) => saveCustom('agent_custom_headers', e.target.value, setCustomHeaders)}
                        placeholder='{"X-Custom-Header": "value"}'
                        className="input-field text-sm font-mono"
                      />
                    </div>

                    {/* Body Template */}
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                        Request Body Template <span className="text-gray-400 text-[10px] normal-case">(JSON — use {'{{query}}'} and {'{{count}}'} as placeholders)</span>
                      </label>
                      <textarea
                        value={customBodyTemplate}
                        onChange={(e) => saveCustom('agent_custom_body', e.target.value, setCustomBodyTemplate)}
                        placeholder={customMode === 'generate'
                          ? '{"model":"dall-e-3","prompt":"{{query}}","n":{{count}},"size":"1024x1024"}'
                          : '{"query":"{{query}}","per_page":{{count}}}'}
                        rows={3}
                        className="input-field text-sm font-mono resize-y"
                      />
                      <p className="text-[10px] text-gray-400 mt-1">
                        {'{{query}}'} = AI search query, {'{{count}}'} = number of images. Leave empty for auto-format.
                      </p>
                    </div>
                  </div>
                )}

                {/* Auto-save & Album Visibility */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-200 dark:border-gray-700">
                  {/* Auto-save toggle */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Auto-save to Album</label>
                    <button
                      onClick={() => {
                        const next = !autoSave;
                        setAutoSave(next);
                        localStorage.setItem('agent_auto_save', String(next));
                      }}
                      className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                        autoSave
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300'
                          : 'border-gray-200 dark:border-gray-700 text-gray-500'
                      }`}
                    >
                      <div className={`w-10 h-5 rounded-full relative transition-colors ${autoSave ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${autoSave ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </div>
                      {autoSave ? 'Auto-save ON' : 'Auto-save OFF'}
                    </button>
                    <p className="text-[10px] text-gray-400 mt-1">Automatically save all found images to album</p>
                  </div>

                  {/* Album Visibility */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Default Album Visibility</label>
                    <div className="flex gap-2">
                      {[
                        { id: 'private', label: '🔒 Private', color: 'gray' },
                        { id: 'public', label: '🌐 Public', color: 'emerald' },
                      ].map(v => (
                        <button
                          key={v.id}
                          onClick={() => {
                            setAlbumVisibility(v.id);
                            localStorage.setItem('agent_album_visibility', v.id);
                          }}
                          className={`flex-1 px-3 py-2.5 rounded-xl border-2 text-xs font-medium transition-all ${
                            albumVisibility === v.id
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300'
                              : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
                          }`}
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">Visibility for newly created albums</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat area */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 pb-4 overflow-y-auto">
        <div className="space-y-4 py-4">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] sm:max-w-[75%] ${msg.role === 'user' ? 'order-1' : ''}`}>
                {msg.role === 'agent' && (
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                      <Bot className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-xs font-medium text-gray-500">Agent</span>
                  </div>
                )}
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-emerald-500 text-white rounded-br-md'
                    : msg.type === 'error'
                    ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                    : msg.type === 'success'
                    ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                    : msg.type === 'thinking'
                    ? 'bg-gray-50 dark:bg-gray-800/50 text-gray-500 border border-gray-200 dark:border-gray-700'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-md'
                }`}>
                  {msg.type === 'thinking' && (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> {msg.content}
                    </span>
                  )}
                  {msg.type !== 'thinking' && (
                    <span dangerouslySetInnerHTML={{
                      __html: msg.content
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*(.*?)\*/g, '<em>$1</em>')
                        .replace(/\n/g, '<br/>')
                        .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="underline font-medium hover:opacity-80">$1</a>')
                    }} />
                  )}
                </div>
              </div>
            </motion.div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Search results grid */}
        <AnimatePresence>
          {searchResults && searchResults.images.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6"
            >
              {/* Selection toolbar */}
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleAll}
                    className="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    {selectedImages.size === searchResults.images.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <span className="text-sm text-gray-400">
                    {selectedImages.size} of {searchResults.images.length} selected
                  </span>
                </div>
              </div>

              {/* Image grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
                {searchResults.images.map((img, idx) => {
                  const isSelected = selectedImages.has(idx);
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.03 }}
                      className="relative group"
                    >
                      <button
                        onClick={() => toggleImage(idx)}
                        className={`w-full aspect-[4/3] rounded-xl overflow-hidden transition-all duration-200 ${
                          isSelected
                            ? 'ring-[3px] ring-emerald-500 scale-[0.96]'
                            : 'hover:ring-2 hover:ring-emerald-300 hover:scale-[0.98] opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={img.thumb || img.url}
                          alt={img.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </button>

                      {/* Select badge */}
                      <div className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shadow ${
                        isSelected ? 'bg-emerald-500 border-emerald-500' : 'bg-white/80 dark:bg-gray-900/80 border-gray-300 dark:border-gray-600'
                      }`}>
                        {isSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                      </div>

                      {/* Preview button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setPreviewImg(img); }}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Eye className="w-3 h-3" />
                      </button>

                      {/* Info */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent rounded-b-xl p-2 pt-5">
                        <p className="text-white text-[10px] truncate font-medium">{img.title}</p>
                        <p className="text-white/60 text-[9px]">📷 {img.photographer}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Album selection + download */}
              <div className="glass-strong rounded-2xl p-5">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-emerald-500" /> Save to Album
                </h3>

                {/* Tabs */}
                <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl mb-3 max-w-xs">
                  <button
                    onClick={() => setAlbumMode('new')}
                    className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      albumMode === 'new' ? 'bg-white dark:bg-gray-700 shadow-sm text-emerald-600' : 'text-gray-500'
                    }`}
                  >
                    <Plus className="w-3 h-3" /> New Album
                  </button>
                  <button
                    onClick={() => setAlbumMode('existing')}
                    disabled={albums.length === 0}
                    className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      albumMode === 'existing' ? 'bg-white dark:bg-gray-700 shadow-sm text-emerald-600' : 'text-gray-500 disabled:opacity-40'
                    }`}
                  >
                    <FolderOpen className="w-3 h-3" /> Existing
                  </button>
                </div>

                <div className="flex items-end gap-3 flex-wrap">
                  {albumMode === 'new' ? (
                    <input
                      type="text"
                      value={newAlbumTitle}
                      onChange={(e) => setNewAlbumTitle(e.target.value)}
                      placeholder="Album name"
                      className="input-field text-sm flex-1 min-w-[200px]"
                    />
                  ) : (
                    <select
                      value={selectedAlbumId}
                      onChange={(e) => setSelectedAlbumId(e.target.value)}
                      className="flex-1 min-w-[200px] px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    >
                      <option value="">Select album...</option>
                      {albums.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
                    </select>
                  )}

                  <button
                    onClick={handleDownload}
                    disabled={selectedImages.size === 0 || downloading}
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 disabled:opacity-50 transition-all flex items-center gap-2"
                  >
                    {downloading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Downloading...</>
                    ) : (
                      <><Download className="w-4 h-4" /> Download {selectedImages.size} to Album</>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input bar — fixed bottom */}
      <div className="sticky bottom-0 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Describe images you want to find... e.g. 'Beautiful cherry blossom photos in Japan'"
                disabled={loading || downloading}
                className="w-full pl-4 pr-12 py-3.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 text-sm disabled:opacity-50 transition-all"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading || downloading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white disabled:opacity-30 hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:hover:shadow-none"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
          {ollamaConnected === false && (
            <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Ollama not reachable at localhost:11434. Make sure it's running.
            </p>
          )}
        </div>
      </div>

      {/* Image preview modal */}
      <AnimatePresence>
        {previewImg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setPreviewImg(null)}
          >
            <button className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white" onClick={() => setPreviewImg(null)}>
              <X className="w-6 h-6" />
            </button>
            <img
              src={previewImg.url}
              alt={previewImg.title}
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center">
              <p className="text-white font-medium">{previewImg.title}</p>
              <p className="text-white/60 text-sm">📷 {previewImg.photographer} · {previewImg.source}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
