import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Layout } from './Layout';
import { Dashboard } from './Dashboard';
import { TransactionView } from './TransactionView';
import { SettingsView } from './components/SettingsView';
import { ChartsView } from './ChartsView';
import { AIInsights } from './components/AIInsights';
import { LoginView } from './LoginView';
import { AppState, View, Transaction, GlobalFilter, MultiBookState, BookMetadata, BookColor } from './types';
import { loadData, saveData, defaultAppState } from './services/dataService';
import { isAuthenticated, logout, getToken, deleteBook } from './services/authService';
import { X, Check, WifiOff, RefreshCw, Plus, LayoutList, LogOut } from 'lucide-react';

const App: React.FC = () => {
  console.log("App: Rendering...");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(isAuthenticated());
  const [multiState, setMultiState] = useState<MultiBookState>({
    booksMetadata: [],
    currentBookId: '',
    booksData: {}
  });
  const [currentView, setCurrentView] = useState<View>('RESUMEN');
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  const [syncStatus, setSyncStatus] = useState<'SAVED' | 'SAVING' | 'ERROR'>('SAVED');
  const [syncErrorMsg, setSyncErrorMsg] = useState<string | null>(null);
  const lastSavedState = useRef<string>('');
  
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [tempBookName, setTempBookName] = useState('');
  const [tempBookColor, setTempBookColor] = useState<BookColor>('BLACK');
  const [globalFilter, setGlobalFilter] = useState<GlobalFilter>(() => {
      // Inicializar filtro global al mes actual por defecto
      const now = new Date();
      return {
          timeRange: 'MONTH',
          referenceDate: now,
          customStart: '',
          customEnd: ''
      };
  });
  const [pendingSpecificFilters, setPendingSpecificFilters] = useState<any>(null);
  const saveTimeoutRef = useRef<number | null>(null);

  // Efecto para cargar la configuración de la API (IA)
  useEffect(() => {
    if (isLoggedIn) {
        const token = getToken();
        if (token && !token.startsWith('guest_') && !token.startsWith('local_')) {
            fetch('/api/config', {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            .then(res => res.json())
            .then(config => {
                if (config.apiKey) {
                    // Inyectamos la clave en el shim de process.env para que los servicios la vean
                    if ((window as any).process && (window as any).process.env) {
                        (window as any).process.env.API_KEY = config.apiKey;
                        console.log("App: AI Config loaded from server.");
                    }
                }
            })
            .catch(err => console.error("App: Error fetching AI config", err));
        }
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn) {
        setDataLoaded(false);
        setLoadError(null);
        loadData()
            .then(fetchedData => {
                setMultiState(fetchedData);
                lastSavedState.current = JSON.stringify(fetchedData);
                setDataLoaded(true);
            })
            .catch(err => {
                console.error("App: Load Error caught", err);
                if (err.message.includes('401') || err.message.includes('403')) {
                    logout();
                } else {
                    setLoadError(err.message || "Error de conexión");
                }
            });
    }
  }, [isLoggedIn]);

  const performSave = async (stateToSave: MultiBookState) => {
      setSyncStatus('SAVING');
      setSyncErrorMsg(null);
      try {
          await saveData(stateToSave);
          setSyncStatus('SAVED');
          lastSavedState.current = JSON.stringify(stateToSave);
      } catch (err: any) {
          setSyncStatus('ERROR');
          setSyncErrorMsg(err.message || "Error desconocido");
          console.error(err);
      }
  };

  useEffect(() => {
    if (isLoggedIn && dataLoaded && !loadError) {
      const currentStateStr = JSON.stringify(multiState);
      if (currentStateStr === lastSavedState.current) return;

      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
      
      setSyncStatus('SAVING');
      saveTimeoutRef.current = window.setTimeout(() => performSave(multiState), 4000);
    }
  }, [multiState, dataLoaded, isLoggedIn, loadError]);

  const currentAppData = useMemo(() => {
      const bookId = multiState.currentBookId;
      const data = multiState.booksData[bookId];
      if (!data) return defaultAppState; 
      return data;
  }, [multiState]);

  const currentBookMeta = useMemo(() => {
      return multiState.booksMetadata.find(b => b.id === multiState.currentBookId) || { id: 'err', name: 'Error', color: 'BLACK' as BookColor, currency: 'EUR' };
  }, [multiState]);

  const updateCurrentBookData = (newData: Partial<AppState>) => {
      setMultiState(prev => {
          const bookId = prev.currentBookId;
          const currentData = prev.booksData[bookId] || defaultAppState;
          return { ...prev, booksData: { ...prev.booksData, [bookId]: { ...currentData, ...newData } } };
      });
  };

  const handleReplaceFullState = (newState: MultiBookState) => {
      setMultiState(newState);
      setCurrentView('RESUMEN');
  };

  const handleDeleteBook = async () => {
      if (currentBookMeta.isShared) {
          alert("No puedes eliminar una contabilidad a la que has sido invitado.");
          return;
      }

      try {
          const token = getToken();
          if (token && !token.startsWith('local_') && !token.startsWith('guest_')) {
              await deleteBook(multiState.currentBookId);
          }
          
          setMultiState(prev => {
              const remainingBooks = prev.booksMetadata.filter(b => b.id !== prev.currentBookId);
              const { [prev.currentBookId]: deleted, ...remainingData } = prev.booksData;
              const newCurrentId = remainingBooks.length > 0 ? remainingBooks[0].id : '';
              
              return {
                  ...prev,
                  booksMetadata: remainingBooks,
                  currentBookId: newCurrentId,
                  booksData: remainingData
              };
          });
          setCurrentView('RESUMEN');
      } catch (e: any) {
          alert(e.message);
      }
  };

  const handleSwitchBook = (bookId: string) => { 
    setMultiState(prev => ({ ...prev, currentBookId: bookId })); 
    setCurrentView('RESUMEN'); 
  };

  const handleSaveBook = () => {
      if (!tempBookName.trim()) return;
      setMultiState(prev => {
          if (editingBookId) {
              return { ...prev, booksMetadata: prev.booksMetadata.map(b => b.id === editingBookId ? { ...b, name: tempBookName, color: tempBookColor } : b) };
          } else {
              const newId = Math.random().toString(36).substring(2, 15);
              return { 
                  ...prev, 
                  booksMetadata: [...prev.booksMetadata, { id: newId, name: tempBookName, color: tempBookColor, currency: 'EUR' }], 
                  booksData: { ...prev.booksData, [newId]: JSON.parse(JSON.stringify(defaultAppState)) }, 
                  currentBookId: newId 
              };
          }
      });
      setIsBookModalOpen(false);
  };

  const handleAddTransaction = (t: Transaction) => {
      setMultiState(prev => {
          const bookId = prev.currentBookId;
          const currentData = prev.booksData[bookId] || defaultAppState;
          return { 
              ...prev, 
              booksData: { 
                  ...prev.booksData, 
                  [bookId]: { 
                      ...currentData, 
                      transactions: [t, ...currentData.transactions] 
                  } 
              } 
          };
      });
  };

  const handleUpdateTransaction = (t: Transaction) => {
      setMultiState(prev => {
          const bookId = prev.currentBookId;
          const currentData = prev.booksData[bookId] || defaultAppState;
          return { 
              ...prev, 
              booksData: { 
                  ...prev.booksData, 
                  [bookId]: { 
                      ...currentData, 
                      transactions: currentData.transactions.map(tx => tx.id === t.id ? t : tx) 
                  } 
              } 
          };
      });
  };

  const handleDeleteTransaction = (id: string) => {
      setMultiState(prev => {
          const bookId = prev.currentBookId;
          const currentData = prev.booksData[bookId] || defaultAppState;
          return { 
              ...prev, 
              booksData: { 
                  ...prev.booksData, 
                  [bookId]: { 
                      ...currentData, 
                      transactions: currentData.transactions.filter(tx => tx.id !== id) 
                  } 
              } 
          };
      });
  };

  if (!isLoggedIn) return <LoginView onLoginSuccess={() => setIsLoggedIn(true)} />;
  if (loadError) return (<div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-950 text-white z-[999] p-6 text-center"><div className="bg-rose-500/10 p-6 rounded-full mb-6 animate-pulse"><WifiOff size={48} className="text-rose-500" /></div><h2 className="text-2xl font-black uppercase tracking-tight mb-2">Error de Conexión</h2><p className="text-slate-400 text-sm max-w-md mb-8">No se han podido cargar los datos.<br/><br/><span className="text-xs font-mono bg-slate-900 p-1 rounded text-rose-400">{loadError}</span></p><button onClick={() => window.location.reload()} className="bg-white text-slate-900 px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center gap-3"><RefreshCw size={16} /> Reintentar</button></div>);
  if (!dataLoaded) return <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-950 text-white z-[999]"><div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6"></div><p className="text-xs font-black uppercase tracking-widest">ContaMiki...</p></div>;
  
  if (multiState.booksMetadata.length === 0) {
      return (
          <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-950 text-white z-[999] p-6 text-center">
              <div className="bg-indigo-500/10 p-8 rounded-[3rem] mb-8 border border-indigo-500/20">
                  <LayoutList size={64} className="text-indigo-500" />
              </div>
              <h2 className="text-3xl font-black uppercase tracking-tight mb-4">Bienvenido a ContaMiki</h2>
              <p className="text-slate-400 text-sm max-w-md mb-10 leading-relaxed">
                  Para comenzar a gestionar tus finanzas, necesitas crear tu primera contabilidad o aceptar una invitación.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                  <button 
                      onClick={() => { setEditingBookId(null); setTempBookName(''); setTempBookColor('BLACK'); setIsBookModalOpen(true); }}
                      className="bg-white text-slate-900 px-10 py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-white/5 hover:scale-105 transition-transform"
                  >
                      <Plus size={18} /> Crear Primera Contabilidad
                  </button>
                  <button 
                      onClick={() => { logout(); setIsLoggedIn(false); }}
                      className="bg-slate-800 text-white px-10 py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 hover:bg-slate-700 transition-colors"
                  >
                      <LogOut size={18} /> Cerrar Sesión
                  </button>
              </div>

              {isBookModalOpen && (
                  <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                      <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl space-y-6">
                          <div className="flex justify-between items-center"><h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Nueva Contabilidad</h3><button onClick={() => setIsBookModalOpen(false)} className="p-2 bg-slate-100 rounded-full"><X size={18} /></button></div>
                          <div className="space-y-4">
                              <input type="text" className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 text-slate-900" placeholder="Nombre..." value={tempBookName} onChange={e => setTempBookName(e.target.value)} autoFocus />
                              <div className="grid grid-cols-3 gap-2">{(['BLACK', 'BLUE', 'ROSE', 'EMERALD', 'AMBER', 'VIOLET'] as BookColor[]).map(c => (<button key={c} onClick={() => setTempBookColor(c)} className={`h-10 rounded-xl flex items-center justify-center transition-all ${tempBookColor === c ? 'ring-2 ring-indigo-500 scale-105' : 'opacity-60'}`} style={{ backgroundColor: c === 'BLACK' ? '#020617' : c === 'BLUE' ? '#2563eb' : c === 'ROSE' ? '#f43f5e' : c === 'EMERALD' ? '#10b981' : c === 'AMBER' ? '#f59e0b' : '#7c3aed' }}>{tempBookColor === c && <Check className="text-white" size={16} />}</button>))}</div>
                          </div>
                          <button onClick={handleSaveBook} className="w-full py-4 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest">Guardar</button>
                      </div>
                  </div>
              )}
          </div>
      );
  }

  return (
    <>
      <Layout 
          currentView={currentView} setCurrentView={setCurrentView} data={currentAppData}
          books={multiState.booksMetadata} currentBook={currentBookMeta} onSwitchBook={handleSwitchBook}
          onCreateBook={() => { setEditingBookId(null); setTempBookName(''); setTempBookColor('BLACK'); setIsBookModalOpen(true); }}
          onEditBook={() => { setEditingBookId(currentBookMeta.id); setTempBookName(currentBookMeta.name); setTempBookColor(currentBookMeta.color); setIsBookModalOpen(true); }}
          syncStatus={syncStatus} syncError={syncErrorMsg} onManualSave={() => performSave(multiState)}
      >
        {currentView === 'RESUMEN' && (
          <>
            <Dashboard data={currentAppData} onAddTransaction={handleAddTransaction} onUpdateData={updateCurrentBookData} filter={globalFilter} onUpdateFilter={setGlobalFilter} onNavigateToTransactions={(spec) => { setPendingSpecificFilters(spec); if (spec.action !== 'NEW' && spec.action !== 'IMPORT') setCurrentView('TRANSACTIONS'); }} currentBook={currentBookMeta} />
            {pendingSpecificFilters && (pendingSpecificFilters.action === 'NEW' || pendingSpecificFilters.action === 'IMPORT') && (
              <TransactionView mode="MODAL_ONLY" data={currentAppData} onAddTransaction={handleAddTransaction} onDeleteTransaction={handleDeleteTransaction} onUpdateTransaction={handleUpdateTransaction} onUpdateData={updateCurrentBookData} filter={globalFilter} onUpdateFilter={setGlobalFilter} initialSpecificFilters={pendingSpecificFilters} clearSpecificFilters={() => setPendingSpecificFilters(null)} currentBook={currentBookMeta} onFinished={() => setPendingSpecificFilters(null)} />
            )}
          </>
        )}
        {currentView === 'TRANSACTIONS' && <TransactionView data={currentAppData} onAddTransaction={handleAddTransaction} onDeleteTransaction={handleDeleteTransaction} onUpdateTransaction={handleUpdateTransaction} onUpdateData={updateCurrentBookData} filter={globalFilter} onUpdateFilter={setGlobalFilter} initialSpecificFilters={pendingSpecificFilters} clearSpecificFilters={() => setPendingSpecificFilters(null)} currentBook={currentBookMeta} onFinished={() => setCurrentView('RESUMEN')} />}
        {currentView === 'CHARTS' && <ChartsView data={currentAppData} filter={globalFilter} onUpdateFilter={setGlobalFilter} currentBook={currentBookMeta} />}
        {currentView === 'SETTINGS' && (
          <>
            <SettingsView data={currentAppData} books={multiState.booksMetadata} currentBookId={multiState.currentBookId} multiState={multiState} onUpdateData={updateCurrentBookData} onReplaceFullState={handleReplaceFullState} onNavigateToTransactions={(spec) => { setPendingSpecificFilters(spec); if (spec.action !== 'NEW' && spec.action !== 'IMPORT') setCurrentView('TRANSACTIONS'); }} onDeleteBook={handleDeleteBook} />
            {pendingSpecificFilters && (pendingSpecificFilters.action === 'NEW' || pendingSpecificFilters.action === 'IMPORT') && (
              <TransactionView mode="MODAL_ONLY" data={currentAppData} onAddTransaction={handleAddTransaction} onDeleteTransaction={handleDeleteTransaction} onUpdateTransaction={handleUpdateTransaction} onUpdateData={updateCurrentBookData} filter={globalFilter} onUpdateFilter={setGlobalFilter} initialSpecificFilters={pendingSpecificFilters} clearSpecificFilters={() => setPendingSpecificFilters(null)} currentBook={currentBookMeta} onFinished={() => setPendingSpecificFilters(null)} />
            )}
          </>
        )}
        {currentView === 'AI_INSIGHTS' && <AIInsights data={currentAppData} />}
      </Layout>

      {isBookModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
              <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl space-y-6">
                  <div className="flex justify-between items-center"><h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">{editingBookId ? 'Editar Libro' : 'Nueva Contabilidad'}</h3><button onClick={() => setIsBookModalOpen(false)} className="p-2 bg-slate-100 rounded-full"><X size={18} /></button></div>
                  <div className="space-y-4">
                      <input type="text" className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500" placeholder="Nombre..." value={tempBookName} onChange={e => setTempBookName(e.target.value)} />
                      <div className="grid grid-cols-3 gap-2">{(['BLACK', 'BLUE', 'ROSE', 'EMERALD', 'AMBER', 'VIOLET'] as BookColor[]).map(c => (<button key={c} onClick={() => setTempBookColor(c)} className={`h-10 rounded-xl flex items-center justify-center transition-all ${tempBookColor === c ? 'ring-2 ring-indigo-500 scale-105' : 'opacity-60'}`} style={{ backgroundColor: c === 'BLACK' ? '#020617' : c === 'BLUE' ? '#2563eb' : c === 'ROSE' ? '#f43f5e' : c === 'EMERALD' ? '#10b981' : c === 'AMBER' ? '#f59e0b' : '#7c3aed' }}>{tempBookColor === c && <Check className="text-white" size={16} />}</button>))}</div>
                  </div>
                  <button onClick={handleSaveBook} className="w-full py-4 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest">Guardar</button>
              </div>
          </div>
      )}
    </>
  );
};

export default App;