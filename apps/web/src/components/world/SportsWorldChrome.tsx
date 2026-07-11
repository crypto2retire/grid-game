import { useEffect, useState } from 'react';
import { CircleHelp, MapPin, X } from 'lucide-react';
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
    <div className="sports-world-chrome pointer-events-none fixed inset-0 z-[8] select-none">
      <div className="sports-world-edge-shade" />

      <div className="sports-brand-plate">
        <span className="sports-brand-monogram">G</span>
        <span className="sports-brand-copy">
          <strong>GRID</strong>
          <small>Franchise Campus</small>
        </span>
      </div>

      <button
        type="button"
        className="sports-help-button pointer-events-auto"
        onClick={() => setHelpOpen((open) => !open)}
        aria-expanded={helpOpen}
      >
        <CircleHelp className="h-4 w-4" />
        <span>Controls</span>
      </button>

      {activePanel && (
        <div className="sports-location-ribbon pointer-events-auto">
          <MapPin className="h-4 w-4" />
          <div className="min-w-0">
            <small>Current facility</small>
            <strong>{activePanel.title}</strong>
          </div>
          <button type="button" onClick={closeAllPanels} aria-label="Return to campus">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className={`sports-controls-drawer pointer-events-auto ${helpOpen ? 'is-open' : ''}`}>
        <div className="sports-controls-heading">
          <div>
            <small>Field guide</small>
            <strong>Explore the campus</strong>
          </div>
          <button type="button" onClick={() => setHelpOpen(false)} aria-label="Close controls"><X className="h-4 w-4" /></button>
        </div>
        <p>Walk to a facility and press E when its entrance highlights. Each building opens a different management system.</p>
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
