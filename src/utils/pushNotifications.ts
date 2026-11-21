import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import {
  ActionPerformed,
  PushNotifications,
  PushNotificationSchema,
  Token,
} from '@capacitor/push-notifications';
import { deleteUserPushToken, upsertUserPushToken } from './cloudSync';

export type PushPermissionState =
  | 'granted'
  | 'denied'
  | 'prompt'
  | 'web_unsupported'
  | 'error';

export interface PushStatusSnapshot {
  isNative: boolean;
  permission: PushPermissionState;
  token: string | null;
  syncedToCloud: boolean;
  lastError?: string | null;
  updatedAt?: string | null;
}

export interface IncomingPushPayload {
  title: string;
  body: string;
  projectId?: string;
  transactionId?: string;
}

const CACHED_TOKEN_KEY = 'tomi_fcm_push_token_v1';

let cachedToken: string | null = (() => {
  try {
    return typeof localStorage !== 'undefined'
      ? localStorage.getItem(CACHED_TOKEN_KEY)
      : null;
  } catch {
    return null;
  }
})();

let currentStatus: PushStatusSnapshot = {
  isNative: Capacitor.isNativePlatform(),
  permission: Capacitor.isNativePlatform() ? 'prompt' : 'web_unsupported',
  token: cachedToken,
  syncedToCloud: false,
  lastError: null,
  updatedAt: null,
};

const statusListeners = new Set<(snapshot: PushStatusSnapshot) => void>();
let listenerHandles: PluginListenerHandle[] = [];
let initialized = false;

function emitStatus(patch: Partial<PushStatusSnapshot>) {
  currentStatus = { ...currentStatus, ...patch };
  statusListeners.forEach((cb) => cb(currentStatus));
}

function saveCachedToken(token: string) {
  cachedToken = token;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CACHED_TOKEN_KEY, token);
    }
  } catch {
    // Ignore storage quota errors
  }
}

function resolvePlatform(): 'android' | 'ios' | 'web' {
  const p = Capacitor.getPlatform();
  if (p === 'android') return 'android';
  if (p === 'ios') return 'ios';
  return 'web';
}

function extractProjectId(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const record = data as Record<string, unknown>;
  const raw = record.project_id ?? record.projectId;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
}

function extractTransactionId(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const record = data as Record<string, unknown>;
  const raw = record.transaction_id ?? record.transactionId;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
}

export function getPushStatusSnapshot(): PushStatusSnapshot {
  return currentStatus;
}

export function subscribePushStatus(
  cb: (snapshot: PushStatusSnapshot) => void
): () => void {
  statusListeners.add(cb);
  cb(currentStatus);
  return () => {
    statusListeners.delete(cb);
  };
}

export async function syncPushTokenWithSupabase(
  explicitToken?: string
): Promise<boolean> {
  const tokenToSync = explicitToken || cachedToken || currentStatus.token;
  if (!tokenToSync) return false;
  try {
    const ok = await upsertUserPushToken(tokenToSync, resolvePlatform());
    if (ok) {
      emitStatus({
        token: tokenToSync,
        syncedToCloud: true,
        lastError: null,
        updatedAt: new Date().toISOString(),
      });
    }
    return ok;
  } catch (err) {
    emitStatus({
      syncedToCloud: false,
      lastError: err instanceof Error ? err.message : 'Erreur synchro FCM',
    });
    return false;
  }
}

export async function removeCachedPushTokenFromSupabase(): Promise<void> {
  if (!cachedToken) return;
  try {
    await deleteUserPushToken(cachedToken);
    emitStatus({ syncedToCloud: false });
  } catch {
    // Ignoré si hors-ligne lors de la déconnexion
  }
}

export interface InitNativePushCallbacks {
  onForegroundPush: (payload: IncomingPushPayload) => void;
  onNotificationTap: (payload: IncomingPushPayload) => void;
}

export async function initNativePushNotifications(
  callbacks: InitNativePushCallbacks
): Promise<PushStatusSnapshot> {
  if (!Capacitor.isNativePlatform()) {
    emitStatus({
      isNative: false,
      permission: 'web_unsupported',
      lastError: null,
    });
    return currentStatus;
  }

  try {
    if (!initialized) {
      initialized = true;

      if (Capacitor.getPlatform() === 'android') {
        try {
          await PushNotifications.createChannel({
            id: 'tomi_projects',
            name: 'Activité Projets Partagés',
            description:
              'Alertes en temps réel sur les opérations et membres de vos projets partagés TOMI',
            importance: 4,
            visibility: 1,
            vibration: true,
            sound: 'default',
          });
        } catch {
          // Ignore si canal déjà créé ou OS antérieur à Android 8
        }
      }

      const regHandle = await PushNotifications.addListener(
        'registration',
        async (token: Token) => {
          saveCachedToken(token.value);
          emitStatus({
            isNative: true,
            permission: 'granted',
            token: token.value,
            lastError: null,
          });
          await syncPushTokenWithSupabase(token.value);
        }
      );

      const errHandle = await PushNotifications.addListener(
        'registrationError',
        (err) => {
          emitStatus({
            isNative: true,
            lastError: err?.error || 'Impossible d’enregistrer le jeton FCM.',
          });
        }
      );

      const fgHandle = await PushNotifications.addListener(
        'pushNotificationReceived',
        (notification: PushNotificationSchema) => {
          const projectId = extractProjectId(notification.data);
          const transactionId = extractTransactionId(notification.data);
          callbacks.onForegroundPush({
            title: notification.title || 'TOMI · Projet partagé',
            body: notification.body || 'Nouvelle activité enregistrée.',
            projectId,
            transactionId,
          });
        }
      );

      const tapHandle = await PushNotifications.addListener(
        'pushNotificationActionPerformed',
        (action: ActionPerformed) => {
          const notif = action.notification;
          const projectId = extractProjectId(notif.data);
          const transactionId = extractTransactionId(notif.data);
          callbacks.onNotificationTap({
            title: notif.title || 'TOMI · Projet partagé',
            body: notif.body || '',
            projectId,
            transactionId,
          });
        }
      );

      listenerHandles = [regHandle, errHandle, fgHandle, tapHandle];
    }

    return await refreshPushNotifications();
  } catch (err) {
    emitStatus({
      isNative: true,
      permission: 'error',
      lastError:
        err instanceof Error
          ? err.message
          : 'Erreur lors de l’initialisation push.',
    });
    return currentStatus;
  }
}

export async function refreshPushNotifications(): Promise<PushStatusSnapshot> {
  if (!Capacitor.isNativePlatform()) {
    emitStatus({
      isNative: false,
      permission: 'web_unsupported',
    });
    return currentStatus;
  }

  try {
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
    }

    if (perm.receive === 'granted') {
      emitStatus({
        isNative: true,
        permission: 'granted',
        lastError: null,
      });
      await PushNotifications.register();
      if (cachedToken) {
        await syncPushTokenWithSupabase(cachedToken);
      }
      return currentStatus;
    }

    emitStatus({
      isNative: true,
      permission: 'denied',
      lastError:
        'Autorisation refusée. Activez les notifications pour TOMI dans les paramètres Android.',
    });
    return currentStatus;
  } catch (err) {
    emitStatus({
      isNative: true,
      permission: 'error',
      lastError:
        err instanceof Error ? err.message : 'Erreur de permission push.',
    });
    return currentStatus;
  }
}

export async function cleanupNativePushListeners(): Promise<void> {
  for (const h of listenerHandles) {
    await h.remove().catch(() => {});
  }
  listenerHandles = [];
  initialized = false;
}
