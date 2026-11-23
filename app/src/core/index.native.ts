// Android: the Go core, bound with gomobile and exposed as the local Expo module
// "QuickPayCore" (app/modules/quickpay-core). It is only present in a development/release
// build. In Expo Go, on iOS (not built yet) and anywhere the module is missing, fall back to
// a TS port so the UI still runs. That fallback does NOT encrypt (see docs/ARCHITECTURE.md).
import { requireOptionalNativeModule } from 'expo';
import { tsFallback } from './fallback';
import type { Core, Doc } from './types';

type Native = Record<string, (...args: string[]) => string>;

/** Expo wraps native errors ("Call to function ... rejected. -> Caused by: msg"); keep just msg. */
function clean(e: unknown): Error {
  const raw = e instanceof Error ? e.message : String(e);
  const tail = raw.split(/Caused by:\s*/i).pop() ?? raw;
  return new Error(tail.replace(/^[\s→>-]+/, '').split('\n')[0].trim() || 'Something went wrong');
}

export async function initCore(): Promise<Core> {
  const m = requireOptionalNativeModule<Native>('QuickPayCore');
  if (!m) return tsFallback;
  // Same JSON contract as the Go package: documents travel as JSON strings.
  const call = (name: string, ...args: string[]): string => {
    try {
      return m[name](...args);
    } catch (e) {
      throw clean(e);
    }
  };
  const j = <T>(s: string): T => JSON.parse(s);
  const native: Core = {
    encrypted: true,
    engine: 'go-native',
    parseQR: (p) => j(call('parseQR', p)),
    newDocument: () => j(call('newDocument')),
    addProfile: (d, l, p) => j(call('addProfile', JSON.stringify(d), l, p)),
    removeProfile: (d, id) => j(call('removeProfile', JSON.stringify(d), id)),
    setDefaultProfile: (d, id) => j(call('setDefaultProfile', JSON.stringify(d), id)),
    renameProfile: (d, id, l) => j(call('renameProfile', JSON.stringify(d), id, l)),
    generateKey: () => call('generateKey'),
    sealDocument: (k, d: Doc) => call('sealDocument', k, JSON.stringify(d)),
    openDocument: (k, s) => j(call('openDocument', k, s)),
  };
  return native;
}
