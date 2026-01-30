
import React, { useState, useEffect, useRef } from 'react';
import { Layout } from './Layout';
import { Dashboard } from './Dashboard';
import { TransactionView } from './TransactionView';
import { SettingsView } from './components/SettingsView';
import { AIInsights } from './components/AIInsights';
import { LoginView } from './LoginView';
import { AppState, View, Transaction } from './types';
import { loadData, saveData } from './services/dataService';
import { isAuthenticated, logout } from './services/authService';

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(isAuthenticated());
  const [data, setData] = useState<AppState>({
    accounts: [],
    families: [],
    categories: [],
    transactions: []
  });
  const [currentView, setCurrentView] = useState<View>('DASHBOARD');
  const [dataLoaded, setDataLoaded] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (isLoggedIn) {
        setDataLoaded(false);
        loadData()
            .then(fetchedData => {
                setData(fetchedData);
                setDataLoaded(true);
            })
            .catch(err => {
                console.error("Failed to load data:", err);
                // Si hay un error de autenticación (401), cerramos sesión
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
      {currentView === 'DASHBOARD' && <Dashboard data={data} />}
      {currentView === 'TRANSACTIONS' && (
        <TransactionView 
          data={data} 
          onAddTransaction={(t) => setData(prev => ({...prev, transactions: [...prev.transactions, t]}))}
          onDeleteTransaction={(id) => setData(prev => ({...prev, transactions: prev.transactions.filter(tx => tx.id !== id)}))}
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
