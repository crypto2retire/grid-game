import { useEffect, useState } from 'react';
import { Building2, ChevronRight, CircleHelp, Radio, Trophy, X } from 'lucide-react';
import { usePanels } from './PanelSystem';
import './SportsWorldChrome.css';

const controls = [
  { key: 'WASD', label: 'Move' },
  { key: 'CLICK', label: 'Travel' },
  { key: 'E', label: 'Enter' },
  { key: 'ESC', label: 'Back' },
];

export default function SportsWorldChrome() {
  const { panels, closeAllPanels } = usePanels();
  const [helpOpen, setHelpOpen] = useState(false);
  const activePanel = panels.length > 0 ? [...panels].sort((a, b) => b.zIndex - a.zIndex)[0] : null;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === '?') setHelpOpen((open) => !open);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="sports-world-chrome pointer-events-none fixed inset-0 z-[8] select-none" aria-hidden={false}>
      <div className="sports-world-vignette" />
      <div className="sports-world-scanlines" />

      <header className="sports-broadcast-header pointer-events-auto">
        <div className="sports-brand-lockup">
          <div className="sports-brand-mark"><Trophy className="h-4 w-4" /></div>
          <div>
            <div className="sports-brand-kicker">GRID SPORTS NETWORK</div>
            <div className="sports-brand-title">FRANCHISE DISTRICT</div>
          </div>
        </div>

        <div className="sports-live-chip">
          <Radio className="h-3.5 w-3.5" />
          <span>LIVE WORLD</span>
        </div>

        <button type="button" className="sports-help-button" onClick={() => setHelpOpen((open) => !open)} aria-expanded={helpOpen}>
          <CircleHelp className="h-4 w-4" />
          <span>Controls</span>
        </button>
      </header>

      {activePanel && (
        <div className="sports-location-ribbon pointer-events-auto">
          <div className="sports-location-icon"><Building2 className="h-4 w-4" /></div>
          <div className="min-w-0">
            <div className="sports-location-kicker">NOW VISITING</div>
            <div className="sports-location-title">{activePanel.title}</div>
          </div>
          <ChevronRight className="h-4 w-4 text-cyan-200/70" />
          <button type="button" onClick={closeAllPanels} className="sports-location-close" aria-label="Return to the sports district">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className={`sports-controls-drawer pointer-events-auto ${helpOpen ? 'is-open' : ''}`}>
        <div className="sports-controls-heading">
          <div>
            <div className="sports-controls-kicker">FIELD MANUAL</div>
            <div className="sports-controls-title">Explore the district</div>
          </div>
          <button type="button" onClick={() => setHelpOpen(false)} aria-label="Close controls"><X className="h-4 w-4" /></button>
        </div>
        <p>Move between facilities, approach a highlighted entrance, then press E to open that building. Your stadium, gym, market, medical center and team headquarters all represent playable management loops.</p>
        <div className="sports-control-grid">
          {controls.map((control) => (
            <div key={control.key} className="sports-control-item">
              <kbd>{control.key}</kbd>
              <span>{control.label}</span>
            </div>
          ))}
        </div>
      </div>

      <footer className="sports-control-strip">
        {controls.map((control) => (
          <div key={control.key} className="sports-control-hint">
            <kbd>{control.key}</kbd>
            <span>{control.label}</span>
          </div>
        ))}
      </footer>
    </div>
  );
}
