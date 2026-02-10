
import { AppState, Account, Family, Category, AccountGroup, Ledger } from "../types";
import { getToken, getUsername } from "./authService";

const DATA_KEY_PREFIX = 'contamiki_data_';

// Default Ledger ID
const DEF_LEDGER_ID = 'l1';

const defaultLedger: Ledger = {
    id: DEF_LEDGER_ID,
    name: 'Personal',
    color: '#0f172a', // Slate-950
    currency: 'EUR',
    createdAt: new Date().toISOString()
};

const defaultAccountGroups: AccountGroup[] = [
  { id: 'g1', ledgerId: DEF_LEDGER_ID, name: 'Bancos', icon: '🏦' },
  { id: 'g2', ledgerId: DEF_LEDGER_ID, name: 'Efectivo', icon: '💶' },
  { id: 'g3', ledgerId: DEF_LEDGER_ID, name: 'Tarjetas', icon: '💳' },
  { id: 'g4', ledgerId: DEF_LEDGER_ID, name: 'Inversión', icon: '📈' },
];

const defaultFamilies: Family[] = [
  { id: 'f1', ledgerId: DEF_LEDGER_ID, name: 'Vivienda', type: 'EXPENSE', icon: '🏠' },
  { id: 'f2', ledgerId: DEF_LEDGER_ID, name: 'Alimentación', type: 'EXPENSE', icon: '🍎' },
  { id: 'f3', ledgerId: DEF_LEDGER_ID, name: 'Vehículo', type: 'EXPENSE', icon: '🚗' },
  { id: 'f4', ledgerId: DEF_LEDGER_ID, name: 'Ingresos Laborales', type: 'INCOME', icon: '💼' },
  { id: 'f5', ledgerId: DEF_LEDGER_ID, name: 'Inversiones', type: 'INCOME', icon: '📈' },
];

const defaultCategories: Category[] = [
  { id: 'c1', ledgerId: DEF_LEDGER_ID, familyId: 'f1', name: 'Alquiler/Hipoteca', icon: '🔑' },
  { id: 'c2', ledgerId: DEF_LEDGER_ID, familyId: 'f1', name: 'Luz y Gas', icon: '💡' },
  { id: 'c3', ledgerId: DEF_LEDGER_ID, familyId: 'f2', name: 'Supermercado', icon: '🛒' },
  { id: 'c4', ledgerId: DEF_LEDGER_ID, familyId: 'f2', name: 'Restaurantes', icon: '🍽️' },
  { id: 'c5', ledgerId: DEF_LEDGER_ID, familyId: 'f3', name: 'Gasolina', icon: '⛽' },
  { id: 'c6', ledgerId: DEF_LEDGER_ID, familyId: 'f3', name: 'Mantenimiento', icon: '🔧' },
  { id: 'c7', ledgerId: DEF_LEDGER_ID, familyId: 'f4', name: 'Nómina Mensual', icon: '💵' },
  { id: 'c8', ledgerId: DEF_LEDGER_ID, familyId: 'f5', name: 'Dividendos', icon: '💰' },
];

const defaultAccounts: Account[] = [
  { id: 'a1', ledgerId: DEF_LEDGER_ID, groupId: 'g1', name: 'Banco Principal', initialBalance: 1000, currency: 'EUR', icon: '🏦' },
  { id: 'a2', ledgerId: DEF_LEDGER_ID, groupId: 'g2', name: 'Cartera / Efectivo', initialBalance: 150, currency: 'EUR', icon: '👛' },
];

const defaultState: AppState = {
    ledgers: [defaultLedger],
    activeLedgerId: DEF_LEDGER_ID,
    accountGroups: defaultAccountGroups,
    accounts: defaultAccounts,
    families: defaultFamilies,
    categories: defaultCategories,
    transactions: [],
};

// Función auxiliar para migrar datos antiguos sin ledgerId
export const migrateData = (data: any): AppState => {
    if (!data.ledgers || data.ledgers.length === 0) {
        data.ledgers = [defaultLedger];
        data.activeLedgerId = DEF_LEDGER_ID;
        
        // Asignar ledger por defecto a todo lo que no tenga
        const assign = (items: any[]) => items?.map(i => ({ ...i, ledgerId: i.ledgerId || DEF_LEDGER_ID })) || [];
        
        data.accountGroups = assign(data.accountGroups || defaultAccountGroups);
        data.accounts = assign(data.accounts);
        data.families = assign(data.families);
        data.categories = assign(data.categories);
        data.transactions = assign(data.transactions);
        data.recurrents = assign(data.recurrents || []);
        data.favorites = assign(data.favorites || []);
    }
    
    // Asegurar grupos de cuenta
    if (!data.accountGroups || data.accountGroups.length === 0) {
        data.accountGroups = defaultAccountGroups.map(g => ({...g, ledgerId: data.activeLedgerId}));
         // Asignar grupo por defecto si no tienen
         data.accounts = data.accounts.map((a: Account) => ({ ...a, groupId: a.groupId || 'g1' }));
    }

    return data as AppState;
};

export const loadData = async (): Promise<AppState> => {
  const token = getToken();
  const username = getUsername();
  if (!token) throw new Error("No hay token de sesión (401)");

  try {
      const response = await fetch('/api/data', {
          headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.status === 401 || response.status === 403) {
          throw new Error("Sesión expirada (401)");
      }

      if (response.ok) {
          const data = await response.json();
          if (!data || Object.keys(data).length === 0 || !data.families) {
              return defaultState;
          }
          return migrateData(data);
      }
      
      throw new Error("SERVER_UNAVAILABLE");
  } catch (err) {
      const localData = localStorage.getItem(DATA_KEY_PREFIX + username);
      if (localData) {
          return migrateData(JSON.parse(localData));
      }
      return defaultState;
  }
};

export const saveData = async (state: AppState) => {
  const token = getToken();
  const username = getUsername();
  if (!token || !username) return;

  try {
      const response = await fetch('/api/data', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(state)
      });
      
      if (!response.ok) throw new Error("Server error");
  } catch (e) {
      localStorage.setItem(DATA_KEY_PREFIX + username, JSON.stringify(state));
  }
};
