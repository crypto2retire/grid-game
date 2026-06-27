import { useState, createContext, useContext, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Maximize2 } from 'lucide-react';

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
  minimizePanel: (id: string) => void;
  maximizePanel: (id: string) => void;
  bringToFront: (id: string) => void;
  movePanel: (id: string, x: number, y: number) => void;
  resizePanel: (id: string, width: number, height: number) => void;
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
      // Add new panel with staggered position
      const offset = prev.length * 20;
      return [
        ...prev,
        {
          ...panel,
          x: Math.min(panel.x + offset, window.innerWidth - panel.width - 40),
          y: Math.min(panel.y + offset, window.innerHeight - panel.height - 40),
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

  const minimizePanel = (id: string) => {
    setPanels((prev) => prev.map((p) => (p.id === id ? { ...p, minimized: !p.minimized } : p)));
  };

  const maximizePanel = (id: string) => {
    setPanels((prev) => prev.map((p) => (p.id === id ? { ...p, maximized: !p.maximized } : p)));
  };

  const bringToFront = (id: string) => {
    zCounter += 1;
    setPanels((prev) => prev.map((p) => (p.id === id ? { ...p, zIndex: zCounter, minimized: false } : p)));
    setActivePanel(id);
  };

  const movePanel = (id: string, x: number, y: number) => {
    setPanels((prev) => prev.map((p) => (p.id === id ? { ...p, x: Math.max(0, x), y: Math.max(0, y) } : p)));
  };

  const resizePanel = (id: string, width: number, height: number) => {
    setPanels((prev) => prev.map((p) => (p.id === id ? { ...p, width, height } : p)));
  };

  return (
    <PanelContext.Provider
      value={{ panels, openPanel, closePanel, minimizePanel, maximizePanel, bringToFront, movePanel, resizePanel, activePanel }}
    >
      {children}
    </PanelContext.Provider>
  );
}

export function PanelWindow({ panel }: { panel: Panel }) {
  const { closePanel, minimizePanel, maximizePanel, bringToFront, movePanel } = usePanels();
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [panelPos, setPanelPos] = useState({ x: panel.x, y: panel.y });

  if (panel.minimized) {
    return (
      <motion.button
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={() => bringToFront(panel.id)}
        className="fixed bottom-4 left-4 z-50 px-4 py-2 rounded-xl bg-card/90 border border-white/10 backdrop-blur-md text-sm font-bold text-white shadow-lg hover:bg-card/100 transition-colors"
        style={{ left: panel.x }}
      >
        {panel.title}
      </motion.button>
    );
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.panel-no-drag')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panelPos.x, y: e.clientY - panelPos.y });
    bringToFront(panel.id);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    setPanelPos({ x: newX, y: newY });
    movePanel(panel.id, newX, newY);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const w = panel.maximized ? Math.min(900, window.innerWidth - 40) : panel.width;
  const h = panel.maximized ? Math.min(700, window.innerHeight - 40) : panel.height;
  const x = panel.maximized ? (window.innerWidth - w) / 2 : panelPos.x;
  const y = panel.maximized ? (window.innerHeight - h) / 2 : panelPos.y;

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.9, opacity: 0, y: 20 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="fixed rounded-2xl border border-white/10 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col"
      style={{
        left: x,
        top: y,
        width: w,
        height: h,
        zIndex: panel.zIndex,
        cursor: isDragging ? 'grabbing' : 'default',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Title Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-white/5 select-none" style={{ cursor: 'grab' }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#E94560]" />
          <span className="text-sm font-bold text-white">{panel.title}</span>
        </div>
        <div className="flex items-center gap-1 panel-no-drag">
          <button onClick={() => minimizePanel(panel.id)} className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => maximizePanel(panel.id)} className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => closePanel(panel.id)} className="p-1 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {panel.content}
      </div>
    </motion.div>
  );
}

export function PanelOverlay() {
  const { panels } = usePanels();
  return (
    <AnimatePresence>
      {panels.map((panel) => (
        <PanelWindow key={panel.id} panel={panel} />
      ))}
    </AnimatePresence>
  );
}
