import { supabase, isSupabaseConfigured } from './supabaseClient';

export interface CloudSyncPayload {
  stateJson: unknown;
  updatedAt: string;
}

export async function signInOrSignUpRemote(email: string, password: string) {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('Supabase n’est pas encore configuré (.env.local).');
  }

  const trimmedEmail = email.trim().toLowerCase();

  // 1. Tente d'abord une connexion existante
  const signInRes = await supabase.auth.signInWithPassword({
    email: trimmedEmail,
    password,
  });

  if (!signInRes.error && signInRes.data.user) {
    return signInRes.data.user;
  }

  // 2. Si le compte n'existe pas encore, crée le compte
  const signUpRes = await supabase.auth.signUp({
    email: trimmedEmail,
    password,
  });

  if (signUpRes.error || !signUpRes.data.user) {
    throw new Error(
      signUpRes.error?.message ||
        signInRes.error?.message ||
        'Impossible de connecter le compte.'
    );
  }

  return signUpRes.data.user;
}

export async function getCurrentRemoteUser() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function pullFinanceStateFromCloud(): Promise<CloudSyncPayload | null> {
  if (!supabase) return null;
  const user = await getCurrentRemoteUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('user_finance_states')
    .select('state_json, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return null;

  return {
    stateJson: data.state_json,
    updatedAt: data.updated_at,
  };
}

export async function pushFinanceStateToCloud(stateJson: unknown): Promise<boolean> {
  if (!supabase || !navigator.onLine) return false;
  const user = await getCurrentRemoteUser();
  if (!user) return false;

  const nowIso = new Date().toISOString();
  const { error } = await supabase.from('user_finance_states').upsert(
    {
      user_id: user.id,
      state_json: stateJson,
      updated_at: nowIso,
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

export async function signOutRemote(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

/**
 * Déclenche un callback dès que l'appareil passe hors ligne -> en ligne
 * (détection réseau mobile ou Wi-Fi).
 */
export function onNetworkReconnect(callback: () => void): () => void {
  const handleOnline = () => {
    callback();
  };
  window.addEventListener('online', handleOnline);
  return () => {
    window.removeEventListener('online', handleOnline);
  };
}