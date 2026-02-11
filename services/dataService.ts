
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
    if (!data) return JSON.parse(JSON.stringify(defaultAppState));
    const sanitized = { ...data };
    
    // Asegurar arrays estructurales si faltan
    if (!sanitized.accountGroups || !Array.isArray(sanitized.accountGroups)) sanitized.accountGroups = defaultAccountGroups;
    if (!sanitized.accounts || !Array.isArray(sanitized.accounts)) sanitized.accounts = defaultAccounts;
    
    // Migración de cuentas antiguas sin groupId
    sanitized.accounts = sanitized.accounts.map((a: Account) => ({ ...a, groupId: a.groupId || 'g1' }));
    
    if (!sanitized.families || !Array.isArray(sanitized.families)) sanitized.families = defaultFamilies;
    if (!sanitized.categories || !Array.isArray(sanitized.categories)) sanitized.categories = defaultCategories;
    
    // Asegurar arrays de datos si faltan (evita que un libro parezca "vacío" o de error)
    if (!sanitized.transactions || !Array.isArray(sanitized.transactions)) sanitized.transactions = [];
    if (!sanitized.recurrents || !Array.isArray(sanitized.recurrents)) sanitized.recurrents = [];
    if (!sanitized.favorites || !Array.isArray(sanitized.favorites)) sanitized.favorites = [];
    
    return sanitized;
};

// Reparar estados inconsistentes de TODOS los libros
const validateAndRepairState = (state: MultiBookState): MultiBookState => {
    // 1. Estructura base
    if (!state || !state.booksData || !state.booksMetadata || !Array.isArray(state.booksMetadata)) {
        return createInitialMultiBookState();
    }
    
    // 2. Si no hay libros definidos en metadata, resetear
    if (state.booksMetadata.length === 0) return createInitialMultiBookState();

    // 3. REPARACIÓN PROFUNDA: Iterar sobre TODOS los libros en metadata
    // Si un libro existe en metadata pero no tiene datos (o están corruptos), inicializarlo/sanitizarlo.
    const repairedBooksData: Record<string, AppState> = {};
    
    state.booksMetadata.forEach(book => {
        const existingData = state.booksData[book.id];
        // Aplicamos sanitizeAppState a CADA libro para garantizar que tiene transactions: [], accounts: [], etc.
        repairedBooksData[book.id] = sanitizeAppState(existingData);
    });

    // 4. Verificar que el libro actual apunta a uno válido
    let currentId = state.currentBookId;
    const metaExists = state.booksMetadata.find(b => b.id === currentId);

    if (!metaExists) {
        console.warn("DataService: Libro actual no existe en metadata. Reseteando al primero.");
        currentId = state.booksMetadata[0].id;
    }

    return {
        ...state,
        currentBookId: currentId,
        booksData: repairedBooksData // Usamos la data reparada
    };
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

      if (!response.ok) {
          throw new Error(`Error del servidor: ${response.status}`);
      }

      rawData = await response.json();
  } catch (err) {
      console.error("DataService: Error crítico cargando datos remotos.", err);
      throw err;
  }

  // --- Lógica de Migración ---
  let finalState: MultiBookState;

  if (!rawData || Object.keys(rawData).length === 0) {
      // Usuario nuevo o archivo vacío -> Inicializar
      finalState = createInitialMultiBookState();
  } else if (rawData.booksMetadata && Array.isArray(rawData.booksMetadata)) {
      // Formato nativo Multi-Libro
      finalState = rawData as MultiBookState;
  } else {
      // Migración formato antiguo
      console.log("Migrando datos antiguos a estructura Multi-Libro...");
      finalState = createInitialMultiBookState(sanitizeAppState(rawData));
  }

  // Ejecutar validación profunda en todos los libros
  return validateAndRepairState(finalState);
};

export const saveData = async (state: MultiBookState) => {
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
      
      if (!response.ok) throw new Error("Server error saving data");
      
      // Solo actualizamos el backup local si el guardado en servidor fue exitoso
      localStorage.setItem(DATA_KEY_PREFIX + username, JSON.stringify(state));
  } catch (e) {
      console.error("Error guardando datos:", e);
      throw e; // Lanzar error para que la UI pueda mostrarlo
  }
};
