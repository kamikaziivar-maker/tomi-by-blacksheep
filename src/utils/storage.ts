import { FinanceState } from '../types/finance';

export const LOCAL_STORAGE_KEY = 'tomi_blacksheep_state_v1';
const IDB_NAME = 'tomi_blacksheep_db';
const IDB_VERSION = 1;
const IDB_STORE = 'backups';
const IDB_KEY = 'primary_state';

export interface DualBackupPayload {
  updatedAt: string;
  state: FinanceState;
}

export interface PersistenceStatus {
  isOnline: boolean;
  localStorageOk: boolean;
  indexedDbAvailable: boolean;
  indexedDbSynced: boolean;
  lastSavedAt: string | null;
}

export function isIndexedDbSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openBackupDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbSupported()) {
      reject(new Error('IndexedDB non disponible'));
      return;
    }
    const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Erreur ouverture IndexedDB'));
  });
}

export function readFromLocalStorage(): DualBackupPayload | null {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DualBackupPayload> & Partial<FinanceState>;
    // Support both wrapped { updatedAt, state } and legacy direct FinanceState
    if (parsed && parsed.state && parsed.state.settings) {
      return {
        updatedAt: parsed.updatedAt || new Date(0).toISOString(),
        state: parsed.state,
      };
    }
    if (parsed && parsed.settings && Array.isArray(parsed.supports)) {
      return {
        updatedAt: new Date(0).toISOString(),
        state: parsed as FinanceState,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function writeToLocalStorage(payload: DualBackupPayload): boolean {
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export async function readFromIndexedDb(): Promise<DualBackupPayload | null> {
  try {
    const db = await openBackupDb();
    return await new Promise<DualBackupPayload | null>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const getReq = store.get(IDB_KEY);
      getReq.onsuccess = () => {
        const res = getReq.result as DualBackupPayload | undefined;
        db.close();
        if (res && res.state && res.state.settings) {
          resolve(res);
        } else {
          resolve(null);
        }
      };
      getReq.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

export async function writeToIndexedDb(payload: DualBackupPayload): Promise<boolean> {
  try {
    const db = await openBackupDb();
    return await new Promise<boolean>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const putReq = store.put(payload, IDB_KEY);
      putReq.onsuccess = () => {
        db.close();
        resolve(true);
      };
      putReq.onerror = () => {
        db.close();
        resolve(false);
      };
    });
  } catch {
    return false;
  }
}

export async function hashPin(pin: string): Promise<string> {
  const salted = `tomi_bs_pin_${pin}_fujistudio`;
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const data = new TextEncoder().encode(salted);
      const digest = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    // Fallback below if subtle crypto is unavailable in insecure WebView
  }
  let h = 2166136261;
  for (let i = 0; i < salted.length; i++) {
    h ^= salted.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv_${(h >>> 0).toString(16)}`;
}
