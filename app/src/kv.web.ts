// Web key-value store. localStorage is enough for a ~2 KB ciphertext document.
// Upgrade path for larger data (e.g. stored QR images): IndexedDB or OPFS.
// expo-sqlite's web build is alpha, so it is intentionally not used here.
export const kv = {
  getItem: async (k: string): Promise<string | null> => localStorage.getItem(k),
  setItem: async (k: string, v: string): Promise<void> => localStorage.setItem(k, v),
  removeItem: async (k: string): Promise<void> => localStorage.removeItem(k),
};
