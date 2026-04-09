import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Menu, X, Sun, Moon, Upload, LogOut, User, FolderOpen, Sparkles, Settings, Bot, Newspaper } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
    setMenuOpen(false);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-strong">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/25 group-hover:shadow-violet-500/40 transition-shadow">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-400 dark:to-indigo-400 bg-clip-text text-transparent">
              Lumina
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-2">
            <Link to="/" className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5 text-orange-600 dark:text-orange-400">
              <Newspaper className="w-4 h-4" /> News
            </Link>
            <Link to="/gallery" className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              Gallery
            </Link>
            <Link to="/albums" className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              Albums
            </Link>
            {user && (
              <Link to="/upload" className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5">
                <Upload className="w-4 h-4" /> Upload
              </Link>
            )}
            {user && (
              <Link to="/tryon" className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5 text-violet-600 dark:text-violet-400">
                <Sparkles className="w-4 h-4" /> Try-On
              </Link>
            )}
            {user && (
              <Link to="/agent" className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <Bot className="w-4 h-4" /> Agent
              </Link>
            )}

            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

            <button onClick={toggle} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {user ? (
              <div className="flex items-center gap-2 ml-1">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800">
                  <User className="w-4 h-4 text-violet-500" />
                  <span className="text-sm font-medium">{user.username}</span>
                </div>
                <button onClick={handleLogout} className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-950 text-red-500 transition-colors">
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 ml-1">
                <Link to="/login" className="btn-secondary text-sm !px-4 !py-2">Login</Link>
                <Link to="/register" className="btn-primary text-sm !px-4 !py-2">Sign Up</Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800">
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden overflow-hidden glass-strong border-t border-gray-200 dark:border-gray-800"
          >
            <div className="px-4 py-3 space-y-1">
              <Link to="/" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 font-medium text-orange-600 dark:text-orange-400">
                <Newspaper className="w-4 h-4" /> News
              </Link>
              <Link to="/gallery" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 font-medium">
                Gallery
              </Link>
              <Link to="/albums" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 font-medium">
                <FolderOpen className="w-4 h-4" /> Albums
              </Link>
              {user && (
                <Link to="/upload" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 font-medium">
                  <Upload className="w-4 h-4" /> Upload
                </Link>
              )}
              {user && (
                <Link to="/tryon" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 font-medium text-violet-600 dark:text-violet-400">
                  <Sparkles className="w-4 h-4" /> Virtual Try-On
                </Link>
              )}
              {user && (
                <Link to="/agent" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 font-medium text-emerald-600 dark:text-emerald-400">
                  <Bot className="w-4 h-4" /> AI Agent
                </Link>
              )}
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm text-gray-500">Theme</span>
                <button onClick={toggle} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800">
                  {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                {user ? (
                  <button onClick={handleLogout} className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950 text-red-500 font-medium">
                    <LogOut className="w-4 h-4" /> Logout ({user.username})
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <Link to="/login" onClick={() => setMenuOpen(false)} className="btn-secondary flex-1 text-center text-sm">Login</Link>
                    <Link to="/register" onClick={() => setMenuOpen(false)} className="btn-primary flex-1 text-center text-sm">Sign Up</Link>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
