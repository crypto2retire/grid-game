import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.resolve(scriptDir, '../dist/server.js');
let source = await readFile(serverPath, 'utf8');

const staticCall = "app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));";
const staticReplacement = `app.use(express_1.default.static(path_1.default.join(__dirname, '../public'), {
    setHeaders(res, filePath) {
        if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
        else if (filePath.includes(path_1.default.sep + 'assets' + path_1.default.sep)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    },
}));`;

if (!source.includes(staticCall)) {
  throw new Error('Unable to locate compiled static middleware in dist/server.js');
}
source = source.split(staticCall).join(staticReplacement);

const fallbackGuard = "if (req.path.startsWith('/api') || req.path === '/health') {";
const hardenedGuard = "if (req.path.startsWith('/api') || req.path === '/health' || req.path.startsWith('/assets/') || /\\.[a-z0-9]+$/i.test(req.path)) {";
if (!source.includes(fallbackGuard)) {
  throw new Error('Unable to locate compiled SPA fallback guard in dist/server.js');
}
source = source.replace(fallbackGuard, hardenedGuard);

await writeFile(serverPath, source);
console.log('Patched production static caching and missing-asset fallback behavior.');
