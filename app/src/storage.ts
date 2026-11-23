// On-device persistence. Nothing here makes a network call.
//   Native: ciphertext in SQLite kv-store (app sandbox); key in Keychain / Android Keystore (SecureStore).
//   Web:    ciphertext in localStorage-backed kv-store; key in the same origin storage.
//           Web is weaker: any script on the origin can read both. Mitigations: strict CSP,
//           no third-party scripts, and (roadmap) a non-extractable WebCrypto key or passphrase
//           derived key via core.deriveKey. Documented in docs/ARCHITECTURE.md.
import { kv as KV } from './kv';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { Core, Doc } from './core/types';

const DOC_KEY = 'qp_doc_v1';
const KEY_KEY = 'qp_key_v1';
const LOCK_KEY = 'qp_lock_v1';

async function getKey(core: Core): Promise<string> {
  const existing =
    Platform.OS === 'web' ? await KV.getItem(KEY_KEY) : await SecureStore.getItemAsync(KEY_KEY);
  if (existing) return existing;
  const fresh = core.generateKey();
  if (Platform.OS === 'web') await KV.setItem(KEY_KEY, fresh);
  else await SecureStore.setItemAsync(KEY_KEY, fresh, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  return fresh;
}

export async function loadDoc(core: Core): Promise<Doc> {
  const sealed = await KV.getItem(DOC_KEY);
  if (!sealed) return core.newDocument();
  try {
    return core.openDocument(await getKey(core), sealed);
  } catch {
    return core.newDocument(); // corrupted or key lost: start clean rather than crash
  }
}

export async function saveDoc(core: Core, doc: Doc): Promise<void> {
  await KV.setItem(DOC_KEY, core.sealDocument(await getKey(core), doc));
}

export async function wipeAll(): Promise<void> {
  await KV.removeItem(DOC_KEY);
  if (Platform.OS === 'web') await KV.removeItem(KEY_KEY);
  else await SecureStore.deleteItemAsync(KEY_KEY);
}

export const getLockEnabled = async () => (await KV.getItem(LOCK_KEY)) === '1';
export const setLockEnabled = (on: boolean) => KV.setItem(LOCK_KEY, on ? '1' : '0');
