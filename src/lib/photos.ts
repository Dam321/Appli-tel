// Photos de progression stockées sur le téléphone (IndexedDB), jamais envoyées ailleurs.
const DB_NAME = 'vitalis-photos';
const STORE = 'photos';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const savePhoto = (id: string, blob: Blob) => tx('readwrite', (s) => s.put(blob, id));
export const getPhoto = (id: string) => tx<Blob | undefined>('readonly', (s) => s.get(id));
export const deletePhoto = (id: string) => tx('readwrite', (s) => s.delete(id));

/** Redimensionne et compresse la photo (≈ 150-300 Ko) avant stockage. */
export async function compressImage(file: File, maxSize = 1280): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Compression impossible'))), 'image/jpeg', 0.82));
}
