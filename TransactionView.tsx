
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { AppState, Transaction, TransactionType, GlobalFilter, Category, Account } from './types';
import { Plus, Trash2, Search, X, Paperclip, ChevronLeft, ChevronRight, Edit3, ArrowUpDown, Link2, Link2Off, Tag, Receipt, CheckCircle2, Upload, SortAsc, SortDesc, Heart, Bot, Check, Filter, Eraser, Sparkles, FileSpreadsheet } from 'lucide-react';
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
type AmountOperator = 'ALL' | 'GT' | 'LT' | 'EQ';

interface ProposedTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  categoryId: string;
  accountId: string;
  type: TransactionType;
  isValidated: boolean;
}

const generateId = () => Math.random().toString(36).substring(2, 15);
const numberFormatter = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const TransactionView: React.FC<TransactionViewProps> = ({ 
  data, onAddTransaction, onDeleteTransaction, onUpdateTransaction, onUpdateData, 
  filter, onUpdateFilter, initialSpecificFilters, clearSpecificFilters 
}) => {
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

  // SMART IMPORT
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStep, setImportStep] = useState<1 | 2 | 3>(1);
  const [importAccount, setImportAccount] = useState('');
  const [importRawText, setImportRawText] = useState('');
  const [proposedTransactions, setProposedTransactions] = useState<ProposedTransaction[]>([]);
  const importFileRef = useRef<HTMLInputElement>(null);

  // FILTROS Y ORDEN
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

  const indices = useMemo(() => ({
    acc: new Map(data.accounts.map(a => [a.id, a])),
    cat: new Map(data.categories.map(c => [c.id, c])),
    fam: new Map(data.families.map(f => [f.id, f]))
  }), [data]);

  useEffect(() => {
    if (initialSpecificFilters) {
      if (initialSpecificFilters.action === 'IMPORT') {
        setImportAccount(data.accounts[0]?.id || '');
        setImportStep(1); setIsImportModalOpen(true);
      } else if (initialSpecificFilters.action === 'NEW') {
        openEditor();
      }
      if (clearSpecificFilters) clearSpecificFilters();
    }
  }, [initialSpecificFilters]);

  // Lógica de Filtrado
  const filteredList = useMemo(() => {
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

    return data.transactions.filter(t => {
      if (filter.timeRange !== 'ALL' && (t.date < start || t.date > end)) return false;
      if (colFilterEntry !== 'ALL' && t.categoryId !== colFilterEntry && t.accountId !== colFilterEntry && t.transferAccountId !== colFilterEntry) return false;
      if (colFilterExit !== 'ALL' && t.accountId !== colFilterExit && t.categoryId !== colFilterExit) return false;
      if (colFilterDesc && !t.description.toLowerCase().includes(colFilterDesc.toLowerCase())) return false;
      if (colFilterClip === 'YES' && !t.attachment) return false;
      if (colFilterClip === 'NO' && t.attachment) return false;
      if (colFilterAmountOp !== 'ALL' && colFilterAmountVal1) {
          const val = Math.abs(t.amount);
          const limit = parseFloat(colFilterAmountVal1);
          if (colFilterAmountOp === 'GT' && val <= limit) return false;
          if (colFilterAmountOp === 'LT' && val >= limit) return false;
          if (colFilterAmountOp === 'EQ' && Math.abs(val - limit) > 0.01) return false;
      }
      return true;
    });
  }, [data.transactions, filter, colFilterEntry, colFilterExit, colFilterDesc, colFilterClip, colFilterAmountOp, colFilterAmountVal1]);

  const sortedTransactions = useMemo(() => {
    return [...filteredList].sort((a, b) => {
      let vA: any = a[sortField.toLowerCase() as keyof Transaction] || '';
      let vB: any = b[sortField.toLowerCase() as keyof Transaction] || '';
      if (sortField === 'AMOUNT') { vA = Math.abs(a.amount); vB = Math.abs(b.amount); }
      if (vA < vB) return sortDirection === 'ASC' ? -1 : 1;
      if (vA > vB) return sortDirection === 'ASC' ? 1 : -1;
      return 0;
    });
  }, [filteredList, sortField, sortDirection]);

  const totalItems = sortedTransactions.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedTransactions = useMemo(() => {
    if (itemsPerPage === -1) return sortedTransactions;
    return sortedTransactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [sortedTransactions, currentPage, itemsPerPage]);

  const clearAllFilters = () => { setColFilterEntry('ALL'); setColFilterExit('ALL'); setColFilterDesc(''); setColFilterClip('ALL'); setColFilterAmountOp('ALL'); setColFilterAmountVal1(''); };
  const resetForm = () => { setEditingTx(null); setFType('EXPENSE'); setFAmount(''); setFDesc(''); setFDate(new Date().toISOString().split('T')[0]); setFAcc(data.accounts[0]?.id || ''); setFCat(''); setFTransferDest(''); setFAttachment(undefined); };
  const openEditor = (t?: Transaction) => { if (t) { setEditingTx(t); setFType(t.type); setFAmount(Math.abs(t.amount).toString()); setFDesc(t.description); setFDate(t.date); setFAcc(t.accountId); setFCat(t.categoryId); setFTransferDest(t.transferAccountId || ''); setFAttachment(t.attachment); } else resetForm(); setIsModalOpen(true); };
  
  const handleSave = () => {
    if (!fAmount || !fDesc || !fAcc) return;
    let amt = Math.abs(parseFloat(fAmount)); if (fType !== 'INCOME') amt = -amt;
    const cat = indices.cat.get(fCat);
    const tx: Transaction = { id: editingTx ? editingTx.id : generateId(), date: fDate, amount: amt, description: fDesc, accountId: fAcc, type: fType, categoryId: fCat, familyId: cat?.familyId || '', attachment: fAttachment, transferAccountId: fType === 'TRANSFER' ? fTransferDest : undefined };
    if (editingTx) onUpdateTransaction(tx); else onAddTransaction(tx);
    setIsModalOpen(false); resetForm();
  };

  const findSuggestedCategory = (desc: string) => {
    const text = desc.toLowerCase();
    const match = data.transactions.find(t => t.description.toLowerCase().includes(text));
    return match ? match.categoryId : '';
  };

  const handleStartAnalysis = (raw: string) => {
    const lines = raw.split('\n').filter(l => l.trim());
    const props: ProposedTransaction[] = lines.map(line => {
      const parts = line.split(/[;\t,]/).map(p => p.trim());
      const amount = parseFloat(parts[parts.length - 1].replace(',', '.'));
      return { 
        id: generateId(), 
        date: parts[0], 
        description: parts[1], 
        amount, 
        accountId: importAccount, 
        categoryId: findSuggestedCategory(parts[1]), 
        type: (amount < 0 ? 'EXPENSE' : 'INCOME') as TransactionType, 
        isValidated: false 
      };
    }).filter(p => !isNaN(p.amount));
    setProposedTransactions(props); setImportStep(3);
  };

  const formatCurrency = (amount: number) => `${numberFormatter.format(amount)} €`;
  const getAmountColor = (amount: number) => amount > 0 ? 'text-emerald-600' : amount < 0 ? 'text-rose-600' : 'text-slate-400';
  const renderIcon = (icon: string, cls = "w-4 h-4") => icon?.startsWith('http') ? <img src={icon} className={`${cls} rounded-md`} /> : <span className="text-[10px]">{icon || '📂'}</span>;

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">
      {/* CABECERA PRINCIPAL */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter">Diario.</h2>
        <div className="flex items-center gap-2">
            <button onClick={() => setIsImportModalOpen(true)} className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100 transition-all shadow-sm active:scale-90"><Bot size={20}/></button>
            <button onClick={() => openEditor()} className="bg-slate-950 text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] shadow-xl flex items-center gap-2 active:scale-95 transition-transform"><Plus size={16}/> Nuevo</button>
        </div>
      </div>

      {/* CABECERA DE FILTROS - DISEÑO ASIENTO CONTABLE UNIFICADO - FECHA PRIMERA */}
      <div className="bg-slate-900/5 p-2 rounded-2xl border border-slate-100 grid grid-cols-[55px_75px_1fr_1.2fr_1fr_40px] md:grid-cols-[80px_110px_1fr_1.5fr_1fr_90px] gap-1 sm:gap-2 items-center">
          <div className="flex flex-col items-start px-1">
              <button onClick={() => { setSortField('DATE'); setSortDirection(sortDirection === 'ASC' ? 'DESC' : 'ASC'); }} className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest inline-flex items-center gap-0.5">Fec <ArrowUpDown size={8}/></button>
              <span className="h-4 md:h-6"></span>
          </div>
          <div className="flex flex-col px-1">
              <button onClick={() => { setSortField('AMOUNT'); setSortDirection(sortDirection === 'ASC' ? 'DESC' : 'ASC'); }} className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-0.5 md:gap-1">Imp <ArrowUpDown size={8}/></button>
              <select className="bg-white border border-slate-200 rounded-lg text-[8px] font-black uppercase py-0.5 md:py-1 outline-none" value={colFilterAmountOp} onChange={e => setColFilterAmountOp(e.target.value as any)}><option value="ALL">...</option><option value="GT">{">"}</option><option value="LT">{"<"}</option></select>
          </div>
          <div className="flex flex-col">
              <span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Debe</span>
              <select className="w-full bg-white border border-slate-200 rounded-lg text-[8px] md:text-[10px] font-bold py-0.5 md:py-1 outline-none" value={colFilterEntry} onChange={e => setColFilterEntry(e.target.value)}><option value="ALL">Todo</option>{data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </div>
          <div className="flex flex-col">
              <span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 text-center">Concepto</span>
              <input type="text" className="w-full bg-white border border-slate-200 rounded-lg text-[8px] md:text-[10px] font-bold py-0.5 md:py-1 px-1 md:px-2 outline-none" placeholder="..." value={colFilterDesc} onChange={e => setColFilterDesc(e.target.value)} />
          </div>
          <div className="flex flex-col">
              <span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Haber</span>
              <select className="w-full bg-white border border-slate-200 rounded-lg text-[8px] md:text-[10px] font-bold py-0.5 md:py-1 outline-none" value={colFilterExit} onChange={e => setColFilterExit(e.target.value)}><option value="ALL">Todo</option>{data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          </div>
          <div className="flex justify-center">
              <button onClick={clearAllFilters} className="text-slate-300 hover:text-rose-500 transition-colors p-1"><Eraser size={14}/></button>
          </div>
      </div>

      {/* LISTADO DE MOVIMIENTOS - FORMATO ASIENTO CONTABLE - FECHA PRIMERA */}
      <div className="space-y-1.5 md:space-y-2">
        {paginatedTransactions.map(t => {
          const srcAcc = indices.acc.get(t.accountId);
          const dstAcc = t.transferAccountId ? indices.acc.get(t.transferAccountId) : null;
          const cat = indices.cat.get(t.categoryId);
          
          let debitNode, creditNode;
          if (t.type === 'TRANSFER') {
            debitNode = <div className="flex items-center gap-0.5 md:gap-1 text-indigo-600 font-bold truncate leading-none">{renderIcon(dstAcc?.icon || '🏦', "w-3 h-3 md:w-4 md:h-4")} <span className="truncate">{dstAcc?.name}</span></div>;
            creditNode = <div className="flex items-center gap-0.5 md:gap-1 text-slate-500 font-bold truncate leading-none">{renderIcon(srcAcc?.icon || '🏦', "w-3 h-3 md:w-4 md:h-4")} <span className="truncate">{srcAcc?.name}</span></div>;
          } else if (t.type === 'INCOME') {
            debitNode = <div className="flex items-center gap-0.5 md:gap-1 text-emerald-600 font-bold truncate leading-none">{renderIcon(srcAcc?.icon || '🏦', "w-3 h-3 md:w-4 md:h-4")} <span className="truncate">{srcAcc?.name}</span></div>;
            creditNode = <div className="flex items-center gap-0.5 md:gap-1 text-slate-400 italic truncate leading-none">{renderIcon(cat?.icon || '🏷️', "w-2.5 h-2.5 md:w-3 md:h-3")} <span className="truncate">{cat?.name || 'S/C'}</span></div>;
          } else {
            debitNode = <div className="flex items-center gap-0.5 md:gap-1 text-rose-500 font-bold truncate leading-none">{renderIcon(cat?.icon || '🏷️', "w-3 h-3 md:w-4 md:h-4")} <span className="truncate">{cat?.name}</span></div>;
            creditNode = <div className="flex items-center gap-0.5 md:gap-1 text-slate-500 font-bold truncate leading-none">{renderIcon(srcAcc?.icon || '🏦', "w-3 h-3 md:w-4 md:h-4")} <span className="truncate">{srcAcc?.name}</span></div>;
          }

          return (
            <div key={t.id} className="group bg-white p-1.5 sm:p-2 md:px-5 rounded-xl md:rounded-2xl border border-slate-100 hover:shadow-lg transition-all relative overflow-hidden">
                <div className="grid grid-cols-[55px_75px_1fr_1.2fr_1fr_40px] md:grid-cols-[80px_110px_1fr_1.5fr_1fr_90px] gap-1 sm:gap-2 items-center">
                    {/* FECHA EXTREMO IZQUIERDO */}
                    <div className="text-left text-[8px] sm:text-[9px] md:text-[11px] font-black text-slate-400 uppercase leading-none truncate">
                        {t.date.split('-').reverse().join('/').slice(0, 5)}
                    </div>

                    {/* IMPORTE */}
                    <div className={`text-[10px] sm:text-[11px] md:text-sm font-black font-mono tracking-tighter truncate ${getAmountColor(t.amount)}`}>
                        {formatCurrency(t.amount)}
                    </div>

                    {/* DEBE (IZQ) */}
                    <div className="min-w-0 text-[9px] sm:text-[10px] md:text-xs">{debitNode}</div>

                    {/* CONCEPTO CENTRO */}
                    <div className="min-w-0 flex items-center gap-0.5 md:gap-1.5 overflow-hidden">
                        <span className="text-[9px] sm:text-[10px] md:text-xs font-bold text-slate-800 uppercase truncate leading-tight">{t.description}</span>
                        {t.attachment && <Paperclip size={10} className="text-indigo-400 flex-shrink-0 md:size-4"/>}
                    </div>

                    {/* HABER (DER) */}
                    <div className="min-w-0 text-[9px] sm:text-[10px] md:text-xs">{creditNode}</div>

                    {/* ACCIONES */}
                    <div className="flex justify-end gap-1 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEditor(t)} className="p-1 text-slate-400 hover:text-indigo-600 active:scale-90 transition-transform"><Edit3 size={14} className="md:size-5"/></button>
                        <button onClick={() => setDeleteConfirmId(t.id)} className="p-1 text-slate-400 hover:text-rose-500 active:scale-90 transition-transform"><Trash2 size={14} className="md:size-5"/></button>
                    </div>
                </div>

                {deleteConfirmId === t.id && (
                    <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-10 flex items-center justify-center gap-2 sm:gap-4 animate-in zoom-in-95">
                        <p className="text-[10px] font-black uppercase text-slate-900">¿Borrar?</p>
                        <button onClick={() => { onDeleteTransaction(t.id); setDeleteConfirmId(null); }} className="bg-rose-600 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase shadow-sm">SÍ</button>
                        <button onClick={() => setDeleteConfirmId(null)} className="bg-slate-100 text-slate-500 px-3 py-1 rounded-lg text-[10px] font-black uppercase">NO</button>
                    </div>
                )}
            </div>
          );
        })}
        {totalItems === 0 && (
            <div className="py-20 text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-200"><Search size={32}/></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sin apuntes en este periodo</p>
                <button onClick={clearAllFilters} className="text-indigo-600 text-[10px] font-black uppercase underline">Limpiar filtros</button>
            </div>
        )}
      </div>

      {/* PAGINACIÓN */}
      {totalItems > itemsPerPage && itemsPerPage !== -1 && (
          <div className="flex justify-between items-center bg-white p-3 md:p-4 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm">
              <span className="text-[9px] font-black text-slate-400 uppercase">{totalItems} REGISTROS</span>
              <div className="flex items-center gap-1 md:gap-2">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} className="p-1.5 md:p-2 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"><ChevronLeft size={16} /></button>
                  <span className="text-[10px] font-black min-w-[60px] text-center">PÁG {currentPage} / {totalPages}</span>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} className="p-1.5 md:p-2 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"><ChevronRight size={16} /></button>
              </div>
          </div>
      )}

      {/* MODALES SMART IMPORT */}
      {isImportModalOpen && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[300] flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white rounded-[2.5rem] md:rounded-[3rem] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-6 sm:p-10 md:p-12 border border-white/20 shadow-2xl">
                  <div className="flex justify-between items-center mb-6 md:mb-8 flex-none">
                      <div className="flex items-center gap-3 md:gap-4">
                          <div className="bg-indigo-600 p-2.5 md:p-3 rounded-2xl text-white shadow-lg shadow-indigo-600/20"><Bot size={20} className="md:size-6"/></div>
                          <h3 className="text-xl md:text-2xl font-black tracking-tighter uppercase">Smart Import</h3>
                      </div>
                      <button onClick={() => setIsImportModalOpen(false)} className="p-2 bg-slate-50 text-slate-400 rounded-full hover:bg-rose-50 hover:text-rose-500 transition-all"><X size={20}/></button>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                      {importStep === 1 && (
                          <div className="space-y-6">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Paso 1: Selecciona la cuenta destino</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                                  {data.accounts.map(acc => (
                                      <button key={acc.id} onClick={() => { setImportAccount(acc.id); setImportStep(2); }} className="p-5 md:p-6 bg-slate-50 border-2 border-transparent hover:border-indigo-500 hover:bg-indigo-50/30 rounded-[1.5rem] md:rounded-[2rem] text-left transition-all active:scale-95">
                                          {renderIcon(acc.icon, "w-8 h-8")}
                                          <p className="mt-4 font-black uppercase text-[11px] md:text-xs text-slate-900">{acc.name}</p>
                                      </button>
                                  ))}
                              </div>
                          </div>
                      )}

                      {importStep === 2 && (
                          <div className="space-y-6">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Paso 2: Pega el texto del extracto</p>
                              <textarea className="w-full h-64 p-5 md:p-6 bg-slate-50 rounded-[1.5rem] md:rounded-[2rem] font-mono text-[10px] md:text-xs border-2 border-slate-100 outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner" placeholder="Fecha; Concepto; Importe..." value={importRawText} onChange={e => setImportRawText(e.target.value)} />
                              <button onClick={() => handleStartAnalysis(importRawText)} className="w-full py-5 md:py-6 bg-indigo-600 text-white rounded-[1.5rem] md:rounded-[2rem] font-black uppercase text-[10px] md:text-[11px] tracking-widest shadow-xl shadow-indigo-600/20 active:scale-95 transition-all">Analizar Datos</button>
                              <button onClick={() => setImportStep(1)} className="w-full text-[9px] font-black uppercase text-slate-400 tracking-widest text-center hover:text-slate-600">Cambiar Cuenta</button>
                          </div>
                      )}

                      {importStep === 3 && (
                          <div className="space-y-3">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-4">Paso 3: Revisa la propuesta</p>
                              <div className="space-y-2">
                                  {proposedTransactions.map(p => (
                                      <div key={p.id} className={`grid grid-cols-[70px_1fr_1fr_80px_35px] gap-1 md:gap-2 bg-white p-2 md:p-3 rounded-xl md:rounded-2xl border border-slate-100 items-center transition-all ${p.isValidated ? 'opacity-40 grayscale' : 'hover:border-indigo-200 shadow-sm'}`}>
                                          <span className="text-[9px] md:text-[10px] font-bold text-slate-400 truncate">{p.date}</span>
                                          <span className="text-[9px] md:text-[10px] font-black uppercase truncate">{p.description}</span>
                                          <select className="bg-slate-50 rounded-lg text-[9px] md:text-[10px] font-bold py-1 px-1 md:px-2 border-none outline-none focus:ring-1 ring-indigo-200" value={p.categoryId} onChange={e => setProposedTransactions(prev => prev.map(x => x.id === p.id ? {...x, categoryId: e.target.value} : x))}>
                                              <option value="">¿Cat?</option>
                                              {data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                          </select>
                                          <span className={`text-right font-black text-[10px] md:text-xs truncate ${getAmountColor(p.amount)}`}>{formatCurrency(p.amount)}</span>
                                          <button onClick={() => setProposedTransactions(prev => prev.map(x => x.id === p.id ? {...x, isValidated: !x.isValidated} : x))} className={`p-1.5 md:p-2 rounded-lg transition-colors shadow-sm active:scale-90 ${p.isValidated ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-300 hover:text-indigo-600'}`}><Check size={14} className="md:size-5"/></button>
                                      </div>
                                  ))}
                              </div>
                              <div className="pt-8 sticky bottom-0 bg-white">
                                  <button onClick={() => { 
                                      const valid = proposedTransactions.filter(p => !p.isValidated);
                                      const newTxs: Transaction[] = valid.map(p => ({
                                          id: generateId(), date: p.date, amount: p.amount, description: p.description, accountId: p.accountId, type: p.type, categoryId: p.categoryId, familyId: indices.cat.get(p.categoryId)?.familyId || ''
                                      }));
                                      onUpdateData({ transactions: [...newTxs, ...data.transactions] });
                                      setIsImportModalOpen(false);
                                  }} className="w-full py-5 md:py-6 bg-slate-950 text-white rounded-[1.5rem] md:rounded-[2rem] font-black uppercase text-[10px] md:text-[11px] tracking-widest shadow-2xl active:scale-[0.98] transition-all">Confirmar Importación Masiva</button>
                                  <button onClick={() => setImportStep(2)} className="w-full mt-4 text-[9px] font-black uppercase text-slate-400 tracking-widest text-center hover:text-slate-600">Volver a pegar datos</button>
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* EDITOR MODAL */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[400] flex items-center justify-center p-4 animate-in zoom-in-95">
              <div className="bg-white rounded-[2.5rem] md:rounded-[3rem] w-full max-w-xl p-8 sm:p-10 md:p-12 relative max-h-[95vh] overflow-y-auto custom-scrollbar shadow-2xl border border-white/20">
                  <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 md:top-8 md:right-8 p-3 bg-slate-50 text-slate-400 rounded-full hover:bg-rose-50 hover:text-rose-500 transition-all"><X size={20} className="md:size-6"/></button>
                  <div className="flex items-center gap-4 mb-8 md:mb-10">
                      <div className="bg-indigo-600 p-3 md:p-4 rounded-2xl md:rounded-3xl text-white shadow-xl shadow-indigo-600/20"><Receipt size={24} className="md:size-7" /></div>
                      <div><h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">{editingTx ? 'Editar' : 'Nuevo'}</h3><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Asiento Diario</p></div>
                  </div>
                  <div className="space-y-6 md:space-y-8">
                      <div className="bg-slate-100 p-1.5 md:p-2 rounded-2xl flex gap-1.5 md:gap-2">
                          {['EXPENSE', 'INCOME', 'TRANSFER'].map(m => (
                              <button key={m} onClick={() => setFType(m as any)} className={`flex-1 py-3 md:py-4 text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${fType === m ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>{m === 'EXPENSE' ? 'Gasto' : m === 'INCOME' ? 'Ingreso' : 'Traspaso'}</button>
                          ))}
                      </div>
                      <div className="grid grid-cols-2 gap-4 md:gap-6">
                          <div className="space-y-1.5 md:space-y-2">
                              <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Importe</label>
                              <div className="relative">
                                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-black text-xs">€</span>
                                  <input type="number" step="0.01" className="w-full pl-8 pr-4 md:pl-10 md:pr-6 py-4 md:py-5 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl text-xl md:text-2xl font-black outline-none transition-all shadow-inner" value={fAmount} onChange={e => setFAmount(e.target.value)} />
                              </div>
                          </div>
                          <div className="space-y-1.5 md:space-y-2">
                              <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Fecha</label>
                              <input type="date" className="w-full px-4 md:px-6 py-4 md:py-5 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl font-bold text-sm md:text-base outline-none transition-all shadow-inner" value={fDate} onChange={e => setFDate(e.target.value)} />
                          </div>
                      </div>
                      <div className="space-y-1.5 md:space-y-2">
                          <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Descripción / Concepto</label>
                          <input type="text" className="w-full px-4 md:px-6 py-4 md:py-5 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl font-bold text-sm md:text-base outline-none transition-all shadow-inner" placeholder="Ej: Compra semanal..." value={fDesc} onChange={e => setFDesc(e.target.value)} />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                        <div className="space-y-1.5 md:space-y-2">
                            <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">{fType === 'TRANSFER' ? 'Origen (Haber)' : 'Cuenta (Haber)'}</label>
                            <select className="w-full px-4 md:px-6 py-4 md:py-5 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl font-bold text-sm md:text-base outline-none transition-all shadow-inner cursor-pointer" value={fAcc} onChange={e => setFAcc(e.target.value)}>{data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                        </div>
                        <div className="space-y-1.5 md:space-y-2">
                            <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">{fType === 'TRANSFER' ? 'Destino (Debe)' : 'Categoría (Debe)'}</label>
                            <select className="w-full px-4 md:px-6 py-4 md:py-5 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl font-bold text-sm md:text-base outline-none transition-all shadow-inner cursor-pointer" value={fType === 'TRANSFER' ? fTransferDest : fCat} onChange={e => fType === 'TRANSFER' ? setFTransferDest(e.target.value) : setFCat(e.target.value)}>
                                <option value="">Seleccionar...</option>
                                {fType === 'TRANSFER' ? data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>) : data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                      </div>
                      <div className="space-y-2">
                          <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest flex items-center gap-1.5"><Paperclip size={14}/> Adjunto / Comprobante</label>
                          <div className="flex gap-2">
                              <button type="button" onClick={() => fileInputRef.current?.click()} className={`flex-1 px-6 py-4 border-2 border-dashed rounded-2xl font-black text-[10px] uppercase transition-all flex items-center justify-center gap-2 ${fAttachment ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100 hover:border-slate-300'}`}>
                                  {fAttachment ? <CheckCircle2 size={16}/> : <Upload size={16}/>} {fAttachment ? 'Subido' : 'Subir Archivo'}
                              </button>
                              {fAttachment && <button onClick={() => setFAttachment(undefined)} className="p-4 bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-100 active:scale-90 transition-all"><X size={20}/></button>}
                          </div>
                          <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={e => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = ev => setFAttachment(ev.target?.result as string); reader.readAsDataURL(file); }}} />
                      </div>
                      <button onClick={handleSave} className="w-full py-6 md:py-7 bg-slate-950 text-white rounded-[2rem] md:rounded-[2.5rem] font-black uppercase text-xs md:text-[12px] tracking-widest shadow-2xl hover:bg-indigo-600 active:scale-[0.98] transition-all">Guardar Asiento Contable</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
