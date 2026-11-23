// Android/iOS: prefer the gomobile-bound Go core exposed as the native module
// "QuickPayCore" (see docs/ARCHITECTURE.md, "Native bridge"). Until that module
// is built, fall back to a TS port so the UI runs in Expo Go / dev clients.
import { NativeModules } from 'react-native';
import { tsFallback } from './fallback';
import type { Core, Doc } from './types';

export async function initCore(): Promise<Core> {
  const m = NativeModules.QuickPayCore;
  if (!m) return tsFallback;
  // Native modules marshal strings synchronously via JSI (see docs). Same JSON contract as Go.
  const j = (s: string) => JSON.parse(s);
  const native: Core = {
    encrypted: true,
    engine: 'go-native',
    parseQR: (p) => j(m.parseQR(p)),
    newDocument: () => j(m.newDocument()),
    addProfile: (d, l, p) => j(m.addProfile(JSON.stringify(d), l, p)),
    removeProfile: (d, id) => j(m.removeProfile(JSON.stringify(d), id)),
    setDefaultProfile: (d, id) => j(m.setDefaultProfile(JSON.stringify(d), id)),
    renameProfile: (d, id, l) => j(m.renameProfile(JSON.stringify(d), id, l)),
    generateKey: () => m.generateKey(),
    sealDocument: (k, d: Doc) => m.sealDocument(k, JSON.stringify(d)),
    openDocument: (k, s) => j(m.openDocument(k, s)),
  };
  return native;
}
