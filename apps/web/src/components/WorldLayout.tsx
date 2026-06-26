import { useState } from 'react';
import { Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, MapPin, X } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import Navbar from './Navbar';
import GameWorld from './world/GameWorld';

export default function WorldLayout() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [showWorld, setShowWorld] = useState(true);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E94560]"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const isInBuilding = location.pathname !== '/city' && location.pathname !== '/dashboard';

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col grid-pattern">
      <Navbar />
      
      {/* World Navigation Bar */}
      <div className="border-b border-white/10 bg-black/40 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#E94560]" />
            <span className="text-sm font-bold text-white">City View</span>
            <span className="text-xs text-slate-500">Click buildings to navigate</span>
          </div>
          <div className="flex items-center gap-2">
            {isInBuilding && (
              <button
                onClick={() => navigate('/city')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#E94560]/10 border border-[#E94560]/30 px-3 py-1.5 text-xs font-bold text-[#E94560] hover:bg-[#E94560]/20 transition-colors"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to City
              </button>
            )}
            <button
              onClick={() => setShowWorld(!showWorld)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-bold text-slate-400 hover:bg-white/10 transition-colors"
            >
              {showWorld ? <X className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
              {showWorld ? 'Hide' : 'Show'} Map
            </button>
          </div>
        </div>
        
        <AnimatePresence>
          {showWorld && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="h-[320px] max-h-[40vh]">
                <GameWorld />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
