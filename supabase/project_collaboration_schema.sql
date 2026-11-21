-- ============================================================================
-- TOMI by BlackSheep — Collaboration Isolée par Projet & Inventaire Temps Réel
-- Script complet prêt à exécuter dans l'éditeur SQL de Supabase
-- Règle de sécurité absolue : aucun accès aux comptes personnels, dettes ou
-- autres projets du propriétaire. Cloisonnement strict par project_id & user_id.
-- ============================================================================

-- 1. Table des projets partagés (métadonnées du projet uniquement)
CREATE TABLE IF NOT EXISTS public.shared_projects (
  id TEXT PRIMARY KEY,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_name TEXT NOT NULL DEFAULT 'Propriétaire',
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  custom_category TEXT,
  description TEXT,
  revenue_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  expense_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  color_accent TEXT DEFAULT '#F5B971',
  invite_code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Table des membres autorisés par projet (rôles strictement cloisonnés)
CREATE TABLE IF NOT EXISTS public.project_members (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.shared_projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  initials TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'viewer')),
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active')),
  invite_code TEXT,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  joined_at TIMESTAMPTZ,
  UNIQUE (project_id, email)
);

-- 3. Table des supports de trésorerie propres au projet (jamais les supports perso)
CREATE TABLE IF NOT EXISTS public.project_supports (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.shared_projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('cash', 'bank', 'mobile_money')),
  name TEXT NOT NULL,
  reference TEXT,
  currency TEXT NOT NULL DEFAULT 'FBU',
  balance NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Table d'inventaire / stocks par projet
CREATE TABLE IF NOT EXISTS public.project_inventory (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.shared_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'pièce',
  quantity NUMERIC NOT NULL DEFAULT 0,
  min_stock_threshold NUMERIC NOT NULL DEFAULT 5,
  average_unit_cost_fbu NUMERIC NOT NULL DEFAULT 0,
  total_purchased_qty NUMERIC NOT NULL DEFAULT 0,
  total_sold_qty NUMERIC NOT NULL DEFAULT 0,
  total_sales_revenue_fbu NUMERIC NOT NULL DEFAULT 0,
  total_cogs_fbu NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Table des transactions du projet partagé (avec typologie comptable & auteur)
CREATE TABLE IF NOT EXISTS public.project_transactions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.shared_projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('inflow', 'outflow', 'transfer', 'internal_loan', 'loan_repayment')),
  support_id TEXT NOT NULL,
  target_support_id TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'FBU',
  amount_in_fbu NUMERIC NOT NULL,
  payment_method TEXT NOT NULL,
  date TEXT NOT NULL,
  label TEXT NOT NULL,
  category_or_source TEXT,
  note TEXT,
  outflow_nature TEXT CHECK (outflow_nature IN ('operating_expense', 'stock_purchase')),
  stock_purchase_lines JSONB,
  stock_sale_lines JSONB,
  cogs_fbu NUMERIC DEFAULT 0,
  gross_margin_fbu NUMERIC,
  author_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL DEFAULT 'Membre',
  author_initials TEXT NOT NULL DEFAULT 'MB',
  author_role TEXT NOT NULL DEFAULT 'owner' CHECK (author_role IN ('owner', 'manager', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Index de performance (filtrage rapide par project_id, user_id, email)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_shared_projects_owner ON public.shared_projects(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_shared_projects_invite ON public.shared_projects(invite_code);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON public.project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_email ON public.project_members(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_project_supports_project ON public.project_supports(project_id);
CREATE INDEX IF NOT EXISTS idx_project_inventory_project ON public.project_inventory(project_id);
CREATE INDEX IF NOT EXISTS idx_project_transactions_project_created ON public.project_transactions(project_id, created_at DESC);

-- ============================================================================
-- Fonctions de vérification d'appartenance (évite la récursion infinie RLS)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.has_project_role(p_project_id TEXT, p_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.shared_projects sp
    WHERE sp.id = p_project_id
      AND sp.owner_user_id = auth.uid()
      AND 'owner' = ANY(p_roles)
  )
  OR EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = p_project_id
      AND pm.role = ANY(p_roles)
      AND (
        pm.user_id = auth.uid()
        OR LOWER(pm.email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
      )
  );
$$;

-- Fonction RPC sécurisée pour rejoindre un projet via son code d'invitation
CREATE OR REPLACE FUNCTION public.join_shared_project_by_code(
  p_invite_code TEXT,
  p_display_name TEXT,
  p_initials TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project public.shared_projects%ROWTYPE;
  v_email TEXT;
  v_member public.project_members%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  v_email := LOWER(COALESCE(auth.jwt() ->> 'email', ''));

  SELECT * INTO v_project
  FROM public.shared_projects
  WHERE invite_code = TRIM(p_invite_code)
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Code invitation projet introuvable';
  END IF;

  SELECT * INTO v_member
  FROM public.project_members
  WHERE project_id = v_project.id
    AND (user_id = auth.uid() OR (v_email <> '' AND LOWER(email) = v_email))
  LIMIT 1;

  IF NOT FOUND THEN
    -- Si le code correspond à un membre invité par e-mail ou lien ouvert avec rôle manager par défaut
    INSERT INTO public.project_members (
      id, project_id, user_id, email, display_name, initials, role, status, invite_code, joined_at
    ) VALUES (
      'mem_' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 10),
      v_project.id,
      auth.uid(),
      COALESCE(NULLIF(v_email, ''), auth.uid()::TEXT || '@tomi.local'),
      COALESCE(NULLIF(TRIM(p_display_name), ''), 'Associé'),
      COALESCE(NULLIF(TRIM(p_initials), ''), 'AS'),
      'manager',
      'active',
      TRIM(p_invite_code),
      NOW()
    )
    RETURNING * INTO v_member;
  ELSE
    UPDATE public.project_members
    SET user_id = auth.uid(),
        status = 'active',
        display_name = COALESCE(NULLIF(TRIM(p_display_name), ''), display_name),
        initials = COALESCE(NULLIF(TRIM(p_initials), ''), initials),
        joined_at = COALESCE(joined_at, NOW())
    WHERE id = v_member.id
    RETURNING * INTO v_member;
  END IF;

  RETURN jsonb_build_object(
    'project', to_jsonb(v_project),
    'member', to_jsonb(v_member)
  );
END;
$$;

-- ============================================================================
-- Activation RLS (Row Level Security) — Cloisonnement strict par projet
-- ============================================================================
ALTER TABLE public.shared_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_supports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_transactions ENABLE ROW LEVEL SECURITY;

-- Policies : shared_projects
DROP POLICY IF EXISTS "shared_projects_select" ON public.shared_projects;
CREATE POLICY "shared_projects_select" ON public.shared_projects
  FOR SELECT USING (public.has_project_role(id, ARRAY['owner', 'manager', 'viewer']));

DROP POLICY IF EXISTS "shared_projects_insert_owner" ON public.shared_projects;
CREATE POLICY "shared_projects_insert_owner" ON public.shared_projects
  FOR INSERT WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "shared_projects_update_owner" ON public.shared_projects;
CREATE POLICY "shared_projects_update_owner" ON public.shared_projects
  FOR UPDATE USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "shared_projects_delete_owner" ON public.shared_projects;
CREATE POLICY "shared_projects_delete_owner" ON public.shared_projects
  FOR DELETE USING (owner_user_id = auth.uid());

-- Policies : project_members
DROP POLICY IF EXISTS "project_members_select" ON public.project_members;
CREATE POLICY "project_members_select" ON public.project_members
  FOR SELECT USING (public.has_project_role(project_id, ARRAY['owner', 'manager', 'viewer']));

DROP POLICY IF EXISTS "project_members_manage_owner" ON public.project_members;
CREATE POLICY "project_members_manage_owner" ON public.project_members
  FOR ALL USING (public.has_project_role(project_id, ARRAY['owner']))
  WITH CHECK (public.has_project_role(project_id, ARRAY['owner']));

-- Policies : project_supports
DROP POLICY IF EXISTS "project_supports_select" ON public.project_supports;
CREATE POLICY "project_supports_select" ON public.project_supports
  FOR SELECT USING (public.has_project_role(project_id, ARRAY['owner', 'manager', 'viewer']));

DROP POLICY IF EXISTS "project_supports_write" ON public.project_supports;
CREATE POLICY "project_supports_write" ON public.project_supports
  FOR INSERT WITH CHECK (public.has_project_role(project_id, ARRAY['owner', 'manager']));

DROP POLICY IF EXISTS "project_supports_update" ON public.project_supports;
CREATE POLICY "project_supports_update" ON public.project_supports
  FOR UPDATE USING (public.has_project_role(project_id, ARRAY['owner', 'manager']))
  WITH CHECK (public.has_project_role(project_id, ARRAY['owner', 'manager']));

DROP POLICY IF EXISTS "project_supports_delete_owner" ON public.project_supports;
CREATE POLICY "project_supports_delete_owner" ON public.project_supports
  FOR DELETE USING (public.has_project_role(project_id, ARRAY['owner']));

-- Policies : project_inventory
DROP POLICY IF EXISTS "project_inventory_select" ON public.project_inventory;
CREATE POLICY "project_inventory_select" ON public.project_inventory
  FOR SELECT USING (public.has_project_role(project_id, ARRAY['owner', 'manager', 'viewer']));

DROP POLICY IF EXISTS "project_inventory_write" ON public.project_inventory;
CREATE POLICY "project_inventory_write" ON public.project_inventory
  FOR INSERT WITH CHECK (public.has_project_role(project_id, ARRAY['owner', 'manager']));

DROP POLICY IF EXISTS "project_inventory_update" ON public.project_inventory;
CREATE POLICY "project_inventory_update" ON public.project_inventory
  FOR UPDATE USING (public.has_project_role(project_id, ARRAY['owner', 'manager']))
  WITH CHECK (public.has_project_role(project_id, ARRAY['owner', 'manager']));

DROP POLICY IF EXISTS "project_inventory_delete_owner" ON public.project_inventory;
CREATE POLICY "project_inventory_delete_owner" ON public.project_inventory
  FOR DELETE USING (public.has_project_role(project_id, ARRAY['owner']));

-- Policies : project_transactions
DROP POLICY IF EXISTS "project_transactions_select" ON public.project_transactions;
CREATE POLICY "project_transactions_select" ON public.project_transactions
  FOR SELECT USING (public.has_project_role(project_id, ARRAY['owner', 'manager', 'viewer']));

DROP POLICY IF EXISTS "project_transactions_insert" ON public.project_transactions;
CREATE POLICY "project_transactions_insert" ON public.project_transactions
  FOR INSERT WITH CHECK (public.has_project_role(project_id, ARRAY['owner', 'manager']));

DROP POLICY IF EXISTS "project_transactions_update_owner" ON public.project_transactions;
CREATE POLICY "project_transactions_update_owner" ON public.project_transactions
  FOR UPDATE USING (public.has_project_role(project_id, ARRAY['owner']))
  WITH CHECK (public.has_project_role(project_id, ARRAY['owner']));

DROP POLICY IF EXISTS "project_transactions_delete_owner" ON public.project_transactions;
CREATE POLICY "project_transactions_delete_owner" ON public.project_transactions
  FOR DELETE USING (public.has_project_role(project_id, ARRAY['owner']));

-- ============================================================================
-- Activation Supabase Realtime sur les tables collaboratives du projet
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'project_transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.project_transactions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'project_inventory'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.project_inventory;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'project_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.project_members;
  END IF;
END $$;
