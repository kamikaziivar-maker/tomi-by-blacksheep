-- ============================================================================
-- TOMI by BlackSheep — Notifications Push Natives Android (FCM + Supabase)
-- Script SQL à exécuter dans l'éditeur SQL de Supabase après
-- supabase/project_collaboration_schema.sql
-- ============================================================================

-- 1. Extension pg_net pour appeler l'Edge Function de manière asynchrone
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Table des jetons FCM par utilisateur et appareil
CREATE TABLE IF NOT EXISTS public.user_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'android' CHECK (platform IN ('android', 'ios', 'web')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id
  ON public.user_push_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_user_push_tokens_token
  ON public.user_push_tokens(token);

-- 3. Sécurité RLS stricte : chaque utilisateur gère uniquement ses propres jetons
ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_push_tokens_select_own" ON public.user_push_tokens;
CREATE POLICY "user_push_tokens_select_own" ON public.user_push_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_push_tokens_insert_own" ON public.user_push_tokens;
CREATE POLICY "user_push_tokens_insert_own" ON public.user_push_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_push_tokens_update_own" ON public.user_push_tokens;
CREATE POLICY "user_push_tokens_update_own" ON public.user_push_tokens
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_push_tokens_delete_own" ON public.user_push_tokens;
CREATE POLICY "user_push_tokens_delete_own" ON public.user_push_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Fonction Trigger vers l'Edge Function send-project-push
-- Configuration requise dans Supabase (Vault ou ALTER DATABASE) :
--   SELECT vault.create_secret('https://<PROJECT_REF>.supabase.co/functions/v1/send-project-push', 'tomi_push_edge_url');
--   SELECT vault.create_secret('<VOTRE_SECRET_WEBHOOK>', 'tomi_push_webhook_secret');
-- (Ou utilisez directement Database -> Webhooks dans le Dashboard Supabase en
--  pointant vers /functions/v1/send-project-push sur INSERT project_transactions et project_members.)
CREATE OR REPLACE FUNCTION public.notify_project_push_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_edge_url TEXT;
  v_webhook_secret TEXT;
  v_headers JSONB;
  v_payload JSONB;
BEGIN
  -- Lecture sécurisée depuis Supabase Vault si configuré
  BEGIN
    SELECT decrypted_secret INTO v_edge_url
    FROM vault.decrypted_secrets
    WHERE name = 'tomi_push_edge_url'
    LIMIT 1;

    SELECT decrypted_secret INTO v_webhook_secret
    FROM vault.decrypted_secrets
    WHERE name = 'tomi_push_webhook_secret'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_edge_url := NULL;
    v_webhook_secret := NULL;
  END;

  -- Fallback éventuel via paramètres PostgreSQL custom
  IF v_edge_url IS NULL OR v_edge_url = '' THEN
    v_edge_url := NULLIF(current_setting('app.settings.push_edge_url', true), '');
  END IF;

  IF v_webhook_secret IS NULL OR v_webhook_secret = '' THEN
    v_webhook_secret := NULLIF(current_setting('app.settings.push_webhook_secret', true), '');
  END IF;

  -- Ne bloque jamais l'écriture métier si l'URL Edge Function n'est pas encore configurée
  IF v_edge_url IS NULL THEN
    RETURN NEW;
  END IF;

  v_headers := jsonb_build_object(
    'Content-Type', 'application/json'
  );

  IF v_webhook_secret IS NOT NULL THEN
    v_headers := v_headers || jsonb_build_object('x-webhook-secret', v_webhook_secret);
  END IF;

  v_payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', to_jsonb(NEW)
  );

  PERFORM net.http_post(
    url := v_edge_url,
    headers := v_headers,
    body := v_payload
  );

  RETURN NEW;
END;
$$;

-- 5. Triggers sur project_transactions et project_members
DROP TRIGGER IF EXISTS trg_push_on_project_transaction ON public.project_transactions;
CREATE TRIGGER trg_push_on_project_transaction
  AFTER INSERT ON public.project_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_project_push_webhook();

DROP TRIGGER IF EXISTS trg_push_on_project_member ON public.project_members;
CREATE TRIGGER trg_push_on_project_member
  AFTER INSERT ON public.project_members
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_project_push_webhook();
