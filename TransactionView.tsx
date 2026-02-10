
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { AppState, Transaction, TransactionType, GlobalFilter } from './types';
import { Plus, Trash2, Search, ArrowRightLeft, X, Paperclip, ChevronLeft, ChevronRight, Edit3, ArrowUpDown, Link2, Link2Off, Filter, Wallet, Tag, Receipt, CheckCircle2, Upload, SortAsc, SortDesc, FileDown, FileSpreadsheet, Printer } from 'lucide-react';
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

const generateId = () => Math.random().toString(36).substring(2, 15);

// Se utiliza 'de-DE' para forzar estrictamente el formato 1.000,00 (Punto miles, Coma decimales)
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

  // Column Specific Filters
  const [colFilterEntry, setColFilterEntry] = useState('ALL');
  const [colFilterDesc, setColFilterDesc] = useState('');
  const [colFilterClip, setColFilterClip] = useState<'ALL' | 'YES' | 'NO'>('ALL');
  const [colFilterExit, setColFilterExit] = useState('ALL');
  
  // Advanced Amount Filters
  const [colFilterAmountOp, setColFilterAmountOp] = useState<AmountOperator>('ALL');
  const [colFilterAmountVal1, setColFilterAmountVal1] = useState('');
  const [colFilterAmountVal2, setColFilterAmountVal2] = useState('');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('DATE');
  const [sortDirection, setSortDirection] = useState<SortDirection>('DESC');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // --- OPTIMIZACIÓN: INDEXACIÓN ---
  const { accMap, catMap, famMap } = useMemo(() => {
    return {
      accMap: new Map(data.accounts.map(a => [a.id, a])),
      catMap: new Map(data.categories.map(c => [c.id, c])),
      famMap: new Map(data.families.map(f => [f.id, f]))
    };
  }, [data.accounts, data.categories, data.families]);

  // Helper para formatear fecha dd/mm/aa
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '--/--/--';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year.slice(-2)}`;
  };

  // Helper para moneda
  const formatCurrency = (amount: number) => {
    return `${numberFormatter.format(amount)} €`;
  };

  const getAmountColor = (amount: number) => {
      if (amount > 0) return 'text-emerald-600';
      if (amount < 0) return 'text-rose-600';
      return 'text-slate-400';
  };

  useEffect(() => {
    if (initialSpecificFilters) {
      if (initialSpecificFilters.action === 'NEW' && initialSpecificFilters.categoryId) {
         resetForm();
         const cat = catMap.get(initialSpecificFilters.categoryId);
         const fam = cat ? famMap.get(cat.familyId) : null;
         
         setFCat(initialSpecificFilters.categoryId);
         // Auto-detectar tipo basado en la familia de la categoría
         if (fam) setFType(fam.type === 'INCOME' ? 'INCOME' : 'EXPENSE');
         
         setIsModalOpen(true);
      } 
      else {
          if (initialSpecificFilters.filterCategory) {
              setColFilterEntry(initialSpecificFilters.filterCategory);
          }
          if (initialSpecificFilters.filterAccount) {
              setColFilterExit(initialSpecificFilters.filterAccount);
          }
      }

      if (clearSpecificFilters) clearSpecificFilters();
    }
  }, [initialSpecificFilters, catMap, famMap]);

  const resetForm = () => {
    setEditingTx(null);
    setFType('EXPENSE');
    setFAmount('');
    setFDesc('');
    setFDate(new Date().toISOString().split('T')[0]);
    setFAcc(data.accounts[0]?.id || '');
    setFCat('');
    setFTransferDest('');
    setFAttachment(undefined);
  };

  const openEditor = (t?: Transaction) => {
    if (t) {
      setEditingTx(t);
      setFType(t.type);
      setFAmount(Math.abs(t.amount).toString()); // Al editar, mostramos valor absoluto para facilitar edición
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

  const handleTypeChange = (newType: TransactionType) => {
      setFType(newType);
      // No modificamos el valor del input al cambiar tipo, dejamos que handleSave gestione el signo
  };

  const handleSave = () => {
    if (!fAmount || !fDesc || !fAcc || (fType !== 'TRANSFER' && !fCat)) {
      alert("Faltan datos obligatorios."); return;
    }
    
    // Gestión inteligente del signo:
    // Si es Gasto o Traspaso -> Forzamos Negativo
    // Si es Ingreso -> Forzamos Positivo
    let rawAmount = parseFloat(fAmount);
    rawAmount = Math.abs(rawAmount);

    if (fType === 'EXPENSE' || fType === 'TRANSFER') {
        rawAmount = -rawAmount;
    } 
    
    const cat = catMap.get(fCat);
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

  const filteredTransactions = useMemo(() => {
    return data.transactions.filter(t => {
      // Time Range Filter
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
      if (filter.timeRange !== 'ALL' && (t.date < start || t.date > end)) return false;

      // Entry Filter
      if (colFilterEntry !== 'ALL') {
          if (t.categoryId !== colFilterEntry && t.transferAccountId !== colFilterEntry) return false;
      }

      // Description Wildcard Filter
      if (colFilterDesc && colFilterDesc.trim() !== '') {
          const pattern = colFilterDesc.trim();
          const hasWildcards = pattern.includes('*') || pattern.includes('?');
          if (hasWildcards) {
              let regexStr = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
              regexStr = regexStr.replace(/\\\*/g, '.*').replace(/\\\?/g, '.');
              const regex = new RegExp(`^${regexStr}$`, 'i');
              if (!regex.test(t.description)) return false;
          } else {
              if (!t.description.toLowerCase().includes(pattern.toLowerCase())) return false;
          }
      }
      
      // Clip Filter
      if (colFilterClip === 'YES' && !t.attachment) return false;
      if (colFilterClip === 'NO' && t.attachment) return false;

      // Exit Filter (Cuenta)
      if (colFilterExit !== 'ALL') {
         const isSource = t.accountId === colFilterExit;
         const isDest = t.type === 'TRANSFER' && t.transferAccountId === colFilterExit;
         if (!isSource && !isDest) return false;
      }

      // Amount Filter
      if (colFilterAmountOp !== 'ALL') {
          const val = t.amount;
          const v1 = parseFloat(colFilterAmountVal1);
          const v2 = parseFloat(colFilterAmountVal2);

          if (!isNaN(v1)) {
              if (colFilterAmountOp === 'GT' && val <= v1) return false;
              if (colFilterAmountOp === 'LT' && val >= v1) return false;
              if (colFilterAmountOp === 'EQ' && Math.abs(val - v1) > 0.01) return false;
              if (colFilterAmountOp === 'BETWEEN') {
                  if (isNaN(v2)) {
                      if (val < v1) return false;
                  } else {
                      if (val < v1 || val > v2) return false;
                  }
              }
          }
      }

      return true;
    }).sort((a, b) => {
      let vA: any, vB: any;
      if (sortField === 'DATE') { vA = a.date; vB = b.date; }
      else if (sortField === 'DESCRIPTION') { vA = a.description.toLowerCase(); vB = b.description.toLowerCase(); }
      else if (sortField === 'AMOUNT') { vA = a.amount; vB = b.amount; }
      else if (sortField === 'ACCOUNT') { 
          vA = accMap.get(a.accountId)?.name.toLowerCase() || ''; 
          vB = accMap.get(b.accountId)?.name.toLowerCase() || ''; 
      }
      else if (sortField === 'CATEGORY') { 
          const catA = catMap.get(a.categoryId)?.name.toLowerCase() || '';
          const catB = catMap.get(b.categoryId)?.name.toLowerCase() || '';
          vA = catA; vB = catB;
      }
      else if (sortField === 'ATTACHMENT') { vA = a.attachment ? 1 : 0; vB = b.attachment ? 1 : 0; }
      
      if (vA < vB) return sortDirection === 'ASC' ? -1 : 1;
      if (vA > vB) return sortDirection === 'ASC' ? 1 : -1;
      return 0;
    });
  }, [data.transactions, filter, colFilterEntry, colFilterDesc, colFilterClip, colFilterExit, colFilterAmountOp, colFilterAmountVal1, colFilterAmountVal2, sortField, sortDirection, accMap, catMap]);

  const handleSort = (field: SortField) => {
      if (sortField === field) {
          setSortDirection(sortDirection === 'ASC' ? 'DESC' : 'ASC');
      } else {
          setSortField(field);
          setSortDirection('DESC');
      }
  };

  const navigatePeriod = (direction: 'prev' | 'next') => {
    const newDate = new Date(filter.referenceDate);
    const step = direction === 'next' ? 1 : -1;
    if (filter.timeRange === 'MONTH') newDate.setMonth(newDate.getMonth() + step);
    else if (filter.timeRange === 'YEAR') newDate.setFullYear(newDate.getFullYear() + step);
    onUpdateFilter({ ...filter, referenceDate: newDate });
  };

  const handleExport = (type: 'CSV' | 'EXCEL') => {
      const exportData = filteredTransactions.map(t => {
          const srcAcc = accMap.get(t.accountId);
          const dstAcc = t.transferAccountId ? accMap.get(t.transferAccountId) : null;
          const cat = catMap.get(t.categoryId);
          const fam = cat ? famMap.get(cat.familyId) : null;

          return {
              Fecha: t.date,
              Tipo: t.type === 'EXPENSE' ? 'GASTO' : t.type === 'INCOME' ? 'INGRESO' : 'TRASPASO',
              Importe: t.amount,
              Concepto: t.description,
              Cuenta: srcAcc?.name || '---',
              'Cuenta Destino': dstAcc?.name || '',
              Categoria: cat?.name || '---',
              Familia: fam?.name || '---'
          };
      });

      if (type === 'EXCEL') {
          const ws = XLSX.utils.json_to_sheet(exportData);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Movimientos");
          XLSX.writeFile(wb, `contamiki_export_${new Date().toISOString().split('T')[0]}.xlsx`);
      } else if (type === 'CSV') {
          const ws = XLSX.utils.json_to_sheet(exportData);
          const csv = XLSX.utils.sheet_to_csv(ws);
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.setAttribute("href", url);
          link.setAttribute("download", `contamiki_export_${new Date().toISOString().split('T')[0]}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      }
  };

  const years = Array.from({length: new Date().getFullYear() - 2015 + 5}, (_, i) => 2015 + i);
  const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  const renderIcon = (iconStr: string, className = "w-10 h-10") => {
    if (iconStr?.startsWith('http') || iconStr?.startsWith('data:image')) return <img src={iconStr} className={`${className} object-contain rounded-lg`} referrerPolicy="no-referrer" />;
    return <span className="text-xl">{iconStr || '📂'}</span>;
  }

  const SortIcon = ({ field }: { field: SortField }) => {
      if (sortField !== field) return <ArrowUpDown size={12} className="opacity-20" />;
      return sortDirection === 'ASC' ? <SortAsc size={12} className="text-indigo-600" /> : <SortDesc size={12} className="text-indigo-600" />;
  };

  const clearAllFilters = () => {
    setColFilterEntry('ALL');
    setColFilterDesc('');
    setColFilterClip('ALL');
    setColFilterExit('ALL');
    setColFilterAmountOp('ALL');
    setColFilterAmountVal1('');
    setColFilterAmountVal2('');
  };

  return (
    <div className="space-y-6 md:space-y-10 pb-24">
      {/* Cabecera Superior */}
      <div className="flex flex-col xl:flex-row justify-between xl:items-end gap-8 print:hidden">
        <div className="space-y-4 text-center md:text-left">
            <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter">Diario.</h2>
            <div className="flex flex-col sm:flex-row items-center gap-3 justify-center md:justify-start">
                <div className="flex items-center gap-1">
                    <button onClick={() => navigatePeriod('prev')} className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm active:scale-90 transition-all"><ChevronLeft size={20} /></button>
                    <button onClick={() => navigatePeriod('next')} className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm active:scale-90 transition-all"><ChevronRight size={20} /></button>
                </div>
                
                {/* Inputs de Filtro Personalizado añadidos */}
                <div className="flex gap-2 items-center">
                    {filter.timeRange === 'CUSTOM' ? (
                        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                            <input 
                                type="date" 
                                className="px-2 py-1.5 rounded-lg text-xs font-bold outline-none text-slate-700 bg-transparent"
                                value={filter.customStart}
                                onChange={(e) => onUpdateFilter({...filter, customStart: e.target.value})}
                            />
                            <span className="text-slate-300 font-bold">-</span>
                            <input 
                                type="date" 
                                className="px-2 py-1.5 rounded-lg text-xs font-bold outline-none text-slate-700 bg-transparent"
                                value={filter.customEnd}
                                onChange={(e) => onUpdateFilter({...filter, customEnd: e.target.value})}
                            />
                        </div>
                    ) : (
                        <>
                            {filter.timeRange !== 'ALL' && (
                                <select className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-indigo-500 shadow-sm cursor-pointer" value={filter.referenceDate.getFullYear()} onChange={(e) => { const d = new Date(filter.referenceDate); d.setFullYear(parseInt(e.target.value)); onUpdateFilter({...filter, referenceDate: d}); }}>
                                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            )}
                            {filter.timeRange === 'MONTH' && (
                                <select className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-indigo-500 shadow-sm cursor-pointer" value={filter.referenceDate.getMonth()} onChange={(e) => { const d = new Date(filter.referenceDate); d.setMonth(parseInt(e.target.value)); onUpdateFilter({...filter, referenceDate: d}); }}>
                                    {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                                </select>
                            )}
                        </>
                    )}
                </div>

                <button onClick={() => openEditor()} className="sm:ml-4 bg-slate-950 text-white px-6 py-2.5 rounded-xl font-black uppercase text-[10px] shadow-lg hover:bg-indigo-600 transition-all flex items-center justify-center gap-2 active:scale-95">
                  <Plus size={16} /> Nuevo
                </button>
            </div>
        </div>
        <div className="flex flex-col items-end gap-2">
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
            <div className="flex gap-2">
                <button onClick={() => handleExport('EXCEL')} className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl font-bold text-[10px] hover:bg-emerald-100 transition-colors flex items-center gap-2"><FileSpreadsheet size={14}/> Excel</button>
                <button onClick={() => handleExport('CSV')} className="px-4 py-2 bg-slate-50 text-slate-600 rounded-xl font-bold text-[10px] hover:bg-slate-100 transition-colors flex items-center gap-2"><FileDown size={14}/> CSV</button>
            </div>
        </div>
      </div>

      <div className="space-y-4">
          <div className="hidden lg:grid grid-cols-[100px_180px_1fr_60px_180px_180px_100px] gap-4 px-10 py-6 items-start bg-white rounded-[2.5rem] border border-slate-100 shadow-sm print:hidden">
            <div className="space-y-3">
                <button onClick={() => handleSort('DATE')} className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors pt-2">
                    Fecha <SortIcon field="DATE" />
                </button>
            </div>
            
            <div className="space-y-3">
                <button onClick={() => handleSort('CATEGORY')} className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors">
                    Entrada/Cat <SortIcon field="CATEGORY" />
                </button>
                <select className="w-full px-2 py-2 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold outline-none cursor-pointer focus:border-indigo-300 transition-all" value={colFilterEntry} onChange={e => setColFilterEntry(e.target.value)}>
                    <option value="ALL">TODAS</option>
                    {data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    <optgroup label="Cuentas (Traspasos)">
                        {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </optgroup>
                </select>
            </div>

            <div className="space-y-3">
                <button onClick={() => handleSort('DESCRIPTION')} className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors">
                    Descripción <SortIcon field="DESCRIPTION" />
                </button>
                <div className="relative group">
                    <input 
                      type="text" 
                      placeholder="Ej: Sup* o Com?ra" 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold outline-none focus:border-indigo-300 transition-all placeholder:text-slate-300" 
                      value={colFilterDesc} 
                      onChange={e => setColFilterDesc(e.target.value)} 
                    />
                    {colFilterDesc && <button onClick={() => setColFilterDesc('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-rose-500"><X size={12} /></button>}
                </div>
            </div>

            <div className="space-y-3 flex flex-col items-center">
                <button onClick={() => handleSort('ATTACHMENT')} className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors">
                    Clip <SortIcon field="ATTACHMENT" />
                </button>
                <select className="w-full px-1 py-2 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-black outline-none cursor-pointer focus:border-indigo-300 transition-all" value={colFilterClip} onChange={e => setColFilterClip(e.target.value as any)}>
                    <option value="ALL">TODOS</option>
                    <option value="YES">SÍ</option>
                    <option value="NO">NO</option>
                </select>
            </div>

            <div className="space-y-3">
                <button onClick={() => handleSort('ACCOUNT')} className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors">
                    Cuenta <SortIcon field="ACCOUNT" />
                </button>
                <select className="w-full px-2 py-2 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold outline-none cursor-pointer focus:border-indigo-300 transition-all" value={colFilterExit} onChange={e => setColFilterExit(e.target.value)}>
                    <option value="ALL">TODAS</option>
                    {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
            </div>

            <div className="space-y-3">
                <button onClick={() => handleSort('AMOUNT')} className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors justify-end w-full">
                    Importe <SortIcon field="AMOUNT" />
                </button>
                <div className="space-y-1.5">
                    <select className="w-full px-2 py-2 bg-slate-50 border border-slate-100 rounded-lg text-[9px] font-black uppercase outline-none cursor-pointer focus:border-indigo-300 transition-all" value={colFilterAmountOp} onChange={e => setColFilterAmountOp(e.target.value as AmountOperator)}>
                        <option value="ALL">Todos</option>
                        <option value="GT">{"Mayor que (>)..."}</option>
                        <option value="LT">{"Menor que (<)..."}</option>
                        <option value="EQ">{"Igual a (=)..."}</option>
                        <option value="BETWEEN">{"Entre..."}</option>
                    </select>
                    {colFilterAmountOp !== 'ALL' && (
                        <div className={`grid gap-1 ${colFilterAmountOp === 'BETWEEN' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                            <input type="number" step="0.01" className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:border-indigo-500" placeholder="Val 1" value={colFilterAmountVal1} onChange={e => setColFilterAmountVal1(e.target.value)} />
                            {colFilterAmountOp === 'BETWEEN' && (
                                <input type="number" step="0.01" className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:border-indigo-500" placeholder="Val 2" value={colFilterAmountVal2} onChange={e => setColFilterAmountVal2(e.target.value)} />
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-col items-center justify-center pt-2 h-full">
                <button onClick={clearAllFilters} className="p-2 text-slate-300 hover:text-rose-500 transition-colors group/clear" title="Limpiar todos los filtros">
                    <X size={18} />
                </button>
            </div>
          </div>

          {filteredTransactions.map(t => {
              // Uso de Mapas para O(1)
              const srcAcc = accMap.get(t.accountId);
              const dstAcc = t.transferAccountId ? accMap.get(t.transferAccountId) : null;
              const cat = catMap.get(t.categoryId);
              
              let entryNode: React.ReactNode;
              let exitNode: React.ReactNode;

              if (t.type === 'TRANSFER') {
                entryNode = <div onClick={(e) => { e.stopPropagation(); setColFilterExit(dstAcc?.id || ''); }} className="flex items-center gap-2 text-indigo-600 font-bold truncate cursor-pointer hover:underline decoration-2 underline-offset-4 decoration-indigo-200" title="Filtrar por esta cuenta">{renderIcon(dstAcc?.icon || '🏦', "w-6 h-6")} {dstAcc?.name}</div>;
                exitNode = <div onClick={(e) => { e.stopPropagation(); setColFilterExit(srcAcc?.id || ''); }} className="flex items-center gap-2 text-slate-500 font-bold truncate cursor-pointer hover:underline decoration-2 underline-offset-4 decoration-slate-200" title="Filtrar por esta cuenta">{renderIcon(srcAcc?.icon || '🏦', "w-6 h-6")} {srcAcc?.name}</div>;
              } else if (t.type === 'INCOME') {
                entryNode = <div onClick={(e) => { e.stopPropagation(); setColFilterExit(srcAcc?.id || ''); }} className="flex items-center gap-2 text-emerald-600 font-bold truncate cursor-pointer hover:underline decoration-2 underline-offset-4 decoration-emerald-200" title="Filtrar por esta cuenta">{renderIcon(srcAcc?.icon || '🏦', "w-6 h-6")} {srcAcc?.name}</div>;
                exitNode = <div onClick={(e) => { e.stopPropagation(); setColFilterEntry(cat?.id || ''); }} className="flex items-center gap-2 text-slate-300 italic truncate cursor-pointer hover:text-emerald-500 transition-colors" title="Filtrar por esta categoría">{cat ? renderIcon(cat.icon, "w-5 h-5") : <Tag size={14}/>} {cat?.name || 'S/C'}</div>;
              } else {
                entryNode = <div onClick={(e) => { e.stopPropagation(); setColFilterEntry(cat?.id || ''); }} className="flex items-center gap-2 text-rose-500 font-bold truncate cursor-pointer hover:underline decoration-2 underline-offset-4 decoration-rose-200" title="Filtrar por esta categoría">{renderIcon(cat?.icon || '🏷️', "w-6 h-6")} {cat?.name}</div>;
                exitNode = <div onClick={(e) => { e.stopPropagation(); setColFilterExit(srcAcc?.id || ''); }} className="flex items-center gap-2 text-slate-500 font-bold truncate cursor-pointer hover:underline decoration-2 underline-offset-4 decoration-slate-200" title="Filtrar por esta cuenta">{renderIcon(srcAcc?.icon || '🏦', "w-6 h-6")} {srcAcc?.name}</div>;
              }

              return (
                  <div key={t.id} className="group bg-white p-4 lg:p-5 lg:px-10 rounded-[1.5rem] lg:rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-2xl hover:border-indigo-100 transition-all relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 print:border-b print:border-slate-200 print:rounded-none print:shadow-none">
                      
                      {/* Mobile View (Compact) */}
                      <div className="flex justify-between items-start lg:hidden">
                        <div className="flex-1 min-w-0 pr-3">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{formatDateDisplay(t.date)}</span>
                                {t.attachment && <Paperclip size={10} className="text-indigo-400" />}
                            </div>
                            <div className="font-black text-slate-800 text-xs truncate uppercase tracking-tight mb-1.5">{t.description}</div>
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] leading-none">
                                {t.type === 'TRANSFER' ? (
                                    <>
                                        <span onClick={(e) => { e.stopPropagation(); setColFilterExit(srcAcc?.id || ''); }} className="flex items-center gap-1 text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-[0.4rem] cursor-pointer active:scale-95">
                                            {renderIcon(srcAcc?.icon, "w-3 h-3")} <span className="truncate max-w-[80px]">{srcAcc?.name}</span>
                                        </span>
                                        <ArrowRightLeft size={10} className="text-slate-300" />
                                        <span onClick={(e) => { e.stopPropagation(); setColFilterExit(dstAcc?.id || ''); }} className="flex items-center gap-1 text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-[0.4rem] cursor-pointer active:scale-95">
                                            {renderIcon(dstAcc?.icon, "w-3 h-3")} <span className="truncate max-w-[80px]">{dstAcc?.name}</span>
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <span onClick={(e) => { e.stopPropagation(); setColFilterEntry(cat?.id || ''); }} className={`flex items-center gap-1 px-1.5 py-0.5 rounded-[0.4rem] cursor-pointer active:scale-95 ${t.type === 'EXPENSE' ? 'text-rose-600 bg-rose-50' : 'text-emerald-600 bg-emerald-50'}`}>
                                            {cat ? renderIcon(cat.icon, "w-3 h-3") : <Tag size={10}/>} 
                                            <span className="truncate max-w-[100px]">{cat?.name || 'S/C'}</span>
                                        </span>
                                        <span className="text-slate-300 text-[8px]">•</span>
                                        <span onClick={(e) => { e.stopPropagation(); setColFilterExit(srcAcc?.id || ''); }} className="text-slate-400 flex items-center gap-1 truncate max-w-[80px] cursor-pointer hover:text-indigo-500">
                                            {renderIcon(srcAcc?.icon, "w-3 h-3")} {srcAcc?.name}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                        
                        <div className="flex flex-col items-end gap-3">
                            <span className={`text-sm font-black tracking-tighter ${getAmountColor(t.amount)}`}>
                                {formatCurrency(t.amount)}
                            </span>
                            <div className="flex gap-1 print:hidden">
                                <button onClick={() => openEditor(t)} className="p-1.5 bg-slate-50 text-slate-400 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-all active:scale-90"><Edit3 size={14}/></button>
                                <button onClick={() => setDeleteConfirmId(t.id)} className="p-1.5 bg-slate-50 text-slate-400 rounded-lg hover:bg-rose-50 hover:text-rose-600 transition-all active:scale-90"><Trash2 size={14}/></button>
                            </div>
                        </div>
                      </div>

                      {/* Desktop View (Full Grid) */}
                      <div className="hidden lg:grid grid-cols-[100px_180px_1fr_60px_180px_180px_100px] items-center gap-4 lg:gap-6">
                        <div className="text-[11px] font-black text-slate-400 uppercase tracking-tighter">
                            {formatDateDisplay(t.date)}
                        </div>
                        <div className="text-xs uppercase">{entryNode}</div>
                        <div className="text-sm font-black text-slate-800 truncate uppercase tracking-tight">{t.description}</div>
                        <div className="flex justify-center print:hidden">
                            {t.attachment ? (
                                <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-lg shadow-indigo-100 group-hover:scale-110 transition-transform cursor-pointer" title="Ver adjunto">
                                    <Link2 size={18} />
                                </div>
                            ) : (
                                <div className="text-slate-100 p-2.5"><Link2Off size={18} /></div>
                            )}
                        </div>
                        <div className="text-xs uppercase">{exitNode}</div>
                        <div className={`text-right text-xl font-black tracking-tighter ${getAmountColor(t.amount)}`}>
                            {formatCurrency(t.amount)}
                        </div>
                        <div className="flex justify-center gap-1 print:hidden">
                            <button onClick={() => openEditor(t)} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all active:scale-90"><Edit3 size={18}/></button>
                            <button onClick={() => setDeleteConfirmId(t.id)} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-all active:scale-90"><Trash2 size={18}/></button>
                        </div>
                      </div>

                      {deleteConfirmId === t.id && (
                        <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-[1.5rem] lg:rounded-[2.5rem] z-10 flex flex-col lg:flex-row items-center justify-center gap-3 lg:gap-6 animate-in zoom-in-95 p-4 text-center print:hidden">
                          <p className="text-xs font-black text-slate-900 uppercase tracking-widest">¿Confirmar borrado definitivo?</p>
                          <div className="flex gap-2">
                            <button onClick={() => { onDeleteTransaction(t.id); setDeleteConfirmId(null); }} className="bg-rose-600 text-white px-4 py-2 lg:px-8 lg:py-3 rounded-xl font-black text-[10px] uppercase shadow-xl active:scale-95 transition-all">Eliminar</button>
                            <button onClick={() => setDeleteConfirmId(null)} className="bg-slate-100 text-slate-500 px-4 py-2 lg:px-8 lg:py-3 rounded-xl font-black text-[10px] uppercase active:scale-95 transition-all">Cancelar</button>
                          </div>
                        </div>
                      )}
                  </div>
              );
          })}
          
          {filteredTransactions.length === 0 && (
            <div className="py-32 text-center space-y-6 bg-slate-50/50 rounded-[3rem] border-4 border-dashed border-slate-100">
                <div className="mx-auto bg-white p-8 w-24 h-24 rounded-full flex items-center justify-center text-slate-200 shadow-sm border border-slate-100"><Search size={48}/></div>
                <div className="space-y-1">
                  <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest">Sin coincidencias</p>
                  <p className="text-[10px] font-medium text-slate-300 uppercase tracking-widest">Ajusta los filtros para encontrar lo que buscas</p>
                </div>
                <button onClick={clearAllFilters} className="px-6 py-3 bg-indigo-50 text-indigo-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 transition-all">Limpiar filtros</button>
            </div>
          )}
      </div>

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
                          <button key={m.id} type="button" onClick={() => handleTypeChange(m.id as any)} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${fType === m.id ? `bg-white text-${m.color}-600 shadow-xl` : 'text-slate-400 hover:text-slate-600'}`}>{m.label}</button>
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
                          <p className="text-[9px] text-slate-400 italic ml-2">El signo se asignará automáticamente según el tipo.</p>
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
                          <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all shadow-inner" value={fAcc} onChange={e => setFAcc(e.target.value)}>{data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                        </div>
                        {fType === 'TRANSFER' ? (
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hacia Cuenta</label>
                            <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all shadow-inner" value={fTransferDest} onChange={e => setFTransferDest(e.target.value)}><option value="">Destino...</option>{data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoría</label>
                            <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all shadow-inner" value={fCat} onChange={e => setFCat(e.target.value)}><option value="">Sin categoría...</option>{data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                          </div>
                        )}
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Paperclip size={14} /> Adjuntar Comprobante (Opcional)</label>
                        <div className="flex gap-3">
                          <button type="button" onClick={() => fileInputRef.current?.click()} className={`flex-1 px-8 py-5 border-2 border-dashed rounded-3xl font-black text-[11px] uppercase transition-all flex items-center justify-center gap-3 ${fAttachment ? 'bg-indigo-50 border-indigo-300 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-indigo-200'}`}>
                            {fAttachment ? <CheckCircle2 size={18}/> : <Upload size={18}/>}
                            {fAttachment ? 'Adjunto Preparado' : 'Subir Imagen / PDF'}
                          </button>
                          {fAttachment && <button type="button" onClick={() => setFAttachment(undefined)} className="p-5 bg-rose-50 text-rose-500 rounded-3xl border border-rose-100 shadow-sm active:scale-90 transition-all"><X size={24}/></button>}
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={e => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = ev => setFAttachment(ev.target?.result as string); reader.readAsDataURL(file); }}} />
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
