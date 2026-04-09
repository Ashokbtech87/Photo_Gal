import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, User, Shirt, Wand2, ChevronRight, ChevronLeft,
  Settings, ImageIcon, Download, Save, Trash2, RotateCcw,
  Layers, Eye, ArrowRight, AlertCircle, CheckCircle2, X
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { tryonApi, settingsApi, albumsApi } from '../api';
import ImageSelector from '../components/ImageSelector';

const CATEGORIES = [
  { id: 'upper_body', label: 'Upper Body', icon: '👕', desc: 'Tops, shirts, jackets' },
  { id: 'lower_body', label: 'Lower Body', icon: '👖', desc: 'Pants, skirts, shorts' },
  { id: 'dresses', label: 'Full Body', icon: '👗', desc: 'Dresses, full outfits' },
];

const STEPS = [
  { id: 'person', label: 'Person', icon: User },
  { id: 'garment', label: 'Garment', icon: Shirt },
  { id: 'configure', label: 'Configure', icon: Layers },
  { id: 'generate', label: 'Generate', icon: Wand2 },
];

export default function VirtualTryOn() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [hasApiKey, setHasApiKey] = useState(null);

  // Selections
  const [personPhoto, setPersonPhoto] = useState(null);
  const [garmentPhotos, setGarmentPhotos] = useState([]);
  const [category, setCategory] = useState('upper_body');
  const [prompt, setPrompt] = useState('');

  // Generation
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentGarmentIdx, setCurrentGarmentIdx] = useState(0);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');

  // Results
  const [pastResults, setPastResults] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [compareMode, setCompareMode] = useState(null);

  // Picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState('person');

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    settingsApi.get().then(data => {
      setHasApiKey(!!data.api_key_masked);
    }).catch(() => setHasApiKey(false));

    tryonApi.getResults().then(setPastResults).catch(() => {});
  }, [user, navigate]);

  const openPicker = (target) => {
    setPickerTarget(target);
    setPickerOpen(true);
  };

  const handlePickerSelect = (selection) => {
    if (pickerTarget === 'person') {
      setPersonPhoto(selection);
    } else {
      if (Array.isArray(selection)) {
        setGarmentPhotos(selection);
      } else {
        setGarmentPhotos([selection]);
      }
    }
  };

  const canProceed = () => {
    if (step === 0) return !!personPhoto;
    if (step === 1) return garmentPhotos.length > 0;
    if (step === 2) return true;
    return false;
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    setResults([]);
    setProgress(0);
    setStep(3);

    const newResults = [];
    for (let i = 0; i < garmentPhotos.length; i++) {
      setCurrentGarmentIdx(i);
      setProgress(Math.round(((i) / garmentPhotos.length) * 100));
      try {
        const result = await tryonApi.generate({
          person_photo_id: personPhoto.id,
          garment_photo_id: garmentPhotos[i].id,
          category,
          prompt: prompt || `A ${category.replace('_', ' ')} clothing item`
        });
        newResults.push({ ...result, garment: garmentPhotos[i] });
        setResults([...newResults]);
      } catch (err) {
        newResults.push({ error: err.message, garment: garmentPhotos[i] });
        setResults([...newResults]);
      }
    }
    setProgress(100);
    setGenerating(false);
    // Refresh history
    tryonApi.getResults().then(setPastResults).catch(() => {});
  };

  const handleSaveToGallery = async (result) => {
    setSavingId(result.id);
    try {
      await tryonApi.saveToGallery(result.id, {
        title: `Try-On: ${result.garment?.title || 'Result'}`,
      });
      alert('Saved to gallery!');
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteResult = async (resultId) => {
    if (!confirm('Delete this try-on result?')) return;
    try {
      await tryonApi.deleteResult(resultId);
      setPastResults(prev => prev.filter(r => r.id !== resultId));
      setResults(prev => prev.filter(r => r.id !== resultId));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDownload = (filename) => {
    const a = document.createElement('a');
    a.href = `/uploads/tryon/${filename}`;
    a.download = filename;
    a.click();
  };

  const resetAll = () => {
    setStep(0);
    setPersonPhoto(null);
    setGarmentPhotos([]);
    setCategory('upper_body');
    setPrompt('');
    setResults([]);
    setError('');
    setGenerating(false);
    setProgress(0);
  };

  if (!user) return null;

  // No API key configured
  if (hasApiKey === false) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-violet-500/25">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-3">Virtual Try-On</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">
            Configure your AI provider to start trying on clothes virtually. You'll need an API key from Replicate or another supported provider.
          </p>
          <Link to="/settings" className="btn-primary inline-flex items-center gap-2 text-lg !px-8 !py-3">
            <Settings className="w-5 h-5" /> Set Up AI Provider
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-b from-violet-50 via-pink-50/30 to-transparent dark:from-gray-900 dark:via-gray-950 dark:to-transparent">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shadow-lg shadow-violet-500/25">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">
                  <span className="bg-gradient-to-r from-violet-600 to-pink-600 dark:from-violet-400 dark:to-pink-400 bg-clip-text text-transparent">
                    Virtual Try-On
                  </span>
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">AI-powered clothing visualization</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`btn-secondary text-sm !px-4 !py-2 flex items-center gap-1.5 ${showHistory ? '!bg-violet-100 dark:!bg-violet-900/30 !text-violet-600' : ''}`}
              >
                <Layers className="w-4 h-4" /> History ({pastResults.length})
              </button>
              <Link to="/settings" className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <Settings className="w-5 h-5 text-gray-400" />
              </Link>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
        {/* History panel */}
        <AnimatePresence>
          {showHistory && pastResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-8"
            >
              <div className="glass-strong rounded-2xl p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-violet-500" /> Recent Results
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {pastResults.slice(0, 10).map(r => (
                    <div key={r.id} className="group relative rounded-xl overflow-hidden aspect-[3/4] bg-gray-100 dark:bg-gray-800">
                      <img src={`/uploads/thumbs/${r.result_thumbnail}`} alt="Try-on result" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                        <button onClick={() => handleDownload(r.result_filename)} className="p-2 rounded-full bg-white/90 text-gray-700 hover:bg-white transition-colors shadow">
                          <Download className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleSaveToGallery(r)} className="p-2 rounded-full bg-white/90 text-violet-600 hover:bg-white transition-colors shadow">
                          <Save className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteResult(r.id)} className="p-2 rounded-full bg-white/90 text-red-500 hover:bg-white transition-colors shadow">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 pt-4">
                        <p className="text-white text-xs truncate">{r.garment_title || 'Result'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-1 mb-8">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isDone = i < step;
            return (
              <div key={s.id} className="flex items-center">
                <button
                  onClick={() => i < step && setStep(i)}
                  disabled={i > step}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-violet-500 to-pink-500 text-white shadow-lg shadow-violet-500/25'
                      : isDone
                      ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 cursor-pointer hover:bg-violet-200 dark:hover:bg-violet-900/50'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <ChevronRight className={`w-4 h-4 mx-1 ${i < step ? 'text-violet-400' : 'text-gray-300 dark:text-gray-600'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          {/* STEP 0: Select Person */}
          {step === 0 && (
            <motion.div key="step0" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
              <div className="max-w-2xl mx-auto">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold mb-2">Select a Person Photo</h2>
                  <p className="text-gray-500 dark:text-gray-400">Choose a photo of yourself or a model to try on clothes</p>
                </div>

                {personPhoto ? (
                  <div className="flex flex-col items-center">
                    <div className="relative group">
                      <img
                        src={`/uploads/thumbs/${personPhoto.thumbnail}`}
                        alt={personPhoto.title}
                        className="w-72 h-96 object-cover rounded-2xl shadow-2xl shadow-violet-500/10"
                      />
                      <div className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <button onClick={() => openPicker('person')} className="px-4 py-2 rounded-full bg-white/90 text-sm font-medium shadow-lg hover:bg-white transition-colors">
                          Change Photo
                        </button>
                      </div>
                    </div>
                    <p className="mt-3 text-sm font-medium text-gray-600 dark:text-gray-300">{personPhoto.title}</p>
                  </div>
                ) : (
                  <button
                    onClick={() => openPicker('person')}
                    className="w-72 h-96 mx-auto flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl hover:border-violet-400 dark:hover:border-violet-500 hover:bg-violet-50/50 dark:hover:bg-violet-950/10 transition-all group"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4 group-hover:bg-violet-100 dark:group-hover:bg-violet-900/30 transition-colors">
                      <User className="w-8 h-8 text-gray-400 group-hover:text-violet-500 transition-colors" />
                    </div>
                    <span className="text-sm font-medium text-gray-500 group-hover:text-violet-600 transition-colors">
                      Choose from Gallery
                    </span>
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* STEP 1: Select Garments */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
              <div className="max-w-3xl mx-auto">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold mb-2">Select Garments</h2>
                  <p className="text-gray-500 dark:text-gray-400">Choose one or more clothing photos to try on</p>
                </div>

                <div className="flex flex-wrap justify-center gap-4 mb-6">
                  {garmentPhotos.map((g, i) => (
                    <div key={g.id} className="relative group">
                      <img
                        src={`/uploads/thumbs/${g.thumbnail}`}
                        alt={g.title}
                        className="w-36 h-44 object-cover rounded-xl shadow-lg"
                      />
                      <button
                        onClick={() => setGarmentPhotos(prev => prev.filter(p => p.id !== g.id))}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent rounded-b-xl p-2 pt-4">
                        <p className="text-white text-xs truncate">{g.title}</p>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={() => openPicker('garments')}
                    className="w-36 h-44 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl hover:border-violet-400 hover:bg-violet-50/50 dark:hover:bg-violet-950/10 transition-all group"
                  >
                    <Shirt className="w-8 h-8 text-gray-400 group-hover:text-violet-500 transition-colors mb-2" />
                    <span className="text-xs font-medium text-gray-500 group-hover:text-violet-600 transition-colors">
                      {garmentPhotos.length > 0 ? 'Add More' : 'Choose'}
                    </span>
                  </button>
                </div>

                {garmentPhotos.length > 1 && (
                  <p className="text-center text-sm text-violet-500">
                    <Sparkles className="w-3.5 h-3.5 inline mr-1" />
                    {garmentPhotos.length} garments selected — each will be tried on separately
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* STEP 2: Configure */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
              <div className="max-w-2xl mx-auto">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold mb-2">Configure Try-On</h2>
                  <p className="text-gray-500 dark:text-gray-400">Fine-tune the generation settings</p>
                </div>

                <div className="space-y-6">
                  {/* Category */}
                  <div className="glass-strong rounded-2xl p-6">
                    <label className="text-sm font-semibold mb-4 block">Garment Category</label>
                    <div className="grid grid-cols-3 gap-3">
                      {CATEGORIES.map(c => (
                        <button
                          key={c.id}
                          onClick={() => setCategory(c.id)}
                          className={`p-4 rounded-xl border-2 text-center transition-all ${
                            category === c.id
                              ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/20 shadow-sm'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                          }`}
                        >
                          <div className="text-3xl mb-2">{c.icon}</div>
                          <div className="text-sm font-medium">{c.label}</div>
                          <div className="text-xs text-gray-500 mt-1">{c.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Prompt */}
                  <div className="glass-strong rounded-2xl p-6">
                    <label className="text-sm font-semibold mb-2 block">Description (optional)</label>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Describe the garment for better results... e.g. 'A blue cotton casual shirt'"
                      rows={3}
                      className="input-field resize-none"
                    />
                  </div>

                  {/* Summary */}
                  <div className="glass-strong rounded-2xl p-6">
                    <label className="text-sm font-semibold mb-4 block">Summary</label>
                    <div className="flex items-center gap-4">
                      <img src={`/uploads/thumbs/${personPhoto?.thumbnail}`} alt="" className="w-20 h-24 object-cover rounded-xl" />
                      <ArrowRight className="w-5 h-5 text-gray-400 shrink-0" />
                      <div className="flex gap-2 flex-wrap">
                        {garmentPhotos.map(g => (
                          <img key={g.id} src={`/uploads/thumbs/${g.thumbnail}`} alt="" className="w-16 h-20 object-cover rounded-lg" />
                        ))}
                      </div>
                      <div className="ml-auto text-right shrink-0">
                        <div className="text-sm font-medium">{garmentPhotos.length} generation{garmentPhotos.length > 1 ? 's' : ''}</div>
                        <div className="text-xs text-gray-500">{CATEGORIES.find(c => c.id === category)?.label}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 3: Generate / Results */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
              <div className="max-w-4xl mx-auto">
                {generating ? (
                  <div className="text-center py-12">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                      className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-violet-500/30"
                    >
                      <Wand2 className="w-10 h-10 text-white" />
                    </motion.div>
                    <h2 className="text-2xl font-bold mb-2">Generating Try-On</h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">
                      Processing garment {currentGarmentIdx + 1} of {garmentPhotos.length}...
                    </p>
                    <div className="max-w-md mx-auto">
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full"
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                      <p className="text-sm text-gray-400 mt-2">{progress}%</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-6">This may take 30–90 seconds per garment</p>
                  </div>
                ) : (
                  <>
                    <div className="text-center mb-8">
                      <h2 className="text-2xl font-bold mb-2">
                        {results.some(r => !r.error) ? '✨ Try-On Results' : 'Generation Complete'}
                      </h2>
                      <p className="text-gray-500 dark:text-gray-400">
                        {results.filter(r => !r.error).length} of {results.length} successful
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {results.map((result, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="glass-strong rounded-2xl overflow-hidden"
                        >
                          {result.error ? (
                            <div className="p-6 text-center">
                              <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                              <p className="text-sm text-red-500 mb-2">Failed</p>
                              <p className="text-xs text-gray-400">{result.error}</p>
                              <p className="text-xs text-gray-500 mt-2">Garment: {result.garment?.title}</p>
                            </div>
                          ) : (
                            <>
                              <div className="relative group aspect-[3/4]">
                                {compareMode === result.id ? (
                                  <div className="absolute inset-0 flex">
                                    <div className="w-1/2 overflow-hidden">
                                      <img src={`/uploads/thumbs/${personPhoto?.thumbnail}`} alt="Before" className="w-full h-full object-cover" />
                                      <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/50 rounded-full text-white text-xs">Before</div>
                                    </div>
                                    <div className="w-1/2 overflow-hidden">
                                      <img src={`/uploads/thumbs/${result.result_thumbnail}`} alt="After" className="w-full h-full object-cover" />
                                      <div className="absolute top-2 right-2 px-2 py-0.5 bg-violet-500/80 rounded-full text-white text-xs">After</div>
                                    </div>
                                    <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white shadow-lg" />
                                  </div>
                                ) : (
                                  <img src={`/uploads/thumbs/${result.result_thumbnail}`} alt="Result" className="w-full h-full object-cover" />
                                )}
                                <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 justify-center">
                                  <button
                                    onClick={() => setCompareMode(compareMode === result.id ? null : result.id)}
                                    className="p-2 rounded-full bg-white/90 text-gray-700 hover:bg-white shadow transition-colors"
                                    title="Compare before/after"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDownload(result.result_filename)}
                                    className="p-2 rounded-full bg-white/90 text-gray-700 hover:bg-white shadow transition-colors"
                                    title="Download"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleSaveToGallery(result)}
                                    disabled={savingId === result.id}
                                    className="p-2 rounded-full bg-white/90 text-violet-600 hover:bg-white shadow transition-colors disabled:opacity-50"
                                    title="Save to Gallery"
                                  >
                                    {savingId === result.id ? (
                                      <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <Save className="w-4 h-4" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => handleDeleteResult(result.id)}
                                    className="p-2 rounded-full bg-white/90 text-red-500 hover:bg-white shadow transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              <div className="p-3">
                                <div className="flex items-center gap-2">
                                  <img src={`/uploads/thumbs/${result.garment?.thumbnail}`} alt="" className="w-8 h-8 rounded-lg object-cover" />
                                  <div>
                                    <p className="text-sm font-medium truncate">{result.garment?.title}</p>
                                    <div className="flex items-center gap-1 text-xs text-green-500">
                                      <CheckCircle2 className="w-3 h-3" /> Generated
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                        </motion.div>
                      ))}
                    </div>

                    <div className="flex justify-center gap-3 mt-8">
                      <button onClick={resetAll} className="btn-secondary flex items-center gap-2">
                        <RotateCcw className="w-4 h-4" /> Start Over
                      </button>
                      <button
                        onClick={() => { setResults([]); setStep(1); }}
                        className="btn-primary flex items-center gap-2"
                      >
                        <Shirt className="w-4 h-4" /> Try Different Garments
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation buttons */}
        {step < 3 && (
          <div className="flex items-center justify-center gap-4 mt-10">
            {step > 0 && (
              <button onClick={() => setStep(step - 1)} className="btn-secondary flex items-center gap-2">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
            {step < 2 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canProceed()}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={!canProceed()}
                className="bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-600 hover:to-pink-600 text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Wand2 className="w-5 h-5" /> Generate Try-On
              </button>
            )}
          </div>
        )}
      </div>

      {/* Image Selector */}
      <ImageSelector
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePickerSelect}
        title={pickerTarget === 'person' ? 'Select Person Photo' : 'Select Garment Photos'}
        multiple={pickerTarget === 'garments'}
        selectedIds={pickerTarget === 'garments' ? garmentPhotos.map(g => g.id) : []}
      />
    </div>
  );
}
