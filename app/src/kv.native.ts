// Native key-value store backed by SQLite inside the app sandbox.
import KV from 'expo-sqlite/kv-store';

export const kv = {
  getItem: (k: string): Promise<string | null> => KV.getItem(k),
  setItem: (k: string, v: string): Promise<void> => KV.setItem(k, v),
  removeItem: (k: string): Promise<void> => KV.removeItem(k).then(() => undefined),
};
