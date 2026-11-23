// Web: the Go core compiled to WebAssembly (public/quickpay.wasm + wasm_exec.js).
import type { Core, Doc, Parsed } from './types';
import { setZXingModuleOverrides } from 'barcode-detector/ponyfill';

// Browsers without a built-in BarcodeDetector (Chrome/Edge on Windows, Firefox) make expo-camera
// fall back to the zxing-wasm decoder, which by default downloads its .wasm from a public CDN.
// Serve our own copy (public/zxing_reader.wasm, copied on npm install) so no third-party code
// runs on this origin and the Content-Security-Policy in public/_headers can stay 'self'.
setZXingModuleOverrides({
  locateFile: (file: string, prefix: string) => (file.endsWith('.wasm') ? '/zxing_reader.wasm' : prefix + file),
});

type R = { ok: boolean; value?: string; error?: string };
declare const Go: new () => { importObject: WebAssembly.Imports; run(i: WebAssembly.Instance): Promise<void> };

let api: Record<string, (...a: string[]) => R> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => res();
    s.onerror = () => rej(new Error(`failed to load ${src}`));
    document.head.appendChild(s);
  });
}

export async function initCore(): Promise<Core> {
  await loadScript('/wasm_exec.js');
  const go = new Go();
  const resp = fetch('/quickpay.wasm');
  const { instance } = await WebAssembly.instantiateStreaming(resp, go.importObject);
  void go.run(instance); // never resolves; Go registers globalThis.quickpay and blocks
  for (let i = 0; i < 100 && !(globalThis as any).quickpay; i++) await new Promise((r) => setTimeout(r, 10));
  api = (globalThis as any).quickpay;
  if (!api) throw new Error('Go core did not start');
  return core;
}

function call(fn: string, ...args: string[]): string {
  const r = api![fn](...args);
  if (!r.ok) throw new Error(r.error);
  return r.value!;
}

const core: Core = {
  encrypted: true,
  engine: 'go-wasm',
  parseQR: (p) => JSON.parse(call('parseQR', p)) as Parsed,
  newDocument: () => JSON.parse(call('newDocument', '')) as Doc,
  addProfile: (d, l, p) => JSON.parse(call('addProfile', JSON.stringify(d), l, p)),
  removeProfile: (d, id) => JSON.parse(call('removeProfile', JSON.stringify(d), id)),
  setDefaultProfile: (d, id) => JSON.parse(call('setDefaultProfile', JSON.stringify(d), id)),
  renameProfile: (d, id, l) => JSON.parse(call('renameProfile', JSON.stringify(d), id, l)),
  generateKey: () => call('generateKey', ''),
  sealDocument: (k, d) => call('sealDocument', k, JSON.stringify(d)),
  openDocument: (k, s) => JSON.parse(call('openDocument', k, s)),
};
