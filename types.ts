
export type TransactionType = 'EXPENSE' | 'INCOME' | 'TRANSFER';

export interface Account {
  id: string;
  name: string;
  initialBalance: number;
  currency: string;
  icon: string; // Emoji o Base64 DataURL
}

// AHORA Family es el PADRE (Agrupador Principal)
export interface Family {
  id: string;
  name: string;
  type: 'EXPENSE' | 'INCOME'; 
  icon: string; // Emoji o Base64 DataURL
}

// AHORA Category es el HIJO (Detalle específico)
export interface Category {
  id: string;
  name: string;
  familyId: string; // Link to parent (Family)
  icon: string; // Emoji o Base64 DataURL
}

export interface Transaction {
  id: string;
  date: string; // ISO String
  amount: number;
  description: string;
  accountId: string; // Cuenta origen
  transferAccountId?: string; // Solo para traspasos
  familyId: string; // Agrupador Principal
  categoryId: string; // Detalle específico
  type: TransactionType;
  brandIcon?: string; // Logotipo detectado vía IA/Internet
}

export interface AppState {
  accounts: Account[];
  families: Family[];
  categories: Category[];
  transactions: Transaction[];
}

export type View = 'DASHBOARD' | 'TRANSACTIONS' | 'SETTINGS' | 'AI_INSIGHTS';
