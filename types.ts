export type TransactionType = 'EXPENSE' | 'INCOME';

export interface Account {
  id: string;
  name: string;
  initialBalance: number;
  currency: string;
}

export interface Family {
  id: string;
  name: string;
  type: TransactionType;
}

export interface Category {
  id: string;
  familyId: string;
  name: string;
}

export interface Entity {
  id: string;
  name: string;
}

export interface Transaction {
  id: string;
  date: string; // ISO String
  amount: number;
  description: string;
  accountId: string;
  categoryId: string;
  familyId: string; // Denormalized for easier filtering
  entityId?: string; // Contrapartida
  type: TransactionType;
}

export interface AppState {
  accounts: Account[];
  families: Family[];
  categories: Category[];
  entities: Entity[];
  transactions: Transaction[];
}

export type View = 'DASHBOARD' | 'TRANSACTIONS' | 'SETTINGS' | 'AI_INSIGHTS';