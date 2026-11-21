import { FinanceState } from '../types/finance';

export const LOCAL_STORAGE_KEY = 'tomi_blacksheep_state_v1';
const ACTIVE_NAMESPACE_KEY = 'tomi_blacksheep_active_namespace_v1';
const LEGACY_MIGRATION_DONE_KEY = 'tomi_blacksheep_ns_migrated_v1';

const IDB_NAME = 'tomi_blacksheep_db';
const IDB_VERSION = 1;
const IDB_STORE = 'backups';
const LEGACY_IDB_KEY = 'primary_state';

export type StorageNamespace = 'local' | `user:${string}`;

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

export function getUserNamespace(userId: string): StorageNamespace {
  const clean = userId.trim();
  if (!clean) return 'local';
  return `user:${clean}`;
}

export function isValidStorageNamespace(raw: string | null): raw is StorageNamespace {
  if (!raw) return false;
  if (raw === 'local') return true;
  return raw.startsWith('user:') && raw.length > 5;
}

export function getActiveStorageNamespace(): StorageNamespace {
  try {
    if (typeof window === 'undefined') return 'local';
    const raw = window.localStorage.getItem(ACTIVE_NAMESPACE_KEY);
    return isValidStorageNamespace(raw) ? raw : 'local';
  } catch {
    return 'local';
  }
}

export function setActiveStorageNamespace(ns: StorageNamespace): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ACTIVE_NAMESPACE_KEY, ns);
  } catch {
    // Ignore storage quota errors
  }
}

function getLocalStorageKeyForNamespace(ns: StorageNamespace): string {
  return ns === 'local'
    ? `${LOCAL_STORAGE_KEY}__local`
    : `${LOCAL_STORAGE_KEY}__${ns}`;
}

function getIndexedDbKeyForNamespace(ns: StorageNamespace): string {
  return ns === 'local' ? 'state__local' : `state__${ns}`;
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

function parseDualBackupRaw(raw: string | null): DualBackupPayload | null {
  if (!raw) return null;
  try {
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

/**
 * Migration unique des anciennes données mono-clé vers l'espace strictement cloisonné 'local'
 * afin de préserver tout Profil Local déjà configuré avant l'isolation multi-comptes.
 */
export function migrateLegacyLocalStorageToLocalNamespace(): void {
  try {
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(LEGACY_MIGRATION_DONE_KEY) === 'true') return;

    const localKey = getLocalStorageKeyForNamespace('local');
    const existingLocal = window.localStorage.getItem(localKey);
    if (!existingLocal) {
      const legacyRaw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      const parsed = parseDualBackupRaw(legacyRaw);
      if (parsed) {
        const mode = parsed.state.settings?.account?.mode;
        // On ne copie dans 'local' que si ce n'était pas déjà une session cloud distante sans local
        if (mode !== 'cloud_ready') {
          window.localStorage.setItem(localKey, JSON.stringify(parsed));
        }
      }
    }
    window.localStorage.setItem(LEGACY_MIGRATION_DONE_KEY, 'true');
  } catch {
    // Ignore storage quota or security errors
  }
}

export async function migrateLegacyIndexedDbToLocalNamespace(): Promise<void> {
  try {
    if (!isIndexedDbSupported()) return;
    const db = await openBackupDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const localIdbKey = getIndexedDbKeyForNamespace('local');
      const checkReq = store.get(localIdbKey);

      checkReq.onsuccess = () => {
        if (checkReq.result) {
          db.close();
          resolve();
          return;
        }
        const legacyReq = store.get(LEGACY_IDB_KEY);
        legacyReq.onsuccess = () => {
          const legacyVal = legacyReq.result as DualBackupPayload | undefined;
          if (
            legacyVal &&
            legacyVal.state &&
            legacyVal.state.settings &&
            legacyVal.state.settings.account?.mode !== 'cloud_ready'
          ) {
            const putReq = store.put(legacyVal, localIdbKey);
            putReq.onsuccess = () => {
              db.close();
              resolve();
            };
            putReq.onerror = () => {
              db.close();
              resolve();
            };
          } else {
            db.close();
            resolve();
          }
        };
        legacyReq.onerror = () => {
          db.close();
          resolve();
        };
      };
      checkReq.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // Ignore IDB errors
  }
}

export function readFromLocalStorage(
  namespace: StorageNamespace = getActiveStorageNamespace()
): DualBackupPayload | null {
  try {
    const raw = window.localStorage.getItem(getLocalStorageKeyForNamespace(namespace));
    return parseDualBackupRaw(raw);
  } catch {
    return null;
  }
}

export function writeToLocalStorage(
  payload: DualBackupPayload,
  namespace: StorageNamespace = getActiveStorageNamespace()
): boolean {
  try {
    window.localStorage.setItem(
      getLocalStorageKeyForNamespace(namespace),
      JSON.stringify(payload)
    );
    return true;
  } catch {
    return false;
  }
}

export function removeLocalStorageNamespace(namespace: StorageNamespace): void {
  try {
    if (namespace === 'local') return; // Protection : ne jamais effacer le Profil Local via clear cache
    window.localStorage.removeItem(getLocalStorageKeyForNamespace(namespace));
  } catch {
    // Ignore errors
  }
}

export async function readFromIndexedDb(
  namespace: StorageNamespace = getActiveStorageNamespace()
): Promise<DualBackupPayload | null> {
  try {
    const db = await openBackupDb();
    return await new Promise<DualBackupPayload | null>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const getReq = store.get(getIndexedDbKeyForNamespace(namespace));
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

export async function writeToIndexedDb(
  payload: DualBackupPayload,
  namespace: StorageNamespace = getActiveStorageNamespace()
): Promise<boolean> {
  try {
    const db = await openBackupDb();
    return await new Promise<boolean>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const putReq = store.put(payload, getIndexedDbKeyForNamespace(namespace));
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

export async function removeIndexedDbNamespace(
  namespace: StorageNamespace
): Promise<void> {
  if (namespace === 'local') return; // Protection : le Profil Local reste intouché
  try {
    const db = await openBackupDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const delReq = store.delete(getIndexedDbKeyForNamespace(namespace));
      delReq.onsuccess = () => {
        db.close();
        resolve();
      };
      delReq.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // Ignore errors
  }
}

/**
 * Supprime uniquement les données et caches locaux du compte utilisateur indiqué
 * sans jamais toucher au Profil Local ('local') ni aux autres comptes.
 */
export async function clearAccountLocalCache(userId: string): Promise<void> {
  const cleanId = userId.trim();
  if (!cleanId) return;
  const ns = getUserNamespace(cleanId);
  if (ns === 'local') return;
  removeLocalStorageNamespace(ns);
  await removeIndexedDbNamespace(ns);
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
