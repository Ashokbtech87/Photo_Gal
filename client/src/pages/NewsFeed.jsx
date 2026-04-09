import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Newspaper, RefreshCw, Clock, ExternalLink, Sparkles, ChevronLeft, ChevronRight, Flame, Globe, Monitor, Briefcase, Trophy, Clapperboard, Microscope, Heart, Search, X, Image, FileText, ArrowLeft } from 'lucide-react';

const API_BASE = '/api';
const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes

const CATEGORY_ICONS = {
  top: Flame,
  world: Globe,
  tech: Monitor,
  business: Briefcase,
  sports: Trophy,
  entertainment: Clapperboard,
  science: Microscope,
  health: Heart,
};

const CATEGORY_COLORS = {
  top: 'from-orange-500 to-red-500',
  world: 'from-blue-500 to-cyan-500',
  tech: 'from-violet-500 to-purple-500',
  business: 'from-emerald-500 to-teal-500',
  sports: 'from-green-500 to-lime-500',
  entertainment: 'from-pink-500 to-rose-500',
  science: 'from-indigo-500 to-blue-500',
  health: 'from-red-500 to-pink-500',
};

export default function NewsFeed() {
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('top');
  const [feed, setFeed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nextRefresh, setNextRefresh] = useState(REFRESH_INTERVAL);
  const [heroIndex, setHeroIndex] = useState(0);
  const intervalRef = useRef(null);
  const countdownRef = useRef(null);
  const heroTimerRef = useRef(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchTab, setSearchTab] = useState('all');
  const searchInputRef = useRef(null);

  // Fetch categories
  useEffect(() => {
    fetch(`${API_BASE}/news/categories`)
      .then(r => r.json())
      .then(setCategories)
      .catch(console.error);
  }, []);

  // Fetch feed
  const fetchFeed = useCallback(async (category, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const endpoint = isRefresh ? `${API_BASE}/news/refresh` : `${API_BASE}/news/feed?category=${category}`;
      const options = isRefresh
        ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category }) }
        : {};

      const token = localStorage.getItem('token');
      if (token) options.headers = { ...options.headers, Authorization: `Bearer ${token}` };

      const res = await fetch(endpoint, options);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setFeed(data);
      setHeroIndex(0);
      setNextRefresh(REFRESH_INTERVAL);
    } catch (err) {
      console.error('Feed fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load & category change
  useEffect(() => {
    fetchFeed(activeCategory);
  }, [activeCategory, fetchFeed]);

  // Auto-refresh every 10 minutes
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetchFeed(activeCategory, true);
    }, REFRESH_INTERVAL);

    return () => clearInterval(intervalRef.current);
  }, [activeCategory, fetchFeed]);

  // Countdown timer
  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setNextRefresh(prev => Math.max(0, prev - 1000));
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, []);

  // Reset countdown on refresh
  useEffect(() => {
    if (!refreshing) setNextRefresh(REFRESH_INTERVAL);
  }, [refreshing]);

  // Hero carousel auto-advance
  useEffect(() => {
    const heroArticles = feed?.articles?.filter(a => a.image) || [];
    if (heroArticles.length <= 1) return;
    heroTimerRef.current = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % Math.min(heroArticles.length, 5));
    }, 6000);
    return () => clearInterval(heroTimerRef.current);
  }, [feed]);

  const heroArticles = (feed?.articles || []).filter(a => a.image).slice(0, 5);
  const gridArticles = (feed?.articles || []).slice(heroArticles.length > 0 ? 1 : 0);
  const minutes = Math.floor(nextRefresh / 60000);
  const seconds = Math.floor((nextRefresh % 60000) / 1000);

  // Search handler
  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults(null);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/news/search`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: searchQuery.trim(), type: searchTab }),
      });
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setSearchResults(data);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
    setSearchTab('all');
  };

  const handleManualRefresh = () => {
    fetchFeed(activeCategory, true);
  };

  const ActiveIcon = CATEGORY_ICONS[activeCategory] || Flame;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Search Bar — Always visible */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search the web — news, images, articles..."
              className="w-full pl-12 pr-10 py-3.5 rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-base focus:border-violet-500 dark:focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all placeholder:text-gray-400"
            />
            {searchQuery && (
              <button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={searching || !searchQuery.trim()}
            className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-medium text-sm hover:from-violet-600 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-violet-500/25"
          >
            {searching ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
        </div>
      </form>

      {/* Search Results Mode */}
      {searchResults ? (
        <SearchResultsView
          results={searchResults}
          searching={searching}
          searchTab={searchTab}
          setSearchTab={(tab) => { setSearchTab(tab); }}
          onSearchAgain={(tab) => { setSearchTab(tab); setTimeout(() => handleSearch(), 0); }}
          onBack={clearSearch}
        />
      ) : (
      <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-2xl bg-gradient-to-br ${CATEGORY_COLORS[activeCategory] || 'from-orange-500 to-red-500'} shadow-lg`}>
            <Newspaper className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">News Feed</h1>
            {feed?.aiSummary && (
              <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mt-0.5">
                <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                {feed.aiSummary}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Next update in {minutes}:{seconds.toString().padStart(2, '0')}
          </div>
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Updating...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-hide">
        {categories.map(cat => {
          const Icon = CATEGORY_ICONS[cat.id] || Flame;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                isActive
                  ? `bg-gradient-to-r ${CATEGORY_COLORS[cat.id] || 'from-orange-500 to-red-500'} text-white shadow-md`
                  : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {cat.label.replace(/^[^\s]+\s/, '')}
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">Fetching latest news with AI...</p>
        </div>
      )}

      {/* Feed Content */}
      {!loading && feed && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          {/* Hero Section — Featured carousel */}
          {heroArticles.length > 0 && (
            <div className="mb-8">
              <div className="relative rounded-2xl overflow-hidden bg-gray-900 group" style={{ minHeight: '400px' }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={heroIndex}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className="absolute inset-0"
                  >
                    <img
                      src={heroArticles[heroIndex]?.image}
                      alt={heroArticles[heroIndex]?.title}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                  </motion.div>
                </AnimatePresence>

                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 z-10">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-medium">
                      {heroArticles[heroIndex]?.source}
                    </span>
                    <span className="text-white/70 text-xs flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {heroArticles[heroIndex]?.timeAgo}
                    </span>
                  </div>
                  <a
                    href={heroArticles[heroIndex]?.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group/link"
                  >
                    <h2 className="text-xl sm:text-3xl font-bold text-white leading-tight mb-2 group-hover/link:text-violet-300 transition-colors">
                      {heroArticles[heroIndex]?.title}
                    </h2>
                    <p className="text-white/70 text-sm sm:text-base line-clamp-2 max-w-2xl">
                      {heroArticles[heroIndex]?.excerpt?.replace(/<[^>]+>/g, '')}
                    </p>
                  </a>
                </div>

                {/* Carousel controls */}
                {heroArticles.length > 1 && (
                  <>
                    <button
                      onClick={() => setHeroIndex(prev => (prev - 1 + heroArticles.length) % heroArticles.length)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors opacity-0 group-hover:opacity-100 z-20"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setHeroIndex(prev => (prev + 1) % heroArticles.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors opacity-0 group-hover:opacity-100 z-20"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    {/* Dots */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
                      {heroArticles.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setHeroIndex(i)}
                          className={`w-2 h-2 rounded-full transition-all ${i === heroIndex ? 'bg-white w-6' : 'bg-white/40 hover:bg-white/60'}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Top Stories label */}
          <div className="flex items-center gap-2 mb-4">
            <ActiveIcon className="w-5 h-5 text-gray-500" />
            <h3 className="text-lg font-bold">
              {categories.find(c => c.id === activeCategory)?.label || '🔥 Top Stories'}
            </h3>
            <span className="text-xs text-gray-400 ml-auto">
              {feed.totalArticles} articles · Updated {new Date(feed.lastUpdated).toLocaleTimeString()}
            </span>
          </div>

          {/* News Grid — MSN-style mixed layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {gridArticles.map((article, idx) => (
              <NewsCard key={article.id || idx} article={article} featured={idx < 2} />
            ))}
          </div>

          {/* Empty state */}
          {feed.articles?.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Newspaper className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg font-medium">No news articles found</p>
              <p className="text-sm mt-1">Try a different category or refresh</p>
            </div>
          )}

          {/* Footer info */}
          {feed.stale && (
            <div className="mt-6 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-sm text-center">
              Showing cached results. Live feed will update shortly.
            </div>
          )}
        </motion.div>
      )}
      </>
      )}
    </div>
  );
}

// ── Search Results View ──────────────────────────────────────────────
const SEARCH_TABS = [
  { id: 'all', label: 'All', icon: Search },
  { id: 'news', label: 'News', icon: Newspaper },
  { id: 'web', label: 'Web', icon: Globe },
  { id: 'images', label: 'Images', icon: Image },
];

function SearchResultsView({ results, searching, searchTab, setSearchTab, onSearchAgain, onBack }) {
  const { webResults = [], newsResults = [], imageResults = [], externalLinks = [], query } = results || {};
  const hasWeb = webResults.length > 0;
  const hasNews = newsResults.length > 0;
  const hasImages = imageResults.length > 0;
  const totalResults = webResults.length + newsResults.length + imageResults.length;
  const [imgPreview, setImgPreview] = useState(null);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Back + result count */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to News
        </button>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {totalResults} results for "<span className="font-medium text-gray-700 dark:text-gray-300">{query}</span>"
        </span>
      </div>

      {/* Search type tabs */}
      <div className="flex gap-2 mb-4">
        {SEARCH_TABS.map(tab => {
          const Icon = tab.icon;
          const count = tab.id === 'all' ? totalResults : tab.id === 'web' ? webResults.length : tab.id === 'news' ? newsResults.length : imageResults.length;
          return (
            <button
              key={tab.id}
              onClick={() => { setSearchTab(tab.id); if (tab.id !== searchTab) onSearchAgain(tab.id); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                searchTab === tab.id
                  ? 'bg-violet-500 text-white shadow-md'
                  : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              {count > 0 && <span className="text-xs opacity-75">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Open in external search engines */}
      {externalLinks.length > 0 && (
        <div className="mb-6 p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2.5">Search on other platforms:</p>
          <div className="flex flex-wrap gap-2">
            {externalLinks.map(link => (
              <a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-violet-400 dark:hover:border-violet-500 hover:shadow-sm transition-all"
              >
                <span>{link.icon}</span>
                {link.name}
                <ExternalLink className="w-3 h-3 opacity-40" />
              </a>
            ))}
          </div>
        </div>
      )}

      {searching && (
        <div className="flex flex-col items-center py-16 gap-3">
          <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Searching the web...</p>
        </div>
      )}

      {!searching && (
        <div className="space-y-8">
          {/* Web Results */}
          {(searchTab === 'all' || searchTab === 'web') && hasWeb && (
            <section>
              <h3 className="flex items-center gap-2 text-lg font-bold mb-3">
                <Globe className="w-5 h-5 text-blue-500" /> Web Results
              </h3>
              <div className="space-y-3">
                {webResults.map((r, i) => (
                  <a
                    key={i}
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-md transition-all group"
                  >
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 font-mono mb-1 truncate">{r.url}</div>
                    <h4 className="font-semibold text-base text-blue-600 dark:text-blue-400 group-hover:underline mb-1 line-clamp-1">{r.title}</h4>
                    {r.snippet && <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{r.snippet}</p>}
                    <span className="text-xs text-gray-400 mt-1 inline-block">{r.source}</span>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* News Results */}
          {(searchTab === 'all' || searchTab === 'news') && hasNews && (
            <section>
              <h3 className="flex items-center gap-2 text-lg font-bold mb-3">
                <Newspaper className="w-5 h-5 text-orange-500" /> News
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {newsResults.map((article, i) => (
                  <NewsCard key={article.id || i} article={article} featured={i < 2} />
                ))}
              </div>
            </section>
          )}

          {/* Image Results */}
          {(searchTab === 'all' || searchTab === 'images') && hasImages && (
            <section>
              <h3 className="flex items-center gap-2 text-lg font-bold mb-3">
                <Image className="w-5 h-5 text-pink-500" /> Images
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {imageResults.map((img, i) => (
                  <div key={i} className="group relative rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 cursor-pointer" onClick={() => setImgPreview(img)}>
                    <div style={{ paddingBottom: '75%' }} className="relative">
                      <img
                        src={img.thumb || img.url}
                        alt={img.title}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        onError={(e) => { e.target.src = ''; e.target.alt = 'Failed'; }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end">
                        <div className="w-full p-2 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-white text-xs line-clamp-2">{img.title}</p>
                          <p className="text-white/60 text-[10px] mt-0.5">{img.source}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Image preview modal */}
              <AnimatePresence>
                {imgPreview && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
                    onClick={() => setImgPreview(null)}
                  >
                    <motion.div
                      initial={{ scale: 0.9 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0.9 }}
                      className="max-w-4xl w-full max-h-[90vh] relative"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <img src={imgPreview.url} alt={imgPreview.title} className="w-full max-h-[80vh] object-contain rounded-lg" />
                      <div className="mt-3 flex items-center justify-between">
                        <div>
                          <p className="text-white text-sm font-medium">{imgPreview.title}</p>
                          <p className="text-white/50 text-xs">{imgPreview.source} · {imgPreview.width}×{imgPreview.height}</p>
                        </div>
                        <div className="flex gap-2">
                          <a
                            href={imgPreview.sourceUrl || imgPreview.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs hover:bg-white/20 transition-colors flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" /> Visit source
                          </a>
                          <button
                            onClick={() => setImgPreview(null)}
                            className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs hover:bg-white/20 transition-colors"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          )}

          {/* No results */}
          {!hasWeb && !hasNews && !hasImages && (
            <div className="flex flex-col items-center py-16 text-gray-400">
              <Search className="w-12 h-12 mb-3 opacity-30" />
              <p className="font-medium">No results found</p>
              <p className="text-sm mt-1">Try different keywords or check the external search links above</p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ── News Card Component ─────────────────────────────────────────────
function NewsCard({ article, featured }) {
  const [imgError, setImgError] = useState(false);
  const hasImage = article.image && !imgError;

  return (
    <motion.a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group block rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:shadow-xl hover:shadow-gray-200/50 dark:hover:shadow-gray-900/50 transition-all duration-300 hover:-translate-y-1 ${
        featured && hasImage ? 'md:col-span-1' : ''
      }`}
    >
      {/* Image */}
      {hasImage && (
        <div className="relative overflow-hidden" style={{ paddingBottom: featured ? '56%' : '50%' }}>
          <img
            src={article.image}
            alt={article.title}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={() => setImgError(true)}
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {/* Source & time */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center">
              <span className="text-[8px] font-bold text-gray-600 dark:text-gray-300">
                {article.source?.charAt(0)?.toUpperCase() || 'N'}
              </span>
            </div>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{article.source}</span>
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
            · {article.timeAgo}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-sm sm:text-base leading-snug group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors line-clamp-3 mb-2">
          {article.title}
        </h3>

        {/* Excerpt */}
        {article.excerpt && (
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
            {article.excerpt.replace(/<[^>]+>/g, '').slice(0, 150)}
          </p>
        )}

        {/* Read more */}
        <div className="flex items-center gap-1 mt-3 text-xs text-violet-500 dark:text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity">
          <ExternalLink className="w-3 h-3" />
          Read full article
        </div>
      </div>
    </motion.a>
  );
}
