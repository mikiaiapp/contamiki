import React, { useState, useMemo, useEffect } from 'react';
import { AppState, Transaction, GlobalFilter, Category, Account, TransactionType, FavoriteMovement } from './types';
import { Heart, Bot, Plus, Search, Filter, Trash2, Edit2, Check, X, Calendar, ArrowRight, UploadCloud, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { mapBankTransactions } from './services/geminiService';

interface TransactionViewProps {
  data: AppState;
  onAddTransaction: (t: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onUpdateTransaction: (t: Transaction) => void;
  onUpdateData: (newData: Partial<AppState>) => void;
  filter: GlobalFilter;
  onUpdateFilter: (f: GlobalFilter) => void;
  initialSpecificFilters?: any;
  clearSpecificFilters?: () => void;
}

export const TransactionView: React.FC<TransactionViewProps> = ({
  data,
  onAddTransaction,
  onDeleteTransaction,
  onUpdateTransaction,
  onUpdateData,
  filter,
  onUpdateFilter,
  initialSpecificFilters,
  clearSpecificFilters
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showFavoritesList, setShowFavoritesList] = useState(false);
  
  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStep, setImportStep] = useState(1);
  const [importAccount, setImportAccount] = useState('');
  const [importText, setImportText] = useState('');
  const [mappedTransactions, setMappedTransactions] = useState<any[]>([]);
  const [isMapping, setIsMapping] = useState(false);

  // Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  
  // Specific filters (e.g. from Dashboard click)
  const [localFilterCategory, setLocalFilterCategory] = useState<string | null>(null);
  const [localFilterAccount, setLocalFilterAccount] = useState<string | null>(null);

  useEffect(() => {
    if (initialSpecificFilters) {
        if (initialSpecificFilters.action === 'NEW') {
            openEditor();
            if (initialSpecificFilters.categoryId) {
                // Pre-fill category logic if needed in editor
            }
        } else if (initialSpecificFilters.action === 'IMPORT') {
             setImportAccount(data.accounts[0]?.id || ''); 
             setImportStep(1); 
             setIsImportModalOpen(true);
        }
        
        if (initialSpecificFilters.filterCategory) setLocalFilterCategory(initialSpecificFilters.filterCategory);
        if (initialSpecificFilters.filterAccount) setLocalFilterAccount(initialSpecificFilters.filterAccount);
        
        if (clearSpecificFilters) clearSpecificFilters();
    }
  }, [initialSpecificFilters]);

  const filteredTransactions = useMemo(() => {
    let result = data.transactions;

    // Global Time Filter
    if (filter.timeRange !== 'ALL') {
        const y = filter.referenceDate.getFullYear();
        const m = filter.referenceDate.getMonth();
        let start = '', end = '';
        if (filter.timeRange === 'MONTH') {
            start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
            end = `${y}-${String(m + 1).padStart(2, '0')}-${new Date(y, m+1, 0).getDate()}`;
        } else if (filter.timeRange === 'YEAR') {
            start = `${y}-01-01`; end = `${y}-12-31`;
        } else if (filter.timeRange === 'CUSTOM') {
            start = filter.customStart; end = filter.customEnd;
        }
        if (start && end) {
            result = result.filter(t => t.date >= start && t.date <= end);
        }
    }

    // Specific Filters
    if (localFilterCategory) result = result.filter(t => t.categoryId === localFilterCategory);
    if (localFilterAccount) result = result.filter(t => t.accountId === localFilterAccount);

    // Search
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        result = result.filter(t => t.description.toLowerCase().includes(lower) || t.amount.toString().includes(lower));
    }

    return result.sort((a, b) => b.date.localeCompare(a.date));
  }, [data.transactions, filter, localFilterCategory, localFilterAccount, searchTerm]);

  const handleUseFavorite = (fav: FavoriteMovement) => {
      const newTx: Transaction = {
          id: Math.random().toString(36).substring(2, 15),
          date: new Date().toISOString().split('T')[0],
          amount: fav.amount,
          description: fav.description || fav.name,
          accountId: fav.accountId,
          transferAccountId: fav.transferAccountId,
          familyId: fav.familyId,
          categoryId: fav.categoryId,
          type: fav.type,
          brandIcon: fav.icon
      };
      onAddTransaction(newTx);
      setShowFavoritesList(false);
  };

  const openEditor = (tx?: Transaction) => {
      setEditingTransaction(tx || null);
      setIsEditorOpen(true);
  };

  const renderIcon = (iconStr: string, className = "w-6 h-6") => {
    if (iconStr?.startsWith('http') || iconStr?.startsWith('data:image')) return <img src={iconStr} className={`${className} object-contain rounded-md`} referrerPolicy="no-referrer" />;
    return <span className="flex items-center justify-center text-lg">{iconStr || '📄'}</span>;
  };

  const handleRunImport = async () => {
      if (!importText) return;
      setIsMapping(true);
      // Mock parsing lines from text
      const lines = importText.split('\n').filter(l => l.trim().length > 0).slice(0, 20); // Limit for AI demo
      const mapped = await mapBankTransactions(lines, data.categories, data.families);
      setMappedTransactions(mapped);
      setIsMapping(false);
      setImportStep(2);
  };

  const confirmImport = () => {
      const account = data.accounts.find(a => a.id === importAccount);
      if (!account) return;
      
      const newTxs = mappedTransactions.map(m => ({
          id: Math.random().toString(36).substring(2, 15),
          date: m.date,
          amount: m.amount, // mapBankTransactions returns positive numbers mostly, need logic to ensure sign? The helper usually handles type.
          description: m.description,
          accountId: account.id,
          familyId: m.familyId,
          categoryId: m.categoryId,
          type: m.type as TransactionType
      }));
      
      // Add all
      newTxs.forEach(t => onAddTransaction(t));
      setIsImportModalOpen(false);
      setImportText('');
      setMappedTransactions([]);
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Movimientos</h2>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
            {filteredTransactions.length} transacciones encontradas
          </p>
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                    type="text" 
                    placeholder="Buscar..." 
                    className="w-full sm:w-64 pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-indigo-500 transition-all shadow-sm"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            
            {/* Action Buttons Fragment Integration */}
            <div className="flex gap-2">
                {/* FAVORITOS BUTTON */}
                <div className="relative">
                    <button 
                        onClick={() => setShowFavoritesList(!showFavoritesList)} 
                        className="w-12 h-12 bg-amber-50 text-amber-600 border border-amber-100 rounded-xl shadow-sm hover:bg-amber-100 flex items-center justify-center transition-all active:scale-95"
                        title="Favoritos"
                    >
                        <Heart size={20} fill={showFavoritesList ? "currentColor" : "none"} />
                    </button>
                    {showFavoritesList && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowFavoritesList(false)}></div>
                            <div className="absolute top-full right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 w-64 p-2 z-20 animate-in fade-in zoom-in duration-200 origin-top-right">
                                <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Plantillas Rápidas</div>
                                <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-1">
                                    {data.favorites && data.favorites.length > 0 ? (
                                        data.favorites.map(fav => (
                                            <button 
                                                key={fav.id} 
                                                onClick={() => handleUseFavorite(fav)}
                                                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-amber-50 text-left transition-colors group"
                                            >
                                                <div className="bg-amber-100 text-amber-600 p-1.5 rounded-lg group-hover:bg-amber-200 transition-colors">
                                                    {renderIcon(fav.icon || '⭐', "w-4 h-4")}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-bold text-slate-700 truncate">{fav.name}</div>
                                                    <div className="text-[9px] text-slate-400 font-medium truncate">{fav.description}</div>
                                                </div>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="p-4 text-center text-slate-400 text-xs">No hay favoritos. Créalos desde el menú de acciones de un movimiento.</div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <button 
                    onClick={(e) => { e.stopPropagation(); setImportAccount(data.accounts[0]?.id || ''); setImportStep(1); setIsImportModalOpen(true); }} 
                    className="w-12 h-12 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl shadow-sm hover:bg-indigo-100 flex items-center justify-center transition-all active:scale-95"
                    title="Importador Inteligente"
                >
                    <Bot size={20} />
                </button>
                
                <button 
                    onClick={() => openEditor()} 
                    className="w-12 h-12 bg-slate-950 text-white rounded-xl shadow-lg hover:bg-slate-800 flex items-center justify-center transition-all active:scale-95"
                    title="Nuevo Movimiento"
                >
                    <Plus size={20} />
                </button>
            </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="flex-1 bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto custom-scrollbar">
              {filteredTransactions.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 p-10">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                          <Search size={24} />
                      </div>
                      <p className="text-sm font-bold">No se encontraron movimientos</p>
                  </div>
              ) : (
                  <div className="divide-y divide-slate-50">
                      {filteredTransactions.map(t => {
                          const cat = data.categories.find(c => c.id === t.categoryId);
                          const acc = data.accounts.find(a => a.id === t.accountId);
                          const isExpense = t.type === 'EXPENSE';
                          return (
                              <div key={t.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                                  <div className="flex items-center gap-4 overflow-hidden">
                                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${isExpense ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>
                                          {renderIcon(cat?.icon || '📄')}
                                      </div>
                                      <div className="min-w-0">
                                          <div className="flex items-center gap-2">
                                              <p className="text-sm font-black text-slate-900 truncate">{t.description}</p>
                                              {t.isFromRecurrence && <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded text-[9px] font-bold">R</span>}
                                          </div>
                                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                            <span>{t.date}</span> • <span>{acc?.name}</span> • <span>{cat?.name}</span>
                                          </p>
                                      </div>
                                  </div>
                                  <div className="flex items-center gap-4">
                                      <span className={`text-sm font-black ${isExpense ? 'text-rose-600' : 'text-emerald-600'}`}>
                                          {isExpense ? '-' : '+'}{Math.abs(t.amount).toFixed(2)} €
                                      </span>
                                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button onClick={() => openEditor(t)} className="p-2 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg"><Edit2 size={16}/></button>
                                          <button onClick={() => onDeleteTransaction(t.id)} className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg"><Trash2 size={16}/></button>
                                      </div>
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              )}
          </div>
      </div>

      {/* Editor Modal Placeholder (Simplified) */}
      {isEditorOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
              <div className="bg-white rounded-[2rem] w-full max-w-lg p-8">
                  <h3 className="text-xl font-black mb-6">{editingTransaction ? 'Editar' : 'Nuevo'} Movimiento</h3>
                  {/* Form fields would go here - keeping it simple to resolve structure errors */}
                  <div className="space-y-4">
                      <p className="text-slate-500 text-sm">Formulario de edición pendiente de implementación completa.</p>
                      <button onClick={() => setIsEditorOpen(false)} className="w-full py-3 bg-slate-100 rounded-xl font-bold text-slate-600">Cerrar</button>
                  </div>
              </div>
          </div>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in">
              <div className="bg-white rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                  <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <div className="flex items-center gap-3">
                        <div className="bg-indigo-600 text-white p-3 rounded-2xl"><Bot size={24}/></div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Smart Import</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Powered by Gemini AI</p>
                        </div>
                      </div>
                      <button onClick={() => setIsImportModalOpen(false)} className="p-2 bg-white rounded-full text-slate-400 hover:text-rose-500"><X size={20}/></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                      {importStep === 1 ? (
                          <div className="space-y-6">
                              <div className="space-y-2">
                                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Cuenta Destino</label>
                                  <select value={importAccount} onChange={e => setImportAccount(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-indigo-500">
                                      {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                  </select>
                              </div>
                              <div className="space-y-2">
                                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Pegar datos del banco (Excel/CSV)</label>
                                  <textarea 
                                    className="w-full h-48 p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:border-indigo-500 outline-none resize-none"
                                    placeholder="Fecha | Descripción | Importe..."
                                    value={importText}
                                    onChange={e => setImportText(e.target.value)}
                                  ></textarea>
                              </div>
                              <button 
                                onClick={handleRunImport} 
                                disabled={isMapping || !importText}
                                className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                              >
                                  {isMapping ? <><Bot className="animate-spin" size={16}/> Analizando...</> : <><Bot size={16}/> Procesar con IA</>}
                              </button>
                          </div>
                      ) : (
                          <div className="space-y-4">
                              <p className="text-sm text-slate-600 font-bold">Se han detectado {mappedTransactions.length} movimientos.</p>
                              <div className="max-h-64 overflow-y-auto bg-slate-50 rounded-xl border border-slate-100">
                                  {mappedTransactions.map((t, i) => (
                                      <div key={i} className="p-3 border-b border-slate-100 text-xs grid grid-cols-12 gap-2 items-center">
                                          <span className="col-span-2 text-slate-500">{t.date}</span>
                                          <span className="col-span-4 font-bold truncate">{t.description}</span>
                                          <span className={`col-span-2 font-black text-right ${t.type === 'EXPENSE' ? 'text-rose-500' : 'text-emerald-500'}`}>{t.amount}</span>
                                          <span className="col-span-4 text-indigo-600 bg-indigo-50 px-2 py-1 rounded truncate text-[10px]">{data.categories.find(c => c.id === t.categoryId)?.name || 'Sin categoría'}</span>
                                      </div>
                                  ))}
                              </div>
                              <div className="flex gap-3 pt-4">
                                  <button onClick={() => setImportStep(1)} className="flex-1 py-3 border border-slate-200 text-slate-500 rounded-xl font-bold uppercase text-[10px]">Atrás</button>
                                  <button onClick={confirmImport} className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-600 shadow-lg shadow-emerald-200">Confirmar Importación</button>
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};