import { useState, createContext, useContext, useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft } from 'lucide-react';

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

  const openPanel = (panel: Omit<Panel, 'zIndex'>) => {
    zCounter += 1;
    setPanels((prev) => {
      const existing = prev.find((p) => p.id === panel.id);
      if (existing) {
        // Update existing panel and bring to front
        return prev.map((p) => (p.id === panel.id ? { ...p, zIndex: zCounter, minimized: false, content: panel.content } : p));
      }
      // Replace any existing panel with the new one (only one panel open at a time)
      return [
        {
          ...panel,
          zIndex: zCounter,
        },
      ];
    });
    setActivePanel(panel.id);
  };

  const closePanel = (id: string) => {
    setPanels((prev) => prev.filter((p) => p.id !== id));
    if (activePanel === id) setActivePanel(null);
  };

  const closeAllPanels = () => {
    setPanels([]);
    setActivePanel(null);
  };

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
  const topPanel = panels.length > 0 ? [...panels].sort((a, b) => b.zIndex - a.zIndex)[0] : null;

  return (
    <AnimatePresence>
      {topPanel && (
        <motion.div
          key={topPanel.id}
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed top-10 right-0 bottom-10 w-[420px] max-w-full border-l border-white/10 bg-[#0f172a]/95 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col z-20"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5 select-none">
            <div className="flex items-center gap-3">
              <button
                onClick={() => closePanel(topPanel.id)}
                className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="w-2 h-2 rounded-full bg-[#E94560]" />
              <span className="text-sm font-bold text-white">{topPanel.title}</span>
            </div>
            <button
              onClick={() => closePanel(topPanel.id)}
              className="p-1 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-4">
            {topPanel.content}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
