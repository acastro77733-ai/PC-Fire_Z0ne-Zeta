
export interface ProjectSnapshot {
  id: string;
  name: string;
  timestamp: number;
  blob: Blob;
  size: number;
}

const DB_NAME = 'PowerCoderZ_Projects';
const STORE_NAME = 'snapshots';
const DB_VERSION = 1;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const saveProjectSnapshot = async (name: string, blob: Blob): Promise<ProjectSnapshot> => {
  const db = await openDB();
  const snapshot: ProjectSnapshot = {
    id: crypto.randomUUID(),
    name,
    timestamp: Date.now(),
    blob,
    size: blob.size
  };
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(snapshot);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(snapshot);
  });
};

export const getAllSnapshots = async (): Promise<ProjectSnapshot[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
        // Sort by newest first
        const results = request.result as ProjectSnapshot[];
        resolve(results.sort((a, b) => b.timestamp - a.timestamp));
    };
  });
};

export const deleteSnapshot = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};
