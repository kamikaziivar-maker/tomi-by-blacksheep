import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  FundSupport,
  InventoryItem,
  PaymentMethod,
  Project,
  ProjectMember,
  ProjectOutflowNature,
  ProjectRole,
  StockPurchaseLine,
  StockSaleLine,
  SupportType,
  Transaction,
  TransactionType,
} from '../types/finance';
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

export async function upsertUserPushToken(
  token: string,
  platform: 'android' | 'ios' | 'web' = 'android'
): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured || !navigator.onLine || !token.trim()) {
    return false;
  }
  const user = await getCurrentRemoteUser();
  if (!user) return false;

  const { error } = await supabase.from('user_push_tokens').upsert(
    {
      user_id: user.id,
      token: token.trim(),
      platform,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,token' }
  );

  if (error) {
    throw new Error(error.message);
  }
  return true;
}

export async function deleteUserPushToken(token: string): Promise<void> {
  if (!supabase || !isSupabaseConfigured || !navigator.onLine || !token.trim()) {
    return;
  }
  const user = await getCurrentRemoteUser();
  if (!user) return;

  await supabase
    .from('user_push_tokens')
    .delete()
    .eq('user_id', user.id)
    .eq('token', token.trim());
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

// ============================================================================
// Collaboration Isolée par Projet (Supabase + RLS + Realtime)
// ============================================================================

function mapRowToProject(row: Record<string, unknown>, currentUserId?: string): Project {
  const ownerId = String(row.owner_user_id ?? '');
  return {
    id: String(row.id),
    name: String(row.name ?? 'Projet partagé'),
    category: String(row.category ?? 'Business'),
    customCategory: row.custom_category ? String(row.custom_category) : undefined,
    description: row.description ? String(row.description) : undefined,
    revenueSources: Array.isArray(row.revenue_sources) ? (row.revenue_sources as string[]) : [],
    expenseCategories: Array.isArray(row.expense_categories) ? (row.expense_categories as string[]) : [],
    createdAt: String(row.created_at ?? new Date().toISOString()).slice(0, 10),
    colorAccent: row.color_accent ? String(row.color_accent) : '#F5B971',
    ownerUserId: ownerId || undefined,
    ownerName: row.owner_name ? String(row.owner_name) : undefined,
    isShared: true,
    sharedAccessRole: currentUserId && ownerId === currentUserId ? 'owner' : 'manager',
    inviteCode: row.invite_code ? String(row.invite_code) : undefined,
    lastSyncedAt: new Date().toISOString(),
  };
}

function mapRowToSupport(row: Record<string, unknown>): FundSupport {
  return {
    id: String(row.id),
    ownerType: 'project',
    ownerId: String(row.project_id),
    type: (row.type as SupportType) || SupportType.CASH,
    name: String(row.name ?? 'Support Projet'),
    reference: row.reference ? String(row.reference) : undefined,
    currency: String(row.currency ?? 'FBU'),
    balance: Number(row.balance ?? 0),
  };
}

function mapRowToInventory(row: Record<string, unknown>): InventoryItem {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    name: String(row.name ?? 'Produit'),
    unit: String(row.unit ?? 'pièce'),
    quantity: Number(row.quantity ?? 0),
    minStockThreshold: Number(row.min_stock_threshold ?? 5),
    averageUnitCostFbu: Number(row.average_unit_cost_fbu ?? 0),
    totalPurchasedQty: Number(row.total_purchased_qty ?? 0),
    totalSoldQty: Number(row.total_sold_qty ?? 0),
    totalSalesRevenueFbu: Number(row.total_sales_revenue_fbu ?? 0),
    totalCogsFbu: Number(row.total_cogs_fbu ?? 0),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

function mapRowToMember(row: Record<string, unknown>): ProjectMember {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    userId: row.user_id ? String(row.user_id) : undefined,
    email: String(row.email ?? ''),
    displayName: String(row.display_name ?? 'Associé'),
    initials: String(row.initials ?? 'AS'),
    role: (row.role as ProjectRole) || 'manager',
    status: row.status === 'active' ? 'active' : 'invited',
    inviteCode: row.invite_code ? String(row.invite_code) : undefined,
    invitedAt: String(row.invited_at ?? new Date().toISOString()),
    joinedAt: row.joined_at ? String(row.joined_at) : undefined,
  };
}

function mapRowToTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: String(row.id),
    type: (row.type as TransactionType) || TransactionType.INFLOW,
    pocket: 'project',
    projectId: String(row.project_id),
    supportId: String(row.support_id),
    targetSupportId: row.target_support_id ? String(row.target_support_id) : undefined,
    amount: Number(row.amount ?? 0),
    currency: String(row.currency ?? 'FBU'),
    amountInFbu: Number(row.amount_in_fbu ?? 0),
    paymentMethod: (row.payment_method as PaymentMethod) || PaymentMethod.CASH,
    date: String(row.date ?? new Date().toISOString().slice(0, 10)),
    label: String(row.label ?? 'Opération'),
    categoryOrSource: row.category_or_source ? String(row.category_or_source) : undefined,
    note: row.note ? String(row.note) : undefined,
    outflowNature: row.outflow_nature
      ? (row.outflow_nature as ProjectOutflowNature)
      : undefined,
    stockPurchaseLines: Array.isArray(row.stock_purchase_lines)
      ? (row.stock_purchase_lines as StockPurchaseLine[])
      : undefined,
    stockSaleLines: Array.isArray(row.stock_sale_lines)
      ? (row.stock_sale_lines as StockSaleLine[])
      : undefined,
    cogsFbu: row.cogs_fbu != null ? Number(row.cogs_fbu) : undefined,
    grossMarginFbu:
      row.gross_margin_fbu != null ? Number(row.gross_margin_fbu) : undefined,
    authorUserId: row.author_user_id ? String(row.author_user_id) : undefined,
    authorName: row.author_name ? String(row.author_name) : undefined,
    authorInitials: row.author_initials ? String(row.author_initials) : undefined,
    authorRole: row.author_role ? (row.author_role as ProjectRole) : undefined,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

export async function publishSharedProjectRemote(
  project: Project,
  supports: FundSupport[],
  inventory: InventoryItem[],
  members: ProjectMember[]
): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured || !navigator.onLine) return false;
  const user = await getCurrentRemoteUser();
  if (!user) return false;

  const { error: projErr } = await supabase.from('shared_projects').upsert(
    {
      id: project.id,
      owner_user_id: project.ownerUserId || user.id,
      owner_name: project.ownerName || 'Propriétaire',
      name: project.name,
      category: project.category,
      custom_category: project.customCategory ?? null,
      description: project.description ?? null,
      revenue_sources: project.revenueSources,
      expense_categories: project.expenseCategories,
      color_accent: project.colorAccent ?? '#F5B971',
      invite_code: project.inviteCode,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (projErr) throw new Error(projErr.message);

  if (supports.length > 0) {
    const { error: supErr } = await supabase.from('project_supports').upsert(
      supports.map((s) => ({
        id: s.id,
        project_id: project.id,
        type: s.type,
        name: s.name,
        reference: s.reference ?? null,
        currency: s.currency,
        balance: s.balance,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'id' }
    );
    if (supErr) throw new Error(supErr.message);
  }

  if (inventory.length > 0) {
    const { error: invErr } = await supabase.from('project_inventory').upsert(
      inventory.map((item) => ({
        id: item.id,
        project_id: project.id,
        name: item.name,
        unit: item.unit,
        quantity: item.quantity,
        min_stock_threshold: item.minStockThreshold,
        average_unit_cost_fbu: item.averageUnitCostFbu,
        total_purchased_qty: item.totalPurchasedQty,
        total_sold_qty: item.totalSoldQty,
        total_sales_revenue_fbu: item.totalSalesRevenueFbu,
        total_cogs_fbu: item.totalCogsFbu,
        updated_at: item.updatedAt || new Date().toISOString(),
      })),
      { onConflict: 'id' }
    );
    if (invErr) throw new Error(invErr.message);
  }

  if (members.length > 0) {
    const { error: memErr } = await supabase.from('project_members').upsert(
      members.map((m) => ({
        id: m.id,
        project_id: project.id,
        user_id: m.userId ?? (m.role === 'owner' ? user.id : null),
        email: m.email.toLowerCase(),
        display_name: m.displayName,
        initials: m.initials,
        role: m.role,
        status: m.status,
        invite_code: m.inviteCode ?? project.inviteCode ?? null,
        invited_at: m.invitedAt,
        joined_at: m.joinedAt ?? null,
      })),
      { onConflict: 'id' }
    );
    if (memErr) throw new Error(memErr.message);
  }

  return true;
}

export async function pushProjectTransactionRemote(
  tx: Transaction,
  projectSupports: FundSupport[],
  updatedInventory: InventoryItem[]
): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured || !navigator.onLine || !tx.projectId) {
    return false;
  }
  const user = await getCurrentRemoteUser();
  if (!user) return false;

  const { error: txErr } = await supabase.from('project_transactions').upsert(
    {
      id: tx.id,
      project_id: tx.projectId,
      type: tx.type,
      support_id: tx.supportId,
      target_support_id: tx.targetSupportId ?? null,
      amount: tx.amount,
      currency: tx.currency,
      amount_in_fbu: tx.amountInFbu,
      payment_method: tx.paymentMethod,
      date: tx.date,
      label: tx.label,
      category_or_source: tx.categoryOrSource ?? null,
      note: tx.note ?? null,
      outflow_nature: tx.outflowNature ?? null,
      stock_purchase_lines: tx.stockPurchaseLines ?? null,
      stock_sale_lines: tx.stockSaleLines ?? null,
      cogs_fbu: tx.cogsFbu ?? 0,
      gross_margin_fbu: tx.grossMarginFbu ?? null,
      author_user_id: user.id,
      author_name: tx.authorName ?? 'Membre',
      author_initials: tx.authorInitials ?? 'MB',
      author_role: tx.authorRole ?? 'manager',
      created_at: tx.createdAt,
    },
    { onConflict: 'id' }
  );

  if (txErr) throw new Error(txErr.message);

  if (projectSupports.length > 0) {
    await supabase.from('project_supports').upsert(
      projectSupports.map((s) => ({
        id: s.id,
        project_id: tx.projectId!,
        type: s.type,
        name: s.name,
        reference: s.reference ?? null,
        currency: s.currency,
        balance: s.balance,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'id' }
    );
  }

  if (updatedInventory.length > 0) {
    await supabase.from('project_inventory').upsert(
      updatedInventory.map((item) => ({
        id: item.id,
        project_id: item.projectId,
        name: item.name,
        unit: item.unit,
        quantity: item.quantity,
        min_stock_threshold: item.minStockThreshold,
        average_unit_cost_fbu: item.averageUnitCostFbu,
        total_purchased_qty: item.totalPurchasedQty,
        total_sold_qty: item.totalSoldQty,
        total_sales_revenue_fbu: item.totalSalesRevenueFbu,
        total_cogs_fbu: item.totalCogsFbu,
        updated_at: item.updatedAt,
      })),
      { onConflict: 'id' }
    );
  }

  return true;
}

export async function upsertInventoryItemRemote(item: InventoryItem): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured || !navigator.onLine) return false;
  const user = await getCurrentRemoteUser();
  if (!user) return false;

  const { error } = await supabase.from('project_inventory').upsert(
    {
      id: item.id,
      project_id: item.projectId,
      name: item.name,
      unit: item.unit,
      quantity: item.quantity,
      min_stock_threshold: item.minStockThreshold,
      average_unit_cost_fbu: item.averageUnitCostFbu,
      total_purchased_qty: item.totalPurchasedQty,
      total_sold_qty: item.totalSoldQty,
      total_sales_revenue_fbu: item.totalSalesRevenueFbu,
      total_cogs_fbu: item.totalCogsFbu,
      updated_at: item.updatedAt,
    },
    { onConflict: 'id' }
  );

  if (error) throw new Error(error.message);
  return true;
}

export async function inviteProjectMemberRemote(member: ProjectMember): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured || !navigator.onLine) return false;
  const user = await getCurrentRemoteUser();
  if (!user) return false;

  const { error } = await supabase.from('project_members').upsert(
    {
      id: member.id,
      project_id: member.projectId,
      user_id: member.userId ?? null,
      email: member.email.toLowerCase(),
      display_name: member.displayName,
      initials: member.initials,
      role: member.role,
      status: member.status,
      invite_code: member.inviteCode ?? null,
      invited_at: member.invitedAt,
      joined_at: member.joinedAt ?? null,
    },
    { onConflict: 'id' }
  );

  if (error) throw new Error(error.message);
  return true;
}

export async function removeProjectMemberRemote(
  projectId: string,
  memberId: string
): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured || !navigator.onLine) return false;
  const user = await getCurrentRemoteUser();
  if (!user) return false;

  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('id', memberId);

  if (error) throw new Error(error.message);
  return true;
}

export interface SharedProjectBundle {
  project: Project;
  supports: FundSupport[];
  inventory: InventoryItem[];
  members: ProjectMember[];
  transactions: Transaction[];
}

async function fetchIsolatedProjectBundle(
  projectRow: Record<string, unknown>,
  currentUserId: string,
  roleOverride?: ProjectRole
): Promise<SharedProjectBundle> {
  if (!supabase) {
    throw new Error('Supabase non initialisé.');
  }

  const projectId = String(projectRow.id);
  const [supRes, invRes, memRes, txRes] = await Promise.all([
    supabase.from('project_supports').select('*').eq('project_id', projectId),
    supabase.from('project_inventory').select('*').eq('project_id', projectId),
    supabase.from('project_members').select('*').eq('project_id', projectId),
    supabase
      .from('project_transactions')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  const members = (memRes.data ?? []).map((r) =>
    mapRowToMember(r as Record<string, unknown>)
  );
  const matchedMember = members.find((m) => m.userId === currentUserId);
  const resolvedRole: ProjectRole =
    roleOverride ||
    (String(projectRow.owner_user_id ?? '') === currentUserId
      ? 'owner'
      : matchedMember?.role || 'manager');

  const project = mapRowToProject(projectRow, currentUserId);
  project.sharedAccessRole = resolvedRole;

  return {
    project,
    supports: (supRes.data ?? []).map((r) => mapRowToSupport(r as Record<string, unknown>)),
    inventory: (invRes.data ?? []).map((r) =>
      mapRowToInventory(r as Record<string, unknown>)
    ),
    members,
    transactions: (txRes.data ?? []).map((r) =>
      mapRowToTransaction(r as Record<string, unknown>)
    ),
  };
}

export async function joinSharedProjectByCodeRemote(
  inviteCode: string,
  displayName: string,
  initials: string
): Promise<SharedProjectBundle> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error(
      'Supabase doit être configuré (.env.local) et connecté pour rejoindre un projet à distance.'
    );
  }
  const user = await getCurrentRemoteUser();
  if (!user) {
    throw new Error(
      'Connectez votre compte Cloud dans Paramètres → Compte avant de rejoindre un projet partagé.'
    );
  }

  const { data, error } = await supabase.rpc('join_shared_project_by_code', {
    p_invite_code: inviteCode.trim(),
    p_display_name: displayName.trim() || 'Associé',
    p_initials: initials.trim() || 'AS',
  });

  if (error || !data) {
    throw new Error(error?.message || 'Code d’invitation invalide ou expiré.');
  }

  const rpcResult = data as {
    project: Record<string, unknown>;
    member: Record<string, unknown>;
  };
  const role = (rpcResult.member?.role as ProjectRole) || 'manager';

  return fetchIsolatedProjectBundle(rpcResult.project, user.id, role);
}

export async function fetchUserSharedProjectsRemote(): Promise<SharedProjectBundle[]> {
  if (!supabase || !isSupabaseConfigured || !navigator.onLine) return [];
  const user = await getCurrentRemoteUser();
  if (!user) return [];

  const { data, error } = await supabase.from('shared_projects').select('*');
  if (error || !data) return [];

  const bundles = await Promise.all(
    data.map((row) => fetchIsolatedProjectBundle(row as Record<string, unknown>, user.id))
  );
  return bundles;
}

export interface SharedRealtimeHandlers {
  onRemoteTransaction: (tx: Transaction) => void;
  onRemoteInventory: (item: InventoryItem) => void;
  onRemoteMember: (member: ProjectMember) => void;
}

export function subscribeToSharedProjectsRealtime(
  projectIds: string[],
  handlers: SharedRealtimeHandlers
): () => void {
  if (!supabase || !isSupabaseConfigured || projectIds.length === 0) {
    return () => {};
  }

  const uniqueIds = Array.from(new Set(projectIds));
  const filter = `project_id=in.(${uniqueIds.join(',')})`;

  const channel: RealtimeChannel = supabase
    .channel(`tomi_shared_projects_${uniqueIds.join('_').slice(0, 48)}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'project_transactions',
        filter,
      },
      (payload) => {
        if (payload.new) {
          handlers.onRemoteTransaction(
            mapRowToTransaction(payload.new as Record<string, unknown>)
          );
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'project_inventory',
        filter,
      },
      (payload) => {
        if (payload.new && Object.keys(payload.new).length > 0) {
          handlers.onRemoteInventory(
            mapRowToInventory(payload.new as Record<string, unknown>)
          );
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'project_members',
        filter,
      },
      (payload) => {
        if (payload.new && Object.keys(payload.new).length > 0) {
          handlers.onRemoteMember(
            mapRowToMember(payload.new as Record<string, unknown>)
          );
        }
      }
    )
    .subscribe();

  return () => {
    void supabase?.removeChannel(channel);
  };
}