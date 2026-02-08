
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { AppState, Transaction, TransactionType, Family, Category, Account, GlobalFilter, TimeRange } from './types';
import { Plus, Trash2, Search, ArrowRightLeft, X, Sparkles, Paperclip, Filter, ChevronDown, MoreVertical, Repeat, Star, Edit3, AlertTriangle, Tag, ChevronLeft, ChevronRight, Copy, Save, Clock, FileSpreadsheet, Upload, Info, ShieldCheck, CheckCircle2, Eraser, ArrowUpDown } from 'lucide-react';
import { mapBankTransactions } from './services/geminiService';
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

type SortField = 'DATE' | 'DESCRIPTION' | 'AMOUNT';
type SortDirection = 'ASC' | 'DESC';

const generateId = () => Math.random().toString(36).substring(2, 15);

export const TransactionView: React.FC<TransactionViewProps> = ({ data, onAddTransaction, onDeleteTransaction, onUpdateTransaction, onUpdateData, filter, onUpdateFilter, initialSpecificFilters, clearSpecificFilters }) => {
  // Estados del Formulario (Editor)
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

  // Estados de Filtros de la Vista
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAccount, setFilterAccount] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [sortField, setSortField] = useState<SortField>('DATE');
  const [sortDirection, setSortDirection] = useState<SortDirection>('DESC');

  // Menús de acción y otros
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showSmartImport, setShowSmartImport] = useState(false);

  useEffect(() => {
    if (initialSpecificFilters) {
      if (initialSpecificFilters.filterCategory) setFilterCategory(initialSpecificFilters.filterCategory);
      if (clearSpecificFilters) clearSpecificFilters();
    }
  }, [initialSpecificFilters]);

  // RESET FORM
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

  // OPEN EDITOR
  const openEditor = (t?: Transaction) => {
    if (t) {
      setEditingTx(t);
      setFType(t.type);
      setFAmount(t.amount.toString());
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
    setActionMenuId(null);
  };

  const handleSave = () => {
    if (!fAmount || !fDesc || !fAcc || (fType !== 'TRANSFER' && !fCat)) {
      alert("Por favor completa los campos obligatorios.");
      return;
    }

    const finalTx: Transaction = {
      id: editingTx ? editingTx.id : generateId(),
      date: fDate,
      amount: parseFloat(fAmount),
      description: fDesc,
      accountId: fAcc,
      type: fType,
      categoryId: fCat,
      familyId: data.categories.find(c => c.id === fCat)?.familyId || '',
      attachment: fAttachment,
      transferAccountId: fType === 'TRANSFER' ? fTransferDest : undefined
    };

    if (editingTx) onUpdateTransaction(finalTx);
    else onAddTransaction(finalTx);
    setIsModalOpen(false);
    resetForm();
  };

  // FILTRADO Y ORDENACIÓN OPTIMIZADOS
  const filteredTransactions = useMemo(() => {
    let result = data.transactions.filter(t => {
      // Filtro Temporal
      const y = filter.referenceDate.getFullYear();
      const m = filter.referenceDate.getMonth();
      let start = ''; let end = '';
      if (filter.timeRange === 'MONTH') {
        start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
        end = `${y}-${String(m + 1).padStart(2, '0')}-${new Date(y, m + 1, 0).getDate()}`;
      } else if (filter.timeRange === 'QUARTER') {
        const q = Math.floor(m / 3);
        start = `${y}-${String(q * 3 + 1).padStart(2, '0')}-01`;
        end = `${y}-${String(q * 3 + 3).padStart(2, '0')}-${new Date(y, q * 3 + 3, 0).getDate()}`;
      } else if (filter.timeRange === 'YEAR') {
        start = `${y}-01-01`; end = `${y}-12-31`;
      } else if (filter.timeRange === 'CUSTOM') {
        start = filter.customStart; end = filter.customEnd;
      }
      
      if (filter.timeRange !== 'ALL' && (t.date < start || t.date > end)) return false;

      // Filtros específicos
      if (filterAccount !== 'ALL' && t.accountId !== filterAccount && t.transferAccountId !== filterAccount) return false;
      if (filterCategory !== 'ALL' && t.categoryId !== filterCategory) return false;
      if (searchTerm && !t.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (minAmount && t.amount < parseFloat(minAmount)) return false;
      if (maxAmount && t.amount > parseFloat(maxAmount)) return false;

      return true;
    });

    // Ordenación
    return result.sort((a, b) => {
      let valA: any; let valB: any;
      if (sortField === 'DATE') { valA = a.date; valB = b.date; }
      else if (sortField === 'DESCRIPTION') { valA = a.description.toLowerCase(); valB = b.description.toLowerCase(); }
      else { valA = a.amount; valB = b.amount; }

      if (valA < valB) return sortDirection === 'ASC' ? -1 : 1;
      if (valA > valB) return sortDirection === 'ASC' ? 1 : -1;
      return 0;
    });
  }, [data.transactions, filter, filterAccount, filterCategory, searchTerm, minAmount, maxAmount, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDirection(sortDirection === 'ASC' ? 'DESC' : 'ASC');
    else { setSortField(field); setSortDirection('DESC'); }
  };

  const getEntities = (t: Transaction) => {
    const acc = data.accounts.find(a => a.id === t.accountId);
    const cat = data.categories.find(c => c.id === t.categoryId);
    const dst = t.transferAccountId ? data.accounts.find(a => a.id === t.transferAccountId) : null;
    return { acc, cat, dst };
  };

  return (
    <div className="space-y-6 md:space-y-10 pb-24">
      {/* Cabecera y Filtro Temporal Sincronizado */}
      <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
        <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter">Diario.</h2>
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner overflow-x-auto w-full lg:w-auto">
          {['ALL', 'MONTH', 'QUARTER', 'YEAR', 'CUSTOM'].map(r => (
            <button key={r} onClick={() => onUpdateFilter({...filter, timeRange: r as any})} className={`flex-1 lg:flex-none px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${filter.timeRange === r ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>
              {r === 'ALL' ? 'Todo' : r === 'MONTH' ? 'Mes' : r === 'QUARTER' ? 'Trim' : r === 'YEAR' ? 'Año' : 'Pers'}
            </button>
          ))}
        </div>
        <button onClick={() => openEditor()} className="w-full lg:w-auto bg-slate-950 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] shadow-2xl hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 active:scale-95">
          <Plus size={20} /> Nuevo Movimiento
        </button>
      </div>

      {/* Panel de Filtros Dinámicos */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="relative group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500" size={18} />
                <input type="text" placeholder="Concepto..." className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500 font-bold text-sm outline-none transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
              <select className="px-5 py-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500 font-bold text-sm outline-none cursor-pointer" value={filterAccount} onChange={e => setFilterAccount(e.target.value)}>
                <option value="ALL">CUALQUIER CUENTA</option>
                {data.accounts.map(a => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
              </select>
              <select className="px-5 py-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500 font-bold text-sm outline-none cursor-pointer" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                <option value="ALL">CUALQUIER CATEGORÍA</option>
                {data.categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
              <div className="flex gap-2">
                <input type="number" placeholder="Min €" className="w-1/2 px-4 py-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500 font-bold text-sm outline-none" value={minAmount} onChange={e => setMinAmount(e.target.value)} />
                <input type="number" placeholder="Max €" className="w-1/2 px-4 py-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500 font-bold text-sm outline-none" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} />
              </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-50">
              <div className="flex items-center gap-6">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><ArrowUpDown size={14}/> Ordenar por:</span>
                <div className="flex gap-3">
                  {['DATE', 'DESCRIPTION', 'AMOUNT'].map(f => (
                    <button key={f} onClick={() => handleSort(f as SortField)} className={`text-[10px] font-black uppercase tracking-tighter px-4 py-2 rounded-lg transition-all ${sortField === f ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:bg-slate-100'}`}>
                      {f === 'DATE' ? 'Fecha' : f === 'DESCRIPTION' ? 'Concepto' : 'Importe'} {sortField === f && (sortDirection === 'ASC' ? '↑' : '↓')}
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-[10px] font-black text-indigo-500 uppercase">Mostrando {filteredTransactions.length} movimientos</div>
          </div>
      </div>

      {/* Listado de Movimientos (Adaptado a móviles) */}
      <div className="space-y-4">
          {filteredTransactions.map(t => {
              const { acc, cat, dst } = getEntities(t);
              const isExpense = t.type === 'EXPENSE';
              const isIncome = t.type === 'INCOME';
              return (
                  <div key={t.id} className="group bg-white p-4 md:p-6 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-xl hover:border-indigo-100 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 relative">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 shadow-sm text-2xl shrink-0">
                          {isExpense ? cat?.icon : acc?.icon}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.date}</p>
                          <h4 className="text-sm font-black text-slate-900 truncate uppercase">{t.description}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md uppercase tracking-tight">{acc?.name}</span>
                            {t.type === 'TRANSFER' && <><ArrowRightLeft size={10} className="text-slate-300"/><span className="text-[9px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md uppercase tracking-tight">{dst?.name}</span></>}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-none pt-3 md:pt-0">
                          <div className="text-right">
                            <p className={`text-xl font-black tracking-tighter ${isExpense ? 'text-rose-600' : isIncome ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {isExpense ? '-' : isIncome ? '+' : ''}{t.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                            </p>
                            {t.attachment && <span className="text-[8px] font-black text-indigo-500 uppercase flex items-center justify-end gap-1 mt-1"><Paperclip size={10}/> Con adjunto</span>}
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => openEditor(t)} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all"><Edit3 size={18}/></button>
                            <button onClick={() => { setDeleteConfirmId(t.id); }} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-all"><Trash2 size={18}/></button>
                          </div>
                      </div>

                      {deleteConfirmId === t.id && (
                        <div className="absolute inset-0 bg-white/95 rounded-[2rem] z-10 flex items-center justify-center gap-4 animate-in fade-in">
                          <p className="text-[10px] font-black text-slate-900 uppercase">¿Confirmas borrado?</p>
                          <div className="flex gap-2">
                            <button onClick={() => { onDeleteTransaction(t.id); setDeleteConfirmId(null); }} className="bg-rose-600 text-white px-5 py-2 rounded-xl font-black text-[10px] uppercase shadow-lg shadow-rose-200">Borrar</button>
                            <button onClick={() => setDeleteConfirmId(null)} className="bg-slate-100 text-slate-500 px-5 py-2 rounded-xl font-black text-[10px] uppercase">No</button>
                          </div>
                        </div>
                      )}
                  </div>
              );
          })}
      </div>

      {/* MODAL EDITOR DE MOVIMIENTO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg p-8 sm:p-12 relative max-h-[95vh] overflow-y-auto custom-scrollbar">
                <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="absolute top-8 right-8 p-3 bg-slate-50 text-slate-400 rounded-full hover:text-rose-500 hover:text-rose-600 transition-all"><X size={20}/></button>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase mb-8">{editingTx ? 'Actualizar Movimiento' : 'Nuevo Movimiento'}</h3>
                
                <div className="space-y-6">
                    <div className="bg-slate-100 p-1.5 rounded-2xl flex gap-1.5 shadow-inner">
                        {['EXPENSE', 'INCOME', 'TRANSFER'].map(m => (
                          <button key={m} type="button" onClick={() => setFType(m as any)} className={`flex-1 py-4 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${fType === m ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>
                            {m === 'EXPENSE' ? 'Gasto' : m === 'INCOME' ? 'Ingreso' : 'Traspaso'}
                          </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Importe (€)</label><input type="number" step="0.01" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xl font-black outline-none focus:border-indigo-500 transition-all" value={fAmount} onChange={e => setFAmount(e.target.value)} /></div>
                        <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha</label><input type="date" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={fDate} onChange={e => setFDate(e.target.value)} /></div>
                    </div>

                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descripción / Concepto</label><input type="text" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={fDesc} onChange={e => setFDesc(e.target.value)} /></div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{fType === 'TRANSFER' ? 'Cuenta Origen' : 'Cuenta'}</label><select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={fAcc} onChange={e => setFAcc(e.target.value)}>{data.accounts.map(a => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}</select></div>
                        {fType === 'TRANSFER' ? (
                          <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cuenta Destino</label><select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={fTransferDest} onChange={e => setFTransferDest(e.target.value)}><option value="">Seleccionar...</option>{data.accounts.map(a => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}</select></div>
                        ) : (
                          <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoría</label><select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={fCat} onChange={e => setFCat(e.target.value)}><option value="">Seleccionar...</option>{data.categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</select></div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Paperclip size={14} /> Comprobante (Imagen)</label>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => fileInputRef.current?.click()} className={`flex-1 px-6 py-4 border-2 border-dashed rounded-2xl font-black text-[10px] uppercase transition-all ${fAttachment ? 'bg-indigo-50 border-indigo-300 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-indigo-200'}`}>
                            {fAttachment ? 'Imagen Seleccionada' : 'Añadir Archivo'}
                          </button>
                          {fAttachment && <button type="button" onClick={() => setFAttachment(undefined)} className="p-4 bg-rose-50 text-rose-500 rounded-2xl border border-rose-100"><X size={18}/></button>}
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = ev => setFAttachment(ev.target?.result as string);
                            reader.readAsDataURL(file);
                          }
                        }} />
                    </div>

                    <button onClick={handleSave} className="w-full py-6 bg-slate-950 text-white rounded-[2rem] font-black uppercase text-[11px] shadow-2xl hover:bg-indigo-600 transition-all active:scale-95 mt-4">
                      {editingTx ? 'Guardar Cambios' : 'Confirmar Movimiento'}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
