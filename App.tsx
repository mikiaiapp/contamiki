
import React, { useState, useEffect, useRef } from 'react';
import { Layout } from './Layout';
import { Dashboard } from './Dashboard';
import { TransactionView } from './TransactionView';
import { SettingsView } from './components/SettingsView';
import { AIInsights } from './components/AIInsights';
import { LoginView } from './LoginView';
import { AppState, View, Transaction, GlobalFilter } from './types';
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

  const handleAddTransaction = (t: Transaction) => {
    setData(prev => ({...prev, transactions: [t, ...prev.transactions]}));
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
    <Layout currentView={currentView} setCurrentView={setCurrentView}>
      {currentView === 'RESUMEN' && (
        <Dashboard 
            data={data} 
            onAddTransaction={handleAddTransaction}
            onUpdateData={(newData) => setData(prev => ({...prev, ...newData}))}
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
          data={data} 
          onAddTransaction={handleAddTransaction}
          onDeleteTransaction={handleDeleteTransaction}
          onUpdateTransaction={handleUpdateTransaction}
          onUpdateData={(newData) => setData(prev => ({...prev, ...newData}))}
          filter={globalFilter}
          onUpdateFilter={setGlobalFilter}
          initialSpecificFilters={pendingSpecificFilters}
          clearSpecificFilters={() => setPendingSpecificFilters(null)}
        />
      )}
      {currentView === 'SETTINGS' && (
        <SettingsView data={data} onUpdateData={(newData) => setData(prev => ({...prev, ...newData}))} />
      )}
      {currentView === 'AI_INSIGHTS' && <AIInsights data={data} />}
    </Layout>
  );
};

export default App;
