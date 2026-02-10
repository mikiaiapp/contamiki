
import { AppState, Account, Family, Category, AccountGroup, MultiBookState, BookMetadata } from "../types";
import { getToken, getUsername } from "./authService";

const DATA_KEY_PREFIX = 'contamiki_data_';

const defaultAccountGroups: AccountGroup[] = [
  { id: 'g1', name: 'Bancos', icon: '🏦' },
  { id: 'g2', name: 'Efectivo', icon: '💶' },
  { id: 'g3', name: 'Tarjetas', icon: '💳' },
  { id: 'g4', name: 'Inversión', icon: '📈' },
];

const defaultFamilies: Family[] = [
  { id: 'f1', name: 'Vivienda', type: 'EXPENSE', icon: '🏠' },
  { id: 'f2', name: 'Alimentación', type: 'EXPENSE', icon: '🍎' },
  { id: 'f3', name: 'Vehículo', type: 'EXPENSE', icon: '🚗' },
  { id: 'f4', name: 'Ingresos Laborales', type: 'INCOME', icon: '💼' },
  { id: 'f5', name: 'Inversiones', type: 'INCOME', icon: '📈' },
];

const defaultCategories: Category[] = [
  { id: 'c1', familyId: 'f1', name: 'Alquiler/Hipoteca', icon: '🔑' },
  { id: 'c2', familyId: 'f1', name: 'Luz y Gas', icon: '💡' },
  { id: 'c3', familyId: 'f2', name: 'Supermercado', icon: '🛒' },
  { id: 'c4', familyId: 'f2', name: 'Restaurantes', icon: '🍽️' },
  { id: 'c5', familyId: 'f3', name: 'Gasolina', icon: '⛽' },
  { id: 'c6', familyId: 'f3', name: 'Mantenimiento', icon: '🔧' },
  { id: 'c7', familyId: 'f4', name: 'Nómina Mensual', icon: '💵' },
  { id: 'c8', familyId: 'f5', name: 'Dividendos', icon: '💰' },
];

const defaultAccounts: Account[] = [
  { id: 'a1', groupId: 'g1', name: 'Banco Principal', initialBalance: 1000, currency: 'EUR', icon: '🏦' },
  { id: 'a2', groupId: 'g2', name: 'Cartera / Efectivo', initialBalance: 150, currency: 'EUR', icon: '👛' },
];

export const defaultAppState: AppState = {
    accountGroups: defaultAccountGroups,
    accounts: defaultAccounts,
    families: defaultFamilies,
    categories: defaultCategories,
    transactions: [],
    recurrents: [],
    favorites: []
};

const createInitialMultiBookState = (initialData?: AppState): MultiBookState => {
    const defaultBookId = 'default_book_1';
    return {
        booksMetadata: [
            { id: defaultBookId, name: 'Mi Contabilidad', color: 'BLACK', currency: 'EUR' }
        ],
        currentBookId: defaultBookId,
        booksData: {
            [defaultBookId]: initialData || defaultAppState
        }
    };
};

// Helper para asegurar que un AppState tenga todas las propiedades necesarias
const sanitizeAppState = (data: any): AppState => {
    if (!data) return defaultAppState;
    const sanitized = { ...data };
    if (!sanitized.accountGroups) sanitized.accountGroups = defaultAccountGroups;
    if (!sanitized.accounts) sanitized.accounts = defaultAccounts;
    // Asegurar grupos en cuentas antiguas
    sanitized.accounts = sanitized.accounts.map((a: Account) => ({ ...a, groupId: a.groupId || 'g1' }));
    
    if (!sanitized.families) sanitized.families = defaultFamilies;
    if (!sanitized.categories) sanitized.categories = defaultCategories;
    if (!sanitized.transactions) sanitized.transactions = [];
    if (!sanitized.recurrents) sanitized.recurrents = [];
    if (!sanitized.favorites) sanitized.favorites = [];
    
    return sanitized;
};

export const loadData = async (): Promise<MultiBookState> => {
  const token = getToken();
  const username = getUsername();
  if (!token) throw new Error("No hay token de sesión (401)");

  let rawData: any = null;

  try {
      const response = await fetch('/api/data', {
          headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.status === 401 || response.status === 403) {
          throw new Error("Sesión expirada (401)");
      }

      if (response.ok) {
          rawData = await response.json();
      } else {
          throw new Error("SERVER_UNAVAILABLE");
      }
  } catch (err) {
      // Fallback a localStorage
      const local = localStorage.getItem(DATA_KEY_PREFIX + username);
      if (local) rawData = JSON.parse(local);
  }

  // --- Lógica de Migración ---
  if (!rawData || Object.keys(rawData).length === 0) {
      return createInitialMultiBookState();
  }

  // Detectar si es el formato nuevo (tiene booksMetadata)
  if (rawData.booksMetadata && Array.isArray(rawData.booksMetadata)) {
      return rawData as MultiBookState;
  } 
  
  // Es formato antiguo (AppState plano), lo migramos
  console.log("Migrando datos antiguos a estructura Multi-Libro...");
  return createInitialMultiBookState(sanitizeAppState(rawData));
};

export const saveData = async (state: MultiBookState) => {
  const token = getToken();
  const username = getUsername();
  if (!token || !username) return;

  // Intentar guardar en servidor
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
      // Guardar siempre en local como respaldo
      localStorage.setItem(DATA_KEY_PREFIX + username, JSON.stringify(state));
  }
};
