export type TransactionType = 'EXPENSE' | 'INCOME';

export interface Account {
  id: string;
  name: string;
  initialBalance: number;
  currency: string;
  icon: string; // Emoji
}

// Ahora Category es el PADRE (Agrupador para subtotales)
export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  icon: string; // Emoji
}

// Ahora Family es el HIJO (Detalle específico donde va el apunte)
export interface Family {
  id: string;
  name: string;
  categoryId: string; // Link to parent
  icon: string; // Emoji
}

export interface Transaction {
  id: string;
  date: string; // ISO String
  amount: number;
  description: string;
  accountId: string;
  familyId: string; // El apunte va a la familia
  categoryId: string; // Desnormalizado para búsquedas rápidas
  type: TransactionType;
}

export interface AppState {
  accounts: Account[];
  families: Family[];
  categories: Category[];
  transactions: Transaction[];
}

export type View = 'DASHBOARD' | 'TRANSACTIONS' | 'SETTINGS' | 'AI_INSIGHTS';