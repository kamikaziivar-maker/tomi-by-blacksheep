export type NavTab = 'home' | 'projects' | 'debts_savings' | 'ai_coach';

export type TimePeriod = 'week' | 'month' | 'all';

export enum SupportType {
  CASH = 'cash',
  BANK = 'bank',
  MOBILE_MONEY = 'mobile_money',
}

export enum ProjectCategory {
  RESTAURATION = 'Restauration',
  BUSINESS = 'Business',
  ART_DIVERTISSEMENT = 'Art et divertissement',
  IMMOBILIER = 'Immobilier',
  COMMERCE_VENTE = 'Commerce / Vente',
  SERVICES_TECH = 'Services / Tech',
  AUTRE = 'Autre',
}

export enum TransactionType {
  INFLOW = 'inflow',
  OUTFLOW = 'outflow',
  TRANSFER = 'transfer',
  INTERNAL_LOAN = 'internal_loan',
  LOAN_REPAYMENT = 'loan_repayment',
}

export enum PaymentMethod {
  CASH = 'Cash',
  LUMICASH = 'Lumicash',
  ECOCASH = 'EcoCash',
  BANQUE = 'Banque',
  AUTRE = 'Autre',
}

export type PocketTarget = 'personal' | 'project' | 'savings' | 'debt';

export interface CurrencyConfig {
  code: string;
  name: string;
  symbol: string;
  /** Number of FBU equal to 1 unit of this currency (FBU = 1) */
  rateToFbu: number;
}

export interface FundSupport {
  id: string;
  ownerType: 'personal' | 'project';
  ownerId: string; // 'personal' or project.id
  type: SupportType;
  name: string; // e.g., "Cash Terrain", "Bancobu Courant", "Lumicash Pro"
  reference?: string; // optional account number or phone number
  currency: string;
  balance: number; // stored in the support's own currency
  logoDataUrl?: string; // compressed miniature base64 logo for bank / mobile money
}

export type ProjectOutflowNature = 'operating_expense' | 'stock_purchase';

export type ProjectRole = 'owner' | 'manager' | 'viewer';

export interface StockPurchaseLine {
  itemId?: string;
  itemName: string;
  unit: string;
  quantity: number;
  unitCostFbu: number;
  totalCostFbu: number;
  minStockThreshold?: number;
}

export interface StockSaleLine {
  itemId: string;
  itemName: string;
  unit: string;
  quantity: number;
  unitCostFbu: number;
  totalCostFbu: number;
}

export interface InventoryItem {
  id: string;
  projectId: string;
  name: string;
  unit: string;
  quantity: number;
  minStockThreshold: number;
  averageUnitCostFbu: number;
  totalPurchasedQty: number;
  totalSoldQty: number;
  totalSalesRevenueFbu: number;
  totalCogsFbu: number;
  updatedAt: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  email: string;
  displayName: string;
  initials: string;
  role: ProjectRole;
  status: 'invited' | 'active';
  inviteCode?: string;
  userId?: string;
  invitedAt: string;
  joinedAt?: string;
}

export interface SharedProjectSyncOp {
  id: string;
  projectId: string;
  kind: 'upsert_project' | 'insert_transaction' | 'upsert_inventory' | 'upsert_member' | 'delete_member';
  payload: unknown;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  category: ProjectCategory | string;
  customCategory?: string;
  description?: string;
  revenueSources: string[];
  expenseCategories: string[];
  createdAt: string;
  colorAccent?: string;
  ownerUserId?: string;
  ownerName?: string;
  isShared?: boolean;
  /** Role on this device when joined as a collaborator; undefined or 'owner' for owned projects */
  sharedAccessRole?: ProjectRole;
  inviteCode?: string;
  lastSyncedAt?: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  pocket: PocketTarget;
  projectId?: string;
  savingsGoalId?: string;
  debtId?: string;
  supportId: string;
  targetSupportId?: string; // used for transfers and internal loans
  amount: number; // always positive, stored in `currency`
  currency: string;
  amountInFbu: number; // converted at transaction time
  paymentMethod: PaymentMethod;
  date: string; // YYYY-MM-DD
  label: string; // libellé / nom client, fournisseur, créancier
  categoryOrSource?: string; // revenue source or expense post
  note?: string;
  outflowNature?: ProjectOutflowNature;
  stockPurchaseLines?: StockPurchaseLine[];
  stockSaleLines?: StockSaleLine[];
  cogsFbu?: number;
  grossMarginFbu?: number;
  authorUserId?: string;
  authorName?: string;
  authorInitials?: string;
  authorRole?: ProjectRole;
  createdAt: string;
}

export interface InternalLoan {
  id: string;
  projectId: string;
  fromSupportId: string;
  toSupportId: string;
  initialAmountFbu: number;
  remainingAmountFbu: number;
  date: string;
  reminderDate?: string;
  reminderDelayDays?: number;
  note?: string;
  status: 'active' | 'repaid';
  repayments: {
    id: string;
    amountFbu: number;
    date: string;
    fromSupportId: string;
    toSupportId: string;
  }[];
}

export interface DebtRepayment {
  id: string;
  amountFbu: number;
  date: string;
  supportId?: string;
  note?: string;
}

export interface DebtItem {
  id: string;
  direction: 'debt' | 'receivable'; // 'debt' = je dois, 'receivable' = on me doit
  personName: string;
  initialAmountFbu: number;
  remainingAmountFbu: number;
  currency: string;
  date: string;
  dueDate?: string;
  note?: string;
  repayments: DebtRepayment[];
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmountFbu: number;
  currentAmountFbu: number;
  linkedSupportId?: string;
  deadline?: string;
  note?: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export type AccountMode = 'guest' | 'local_profile' | 'cloud_ready';

export interface AccountSecuritySettings {
  mode: AccountMode;
  displayName: string;
  email?: string;
  avatarDataUrl?: string;
  cloudProviderLabel?: string;
  cloudSyncUrl?: string;
  pinEnabled: boolean;
  pinHash?: string;
  localProfileConfirmedAt?: string;
}

export type ShakeSensitivity = 'soft' | 'normal' | 'strong';

export type NotificationCategory =
  | 'internal_loans'
  | 'debts'
  | 'projects_redline'
  | 'ai_reports'
  | 'daily_entry'
  | 'low_stock'
  | 'shared_activity';

export interface NotificationItem {
  id: string;
  dedupeKey: string;
  category: NotificationCategory;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'danger';
  createdAt: string;
  read: boolean;
  targetTab?: NavTab;
  targetProjectId?: string;
  actionLabel?: string;
}

export interface NotificationSettings {
  internalLoansEnabled: boolean;
  debtsEnabled: boolean;
  projectsRedlineEnabled: boolean;
  aiReportsEnabled: boolean;
  dailyReminderEnabled: boolean;
  dailyReminderTime: string; // HH:MM
  lowTreasuryThresholdFbu: number;
}

export interface AppSettings {
  displayCurrency: string;
  currencies: CurrencyConfig[];
  period: TimePeriod;
  account?: AccountSecuritySettings;
  privacyMode?: boolean;
  shakeEnabled?: boolean;
  shakeSensitivity?: ShakeSensitivity;
  ambientFlowsEnabled?: boolean;
  customLogoDataUrl?: string;
  notifications?: NotificationSettings;
}

export interface FinanceState {
  settings: AppSettings;
  supports: FundSupport[];
  projects: Project[];
  inventoryItems?: InventoryItem[];
  projectMembers?: ProjectMember[];
  pendingSyncQueue?: SharedProjectSyncOp[];
  transactions: Transaction[];
  internalLoans: InternalLoan[];
  debts: DebtItem[];
  savingsGoals: SavingsGoal[];
  chatHistory: ChatMessage[];
  notifications?: NotificationItem[];
  dismissedNotificationKeys?: string[];
}
