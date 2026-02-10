
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Layout } from './Layout';
import { Dashboard } from './Dashboard';
import { TransactionView } from './TransactionView';
import { SettingsView } from './components/SettingsView';
import { AIInsights } from './components/AIInsights';
import { LoginView } from './LoginView';
import { AppState, View, Transaction, GlobalFilter, AccountGroup, Account, Family, Category, Ledger } from './types';
import { loadData, saveData } from './services/dataService';
import { isAuthenticated, logout } from './services/authService';

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(isAuthenticated());
  const [data, setData] = useState<AppState>({
    accountGroups: [],
    accounts: [],
    families: [],
    categories: [],
    transactions: [],
    recurrents: [],
    favorites: []
  });
  
  const [currentView, setCurrentView] = useState<View>('RESUMEN');
  const [targetSettingsTab, setTargetSettingsTab] = useState<string | undefined>(undefined);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  // Filtro Global Compartido (Sincronizado)
  const [globalFilter, setGlobalFilter] = useState<GlobalFilter>({
    timeRange: 'MONTH',
    referenceDate: new Date(),
    customStart: '',
    customEnd: ''
  });

  const [pendingSpecificFilters, setPendingSpecificFilters] = useState<any>(null);
  const saveTimeoutRef = useRef<number>(null);

  useEffect(() => {
    if (isLoggedIn) {
        setDataLoaded(false);
        loadData()
            .then(fetchedData => {
                setData({
                    ...fetchedData,
                    recurrents: fetchedData.recurrents || [],
                    favorites: fetchedData.favorites || []
                });
                setDataLoaded(true);
            })
            .catch(err => {
                if (err.message.includes('401') || err.message.includes('403')) {
                    logout();
                } else {
                    setDataLoaded(true);
                }
            });
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn && dataLoaded) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = window.setTimeout(() => {
          saveData(data);
      }, 1500);
    }
  }, [data, dataLoaded, isLoggedIn]);

  // --- MULTI-LEDGER LOGIC ---
  const activeLedgerId = data.activeLedgerId || 'l1';

  const filteredData: AppState = useMemo(() => {
      // Filtrar todas las colecciones para que solo muestren items del ledger activo
      const filterByLedger = (items: any[]) => items.filter(i => i.ledgerId === activeLedgerId);
      
      return {
          ...data,
          activeLedgerId, // Mantener referencia al activo
          accountGroups: filterByLedger(data.accountGroups),
          accounts: filterByLedger(data.accounts),
          families: filterByLedger(data.families),
          categories: filterByLedger(data.categories),
          transactions: filterByLedger(data.transactions),
          recurrents: filterByLedger(data.recurrents || []),
          favorites: filterByLedger(data.favorites || [])
      };
  }, [data, activeLedgerId]);

  const handleSwitchLedger = (ledgerId: string) => {
      setData(prev => ({ ...prev, activeLedgerId: ledgerId }));
      setGlobalFilter({ ...globalFilter, timeRange: 'MONTH' }); // Resetear filtros temporales al cambiar contexto
  };

  const handleCreateLedger = (name: string, color: string) => {
      const newLedger: Ledger = {
          id: Math.random().toString(36).substring(2, 10),
          name,
          color,
          currency: 'EUR',
          createdAt: new Date().toISOString()
      };
      
      // Crear grupos básicos para el nuevo ledger
      const basicGroups: AccountGroup[] = [
          { id: Math.random().toString(36).substring(2,10), ledgerId: newLedger.id, name: 'Bancos', icon: '🏦' },
          { id: Math.random().toString(36).substring(2,10), ledgerId: newLedger.id, name: 'Efectivo', icon: '💶' }
      ];

      setData(prev => ({
          ...prev,
          ledgers: [...(prev.ledgers || []), newLedger],
          activeLedgerId: newLedger.id,
          accountGroups: [...prev.accountGroups, ...basicGroups]
      }));
  };

  const handleUpdateLedger = (id: string, name: string, color: string) => {
      setData(prev => ({
          ...prev,
          ledgers: prev.ledgers?.map(l => l.id === id ? { ...l, name, color } : l)
      }));
  };

  // --- CRUD HELPERS (Inject Ledger ID) ---
  // Inyectamos el ledgerId activo a cualquier objeto nuevo que se cree

  const injectLedger = (obj: any) => ({ ...obj, ledgerId: activeLedgerId });

  const handleAddTransaction = (t: Transaction) => {
    setData(prev => ({...prev, transactions: [injectLedger(t), ...prev.transactions]}));
  };

  const handleUpdateTransaction = (t: Transaction) => {
    setData(prev => ({
        ...prev, 
        transactions: prev.transactions.map(tx => tx.id === t.id ? t : tx)
    }));
  };

  const handleDeleteTransaction = (id: string) => {
    setData(prev => ({...prev, transactions: prev.transactions.filter(tx => tx.id !== id)}));
  };

  // Generic Update Handler for SettingsView (Groups, Accounts, Families, Categories, Recurrents, Favorites)
  // This function intercepts the update, finds what changed (added items), injects ledgerId, and updates main state.
  const handleSettingsUpdate = (newData: Partial<AppState>) => {
      setData(prev => {
          const updatedState = { ...prev };

          // Helper to merge and inject ID for new items
          const mergeCollection = (key: keyof AppState) => {
              if (newData[key]) {
                  const incomingList = newData[key] as any[];
                  const prevList = prev[key] as any[];
                  
                  // Si es una lista nueva/modificada filtrada, necesitamos fusionarla con los datos "ocultos" de otros ledgers
                  // 1. Identificar items que ya existían (updates) o son nuevos (creates) en el contexto actual
                  // 2. Mantener items de otros ledgers intactos
                  
                  const otherLedgersItems = prevList.filter(i => i.ledgerId !== activeLedgerId);
                  
                  // Inyectar ID a los items entrantes (por seguridad)
                  const processedIncoming = incomingList.map(item => item.ledgerId ? item : { ...item, ledgerId: activeLedgerId });
                  
                  updatedState[key] = [...otherLedgersItems, ...processedIncoming] as any;
              }
          };

          mergeCollection('accountGroups');
          mergeCollection('accounts');
          mergeCollection('families');
          mergeCollection('categories');
          mergeCollection('recurrents');
          mergeCollection('favorites');
          
          // Transacciones (casos de borrado masivo o importación)
          if (newData.transactions) {
               const incomingTxs = newData.transactions;
               const otherLedgersTxs = prev.transactions.filter(t => t.ledgerId !== activeLedgerId);
               const processedIncomingTxs = incomingTxs.map(t => t.ledgerId ? t : { ...t, ledgerId: activeLedgerId });
               updatedState.transactions = [...otherLedgersTxs, ...processedIncomingTxs];
          }

          return updatedState;
      });
  };

  const handleSmartImport = () => {
      setTargetSettingsTab('TOOLS');
      setCurrentView('SETTINGS');
  };

  if (!isLoggedIn) {
      return <LoginView onLoginSuccess={() => setIsLoggedIn(true)} />;
  }

  if (!dataLoaded) {
      return (
          <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-950 text-white z-[999]">
              <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6"></div>
              <p className="text-xs font-black uppercase tracking-[0.4em]">Sincronizando Libro...</p>
          </div>
      );
  }

  return (
    <Layout 
        currentView={currentView} 
        setCurrentView={(v) => { setCurrentView(v); setTargetSettingsTab(undefined); }} 
        data={data}
        onSwitchLedger={handleSwitchLedger}
        onCreateLedger={handleCreateLedger}
        onUpdateLedger={handleUpdateLedger}
    >
      {currentView === 'RESUMEN' && (
        <Dashboard 
            data={filteredData} 
            onAddTransaction={handleAddTransaction}
            onUpdateData={handleSettingsUpdate}
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
          data={filteredData} 
          onAddTransaction={handleAddTransaction}
          onDeleteTransaction={handleDeleteTransaction}
          onUpdateTransaction={handleUpdateTransaction}
          onUpdateData={handleSettingsUpdate}
          filter={globalFilter}
          onUpdateFilter={setGlobalFilter}
          initialSpecificFilters={pendingSpecificFilters}
          clearSpecificFilters={() => setPendingSpecificFilters(null)}
          onNavigateToImport={handleSmartImport}
        />
      )}
      {currentView === 'SETTINGS' && (
        <SettingsView data={filteredData} onUpdateData={handleSettingsUpdate} initialTab={targetSettingsTab} />
      )}
      {currentView === 'AI_INSIGHTS' && <AIInsights data={filteredData} />}
    </Layout>
  );
};

export default App;
