/**
 * Tiny IndexedDB wrapper for sample blobs. localStorage handles metadata
 * (small JSON), IndexedDB handles the audio Blob (potentially MB-sized).
 */

const DB_NAME = 'step-sequencer-samples';
const DB_VERSION = 1;
const STORE = 'samples';

const open = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const tx = async <T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const store = transaction.objectStore(STORE);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
};

export const sampleDb = {
  async put(id: string, blob: Blob): Promise<void> {
    await tx('readwrite', (s) => s.put(blob, id));
  },
  async get(id: string): Promise<Blob | null> {
    const v = await tx('readonly', (s) => s.get(id));
    return (v as Blob) ?? null;
  },
  async delete(id: string): Promise<void> {
    await tx('readwrite', (s) => s.delete(id));
  },
  async keys(): Promise<string[]> {
    const v = await tx('readonly', (s) => s.getAllKeys());
    return v as string[];
  },
};
