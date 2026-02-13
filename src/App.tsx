
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Layout } from './Layout';
import { Dashboard } from './Dashboard';
import { TransactionView } from './TransactionView';
import { SettingsView } from './components/SettingsView';
import { LoginView } from './LoginView';
import { AppState, View, Transaction, GlobalFilter, MultiBookState, BookMetadata, BookColor } from './types';
import { loadData, saveData, defaultAppState } from './services/dataService';
import { isAuthenticated, logout } from './services/authService';
import { X, Check, WifiOff, RefreshCw } from 'lucide-react';

const App: React.FC = () => {
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

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      
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

  const handleCreateBookFromImport = (importData: AppState, name: string, color: BookColor = 'BLUE') => {
      const newId = Math.random().toString(36).substring(2, 15);
      const newBook: BookMetadata = {
          id: newId,
          name: name || 'Libro Importado',
          color: color,
          currency: 'EUR'
      };
      
      setMultiState(prev => ({
          ...prev,
          booksMetadata: [...prev.booksMetadata, newBook],
          booksData: { ...prev.booksData, [newId]: importData },
          currentBookId: newId
      }));
      setCurrentView('RESUMEN');
  };

  const handleRestoreToBook = (bookId: string, data: AppState) => {
      setMultiState(prev => ({
          ...prev,
          booksData: { ...prev.booksData, [bookId]: data },
          currentBookId: bookId 
      }));
      setCurrentView('RESUMEN');
  };

  const handleDeleteBook = () => {
      setMultiState(prev => {
          if (prev.booksMetadata.length <= 1) {
              const currentId = prev.currentBookId;
              return {
                  ...prev,
                  booksData: { ...prev.booksData, [currentId]: { ...defaultAppState, transactions: [], recurrents: [], favorites: [] } }
              };
          } else {
              const remainingBooks = prev.booksMetadata.filter(b => b.id !== prev.currentBookId);
              const newCurrentId = remainingBooks[0].id;
              const { [prev.currentBookId]: deleted, ...remainingData } = prev.booksData;
              return {
                  ...prev,
                  booksMetadata: remainingBooks,
                  currentBookId: newCurrentId,
                  booksData: remainingData
              };
          }
      });
      setCurrentView('RESUMEN');
  };

  const handleExportData = (targetId: string) => {
      let dataToExport: any;
      let fileName = '';
      const today = new Date().toISOString().split('T')[0];

      if (targetId === 'ALL') {
          dataToExport = multiState;
          fileName = `backup_completo_contamiki_${today}.json`;
      } else {
          const book = multiState.booksMetadata.find(b => b.id === targetId);
          const bookData = multiState.booksData[targetId];
          
          if (!book || !bookData) {
              alert("No se encontraron datos para el libro seleccionado.");
              return;
          }

          dataToExport = bookData;
          fileName = `backup_${book.name.replace(/\s+/g, '_')}_${today}.json`;
      }

      const jsonString = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleAddTransaction = (t: Transaction) => updateCurrentBookData({ transactions: [t, ...currentAppData.transactions] });
  const handleUpdateTransaction = (t: Transaction) => updateCurrentBookData({ transactions: currentAppData.transactions.map(tx => tx.id === t.id ? t : tx) });
  const handleDeleteTransaction = (id: string) => updateCurrentBookData({ transactions: currentAppData.transactions.filter(tx => tx.id !== id) });
  const handleSwitchBook = (bookId: string) => { setMultiState(prev => ({ ...prev, currentBookId: bookId })); setCurrentView('RESUMEN'); };

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

  if (!isLoggedIn) return <LoginView onLoginSuccess={() => setIsLoggedIn(true)} />;
  
  if (loadError) return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-950 text-white z-[999] p-6 text-center">
          <div className="bg-rose-500/10 p-6 rounded-full mb-6 animate-pulse">
              <WifiOff size={48} className="text-rose-500" />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight mb-2">Error de Conexión</h2>
          <p className="text-slate-400 text-sm max-w-md mb-8">
              No se han podido cargar los datos del servidor. Se ha detenido el sistema para proteger tus datos existentes.
              <br/><br/>
              <span className="text-xs font-mono bg-slate-900 p-1 rounded text-rose-400">{loadError}</span>
          </p>
          <button 
              onClick={() => window.location.reload()} 
              className="bg-white text-slate-900 px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-50 hover:text-white transition-all flex items-center gap-3"
          >
              <RefreshCw size={16} /> Reintentar Conexión
          </button>
      </div>
  );

  if (!dataLoaded) return <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-950 text-white z-[999]"><div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6"></div><p className="text-xs font-black uppercase tracking-[0.4em]">Cargando...</p></div>;

  return (
    <Layout 
        currentView={currentView} 
        setCurrentView={setCurrentView} 
        data={currentAppData}
        books={multiState.booksMetadata}
        currentBook={currentBookMeta}
        onSwitchBook={handleSwitchBook}
        onCreateBook={() => { setEditingBookId(null); setTempBookName(''); setTempBookColor('BLACK'); setIsBookModalOpen(true); }}
        onEditBook={() => { setEditingBookId(currentBookMeta.id); setTempBookName(currentBookMeta.name); setTempBookColor(currentBookMeta.color); setIsBookModalOpen(true); }}
        syncStatus={syncStatus}
        syncError={syncErrorMsg}
        onManualSave={() => performSave(multiState)}
    >
      {currentView === 'RESUMEN' && (
        <Dashboard 
            data={currentAppData} 
            onAddTransaction={handleAddTransaction}
            onUpdateData={updateCurrentBookData}
            filter={globalFilter}
            onUpdateFilter={setGlobalFilter}
            onNavigateToTransactions={(spec) => { setPendingSpecificFilters(spec); setCurrentView('TRANSACTIONS'); }}
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
        <SettingsView 
          data={currentAppData} 
          books={multiState.booksMetadata} 
          onUpdateData={updateCurrentBookData} 
          onNavigateToTransactions={(spec) => { setPendingSpecificFilters(spec); setCurrentView('TRANSACTIONS'); }}
          onCreateBookFromImport={handleCreateBookFromImport}
          onRestoreToBook={handleRestoreToBook}
          onDeleteBook={handleDeleteBook}
          onExportData={handleExportData} 
        />
      )}

      {isBookModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl space-y-6">
                  <div className="flex justify-between items-center"><h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">{editingBookId ? 'Editar Libro' : 'Nueva Contabilidad'}</h3><button onClick={() => setIsBookModalOpen(false)} className="p-2 bg-slate-100 rounded-full"><X size={18} /></button></div>
                  <div className="space-y-4">
                      <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre</label><input type="text" className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500" placeholder="Ej: Personal..." value={tempBookName} onChange={e => setTempBookName(e.target.value)} /></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Color Identificativo</label><div className="grid grid-cols-3 gap-2">{(['BLACK', 'BLUE', 'ROSE', 'EMERALD', 'AMBER', 'VIOLET'] as BookColor[]).map(c => (<button key={c} onClick={() => setTempBookColor(c)} className={`h-12 rounded-xl flex items-center justify-center transition-all ${tempBookColor === c ? 'ring-4 ring-offset-2 ring-indigo-200 scale-105' : 'opacity-60'}`} style={{ backgroundColor: c === 'BLACK' ? '#020617' : c === 'BLUE' ? '#2563eb' : c === 'ROSE' ? '#f43f5e' : c === 'EMERALD' ? '#10b981' : c === 'AMBER' ? '#f59e0b' : '#7c3aed' }}>{tempBookColor === c && <Check className="text-white" size={20} />}</button>))}</div></div>
                  </div>
                  <button onClick={handleSaveBook} className="w-full py-4 bg-slate-950 text-white rounded-xl font-black uppercase text-[11px] tracking-widest shadow-xl">Guardar Cambios</button>
              </div>
          </div>
      )}
    </Layout>
  );
};

export default App;
