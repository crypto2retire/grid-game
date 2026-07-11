import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

const CHUNK_RELOAD_KEY = 'grid-chunk-reload-attempted';

function recoverFromStaleChunk(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  const isChunkFailure =
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('not a valid JavaScript MIME type') ||
    message.includes('Loading chunk');

  if (!isChunkFailure || sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1') return;
  sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
  window.location.reload();
}

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  recoverFromStaleChunk((event as CustomEvent).payload);
});

window.addEventListener('error', (event) => recoverFromStaleChunk(event.error || event.message));
window.addEventListener('unhandledrejection', (event) => recoverFromStaleChunk(event.reason));
window.setTimeout(() => sessionStorage.removeItem(CHUNK_RELOAD_KEY), 5000);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);