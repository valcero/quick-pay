export type Kind = 'upi' | 'emv' | 'generic';

export interface Parsed {
  kind: Kind;
  normalized: string;
  vpa?: string;
  payeeName?: string;
  amount?: string;
  displayName: string;
  warnings?: string[];
}

export interface Profile {
  id: string;
  label: string;
  payload: string;
  kind: Kind;
  color: string;
  createdAt: string;
}

export interface Doc {
  version: number;
  defaultId: string;
  profiles: Profile[];
}

/** Same surface as Go's core/bridge package. Methods throw Error on failure. */
export interface Core {
  /** false when running the TS dev fallback (no real encryption). */
  readonly encrypted: boolean;
  readonly engine: 'go-wasm' | 'go-native' | 'ts-fallback';
  parseQR(payload: string): Parsed;
  newDocument(): Doc;
  addProfile(doc: Doc, label: string, payload: string): Doc;
  removeProfile(doc: Doc, id: string): Doc;
  setDefaultProfile(doc: Doc, id: string): Doc;
  renameProfile(doc: Doc, id: string, label: string): Doc;
  generateKey(): string;
  sealDocument(keyHex: string, doc: Doc): string;
  openDocument(keyHex: string, sealed: string): Doc;
}

export const emptyDoc = (): Doc => ({ version: 1, defaultId: '', profiles: [] });
