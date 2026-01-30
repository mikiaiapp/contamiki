
export type TransactionType = 'EXPENSE' | 'INCOME' | 'TRANSFER';
export type RecurrenceFrequency = 'DAYS' | 'WEEKS' | 'MONTHLY' | 'YEARS';

export interface Account {
  id: string;
  name: string;
  initialBalance: number;
  currency: string;
  icon: string;
}

export interface Family {
  id: string;
  name: string;
  type: 'EXPENSE' | 'INCOME'; 
  icon: string;
}

export interface Category {
  id: string;
  name: string;
  familyId: string;
  icon: string;
}

export interface Transaction {
  id: string;
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
  description: string;
  amount: number;
  type: TransactionType;
  accountId: string;
  transferAccountId?: string; // Cuenta de contrapartida
  familyId: string;
  categoryId: string;
  frequency: RecurrenceFrequency;
  interval: number; // El "X" en "cada X meses"
  startDate: string;
  nextDueDate: string;
  active: boolean;
}

export interface FavoriteMovement {
  id: string;
  name: string;
  description: string;
  amount: number;
  type: TransactionType;
  accountId: string;
  transferAccountId?: string; // Cuenta de contrapartida
  familyId: string;
  categoryId: string;
  icon?: string;
}

export interface AppState {
  accounts: Account[];
  families: Family[];
  categories: Category[];
  transactions: Transaction[];
  recurrents?: RecurrentMovement[];
  favorites?: FavoriteMovement[];
}

export type View = 'RESUMEN' | 'TRANSACTIONS' | 'SETTINGS' | 'AI_INSIGHTS';
