
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { AppState, Transaction, TransactionType, GlobalFilter } from './types';
import { Plus, Trash2, Search, ArrowRightLeft, X, Paperclip, ChevronLeft, ChevronRight, Edit3, ArrowUpDown, Filter, Link2, Link2Off } from 'lucide-react';

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

type SortField = 'DATE' | 'DESCRIPTION' | 'AMOUNT' | 'ACCOUNT' | 'CATEGORY';
type SortDirection = 'ASC' | 'DESC';

const generateId = () => Math.random().toString(36).substring(2, 15);

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

  // View Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAccount, setFilterAccount] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [sortField, setSortField] = useState<SortField>('DATE');
  const [sortDirection, setSortDirection] = useState<SortDirection>('DESC');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (initialSpecificFilters) {
      if (initialSpecificFilters.filterCategory) setFilterCategory(initialSpecificFilters.filterCategory);
      if (clearSpecificFilters) clearSpecificFilters();
    }
  }, [initialSpecificFilters]);

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
  };

  const handleSave = () => {
    if (!fAmount || !fDesc || !fAcc || (fType !== 'TRANSFER' && !fCat)) {
      alert("Faltan datos obligatorios."); return;
    }
    const finalTx: Transaction = {
      id: editingTx ? editingTx.id : generateId(),
      date: fDate,
      amount: Math.abs(parseFloat(fAmount)),
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

  const filteredTransactions = useMemo(() => {
    let res = data.transactions.filter(t => {
      // Sincronización Temporal Global
      const y = filter.referenceDate.getFullYear();
      const m = filter.referenceDate.getMonth();
      let start = ''; let end = '';
      if (filter.timeRange === 'MONTH') {
        start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
        end = `${y}-${String(m + 1).padStart(2, '0')}-${new Date(y, m + 1, 0).getDate()}`;
      } else if (filter.timeRange === 'QUARTER') {
        const q = Math.floor(m / 3);
        const startMonth = q * 3 + 1;
        const endMonth = q * 3 + 3;
        start = `${y}-${String(startMonth).padStart(2, '0')}-01`;
        end = `${y}-${String(endMonth).padStart(2, '0')}-${new Date(y, endMonth, 0).getDate()}`;
      } else if (filter.timeRange === 'YEAR') {
        start = `${y}-01-01`; end = `${y}-12-31`;
      } else if (filter.timeRange === 'CUSTOM') {
        start = filter.customStart || '1900-01-01';
        end = filter.customEnd || '2100-12-31';
      }
      
      if (filter.timeRange !== 'ALL' && (t.date < start || t.date > end)) return false;
      
      if (filterAccount !== 'ALL' && t.accountId !== filterAccount && t.transferAccountId !== filterAccount) return false;
      if (filterCategory !== 'ALL' && t.categoryId !== filterCategory) return false;
      if (searchTerm && !t.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (minAmount && t.amount < parseFloat(minAmount)) return false;
      if (maxAmount && t.amount > parseFloat(maxAmount)) return false;
      return true;
    });

    return res.sort((a, b) => {
      let vA: any, vB: any;
      if (sortField === 'DATE') { vA = a.date; vB = b.date; }
      else if (sortField === 'DESCRIPTION') { vA = a.description.toLowerCase(); vB = b.description.toLowerCase(); }
      else if (sortField === 'AMOUNT') { vA = a.amount; vB = b.amount; }
      else if (sortField === 'ACCOUNT') { vA = data.accounts.find(x=>x.id===a.accountId)?.name || ''; vB = data.accounts.find(x=>x.id===b.accountId)?.name || ''; }
      else if (sortField === 'CATEGORY') { vA = data.categories.find(x=>x.id===a.categoryId)?.name || ''; vB = data.categories.find(x=>x.id===b.categoryId)?.name || ''; }
      
      if (vA < vB) return sortDirection === 'ASC' ? -1 : 1;
      if (vA > vB) return sortDirection === 'ASC' ? 1 : -1;
      return 0;
    });
  }, [data.transactions, filter, filterAccount, filterCategory, searchTerm, minAmount, maxAmount, sortField, sortDirection, data.accounts, data.categories]);

  const renderIcon = (iconStr: string, className = "w-10 h-10") => {
    if (iconStr?.startsWith('http')) return <img src={iconStr} className={`${className} object-contain`} referrerPolicy="no-referrer" />;
    return <span className="text-xl">{iconStr || '📂'}</span>;
  }

  return (
    <div className="space-y-6 md:space-y-10 pb-24">
      <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
        <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter">Diario.</h2>
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner overflow-x-auto w-full lg:w-auto">
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

      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input type="text" placeholder="Concepto..." className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500 font-bold text-sm outline-none transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
              <select className="px-5 py-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500 font-bold text-sm outline-none cursor-pointer" value={filterAccount} onChange={e => setFilterAccount(e.target.value)}>
                <option value="ALL">CUENTA</option>
                {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <select className="px-5 py-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500 font-bold text-sm outline-none cursor-pointer" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                <option value="ALL">CATEGORÍA</option>
                {data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="flex gap-2">
                <input type="number" placeholder="Mín €" className="w-1/2 px-4 py-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500 font-bold text-sm outline-none" value={minAmount} onChange={e => setMinAmount(e.target.value)} />
                <input type="number" placeholder="Máx €" className="w-1/2 px-4 py-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500 font-bold text-sm outline-none" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} />
              </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-50">
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><ArrowUpDown size={14}/> Ordenar:</span>
                <div className="flex flex-wrap gap-2">
                  {['DATE', 'DESCRIPTION', 'AMOUNT', 'ACCOUNT', 'CATEGORY'].map(f => (
                    <button key={f} onClick={() => { if(sortField === f) setSortDirection(sortDirection === 'ASC' ? 'DESC' : 'ASC'); else { setSortField(f as SortField); setSortDirection('DESC'); }}} className={`text-[9px] font-black uppercase tracking-tighter px-4 py-2 rounded-lg transition-all ${sortField === f ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100'}`}>
                      {f === 'DATE' ? 'Fecha' : f === 'DESCRIPTION' ? 'Concepto' : f === 'AMOUNT' ? 'Importe' : f === 'ACCOUNT' ? 'Cuenta' : 'Cat'} {sortField === f && (sortDirection === 'ASC' ? '↑' : '↓')}
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-[10px] font-black text-indigo-500 uppercase">{filteredTransactions.length} registros</div>
          </div>
      </div>

      <div className="space-y-4">
          {/* Cabecera de tabla solo para escritorio */}
          <div className="hidden lg:grid grid-cols-[100px_160px_1fr_60px_160px_120px_100px] gap-4 px-10 py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
            <div>Fecha</div>
            <div>Entrada / Categoría</div>
            <div>Descripción</div>
            <div className="text-center">Adjunto</div>
            <div>Salida</div>
            <div className="text-right">Importe</div>
            <div className="text-center">Acciones</div>
          </div>

          {filteredTransactions.map(t => {
              const srcAcc = data.accounts.find(x=>x.id===t.accountId);
              const dstAcc = t.transferAccountId ? data.accounts.find(x=>x.id===t.transferAccountId) : null;
              const cat = data.categories.find(x=>x.id===t.categoryId);
              
              // Lógica de visualización:
              // GASTO: Entrada=Categoría, Salida=Cuenta
              // INGRESO: Entrada=Cuenta, Salida=Categoría (o vacío)
              // TRASPASO: Entrada=Cuenta Destino, Salida=Cuenta Origen
              
              let entryNode: React.ReactNode;
              let exitNode: React.ReactNode;

              if (t.type === 'TRANSFER') {
                entryNode = <div className="flex items-center gap-2 text-indigo-600 font-bold truncate">{renderIcon(dstAcc?.icon || '🏦', "w-6 h-6")} {dstAcc?.name}</div>;
                exitNode = <div className="flex items-center gap-2 text-slate-500 font-bold truncate">{renderIcon(srcAcc?.icon || '🏦', "w-6 h-6")} {srcAcc?.name}</div>;
              } else if (t.type === 'INCOME') {
                entryNode = <div className="flex items-center gap-2 text-emerald-600 font-bold truncate">{renderIcon(srcAcc?.icon || '🏦', "w-6 h-6")} {srcAcc?.name}</div>;
                exitNode = <div className="flex items-center gap-2 text-slate-400 italic truncate">{renderIcon(cat?.icon || '🏷️', "w-6 h-6")} {cat?.name}</div>;
              } else {
                entryNode = <div className="flex items-center gap-2 text-rose-600 font-bold truncate">{renderIcon(cat?.icon || '🏷️', "w-6 h-6")} {cat?.name}</div>;
                exitNode = <div className="flex items-center gap-2 text-slate-500 font-bold truncate">{renderIcon(srcAcc?.icon || '🏦', "w-6 h-6")} {srcAcc?.name}</div>;
              }

              return (
                  <div key={t.id} className="group bg-white p-5 lg:px-10 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-xl hover:border-indigo-100 transition-all relative overflow-hidden">
                      <div className="grid grid-cols-1 lg:grid-cols-[100px_160px_1fr_60px_160px_120px_100px] items-center gap-4 md:gap-6">
                        {/* Fecha */}
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{t.date}</div>
                        
                        {/* Entrada / Categoría */}
                        <div className="text-xs uppercase">{entryNode}</div>
                        
                        {/* Descripción */}
                        <div className="text-sm font-black text-slate-800 truncate uppercase">{t.description}</div>
                        
                        {/* Clip Adjunto */}
                        <div className="flex justify-center">
                            {t.attachment ? (
                                <div className="bg-indigo-600 text-white p-2 rounded-xl shadow-lg shadow-indigo-200">
                                    <Link2 size={16} />
                                </div>
                            ) : (
                                <div className="text-slate-200 p-2">
                                    <Link2Off size={16} />
                                </div>
                            )}
                        </div>

                        {/* Salida */}
                        <div className="text-xs uppercase">{exitNode}</div>

                        {/* Importe */}
                        <div className={`text-right text-lg font-black tracking-tighter ${t.type === 'EXPENSE' ? 'text-rose-600' : t.type === 'INCOME' ? 'text-emerald-600' : 'text-indigo-400'}`}>
                            {t.type === 'EXPENSE' ? '-' : t.type === 'INCOME' ? '+' : ''}
                            {t.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                        </div>

                        {/* Acciones */}
                        <div className="flex justify-center gap-1">
                            <button onClick={() => openEditor(t)} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all"><Edit3 size={16}/></button>
                            <button onClick={() => setDeleteConfirmId(t.id)} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-all"><Trash2 size={16}/></button>
                        </div>
                      </div>

                      {deleteConfirmId === t.id && (
                        <div className="absolute inset-0 bg-white/95 rounded-[2rem] z-10 flex items-center justify-center gap-4 animate-in fade-in">
                          <p className="text-xs font-black text-slate-900 uppercase">¿Borrar movimiento?</p>
                          <div className="flex gap-3">
                            <button onClick={() => { onDeleteTransaction(t.id); setDeleteConfirmId(null); }} className="bg-rose-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg shadow-rose-200">Borrar</button>
                            <button onClick={() => setDeleteConfirmId(null)} className="bg-slate-100 text-slate-500 px-6 py-3 rounded-xl font-black text-[10px] uppercase">No</button>
                          </div>
                        </div>
                      )}
                  </div>
              );
          })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg p-8 sm:p-12 relative max-h-[95vh] overflow-y-auto custom-scrollbar">
                <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="absolute top-8 right-8 p-3 bg-slate-50 text-slate-400 rounded-full hover:text-rose-500 transition-all"><X size={20}/></button>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase mb-8">{editingTx ? 'Editar Movimiento' : 'Nuevo Movimiento'}</h3>
                <div className="space-y-6">
                    <div className="bg-slate-100 p-1.5 rounded-2xl flex gap-1.5 shadow-inner">
                        {['EXPENSE', 'INCOME', 'TRANSFER'].map(m => (
                          <button key={m} type="button" onClick={() => setFType(m as any)} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${fType === m ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>{m === 'EXPENSE' ? 'Gasto' : m === 'INCOME' ? 'Ingreso' : 'Traspaso'}</button>
                        ))}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Importe</label><input type="number" step="0.01" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-2xl font-black outline-none focus:border-indigo-500 transition-all" value={fAmount} onChange={e => setFAmount(e.target.value)} /></div>
                        <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha</label><input type="date" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={fDate} onChange={e => setFDate(e.target.value)} /></div>
                    </div>
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descripción / Concepto</label><input type="text" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={fDesc} onChange={e => setFDesc(e.target.value)} /></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{fType === 'TRANSFER' ? 'Origen' : 'Cuenta'}</label><select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={fAcc} onChange={e => setFAcc(e.target.value)}>{data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                        {fType === 'TRANSFER' ? (
                          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Destino</label><select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={fTransferDest} onChange={e => setFTransferDest(e.target.value)}><option value="">Seleccionar...</option>{data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                        ) : (
                          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoría</label><select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={fCat} onChange={e => setFCat(e.target.value)}><option value="">Seleccionar...</option>{data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                        )}
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Paperclip size={14} /> Comprobante (Imagen)</label>
                        <div className="flex gap-3">
                          <button type="button" onClick={() => fileInputRef.current?.click()} className={`flex-1 px-6 py-4 border-2 border-dashed rounded-2xl font-black text-[10px] uppercase transition-all ${fAttachment ? 'bg-indigo-50 border-indigo-300 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-indigo-200'}`}>{fAttachment ? 'Archivo Añadido' : 'Subir Imagen'}</button>
                          {fAttachment && <button type="button" onClick={() => setFAttachment(undefined)} className="p-4 bg-rose-50 text-rose-500 rounded-2xl border border-rose-100 shadow-sm"><X size={20}/></button>}
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={e => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = ev => setFAttachment(ev.target?.result as string); reader.readAsDataURL(file); }}} />
                    </div>
                    <button onClick={handleSave} className="w-full py-6 bg-slate-950 text-white rounded-[2rem] font-black uppercase text-[11px] shadow-2xl hover:bg-indigo-600 transition-all active:scale-95 mt-6">{editingTx ? 'Guardar Cambios' : 'Confirmar Registro'}</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
