
import React, { useState, useEffect, useRef } from 'react';
import { Layout } from './Layout';
import { Dashboard } from './Dashboard';
import { TransactionView } from './TransactionView';
import { SettingsView } from './components/SettingsView';
import { AIInsights } from './components/AIInsights';
import { LoginView } from './LoginView';
import { AppState, View, Transaction, RecurrentMovement, FavoriteMovement } from './types';
import { loadData, saveData } from './services/dataService';
import { isAuthenticated, logout } from './services/authService';

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(isAuthenticated());
  const [data, setData] = useState<AppState>({
    accounts: [],
    families: [],
    categories: [],
    transactions: [],
    recurrents: [],
    favorites: []
  });
  const [currentView, setCurrentView] = useState<View>('RESUMEN');
  const [dataLoaded, setDataLoaded] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);

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
                console.error("Failed to load data:", err);
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
    return () => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    }
  }, [data, dataLoaded, isLoggedIn]);

  const handleAddTransaction = (t: Transaction) => {
    setData(prev => ({...prev, transactions: [...prev.transactions, t]}));
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

  const handleUpdateRecurrent = (r: RecurrentMovement) => {
    setData(prev => ({
        ...prev,
        recurrents: prev.recurrents?.some(x => x.id === r.id) 
            ? prev.recurrents.map(x => x.id === r.id ? r : x)
            : [...(prev.recurrents || []), r]
    }));
  };

  if (!isLoggedIn) {
      return <LoginView onLoginSuccess={() => setIsLoggedIn(true)} />;
  }

  if (!dataLoaded) {
      return (
          <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-950 text-white z-[999]">
              <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6 shadow-[0_0_20px_rgba(99,102,241,0.3)]"></div>
              <p className="text-xs font-black uppercase tracking-[0.4em] animate-pulse">Cifrando Finanzas</p>
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
        />
      )}
      {currentView === 'TRANSACTIONS' && (
        <TransactionView 
          data={data} 
          onAddTransaction={handleAddTransaction}
          onDeleteTransaction={handleDeleteTransaction}
          onUpdateTransaction={handleUpdateTransaction}
          onUpdateData={(newData) => setData(prev => ({...prev, ...newData}))}
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
