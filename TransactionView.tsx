import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppState, Transaction, GlobalFilter, Category, Account, Family, TransactionType } from './types';
import { Search, Plus, Filter, Download, Trash2, Edit2, Check, X, ChevronDown, ChevronUp, Calendar, ArrowUpRight, ArrowDownLeft, RefreshCw, Sparkles, Upload, FileText, AlertCircle } from 'lucide-react';
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

const generateId = () => Math.random().toString(36).substring(2, 15);
const numberFormatter = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  
  // Import State
  const [isImportMode, setIsImportMode] = useState(false);
  const rawImportTextRef = useRef<HTMLTextAreaElement>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Filter State (Local)
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterAccount, setFilterAccount] = useState<string>('');

  useEffect(() => {
    if (initialSpecificFilters) {
        if (initialSpecificFilters.action === 'IMPORT') {
            setIsImportMode(true);
        } else if (initialSpecificFilters.action === 'NEW') {
            setEditingTx(null);
            setIsModalOpen(true);
            if (initialSpecificFilters.categoryId) {
                 setFormCat(initialSpecificFilters.categoryId);
            }
        }
        
        if (initialSpecificFilters.filterCategory) setFilterCategory(initialSpecificFilters.filterCategory);
        if (initialSpecificFilters.filterAccount) setFilterAccount(initialSpecificFilters.filterAccount);
        
        if(clearSpecificFilters) clearSpecificFilters();
    }
  }, [initialSpecificFilters, clearSpecificFilters]);

  // Handle Analysis for Import
  const handleStartAnalysis = async (text: string) => {
      if (!text.trim()) return;
      setIsAnalyzing(true);
      
      // Basic CSV/Text parsing
      const rows = text.split('\n').filter(r => r.trim()).map(r => {
          // Try split by semicolon or tab
          const parts = r.split(/[;\t]/).map(p => p.trim());
          return parts;
      });

      const mapped = await mapBankTransactions(rows, data.categories, data.families);
      setImportPreview(mapped);
      setIsAnalyzing(false);
  };

  const confirmImport = () => {
      const newTxs: Transaction[] = importPreview.map(p => ({
          id: generateId(),
          date: p.date,
          description: p.description,
          amount: parseFloat(p.amount),
          type: p.type as TransactionType,
          categoryId: p.categoryId,
          familyId: p.familyId,
          accountId: data.accounts[0]?.id || '', // Default to first account or need selector in preview
          brandIcon: undefined
      }));
      
      onUpdateData({ transactions: [...newTxs, ...data.transactions] });
      setIsImportMode(false);
      setImportPreview([]);
  };

  // Transaction List Logic
  const filteredTransactions = useMemo(() => {
      let txs = data.transactions;
      
      // Time Filter
      const start = filter.customStart || '1900-01-01';
      const end = filter.customEnd || '2100-12-31';
      if (filter.timeRange === 'MONTH') {
           const d = filter.referenceDate;
           const y = d.getFullYear();
           const m = d.getMonth() + 1;
           const mStr = String(m).padStart(2, '0');
           txs = txs.filter(t => t.date.startsWith(`${y}-${mStr}`));
      } else if (filter.timeRange === 'YEAR') {
           const y = filter.referenceDate.getFullYear();
           txs = txs.filter(t => t.date.startsWith(`${y}-`));
      } else if (filter.timeRange === 'CUSTOM') {
           txs = txs.filter(t => t.date >= start && t.date <= end);
      }

      // Specific Filters
      if (filterCategory) txs = txs.filter(t => t.categoryId === filterCategory);
      if (filterAccount) txs = txs.filter(t => t.accountId === filterAccount);
      if (searchTerm) txs = txs.filter(t => t.description.toLowerCase().includes(searchTerm.toLowerCase()));

      return txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data.transactions, filter, filterCategory, filterAccount, searchTerm]);

  // Form State
  const [formDesc, setFormDesc] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formType, setFormType] = useState<TransactionType>('EXPENSE');
  const [formCat, setFormCat] = useState('');
  const [formAcc, setFormAcc] = useState('');
  const [formTransferAcc, setFormTransferAcc] = useState('');

  const openNewModal = () => {
      setEditingTx(null);
      setFormDesc('');
      setFormAmount('');
      setFormDate(new Date().toISOString().split('T')[0]);
      setFormType('EXPENSE');
      setFormCat('');
      setFormAcc(data.accounts[0]?.id || '');
      setFormTransferAcc('');
      setIsModalOpen(true);
  };

  const openEditModal = (t: Transaction) => {
      setEditingTx(t);
      setFormDesc(t.description);
      setFormAmount(Math.abs(t.amount).toString());
      setFormDate(t.date);
      setFormType(t.type);
      setFormCat(t.categoryId);
      setFormAcc(t.accountId);
      setFormTransferAcc(t.transferAccountId || '');
      setIsModalOpen(true);
  };

  const saveTransaction = () => {
      if (!formDesc || !formAmount || !formAcc) return;
      if (formType !== 'TRANSFER' && !formCat) return;
      
      const amt = parseFloat(formAmount);
      const famId = formType === 'TRANSFER' ? '' : (data.categories.find(c => c.id === formCat)?.familyId || '');

      const txData: Transaction = {
          id: editingTx ? editingTx.id : generateId(),
          date: formDate,
          description: formDesc,
          amount: amt,
          type: formType,
          accountId: formAcc,
          categoryId: formCat,
          familyId: famId,
          transferAccountId: formType === 'TRANSFER' ? formTransferAcc : undefined
      };

      if (editingTx) onUpdateTransaction(txData);
      else onAddTransaction(txData);
      
      setIsModalOpen(false);
  };

  // Render function for the Import Mode based on the snippet provided in error
  const renderImportView = () => (
      <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 pb-20">
          <div className="flex items-center justify-between">
              <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Importar Movimientos</h2>
              <button onClick={() => setIsImportMode(false)} className="p-3 bg-slate-100 rounded-full hover:bg-slate-200"><X size={20}/></button>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
               <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">1. Copia y Pega tus movimientos</label>
                    <textarea 
                        ref={rawImportTextRef}
                        className="w-full h-40 p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] font-mono text-xs outline-none focus:border-indigo-500 transition-all resize-none shadow-inner" 
                        placeholder={`Formato esperado:\nDD/MM/AAAA; Concepto del movimiento; -50,00\nDD/MM/AAAA; Ingreso de Nómina; 1500,00\n...`}
                        onBlur={(e) => handleStartAnalysis(e.target.value)}
                    />
                    <div className="flex flex-col items-center gap-4 mt-2">
                        <button 
                            onClick={() => handleStartAnalysis(rawImportTextRef.current?.value || '')}
                            disabled={isAnalyzing}
                            className="bg-indigo-600 text-white px-10 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center gap-2 hover:scale-105 active:scale-95 disabled:opacity-50"
                        >
                            {isAnalyzing ? <RefreshCw className="animate-spin" size={16}/> : <Sparkles size={16} />} 
                            {isAnalyzing ? 'Analizando...' : 'Analizar Texto'}
                        </button>
                        <p className="text-[10px] text-slate-400 font-medium text-center max-w-[90%]">El sistema detectará automáticamente fecha, concepto e importe. Usa punto y coma (;) o tabuladores para separar.</p>
                    </div>
                </div>

                {importPreview.length > 0 && (
                    <div className="mt-8 space-y-4 animate-in fade-in">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-black text-slate-900 uppercase">Vista Previa ({importPreview.length})</h3>
                            <button onClick={confirmImport} className="bg-emerald-500 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 shadow-lg">Confirmar Importación</button>
                        </div>
                        <div className="bg-slate-50 rounded-2xl overflow-hidden border border-slate-100 max-h-96 overflow-y-auto">
                            {importPreview.map((p, i) => (
                                <div key={i} className="flex items-center justify-between p-4 border-b border-slate-100 last:border-0 text-xs">
                                    <div className="flex gap-4">
                                        <span className="font-mono text-slate-400">{p.date}</span>
                                        <span className="font-bold text-slate-700">{p.description}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                         <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg text-[10px] font-black uppercase">{data.categories.find(c => c.id === p.categoryId)?.name || 'Sin Cat'}</span>
                                         <span className={`font-black ${p.type === 'INCOME' ? 'text-emerald-500' : 'text-rose-500'}`}>{numberFormatter.format(parseFloat(p.amount))}€</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
          </div>
      </div>
  );

  if (isImportMode) return renderImportView();

  return (
    <div className="space-y-6 pb-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">Movimientos</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                    {filteredTransactions.length} registros encontrados
                </p>
            </div>
            <div className="flex gap-2">
                 <button onClick={() => setIsImportMode(true)} className="px-5 py-3 bg-white text-slate-700 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-indigo-500 hover:text-indigo-600 transition-all flex items-center gap-2 shadow-sm">
                    <Download size={16}/> Importar
                 </button>
                 <button onClick={openNewModal} className="px-5 py-3 bg-slate-950 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center gap-2 shadow-xl">
                    <Plus size={16}/> Nuevo
                 </button>
            </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
             <div className="relative flex-1 w-full">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                 <input 
                    type="text" 
                    placeholder="Buscar concepto..." 
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 transition-all"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                 />
             </div>
             
             <div className="flex gap-2 w-full md:w-auto overflow-x-auto">
                 <select value={filterAccount} onChange={e => setFilterAccount(e.target.value)} className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs outline-none text-slate-600 cursor-pointer min-w-[120px]">
                     <option value="">Todas las Cuentas</option>
                     {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                 </select>
                 <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs outline-none text-slate-600 cursor-pointer min-w-[120px]">
                     <option value="">Todas las Categorías</option>
                     {data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                 </select>
                 {(filterCategory || filterAccount) && (
                     <button onClick={() => { setFilterCategory(''); setFilterAccount(''); }} className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100">
                         <X size={16}/>
                     </button>
                 )}
             </div>
        </div>

        {/* Transactions List */}
        <div className="space-y-3">
            {filteredTransactions.map(t => {
                const cat = data.categories.find(c => c.id === t.categoryId);
                const acc = data.accounts.find(a => a.id === t.accountId);
                return (
                    <div key={t.id} className="bg-white p-4 rounded-3xl border border-slate-100 hover:border-indigo-100 hover:shadow-lg transition-all group flex items-center justify-between">
                         <div className="flex items-center gap-4">
                             <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border text-xl ${t.type === 'INCOME' ? 'bg-emerald-50 border-emerald-100' : t.type === 'TRANSFER' ? 'bg-slate-50 border-slate-200' : 'bg-rose-50 border-rose-100'}`}>
                                 {t.type === 'TRANSFER' ? <ArrowUpRight size={20} className="text-slate-500"/> : (cat?.icon || '📄')}
                             </div>
                             <div>
                                 <p className="font-black text-slate-800 text-sm uppercase">{t.description}</p>
                                 <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                                     {new Date(t.date).toLocaleDateString()} • {acc?.name} {t.type === 'TRANSFER' ? '➡ Transferencia' : `• ${cat?.name}`}
                                 </p>
                             </div>
                         </div>
                         <div className="flex items-center gap-6">
                             <span className={`text-lg font-black ${t.type === 'INCOME' ? 'text-emerald-500' : t.type === 'TRANSFER' ? 'text-slate-600' : 'text-rose-500'}`}>
                                 {t.type === 'EXPENSE' ? '-' : '+'}{numberFormatter.format(t.amount)}€
                             </span>
                             <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <button onClick={() => openEditModal(t)} className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100"><Edit2 size={16}/></button>
                                 <button onClick={() => onDeleteTransaction(t.id)} className="p-2 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100"><Trash2 size={16}/></button>
                             </div>
                         </div>
                    </div>
                );
            })}
            {filteredTransactions.length === 0 && (
                <div className="text-center py-20 opacity-50">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400"><FileText size={32}/></div>
                    <p className="font-black text-slate-400 uppercase tracking-widest text-xs">No hay movimientos</p>
                </div>
            )}
        </div>

        {/* Edit/New Modal */}
        {isModalOpen && (
            <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-in fade-in zoom-in duration-300">
                <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg p-10 relative border border-white/20 max-h-[90vh] overflow-y-auto custom-scrollbar">
                     <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 p-3 bg-slate-50 text-slate-400 rounded-full hover:text-rose-500 hover:bg-rose-50 transition-all"><X size={24}/></button>
                     <h3 className="text-2xl font-black text-slate-900 uppercase flex items-center gap-3 mb-8">
                         {editingTx ? 'Editar Movimiento' : 'Nuevo Movimiento'}
                     </h3>
                     <div className="space-y-6">
                         <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                             <button onClick={() => setFormType('EXPENSE')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${formType === 'EXPENSE' ? 'bg-white shadow-sm text-rose-500' : 'text-slate-400'}`}>Gasto</button>
                             <button onClick={() => setFormType('INCOME')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${formType === 'INCOME' ? 'bg-white shadow-sm text-emerald-500' : 'text-slate-400'}`}>Ingreso</button>
                             <button onClick={() => setFormType('TRANSFER')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${formType === 'TRANSFER' ? 'bg-white shadow-sm text-indigo-500' : 'text-slate-400'}`}>Transf.</button>
                         </div>
                         
                         <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Importe</label>
                             <input type="number" step="0.01" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 text-xl" value={formAmount} onChange={e => setFormAmount(e.target.value)} placeholder="0.00" />
                         </div>

                         <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Concepto</label>
                             <input type="text" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500" value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Ej: Compra..." />
                         </div>

                         <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                                 <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Fecha</label>
                                 <input type="date" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500" value={formDate} onChange={e => setFormDate(e.target.value)} />
                             </div>
                             <div className="space-y-2">
                                 <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Cuenta</label>
                                 <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 appearance-none" value={formAcc} onChange={e => setFormAcc(e.target.value)}>
                                     {data.accounts.filter(a => a.active !== false).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                 </select>
                             </div>
                         </div>

                         {formType === 'TRANSFER' ? (
                             <div className="space-y-2">
                                 <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Cuenta Destino</label>
                                 <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 appearance-none" value={formTransferAcc} onChange={e => setFormTransferAcc(e.target.value)}>
                                     <option value="">Selecciona destino...</option>
                                     {data.accounts.filter(a => a.id !== formAcc && a.active !== false).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                 </select>
                             </div>
                         ) : (
                             <div className="space-y-2">
                                 <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Categoría</label>
                                 <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 appearance-none" value={formCat} onChange={e => setFormCat(e.target.value)}>
                                     <option value="">Selecciona...</option>
                                     {data.categories.filter(c => {
                                         const fam = data.families.find(f => f.id === c.familyId);
                                         return c.active !== false && (!fam || fam.type === formType);
                                     }).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                 </select>
                             </div>
                         )}
                         
                         <button onClick={saveTransaction} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] hover:bg-indigo-600 shadow-xl mt-4">Guardar Movimiento</button>
                     </div>
                </div>
            </div>
        )}
    </div>
  );
};
