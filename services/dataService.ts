
import { AppState, Account, Family, Category, AccountGroup } from "../types";
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

const defaultState: AppState = {
    accountGroups: defaultAccountGroups,
    accounts: defaultAccounts,
    families: defaultFamilies,
    categories: defaultCategories,
    transactions: [],
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
          // Asegurar que existan grupos de cuenta si vienen de una versión anterior
          if (!data.accountGroups) {
              data.accountGroups = defaultAccountGroups;
              // Asignar grupo por defecto si no tienen
              data.accounts = data.accounts.map((a: Account) => ({ ...a, groupId: a.groupId || 'g1' }));
          }
          return data;
      }
      
      // Si el servidor devuelve error pero no es de autenticación, usamos local
      throw new Error("SERVER_UNAVAILABLE");
  } catch (err) {
      // Carga desde localStorage si el servidor falla o no existe
      const localData = localStorage.getItem(DATA_KEY_PREFIX + username);
      if (localData) {
          const parsed = JSON.parse(localData);
          if (!parsed.accountGroups) {
              parsed.accountGroups = defaultAccountGroups;
              parsed.accounts = parsed.accounts.map((a: Account) => ({ ...a, groupId: a.groupId || 'g1' }));
          }
          return parsed;
      }
      return defaultState;
  }
};

export const saveData = async (state: AppState) => {
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
      // Guardar siempre en local como respaldo o si no hay servidor
      localStorage.setItem(DATA_KEY_PREFIX + username, JSON.stringify(state));
  }
};
