import { AppState, Account, Family, Category } from "../types";
import { getToken, logout } from "./authService";

// Categorías (Padres - Agrupadores)
const defaultCategories: Category[] = [
  { id: 'c1', name: 'Vivienda', type: 'EXPENSE', icon: '🏠' },
  { id: 'c2', name: 'Alimentación', type: 'EXPENSE', icon: '🍎' },
  { id: 'c3', name: 'Transporte', type: 'EXPENSE', icon: '🚗' },
  { id: 'c4', name: 'Ingresos Laborales', type: 'INCOME', icon: '💼' },
  { id: 'c5', name: 'Ingresos Pasivos', type: 'INCOME', icon: '📈' },
];

// Familias (Hijos - Elementos específicos)
const defaultFamilies: Family[] = [
  { id: 'f1', categoryId: 'c1', name: 'Alquiler/Hipoteca', icon: '🔑' },
  { id: 'f2', categoryId: 'c1', name: 'Suministros (Luz/Agua)', icon: '💡' },
  { id: 'f3', categoryId: 'c2', name: 'Supermercado', icon: '🛒' },
  { id: 'f4', categoryId: 'c2', name: 'Restaurantes', icon: '🍽️' },
  { id: 'f5', categoryId: 'c3', name: 'Gasolina', icon: '⛽' },
  { id: 'f6', categoryId: 'c4', name: 'Nómina', icon: '💵' },
  { id: 'f7', categoryId: 'c5', name: 'Dividendos', icon: '💰' },
];

const defaultAccounts: Account[] = [
  { id: 'a1', name: 'Banco Principal', initialBalance: 1000, currency: 'EUR', icon: '🏦' },
  { id: 'a2', name: 'Cartera / Efectivo', initialBalance: 150, currency: 'EUR', icon: '👛' },
];

const defaultState: AppState = {
    accounts: defaultAccounts,
    families: defaultFamilies,
    categories: defaultCategories,
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
    
    // Si no hay datos o la estructura es antigua (tiene entities), reseteamos a defaults limpios
    // o intentamos migrar. Para simplificar en este cambio estructural, usaremos defaults si faltan categorías.
    if (!data || !data.categories || data.categories.length === 0) {
        return defaultState;
    }
    
    return data;
  } catch (e: any) {
    console.error("Error loading data:", e);
    if (e.message === "Unauthorized" || e.message === "No token") throw e;
    return defaultState;
  }
};

export const saveData = async (state: AppState) => {
  try {
      const token = getToken();
      if(!token) return;

      // Limpieza de datos antiguos si existen antes de guardar
      const cleanState = {
        accounts: state.accounts,
        categories: state.categories,
        families: state.families,
        transactions: state.transactions
      };

      await fetch('/api/data', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(cleanState)
      });
  } catch (e) {
      console.error("Error saving data:", e);
  }
};