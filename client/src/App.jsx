import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Upload from './pages/Upload';
import Albums from './pages/Albums';
import AlbumView from './pages/AlbumView';
import VirtualTryOn from './pages/VirtualTryOn';
import Settings from './pages/Settings';
import AIAgent from './pages/AIAgent';
import NewsFeed from './pages/NewsFeed';
import { useAuth } from './context/AuthContext';

export default function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-20">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/albums" element={<Albums />} />
          <Route path="/albums/:id" element={<AlbumView />} />
          <Route path="/tryon" element={<VirtualTryOn />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/agent" element={<AIAgent />} />
          <Route path="/news" element={<NewsFeed />} />
        </Routes>
      </main>
    </div>
  );
}
