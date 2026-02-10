
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { AppState, Transaction, TransactionType, GlobalFilter, FavoriteMovement } from './types';
import { Plus, Trash2, Search, ArrowRightLeft, X, Paperclip, ChevronLeft, ChevronRight, Edit3, ArrowUpDown, Link2, Link2Off, Tag, Receipt, CheckCircle2, Upload, SortAsc, SortDesc, FileDown, FileSpreadsheet, ChevronsLeft, ChevronsRight, Heart, Bot, Check, AlertTriangle, RefreshCw, Filter, Eraser } from 'lucide-react';
import * as XLSX from 'xlsx';

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

type SortField = 'DATE' | 'DESCRIPTION' | 'AMOUNT' | 'ACCOUNT' | 'CATEGORY' | 'ATTACHMENT';
type SortDirection = 'ASC' | 'DESC';
type AmountOperator = 'ALL' | 'GT' | 'LT' | 'EQ' | 'BETWEEN';

interface PendingImport {
    tempId: string;
    date: string;
    description: string;
    amount: string;
    categoryId: string;
    accountId: string;
    isValid: boolean;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

const numberFormatter = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const TransactionView: React.FC<TransactionViewProps> = ({ data, onAddTransaction, onDeleteTransaction, onUpdateTransaction, filter, onUpdateFilter, initialSpecificFilters, clearSpecificFilters }) => {
  // Editor State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [fType, setFType] = useState<TransactionType>('EXPENSE');
  const [fAmount, setFAmount] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fDate, setFDate] = useState('');
  const [fAcc, setFAcc] = useState('');
  const [fCat, setFCat] = useState('');
  const [fTransferDest, setFTransferDest] = useState('');
  const [fAttachment, setFAttachment] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // SMART IMPORT STATE
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStep, setImportStep] = useState<1 | 2>(1); 
  const [importAccount, setImportAccount] = useState('');
  const [importRawData, setImportRawData] = useState('');
  const [pendingImports, setPendingImports] = useState<PendingImport[]>([]);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Favorites State
  const [showFavoritesMenu, setShowFavoritesMenu] = useState(false);

  // Filters State
  const [colFilterEntry, setColFilterEntry] = useState('ALL');
  const [colFilterDesc, setColFilterDesc] = useState('');
  const [colFilterClip, setColFilterClip] = useState<'ALL' | 'YES' | 'NO'>('ALL');
  const [colFilterExit, setColFilterExit] = useState('ALL');
  
  // Advanced Amount Filters
  const [colFilterAmountOp, setColFilterAmountOp] = useState<AmountOperator>('ALL');
  const [colFilterAmountVal1, setColFilterAmountVal1] = useState('');
  const [colFilterAmountVal2, setColFilterAmountVal2] = useState('');

  // Sorting & Pagination
  const [sortField, setSortField] = useState<SortField>('DATE');
  const [sortDirection, setSortDirection] = useState<SortDirection>('DESC');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // --- CAPA 1: ÍNDICES ---
  const indices = useMemo(() => {
    const acc = new Map(data.accounts.map(a => [a.id, a]));
    const cat = new Map(data.categories.map(c => [c.id, c]));
    const fam = new Map(data.families.map(f => [f.id, f]));
    return { acc, cat, fam };
  }, [data.accounts, data.categories, data.families]);

  // --- CAPA 2: ESTRUCTURAS UI ---
  const groupedLists = useMemo(() => {
    const sortedGroups = [...data.accountGroups].sort((a,b) => a.name.localeCompare(b.name));
    const sortedFamilies = [...data.families].sort((a,b) => a.name.localeCompare(b.name));

    const accounts = sortedGroups.map(g => ({
        group: g,
        items: data.accounts.filter(a => a.groupId === g.id).sort((a,b) => a.name.localeCompare(b.name))
    })).filter(g => g.items.length > 0);

    const categories = sortedFamilies.map(f => ({
        family: f,
        items: data.categories.filter(c => c.familyId === f.id).sort((a,b) => a.name.localeCompare(b.name))
    })).filter(f => f.items.length > 0);

    return { accounts, categories };
  }, [data.accountGroups, data.accounts, data.families, data.categories]);

  // --- LOGICA DE FILTROS ---
  useEffect(() => {
    if (initialSpecificFilters) {
      if (initialSpecificFilters.action === 'NEW' && initialSpecificFilters.categoryId) {
         resetForm();
         const cat = indices.cat.get(initialSpecificFilters.categoryId);
         const fam = cat ? indices.fam.get(cat.familyId) : null;
         setFCat(initialSpecificFilters.categoryId);
         if (fam) setFType(fam.type === 'INCOME' ? 'INCOME' : 'EXPENSE');
         setIsModalOpen(true);
      } else {
          if (initialSpecificFilters.filterCategory) setColFilterEntry(initialSpecificFilters.filterCategory);
          if (initialSpecificFilters.filterAccount) setColFilterExit(initialSpecificFilters.filterAccount);
      }
      if (clearSpecificFilters) clearSpecificFilters();
    }
  }, [initialSpecificFilters, indices]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, colFilterEntry, colFilterDesc, colFilterClip, colFilterExit, colFilterAmountOp, colFilterAmountVal1, colFilterAmountVal2, sortField, sortDirection]);

  // 1. Filtrado Temporal
  const timeFilteredList = useMemo(() => {
    const y = filter.referenceDate.getFullYear();
    const m = filter.referenceDate.getMonth();
    let start = ''; let end = '';
    
    if (filter.timeRange === 'MONTH') {
      start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      end = `${y}-${String(m + 1).padStart(2, '0')}-${new Date(y, m + 1, 0).getDate()}`;
    } else if (filter.timeRange === 'YEAR') {
      start = `${y}-01-01`; end = `${y}-12-31`;
    } else if (filter.timeRange === 'CUSTOM') {
      start = filter.customStart || '1900-01-01';
      end = filter.customEnd || '2100-12-31';
    }

    return data.transactions.filter(t => {
      if (filter.timeRange !== 'ALL' && (t.date < start || t.date > end)) return false;
      return true;
    });
  }, [data.transactions, filter.timeRange, filter.referenceDate, filter.customStart, filter.customEnd]);

  // 2. Opciones activas en el periodo
  const activeFilterOptions = useMemo(() => {
      const activeEntryIds = new Set<string>(); 
      const activeExitIds = new Set<string>();

      timeFilteredList.forEach(t => {
          if (t.type === 'EXPENSE') activeEntryIds.add(t.categoryId); 
          else if (t.type === 'INCOME') activeEntryIds.add(t.accountId); 
          else if (t.type === 'TRANSFER') { if(t.transferAccountId) activeEntryIds.add(t.transferAccountId); }

          if (t.type === 'EXPENSE') activeExitIds.add(t.accountId); 
          else if (t.type === 'INCOME') activeExitIds.add(t.categoryId); 
          else if (t.type === 'TRANSFER') activeExitIds.add(t.accountId); 
      });

      return { activeEntryIds, activeExitIds };
  }, [timeFilteredList]);

  // 3. Filtrado completo (Acumulativo)
  const filteredList = useMemo(() => {
    const hasDescFilter = colFilterDesc && colFilterDesc.trim() !== '';
    const descPattern = hasDescFilter ? colFilterDesc.trim().toLowerCase() : '';
    
    const v1 = parseFloat(colFilterAmountVal1);
    const v2 = parseFloat(colFilterAmountVal2);
    const hasAmountFilter = colFilterAmountOp !== 'ALL' && !isNaN(v1);

    return timeFilteredList.filter(t => {
      // Filtro Entrada/Cat (Izquierda)
      if (colFilterEntry !== 'ALL') {
          // Si es cuenta (Incomes o Traspasos Destino)
          if (indices.acc.has(colFilterEntry)) {
              if (t.accountId !== colFilterEntry && t.transferAccountId !== colFilterEntry) return false;
          } else {
              // Si es categoría (Expenses)
              if (t.categoryId !== colFilterEntry) return false;
          }
      }

      // Filtro Cuenta/Salida (Derecha)
      if (colFilterExit !== 'ALL') {
          if (indices.acc.has(colFilterExit)) {
              if (t.accountId !== colFilterExit) return false;
          } else {
              // Categoría en Ingresos
              if (t.categoryId !== colFilterExit) return false;
          }
      }

      // Filtro Descripción
      if (hasDescFilter && !t.description.toLowerCase().includes(descPattern)) return false;
      
      // Filtro Clip
      if (colFilterClip === 'YES' && !t.attachment) return false;
      if (colFilterClip === 'NO' && t.attachment) return false;

      // Filtro Importe
      if (hasAmountFilter) {
          const val = t.amount;
          if (colFilterAmountOp === 'GT' && val <= v1) return false;
          if (colFilterAmountOp === 'LT' && val >= v1) return false;
          if (colFilterAmountOp === 'EQ' && Math.abs(val - v1) > 0.01) return false;
          if (colFilterAmountOp === 'BETWEEN') {
              if (isNaN(v2)) { if (val < v1) return false; }
              else { if (val < v1 || val > v2) return false; }
          }
      }
      return true;
    });
  }, [timeFilteredList, colFilterEntry, colFilterDesc, colFilterClip, colFilterExit, colFilterAmountOp, colFilterAmountVal1, colFilterAmountVal2, indices]);

  // 4. Ordenación
  const sortedTransactions = useMemo(() => {
    return [...filteredList].sort((a, b) => {
      let vA: any, vB: any;
      if (sortField === 'DATE') { vA = a.date; vB = b.date; }
      else if (sortField === 'DESCRIPTION') { vA = a.description.toLowerCase(); vB = b.description.toLowerCase(); }
      else if (sortField === 'AMOUNT') { vA = a.amount; vB = b.amount; }
      else if (sortField === 'CATEGORY') { 
          const getText = (tx: Transaction) => {
              if (tx.type === 'INCOME') return indices.acc.get(tx.accountId)?.name.toLowerCase() || '';
              if (tx.type === 'TRANSFER') return indices.acc.get(tx.transferAccountId || '')?.name.toLowerCase() || '';
              return indices.cat.get(tx.categoryId)?.name.toLowerCase() || '';
          };
          vA = getText(a); vB = getText(b);
      }
      else if (sortField === 'ACCOUNT') { 
          const getText = (tx: Transaction) => {
              if (tx.type === 'INCOME') return indices.cat.get(tx.categoryId)?.name.toLowerCase() || '';
              return indices.acc.get(tx.accountId)?.name.toLowerCase() || '';
          };
          vA = getText(a); vB = getText(b);
      }
      else if (sortField === 'ATTACHMENT') { vA = a.attachment ? 1 : 0; vB = b.attachment ? 1 : 0; }
      
      if (vA < vB) return sortDirection === 'ASC' ? -1 : 1;
      if (vA > vB) return sortDirection === 'ASC' ? 1 : -1;
      return 0;
    });
  }, [filteredList, sortField, sortDirection, indices]);

  const activeFiltersChips = useMemo(() => {
      const chips: { id: string, label: string, onRemove: () => void }[] = [];
      if (colFilterEntry !== 'ALL') {
          const name = indices.acc.get(colFilterEntry)?.name || indices.cat.get(colFilterEntry)?.name || 'Desconocido';
          chips.push({ id: 'entry', label: `Entrada: ${name}`, onRemove: () => setColFilterEntry('ALL') });
      }
      if (colFilterExit !== 'ALL') {
          const name = indices.acc.get(colFilterExit)?.name || indices.cat.get(colFilterExit)?.name || 'Desconocido';
          chips.push({ id: 'exit', label: `Cuenta: ${name}`, onRemove: () => setColFilterExit('ALL') });
      }
      if (colFilterDesc) chips.push({ id: 'desc', label: `Texto: "${colFilterDesc}"`, onRemove: () => setColFilterDesc('') });
      if (colFilterClip !== 'ALL') chips.push({ id: 'clip', label: `Adjuntos: ${colFilterClip === 'YES' ? 'SÍ' : 'NO'}`, onRemove: () => setColFilterClip('ALL') });
      if (colFilterAmountOp !== 'ALL') chips.push({ id: 'amount', label: `Importe: ${colFilterAmountOp}`, onRemove: () => setColFilterAmountOp('ALL') });
      return chips;
  }, [colFilterEntry, colFilterExit, colFilterDesc, colFilterClip, colFilterAmountOp, indices]);

  const clearAllFilters = () => {
    setColFilterEntry('ALL'); setColFilterDesc(''); setColFilterClip('ALL');
    setColFilterExit('ALL'); setColFilterAmountOp('ALL');
    setColFilterAmountVal1(''); setColFilterAmountVal2('');
  };

  // --- HELPERS UI ---
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '--/--/--';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year.slice(-2)}`;
  };
  const formatCurrency = (amount: number) => `${numberFormatter.format(amount)} €`;
  const getAmountColor = (amount: number) => {
      if (amount > 0) return 'text-emerald-600';
      if (amount < 0) return 'text-rose-600';
      return 'text-slate-400';
  };
  const renderIcon = (iconStr: string, className = "w-10 h-10") => {
    if (iconStr?.startsWith('http') || iconStr?.startsWith('data:image')) return <img src={iconStr} className={`${className} object-contain rounded-lg`} referrerPolicy="no-referrer" />;
    return <span className="text-xl">{iconStr || '📂'}</span>;
  }
  const SortIcon = ({ field }: { field: SortField }) => {
      if (sortField !== field) return <ArrowUpDown size={12} className="opacity-20" />;
      return sortDirection === 'ASC' ? <SortAsc size={12} className="text-indigo-600" /> : <SortDesc size={12} className="text-indigo-600" />;
  };

  const resetForm = () => {
    setEditingTx(null);
    setFType('EXPENSE');
    setFAmount('');
    setFDesc('');
    setFDate(new Date().toISOString().split('T')[0]);
    const defaultAcc = groupedLists.accounts[0]?.items[0]?.id || data.accounts[0]?.id || '';
    setFAcc(defaultAcc);
    setFCat('');
    setFTransferDest('');
    setFAttachment(undefined);
  };

  const loadFavorite = (fav: FavoriteMovement) => {
    resetForm();
    setFType(fav.type);
    setFAmount(Math.abs(fav.amount).toString());
    setFDesc(fav.description);
    setFAcc(fav.accountId);
    setFCat(fav.categoryId);
    if(fav.transferAccountId) setFTransferDest(fav.transferAccountId);
    setShowFavoritesMenu(false);
    setIsModalOpen(true);
  };

  const openEditor = (t?: Transaction) => {
    if (t) {
      setEditingTx(t);
      setFType(t.type);
      setFAmount(Math.abs(t.amount).toString());
      setFDesc(t.description);
      setFDate(t.date); 
      setFAcc(t.accountId);
      setFCat(t.categoryId);
      setFTransferDest(t.transferAccountId || '');
      setFAttachment(t.attachment);
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!fAmount || !fDesc || !fAcc || (fType !== 'TRANSFER' && !fCat)) {
      alert("Faltan datos obligatorios."); return;
    }
    let rawAmount = parseFloat(fAmount);
    rawAmount = Math.abs(rawAmount);
    if (fType === 'EXPENSE' || fType === 'TRANSFER') rawAmount = -rawAmount;
    
    const cat = indices.cat.get(fCat);
    const finalTx: Transaction = {
      id: editingTx ? editingTx.id : generateId(),
      date: fDate,
      amount: rawAmount,
      description: fDesc,
      accountId: fAcc,
      type: fType,
      categoryId: fCat,
      familyId: cat?.familyId || '',
      attachment: fAttachment,
      transferAccountId: fType === 'TRANSFER' ? fTransferDest : undefined
    };
    if (editingTx) onUpdateTransaction(finalTx);
    else onAddTransaction(finalTx);
    setIsModalOpen(false);
    resetForm();
  };

  // --- PAGINACIÓN ---
  const totalItems = sortedTransactions.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedTransactions = useMemo(() => {
    if (itemsPerPage === -1) return sortedTransactions;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedTransactions.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedTransactions, currentPage, itemsPerPage]);

  return (
    <div className="space-y-6 md:space-y-10 pb-24">
      {/* CABECERA PRINCIPAL */}
      <div className="flex flex-col xl:flex-row justify-between xl:items-end gap-8 print:hidden">
        <div className="space-y-4 text-center md:text-left w-full xl:w-auto">
            <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter">Diario.</h2>
            <div className="flex flex-col sm:flex-row items-center gap-3 justify-center md:justify-start">
                <div className="flex items-center gap-1">
                    <button onClick={() => { const d = new Date(filter.referenceDate); d.setMonth(d.getMonth() - 1); onUpdateFilter({ ...filter, referenceDate: d }); }} className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm active:scale-90 transition-all"><ChevronLeft size={20} /></button>
                    <button onClick={() => { const d = new Date(filter.referenceDate); d.setMonth(d.getMonth() + 1); onUpdateFilter({ ...filter, referenceDate: d }); }} className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm active:scale-90 transition-all"><ChevronRight size={20} /></button>
                </div>
                
                <div className="flex gap-2 items-center">
                    {filter.timeRange === 'MONTH' && (
                        <div className="flex gap-2">
                             <select className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-indigo-500 shadow-sm cursor-pointer" value={filter.referenceDate.getFullYear()} onChange={(e) => { const d = new Date(filter.referenceDate); d.setFullYear(parseInt(e.target.value)); onUpdateFilter({...filter, referenceDate: d}); }}>
                                {Array.from({length: 10}, (_, i) => 2020 + i).map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                            <select className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-indigo-500 shadow-sm cursor-pointer" value={filter.referenceDate.getMonth()} onChange={(e) => { const d = new Date(filter.referenceDate); d.setMonth(parseInt(e.target.value)); onUpdateFilter({...filter, referenceDate: d}); }}>
                                {["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"].map((m, i) => <option key={i} value={i}>{m}</option>)}
                            </select>
                        </div>
                    )}
                </div>

                <div className="flex gap-2 sm:ml-4">
                    <button onClick={() => setShowFavoritesMenu(!showFavoritesMenu)} className="bg-white text-indigo-600 border border-slate-200 px-4 py-2.5 rounded-xl font-black uppercase text-[10px] shadow-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2 active:scale-95">
                        <Heart size={16} /> <span>Favoritos</span>
                    </button>
                    <button onClick={() => openEditor()} className="bg-slate-950 text-white px-6 py-2.5 rounded-xl font-black uppercase text-[10px] shadow-lg hover:bg-indigo-600 transition-all flex items-center justify-center gap-2 active:scale-95">
                      <Plus size={16} /> Nuevo
                    </button>
                </div>
            </div>
        </div>
        <div className="bg-slate-100/80 p-1.5 rounded-2xl flex flex-wrap justify-center gap-1 shadow-inner border border-slate-200/50 w-full sm:w-fit mx-auto xl:mx-0">
            {[
                { id: 'ALL', label: 'Todo' },
                { id: 'MONTH', label: 'Mes' },
                { id: 'YEAR', label: 'Año' },
                { id: 'CUSTOM', label: 'Pers' }
            ].map((range) => (
                <button key={range.id} onClick={() => onUpdateFilter({...filter, timeRange: range.id as any})} className={`flex-1 sm:flex-none px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${filter.timeRange === range.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    {range.label}
                </button>
            ))}
        </div>
      </div>

      {/* BARRA DE FILTROS ACTIVOS (chips) */}
      {activeFiltersChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 py-2 px-6 bg-indigo-50/50 rounded-3xl border border-indigo-100/50 animate-in fade-in slide-in-from-top-2">
              <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2 mr-2">
                  <Filter size={12}/> Filtros Activos:
              </span>
              {activeFiltersChips.map(chip => (
                  <div key={chip.id} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-indigo-100 shadow-sm group">
                      <span className="text-[10px] font-bold text-slate-700 uppercase">{chip.label}</span>
                      <button onClick={chip.onRemove} className="text-slate-300 hover:text-rose-500 transition-colors">
                          <X size={12} />
                      </button>
                  </div>
              ))}
              <button 
                onClick={clearAllFilters}
                className="ml-auto flex items-center gap-2 px-4 py-1.5 text-rose-500 hover:bg-rose-100/50 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest"
              >
                  <Eraser size={12}/> Limpiar Todo
              </button>
          </div>
      )}

      {/* TABLA / GRILLA DE MOVIMIENTOS */}
      <div className="space-y-4">
          <div className="hidden lg:grid grid-cols-[100px_180px_1fr_60px_180px_180px_100px] gap-4 px-10 py-6 items-start bg-white rounded-[2.5rem] border border-slate-100 shadow-sm print:hidden">
            <div className="space-y-3">
                <button onClick={() => { if(sortField==='DATE') setSortDirection(sortDirection==='ASC'?'DESC':'ASC'); else setSortField('DATE'); }} className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors pt-2">
                    Fecha <SortIcon field="DATE" />
                </button>
            </div>
            
            <div className="space-y-3">
                <button className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Entrada/Cat
                </button>
                <select 
                    className="w-full px-2 py-2 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold outline-none cursor-pointer focus:border-indigo-300 transition-all" 
                    value={colFilterEntry} 
                    onChange={e => setColFilterEntry(e.target.value)}
                >
                    <option value="ALL">TODAS</option>
                    <optgroup label="Categorías">
                        {data.categories.filter(c => activeFilterOptions.activeEntryIds.has(c.id)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </optgroup>
                    <optgroup label="Cuentas">
                        {data.accounts.filter(a => activeFilterOptions.activeEntryIds.has(a.id)).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </optgroup>
                </select>
            </div>

            <div className="space-y-3">
                <button className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Descripción
                </button>
                <div className="relative">
                    <input 
                      type="text" 
                      placeholder="Buscar..." 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold outline-none focus:border-indigo-300 transition-all" 
                      value={colFilterDesc} 
                      onChange={e => setColFilterDesc(e.target.value)} 
                    />
                </div>
            </div>

            <div className="space-y-3 flex flex-col items-center">
                <button className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Clip</button>
                <select className="w-full px-1 py-2 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-black outline-none cursor-pointer" value={colFilterClip} onChange={e => setColFilterClip(e.target.value as any)}>
                    <option value="ALL">...</option>
                    <option value="YES">SÍ</option>
                    <option value="NO">NO</option>
                </select>
            </div>

            <div className="space-y-3">
                <button className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Cuenta
                </button>
                <select 
                    className="w-full px-2 py-2 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold outline-none cursor-pointer focus:border-indigo-300 transition-all" 
                    value={colFilterExit} 
                    onChange={e => setColFilterExit(e.target.value)}
                >
                    <option value="ALL">TODAS</option>
                    <optgroup label="Cuentas">
                        {data.accounts.filter(a => activeFilterOptions.activeExitIds.has(a.id)).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </optgroup>
                    <optgroup label="Categorías">
                        {data.categories.filter(c => activeFilterOptions.activeExitIds.has(c.id)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </optgroup>
                </select>
            </div>

            <div className="space-y-3">
                <button className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest justify-end w-full">
                    Importe
                </button>
                <select className="w-full px-2 py-2 bg-slate-50 border border-slate-100 rounded-lg text-[9px] font-black uppercase outline-none cursor-pointer" value={colFilterAmountOp} onChange={e => setColFilterAmountOp(e.target.value as AmountOperator)}>
                    <option value="ALL">Todos</option>
                    <option value="GT">{"> mayor que"}</option>
                    <option value="LT">{"< menor que"}</option>
                </select>
            </div>

            <div className="pt-2 text-center">
                <button onClick={clearAllFilters} className="p-2 text-slate-300 hover:text-rose-500 transition-colors" title="Limpiar filtros de columna">
                    <X size={18} />
                </button>
            </div>
          </div>

          {paginatedTransactions.map(t => {
              const srcAcc = indices.acc.get(t.accountId);
              const dstAcc = t.transferAccountId ? indices.acc.get(t.transferAccountId) : null;
              const cat = indices.cat.get(t.categoryId);
              
              let entryNode: React.ReactNode;
              let exitNode: React.ReactNode;

              if (t.type === 'TRANSFER') {
                entryNode = <div className="flex items-center gap-2 text-indigo-600 font-bold truncate">{renderIcon(dstAcc?.icon || '🏦', "w-6 h-6")} {dstAcc?.name}</div>;
                exitNode = <div className="flex items-center gap-2 text-slate-500 font-bold truncate">{renderIcon(srcAcc?.icon || '🏦', "w-6 h-6")} {srcAcc?.name}</div>;
              } else if (t.type === 'INCOME') {
                entryNode = <div className="flex items-center gap-2 text-emerald-600 font-bold truncate">{renderIcon(srcAcc?.icon || '🏦', "w-6 h-6")} {srcAcc?.name}</div>;
                exitNode = <div className="flex items-center gap-2 text-slate-300 italic truncate">{cat ? renderIcon(cat.icon, "w-5 h-5") : <Tag size={14}/>} {cat?.name || 'S/C'}</div>;
              } else {
                entryNode = <div className="flex items-center gap-2 text-rose-500 font-bold truncate">{renderIcon(cat?.icon || '🏷️', "w-6 h-6")} {cat?.name}</div>;
                exitNode = <div className="flex items-center gap-2 text-slate-500 font-bold truncate">{renderIcon(srcAcc?.icon || '🏦', "w-6 h-6")} {srcAcc?.name}</div>;
              }

              return (
                  <div key={t.id} className="group bg-white p-4 lg:p-5 lg:px-10 rounded-[1.5rem] lg:rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-2xl hover:border-indigo-100 transition-all relative overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                      {/* Vista escritorio */}
                      <div className="hidden lg:grid grid-cols-[100px_180px_1fr_60px_180px_180px_100px] items-center gap-4 lg:gap-6">
                        <div className="text-[11px] font-black text-slate-400 uppercase tracking-tighter">{formatDateDisplay(t.date)}</div>
                        <div className="text-xs uppercase">{entryNode}</div>
                        <div className="text-sm font-black text-slate-800 truncate uppercase tracking-tight">{t.description}</div>
                        <div className="flex justify-center">
                            {t.attachment ? <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-lg shadow-indigo-100 cursor-pointer"><Link2 size={18} /></div> : <div className="text-slate-100 p-2.5"><Link2Off size={18} /></div>}
                        </div>
                        <div className="text-xs uppercase">{exitNode}</div>
                        <div className={`text-right text-xl font-black tracking-tighter ${getAmountColor(t.amount)}`}>{formatCurrency(t.amount)}</div>
                        <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEditor(t)} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all active:scale-90"><Edit3 size={18}/></button>
                            <button onClick={() => setDeleteConfirmId(t.id)} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-all active:scale-90"><Trash2 size={18}/></button>
                        </div>
                      </div>

                      {/* Confirmación de borrado */}
                      {deleteConfirmId === t.id && (
                        <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-[2.5rem] z-10 flex items-center justify-center gap-6 animate-in zoom-in-95 p-4 text-center">
                          <p className="text-xs font-black text-slate-900 uppercase tracking-widest">¿Borrar?</p>
                          <div className="flex gap-2">
                            <button onClick={() => { onDeleteTransaction(t.id); setDeleteConfirmId(null); }} className="bg-rose-600 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase shadow-xl active:scale-95">Eliminar</button>
                            <button onClick={() => setDeleteConfirmId(null)} className="bg-slate-100 text-slate-500 px-6 py-2 rounded-xl font-black text-[10px] uppercase">No</button>
                          </div>
                        </div>
                      )}
                  </div>
              );
          })}
          
          {sortedTransactions.length === 0 && (
            <div className="py-32 text-center space-y-6 bg-slate-50/50 rounded-[3rem] border-4 border-dashed border-slate-100">
                <div className="mx-auto bg-white p-8 w-24 h-24 rounded-full flex items-center justify-center text-slate-200 shadow-sm border border-slate-100"><Search size={48}/></div>
                <div className="space-y-1">
                  <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest">Sin coincidencias</p>
                  <p className="text-[10px] font-medium text-slate-300 uppercase tracking-widest">Ajusta los filtros para encontrar lo que buscas</p>
                </div>
                <button onClick={clearAllFilters} className="px-6 py-3 bg-indigo-50 text-indigo-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 transition-all">Limpiar filtros</button>
            </div>
          )}

          {/* PAGINACIÓN */}
          {sortedTransactions.length > 0 && itemsPerPage !== -1 && (
              <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-200 px-4 print:hidden">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{totalItems} Registros</div>
                  <div className="flex items-center gap-2">
                      <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-2 bg-white border border-slate-200 rounded-xl text-slate-500 disabled:opacity-30"><ChevronLeft size={16}/></button>
                      <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-600 min-w-[100px] text-center">Pág {currentPage} / {totalPages}</div>
                      <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="p-2 bg-white border border-slate-200 rounded-xl text-slate-500 disabled:opacity-30"><ChevronRight size={16}/></button>
                  </div>
                  <div className="flex items-center gap-3">
                        {[25, 50, -1].map(limit => (
                            <button key={limit} onClick={() => { setItemsPerPage(limit); setCurrentPage(1); }} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase ${itemsPerPage === limit ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500'}`}>{limit === -1 ? 'Todo' : limit}</button>
                        ))}
                  </div>
              </div>
          )}
      </div>

      {/* MODALES (Editor, etc) se mantienen... */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[200] p-4 animate-in fade-in duration-500">
            <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl p-8 sm:p-12 relative max-h-[95vh] overflow-y-auto custom-scrollbar border border-white/20">
                <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="absolute top-8 right-8 p-3 bg-slate-50 text-slate-400 rounded-full hover:text-rose-500 hover:bg-rose-50 transition-all"><X size={24}/></button>
                <div className="flex items-center gap-4 mb-10">
                    <div className="bg-indigo-600 p-4 rounded-3xl text-white shadow-xl shadow-indigo-600/20">< Receipt size={28} /></div>
                    <div>
                      <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">{editingTx ? 'Editar' : 'Nuevo'}</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Registro de Movimiento</p>
                    </div>
                </div>
                <div className="space-y-8">
                    <div className="bg-slate-100 p-2 rounded-[1.5rem] flex gap-2 shadow-inner">
                        {[
                          {id: 'EXPENSE', label: 'Gasto', color: 'rose'},
                          {id: 'INCOME', label: 'Ingreso', color: 'emerald'},
                          {id: 'TRANSFER', label: 'Traspaso', color: 'indigo'}
                        ].map(m => (
                          <button key={m.id} type="button" onClick={() => setFType(m.id as any)} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${fType === m.id ? `bg-white text-${m.color}-600 shadow-xl` : 'text-slate-400 hover:text-slate-600'}`}>{m.label}</button>
                        ))}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Importe (Sin signo)</label>
                          <div className="relative">
                            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 font-bold">€</span>
                            <span className={`absolute left-10 top-1/2 -translate-y-1/2 font-black text-xl ${(fType === 'EXPENSE' || fType === 'TRANSFER') ? 'text-rose-500' : 'text-emerald-500'}`}>
                                {(fType === 'EXPENSE' || fType === 'TRANSFER') ? '-' : '+'}
                            </span>
                            <input type="number" step="0.01" className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-3xl font-black outline-none focus:border-indigo-500 transition-all shadow-inner" value={fAmount} onChange={e => setFAmount(e.target.value)} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha Operación</label>
                          <input type="date" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all shadow-inner" value={fDate} onChange={e => setFDate(e.target.value)} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descripción / Concepto</label>
                        <input type="text" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all shadow-inner" placeholder="Escribe un concepto claro..." value={fDesc} onChange={e => setFDesc(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{fType === 'TRANSFER' ? 'Desde Cuenta' : 'Cuenta de Pago/Cobro'}</label>
                          <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all shadow-inner" value={fAcc} onChange={e => setFAcc(e.target.value)}>
                              {groupedLists.accounts.map(group => (
                                  <optgroup key={group.group.id} label={group.group.name}>
                                      {group.items.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                  </optgroup>
                              ))}
                          </select>
                        </div>
                        {fType === 'TRANSFER' ? (
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hacia Cuenta</label>
                            <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all shadow-inner" value={fTransferDest} onChange={e => setFTransferDest(e.target.value)}>
                                <option value="">Destino...</option>
                                {groupedLists.accounts.map(group => (
                                    <optgroup key={group.group.id} label={group.group.name}>
                                        {group.items.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </optgroup>
                                ))}
                            </select>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoría</label>
                            <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all shadow-inner" value={fCat} onChange={e => setFCat(e.target.value)}>
                                <option value="">Sin categoría...</option>
                                {groupedLists.categories.map(group => (
                                    <optgroup key={group.family.id} label={group.family.name}>
                                        {group.items.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </optgroup>
                                ))}
                            </select>
                          </div>
                        )}
                    </div>
                    <button onClick={handleSave} className="w-full py-7 bg-slate-950 text-white rounded-[2.5rem] font-black uppercase text-[12px] tracking-widest shadow-2xl hover:bg-indigo-600 transition-all active:scale-95 mt-10">
                      {editingTx ? 'Guardar Cambios' : 'Confirmar y Registrar'}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
