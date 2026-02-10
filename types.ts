
export type TransactionType = 'EXPENSE' | 'INCOME' | 'TRANSFER';
export type RecurrenceFrequency = 'DAYS' | 'WEEKS' | 'MONTHLY' | 'YEARS';

export interface Ledger {
  id: string;
  name: string;
  color: string; // Hex color code or Tailwind class representative
  currency: string;
  createdAt: string;
}

export interface AccountGroup {
  id: string;
  ledgerId: string;
  name: string;
  icon: string;
}

export interface Account {
  id: string;
  ledgerId: string;
  name: string;
  initialBalance: number;
  currency: string;
  icon: string;
  groupId: string;
}

export interface Family {
  id: string;
  ledgerId: string;
  name: string;
  type: 'EXPENSE' | 'INCOME'; 
  icon: string;
}

export interface Category {
  id: string;
  ledgerId: string;
  name: string;
  familyId: string;
  icon: string;
}

export interface Transaction {
  id: string;
  ledgerId: string;
  date: string;
  amount: number;
  description: string;
  accountId: string;
  transferAccountId?: string;
  familyId: string;
  categoryId: string;
  type: TransactionType;
  brandIcon?: string;
  attachment?: string;
  isFromRecurrence?: string; 
}

export interface RecurrentMovement {
  id: string;
  ledgerId: string;
  description: string;
  amount: number;
  type: TransactionType;
  accountId: string;
  transferAccountId?: string;
  familyId: string;
  categoryId: string;
  frequency: RecurrenceFrequency;
  interval: number;
  startDate: string;
  nextDueDate: string;
  active: boolean;
}

export interface FavoriteMovement {
  id: string;
  ledgerId: string;
  name: string;
  description: string;
  amount: number;
  type: TransactionType;
  accountId: string;
  transferAccountId?: string;
  familyId: string;
  categoryId: string;
  icon?: string;
}

export interface AppState {
  ledgers?: Ledger[]; // Optional for backward compatibility init
  activeLedgerId?: string;
  
  accountGroups: AccountGroup[];
  accounts: Account[];
  families: Family[];
  categories: Category[];
  transactions: Transaction[];
  recurrents?: RecurrentMovement[];
  favorites?: FavoriteMovement[];
}

export interface ImportReport {
  added: number;
  newAccounts: string[];
  newCategories: string[];
  errors: { fila: number; error: string }[];
}

export type View = 'RESUMEN' | 'TRANSACTIONS' | 'SETTINGS' | 'AI_INSIGHTS';

export type TimeRange = 'ALL' | 'MONTH' | 'YEAR' | 'CUSTOM';

export interface GlobalFilter {
  timeRange: TimeRange;
  referenceDate: Date;
  customStart: string;
  customEnd: string;
}
