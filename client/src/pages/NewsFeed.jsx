import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Newspaper, RefreshCw, Clock, ExternalLink, Sparkles, ChevronLeft, ChevronRight, Flame, Globe, Monitor, Briefcase, Trophy, Clapperboard, Microscope, Heart, Search, X, Image, FileText, ArrowLeft, MapPin, ChevronDown, Play, Film, Tv, Music, Zap, Youtube, Eye, Users, Navigation } from 'lucide-react';

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
  videos: Play,
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
  videos: 'from-red-600 to-rose-500',
};

const VIDEO_CAT_ICONS = {
  trending: Flame,
  livetv: Tv,
  entertainment: Clapperboard,
  movies: Film,
  viral: Zap,
  news: Tv,
  music: Music,
  sports: Trophy,
};

const VIDEO_CAT_COLORS = {
  trending: 'from-red-500 to-orange-500',
  livetv: 'from-red-600 to-red-500',
  entertainment: 'from-pink-500 to-rose-500',
  movies: 'from-violet-500 to-purple-500',
  viral: 'from-orange-500 to-amber-500',
  news: 'from-blue-500 to-cyan-500',
  music: 'from-emerald-500 to-teal-500',
  sports: 'from-green-500 to-lime-500',
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

  // Country state (persisted in localStorage)
  const [countries, setCountries] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState(() => localStorage.getItem('news_country') || 'wt-wt');
  const [countryOpen, setCountryOpen] = useState(false);
  const countryRef = useRef(null);
  const [geoInfo, setGeoInfo] = useState(null);

  // Video state
  const [videoCategories, setVideoCategories] = useState([]);
  const [activeVideoCategory, setActiveVideoCategory] = useState('trending');
  const [videos, setVideos] = useState(null);
  const [videosLoading, setVideosLoading] = useState(false);
  const [playingVideo, setPlayingVideo] = useState(null);

  // Site stats (live visitors + total visits via SSE)
  const [siteStats, setSiteStats] = useState({ totalVisits: 0, liveUsers: 0 });

  useEffect(() => {
    // Record a visit
    fetch(`${API_BASE}/stats/visit`, { method: 'POST' }).catch(() => {});

    // SSE for live updates
    const evtSource = new EventSource(`${API_BASE}/stats/live`);
    evtSource.onmessage = (e) => {
      try {
        setSiteStats(JSON.parse(e.data));
      } catch {}
    };
    return () => evtSource.close();
  }, []);

  // Fetch countries
  useEffect(() => {
    fetch(`${API_BASE}/news/countries`)
      .then(r => r.json())
      .then(setCountries)
      .catch(console.error);
  }, []);

  // Auto-detect location (runs once if geo_info not yet stored)
  useEffect(() => {
    const hasGeo = localStorage.getItem('geo_info');
    fetch(`${API_BASE}/stats/geolocate`)
      .then(r => r.json())
      .then(geo => {
        if (geo.detected) {
          setGeoInfo(geo);
          localStorage.setItem('geo_info', JSON.stringify(geo));
          // Auto-set country only if never detected before
          if (!hasGeo && geo.region !== 'wt-wt') {
            setSelectedCountry(geo.region);
            localStorage.setItem('news_country', geo.region);
            setFeed(null);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Close country dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (countryRef.current && !countryRef.current.contains(e.target)) setCountryOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // When country changes, persist and refetch
  const handleCountryChange = (code) => {
    setSelectedCountry(code);
    localStorage.setItem('news_country', code);
    setCountryOpen(false);
    setFeed(null);
  };

  const countryName = countries.find(c => c.code === selectedCountry)?.name || 'Worldwide';

  // Fetch video categories
  useEffect(() => {
    fetch(`${API_BASE}/news/video-categories`)
      .then(r => r.json())
      .then(setVideoCategories)
      .catch(console.error);
  }, []);

  // Fetch videos when category or country changes
  const fetchVideos = useCallback(async (cat) => {
    setVideosLoading(true);
    try {
      const region = localStorage.getItem('news_country') || 'wt-wt';
      const res = await fetch(`${API_BASE}/news/videos?category=${cat}&region=${region}`);
      if (!res.ok) throw new Error('Failed to fetch videos');
      const data = await res.json();
      setVideos(data);
    } catch (err) {
      console.error('Video fetch error:', err);
    } finally {
      setVideosLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVideos(activeVideoCategory);
  }, [activeVideoCategory, selectedCountry, fetchVideos]);

  // Fetch categories
  useEffect(() => {
    fetch(`${API_BASE}/news/categories`)
      .then(r => r.json())
      .then(setCategories)
      .catch(console.error);
  }, []);

  // Fetch feed
  const fetchFeed = useCallback(async (category, isRefresh = false) => {
    if (category === 'videos') { setLoading(false); return; }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const region = localStorage.getItem('news_country') || 'wt-wt';
      const endpoint = isRefresh ? `${API_BASE}/news/refresh` : `${API_BASE}/news/feed?category=${category}&region=${region}`;
      const options = isRefresh
        ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category, region }) }
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

  // Initial load & category/country change
  useEffect(() => {
    fetchFeed(activeCategory);
  }, [activeCategory, selectedCountry, fetchFeed]);

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
        body: JSON.stringify({ query: searchQuery.trim(), type: searchTab, region: selectedCountry }),
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

      {/* Location Details Bar */}
      {geoInfo?.detected && (
        <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800/80 dark:to-gray-800/40 border border-blue-100 dark:border-gray-700/50 text-xs">
          <span className="flex items-center gap-1.5 font-semibold text-blue-600 dark:text-blue-400">
            <Navigation className="w-3.5 h-3.5" />
            Your Location
          </span>
          {geoInfo.city && (
            <span className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
              <MapPin className="w-3 h-3 text-red-400" />
              {geoInfo.city}{geoInfo.regionName ? `, ${geoInfo.regionName}` : ''}
            </span>
          )}
          <span className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
            <Globe className="w-3 h-3 text-emerald-500" />
            {geoInfo.country}
          </span>
          {geoInfo.timezone && (
            <span className="text-gray-500 dark:text-gray-400">
              🕐 {geoInfo.timezone}
            </span>
          )}
          {geoInfo.isp && (
            <span className="text-gray-500 dark:text-gray-400 hidden sm:inline">
              📡 {geoInfo.isp}
            </span>
          )}
          {geoInfo.ip && (
            <span className="text-gray-400 dark:text-gray-500 hidden md:inline font-mono">
              IP: {geoInfo.ip}
            </span>
          )}
        </div>
      )}

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
          {/* Country Selector */}
          <div className="relative" ref={countryRef}>
            <button
              onClick={() => setCountryOpen(!countryOpen)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <MapPin className="w-4 h-4 text-orange-500" />
              <span className="max-w-[100px] truncate">{countryName}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${countryOpen ? 'rotate-180' : ''}`} />
            </button>
            {countryOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 max-h-72 overflow-y-auto bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50">
                <div className="sticky top-0 bg-white dark:bg-gray-800 p-2 border-b border-gray-100 dark:border-gray-700">
                  <input
                    type="text"
                    placeholder="Search country..."
                    className="w-full px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 border-none outline-none placeholder-gray-400"
                    onChange={(e) => {
                      const q = e.target.value.toLowerCase();
                      const list = countryRef.current?.querySelector('.country-list');
                      if (list) {
                        Array.from(list.children).forEach(el => {
                          el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none';
                        });
                      }
                    }}
                    autoFocus
                  />
                </div>
                <div className="country-list p-1">
                  {countries.map(c => (
                    <button
                      key={c.code}
                      onClick={() => handleCountryChange(c.code)}
                      className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                        selectedCountry === c.code
                          ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 font-medium'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* Site Stats */}
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs font-medium">
            <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
              <Eye className="w-3.5 h-3.5" />
              <span className="font-semibold text-gray-700 dark:text-gray-200">{siteStats.totalVisits.toLocaleString()}</span> visits
            </span>
            <span className="w-px h-4 bg-gray-300 dark:bg-gray-600" />
            <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
              </span>
              <span className="font-semibold text-green-600 dark:text-green-400">{siteStats.liveUsers}</span> live
            </span>
          </div>
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
      {loading && activeCategory !== 'videos' && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">Fetching latest news with AI...</p>
        </div>
      )}

      {/* Feed Content */}
      {(activeCategory === 'videos' || (!loading && feed)) && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          {/* Hero Section — Featured carousel */}
          {activeCategory !== 'videos' && heroArticles.length > 0 && (
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
          {activeCategory !== 'videos' && (
          <>
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
          </>
          )}

          {/* ── Video Streaming Section ──────────────────────────── */}
          <div className={activeCategory === 'videos' ? 'mb-8' : 'mt-12 mb-8'}>
            {/* Section Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 shadow-lg">
                <Play className="w-5 h-5 text-white" fill="white" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                  Trending Videos
                  <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">FREE</span>
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  YouTube & web videos from {countryName}
                </p>
              </div>
            </div>

            {/* Video Category tabs */}
            <div className="flex gap-2 overflow-x-auto pb-3 mb-5 scrollbar-hide">
              {videoCategories.map(cat => {
                const Icon = VIDEO_CAT_ICONS[cat.id] || Play;
                const isActive = activeVideoCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveVideoCategory(cat.id)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                      isActive
                        ? `bg-gradient-to-r ${VIDEO_CAT_COLORS[cat.id] || 'from-red-500 to-rose-500'} text-white shadow-md`
                        : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {cat.label.replace(/^[^\s]+\s/, '')}
                  </button>
                );
              })}
            </div>

            {/* Videos Loading */}
            {videosLoading && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-500 dark:text-gray-400 text-sm">Loading videos...</p>
              </div>
            )}

            {/* Videos Grid */}
            {!videosLoading && videos?.videos?.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {videos.videos.map((video, idx) => (
                  <VideoCard key={`${video.youtubeId || idx}`} video={video} onPlay={setPlayingVideo} />
                ))}
              </div>
            )}

            {/* No videos */}
            {!videosLoading && videos && videos.videos?.length === 0 && (
              <div className="flex flex-col items-center py-12 text-gray-400">
                <Film className="w-12 h-12 mb-3 opacity-30" />
                <p className="font-medium">No videos found</p>
                <p className="text-sm mt-1">Try a different category</p>
              </div>
            )}
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

      {/* ── YouTube Video Player Modal ─────────────────────────── */}
      <AnimatePresence>
        {playingVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
            onClick={() => setPlayingVideo(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-5xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-semibold text-lg line-clamp-1 flex-1 mr-4">
                  {playingVideo.title}
                </h3>
                <button
                  onClick={() => setPlayingVideo(null)}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Video embed */}
              {playingVideo.isYouTube && playingVideo.youtubeId ? (
                <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    src={`https://www.youtube.com/embed/${playingVideo.youtubeId}?autoplay=1&rel=0`}
                    title={playingVideo.title}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : playingVideo.embed_url ? (
                <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    src={playingVideo.embed_url}
                    title={playingVideo.title}
                    className="absolute inset-0 w-full h-full"
                    allow="autoplay; fullscreen"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="relative w-full rounded-xl overflow-hidden bg-gray-900 flex items-center justify-center" style={{ paddingBottom: '56.25%' }}>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-white/60 text-sm mb-3">This video cannot be embedded</p>
                    <a
                      href={playingVideo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors flex items-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" /> Watch on {playingVideo.publisher}
                    </a>
                  </div>
                </div>
              )}

              {/* Video info */}
              <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="text-white/60 text-sm">{playingVideo.publisher}{playingVideo.uploader && playingVideo.uploader !== playingVideo.publisher ? ` • ${playingVideo.uploader}` : ''}</p>
                  <div className="flex items-center gap-3 text-white/40 text-xs mt-1">
                    {playingVideo.duration && <span>{playingVideo.duration}</span>}
                    {playingVideo.views && <span>{Number(playingVideo.views).toLocaleString()} views</span>}
                    {playingVideo.published && <span>{playingVideo.published}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  {playingVideo.url && (
                    <a
                      href={playingVideo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs hover:bg-white/20 transition-colors flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" /> Open original
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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

// ── Video Card Component ────────────────────────────────────────────
function VideoCard({ video, onPlay }) {
  const [imgError, setImgError] = useState(false);

  const formatDuration = (dur) => {
    if (!dur) return '';
    // Already formatted like "5:30" or "1:23:45"
    if (/^\d+:\d+/.test(dur)) return dur;
    return dur;
  };

  const formatViews = (views) => {
    if (!views) return '';
    const n = Number(views);
    if (isNaN(n)) return views;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M views`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K views`;
    return `${n} views`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:shadow-xl hover:shadow-gray-200/50 dark:hover:shadow-gray-900/50 transition-all duration-300 hover:-translate-y-1 cursor-pointer"
      onClick={() => onPlay(video)}
    >
      {/* Thumbnail */}
      <div className="relative overflow-hidden" style={{ paddingBottom: '56.25%' }}>
        {video.thumbnail && !imgError ? (
          <img
            src={video.thumbnail}
            alt={video.title}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center">
            <Film className="w-10 h-10 text-gray-400" />
          </div>
        )}

        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-red-600/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 scale-75 group-hover:scale-100 shadow-2xl">
            <Play className="w-6 h-6 text-white ml-1" fill="white" />
          </div>
        </div>

        {/* Duration badge */}
        {video.duration && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-white text-[11px] font-medium">
            {formatDuration(video.duration)}
          </div>
        )}

        {/* YouTube badge */}
        {video.isYouTube && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-600/90 text-white text-[10px] font-bold">
            <Youtube className="w-3 h-3" />
            YouTube
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h4 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors mb-1.5">
          {video.title}
        </h4>
        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <span className="font-medium truncate max-w-[120px]">{video.publisher || video.uploader}</span>
          {video.views && <span>· {formatViews(video.views)}</span>}
        </div>
        {video.published && (
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">{video.published}</p>
        )}
      </div>
    </motion.div>
  );
}
