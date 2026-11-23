// DEV-ONLY TypeScript port of the Go core, used on native until the gomobile
// module is linked. It mirrors core/upi and core/presets but does NOT encrypt
// (seal/open are identity), so engine === 'ts-fallback' must never ship.
import type { Core, Doc, Kind, Parsed, Profile } from './types';

const VPA = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/;
const AMOUNT = /^\d{1,9}(\.\d{1,2})?$/;
const CTRL = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
const PALETTE = ['#58CC02', '#1CB0F6', '#FF9600', '#CE82FF', '#FF4B4B', '#FFC800'];
const MAX_PROFILES = 12;

const enc = (s: string) =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

function crc16(s: string): number {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}

function tlv(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < s.length; ) {
    const n = parseInt(s.slice(i + 2, i + 4), 10);
    if (Number.isNaN(n) || i + 4 + n > s.length) throw new Error('payload is invalid: bad EMV length');
    out[s.slice(i, i + 2)] = s.slice(i + 4, i + 4 + n);
    i += 4 + n;
  }
  return out;
}

function parse(raw: string): Parsed {
  const s = raw.trim();
  if (!s) throw new Error('payload is empty');
  if (s.length > 2048) throw new Error('payload is too long');
  if (CTRL.test(s)) throw new Error('payload is invalid: control characters');
  const warnings: string[] = [];
  if (/^upi:/i.test(s)) {
    const m = /^upi:\/\/pay\?(.*)$/i.exec(s);
    if (!m) throw new Error('payload is invalid: expected upi://pay?...');
    const q: Record<string, string> = {};
    for (const part of m[1].split('&')) {
      const [k, v = ''] = part.split('=');
      q[k] = decodeURIComponent(v.replace(/\+/g, ' ')).trim();
    }
    if (!VPA.test(q.pa ?? '')) throw new Error('payload is invalid: missing or malformed UPI ID (pa)');
    const cu = (q.cu ?? '').toUpperCase();
    if (cu && cu !== 'INR') throw new Error('payload is invalid: UPI supports INR only');
    if (q.am) {
      if (!AMOUNT.test(q.am) || parseFloat(q.am) <= 0) throw new Error('payload is invalid: malformed amount');
      warnings.push('This QR has a fixed amount. Payers cannot change it.');
    }
    if (q.tr) warnings.push('This QR has a transaction reference, which is meant for a single payment.');
    const fields: [string, string][] = [['am', q.am], ['cu', 'INR'], ['pa', q.pa], ['pn', q.pn], ['tn', q.tn]];
    const normalized =
      'upi://pay?' +
      fields.filter(([, v]) => v).map(([k, v]) => `${k}=${enc(v)}`).join('&');
    return { kind: 'upi', normalized, vpa: q.pa, payeeName: q.pn || undefined, amount: q.am || undefined,
      displayName: q.pn || q.pa, warnings: warnings.length ? warnings : undefined };
  }
  if (s.startsWith('000201')) {
    const body = s.slice(0, -4);
    if (!body.endsWith('6304')) throw new Error('payload is invalid: missing CRC tag 63');
    if (crc16(body).toString(16).toUpperCase().padStart(4, '0') !== s.slice(-4).toUpperCase())
      throw new Error('payload is invalid: CRC mismatch');
    const t = tlv(s);
    return { kind: 'emv', normalized: s, payeeName: t['59'], displayName: t['59'] || 'Payment QR' };
  }
  return { kind: 'generic', normalized: s, displayName: 'Payment QR',
    warnings: ['Format not recognised. It will be shown exactly as saved.'] };
}

const rid = () => Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

function add(d: Doc, label: string, payload: string): Doc {
  if (d.profiles.length >= MAX_PROFILES) throw new Error('profile limit reached');
  const p = parse(payload);
  if (d.profiles.some((x) => x.payload === p.normalized)) throw new Error('this QR is already saved');
  const name = (label.trim() || p.displayName).slice(0, 30);
  const prof: Profile = { id: rid(), label: name, payload: p.normalized, kind: p.kind as Kind,
    color: PALETTE[d.profiles.length % PALETTE.length], createdAt: new Date().toISOString() };
  return { ...d, profiles: [...d.profiles, prof], defaultId: d.defaultId || prof.id };
}

function need(d: Doc, id: string) {
  if (!d.profiles.some((p) => p.id === id)) throw new Error('profile not found');
}

export const tsFallback: Core = {
  encrypted: false,
  engine: 'ts-fallback',
  parseQR: parse,
  newDocument: () => ({ version: 1, defaultId: '', profiles: [] }),
  addProfile: add,
  removeProfile: (d, id) => {
    need(d, id);
    const profiles = d.profiles.filter((p) => p.id !== id);
    return { ...d, profiles, defaultId: d.defaultId === id ? profiles[0]?.id ?? '' : d.defaultId };
  },
  setDefaultProfile: (d, id) => (need(d, id), { ...d, defaultId: id }),
  renameProfile: (d, id, label) => {
    need(d, id);
    const l = label.trim();
    if (!l || l.length > 30) throw new Error('label must be 1-30 characters');
    return { ...d, profiles: d.profiles.map((p) => (p.id === id ? { ...p, label: l } : p)) };
  },
  generateKey: () => 'dev',
  sealDocument: (_k, d) => 'dev0.' + JSON.stringify(d),
  openDocument: (_k, s) => JSON.parse(s.replace(/^dev0\./, '')),
};
