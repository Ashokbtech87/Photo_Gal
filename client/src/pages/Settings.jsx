import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Key, Globe, Cpu, CheckCircle2, AlertCircle, Eye, EyeOff, Sparkles } from 'lucide-react';
import { settingsApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const PROVIDERS = [
  {
    id: 'replicate',
    name: 'Replicate',
    description: 'Best for IDM-VTON, OOTDiffusion & other open-source models',
    icon: '🔮',
    docsUrl: 'https://replicate.com/account/api-tokens',
    placeholder: 'r8_...',
  },
  {
    id: 'custom',
    name: 'Custom API',
    description: 'Use your own endpoint (Fashn.ai, RunwayML, etc.)',
    icon: '🔧',
    docsUrl: '',
    placeholder: 'your-api-key',
  }
];

const MODELS = [
  { id: 'cuuupid/idm-vton:c871bb9b046c1b1f6e867a07a816c7deaaac5975cc9cc767caa138f83e80baaf', name: 'IDM-VTON', desc: 'State-of-the-art virtual try-on (recommended)' },
  { id: 'fashn/tryon:7fb28bf8c8a3e4751059fd99d1af7a2de5ff4bdb8b81e27c0f0433ae1607b086', name: 'Fashn TryOn', desc: 'Fast & accurate try-on model' },
  { id: 'custom', name: 'Custom Model', desc: 'Enter a custom Replicate model version' },
];

export default function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(null);
  const [showKey, setShowKey] = useState(false);

  // Form state
  const [provider, setProvider] = useState('replicate');
  const [apiKey, setApiKey] = useState('');
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [model, setModel] = useState(MODELS[0].id);
  const [customModel, setCustomModel] = useState('');

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    settingsApi.get().then(data => {
      setSettings(data);
      setProvider(data.ai_provider || 'replicate');
      setCustomEndpoint(data.custom_endpoint || '');
      const m = data.tryon_model || MODELS[0].id;
      if (MODELS.find(x => x.id === m)) setModel(m);
      else { setModel('custom'); setCustomModel(m); }
    }).catch(console.error).finally(() => setLoading(false));
  }, [user, navigate]);

  const handleSave = async () => {
    setSaving(true);
    setVerified(null);
    try {
      await settingsApi.update({
        ai_provider: provider,
        api_key: apiKey || undefined,
        custom_endpoint: customEndpoint,
        tryon_model: model === 'custom' ? customModel : model,
      });
      setSettings(prev => ({ ...prev, ai_provider: provider }));
      setApiKey('');
      // Refresh to get masked key
      const updated = await settingsApi.get();
      setSettings(updated);
      setVerified({ success: true, message: 'Settings saved!' });
      setTimeout(() => setVerified(null), 3000);
    } catch (err) {
      setVerified({ success: false, message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    setVerified(null);
    try {
      const data = await settingsApi.verify();
      setVerified({ success: true, message: data.username ? `Connected as ${data.username}` : 'API key is valid!' });
    } catch (err) {
      setVerified({ success: false, message: err.message });
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeProvider = PROVIDERS.find(p => p.id === provider);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
            <SettingsIcon className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">AI Settings</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Configure your Virtual Try-On AI provider</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Provider Selection */}
          <div className="glass-strong rounded-2xl p-6">
            <label className="flex items-center gap-2 text-sm font-semibold mb-4">
              <Cpu className="w-4 h-4 text-violet-500" /> AI Provider
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PROVIDERS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setProvider(p.id)}
                  className={`relative text-left p-4 rounded-xl border-2 transition-all ${
                    provider === p.id
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/20 shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="text-2xl mb-2">{p.icon}</div>
                  <div className="font-semibold text-sm">{p.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{p.description}</div>
                  {provider === p.id && (
                    <div className="absolute top-3 right-3">
                      <CheckCircle2 className="w-5 h-5 text-violet-500" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div className="glass-strong rounded-2xl p-6">
            <label className="flex items-center gap-2 text-sm font-semibold mb-2">
              <Key className="w-4 h-4 text-violet-500" /> API Key
            </label>
            {settings?.api_key_masked && (
              <p className="text-xs text-gray-400 mb-2 font-mono">Current: {settings.api_key_masked}</p>
            )}
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={apiKey ? '' : (activeProvider?.placeholder || 'Enter new API key')}
                className="input-field !pr-20"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                <button onClick={() => setShowKey(!showKey)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {activeProvider?.docsUrl && (
              <a href={activeProvider.docsUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-violet-500 hover:text-violet-600 mt-2 transition-colors">
                <Globe className="w-3 h-3" /> Get your API key →
              </a>
            )}
          </div>

          {/* Model Selection (Replicate only) */}
          {provider === 'replicate' && (
            <div className="glass-strong rounded-2xl p-6">
              <label className="flex items-center gap-2 text-sm font-semibold mb-4">
                <Sparkles className="w-4 h-4 text-violet-500" /> Try-On Model
              </label>
              <div className="space-y-2">
                {MODELS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setModel(m.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      model === m.id
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-sm">{m.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{m.desc}</div>
                  </button>
                ))}
                {model === 'custom' && (
                  <input
                    type="text"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    placeholder="owner/model:version"
                    className="input-field mt-2 font-mono text-sm"
                  />
                )}
              </div>
            </div>
          )}

          {/* Custom Endpoint */}
          {provider === 'custom' && (
            <div className="glass-strong rounded-2xl p-6">
              <label className="flex items-center gap-2 text-sm font-semibold mb-2">
                <Globe className="w-4 h-4 text-violet-500" /> API Endpoint
              </label>
              <input
                type="url"
                value={customEndpoint}
                onChange={(e) => setCustomEndpoint(e.target.value)}
                placeholder="https://api.example.com/v1/try-on"
                className="input-field"
              />
              <p className="text-xs text-gray-400 mt-2">
                POST endpoint that accepts {`{ person_image, garment_image, category, prompt }`} and returns {`{ result_url }`}
              </p>
            </div>
          )}

          {/* Status */}
          {verified && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-center gap-3 p-4 rounded-xl ${
                verified.success
                  ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400'
                  : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400'
              }`}
            >
              {verified.success ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
              <span className="text-sm">{verified.message}</span>
            </motion.div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-50">
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
            {settings?.api_key_masked && (
              <button onClick={handleVerify} disabled={verifying} className="btn-secondary flex items-center gap-2 disabled:opacity-50">
                {verifying ? <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" /> : <Key className="w-4 h-4" />}
                {verifying ? 'Verifying...' : 'Verify Key'}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
