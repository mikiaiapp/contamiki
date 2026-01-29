import React, { useState, useEffect, useRef } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { TransactionView } from './components/TransactionView';
import { SettingsView } from './components/SettingsView';
import { AIInsights } from './components/AIInsights';
import { LoginView } from './components/LoginView';
import { AppState, View, Transaction } from './types';
import { loadData, saveData } from './services/dataService';
import { isAuthenticated } from './services/authService';

const App: React.FC = () => {
  // Auth State
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // App Data State
  const [data, setData] = useState<AppState>({
    accounts: [],
    families: [],
    categories: [],
    transactions: []
  });
  const [currentView, setCurrentView] = useState<View>('DASHBOARD');
  const [dataLoaded, setDataLoaded] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);

  // Check Auth on Mount
  useEffect(() => {
    const authStatus = isAuthenticated();
    setIsLoggedIn(authStatus);
    setCheckingAuth(false);
  }, []);

  // Load Data when logged in
  useEffect(() => {
    if (isLoggedIn) {
        setDataLoaded(false);
        loadData().then(fetchedData => {
            setData(fetchedData);
            setDataLoaded(true);
        }).catch(err => {
            console.error("Failed to load data", err);
            // If load fails due to auth, isLoggedIn will be handled by UI refresh or next check
        });
    }
  }, [isLoggedIn]);

  // Persistence (Debounced save to server)
  useEffect(() => {
    if (isLoggedIn && dataLoaded) {
      if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = window.setTimeout(() => {
          saveData(data);
      }, 1000);
    }
    
    return () => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    }
  }, [data, dataLoaded, isLoggedIn]);

  const handleAddTransaction = (t: Transaction) => {
    setData(prev => ({
      ...prev,
      transactions: [...prev.transactions, t]
    }));
  };

  const handleDeleteTransaction = (id: string) => {
    setData(prev => ({
      ...prev,
      transactions: prev.transactions.filter(t => t.id !== id)
    }));
  };

  const handleUpdateData = (newData: Partial<AppState>) => {
    setData(prev => ({
      ...prev,
      ...newData
    }));
  };

  if (checkingAuth) return null;

  if (!isLoggedIn) {
      return <LoginView onLoginSuccess={() => setIsLoggedIn(true)} />;
  }

  if (!dataLoaded) return (
      <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 gap-3">
          <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="font-medium">Cargando datos seguros...</span>
      </div>
  );

  return (
    <Layout currentView={currentView} setCurrentView={setCurrentView}>
      {currentView === 'DASHBOARD' && <Dashboard data={data} />}
      {currentView === 'TRANSACTIONS' && (
        <TransactionView 
          data={data} 
          onAddTransaction={handleAddTransaction}
          onDeleteTransaction={handleDeleteTransaction}
        />
      )}
      {currentView === 'SETTINGS' && (
        <SettingsView data={data} onUpdateData={handleUpdateData} />
      )}
      {currentView === 'AI_INSIGHTS' && <AIInsights data={data} />}
    </Layout>
  );
};

export default App;
