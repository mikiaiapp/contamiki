import { AppState, Account, Family, Category, Transaction, Entity } from "../types";
import { getToken, logout } from "./authService";

const defaultFamilies: Family[] = [
  { id: 'f1', name: 'Vivienda', type: 'EXPENSE' },
  { id: 'f2', name: 'Alimentación', type: 'EXPENSE' },
  { id: 'f3', name: 'Transporte', type: 'EXPENSE' },
  { id: 'f4', name: 'Salario', type: 'INCOME' },
  { id: 'f5', name: 'Inversiones', type: 'INCOME' },
];

const defaultCategories: Category[] = [
  { id: 'c1', familyId: 'f1', name: 'Alquiler/Hipoteca' },
  { id: 'c2', familyId: 'f1', name: 'Suministros' },
  { id: 'c3', familyId: 'f2', name: 'Supermercado' },
  { id: 'c4', familyId: 'f2', name: 'Restaurantes' },
  { id: 'c5', familyId: 'f3', name: 'Gasolina' },
  { id: 'c6', familyId: 'f4', name: 'Nómina' },
  { id: 'c7', familyId: 'f5', name: 'Dividendos' },
];

const defaultAccounts: Account[] = [
  { id: 'a1', name: 'Cuenta Bancaria Principal', initialBalance: 1000, currency: 'EUR' },
  { id: 'a2', name: 'Cartera / Efectivo', initialBalance: 150, currency: 'EUR' },
];

const defaultEntities: Entity[] = [
  { id: 'e1', name: 'Supermercados S.A.' },
  { id: 'e2', name: 'Gasolinera Norte' },
  { id: 'e3', name: 'Empresa Principal S.L.' },
  { id: 'e4', name: 'Casero' },
  { id: 'e5', name: 'Restaurante El Buen Gusto' },
];

const defaultState: AppState = {
    accounts: defaultAccounts,
    families: defaultFamilies,
    categories: defaultCategories,
    entities: defaultEntities,
    transactions: [],
};

export const loadData = async (): Promise<AppState> => {
  try {
    const token = getToken();
    if (!token) throw new Error("No token");

    const response = await fetch('/api/data', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (response.status === 401 || response.status === 403) {
        logout();
        throw new Error("Unauthorized");
    }
    
    if (!response.ok) throw new Error("Server error");
    
    const data = await response.json();
    
    if (!data || !data.accounts || data.accounts.length === 0) {
        return defaultState;
    }
    
    // Ensure entities array exists for older data
    if (!data.entities) {
        data.entities = defaultEntities;
    }
    
    return data;
  } catch (e: any) {
    console.error("Error loading data:", e);
    // If auth error, app will handle redirection, otherwise return defaults
    if (e.message === "Unauthorized" || e.message === "No token") throw e;
    return defaultState;
  }
};

export const saveData = async (state: AppState) => {
  try {
      const token = getToken();
      if(!token) return;

      await fetch('/api/data', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(state)
      });
  } catch (e) {
      console.error("Error saving data:", e);
  }
};