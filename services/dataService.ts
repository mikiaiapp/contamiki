
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
  { id: 'c1', familyId: 'f1', name: 'Alquiler/Hipoteca', icon: '🔑', active: true },
  { id: 'c2', familyId: 'f1', name: 'Luz y Gas', icon: '💡', active: true },
  { id: 'c3', familyId: 'f2', name: 'Supermercado', icon: '🛒', active: true },
  { id: 'c4', familyId: 'f2', name: 'Restaurantes', icon: '🍽️', active: true },
  { id: 'c5', familyId: 'f3', name: 'Gasolina', icon: '⛽', active: true },
  { id: 'c6', familyId: 'f3', name: 'Mantenimiento', icon: '🔧', active: true },
  { id: 'c7', familyId: 'f4', name: 'Nómina Mensual', icon: '💵', active: true },
  { id: 'c8', familyId: 'f5', name: 'Dividendos', icon: '💰', active: true },
];

const defaultAccounts: Account[] = [
  { id: 'a1', groupId: 'g1', name: 'Banco Principal', initialBalance: 1000, currency: 'EUR', icon: '🏦', active: true },
  { id: 'a2', groupId: 'g2', name: 'Cartera / Efectivo', initialBalance: 150, currency: 'EUR', icon: '👛', active: true },
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
    if (initialData) {
        const defaultBookId = 'default_book_1';
        return {
            booksMetadata: [
                { id: defaultBookId, name: 'Mi Contabilidad', color: 'BLACK', currency: 'EUR' }
            ],
            currentBookId: defaultBookId,
            booksData: {
                [defaultBookId]: initialData
            }
        };
    }
    return {
        booksMetadata: [],
        currentBookId: '',
        booksData: {}
    };
};

// Helper para asegurar que un AppState tenga todas las propiedades necesarias
const sanitizeAppState = (data: any): AppState => {
    // Clonamos para no mutar referencias
    const cleanDefault = JSON.parse(JSON.stringify(defaultAppState));
    if (!data) return cleanDefault;
    
    const sanitized = { ...data };
    
    if (!sanitized.accountGroups || !Array.isArray(sanitized.accountGroups)) sanitized.accountGroups = cleanDefault.accountGroups;
    if (!sanitized.accounts || !Array.isArray(sanitized.accounts)) sanitized.accounts = cleanDefault.accounts;
    
    // Migración de cuentas antiguas sin groupId o active
    sanitized.accounts = sanitized.accounts.map((a: Account) => ({ 
        ...a, 
        groupId: a.groupId || 'g1',
        active: a.active !== false 
    }));
    
    if (!sanitized.families || !Array.isArray(sanitized.families)) sanitized.families = cleanDefault.families;
    if (!sanitized.categories || !Array.isArray(sanitized.categories)) sanitized.categories = cleanDefault.categories;

    // Migración categorías
    sanitized.categories = sanitized.categories.map((c: Category) => ({
        ...c,
        active: c.active !== false
    }));
    
    if (!sanitized.transactions || !Array.isArray(sanitized.transactions)) sanitized.transactions = [];
    if (!sanitized.recurrents || !Array.isArray(sanitized.recurrents)) sanitized.recurrents = [];
    if (!sanitized.favorites || !Array.isArray(sanitized.favorites)) sanitized.favorites = [];
    
    return sanitized;
};

// REPARACIÓN PROFUNDA: Asegura que todos los libros tengan datos válidos
const validateAndRepairState = (state: MultiBookState): MultiBookState => {
    if (!state) return createInitialMultiBookState();
    
    // Inicializar propiedades si faltan
    if (!state.booksData) state.booksData = {};
    if (!state.booksMetadata || !Array.isArray(state.booksMetadata)) state.booksMetadata = [];

    // 1. RECONSTRUCCIÓN DE HUÉRFANOS (Critical Recovery)
    // Si existen datos en `booksData` pero no están en `metadata`, los recreamos.
    const dataKeys = Object.keys(state.booksData);
    const metaIds = new Set(state.booksMetadata.map(b => b.id));
    
    dataKeys.forEach(dataId => {
        if (!metaIds.has(dataId)) {
            console.warn(`DataService: Recuperando libro huérfano ID ${dataId}`);
            state.booksMetadata.push({
                id: dataId,
                name: `Libro Recuperado (${dataId.substring(0,4)})`,
                color: 'VIOLET',
                currency: 'EUR'
            });
        }
    });

    // 2. Si después de esto no hay libros, resetear todo
    if (state.booksMetadata.length === 0) return createInitialMultiBookState();

    // 3. Reparar CADA libro definido en metadata
    const repairedBooksData: Record<string, AppState> = {};
    
    state.booksMetadata.forEach(book => {
        const existingData = state.booksData[book.id];
        repairedBooksData[book.id] = sanitizeAppState(existingData);
    });

    // 4. Verificar libro actual
    let currentId = state.currentBookId;
    const metaExists = state.booksMetadata.find(b => b.id === currentId);

    if (!metaExists) {
        // Intentar recuperar el primer libro disponible
        if (state.booksMetadata.length > 0) {
            console.warn("DataService: Libro actual no existe. Reseteando al primero disponible.");
            currentId = state.booksMetadata[0].id;
        } else {
             return createInitialMultiBookState();
        }
    }

    return {
        ...state,
        currentBookId: currentId,
        booksData: repairedBooksData
    };
};

export const loadData = async (): Promise<MultiBookState> => {
  const token = getToken();
  if (!token) throw new Error("No hay token de sesión (401)");

  let rawData: any = null;

  try {
      // Detección modo Guest para no fallar en carga
      if (token.startsWith('guest_') || token.startsWith('local_')) {
          const local = localStorage.getItem(DATA_KEY_PREFIX + getUsername());
          rawData = local ? JSON.parse(local) : null;
      } else {
          const response = await fetch('/api/data', {
              headers: { 'Authorization': `Bearer ${token}` }
          });

          if (response.status === 401 || response.status === 403) throw new Error("Sesión expirada (401)");
          if (!response.ok) throw new Error(`Error del servidor: ${response.status}`);

          rawData = await response.json();
      }
  } catch (err) {
      console.error("DataService: Error cargando datos.", err);
      throw err;
  }

  let finalState: MultiBookState;

  if (!rawData || Object.keys(rawData).length === 0) {
      finalState = createInitialMultiBookState();
  } else {
      // Detección de formato Multi-Libro más permisiva
      // Si tiene 'booksData' O 'booksMetadata', es Multi-Libro.
      const isMultiBook = (rawData.booksMetadata && Array.isArray(rawData.booksMetadata)) || (rawData.booksData && typeof rawData.booksData === 'object');
      
      if (isMultiBook) {
          finalState = rawData as MultiBookState;
      } else {
          console.log("Migrando datos antiguos a estructura Multi-Libro...");
          finalState = createInitialMultiBookState(sanitizeAppState(rawData));
      }
  }

  return validateAndRepairState(finalState);
};

export const saveData = async (state: MultiBookState) => {
  const token = getToken();
  const username = getUsername();
  if (!token || !username) return;

  // SOPORTE MODO GUEST/LOCAL
  if (token.startsWith('guest_') || token.startsWith('local_')) {
      try {
          localStorage.setItem(DATA_KEY_PREFIX + username, JSON.stringify(state));
          await new Promise(r => setTimeout(r, 400));
          return;
      } catch (e) {
          console.error("LocalStorage Quota Exceeded for Guest", e);
          throw new Error("Memoria llena. Borra adjuntos para guardar.");
      }
  }

  try {
      // OPTIMIZACIÓN CRÍTICA: PARTIAL SYNC
      const currentBookId = state.currentBookId;
      const activeBookData = state.booksData[currentBookId];

      const partialPayload = {
          // Metadatos siempre completos para no perder referencias
          booksMetadata: state.booksMetadata, 
          currentBookId: state.currentBookId,
          // Enviamos SOLO el libro actual en booksData.
          booksData: {
              [currentBookId]: activeBookData
          }
      };

      const response = await fetch('/api/data', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(partialPayload)
      });
      
      if (!response.ok) {
          let errorMsg = `Server error ${response.status}`;
          try {
             const errJson = await response.json();
             if (errJson.error) errorMsg = errJson.error;
          } catch(e) {
             const text = await response.text();
             if (text) errorMsg = text.substring(0, 100); // Truncar si es html largo
          }
          throw new Error(errorMsg);
      }
      
      // Actualizamos backup local completo por seguridad
      try {
          localStorage.setItem(DATA_KEY_PREFIX + username, JSON.stringify(state));
      } catch (storageError) {
          console.warn("WARN: LocalStorage quota exceeded. Backup skipped, but Server Sync was SUCCESSFUL.");
      }
  } catch (e) {
      console.error("Error guardando datos:", e);
      throw e;
  }
};
