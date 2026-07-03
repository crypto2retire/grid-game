import { useState, createContext, useContext, useEffect, type ReactNode, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft, Maximize2, Minimize2 } from 'lucide-react';

export type PanelMode = 'side-panel' | 'interior' | 'modal';

export interface Panel {
  id: string;
  title: string;
  buildingId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  minimized: boolean;
  maximized: boolean;
  mode?: PanelMode;
  content: ReactNode;
}

interface PanelContextValue {
  panels: Panel[];
  openPanel: (panel: Omit<Panel, 'zIndex'>) => void;
  closePanel: (id: string) => void;
  closeAllPanels: () => void;
  activePanel: string | null;
}

const PanelContext = createContext<PanelContextValue | null>(null);

export function usePanels() {
  const ctx = useContext(PanelContext);
  if (!ctx) throw new Error('usePanels must be inside PanelProvider');
  return ctx;
}

let zCounter = 100;

export function PanelProvider({ children }: { children: ReactNode }) {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [activePanel, setActivePanel] = useState<string | null>(null);

  const openPanel = useCallback((panel: Omit<Panel, 'zIndex'>) => {
    zCounter += 1;
    setPanels((prev) => {
      const existing = prev.find((p) => p.id === panel.id);
      if (existing) {
        return prev.map((p) => (p.id === panel.id ? { ...p, zIndex: zCounter, minimized: false, content: panel.content } : p));
      }
      return [{ ...panel, zIndex: zCounter }];
    });
    setActivePanel(panel.id);
  }, []);

  const closePanel = useCallback((id: string) => {
    setPanels((prev) => prev.filter((p) => p.id !== id));
    if (activePanel === id) setActivePanel(null);
  }, [activePanel]);

  const closeAllPanels = useCallback(() => {
    setPanels([]);
    setActivePanel(null);
  }, []);

  // Close panels on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setPanels((prev) => {
          if (prev.length === 0) return prev;
          const topmost = [...prev].sort((a, b) => b.zIndex - a.zIndex)[0];
          if (topmost) {
            const next = prev.filter((p) => p.id !== topmost.id);
            setActivePanel(next.length > 0 ? next[next.length - 1].id : null);
            return next;
          }
          return prev;
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <PanelContext.Provider
      value={{ panels, openPanel, closePanel, closeAllPanels, activePanel }}
    >
      {children}
    </PanelContext.Provider>
  );
}

export function PanelOverlay() {
  const { panels, closePanel } = usePanels();
  const [isMaximized, setIsMaximized] = useState(false);
  const topPanel = panels.length > 0 ? [...panels].sort((a, b) => b.zIndex - a.zIndex)[0] : null;

  // Calculate responsive width
  const getWidth = () => {
    if (!topPanel) return 420;
    if (isMaximized) return Math.min(window.innerWidth * 0.95, 1200);
    const requested = topPanel.width || 700;
    const max = Math.min(window.innerWidth * 0.9, 1000);
    const min = 480;
    return Math.max(min, Math.min(requested, max));
  };

  const width = getWidth();

  return (
    <AnimatePresence>
      {topPanel && topPanel.mode === 'interior' && (
        <motion.div
          key={topPanel.id}
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.985 }}
          transition={{ duration: 0.22 }}
          className="fixed inset-0 bg-[#06101d] z-20 overflow-hidden"
        >
          {topPanel.content}
        </motion.div>
      )}
      {topPanel && topPanel.mode !== 'interior' && (
        <>
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-10"
            onClick={() => closePanel(topPanel.id)}
          />
          <motion.div
            key={topPanel.id}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed top-0 right-0 bottom-0 border-l border-white/10 bg-[#0a0f1a]/98 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col z-20"
            style={{ width: `${width}px` }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0f172a]/80 select-none shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => closePanel(topPanel.id)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors shrink-0"
                  title="Close panel"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="w-2 h-2 rounded-full bg-[#E94560] shrink-0 animate-pulse" />
                <span className="text-sm font-bold text-white truncate">{topPanel.title}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setIsMaximized(!isMaximized)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                  title={isMaximized ? 'Restore' : 'Maximize'}
                >
                  {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => closePanel(topPanel.id)}
                  className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 min-w-0">
              {topPanel.content}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
