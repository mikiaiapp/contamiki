
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { AppState, Transaction, TransactionType, Family, Category, Account, RecurrentMovement, FavoriteMovement, RecurrenceFrequency } from './types';
import { Plus, Trash2, Search, ArrowRightLeft, X, Sparkles, Paperclip, Calendar, Filter, ChevronDown, MoreVertical, Repeat, Star, Edit3, AlertTriangle, Tag, ChevronUp, ChevronLeft, ChevronRight, Copy, Save, Clock, FileSpreadsheet, Upload, Info, ShieldCheck, CheckCircle2, Loader2, Eraser } from 'lucide-react';
import { mapBankTransactions } from './services/geminiService';
import * as XLSX from 'xlsx';

interface TransactionViewProps {
  data: AppState;
  onAddTransaction: (t: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onUpdateTransaction: (t: Transaction) => void;
  onUpdateData: (newData: Partial<AppState>) => void;
  initialFilters?: any;
  clearInitialFilters?: () => void;
}

type TimeRange = 'ALL' | 'MONTH' | 'QUARTER' | 'YEAR' | 'CUSTOM';
type SortField = 'DATE' | 'DEBE' | 'CONCEPTO' | 'HABER' | 'AMOUNT';
type SortDirection = 'ASC' | 'DESC';

const generateId = () => Math.random().toString(36).substring(2, 15);

export const TransactionView: React.FC<TransactionViewProps> = ({ data, onAddTransaction, onDeleteTransaction, onUpdateTransaction, onUpdateData, initialFilters, clearInitialFilters }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFavModalOpen, setIsFavModalOpen] = useState(false);
  const [favSearch, setFavSearch] = useState('');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<string | null>(null);
  
  // Estados para Smart Import Bancario
  const [showSmartImport, setShowSmartImport] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importStep, setImportStep] = useState<'IDLE' | 'PREVIEW' | 'SUCCESS'>('IDLE');
  const [importAccount, setImportAccount] = useState(data.accounts[0]?.id || '');
  const [mappedTransactions, setMappedTransactions] = useState<any[]>([]);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Estados para Borrado Masivo
  const [showMassDelete, setShowMassDelete] = useState(false);
  const [massDeleteYear, setMassDeleteYear] = useState<string | null>(null);

  // Modales de conversión
  const [txToFavorite, setTxToFavorite] = useState<Transaction | null>(null);
  const [txToRecurrent, setTxToRecurrent] = useState<Transaction | null>(null);
  const [favName, setFavName] = useState('');
  const [recFreq, setRecFreq] = useState<RecurrenceFrequency>('MONTHLY');
  const [recInterval, setRecInterval] = useState('1');

  // Ordenación
  const [sortField, setSortField] = useState<SortField>('DATE');
  const [sortDirection, setSortDirection] = useState<SortDirection>('DESC');

  // Filtros de búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTime, setFilterTime] = useState<TimeRange>('ALL');
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [filterFamily, setFilterFamily] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterAccount, setFilterAccount] = useState<string>('ALL');

  useEffect(() => {
    if (initialFilters) {
      if (initialFilters.filterTime) setFilterTime(initialFilters.filterTime);
      if (initialFilters.referenceDate) setReferenceDate(initialFilters.referenceDate);
      if (initialFilters.customStart) setCustomStart(initialFilters.customStart);
      if (initialFilters.customEnd) setCustomEnd(initialFilters.customEnd);
      if (initialFilters.filterCategory) setFilterCategory(initialFilters.filterCategory);
      if (initialFilters.filterCategory && initialFilters.filterCategory !== 'ALL') {
          const cat = data.categories.find(c => c.id === initialFilters.filterCategory);
          if (cat) setFilterFamily(cat.familyId);
      }
      if (clearInitialFilters) clearInitialFilters();
    }
  }, [initialFilters, data.categories]);

  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [accountId, setAccountId] = useState(data.accounts[0]?.id || '');
  const [selectedCategoryId, setSelectedCategoryId] = useState(''); 
  const [transferDestId, setTransferDestId] = useState('');
  const [attachment, setAttachment] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getTransactionEntities = (t: Transaction) => {
    const account = data.accounts.find(a => a.id === t.accountId);
    const category = data.categories.find(c => c.id === t.categoryId);
    const transferDest = t.transferAccountId ? data.accounts.find(a => a.id === t.transferAccountId) : null;
    const isIncome = t.type === 'INCOME';
    const isExpense = t.type === 'EXPENSE';

    let debe: { name: string, icon: string, id: string, type: 'ACCOUNT' | 'CATEGORY' };
    let haber: { name: string, icon: string, id: string, type: 'ACCOUNT' | 'CATEGORY' };

    if (isExpense) {
        debe = { name: category?.name || 'Gasto', icon: category?.icon || '📂', id: t.categoryId, type: 'CATEGORY' };
        haber = { name: account?.name || 'Cuenta', icon: account?.icon || '🏦', id: t.accountId, type: 'ACCOUNT' };
    } else if (isIncome) {
        debe = { name: account?.name || 'Cuenta', icon: account?.icon || '🏦', id: t.accountId, type: 'ACCOUNT' };
        haber = { name: category?.name || 'Ingreso', icon: category?.icon || '💰', id: t.categoryId, type: 'CATEGORY' };
    } else {
        debe = { name: transferDest?.name || 'Destino', icon: transferDest?.icon || '🏦', id: t.transferAccountId || '', type: 'ACCOUNT' };
        haber = { name: account?.name || 'Origen', icon: account?.icon || '🏦', id: t.accountId, type: 'ACCOUNT' };
    }
    return { debe, haber };
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsImporting(true);
      const reader = new FileReader();
      reader.onload = async (evt) => {
          try {
              const bstr = evt.target?.result;
              const wb = XLSX.read(bstr, { type: 'binary' });
              const wsname = wb.SheetNames[0];
              const ws = wb.Sheets[wsname];
              const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });
              const sample = rawData.slice(0, 50);
              const mapped = await mapBankTransactions(sample, data.categories, data.families);
              setMappedTransactions(mapped);
              setImportStep('PREVIEW');
          } catch (err) {
              console.error("Error parsing file", err);
              alert("Error al leer el archivo.");
          } finally {
              setIsImporting(false);
          }
      };
      reader.readAsBinaryString(file);
  };

  const confirmSmartImport = () => {
      const newTransactions: Transaction[] = mappedTransactions.map(item => ({
          id: generateId(),
          date: item.date,
          amount: item.amount,
          description: item.description,
          accountId: importAccount,
          type: item.type as TransactionType,
          categoryId: item.categoryId,
          familyId: item.familyId
      }));
      onUpdateData({ transactions: [...data.transactions, ...newTransactions] });
      setImportStep('SUCCESS');
      setTimeout(() => { setShowSmartImport(false); setImportStep('IDLE'); }, 3000);
  };

  const dateBounds = useMemo(() => {
    if (filterTime === 'ALL') return null;
    const y = referenceDate.getFullYear();
    const m = referenceDate.getMonth();
    let startStr = '';
    let endStr = '';
    if (filterTime === 'MONTH') {
      startStr = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m + 1, 0).getDate();
      endStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } else if (filterTime === 'QUARTER') {
      const quarter = Math.floor(m / 3);
      startStr = `${y}-${String(quarter * 3 + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(y, quarter * 3 + 3, 0).getDate();
      endStr = `${y}-${String(quarter * 3 + 3).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } else if (filterTime === 'YEAR') {
      startStr = `${y}-01-01`;
      endStr = `${y}-12-31`;
    } else if (filterTime === 'CUSTOM' && customStart && customEnd) {
      startStr = customStart;
      endStr = customEnd;
    }
    return { startStr, endStr };
  }, [filterTime, referenceDate, customStart, customEnd]);

  const filteredTransactions = useMemo(() => {
    let result = data.transactions.filter(t => {
      const textMatch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                       data.families.find(f => f.id === t.familyId)?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       data.categories.find(c => c.id === t.categoryId)?.name.toLowerCase().includes(searchTerm.toLowerCase());
      if (!textMatch) return false;
      if (filterAccount !== 'ALL' && t.accountId !== filterAccount && t.transferAccountId !== filterAccount) return false;
      if (filterFamily !== 'ALL' && t.familyId !== filterFamily) return false;
      if (filterCategory !== 'ALL' && t.categoryId !== filterCategory) return false;
      if (dateBounds) {
        if (t.date < dateBounds.startStr || t.date > dateBounds.endStr) return false;
      }
      return true;
    });
    result.sort((a, b) => {
        let valA: any; let valB: any;
        switch(sortField) {
            case 'DATE': valA = a.date; valB = b.date; break;
            case 'AMOUNT': valA = a.amount; valB = b.amount; break;
            case 'CONCEPTO': valA = a.description.toLowerCase(); valB = b.description.toLowerCase(); break;
            default: valA = a.date; valB = b.date;
        }
        if (valA < valB) return sortDirection === 'ASC' ? -1 : 1;
        if (valA > valB) return sortDirection === 'ASC' ? 1 : -1;
        return 0;
    });
    return result;
  }, [data.transactions, searchTerm, filterTime, dateBounds, filterFamily, filterCategory, filterAccount, sortField, sortDirection]);

  const transactionsPerYear = useMemo(() => {
      const counts: Record<string, number> = {};
      data.transactions.forEach(t => {
          const year = t.date.split('-')[0];
          counts[year] = (counts[year] || 0) + 1;
      });
      return Object.entries(counts).sort((a,b) => b[0].localeCompare(a[0]));
  }, [data.transactions]);

  const handleMassDelete = (year: string) => {
      const updatedTxs = data.transactions.filter(t => !t.date.startsWith(year));
      onUpdateData({ transactions: updatedTxs });
      setMassDeleteYear(null);
  };

  const navigatePeriod = (direction: 'prev' | 'next') => {
    const newDate = new Date(referenceDate);
    const step = direction === 'next' ? 1 : -1;
    if (filterTime === 'MONTH') newDate.setMonth(newDate.getMonth() + step);
    else if (filterTime === 'QUARTER') newDate.setMonth(newDate.getMonth() + (step * 3));
    else if (filterTime === 'YEAR') newDate.setFullYear(newDate.getFullYear() + step);
    setReferenceDate(newDate);
  };

  const resetForm = () => {
      setAmount(''); setDescription(''); setDate(new Date().toISOString().split('T')[0]);
      setSelectedCategoryId(''); setTransferDestId('');
      setAttachment(undefined); setEditingTx(null); setActionMenuId(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setAttachment(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const openEdit = (t: Transaction) => {
    setEditingTx(t); setType(t.type); setAmount(t.amount.toString()); setDescription(t.description); setDate(t.date); setAccountId(t.accountId);
    setSelectedCategoryId(t.categoryId); setTransferDestId(t.transferAccountId || ''); setAttachment(t.attachment); setIsModalOpen(true); setActionMenuId(null);
  };

  const handleDuplicate = (t: Transaction) => {
      const newTx: Transaction = { ...t, id: generateId(), date: new Date().toISOString().split('T')[0] };
      onAddTransaction(newTx); setActionMenuId(null);
  };

  const openSaveFavorite = (t: Transaction) => { setTxToFavorite(t); setFavName(t.description); setActionMenuId(null); };

  const confirmSaveFavorite = () => {
      if (!txToFavorite || !favName) return;
      const newFav: FavoriteMovement = {
          id: generateId(), name: favName, description: txToFavorite.description, amount: txToFavorite.amount,
          type: txToFavorite.type, accountId: txToFavorite.accountId, transferAccountId: txToFavorite.transferAccountId,
          familyId: txToFavorite.familyId, categoryId: txToFavorite.categoryId
      };
      onUpdateData({ favorites: [...(data.favorites || []), newFav] });
      setTxToFavorite(null);
  };

  const openCreateRecurrence = (t: Transaction) => { setTxToRecurrent(t); setRecFreq('MONTHLY'); setRecInterval('1'); setActionMenuId(null); };

  const confirmCreateRecurrence = () => {
      if (!txToRecurrent) return;
      const newRec: RecurrentMovement = {
          id: generateId(), description: txToRecurrent.description, amount: txToRecurrent.amount, type: txToRecurrent.type,
          accountId: txToRecurrent.accountId, transferAccountId: txToRecurrent.transferAccountId, familyId: txToRecurrent.familyId,
          categoryId: txToRecurrent.categoryId, frequency: recFreq, interval: parseInt(recInterval) || 1,
          startDate: new Date().toISOString().split('T')[0], nextDueDate: new Date().toISOString().split('T')[0], active: true
      };
      onUpdateData({ recurrents: [...(data.recurrents || []), newRec] });
      setTxToRecurrent(null);
  };

  const handleSort = (field: SortField) => {
      if (sortField === field) setSortDirection(sortDirection === 'ASC' ? 'DESC' : 'ASC');
      else { setSortField(field); setSortDirection('DESC'); }
  };

  const renderIcon = (iconStr: string, className = "w-10 h-10") => {
      const safeIcon = iconStr || '📂';
      if (safeIcon.startsWith('data:image') || safeIcon.startsWith('http')) return <img src={safeIcon} alt="icon" className={`${className} object-contain`} />;
      return <span className={`text-xl`}>{safeIcon}</span>;
  }

  const handleEntityClick = (entity: { id: string, type: 'ACCOUNT' | 'CATEGORY' }) => {
      setSearchTerm(''); setFilterTime('ALL');
      if (entity.type === 'ACCOUNT') { setFilterAccount(entity.id); setFilterFamily('ALL'); setFilterCategory('ALL'); }
      else { setFilterCategory(entity.id); setFilterAccount('ALL'); const cat = data.categories.find(c => c.id === entity.id); if (cat) setFilterFamily(cat.familyId); }
  };

  const years = Array.from({length: 10}, (_, i) => new Date().getFullYear() - 5 + i);
  const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  const clearAllFilters = () => {
    setSearchTerm(''); setFilterTime('ALL'); setFilterAccount('ALL'); setFilterFamily('ALL'); setFilterCategory('ALL');
    setCustomStart(''); setCustomEnd(''); setReferenceDate(new Date());
  };

  return (
    <div className="space-y-8 md:space-y-12 pb-24 md:pb-0">
      <div className="flex flex-col xl:flex-row justify-between items-center xl:items-end gap-6">
        <div className="space-y-2 text-center md:text-left">
            <p className="text-indigo-600 font-black uppercase tracking-[0.4em] text-[10px]">Libro Diario</p>
            <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter leading-none">Movimientos.</h2>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 w-full xl:w-auto">
            <button onClick={() => setShowMassDelete(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-4 bg-rose-50 text-rose-600 border border-rose-100 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-100 transition-all active:scale-95 shadow-sm">
                <Eraser size={16} /> Borrado Masivo
            </button>
            <button onClick={() => setShowSmartImport(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-4 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 transition-all active:scale-95 shadow-sm">
                <Sparkles size={16} /> Smart Import
            </button>
            <button onClick={() => setIsFavModalOpen(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-4 bg-amber-50 text-amber-600 border border-amber-100 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-100 transition-all active:scale-95 shadow-sm">
                <Star size={16} fill="currentColor" /> Favoritos
            </button>
            <button onClick={() => { resetForm(); setType('EXPENSE'); setIsModalOpen(true); }} className="flex-1 sm:flex-none bg-slate-950 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 active:scale-95">
                <Plus size={18} /> Nuevo Movimiento
            </button>
        </div>
      </div>

      {/* MODAL BORRADO MASIVO */}
      {showMassDelete && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[300] p-6 animate-in fade-in duration-300">
              <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl p-8 sm:p-12 relative flex flex-col max-h-[90vh] overflow-hidden">
                  <button onClick={() => { setShowMassDelete(false); setMassDeleteYear(null); }} className="absolute top-8 right-8 p-3 bg-slate-50 text-slate-400 rounded-full hover:bg-rose-50 hover:text-rose-600 transition-all"><X size={20}/></button>
                  <div className="mb-8 space-y-2">
                      <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3"><Eraser className="text-rose-600" size={28}/> Limpieza de Datos</h3>
                      <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">Elimina movimientos por periodos anuales</p>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
                      {massDeleteYear ? (
                          <div className="bg-rose-50 p-8 rounded-3xl border border-rose-100 space-y-6 animate-in zoom-in-95">
                              <div className="flex items-center gap-4 text-rose-600">
                                  <AlertTriangle size={32} />
                                  <h4 className="text-lg font-black uppercase">¡Atención!</h4>
                              </div>
                              <p className="text-sm font-bold text-rose-900/70 leading-relaxed uppercase">
                                  Estás a punto de eliminar permanentemente todos los movimientos del año <span className="text-rose-600 font-black">{massDeleteYear}</span>. Esta acción no se puede deshacer.
                              </p>
                              <div className="flex gap-3">
                                  <button onClick={() => handleMassDelete(massDeleteYear)} className="flex-1 py-4 bg-rose-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-rose-500/20 hover:bg-rose-700 transition-all">Sí, eliminar todo</button>
                                  <button onClick={() => setMassDeleteYear(null)} className="flex-1 py-4 bg-white text-slate-500 rounded-xl border border-slate-200 font-black text-[10px] uppercase hover:bg-slate-50 transition-all">Cancelar</button>
                              </div>
                          </div>
                      ) : (
                          <div className="grid grid-cols-1 gap-3">
                              {transactionsPerYear.length > 0 ? transactionsPerYear.map(([year, count]) => (
                                  <div key={year} className="bg-slate-50 p-6 rounded-2xl flex items-center justify-between border border-slate-100 group hover:border-indigo-200 transition-all">
                                      <div>
                                          <span className="text-2xl font-black text-slate-900 tracking-tighter">{year}</span>
                                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{count} movimientos detectados</p>
                                      </div>
                                      <button onClick={() => setMassDeleteYear(year)} className="flex items-center gap-2 px-5 py-3 bg-white text-rose-500 border border-rose-100 rounded-xl font-black text-[9px] uppercase hover:bg-rose-500 hover:text-white transition-all shadow-sm">
                                          <Trash2 size={14} /> Eliminar Año
                                      </button>
                                  </div>
                              )) : (
                                  <div className="py-20 text-center space-y-4">
                                      <div className="bg-slate-100 w-16 h-16 rounded-3xl mx-auto flex items-center justify-center text-slate-300"><Info size={32}/></div>
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">No hay movimientos registrados.</p>
                                  </div>
                              )}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
          <div className="relative group w-full">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={22} />
              <input type="text" placeholder="Buscar movimientos..." className="w-full pl-16 pr-6 py-5 bg-slate-50 border-2 border-transparent rounded-[1.5rem] focus:outline-none focus:bg-white focus:border-indigo-500 text-sm font-bold tracking-tight transition-all shadow-inner" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6 pt-2 border-t border-slate-50">
              <div className="flex bg-slate-100/80 p-1 rounded-xl shadow-inner border border-slate-200/50 w-full lg:w-auto overflow-x-auto scrollbar-hide">
                  {['ALL', 'MONTH', 'QUARTER', 'YEAR', 'CUSTOM'].map((range) => (
                      <button key={range} onClick={() => { setFilterTime(range as any); if(range !== 'CUSTOM') setReferenceDate(new Date()); }} className={`flex-1 lg:flex-none px-5 py-3 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${filterTime === range ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                          {range === 'ALL' ? 'Todo' : range === 'MONTH' ? 'Mes' : range === 'QUARTER' ? 'Trim' : range === 'YEAR' ? 'Año' : 'Pers'}
                      </button>
                  ))}
              </div>
              <div className="flex items-center gap-4 w-full lg:w-auto justify-center">
                  {filterTime !== 'ALL' && filterTime !== 'CUSTOM' && (
                      <div className="flex items-center gap-2">
                          <button onClick={() => navigatePeriod('prev')} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm active:scale-90 transition-all"><ChevronLeft size={18} /></button>
                          <button onClick={() => navigatePeriod('next')} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm active:scale-90 transition-all"><ChevronRight size={18} /></button>
                      </div>
                  )}
                  <div className="flex items-center gap-2">
                      {filterTime !== 'ALL' && filterTime !== 'CUSTOM' && (
                          <select className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-black text-[10px] outline-none focus:border-indigo-500 shadow-sm" value={referenceDate.getFullYear()} onChange={(e) => { const d = new Date(referenceDate); d.setFullYear(parseInt(e.target.value)); setReferenceDate(d); }}>
                              {years.map(y => <option key={y} value={y}>{y}</option>)}
                          </select>
                      )}
                      {filterTime === 'MONTH' && (
                          <select className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-black text-[10px] outline-none focus:border-indigo-500 shadow-sm" value={referenceDate.getMonth()} onChange={(e) => { const d = new Date(referenceDate); d.setMonth(parseInt(e.target.value)); setReferenceDate(d); }}>
                              {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                          </select>
                      )}
                      {filterTime === 'CUSTOM' && (
                          <div className="flex items-center gap-3 bg-white p-2 border border-slate-200 rounded-xl shadow-sm">
                              <input type="date" className="bg-transparent font-black text-[10px] outline-none text-slate-700" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
                              <span className="text-slate-300 text-[9px] font-black uppercase tracking-tighter">a</span>
                              <input type="date" className="bg-transparent font-black text-[10px] outline-none text-slate-700" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
                          </div>
                      )}
                  </div>
              </div>
          </div>
          <div className="flex flex-row items-center gap-2 pt-2 overflow-x-auto scrollbar-hide no-wrap w-full">
              <div className="flex items-center bg-slate-50 rounded-xl border border-slate-100 px-3 py-2.5 shadow-inner shrink-0 flex-1 min-w-[140px]">
                <ArrowRightLeft size={14} className="text-slate-400 mr-2 shrink-0" />
                <select className="bg-transparent text-[9px] font-black uppercase tracking-widest outline-none cursor-pointer w-full" value={filterAccount} onChange={e => setFilterAccount(e.target.value)}>
                    <option value="ALL">CUENTA</option>
                    {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="flex items-center bg-slate-50 rounded-xl border border-slate-100 px-3 py-2.5 shadow-inner shrink-0 flex-1 min-w-[140px]">
                <Filter size={14} className="text-slate-400 mr-2 shrink-0" />
                <select className="bg-transparent text-[9px] font-black uppercase tracking-widest outline-none cursor-pointer w-full" value={filterFamily} onChange={e => { setFilterFamily(e.target.value); setFilterCategory('ALL'); }}>
                    <option value="ALL">FAMILIA</option>
                    {data.families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div className="flex items-center bg-slate-50 rounded-xl border border-slate-100 px-3 py-2.5 shadow-inner shrink-0 flex-1 min-w-[140px]">
                <Tag size={14} className="text-slate-400 mr-2 shrink-0" />
                <select className="bg-transparent text-[9px] font-black uppercase tracking-widest outline-none cursor-pointer w-full" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                    <option value="ALL">CATEGORÍA</option>
                    {data.categories.filter(c => filterFamily === 'ALL' || c.familyId === filterFamily).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
          </div>
          {(filterTime !== 'ALL' || searchTerm || filterAccount !== 'ALL' || filterFamily !== 'ALL' || filterCategory !== 'ALL') && (
            <div className="flex justify-end pt-2 border-t border-slate-50">
                <button onClick={clearAllFilters} className="text-rose-500 text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-rose-50 px-5 py-2 rounded-xl transition-colors border border-rose-100">
                  <Trash2 size={14} /> Limpiar Filtros
                </button>
            </div>
          )}
      </div>

      <div className="space-y-3">
        {filteredTransactions.map(t => {
            const { debe, haber } = getTransactionEntities(t);
            const isIncome = t.type === 'INCOME';
            const isExpense = t.type === 'EXPENSE';
            return (
              <div key={t.id} className="group bg-white rounded-2xl md:rounded-[2.25rem] shadow-sm border border-slate-100 hover:shadow-lg hover:border-indigo-100 transition-all relative">
                <div className="flex flex-row items-center justify-between gap-3 p-3 md:grid md:grid-cols-[1fr_1.2fr_1fr_140px_100px] md:gap-8 md:p-6">
                    <div className="flex items-center gap-1.5 md:gap-4 shrink-0 md:min-w-0">
                        <button onClick={() => handleEntityClick(debe)} className="w-9 h-9 md:w-11 md:h-11 bg-slate-50 rounded-full md:rounded-xl flex items-center justify-center border border-slate-100 shrink-0 p-1 shadow-sm hover:scale-110 active:scale-90 transition-transform cursor-pointer">
                           {renderIcon(debe.icon, "w-full h-full")}
                        </button>
                        <div className="hidden md:block min-w-0">
                            <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight truncate block leading-none">{debe.name}</span>
                            <span className="text-[8px] font-bold text-slate-400 block mt-1">{t.date}</span>
                        </div>
                        <div className="md:hidden"><span className="text-[7px] font-black text-slate-400 block tracking-tighter">{t.date}</span></div>
                    </div>
                    <div className="flex flex-col justify-center min-w-0 md:border-x border-slate-50 px-0 md:px-6 flex-1">
                        <div className="flex items-center gap-2">
                            <h4 className="text-[10px] md:text-xs font-black text-indigo-500 tracking-tight truncate leading-tight uppercase flex-1">{t.description}</h4>
                            <button onClick={() => t.attachment && setPreviewAttachment(t.attachment)} className={`shrink-0 transition-all ${t.attachment ? 'text-indigo-600 hover:scale-125 active:scale-90 drop-shadow-[0_0_8px_rgba(79,70,229,0.3)]' : 'text-slate-200 pointer-events-none opacity-40'}`}><Paperclip size={16} /></button>
                        </div>
                    </div>
                    <div className="flex items-center justify-center gap-1 md:gap-4 shrink-0 md:min-w-0">
                        <button onClick={() => handleEntityClick(haber)} className="w-9 h-9 md:w-11 md:h-11 bg-slate-50 rounded-full md:rounded-xl flex items-center justify-center border border-slate-100 shrink-0 p-1 shadow-sm hover:scale-110 active:scale-90 transition-transform cursor-pointer">
                           {renderIcon(haber.icon, "w-full h-full")}
                        </button>
                        <div className="hidden md:block min-w-0"><span className="text-[11px] font-black text-slate-400 uppercase tracking-tight truncate block leading-none">{haber.name}</span></div>
                    </div>
                    <div className="text-right min-w-[70px] md:min-w-[140px]"><span className={`text-[11px] md:text-xl font-black tracking-tighter ${isIncome ? 'text-emerald-600' : isExpense ? 'text-rose-600' : 'text-slate-400'}`}>{isIncome ? '+' : isExpense ? '-' : ''}{t.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span></div>
                    <div className="flex justify-end relative shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); setActionMenuId(actionMenuId === t.id ? null : t.id); }} className={`p-2 md:p-3 rounded-lg transition-all border ${actionMenuId === t.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-slate-50 text-slate-400 border-transparent hover:border-slate-200'}`}><MoreVertical size={16} /></button>
                        {actionMenuId === t.id && (
                            <>
                                <div className="fixed inset-0 z-[100]" onClick={() => setActionMenuId(null)} />
                                <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.25)] border border-slate-100 p-2.5 z-[101] animate-in slide-in-from-top-2 origin-top-right">
                                    <button onClick={() => openEdit(t)} className="w-full flex items-center gap-3 px-4 py-3.5 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 rounded-xl transition-colors text-left"><Edit3 size={15} className="text-slate-400" /> Editar</button>
                                    <button onClick={() => handleDuplicate(t)} className="w-full flex items-center gap-3 px-4 py-3.5 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 rounded-xl transition-colors text-left"><Copy size={15} className="text-slate-400" /> Duplicar</button>
                                    <button onClick={() => openSaveFavorite(t)} className="w-full flex items-center gap-3 px-4 py-3.5 text-[10px] font-black uppercase text-amber-500 hover:bg-amber-50 rounded-xl transition-colors text-left"><Star size={15} fill="currentColor" /> Favorito</button>
                                    <button onClick={() => openCreateRecurrence(t)} className="w-full flex items-center gap-3 px-4 py-3.5 text-[10px] font-black uppercase text-indigo-500 hover:bg-indigo-50 rounded-xl transition-colors text-left"><Clock size={15} /> Recurrente</button>
                                    <div className="h-px bg-slate-100 my-1.5 mx-2"></div>
                                    <button onClick={() => { setDeleteConfirmId(t.id); setActionMenuId(null); }} className="w-full flex items-center gap-3 px-4 py-3.5 text-[10px] font-black uppercase text-rose-500 hover:bg-rose-50 rounded-xl transition-colors text-left"><Trash2 size={15} /> Eliminar</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
                {deleteConfirmId === t.id && (
                    <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-[110] flex items-center justify-center gap-4 px-4 animate-in fade-in duration-200 rounded-2xl md:rounded-[2.25rem]">
                        <p className="text-[9px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2"><AlertTriangle className="text-rose-500" size={14} /> ¿Confirmas borrado?</p>
                        <div className="flex gap-2">
                            <button onClick={() => { onDeleteTransaction(t.id); setDeleteConfirmId(null); }} className="bg-rose-500 text-white px-5 py-2.5 rounded-xl font-black text-[9px] uppercase shadow-lg shadow-rose-500/20 transition-all active:scale-95">Eliminar</button>
                            <button onClick={() => setDeleteConfirmId(null)} className="bg-slate-100 text-slate-500 px-5 py-2.5 rounded-xl font-black text-[9px] uppercase hover:bg-slate-200 transition-all">Cancelar</button>
                        </div>
                    </div>
                )}
              </div>
            );
        })}
      </div>

      {/* MODAL SMART BANK IMPORT */}
      {showSmartImport && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[300] p-6 animate-in fade-in duration-300">
              <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl p-8 sm:p-12 relative flex flex-col max-h-[95vh] overflow-hidden">
                  <button onClick={() => { setShowSmartImport(false); setImportStep('IDLE'); }} className="absolute top-8 right-8 p-3 bg-slate-50 text-slate-400 rounded-full hover:bg-rose-50 hover:text-rose-600 transition-all"><X size={20}/></button>
                  <div className="mb-8 space-y-2">
                      <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3"><ShieldCheck className="text-indigo-600" size={28}/> Smart Bank Import</h3>
                      <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">IA Gemini para volcado masivo de extractos</p>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                    {isImporting ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-6 animate-pulse">
                            <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                            <div className="text-center space-y-2">
                                <p className="text-[10px] font-black text-slate-900 uppercase tracking-[0.4em]">Analizando extracto...</p>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Identificando columnas y categorizando movimientos</p>
                            </div>
                        </div>
                    ) : importStep === 'IDLE' ? (
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[
                                    { icon: <Upload className="text-indigo-500" />, title: "Sube tu archivo", desc: "Arrastra el Excel/CSV de tu banco aquí." },
                                    { icon: <Sparkles className="text-indigo-500" />, title: "IA de Mapeo", desc: "Sugeriremos categorías automáticamente." }
                                ].map((step, i) => (
                                    <div key={i} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-3">
                                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100">{step.icon}</div>
                                        <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{step.title}</h4>
                                        <p className="text-[9px] font-bold text-slate-400 leading-relaxed uppercase">{step.desc}</p>
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => importFileRef.current?.click()} className="w-full py-10 border-2 border-dashed border-indigo-200 rounded-[2.5rem] bg-indigo-50/50 hover:bg-indigo-50 transition-all flex flex-col items-center justify-center gap-4 group">
                                <div className="p-4 bg-white rounded-2xl shadow-sm text-indigo-600 group-hover:scale-110 transition-transform"><FileSpreadsheet size={40} /></div>
                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Seleccionar Archivo .CSV o .XLSX</span>
                            </button>
                            <input type="file" ref={importFileRef} className="hidden" accept=".csv, .xlsx, .xls" onChange={handleFileImport} />
                        </div>
                    ) : importStep === 'PREVIEW' ? (
                        <div className="space-y-6">
                            <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 flex flex-col md:flex-row items-center justify-between gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100"><Info size={24}/></div>
                                    <div className="space-y-1">
                                        <h4 className="text-[11px] font-black text-indigo-900 uppercase">Previsualización ({mappedTransactions.length})</h4>
                                        <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">Revisa antes de volcar a tu cuenta.</p>
                                    </div>
                                </div>
                                <select className="w-full md:w-48 px-4 py-4 bg-white border border-indigo-200 rounded-xl font-bold text-[10px] uppercase outline-none" value={importAccount} onChange={e => setImportAccount(e.target.value)}>
                                    {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                {mappedTransactions.map((tx, idx) => (
                                    <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className="bg-white px-3 py-2 rounded-lg text-[9px] font-black text-slate-400 shrink-0">{tx.date}</div>
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-black text-slate-800 uppercase truncate">{tx.description}</p>
                                                <p className="text-[8px] font-bold text-indigo-500 uppercase tracking-tighter">Sugerencia: {data.categories.find(c => c.id === tx.categoryId)?.name || 'Sin Categoría'}</p>
                                            </div>
                                        </div>
                                        <span className={`text-xs font-black ${tx.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'} shrink-0`}>
                                            {tx.type === 'INCOME' ? '+' : '-'}{tx.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-3 sticky bottom-0 bg-white pt-4">
                                <button onClick={confirmSmartImport} className="flex-1 py-5 bg-emerald-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-100">Vuelcar ahora</button>
                                <button onClick={() => { setImportStep('IDLE'); setMappedTransactions([]); }} className="px-8 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase hover:bg-slate-200 transition-all">Cancelar</button>
                            </div>
                        </div>
                    ) : (
                        <div className="py-20 flex flex-col items-center justify-center gap-6">
                             <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-[2rem] flex items-center justify-center shadow-xl shadow-emerald-100"><CheckCircle2 size={40}/></div>
                             <div className="text-center space-y-2">
                                <h4 className="text-xl font-black text-slate-900 uppercase">¡Éxito!</h4>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em]">Movimientos volcados correctamente</p>
                             </div>
                        </div>
                    )}
                  </div>
              </div>
          </div>
      )}

      {/* MODAL GUARDAR FAVORITO */}
      {txToFavorite && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[250] p-4 animate-in fade-in duration-300">
              <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm p-8 relative animate-in zoom-in-95">
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-6 flex items-center gap-3"><Star className="text-amber-500" fill="currentColor" size={24} /> Nuevo Favorito</h3>
                  <div className="space-y-4">
                      <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Nombre del Atajo</label>
                          <input type="text" className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={favName} onChange={e => setFavName(e.target.value)} autoFocus />
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl text-[10px] font-bold text-slate-400 space-y-1 border border-slate-100">
                          <p>Importe: <span className="text-slate-900">{txToFavorite.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span></p>
                          <p>Descripción: <span className="text-slate-900">{txToFavorite.description}</span></p>
                      </div>
                      <div className="flex gap-2 pt-4">
                          <button onClick={confirmSaveFavorite} className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase text-[10px] shadow-lg hover:bg-indigo-700 transition-all">Guardar</button>
                          <button onClick={() => setTxToFavorite(null)} className="flex-1 bg-slate-100 text-slate-500 py-4 rounded-2xl font-black uppercase text-[10px] hover:bg-slate-200 transition-all">Cancelar</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL CREAR RECURRENTE */}
      {txToRecurrent && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[250] p-4 animate-in fade-in duration-300">
              <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm p-8 relative animate-in zoom-in-95">
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-6 flex items-center gap-3"><Repeat className="text-indigo-600" size={24} /> Automatizar</h3>
                  <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Cada (X)</label>
                              <input type="number" className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={recInterval} onChange={e => setRecInterval(e.target.value)} min="1" />
                          </div>
                          <div className="space-y-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Periodo</label>
                              <select className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={recFreq} onChange={e => setRecFreq(e.target.value as any)}>
                                  <option value="DAYS">Días</option>
                                  <option value="WEEKS">Semanas</option>
                                  <option value="MONTHLY">Meses</option>
                                  <option value="YEARS">Años</option>
                              </select>
                          </div>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl text-[10px] font-bold text-slate-400 space-y-1 border border-slate-100">
                          <p>Concepto: <span className="text-slate-900">{txToRecurrent.description}</span></p>
                          <p>Importe: <span className="text-slate-900">{txToRecurrent.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span></p>
                      </div>
                      <div className="flex gap-2 pt-4">
                          <button onClick={confirmCreateRecurrence} className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase text-[10px] shadow-lg hover:bg-indigo-700 transition-all">Activar</button>
                          <button onClick={() => setTxToRecurrent(null)} className="flex-1 bg-slate-100 text-slate-500 py-4 rounded-2xl font-black uppercase text-[10px] hover:bg-slate-200 transition-all">Cancelar</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL PREVIEW ADJUNTO */}
      {previewAttachment && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[300] p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl p-6 relative flex flex-col max-h-[90vh]">
                <button onClick={() => setPreviewAttachment(null)} className="absolute top-4 right-4 p-2 bg-slate-50 text-slate-400 rounded-full hover:bg-rose-50 hover:text-rose-600 transition-all"><X size={20}/></button>
                <div className="flex items-center gap-3 mb-6 border-b border-slate-50 pb-4">
                    <Paperclip className="text-indigo-600" />
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Comprobante Adjunto</h3>
                </div>
                <div className="flex-1 overflow-auto bg-slate-50 rounded-xl p-4 flex items-center justify-center min-h-[300px]">
                    {previewAttachment.startsWith('data:image') ? (
                        <img src={previewAttachment} className="max-w-full max-h-full object-contain shadow-sm rounded-lg" alt="Adjunto" />
                    ) : (
                        <iframe src={previewAttachment} className="w-full h-full min-h-[500px] rounded-lg" title="Documento" />
                    )}
                </div>
                <div className="mt-4 flex justify-end">
                  <button onClick={() => setPreviewAttachment(null)} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all">Cerrar Visor</button>
                </div>
            </div>
        </div>
      )}

      {/* MODAL NUEVO / EDITAR */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[210] p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg p-6 sm:p-12 relative max-h-[95vh] overflow-y-auto custom-scrollbar">
                <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="absolute top-8 right-8 p-3 bg-slate-50 text-slate-400 rounded-full hover:bg-rose-50 hover:text-rose-600 transition-all"><X size={20}/></button>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase mb-8">{editingTx ? 'Editar Movimiento' : 'Nuevo Movimiento'}</h3>
                <form className="space-y-6">
                    <div className="bg-slate-100 p-1.5 rounded-2xl flex gap-1.5 shadow-inner">
                        {['EXPENSE', 'INCOME', 'TRANSFER'].map((m) => (
                            <button key={m} type="button" onClick={() => { setType(m as any); setSelectedCategoryId(''); }} className={`flex-1 py-4 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${type === m ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>
                                {m === 'EXPENSE' ? 'Gasto' : m === 'INCOME' ? 'Ingreso' : 'Traspaso'}
                            </button>
                        ))}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Importe</label><input type="number" step="0.01" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xl font-black outline-none focus:border-indigo-500 transition-all" value={amount} onChange={e => setAmount(e.target.value)} /></div>
                        <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha</label><input type="date" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={date} onChange={e => setDate(e.target.value)} /></div>
                    </div>
                    <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Sparkles size={14} className="text-indigo-400"/> Descripción</label><input type="text" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={description} onChange={e => setDescription(e.target.value)} /></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {type === 'EXPENSE' && (
                            <><div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Categoría</label><select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={selectedCategoryId} onChange={e => setSelectedCategoryId(e.target.value)}><option value="">Seleccionar...</option>{data.categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</select></div><div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Cuenta</label><select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={accountId} onChange={e => setAccountId(e.target.value)}>{data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div></>
                        )}
                        {type === 'INCOME' && (
                            <><div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Cuenta</label><select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={accountId} onChange={e => setAccountId(e.target.value)}>{data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div><div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Categoría</label><select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={selectedCategoryId} onChange={e => setSelectedCategoryId(e.target.value)}><option value="">Seleccionar...</option>{data.categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</select></div></>
                        )}
                        {type === 'TRANSFER' && (
                            <><div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Hacia</label><select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={transferDestId} onChange={e => setTransferDestId(e.target.value)}><option value="">Seleccionar...</option>{data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div><div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Desde</label><select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={accountId} onChange={e => setAccountId(e.target.value)}>{data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div></>
                        )}
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Paperclip size={14} /> Adjuntar Comprobante</label>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => fileInputRef.current?.click()} className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 border-2 border-dashed rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest ${attachment ? 'bg-indigo-50 border-indigo-300 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-indigo-200 hover:bg-slate-50'}`}>
                              {attachment ? 'Cambiar Archivo' : 'Seleccionar Archivo'}
                          </button>
                          {attachment && <button type="button" onClick={() => setAttachment(undefined)} className="p-4 bg-rose-50 text-rose-500 rounded-2xl border border-rose-100 shadow-sm"><Trash2 size={20}/></button>}
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleFileChange} />
                    </div>
                    <button type="button" onClick={() => {
                            if (!amount || !description) return alert("Completa importe y descripción.");
                            const finalTx: Transaction = { id: editingTx ? editingTx.id : generateId(), date, amount: parseFloat(amount), description, accountId, type, familyId: '', categoryId: '', attachment };
                            if (type === 'TRANSFER') finalTx.transferAccountId = transferDestId;
                            else { const cat = data.categories.find(c => c.id === selectedCategoryId); if (cat) { finalTx.familyId = cat.familyId; finalTx.categoryId = cat.id; } }
                            editingTx ? onUpdateTransaction(finalTx) : onAddTransaction(finalTx);
                            setIsModalOpen(false); resetForm();
                        }} className="w-full py-6 bg-slate-950 text-white rounded-3xl font-black uppercase text-[11px] shadow-2xl hover:bg-indigo-600 transition-all mt-6">Confirmar</button>
                </form>
            </div>
        </div>
      )}
      
      {isFavModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[200] p-6 animate-in fade-in duration-300">
              <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl p-8 relative animate-in zoom-in-95 max-h-[80vh] flex flex-col">
                  <button onClick={() => setIsFavModalOpen(false)} className="absolute top-8 right-8 p-3 bg-slate-50 rounded-full text-slate-400 hover:text-rose-500 transition-colors"><X size={20}/></button>
                  <div className="mb-6 space-y-4">
                      <h3 className="text-2xl font-black text-slate-900 uppercase flex items-center gap-3"><Star className="text-amber-500" fill="currentColor" size={24} /> Favoritos</h3>
                      <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} /><input type="text" className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500" placeholder="Buscar favorito..." value={favSearch} onChange={e => setFavSearch(e.target.value)} /></div>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                      {(data.favorites || []).filter(f => f.name.toLowerCase().includes(favSearch.toLowerCase())).map(f => (
                          <button key={f.id} onClick={() => { resetForm(); setType(f.type); setAmount(f.amount.toString()); setDescription(f.description); setAccountId(f.accountId); setTransferDestId(f.transferAccountId || ''); setSelectedCategoryId(f.categoryId); setIsFavModalOpen(false); setIsModalOpen(true); }} className="w-full flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-transparent hover:border-indigo-500 hover:bg-white transition-all text-left group shadow-sm">
                              <div className="flex items-center gap-4"><div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-amber-500 shadow-sm border border-slate-100 group-hover:scale-110 transition-transform"><Star size={20} fill="currentColor" /></div><div><p className="font-black text-slate-900 text-sm uppercase tracking-tight">{f.name}</p></div></div>
                              <p className="text-lg font-black text-slate-800 tracking-tighter">{f.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
                          </button>
                      ))}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
