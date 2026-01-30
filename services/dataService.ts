
import { AppState, Account, Family, Category } from "../types";
import { getToken } from "./authService";

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
  const token = getToken();
  if (!token) throw new Error("No hay token de sesión (401)");

  const response = await fetch('/api/data', {
      headers: { 'Authorization': `Bearer ${token}` }
  });

  if (response.status === 401 || response.status === 403) {
      throw new Error("Sesión expirada (401)");
  }

  if (!response.ok) return defaultState;
  
  const data = await response.json();
  if (!data || Object.keys(data).length === 0 || !data.families) {
      return defaultState;
  }
  
  return data;
};

export const saveData = async (state: AppState) => {
  const token = getToken();
  if (!token) return;

  try {
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
