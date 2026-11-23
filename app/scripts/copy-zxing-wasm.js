// Copies the QR decoder used by the web camera fallback (zxing-wasm, via barcode-detector)
// into public/, so the site serves it itself instead of loading it from a public CDN.
// Runs on `npm install` (postinstall). The loader is pointed at it in src/core/index.web.ts.
const fs = require('fs');
const path = require('path');

// zxing-wasm does not export its package.json, so locate the package from barcode-detector's copy.
function zxingDir() {
    const from = path.dirname(require.resolve('barcode-detector'));
    let dir = from;
    while (dir !== path.dirname(dir)) {
        const candidate = path.join(dir, 'node_modules', 'zxing-wasm');
        if (fs.existsSync(candidate)) return candidate;
        dir = path.dirname(dir);
    }
    throw new Error('zxing-wasm not found; run npm install');
}

const src = path.join(zxingDir(), 'dist', 'reader', 'zxing_reader.wasm');
const dest = path.join(__dirname, '..', 'public', 'zxing_reader.wasm');

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log(`copied ${path.relative(process.cwd(), dest)}`);
