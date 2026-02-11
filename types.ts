
export type TransactionType = 'EXPENSE' | 'INCOME' | 'TRANSFER';
export type RecurrenceFrequency = 'DAYS' | 'WEEKS' | 'MONTHLY' | 'YEARS';

export interface AccountGroup {
  id: string;
  name: string;
  icon: string;
}

export interface Account {
  id: string;
  name: string;
  initialBalance: number;
  currency: string;
  icon: string;
  groupId: string;
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
  transferAccountId?: string;
  familyId: string;
  categoryId: string;
  frequency: RecurrenceFrequency;
  interval: number;
  startDate: string;
  nextDueDate: string;
  endDate?: string; // Fecha fin opcional
  active: boolean;
}

export interface FavoriteMovement {
  id: string;
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
  accountGroups: AccountGroup[];
  accounts: Account[];
  families: Family[];
  categories: Category[];
  transactions: Transaction[];
  recurrents?: RecurrentMovement[];
  favorites?: FavoriteMovement[];
}

// NUEVAS INTERFACES PARA MULTI-CONTABILIDAD
export type BookColor = 'BLACK' | 'BLUE' | 'ROSE' | 'EMERALD' | 'AMBER' | 'VIOLET';

export interface BookMetadata {
  id: string;
  name: string;
  color: BookColor;
  currency: string;
}

export interface MultiBookState {
  booksMetadata: BookMetadata[];
  currentBookId: string;
  booksData: Record<string, AppState>; // Mapa: bookId -> Datos
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

export interface SettingsViewProps {
  data: AppState;
  onUpdateData: (newData: Partial<AppState>) => void;
  onNavigateToTransactions?: (filters: any) => void;
  onCreateBookFromImport?: (data: AppState, name: string) => void;
  onDeleteBook?: () => void;
}
