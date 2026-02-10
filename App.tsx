
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Layout } from './Layout';
import { Dashboard } from './Dashboard';
import { TransactionView } from './TransactionView';
import { SettingsView } from './components/SettingsView';
import { AIInsights } from './components/AIInsights';
import { LoginView } from './LoginView';
import { AppState, View, Transaction, GlobalFilter, MultiBookState, BookMetadata, BookColor } from './types';
import { loadData, saveData, defaultAppState } from './services/dataService';
import { isAuthenticated, logout } from './services/authService';
import { X, Check } from 'lucide-react';

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(isAuthenticated());
  
  // ESTADO MAESTRO: MultiBookState
  const [multiState, setMultiState] = useState<MultiBookState>({
    booksMetadata: [],
    currentBookId: '',
    booksData: {}
  });
  
  const [currentView, setCurrentView] = useState<View>('RESUMEN');
  const [dataLoaded, setDataLoaded] = useState(false);
  
  // Estado para gestión de libros (Modal)
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [editingBookId, setEditingBookId] = useState<string | null>(null); // Null = Creando, String = Editando
  const [tempBookName, setTempBookName] = useState('');
  const [tempBookColor, setTempBookColor] = useState<BookColor>('BLACK');

  // Filtro Global Compartido (Sincronizado)
  const [globalFilter, setGlobalFilter] = useState<GlobalFilter>({
    timeRange: 'MONTH',
    referenceDate: new Date(),
    customStart: '',
    customEnd: ''
  });

  const [pendingSpecificFilters, setPendingSpecificFilters] = useState<any>(null);
  const saveTimeoutRef = useRef<number>(null);

  // --- CARGA DE DATOS ---
  useEffect(() => {
    if (isLoggedIn) {
        setDataLoaded(false);
        loadData()
            .then(fetchedData => {
                setMultiState(fetchedData);
                setDataLoaded(true);
            })
            .catch(err => {
                if (err.message.includes('401') || err.message.includes('403')) {
                    logout();
                } else {
                    // Si falla, inicializamos vacío pero cargado
                    setDataLoaded(true);
                }
            });
    }
  }, [isLoggedIn]);

  // --- GUARDADO AUTOMÁTICO ---
  useEffect(() => {
    if (isLoggedIn && dataLoaded) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = window.setTimeout(() => {
          saveData(multiState);
      }, 1500);
    }
  }, [multiState, dataLoaded, isLoggedIn]);

  // --- HELPERS DE DATOS ---
  // Obtener el AppState del libro actual
  const currentAppData = useMemo(() => {
      const bookId = multiState.currentBookId;
      const data = multiState.booksData[bookId];
      if (!data) return { // Fallback de seguridad
          accountGroups: [], accounts: [], families: [], categories: [], transactions: [], recurrents: [], favorites: []
      };
      return data;
  }, [multiState]);

  // Obtener metadata del libro actual
  const currentBookMeta = useMemo(() => {
      return multiState.booksMetadata.find(b => b.id === multiState.currentBookId) || { id: 'err', name: 'Error', color: 'BLACK' as BookColor, currency: 'EUR' };
  }, [multiState]);

  // Función para actualizar datos DENTRO del libro actual
  const updateCurrentBookData = (newData: Partial<AppState>) => {
      setMultiState(prev => {
          const bookId = prev.currentBookId;
          // Use defaultAppState fallback to ensure type safety.
          // prev.booksData[bookId] should exist, but || defaultAppState satisfies TypeScript that it is full AppState.
          const currentData = prev.booksData[bookId] || defaultAppState;
          return {
              ...prev,
              booksData: {
                  ...prev.booksData,
                  [bookId]: { ...currentData, ...newData }
              }
          };
      });
  };

  // --- HANDLERS DE TRANSACCIONES ---
  const handleAddTransaction = (t: Transaction) => {
    updateCurrentBookData({ transactions: [t, ...currentAppData.transactions] });
  };

  const handleUpdateTransaction = (t: Transaction) => {
    updateCurrentBookData({ 
        transactions: currentAppData.transactions.map(tx => tx.id === t.id ? t : tx) 
    });
  };

  const handleDeleteTransaction = (id: string) => {
    updateCurrentBookData({ transactions: currentAppData.transactions.filter(tx => tx.id !== id) });
  };

  // --- HANDLERS DE GESTIÓN DE LIBROS ---
  const handleSwitchBook = (bookId: string) => {
      setMultiState(prev => ({ ...prev, currentBookId: bookId }));
      setCurrentView('RESUMEN'); // Resetear vista al cambiar
  };

  const openCreateBookModal = () => {
      setEditingBookId(null);
      setTempBookName('');
      setTempBookColor('BLACK');
      setIsBookModalOpen(true);
  };

  const openEditBookModal = () => {
      setEditingBookId(currentBookMeta.id);
      setTempBookName(currentBookMeta.name);
      setTempBookColor(currentBookMeta.color);
      setIsBookModalOpen(true);
  };

  const handleSaveBook = () => {
      if (!tempBookName.trim()) return;

      setMultiState(prev => {
          if (editingBookId) {
              // EDITAR EXISTENTE
              return {
                  ...prev,
                  booksMetadata: prev.booksMetadata.map(b => b.id === editingBookId ? { ...b, name: tempBookName, color: tempBookColor } : b)
              };
          } else {
              // CREAR NUEVO
              const newId = Math.random().toString(36).substring(2, 15);
              const newBookMeta: BookMetadata = { id: newId, name: tempBookName, color: tempBookColor, currency: 'EUR' };
              
              // Inicializar datos por defecto clonando estructura básica
              const newBookData: AppState = { ...defaultAppState };

              return {
                  ...prev,
                  booksMetadata: [...prev.booksMetadata, newBookMeta],
                  booksData: { ...prev.booksData, [newId]: newBookData },
                  currentBookId: newId // Cambiar automáticamente al nuevo
              };
          }
      });
      setIsBookModalOpen(false);
  };

  if (!isLoggedIn) {
      return <LoginView onLoginSuccess={() => setIsLoggedIn(true)} />;
  }

  if (!dataLoaded) {
      return (
          <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-950 text-white z-[999]">
              <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6"></div>
              <p className="text-xs font-black uppercase tracking-[0.4em]">Cargando Libros...</p>
          </div>
      );
  }

  return (
    <Layout 
        currentView={currentView} 
        setCurrentView={setCurrentView} 
        data={currentAppData}
        books={multiState.booksMetadata}
        currentBook={currentBookMeta}
        onSwitchBook={handleSwitchBook}
        onCreateBook={openCreateBookModal}
        onEditBook={openEditBookModal}
    >
      {currentView === 'RESUMEN' && (
        <Dashboard 
            data={currentAppData} 
            onAddTransaction={handleAddTransaction}
            onUpdateData={updateCurrentBookData}
            filter={globalFilter}
            onUpdateFilter={setGlobalFilter}
            onNavigateToTransactions={(spec) => {
                setPendingSpecificFilters(spec);
                setCurrentView('TRANSACTIONS');
            }}
        />
      )}
      {currentView === 'TRANSACTIONS' && (
        <TransactionView 
          data={currentAppData} 
          onAddTransaction={handleAddTransaction}
          onDeleteTransaction={handleDeleteTransaction}
          onUpdateTransaction={handleUpdateTransaction}
          onUpdateData={updateCurrentBookData}
          filter={globalFilter}
          onUpdateFilter={setGlobalFilter}
          initialSpecificFilters={pendingSpecificFilters}
          clearSpecificFilters={() => setPendingSpecificFilters(null)}
        />
      )}
      {currentView === 'SETTINGS' && (
        <SettingsView data={currentAppData} onUpdateData={updateCurrentBookData} />
      )}
      {currentView === 'AI_INSIGHTS' && <AIInsights data={currentAppData} />}

      {/* MODAL CREAR/EDITAR LIBRO */}
      {isBookModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl space-y-6">
                  <div className="flex justify-between items-center">
                      <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">{editingBookId ? 'Editar Libro' : 'Nueva Contabilidad'}</h3>
                      <button onClick={() => setIsBookModalOpen(false)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X size={18} /></button>
                  </div>
                  
                  <div className="space-y-4">
                      <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre</label>
                          <input 
                              type="text" 
                              className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" 
                              placeholder="Ej: Personal, Negocio..."
                              value={tempBookName}
                              onChange={e => setTempBookName(e.target.value)}
                              autoFocus
                          />
                      </div>
                      <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Color Identificativo</label>
                          <div className="grid grid-cols-3 gap-2">
                              {(['BLACK', 'BLUE', 'ROSE', 'EMERALD', 'AMBER', 'VIOLET'] as BookColor[]).map(c => (
                                  <button 
                                    key={c}
                                    onClick={() => setTempBookColor(c)}
                                    className={`h-12 rounded-xl flex items-center justify-center transition-all ${
                                        tempBookColor === c ? 'ring-4 ring-offset-2 ring-indigo-200 scale-105 shadow-md' : 'opacity-60 hover:opacity-100'
                                    }`}
                                    style={{
                                        backgroundColor: 
                                            c === 'BLACK' ? '#020617' : 
                                            c === 'BLUE' ? '#2563eb' : 
                                            c === 'ROSE' ? '#f43f5e' : 
                                            c === 'EMERALD' ? '#10b981' : 
                                            c === 'AMBER' ? '#f59e0b' : '#7c3aed'
                                    }}
                                  >
                                      {tempBookColor === c && <Check className="text-white" size={20} />}
                                  </button>
                              ))}
                          </div>
                      </div>
                  </div>

                  <button onClick={handleSaveBook} className="w-full py-4 bg-slate-950 text-white rounded-xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-indigo-600 transition-all">
                      Guardar Cambios
                  </button>
              </div>
          </div>
      )}
    </Layout>
  );
};

export default App;
