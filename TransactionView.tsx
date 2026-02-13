import React, { useState, useEffect, useMemo } from 'react';
import { AppState, Transaction, GlobalFilter, Category, Account, TransactionType } from './types';
import { Search, Plus, Filter, Download, Trash2, Edit2, X, Check, ArrowRight, Upload, FileText, ChevronDown, Calendar, AlertCircle } from 'lucide-react';

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

interface ProposedTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  accountId: string;
  categoryId: string;
  isValidated: boolean;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

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
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterAccount, setFilterAccount] = useState<string>('ALL');
  
  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State
  const [formData, setFormData] = useState<Partial<Transaction>>({
      type: 'EXPENSE',
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      description: '',
      categoryId: '',
      accountId: ''
  });

  // Import State
  const [importStep, setImportStep] = useState(0); // 0: None, 1: Input, 2: Review
  const [importText, setImportText] = useState('');
  const [importAccount, setImportAccount] = useState('');
  const [proposedTransactions, setProposedTransactions] = useState<ProposedTransaction[]>([]);

  // Init logic for specific filters
  useEffect(() => {
      if (initialSpecificFilters) {
          if (initialSpecificFilters.action === 'NEW') {
              setFormData({ ...formData, categoryId: initialSpecificFilters.categoryId || '' });
              setIsModalOpen(true);
          } else if (initialSpecificFilters.action === 'IMPORT') {
              setImportStep(1);
          } else {
              if (initialSpecificFilters.filterCategory) setFilterCategory(initialSpecificFilters.filterCategory);
              if (initialSpecificFilters.filterAccount) setFilterAccount(initialSpecificFilters.filterAccount);
          }
          if (clearSpecificFilters) clearSpecificFilters();
      }
  }, [initialSpecificFilters]);

  // Helper
  const findSuggestedCategory = (desc: string): string => {
      if (!desc) return '';
      const lower = desc.toLowerCase();
      const match = data.categories.find(c => lower.includes(c.name.toLowerCase()));
      return match ? match.id : (data.categories[0]?.id || '');
  };

  const handleStartAnalysis = (rawData: string) => {
    if (!rawData.trim()) return;
    const lines = rawData.split('\n').filter(l => l.trim());
    const props: ProposedTransaction[] = [];
    lines.forEach(line => {
      const parts = line.split(/[;\t]/).map(p => p.trim());
      const effectiveParts = parts.length >= 2 ? parts : line.split(',').map(p => p.trim());

      if (effectiveParts.length < 2) return;
      
      const dateStr = effectiveParts[0]; // Assuming date is first
      const concept = effectiveParts[1]; // Description second
      
      // Amount logic from prompt
      let amountStr = effectiveParts[effectiveParts.length - 1].trim();
      amountStr = amountStr.replace(/[^\d.,\-+]/g, '');

      if (amountStr.includes('.') && amountStr.includes(',')) {
          if (amountStr.lastIndexOf(',') > amountStr.lastIndexOf('.')) {
              amountStr = amountStr.replace(/\./g, '').replace(',', '.');
          } else {
              amountStr = amountStr.replace(/,/g, '');
          }
      } else if (amountStr.includes(',')) {
          amountStr = amountStr.replace(',', '.');
      } else if ((amountStr.match(/\./g) || []).length > 1) {
          amountStr = amountStr.replace(/\./g, '');
      }
      
      const amount = parseFloat(amountStr);
      if (isNaN(amount)) return;

      props.push({
        id: generateId(),
        date: dateStr.includes('/') ? dateStr.split('/').reverse().join('-') : dateStr, // Simple heuristic for DD/MM/YYYY
        description: concept,
        amount: Math.abs(amount),
        type: amount < 0 ? 'EXPENSE' : 'INCOME',
        accountId: importAccount || data.accounts[0]?.id, 
        categoryId: findSuggestedCategory(concept),
        isValidated: false
      });
    });
    setProposedTransactions(props);
    setImportStep(2);
  };

  const saveImport = () => {
      proposedTransactions.forEach(p => {
          const famId = data.categories.find(c => c.id === p.categoryId)?.familyId || '';
          const newTx: Transaction = {
              id: generateId(),
              date: p.date,
              description: p.description,
              amount: p.amount,
              type: p.type,
              accountId: p.accountId,
              categoryId: p.categoryId,
              familyId: famId,
          };
          onAddTransaction(newTx);
      });
      setImportStep(0);
      setImportText('');
      setProposedTransactions([]);
  };
  
  // Filtering logic
  const filteredTransactions = useMemo(() => {
     return data.transactions.filter(t => {
         // Date Filter
         const tDate = new Date(t.date);
         const refDate = new Date(filter.referenceDate);
         
         if (filter.timeRange === 'MONTH') {
             if (tDate.getMonth() !== refDate.getMonth() || tDate.getFullYear() !== refDate.getFullYear()) return false;
         } else if (filter.timeRange === 'YEAR') {
             if (tDate.getFullYear() !== refDate.getFullYear()) return false;
         } else if (filter.timeRange === 'CUSTOM') {
             if (t.date < filter.customStart || t.date > filter.customEnd) return false;
         }

         // Text Search
         if (searchTerm && !t.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
         
         // Selectors
         if (filterCategory !== 'ALL' && t.categoryId !== filterCategory) return false;
         if (filterAccount !== 'ALL' && t.accountId !== filterAccount) return false;

         return true;
     }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data.transactions, filter, searchTerm, filterCategory, filterAccount]);

  // Handlers for Form
  const handleSubmitForm = () => {
      if (!formData.description || !formData.amount || !formData.accountId || !formData.categoryId) return;
      const famId = data.categories.find(c => c.id === formData.categoryId)?.familyId || '';
      const tx: Transaction = {
          id: editingId || generateId(),
          date: formData.date || new Date().toISOString().split('T')[0],
          description: formData.description,
          amount: Number(formData.amount),
          type: formData.type || 'EXPENSE',
          accountId: formData.accountId,
          categoryId: formData.categoryId,
          familyId: famId,
          transferAccountId: formData.transferAccountId
      };
      
      if (editingId) onUpdateTransaction(tx);
      else onAddTransaction(tx);
      
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ type: 'EXPENSE', date: new Date().toISOString().split('T')[0], amount: 0, description: '', categoryId: '', accountId: '' });
  };
  
  const openEdit = (t: Transaction) => {
      setEditingId(t.id);
      setFormData({ ...t });
      setIsModalOpen(true);
  };

  const renderImportView = () => (
      <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="text-xl font-black uppercase text-slate-800">Importar Movimientos</h3>
                  <button onClick={() => setImportStep(0)}><X className="text-slate-400 hover:text-rose-500"/></button>
              </div>
              
              {importStep === 1 && (
                  <div className="p-8 flex-1 overflow-y-auto space-y-6">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase">Cuenta Destino</label>
                          <select className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold" value={importAccount} onChange={e => setImportAccount(e.target.value)}>
                              <option value="">Selecciona cuenta...</option>
                              {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </select>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase">Pegar datos (Excel/CSV)</label>
                          <textarea 
                              className="w-full h-64 p-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-mono text-sm"
                              placeholder="Fecha;Concepto;...;Importe"
                              value={importText}
                              onChange={e => setImportText(e.target.value)}
                          />
                          <p className="text-xs text-slate-400">Formato esperado: Fecha [tab/coma/pto-coma] Concepto ... Importe</p>
                       </div>
                       <button 
                          onClick={() => handleStartAnalysis(importText)}
                          disabled={!importAccount || !importText}
                          className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 disabled:opacity-50"
                       >
                           Analizar Texto
                       </button>
                  </div>
              )}

              {importStep === 2 && (
                  <div className="flex-1 flex flex-col overflow-hidden">
                      <div className="flex-1 overflow-y-auto p-4 space-y-2">
                          {proposedTransactions.map((p, idx) => (
                              <div key={idx} className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                                  <input type="date" value={p.date} onChange={e => { const copy = [...proposedTransactions]; copy[idx].date = e.target.value; setProposedTransactions(copy); }} className="bg-white border p-1 rounded w-24" />
                                  <input type="text" value={p.description} onChange={e => { const copy = [...proposedTransactions]; copy[idx].description = e.target.value; setProposedTransactions(copy); }} className="bg-white border p-1 rounded flex-1" />
                                  <input type="number" value={p.amount} onChange={e => { const copy = [...proposedTransactions]; copy[idx].amount = parseFloat(e.target.value); setProposedTransactions(copy); }} className="bg-white border p-1 rounded w-20" />
                                  <select value={p.type} onChange={e => { const copy = [...proposedTransactions]; copy[idx].type = e.target.value as TransactionType; setProposedTransactions(copy); }} className="bg-white border p-1 rounded w-20">
                                      <option value="EXPENSE">Gasto</option>
                                      <option value="INCOME">Ingreso</option>
                                  </select>
                                  <select value={p.categoryId} onChange={e => { const copy = [...proposedTransactions]; copy[idx].categoryId = e.target.value; setProposedTransactions(copy); }} className="bg-white border p-1 rounded w-32">
                                      {data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                  </select>
                                  <button onClick={() => { const copy = proposedTransactions.filter((_, i) => i !== idx); setProposedTransactions(copy); }} className="text-rose-500 hover:bg-rose-100 p-1 rounded"><Trash2 size={14}/></button>
                              </div>
                          ))}
                      </div>
                      <div className="p-6 border-t border-slate-100 flex gap-4">
                          <button onClick={() => setImportStep(1)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-xl font-black uppercase text-xs">Atrás</button>
                          <button onClick={saveImport} className="flex-1 py-4 bg-emerald-500 text-white rounded-xl font-black uppercase text-xs hover:bg-emerald-600">Importar {proposedTransactions.length} Movimientos</button>
                      </div>
                  </div>
              )}
          </div>
      </div>
  );

  return (
    <div className="space-y-6">
      {/* HEADER ACTIONS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="relative w-full md:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
              <input 
                  type="text" 
                  placeholder="Buscar movimientos..." 
                  className="w-full pl-12 pr-4 py-3 bg-white border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-indigo-300 transition-all shadow-sm"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
              />
          </div>
          <div className="flex gap-2 w-full md:w-auto">
              <button onClick={() => setImportStep(1)} className="flex-1 md:flex-none px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:border-indigo-300 hover:text-indigo-600 transition-all flex items-center justify-center gap-2 shadow-sm">
                  <Upload size={16}/> Importar
              </button>
              <button onClick={() => { setEditingId(null); setIsModalOpen(true); }} className="flex-1 md:flex-none px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200">
                  <Plus size={16}/> Nuevo
              </button>
          </div>
      </div>

      {/* FILTERS BAR */}
      <div className="flex flex-wrap gap-2 p-2 bg-slate-100 rounded-2xl border border-slate-200/50">
          <div className="flex items-center gap-2 px-3">
              <Filter size={16} className="text-slate-400"/>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filtros</span>
          </div>
          <select className="px-3 py-2 bg-white rounded-xl text-xs font-bold text-slate-600 outline-none cursor-pointer hover:bg-slate-50" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="ALL">Todas las Categorías</option>
              {data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="px-3 py-2 bg-white rounded-xl text-xs font-bold text-slate-600 outline-none cursor-pointer hover:bg-slate-50" value={filterAccount} onChange={e => setFilterAccount(e.target.value)}>
              <option value="ALL">Todas las Cuentas</option>
              {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          {(filterCategory !== 'ALL' || filterAccount !== 'ALL' || searchTerm) && (
              <button onClick={() => { setFilterCategory('ALL'); setFilterAccount('ALL'); setSearchTerm(''); }} className="px-3 py-2 bg-rose-100 text-rose-500 rounded-xl text-xs font-black uppercase hover:bg-rose-200">
                  Limpiar
              </button>
          )}
      </div>

      {/* TRANSACTIONS LIST */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden min-h-[500px]">
          {filteredTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-300">
                  <FileText size={48} className="mb-4 opacity-50"/>
                  <p className="text-xs font-black uppercase tracking-widest">No hay movimientos</p>
              </div>
          ) : (
              <div className="divide-y divide-slate-50">
                  {filteredTransactions.map(t => {
                      const cat = data.categories.find(c => c.id === t.categoryId);
                      const acc = data.accounts.find(a => a.id === t.accountId);
                      return (
                          <div key={t.id} className="p-4 sm:p-6 hover:bg-slate-50 transition-colors group flex items-center justify-between gap-4">
                              <div className="flex items-center gap-4 overflow-hidden">
                                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm ${t.type === 'INCOME' ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                                      {cat?.icon || '📄'}
                                  </div>
                                  <div className="min-w-0">
                                      <h4 className="font-bold text-slate-800 text-sm truncate">{t.description}</h4>
                                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                                          <span>{new Date(t.date).toLocaleDateString()}</span>
                                          <span>•</span>
                                          <span className="truncate">{cat?.name}</span>
                                          <span>•</span>
                                          <span className="truncate">{acc?.name}</span>
                                      </div>
                                  </div>
                              </div>
                              <div className="text-right flex items-center gap-6">
                                  <span className={`text-base font-black ${t.type === 'INCOME' ? 'text-emerald-500' : 'text-slate-800'}`}>
                                      {t.type === 'EXPENSE' ? '-' : '+'}{t.amount.toFixed(2)}€
                                  </span>
                                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={() => openEdit(t)} className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100"><Edit2 size={16}/></button>
                                      <button onClick={() => onDeleteTransaction(t.id)} className="p-2 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100"><Trash2 size={16}/></button>
                                  </div>
                              </div>
                          </div>
                      );
                  })}
              </div>
          )}
      </div>

      {/* MODAL EDIT/ADD */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[200] p-4">
              <div className="bg-white rounded-[2rem] w-full max-w-lg p-8 shadow-2xl relative">
                  <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 p-2 bg-slate-50 rounded-full text-slate-400 hover:bg-slate-100"><X size={20}/></button>
                  <h3 className="text-xl font-black uppercase text-slate-800 mb-6">{editingId ? 'Editar Movimiento' : 'Nuevo Movimiento'}</h3>
                  
                  <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase">Tipo</label>
                              <div className="flex bg-slate-100 p-1 rounded-xl">
                                  <button onClick={() => setFormData({...formData, type: 'EXPENSE'})} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase ${formData.type === 'EXPENSE' ? 'bg-white shadow text-rose-500' : 'text-slate-400'}`}>Gasto</button>
                                  <button onClick={() => setFormData({...formData, type: 'INCOME'})} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase ${formData.type === 'INCOME' ? 'bg-white shadow text-emerald-500' : 'text-slate-400'}`}>Ingreso</button>
                              </div>
                          </div>
                          <div className="space-y-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase">Fecha</label>
                              <input type="date" className="w-full p-2.5 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-sm" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                          </div>
                      </div>

                      <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase">Importe</label>
                          <input type="number" step="0.01" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-xl" placeholder="0.00" value={formData.amount} onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})} />
                      </div>

                      <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase">Concepto</label>
                          <input type="text" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-sm" placeholder="Ej: Supermercado..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase">Cuenta</label>
                              <select className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-xs" value={formData.accountId} onChange={e => setFormData({...formData, accountId: e.target.value})}>
                                  <option value="">Selecciona...</option>
                                  {data.accounts.filter(a => a.active !== false).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                              </select>
                           </div>
                           <div className="space-y-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase">Categoría</label>
                              <select className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-xs" value={formData.categoryId} onChange={e => setFormData({...formData, categoryId: e.target.value})}>
                                  <option value="">Selecciona...</option>
                                  {data.categories.filter(c => c.active !== false).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                           </div>
                      </div>
                  </div>

                  <button onClick={handleSubmitForm} className="w-full py-4 mt-8 bg-slate-900 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-indigo-600 shadow-xl">
                      {editingId ? 'Guardar Cambios' : 'Añadir Movimiento'}
                  </button>
              </div>
          </div>
      )}

      {importStep > 0 && renderImportView()}
    </div>
  );
};
