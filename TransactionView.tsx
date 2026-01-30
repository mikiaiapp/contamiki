
import React, { useState, useRef, useMemo } from 'react';
import { AppState, Transaction, TransactionType, Family, Category, Account, RecurrentMovement, FavoriteMovement, RecurrenceFrequency } from './types';
import { Plus, Trash2, Search, ArrowRightLeft, X, Loader2, Sparkles, Paperclip, FileText, Image as ImageIcon, Calendar, Filter, ChevronDown, MoreVertical, Repeat, Star, Edit3, CheckCircle2, AlertTriangle, Info, Tag, Clock, ArrowRight, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { searchInternetLogos } from './services/iconService';

interface TransactionViewProps {
  data: AppState;
  onAddTransaction: (t: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onUpdateTransaction: (t: Transaction) => void;
  onUpdateData: (newData: Partial<AppState>) => void;
}

type TimeRange = 'ALL' | 'MONTH' | 'QUARTER' | 'YEAR' | 'CUSTOM';
type SortField = 'DATE' | 'DEBE' | 'CONCEPTO' | 'HABER' | 'AMOUNT';
type SortDirection = 'ASC' | 'DESC';

export const TransactionView: React.FC<TransactionViewProps> = ({ data, onAddTransaction, onDeleteTransaction, onUpdateTransaction, onUpdateData }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFavModalOpen, setIsFavModalOpen] = useState(false);
  const [favSearch, setFavSearch] = useState('');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  
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

  // Menús de acción
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Estados Formulario
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [accountId, setAccountId] = useState(data.accounts[0]?.id || '');
  const [selectedCategoryId, setSelectedCategoryId] = useState(''); 
  const [transferDestId, setTransferDestId] = useState('');
  const [selectedBrandIcon, setSelectedBrandIcon] = useState<string | undefined>(undefined);
  const [attachment, setAttachment] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getTransactionEntities = (t: Transaction) => {
    const account = data.accounts.find(a => a.id === t.accountId);
    const category = data.categories.find(c => c.id === t.categoryId);
    const transferDest = t.transferAccountId ? data.accounts.find(a => a.id === t.transferAccountId) : null;
    
    const isIncome = t.type === 'INCOME';
    const isExpense = t.type === 'EXPENSE';

    let debe: { name: string, icon: string, label: string };
    let haber: { name: string, icon: string, label: string };

    if (isExpense) {
        debe = { name: category?.name || 'Gasto', icon: category?.icon || '📂', label: 'Aplicación' };
        haber = { name: account?.name || 'Cuenta', icon: account?.icon || '🏦', label: 'Origen' };
    } else if (isIncome) {
        debe = { name: account?.name || 'Cuenta', icon: account?.icon || '🏦', label: 'Destino' };
        haber = { name: category?.name || 'Ingreso', icon: category?.icon || '💰', label: 'Fuente' };
    } else {
        debe = { name: transferDest?.name || 'Destino', icon: transferDest?.icon || '🏦', label: 'Entrada' };
        haber = { name: account?.name || 'Origen', icon: account?.icon || '🏦', label: 'Salida' };
    }
    return { debe, haber };
  };

  const navigatePeriod = (direction: 'prev' | 'next') => {
    const newDate = new Date(referenceDate);
    const step = direction === 'next' ? 1 : -1;
    if (filterTime === 'MONTH') newDate.setMonth(newDate.getMonth() + step);
    else if (filterTime === 'QUARTER') newDate.setMonth(newDate.getMonth() + (step * 3));
    else if (filterTime === 'YEAR') newDate.setFullYear(newDate.getFullYear() + step);
    setReferenceDate(newDate);
  };

  const dateFilter = useMemo(() => {
    if (filterTime === 'ALL') return null;

    let start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
    let end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);

    if (filterTime === 'QUARTER') {
      const quarter = Math.floor(referenceDate.getMonth() / 3);
      start = new Date(referenceDate.getFullYear(), quarter * 3, 1);
      end = new Date(referenceDate.getFullYear(), quarter * 3 + 3, 0);
    } else if (filterTime === 'YEAR') {
      start = new Date(referenceDate.getFullYear(), 0, 1);
      end = new Date(referenceDate.getFullYear(), 11, 31);
    } else if (filterTime === 'CUSTOM' && customStart && customEnd) {
      start = new Date(customStart);
      start.setHours(0,0,0,0);
      end = new Date(customEnd);
      end.setHours(23,59,59,999);
    }
    return { start, end };
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

      if (dateFilter) {
        const tDate = new Date(t.date);
        if (tDate < dateFilter.start || tDate > dateFilter.end) return false;
      }
      return true;
    });

    result.sort((a, b) => {
        let valA: any; let valB: any;
        switch(sortField) {
            case 'DATE': valA = new Date(a.date).getTime(); valB = new Date(b.date).getTime(); break;
            case 'AMOUNT': valA = a.amount; valB = b.amount; break;
            case 'CONCEPTO': valA = a.description.toLowerCase(); valB = b.description.toLowerCase(); break;
            case 'DEBE': valA = getTransactionEntities(a).debe.name.toLowerCase(); valB = getTransactionEntities(b).debe.name.toLowerCase(); break;
            case 'HABER': valA = getTransactionEntities(a).haber.name.toLowerCase(); valB = getTransactionEntities(b).haber.name.toLowerCase(); break;
            default: valA = a.date; valB = b.date;
        }
        if (valA < valB) return sortDirection === 'ASC' ? -1 : 1;
        if (valA > valB) return sortDirection === 'ASC' ? 1 : -1;
        return 0;
    });
    return result;
  }, [data.transactions, searchTerm, filterTime, dateFilter, filterFamily, filterCategory, filterAccount, sortField, sortDirection]);

  const resetForm = () => {
      setAmount(''); setDescription(''); setDate(new Date().toISOString().split('T')[0]);
      setSelectedCategoryId(''); setTransferDestId('');
      setSelectedBrandIcon(undefined); setAttachment(undefined);
      setEditingTx(null); setActionMenuId(null);
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
    setEditingTx(t);
    setType(t.type);
    setAmount(t.amount.toString());
    setDescription(t.description);
    setDate(t.date);
    setAccountId(t.accountId);
    setSelectedCategoryId(t.categoryId);
    setTransferDestId(t.transferAccountId || '');
    setSelectedBrandIcon(t.brandIcon);
    setAttachment(t.attachment);
    setIsModalOpen(true);
    setActionMenuId(null);
  };

  const handleSort = (field: SortField) => {
      if (sortField === field) {
          setSortDirection(sortDirection === 'ASC' ? 'DESC' : 'ASC');
      } else {
          setSortField(field);
          setSortDirection('DESC');
      }
  };

  const renderIcon = (iconStr: string, className = "w-10 h-10") => {
      const safeIcon = iconStr || '📂';
      if (safeIcon.startsWith('data:image') || safeIcon.startsWith('http')) {
          return <img src={safeIcon} alt="icon" className={`${className} object-contain`} />;
      }
      return <span className={`text-xl`}>{safeIcon}</span>;
  }

  const availableCategories = useMemo(() => {
    return data.families
        .filter(f => f.type === (type === 'INCOME' ? 'INCOME' : 'EXPENSE'))
        .map(f => ({
            family: f,
            categories: data.categories.filter(c => c.familyId === f.id)
        }));
  }, [data.families, data.categories, type]);

  // Fix: changed size(14) to size={14} on lines 205 and 206 to correctly pass props in JSX
  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown size={14} className="opacity-0 group-hover:opacity-30 ml-1" />;
    return sortDirection === 'ASC' ? <ChevronUp size={14} className="ml-1 text-indigo-500" /> : <ChevronDown size={14} className="ml-1 text-indigo-500" />;
  };

  const years = Array.from({length: 10}, (_, i) => new Date().getFullYear() - 5 + i);
  const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  const activeFilters = useMemo(() => {
    const filters = [];
    if (filterAccount !== 'ALL') {
      const acc = data.accounts.find(a => a.id === filterAccount);
      if (acc) filters.push({ id: 'account', label: acc.name, icon: acc.icon, type: 'ACCOUNT' });
    }
    if (filterFamily !== 'ALL') {
      const fam = data.families.find(f => f.id === filterFamily);
      if (fam) filters.push({ id: 'family', label: fam.name, icon: fam.icon, type: 'FAMILY' });
    }
    if (filterCategory !== 'ALL') {
      const cat = data.categories.find(c => c.id === filterCategory);
      if (cat) filters.push({ id: 'category', label: cat.name, icon: cat.icon, type: 'CATEGORY' });
    }
    if (searchTerm) {
      filters.push({ id: 'search', label: `"${searchTerm}"`, icon: '🔍', type: 'SEARCH' });
    }
    return filters;
  }, [filterAccount, filterFamily, filterCategory, searchTerm, data]);

  const clearFilter = (type: string) => {
    if (type === 'ACCOUNT') setFilterAccount('ALL');
    if (type === 'FAMILY') { setFilterFamily('ALL'); setFilterCategory('ALL'); }
    if (type === 'CATEGORY') setFilterCategory('ALL');
    if (type === 'SEARCH') setSearchTerm('');
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setFilterTime('ALL');
    setFilterAccount('ALL');
    setFilterFamily('ALL');
    setFilterCategory('ALL');
    setCustomStart('');
    setCustomEnd('');
    setReferenceDate(new Date());
  };

  return (
    <div className="space-y-8 md:space-y-12">
      {/* CABECERA */}
      <div className="flex flex-col xl:flex-row justify-between items-center xl:items-end gap-6">
        <div className="space-y-2 text-center md:text-left">
            <p className="text-indigo-600 font-black uppercase tracking-[0.4em] text-[10px]">Libro Diario</p>
            <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter leading-none">Movimientos.</h2>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 w-full xl:w-auto">
            <button 
                onClick={() => setIsFavModalOpen(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-4 bg-amber-50 text-amber-600 border border-amber-100 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-100 transition-all active:scale-95"
            >
                <Star size={16} fill="currentColor" /> Mis Favoritos
            </button>
            <button 
                onClick={() => { resetForm(); setType('EXPENSE'); setIsModalOpen(true); }}
                className="flex-1 sm:flex-none bg-slate-950 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 active:scale-95"
            >
                <Plus size={18} /> Nuevo Movimiento
            </button>
        </div>
      </div>

      {/* FILTROS REDISEÑADOS */}
      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
          {/* Fila 1: Buscador */}
          <div className="relative group w-full">
              <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors">
                  <Search size={22} />
              </div>
              <input 
                  type="text" 
                  placeholder="Buscar descripción, concepto o categoría..." 
                  className="w-full pl-16 pr-6 py-5 bg-slate-50 border-2 border-transparent rounded-[1.5rem] focus:outline-none focus:bg-white focus:border-indigo-500 text-sm font-bold tracking-tight transition-all shadow-inner"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
              />
          </div>
          
          {/* Fila 2: Controles temporales y navegación */}
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6 pt-2 border-t border-slate-50">
              <div className="flex bg-slate-100/80 p-1 rounded-xl shadow-inner border border-slate-200/50 w-full lg:w-auto overflow-x-auto scrollbar-hide">
                  {['ALL', 'MONTH', 'QUARTER', 'YEAR', 'CUSTOM'].map((range) => (
                      <button 
                          key={range}
                          onClick={() => { setFilterTime(range as any); if(range !== 'CUSTOM') setReferenceDate(new Date()); }}
                          className={`flex-1 lg:flex-none px-5 py-3 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${filterTime === range ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                          {range === 'ALL' ? 'Todo' : range === 'MONTH' ? 'Mes' : range === 'QUARTER' ? 'Trim' : range === 'YEAR' ? 'Año' : 'Pers'}
                      </button>
                  ))}
              </div>

              <div className="flex items-center gap-4 w-full lg:w-auto justify-center">
                  {filterTime !== 'ALL' && filterTime !== 'CUSTOM' && (
                      <div className="flex items-center gap-2">
                          <button onClick={() => navigatePeriod('prev')} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm active:scale-90"><ChevronLeft size={18} /></button>
                          <button onClick={() => navigatePeriod('next')} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm active:scale-90"><ChevronRight size={18} /></button>
                      </div>
                  )}
                  
                  <div className="flex items-center gap-2">
                      {filterTime !== 'ALL' && filterTime !== 'CUSTOM' && (
                          <select 
                              className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-black text-[10px] outline-none focus:border-indigo-500 cursor-pointer uppercase shadow-sm"
                              value={referenceDate.getFullYear()}
                              onChange={(e) => { const d = new Date(referenceDate); d.setFullYear(parseInt(e.target.value)); setReferenceDate(d); }}
                          >
                              {years.map(y => <option key={y} value={y}>{y}</option>)}
                          </select>
                      )}

                      {filterTime === 'MONTH' && (
                          <select 
                              className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-black text-[10px] outline-none focus:border-indigo-500 cursor-pointer uppercase shadow-sm"
                              value={referenceDate.getMonth()}
                              onChange={(e) => { const d = new Date(referenceDate); d.setMonth(parseInt(e.target.value)); setReferenceDate(d); }}
                          >
                              {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                          </select>
                      )}

                      {filterTime === 'QUARTER' && (
                          <select 
                              className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-black text-[10px] outline-none focus:border-indigo-500 cursor-pointer uppercase shadow-sm"
                              value={Math.floor(referenceDate.getMonth() / 3) + 1}
                              onChange={(e) => { const d = new Date(referenceDate); d.setMonth((parseInt(e.target.value) - 1) * 3); setReferenceDate(d); }}
                          >
                              <option value="1">1º Trim</option>
                              <option value="2">2º Trim</option>
                              <option value="3">3º Trim</option>
                              <option value="4">4º Trim</option>
                          </select>
                      )}

                      {filterTime === 'CUSTOM' && (
                          <div className="flex items-center gap-3 bg-white p-2 border border-slate-200 rounded-xl animate-in zoom-in-95 duration-200 shadow-sm">
                              <input type="date" className="bg-transparent font-black text-[10px] outline-none text-slate-700" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
                              <span className="text-slate-300 text-[9px] font-black uppercase">a</span>
                              <input type="date" className="bg-transparent font-black text-[10px] outline-none text-slate-700" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
                          </div>
                      )}
                  </div>
              </div>
          </div>

          {/* Fila 3: Filtros por entidad */}
          <div className="flex flex-wrap items-center gap-3 pt-4">
              <div className="flex items-center bg-slate-50 rounded-xl border border-slate-100 px-4 py-2.5 shadow-inner min-w-[140px] flex-1">
                <ArrowRightLeft size={14} className="text-slate-400 mr-2" />
                <select className="bg-transparent text-[9px] font-black uppercase tracking-widest outline-none cursor-pointer w-full" value={filterAccount} onChange={e => setFilterAccount(e.target.value)}>
                    <option value="ALL">Todas las Cuentas</option>
                    {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>

              <div className="flex items-center bg-slate-50 rounded-xl border border-slate-100 px-4 py-2.5 shadow-inner min-w-[140px] flex-1">
                <Filter size={14} className="text-slate-400 mr-2" />
                <select className="bg-transparent text-[9px] font-black uppercase tracking-widest outline-none cursor-pointer w-full" value={filterFamily} onChange={e => { setFilterFamily(e.target.value); setFilterCategory('ALL'); }}>
                    <option value="ALL">Todas las Familias</option>
                    {data.families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>

              <div className="flex items-center bg-slate-50 rounded-xl border border-slate-100 px-4 py-2.5 shadow-inner min-w-[140px] flex-1">
                <Tag size={14} className="text-slate-400 mr-2" />
                <select className="bg-transparent text-[9px] font-black uppercase tracking-widest outline-none cursor-pointer w-full" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                    <option value="ALL">Todas las Categorías</option>
                    {data.categories.filter(c => filterFamily === 'ALL' || c.familyId === filterFamily).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
          </div>

          {/* Fila 4: Visualización de filtros activos (Chips) */}
          {(activeFilters.length > 0 || filterTime !== 'ALL') && (
            <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-50 animate-in fade-in duration-500">
                <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mr-2">Filtros Activos:</p>
                {activeFilters.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100 animate-in zoom-in-95">
                    <span className="text-xs">{f.icon}</span>
                    <span className="text-[9px] font-black uppercase tracking-tight">{f.label}</span>
                    <button onClick={() => clearFilter(f.type)} className="p-0.5 hover:bg-indigo-200 rounded-full transition-colors">
                      <X size={10} />
                    </button>
                  </div>
                ))}
                {filterTime !== 'ALL' && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-500 rounded-full border border-slate-200 animate-in zoom-in-95">
                    <Calendar size={10} />
                    <span className="text-[9px] font-black uppercase tracking-tight">Periodo: {filterTime}</span>
                    <button onClick={() => setFilterTime('ALL')} className="p-0.5 hover:bg-slate-200 rounded-full transition-colors">
                      <X size={10} />
                    </button>
                  </div>
                )}
                <button 
                  onClick={clearAllFilters} 
                  className="ml-auto text-rose-500 text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-rose-50 px-5 py-2.5 rounded-xl transition-colors border border-rose-100 active:scale-95 shadow-sm bg-white"
                >
                  <Trash2 size={16} /> Borrar todos los filtros
                </button>
            </div>
          )}
      </div>

      {/* CABECERA DE TABLA SIMPLIFICADA */}
      <div className="hidden md:grid grid-cols-[1fr_1.2fr_1fr_140px_60px] gap-8 px-10 py-4 mb-2">
          <button onClick={() => handleSort('DEBE')} className="flex items-center group cursor-pointer text-[9px] font-black text-slate-400 uppercase tracking-widest text-left">
            DEBE <SortIndicator field="DEBE" />
          </button>
          <button onClick={() => handleSort('CONCEPTO')} className="flex items-center group cursor-pointer text-[9px] font-black text-slate-400 uppercase tracking-widest text-left">
            CONCEPTO <SortIndicator field="CONCEPTO" />
          </button>
          <button onClick={() => handleSort('HABER')} className="flex items-center group cursor-pointer text-[9px] font-black text-slate-400 uppercase tracking-widest text-left">
            HABER <SortIndicator field="HABER" />
          </button>
          <button onClick={() => handleSort('AMOUNT')} className="flex items-center justify-end group cursor-pointer text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">
            IMPORTE <SortIndicator field="AMOUNT" />
          </button>
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">ACC.</div>
      </div>

      {/* LISTADO DE MOVIMIENTOS */}
      <div className="space-y-4">
        {filteredTransactions.map(t => {
            const { debe, haber } = getTransactionEntities(t);
            const isIncome = t.type === 'INCOME';
            const isExpense = t.type === 'EXPENSE';

            return (
              <div key={t.id} className="group bg-white rounded-[2.25rem] shadow-sm border border-slate-100 hover:shadow-xl hover:border-indigo-100 transition-all relative">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr_1fr_140px_auto] items-center gap-4 md:gap-8 p-6">
                    
                    {/* COLUMNA 1: DEBE */}
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 shrink-0 overflow-hidden p-1.5">
                           {renderIcon(debe.icon, "w-full h-full")}
                        </div>
                        <div className="min-w-0">
                            <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight truncate block leading-none">{debe.name}</span>
                            <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest leading-none mt-1">{debe.label}</p>
                        </div>
                    </div>

                    {/* COLUMNA 2: CONCEPTO CENTRAL */}
                    <div className="flex flex-col justify-center min-w-0 md:border-x border-slate-50 px-0 md:px-6">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t.date}</span>
                            {t.isFromRecurrence && <Repeat size={10} className="text-amber-500" />}
                        </div>
                        <div className="flex items-center gap-3">
                            <h4 className="text-xs font-black text-indigo-500 tracking-tight truncate leading-tight uppercase flex-1">{t.description}</h4>
                            <Paperclip 
                                size={14} 
                                className={`transition-all shrink-0 ${t.attachment ? 'text-indigo-600 drop-shadow-[0_0_8px_rgba(79,70,229,0.5)]' : 'text-slate-200 opacity-30'}`} 
                            />
                        </div>
                    </div>

                    {/* COLUMNA 3: HABER */}
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 shrink-0 overflow-hidden p-1.5">
                           {renderIcon(haber.icon, "w-full h-full")}
                        </div>
                        <div className="min-w-0">
                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-tight truncate block leading-none">{haber.name}</span>
                            <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest leading-none mt-1">{haber.label}</p>
                        </div>
                    </div>

                    {/* COLUMNA 4: IMPORTE */}
                    <div className="text-right">
                        <span className={`text-xl font-black tracking-tighter ${isIncome ? 'text-emerald-600' : isExpense ? 'text-rose-600' : 'text-slate-400'}`}>
                            {isIncome ? '+' : isExpense ? '-' : ''}{t.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                        </span>
                    </div>

                    {/* ACCIONES */}
                    <div className="flex justify-end relative">
                        <div className="relative">
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setActionMenuId(actionMenuId === t.id ? null : t.id);
                                }} 
                                className={`p-3 rounded-xl transition-all border ${actionMenuId === t.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-400 border-transparent hover:border-slate-200'}`}
                            >
                                <MoreVertical size={18} />
                            </button>
                            
                            {actionMenuId === t.id && (
                                <>
                                    <div className="fixed inset-0 z-[100]" onClick={() => setActionMenuId(null)} />
                                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 p-2 z-[101] animate-in slide-in-from-top-2">
                                        <button onClick={() => openEdit(t)} className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 rounded-xl transition-colors text-left"><Edit3 size={14}/> Editar</button>
                                        <button onClick={() => { setDeleteConfirmId(t.id); setActionMenuId(null); }} className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-black uppercase text-rose-500 hover:bg-rose-50 rounded-xl transition-colors text-left"><Trash2 size={14}/> Eliminar</button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {deleteConfirmId === t.id && (
                    <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-[2rem] z-[110] flex items-center justify-center gap-6 px-10 animate-in fade-in">
                        <p className="text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-3"><AlertTriangle className="text-rose-500" /> ¿Borrar movimiento?</p>
                        <div className="flex gap-2">
                            <button onClick={() => { onDeleteTransaction(t.id); setDeleteConfirmId(null); }} className="bg-rose-500 text-white px-6 py-3 rounded-xl font-black text-[9px] uppercase shadow-lg shadow-rose-500/20 active:scale-95 transition-all">Sí, eliminar</button>
                            <button onClick={() => setDeleteConfirmId(null)} className="bg-slate-100 text-slate-500 px-6 py-3 rounded-xl font-black text-[9px] uppercase hover:bg-slate-200 transition-all">Cancelar</button>
                        </div>
                    </div>
                )}
              </div>
            );
        })}
      </div>

      {/* MODAL NUEVO / EDITAR */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[210] p-4 sm:p-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg p-6 sm:p-12 relative max-h-[95vh] overflow-y-auto custom-scrollbar">
                <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="absolute top-8 right-8 p-3 bg-slate-50 text-slate-400 rounded-full hover:bg-rose-50 hover:text-rose-600 transition-all"><X size={20}/></button>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase mb-8">{editingTx ? 'Editar Movimiento' : 'Nuevo Movimiento'}</h3>
                
                <form className="space-y-6">
                    {/* TIPO DE MOVIMIENTO */}
                    <div className="bg-slate-100 p-1.5 rounded-2xl flex gap-1.5 shadow-inner">
                        {['EXPENSE', 'INCOME', 'TRANSFER'].map((m) => (
                            <button key={m} type="button" onClick={() => { setType(m as any); setSelectedCategoryId(''); }} className={`flex-1 py-4 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${type === m ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>
                                {m === 'EXPENSE' ? 'Gasto' : m === 'INCOME' ? 'Ingreso' : 'Traspaso'}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Importe (€)</label>
                            <input type="number" step="0.01" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xl font-black outline-none focus:border-indigo-500" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha</label>
                            <input type="date" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Sparkles size={14} className="text-indigo-400"/> Descripción / Concepto</label>
                        <input type="text" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500" value={description} onChange={e => setDescription(e.target.value)} placeholder="Ej. Amazon, Nómina, Restaurante..." />
                    </div>

                    {/* DISPOSICIÓN DINÁMICA SEGÚN PARTIDA DOBLE */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {type === 'EXPENSE' && (
                            <>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoría (Debe)</label>
                                    <select 
                                        className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none appearance-none" 
                                        value={selectedCategoryId} 
                                        onChange={e => setSelectedCategoryId(e.target.value)}
                                    >
                                        <option value="">Seleccionar...</option>
                                        {availableCategories.map(group => (
                                            <optgroup key={group.family.id} label={group.family.name.toUpperCase()}>
                                                {group.categories.map(c => (
                                                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                                                ))}
                                            </optgroup>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Cuenta (Haber)</label>
                                    <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none appearance-none" value={accountId} onChange={e => setAccountId(e.target.value)}>
                                        {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                </div>
                            </>
                        )}

                        {type === 'INCOME' && (
                            <>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Cuenta (Debe)</label>
                                    <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none appearance-none" value={accountId} onChange={e => setAccountId(e.target.value)}>
                                        {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoría (Haber)</label>
                                    <select 
                                        className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none appearance-none" 
                                        value={selectedCategoryId} 
                                        onChange={e => setSelectedCategoryId(e.target.value)}
                                    >
                                        <option value="">Seleccionar...</option>
                                        {availableCategories.map(group => (
                                            <optgroup key={group.family.id} label={group.family.name.toUpperCase()}>
                                                {group.categories.map(c => (
                                                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                                                ))}
                                            </optgroup>
                                        ))}
                                    </select>
                                </div>
                            </>
                        )}

                        {type === 'TRANSFER' && (
                            <>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Hacia (Debe)</label>
                                    <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none appearance-none" value={transferDestId} onChange={e => setTransferDestId(e.target.value)}>
                                        <option value="">Seleccionar...</option>
                                        {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Desde (Haber)</label>
                                    <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none appearance-none" value={accountId} onChange={e => setAccountId(e.target.value)}>
                                        {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                          <Paperclip size={14} className="text-indigo-400" /> Adjuntar Comprobante
                        </label>
                        <div className="flex items-center gap-3">
                            <button 
                              type="button" 
                              onClick={() => fileInputRef.current?.click()} 
                              className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 border-2 border-dashed rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest ${attachment ? 'bg-indigo-50 border-indigo-300 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-indigo-200 hover:bg-slate-50'}`}
                            >
                                {attachment ? <><ImageIcon size={16} /> Cambiar Archivo</> : <><Paperclip size={16} /> Seleccionar Archivo</>}
                            </button>
                            {attachment && (
                              <button type="button" onClick={() => setAttachment(undefined)} className="p-4 bg-rose-50 text-rose-500 rounded-2xl border border-rose-100 hover:bg-rose-100 transition-colors">
                                <Trash2 size={20} />
                              </button>
                            )}
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleFileChange} />
                    </div>

                    <button 
                        type="button" 
                        onClick={() => {
                            if (!amount || !description) {
                                alert("Por favor completa el importe y la descripción.");
                                return;
                            }
                            if (type !== 'TRANSFER' && !selectedCategoryId) {
                                alert("Debes seleccionar una categoría.");
                                return;
                            }
                            if (type === 'TRANSFER' && !transferDestId) {
                                alert("Debes seleccionar una cuenta de destino para el traspaso.");
                                return;
                            }

                            const finalTx: Transaction = { 
                                id: editingTx ? editingTx.id : Math.random().toString(36).substring(7), 
                                date, 
                                amount: parseFloat(amount), 
                                description, 
                                accountId, 
                                type,
                                brandIcon: selectedBrandIcon,
                                attachment: attachment,
                                familyId: '',
                                categoryId: ''
                            };

                            if (type === 'TRANSFER') {
                                finalTx.transferAccountId = transferDestId;
                            } else {
                                const cat = data.categories.find(c => c.id === selectedCategoryId);
                                if (cat) { 
                                    finalTx.familyId = cat.familyId; 
                                    finalTx.categoryId = cat.id; 
                                }
                            }

                            editingTx ? onUpdateTransaction(finalTx) : onAddTransaction(finalTx);
                            setIsModalOpen(false); resetForm();
                        }} 
                        className="w-full py-6 bg-slate-950 text-white rounded-3xl font-black uppercase tracking-widest text-[11px] shadow-2xl hover:bg-indigo-600 transition-all mt-6"
                    >
                        Confirmar Movimiento
                    </button>
                </form>
            </div>
        </div>
      )}
      
      {/* MODAL FAVORITOS */}
      {isFavModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[200] p-6 animate-in fade-in duration-300">
              <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl p-8 relative animate-in zoom-in-95 max-h-[80vh] flex flex-col">
                  <button onClick={() => setIsFavModalOpen(false)} className="absolute top-8 right-8 p-3 bg-slate-50 rounded-full text-slate-400 hover:text-rose-500 transition-colors"><X size={20}/></button>
                  <div className="mb-6 space-y-4">
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Mis Favoritos</h3>
                      <div className="relative">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                          <input 
                            type="text" 
                            className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 font-bold" 
                            placeholder="Buscar favorito..." 
                            value={favSearch}
                            onChange={e => setFavSearch(e.target.value)}
                          />
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                      {(data.favorites || []).filter(f => f.name.toLowerCase().includes(favSearch.toLowerCase())).map(f => (
                          <button key={f.id} onClick={() => {
                              resetForm();
                              setType(f.type);
                              setAmount(f.amount.toString());
                              setDescription(f.description);
                              setAccountId(f.accountId);
                              setTransferDestId(f.transferAccountId || '');
                              setSelectedCategoryId(f.categoryId);
                              setIsFavModalOpen(false);
                              setIsModalOpen(true);
                          }} className="w-full flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-transparent hover:border-indigo-500 hover:bg-white transition-all group text-left">
                              <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-amber-500 shadow-sm"><Star size={20} fill="currentColor" /></div>
                                  <div>
                                      <p className="font-black text-slate-900 text-sm uppercase">{f.name}</p>
                                      <p className="text-[9px] font-bold text-slate-400 uppercase">{data.categories.find(c => c.id === f.categoryId)?.name || 'Sin categoría'}</p>
                                  </div>
                              </div>
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
