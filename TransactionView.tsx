
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { AppState, Transaction, TransactionType, GlobalFilter, FavoriteMovement } from './types';
import { Plus, Trash2, Search, ArrowRightLeft, X, Paperclip, ChevronLeft, ChevronRight, Edit3, ArrowUpDown, Link2, Link2Off, Tag, Receipt, CheckCircle2, Upload, SortAsc, SortDesc, FileDown, FileSpreadsheet, Heart, Bot, Check, AlertTriangle, RefreshCw, Filter, Eraser, Calendar } from 'lucide-react';
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
const numberFormatter = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const TransactionView: React.FC<TransactionViewProps> = ({ data, onAddTransaction, onDeleteTransaction, onUpdateTransaction, filter, onUpdateFilter, initialSpecificFilters, clearSpecificFilters }) => {
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

  const [showFavoritesMenu, setShowFavoritesMenu] = useState(false);
  const [colFilterEntry, setColFilterEntry] = useState('ALL');
  const [colFilterDesc, setColFilterDesc] = useState('');
  const [colFilterClip, setColFilterClip] = useState<'ALL' | 'YES' | 'NO'>('ALL');
  const [colFilterExit, setColFilterExit] = useState('ALL');
  const [colFilterAmountOp, setColFilterAmountOp] = useState<AmountOperator>('ALL');
  const [colFilterAmountVal1, setColFilterAmountVal1] = useState('');
  const [sortField, setSortField] = useState<SortField>('DATE');
  const [sortDirection, setSortDirection] = useState<SortDirection>('DESC');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const indices = useMemo(() => {
    const acc = new Map(data.accounts.map(a => [a.id, a]));
    const cat = new Map(data.categories.map(c => [c.id, c]));
    const fam = new Map(data.families.map(f => [f.id, f]));
    return { acc, cat, fam };
  }, [data.accounts, data.categories, data.families]);

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

  const timeFilteredList = useMemo(() => {
    const y = filter.referenceDate.getFullYear();
    const m = filter.referenceDate.getMonth();
    let start = '', end = '';
    if (filter.timeRange === 'MONTH') {
      start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      end = `${y}-${String(m + 1).padStart(2, '0')}-${new Date(y, m + 1, 0).getDate()}`;
    } else if (filter.timeRange === 'YEAR') {
      start = `${y}-01-01`; end = `${y}-12-31`;
    } else if (filter.timeRange === 'CUSTOM') {
      start = filter.customStart || '1900-01-01'; end = filter.customEnd || '2100-12-31';
    }
    return data.transactions.filter(t => filter.timeRange === 'ALL' || (t.date >= start && t.date <= end));
  }, [data.transactions, filter]);

  const activeFilterOptions = useMemo(() => {
    const activeEntryIds = new Set<string>(); const activeExitIds = new Set<string>();
    timeFilteredList.forEach(t => {
      if (t.type === 'EXPENSE') activeEntryIds.add(t.categoryId); else if (t.type === 'INCOME') activeEntryIds.add(t.accountId); else if (t.type === 'TRANSFER' && t.transferAccountId) activeEntryIds.add(t.transferAccountId);
      if (t.type === 'EXPENSE') activeExitIds.add(t.accountId); else if (t.type === 'INCOME') activeExitIds.add(t.categoryId); else if (t.type === 'TRANSFER') activeExitIds.add(t.accountId);
    });
    return { activeEntryIds, activeExitIds };
  }, [timeFilteredList]);

  const filteredList = useMemo(() => {
    const descPattern = colFilterDesc.trim().toLowerCase();
    const v1 = parseFloat(colFilterAmountVal1);
    return timeFilteredList.filter(t => {
      if (colFilterEntry !== 'ALL') {
        const isAcc = indices.acc.has(colFilterEntry);
        if (isAcc) { if (t.accountId !== colFilterEntry && t.transferAccountId !== colFilterEntry) return false; }
        else { if (t.categoryId !== colFilterEntry) return false; }
      }
      if (colFilterExit !== 'ALL') {
        const isAcc = indices.acc.has(colFilterExit);
        if (isAcc) { if (t.accountId !== colFilterExit && t.transferAccountId !== colFilterExit) return false; }
        else { if (t.categoryId !== colFilterExit) return false; }
      }
      if (descPattern && !t.description.toLowerCase().includes(descPattern)) return false;
      if (colFilterClip === 'YES' && !t.attachment) return false;
      if (colFilterClip === 'NO' && t.attachment) return false;
      if (colFilterAmountOp !== 'ALL' && !isNaN(v1)) {
        const val = Math.abs(t.amount);
        if (colFilterAmountOp === 'GT' && val <= v1) return false;
        if (colFilterAmountOp === 'LT' && val >= v1) return false;
        if (colFilterAmountOp === 'EQ' && Math.abs(val - v1) > 0.01) return false;
      }
      return true;
    });
  }, [timeFilteredList, colFilterEntry, colFilterExit, colFilterDesc, colFilterClip, colFilterAmountOp, colFilterAmountVal1, indices]);

  const sortedTransactions = useMemo(() => {
    return [...filteredList].sort((a, b) => {
      let vA: any, vB: any;
      if (sortField === 'DATE') { vA = a.date; vB = b.date; }
      else if (sortField === 'DESCRIPTION') { vA = a.description.toLowerCase(); vB = b.description.toLowerCase(); }
      else if (sortField === 'AMOUNT') { vA = Math.abs(a.amount); vB = Math.abs(b.amount); }
      else if (sortField === 'CATEGORY') { vA = (indices.cat.get(a.categoryId)?.name || '').toLowerCase(); vB = (indices.cat.get(b.categoryId)?.name || '').toLowerCase(); }
      else if (sortField === 'ACCOUNT') { vA = (indices.acc.get(a.accountId)?.name || '').toLowerCase(); vB = (indices.acc.get(b.accountId)?.name || '').toLowerCase(); }
      if (vA < vB) return sortDirection === 'ASC' ? -1 : 1;
      if (vA > vB) return sortDirection === 'ASC' ? 1 : -1;
      return 0;
    });
  }, [filteredList, sortField, sortDirection, indices]);

  // Fix: Define totalItems and totalPages used in the pagination section
  const totalItems = sortedTransactions.length;
  const totalPages = itemsPerPage === -1 ? 1 : Math.ceil(totalItems / itemsPerPage);

  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return itemsPerPage === -1 ? sortedTransactions : sortedTransactions.slice(start, start + itemsPerPage);
  }, [sortedTransactions, currentPage, itemsPerPage]);

  const activeFiltersChips = useMemo(() => {
    const chips: { id: string, label: string, onRemove: () => void }[] = [];
    if (colFilterEntry !== 'ALL') chips.push({ id: 'entry', label: `E/Cat: ${indices.acc.get(colFilterEntry)?.name || indices.cat.get(colFilterEntry)?.name}`, onRemove: () => setColFilterEntry('ALL') });
    if (colFilterExit !== 'ALL') chips.push({ id: 'exit', label: `Cuenta: ${indices.acc.get(colFilterExit)?.name || indices.cat.get(colFilterExit)?.name}`, onRemove: () => setColFilterExit('ALL') });
    if (colFilterDesc) chips.push({ id: 'desc', label: `Texto: "${colFilterDesc}"`, onRemove: () => setColFilterDesc('') });
    if (colFilterClip !== 'ALL') chips.push({ id: 'clip', label: `Clip: ${colFilterClip}`, onRemove: () => setColFilterClip('ALL') });
    if (colFilterAmountOp !== 'ALL') chips.push({ id: 'amount', label: `Imp: ${colFilterAmountOp}`, onRemove: () => setColFilterAmountOp('ALL') });
    return chips;
  }, [colFilterEntry, colFilterExit, colFilterDesc, colFilterClip, colFilterAmountOp, indices]);

  const clearAllFilters = () => { setColFilterEntry('ALL'); setColFilterDesc(''); setColFilterClip('ALL'); setColFilterExit('ALL'); setColFilterAmountOp('ALL'); setColFilterAmountVal1(''); };
  const resetForm = () => { setEditingTx(null); setFType('EXPENSE'); setFAmount(''); setFDesc(''); setFDate(new Date().toISOString().split('T')[0]); setFAcc(data.accounts[0]?.id || ''); setFCat(''); setFTransferDest(''); setFAttachment(undefined); };
  const openEditor = (t?: Transaction) => { if (t) { setEditingTx(t); setFType(t.type); setFAmount(Math.abs(t.amount).toString()); setFDesc(t.description); setFDate(t.date); setFAcc(t.accountId); setFCat(t.categoryId); setFTransferDest(t.transferAccountId || ''); setFAttachment(t.attachment); } else resetForm(); setIsModalOpen(true); };
  const handleSave = () => { if (!fAmount || !fDesc || !fAcc || (fType !== 'TRANSFER' && !fCat)) return; let amt = Math.abs(parseFloat(fAmount)); if (fType === 'EXPENSE' || fType === 'TRANSFER') amt = -amt; const cat = indices.cat.get(fCat); const tx: Transaction = { id: editingTx ? editingTx.id : generateId(), date: fDate, amount: amt, description: fDesc, accountId: fAcc, type: fType, categoryId: fCat, familyId: cat?.familyId || '', attachment: fAttachment, transferAccountId: fType === 'TRANSFER' ? fTransferDest : undefined }; if (editingTx) onUpdateTransaction(tx); else onAddTransaction(tx); setIsModalOpen(false); resetForm(); };

  const formatDateDisplay = (dateStr: string) => { if (!dateStr) return '--/--/--'; const [y, m, d] = dateStr.split('-'); return `${d}/${m}/${y.slice(-2)}`; };
  const formatCurrency = (amount: number) => `${numberFormatter.format(amount)} €`;
  const getAmountColor = (amount: number) => amount > 0 ? 'text-emerald-600' : amount < 0 ? 'text-rose-600' : 'text-slate-400';
  const renderIcon = (iconStr: string, className = "w-6 h-6") => { if (iconStr?.startsWith('http') || iconStr?.startsWith('data:image')) return <img src={iconStr} className={`${className} object-contain rounded-lg`} referrerPolicy="no-referrer" />; return <span className="text-sm">{iconStr || '📂'}</span>; }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="opacity-20" />;
    return sortDirection === 'ASC' ? <SortAsc size={12} className="text-indigo-600" /> : <SortDesc size={12} className="text-indigo-600" />;
  };

  return (
    <div className="space-y-6 md:space-y-10 pb-24 animate-in fade-in duration-500">
      {/* CABECERA PRINCIPAL */}
      <div className="flex flex-col xl:flex-row justify-between xl:items-end gap-8 print:hidden">
        <div className="space-y-4 text-center md:text-left w-full xl:w-auto">
          <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter">Diario.</h2>
          <div className="flex flex-col sm:flex-row items-center gap-3 justify-center md:justify-start">
            <div className="flex items-center gap-1">
              <button onClick={() => { const d = new Date(filter.referenceDate); d.setMonth(d.getMonth() - 1); onUpdateFilter({ ...filter, referenceDate: d }); }} className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm"><ChevronLeft size={20} /></button>
              <button onClick={() => { const d = new Date(filter.referenceDate); d.setMonth(d.getMonth() + 1); onUpdateFilter({ ...filter, referenceDate: d }); }} className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm"><ChevronRight size={20} /></button>
            </div>
            <div className="flex gap-2 items-center">
              {filter.timeRange === 'MONTH' && (
                <div className="flex gap-2">
                  <select className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs" value={filter.referenceDate.getFullYear()} onChange={e => { const d = new Date(filter.referenceDate); d.setFullYear(parseInt(e.target.value)); onUpdateFilter({...filter, referenceDate: d}); }}>
                    {Array.from({length: 10}, (_, i) => 2020 + i).map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <select className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs" value={filter.referenceDate.getMonth()} onChange={e => { const d = new Date(filter.referenceDate); d.setMonth(parseInt(e.target.value)); onUpdateFilter({...filter, referenceDate: d}); }}>
                    {["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"].map((m, i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowFavoritesMenu(!showFavoritesMenu)} className="bg-white text-indigo-600 border border-slate-200 px-4 py-2.5 rounded-xl font-black uppercase text-[10px] shadow-sm"><Heart size={16} /></button>
              <button onClick={() => openEditor()} className="bg-slate-950 text-white px-6 py-2.5 rounded-xl font-black uppercase text-[10px] shadow-lg"><Plus size={16} /> Nuevo</button>
            </div>
          </div>
        </div>
        <div className="bg-slate-100/80 p-1.5 rounded-2xl flex flex-wrap justify-center gap-1 shadow-inner border border-slate-200/50 w-full sm:w-fit">
          {['ALL', 'MONTH', 'YEAR', 'CUSTOM'].map(r => (
            <button key={r} onClick={() => onUpdateFilter({...filter, timeRange: r as any})} className={`flex-1 sm:flex-none px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${filter.timeRange === r ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>{r === 'ALL' ? 'Todo' : r === 'MONTH' ? 'Mes' : r === 'YEAR' ? 'Año' : 'Pers'}</button>
          ))}
        </div>
      </div>

      {/* BARRA DE FILTROS ACTIVA */}
      {activeFiltersChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 px-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
          <span className="text-[9px] font-black text-slate-400 uppercase mr-2 flex items-center gap-1"><Filter size={12}/> Filtros:</span>
          {activeFiltersChips.map(c => (
            <div key={c.id} className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
              <span className="text-[9px] font-black text-indigo-600 uppercase">{c.label}</span>
              <button onClick={c.onRemove} className="text-indigo-300 hover:text-rose-500"><X size={12}/></button>
            </div>
          ))}
          <button onClick={clearAllFilters} className="ml-auto text-rose-500 text-[9px] font-black uppercase flex items-center gap-1"><Eraser size={12}/> Limpiar</button>
        </div>
      )}

      {/* OPERATIVA DE FILTROS RESPONSIVA (CABECERA) */}
      <div className="bg-slate-50/50 p-4 lg:p-6 rounded-[2rem] lg:rounded-[2.5rem] border border-slate-100 shadow-sm grid grid-cols-2 md:grid-cols-4 lg:grid-cols-[100px_180px_1fr_60px_180px_180px_100px] gap-4 items-end">
        <div className="space-y-2">
          <button onClick={() => { if(sortField==='DATE') setSortDirection(sortDirection==='ASC'?'DESC':'ASC'); else setSortField('DATE'); }} className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1">Fecha <SortIcon field="DATE"/></button>
        </div>
        <div className="space-y-2">
          <span className="text-[9px] font-black text-slate-400 uppercase">E/Cat</span>
          <select className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none" value={colFilterEntry} onChange={e => setColFilterEntry(e.target.value)}>
            <option value="ALL">TODAS</option>
            <optgroup label="Categorías">{data.categories.filter(c => activeFilterOptions.activeEntryIds.has(c.id)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
            <optgroup label="Cuentas">{data.accounts.filter(a => activeFilterOptions.activeEntryIds.has(a.id)).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</optgroup>
          </select>
        </div>
        <div className="col-span-2 md:col-span-1 space-y-2">
          <span className="text-[9px] font-black text-slate-400 uppercase">Concepto</span>
          <input type="text" placeholder="Buscar..." className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none" value={colFilterDesc} onChange={e => setColFilterDesc(e.target.value)} />
        </div>
        <div className="hidden lg:block space-y-2">
          <span className="text-[9px] font-black text-slate-400 uppercase text-center block">Clip</span>
          <select className="w-full px-1 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none" value={colFilterClip} onChange={e => setColFilterClip(e.target.value as any)}><option value="ALL">...</option><option value="YES">SÍ</option><option value="NO">NO</option></select>
        </div>
        <div className="space-y-2">
          <span className="text-[9px] font-black text-slate-400 uppercase">Cuenta</span>
          <select className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none" value={colFilterExit} onChange={e => setColFilterExit(e.target.value)}>
            <option value="ALL">TODAS</option>
            <optgroup label="Cuentas">{data.accounts.filter(a => activeFilterOptions.activeExitIds.has(a.id)).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</optgroup>
            <optgroup label="Categorías">{data.categories.filter(c => activeFilterOptions.activeExitIds.has(c.id)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
          </select>
        </div>
        <div className="space-y-2">
          <button onClick={() => { if(sortField==='AMOUNT') setSortDirection(sortDirection==='ASC'?'DESC':'ASC'); else setSortField('AMOUNT'); }} className="text-[9px] font-black text-slate-400 uppercase flex items-center justify-end gap-1 w-full">Importe <SortIcon field="AMOUNT"/></button>
          <div className="flex gap-1">
            <select className="flex-1 px-1 py-2 bg-white border border-slate-200 rounded-xl text-[8px] font-black uppercase outline-none" value={colFilterAmountOp} onChange={e => setColFilterAmountOp(e.target.value as any)}><option value="ALL">...</option><option value="GT">{">"}</option><option value="LT">{"<"}</option></select>
            {colFilterAmountOp !== 'ALL' && <input type="number" className="w-16 px-2 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none" value={colFilterAmountVal1} onChange={e => setColFilterAmountVal1(e.target.value)} />}
          </div>
        </div>
        <div className="flex justify-center items-center pb-1 lg:pb-0">
          <button onClick={clearAllFilters} className="p-2 text-slate-300 hover:text-rose-500"><Eraser size={18}/></button>
        </div>
      </div>

      {/* LISTA DE MOVIMIENTOS RESPONSIVA */}
      <div className="space-y-3">
        {paginatedTransactions.map(t => {
          const srcAcc = indices.acc.get(t.accountId);
          const dstAcc = t.transferAccountId ? indices.acc.get(t.transferAccountId) : null;
          const cat = indices.cat.get(t.categoryId);
          let entryNode, exitNode;
          if (t.type === 'TRANSFER') {
            entryNode = <div onClick={() => setColFilterEntry(dstAcc?.id || 'ALL')} className="flex items-center gap-2 text-indigo-600 font-bold truncate cursor-pointer">{renderIcon(dstAcc?.icon || '🏦', "w-4 h-4")} {dstAcc?.name}</div>;
            exitNode = <div onClick={() => setColFilterExit(srcAcc?.id || 'ALL')} className="flex items-center gap-2 text-slate-500 font-bold truncate cursor-pointer">{renderIcon(srcAcc?.icon || '🏦', "w-4 h-4")} {srcAcc?.name}</div>;
          } else if (t.type === 'INCOME') {
            entryNode = <div onClick={() => setColFilterEntry(srcAcc?.id || 'ALL')} className="flex items-center gap-2 text-emerald-600 font-bold truncate cursor-pointer">{renderIcon(srcAcc?.icon || '🏦', "w-4 h-4")} {srcAcc?.name}</div>;
            exitNode = <div onClick={() => setColFilterExit(cat?.id || 'ALL')} className="flex items-center gap-2 text-slate-400 italic truncate cursor-pointer">{cat ? renderIcon(cat.icon, "w-3 h-3") : <Tag size={12}/>} {cat?.name || 'S/C'}</div>;
          } else {
            entryNode = <div onClick={() => setColFilterEntry(cat?.id || 'ALL')} className="flex items-center gap-2 text-rose-500 font-bold truncate cursor-pointer">{renderIcon(cat?.icon || '🏷️', "w-4 h-4")} {cat?.name}</div>;
            exitNode = <div onClick={() => setColFilterExit(srcAcc?.id || 'ALL')} className="flex items-center gap-2 text-slate-500 font-bold truncate cursor-pointer">{renderIcon(srcAcc?.icon || '🏦', "w-4 h-4")} {srcAcc?.name}</div>;
          }

          return (
            <div key={t.id} className="group bg-white p-4 lg:px-10 rounded-[1.5rem] lg:rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-xl transition-all relative overflow-hidden">
              {/* LAYOUT DE FILA DETALLADO (TABLET/MOBILE COMPACTO) */}
              <div className="grid grid-cols-[80px_1fr_100px] lg:grid-cols-[100px_180px_1fr_60px_180px_180px_100px] items-center gap-4 lg:gap-6">
                <div className="text-[10px] lg:text-[11px] font-black text-slate-400 uppercase tracking-tighter">{formatDateDisplay(t.date)}</div>
                
                <div className="flex flex-col lg:block min-w-0">
                  <div className="text-[10px] lg:text-xs uppercase">{entryNode}</div>
                  <div className="lg:hidden mt-1 flex items-center gap-2 min-w-0">
                    <span onClick={() => setColFilterDesc(t.description)} className="text-xs font-black text-slate-800 truncate uppercase cursor-pointer hover:text-indigo-600">{t.description}</span>
                    {t.attachment && <Paperclip size={10} className="text-indigo-400 flex-shrink-0"/>}
                  </div>
                  <div className="lg:hidden text-[10px] uppercase mt-0.5">{exitNode}</div>
                </div>

                <div className="hidden lg:block text-sm font-black text-slate-800 truncate uppercase tracking-tight cursor-pointer hover:text-indigo-600" onClick={() => setColFilterDesc(t.description)}>{t.description}</div>
                
                <div className="hidden lg:flex justify-center">
                  {t.attachment ? <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-lg"><Link2 size={18} /></div> : <div className="text-slate-100 p-2.5"><Link2Off size={18} /></div>}
                </div>

                <div className="hidden lg:block text-xs uppercase">{exitNode}</div>
                
                <div className={`text-right text-sm lg:text-xl font-black tracking-tighter ${getAmountColor(t.amount)}`}>
                  {formatCurrency(t.amount)}
                </div>

                <div className="flex justify-center gap-1 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditor(t)} className="p-2 lg:p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-indigo-50 hover:text-indigo-600"><Edit3 size={16}/></button>
                  <button onClick={() => setDeleteConfirmId(t.id)} className="p-2 lg:p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-rose-50 hover:text-rose-600"><Trash2 size={16}/></button>
                </div>
              </div>

              {deleteConfirmId === t.id && (
                <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-10 flex items-center justify-center gap-6 animate-in zoom-in-95 p-4 text-center">
                  <p className="text-[10px] font-black text-slate-900 uppercase">¿Borrar?</p>
                  <div className="flex gap-2">
                    <button onClick={() => { onDeleteTransaction(t.id); setDeleteConfirmId(null); }} className="bg-rose-600 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase shadow-xl">Eliminar</button>
                    <button onClick={() => setDeleteConfirmId(null)} className="bg-slate-100 text-slate-500 px-4 py-2 rounded-xl font-black text-[9px] uppercase">No</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        
        {sortedTransactions.length === 0 && (
          <div className="py-24 text-center space-y-4 bg-slate-50/50 rounded-[3rem] border-4 border-dashed border-slate-100">
            <div className="mx-auto bg-white p-6 w-16 h-16 rounded-full flex items-center justify-center text-slate-200 border border-slate-100"><Search size={32}/></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sin coincidencias</p>
            <button onClick={clearAllFilters} className="px-6 py-2 bg-indigo-50 text-indigo-500 rounded-xl font-black text-[9px] uppercase">Limpiar filtros</button>
          </div>
        )}

        {sortedTransactions.length > 0 && itemsPerPage !== -1 && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-8 pt-6 border-t border-slate-200 px-4">
            <div className="text-[9px] font-bold text-slate-400 uppercase">{totalItems} Registros</div>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-2 bg-white border border-slate-200 rounded-xl text-slate-500 disabled:opacity-30"><ChevronLeft size={16}/></button>
              <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase text-slate-600 min-w-[80px] text-center">Pág {currentPage} / {totalPages}</div>
              <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="p-2 bg-white border border-slate-200 rounded-xl text-slate-500 disabled:opacity-30"><ChevronRight size={16}/></button>
            </div>
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl shadow-inner">
              {[25, 50, -1].map(limit => (
                <button key={limit} onClick={() => { setItemsPerPage(limit); setCurrentPage(1); }} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${itemsPerPage === limit ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{limit === -1 ? 'Todo' : limit}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MODAL EDITOR */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[200] p-4 animate-in fade-in duration-500">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl p-8 sm:p-12 relative max-h-[95vh] overflow-y-auto custom-scrollbar border border-white/20">
            <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="absolute top-8 right-8 p-3 bg-slate-50 text-slate-400 rounded-full hover:text-rose-500"><X size={24}/></button>
            <div className="flex items-center gap-4 mb-10">
              <div className="bg-indigo-600 p-4 rounded-3xl text-white shadow-xl shadow-indigo-600/20"><Receipt size={28} /></div>
              <div><h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">{editingTx ? 'Editar' : 'Nuevo'}</h3><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Registro de Movimiento</p></div>
            </div>
            <div className="space-y-8">
              <div className="bg-slate-100 p-2 rounded-[1.5rem] flex gap-2">
                {['EXPENSE', 'INCOME', 'TRANSFER'].map(m => (
                  <button key={m} type="button" onClick={() => setFType(m as any)} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${fType === m ? `bg-white text-indigo-600 shadow-xl` : 'text-slate-400'}`}>{m === 'EXPENSE' ? 'Gasto' : m === 'INCOME' ? 'Ingreso' : 'Traspaso'}</button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Importe</label>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 font-bold">€</span>
                    <input type="number" step="0.01" className="w-full pl-10 pr-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-2xl font-black outline-none focus:border-indigo-500 transition-all shadow-inner" value={fAmount} onChange={e => setFAmount(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Fecha</label>
                  <input type="date" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500" value={fDate} onChange={e => setFDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Descripción</label>
                <input type="text" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500" placeholder="Ej: Compra mensual..." value={fDesc} onChange={e => setFDesc(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{fType === 'TRANSFER' ? 'Origen' : 'Cuenta'}</label>
                  <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={fAcc} onChange={e => setFAcc(e.target.value)}>
                    {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                {fType === 'TRANSFER' ? (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Destino</label>
                    <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={fTransferDest} onChange={e => setFTransferDest(e.target.value)}>
                      <option value="">Destino...</option>
                      {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Categoría</label>
                    <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={fCat} onChange={e => setFCat(e.target.value)}>
                      <option value="">Seleccionar...</option>
                      {data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 flex items-center gap-2"><Paperclip size={14} /> Adjunto</label>
                <div className="flex gap-3">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className={`flex-1 px-8 py-5 border-2 border-dashed rounded-3xl font-black text-[11px] uppercase transition-all flex items-center justify-center gap-3 ${fAttachment ? 'bg-indigo-50 border-indigo-300 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                    {fAttachment ? <CheckCircle2 size={18}/> : <Upload size={18}/>} {fAttachment ? 'Listo' : 'Subir'}
                  </button>
                  {fAttachment && <button type="button" onClick={() => setFAttachment(undefined)} className="p-5 bg-rose-50 text-rose-500 rounded-3xl active:scale-90"><X size={24}/></button>}
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={e => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = ev => setFAttachment(ev.target?.result as string); reader.readAsDataURL(file); }}} />
              </div>
              <button onClick={handleSave} className="w-full py-7 bg-slate-950 text-white rounded-[2.5rem] font-black uppercase text-[12px] tracking-widest shadow-2xl hover:bg-indigo-600 transition-all mt-10">Guardar Movimiento</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
