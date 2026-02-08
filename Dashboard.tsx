
import React, { useMemo, useState, useRef } from 'react';
import { AppState, Family, Category, Transaction, RecurrentMovement } from './types';
import { TrendingUp, TrendingDown, Banknote, ChevronDown, ChevronRight, ChevronLeft, Scale, ArrowDownCircle, ArrowUpCircle, Calendar, X, Plus, List, Info, ArrowRightLeft, Paperclip, FileText, Image as ImageIcon, Trash2, Bell, CheckCircle2, MoreHorizontal, Edit2, Repeat } from 'lucide-react';

interface DashboardProps {
  data: AppState;
  onAddTransaction: (t: Transaction) => void;
  onUpdateData: (newData: Partial<AppState>) => void;
  onNavigateToTransactions: (filters: any) => void;
}

type TimeRange = 'MONTH' | 'QUARTER' | 'YEAR' | 'CUSTOM';

export const Dashboard: React.FC<DashboardProps> = ({ data, onAddTransaction, onUpdateData, onNavigateToTransactions }) => {
  const { transactions, accounts, families, categories, recurrents = [] } = data;
  
  const [timeRange, setTimeRange] = useState<TimeRange>('MONTH');
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Estados para modales de interacción
  const [quickAddCat, setQuickAddCat] = useState<Category | null>(null);
  const clickTimerRef = useRef<number | null>(null);

  // Estados del formulario rápido/edición
  const [quickAmount, setQuickAmount] = useState('');
  const [quickDesc, setQuickDesc] = useState('');
  const [quickDate, setQuickDate] = useState(new Date().toISOString().split('T')[0]);
  const [quickAccount, setQuickAccount] = useState(accounts[0]?.id || '');
  const [quickAttachment, setQuickAttachment] = useState<string | undefined>(undefined);
  const quickFileRef = useRef<HTMLInputElement>(null);
  const [editingRecAsTx, setEditingRecAsTx] = useState<RecurrentMovement | null>(null);

  // Filtro de fecha basado en strings para evitar desfases de zona horaria
  const dateBounds = useMemo(() => {
    const y = referenceDate.getFullYear();
    const m = referenceDate.getMonth();
    
    let startStr = '';
    let endStr = '';

    if (timeRange === 'MONTH') {
      startStr = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m + 1, 0).getDate();
      endStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } else if (timeRange === 'QUARTER') {
      const quarter = Math.floor(m / 3);
      startStr = `${y}-${String(quarter * 3 + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(y, quarter * 3 + 3, 0).getDate();
      endStr = `${y}-${String(quarter * 3 + 3).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } else if (timeRange === 'YEAR') {
      startStr = `${y}-01-01`;
      endStr = `${y}-12-31`;
    } else if (timeRange === 'CUSTOM' && customStartDate && customEndDate) {
      startStr = customStartDate;
      endStr = customEndDate;
    }

    return { startStr, endStr };
  }, [timeRange, referenceDate, customStartDate, customEndDate]);

  const globalStats = useMemo(() => {
    const currentTotalBalance = accounts.reduce((acc, account) => {
        let accBalance = account.initialBalance;
        transactions.forEach(t => {
            if (t.accountId === account.id) {
                if (t.type === 'INCOME') accBalance += t.amount;
                else if (t.type === 'EXPENSE') accBalance -= t.amount;
            }
            if (t.transferAccountId === account.id && t.type === 'TRANSFER') accBalance += t.amount;
        });
        return acc + accBalance;
    }, 0);

    let periodIncome = 0;
    let periodExpense = 0;
    transactions.forEach(t => {
      if (t.date >= dateBounds.startStr && t.date <= dateBounds.endStr) {
        if (t.type === 'INCOME') periodIncome += t.amount;
        if (t.type === 'EXPENSE') periodExpense += t.amount;
      }
    });
    
    return { income: periodIncome, expense: periodExpense, balance: currentTotalBalance, periodBalance: periodIncome - periodExpense };
  }, [transactions, dateBounds, accounts]);

  const flowData = useMemo(() => {
      const periodTxs = transactions.filter(t => t.date >= dateBounds.startStr && t.date <= dateBounds.endStr);

      const buildHierarchy = (type: 'INCOME' | 'EXPENSE') => {
          return families
            .filter(f => f.type === type)
            .map(fam => {
                const famTxs = periodTxs.filter(t => t.familyId === fam.id);
                const totalFam = famTxs.reduce((sum, t) => sum + t.amount, 0);
                const cats = categories
                    .filter(c => c.familyId === fam.id)
                    .map(cat => ({
                        category: cat,
                        total: famTxs.filter(t => t.categoryId === cat.id).reduce((sum, t) => sum + t.amount, 0)
                    }))
                    .sort((a,b) => b.total - a.total);
                
                return { family: fam, total: totalFam, categories: cats };
            })
            .sort((a,b) => b.total - a.total);
      };

      return { incomes: buildHierarchy('INCOME'), expenses: buildHierarchy('EXPENSE') };
  }, [families, categories, transactions, dateBounds]);

  const dueRecurrents = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return (recurrents || []).filter(r => r.active && r.nextDueDate <= today);
  }, [recurrents]);

  const renderIcon = (iconStr: string, size = "w-8 h-8", textSize = "text-xl") => {
      const safeIcon = iconStr || '📂';
      if (safeIcon.startsWith('data:image') || safeIcon.startsWith('http')) return <img src={safeIcon} className={`${size} object-contain`} />;
      return <span className={textSize}>{safeIcon}</span>;
  }

  const handleCategoryInteraction = (cat: Category) => {
      if (clickTimerRef.current) {
          window.clearTimeout(clickTimerRef.current);
          clickTimerRef.current = null;
          onNavigateToTransactions({
              filterTime: timeRange === 'MONTH' ? 'MONTH' : timeRange === 'QUARTER' ? 'QUARTER' : timeRange === 'YEAR' ? 'YEAR' : 'CUSTOM',
              referenceDate: new Date(referenceDate),
              customStart: customStartDate,
              customEnd: customEndDate,
              filterCategory: cat.id
          });
          return;
      }

      clickTimerRef.current = window.setTimeout(() => {
          setQuickAddCat(cat);
          setQuickDesc('');
          setQuickAmount('');
          setQuickDate(new Date().toISOString().split('T')[0]);
          setQuickAttachment(undefined);
          clickTimerRef.current = null;
      }, 250);
  };

  const processRecurrence = (r: RecurrentMovement, customData?: {amount: number, desc: string, date: string, accountId: string}) => {
    const newTx: Transaction = {
        id: Math.random().toString(36).substring(7),
        date: customData?.date || r.nextDueDate,
        amount: customData?.amount || r.amount,
        description: customData?.desc || r.description,
        accountId: customData?.accountId || r.accountId,
        familyId: r.familyId,
        categoryId: r.categoryId,
        type: r.type,
        isFromRecurrence: r.id
    };
    onAddTransaction(newTx);

    const next = new Date(r.nextDueDate);
    if (r.frequency === 'DAYS') next.setDate(next.getDate() + r.interval);
    else if (r.frequency === 'WEEKS') next.setDate(next.getDate() + (r.interval * 7));
    else if (r.frequency === 'MONTHLY') next.setMonth(next.getMonth() + r.interval);
    else if (r.frequency === 'YEARS') next.setFullYear(next.getFullYear() + r.interval);

    const updatedRecs = recurrents.map(x => x.id === r.id ? { ...x, nextDueDate: next.toISOString().split('T')[0] } : x);
    onUpdateData({ recurrents: updatedRecs });
    setEditingRecAsTx(null);
  };

  const skipRecurrence = (r: RecurrentMovement) => {
    const next = new Date(r.nextDueDate);
    if (r.frequency === 'DAYS') next.setDate(next.getDate() + r.interval);
    else if (r.frequency === 'WEEKS') next.setDate(next.getDate() + (r.interval * 7));
    else if (r.frequency === 'MONTHLY') next.setMonth(next.getMonth() + r.interval);
    else if (r.frequency === 'YEARS') next.setFullYear(next.getFullYear() + r.interval);

    const updatedRecs = recurrents.map(x => x.id === r.id ? { ...x, nextDueDate: next.toISOString().split('T')[0] } : x);
    onUpdateData({ recurrents: updatedRecs });
  };

  const handleEditRecurrenceBeforeProcess = (r: RecurrentMovement) => {
      setEditingRecAsTx(r);
      setQuickAmount(r.amount.toString());
      setQuickDesc(r.description);
      setQuickDate(r.nextDueDate);
      setQuickAccount(r.accountId);
  };

  const navigatePeriod = (direction: 'prev' | 'next') => {
    const newDate = new Date(referenceDate);
    const step = direction === 'next' ? 1 : -1;
    if (timeRange === 'MONTH') newDate.setMonth(newDate.getMonth() + step);
    else if (timeRange === 'QUARTER') newDate.setMonth(newDate.getMonth() + (step * 3));
    else if (timeRange === 'YEAR') newDate.setFullYear(newDate.getFullYear() + step);
    setReferenceDate(newDate);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setQuickAttachment(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const saveQuickTransaction = () => {
      if (!quickAddCat || !quickAmount || !quickAccount) return;
      const fam = families.find(f => f.id === quickAddCat.familyId);
      if (!fam) return;

      const newTx: Transaction = {
          id: Math.random().toString(36).substring(7),
          date: quickDate,
          amount: parseFloat(quickAmount),
          description: quickDesc || quickAddCat.name,
          accountId: quickAccount,
          familyId: quickAddCat.familyId,
          categoryId: quickAddCat.id,
          type: fam.type,
          attachment: quickAttachment
      };

      onAddTransaction(newTx);
      setQuickAddCat(null);
  };

  // PUNTO DE PARTIDA 2015
  const startYear = 2015;
  const currentYear = new Date().getFullYear();
  const years = Array.from({length: currentYear - startYear + 3}, (_, i) => startYear + i);
  const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  return (
    <div className="space-y-8 md:space-y-12 max-w-full pb-10">
      {dueRecurrents.length > 0 && (
          <div className="bg-slate-900 rounded-[2.5rem] p-6 sm:p-10 shadow-2xl border border-white/10 relative overflow-hidden animate-in slide-in-from-top-4 duration-500">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[100px] -mr-32 -mt-32"></div>
              <div className="relative z-10 space-y-6">
                <div className="flex items-center gap-3">
                    <div className="bg-amber-400 p-2 rounded-xl text-slate-900 shadow-xl shadow-amber-400/20">
                        <Bell size={20} className="animate-bounce" />
                    </div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">Pendientes</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {dueRecurrents.map(r => (
                        <div key={r.id} className="bg-white/5 border border-white/10 p-5 rounded-3xl flex items-center justify-between group hover:bg-white/10 transition-all">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0">
                                    <Repeat size={20} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">{r.nextDueDate}</p>
                                    <h4 className="text-sm font-black text-white truncate">{r.description}</h4>
                                    <p className="text-[10px] font-bold text-slate-400">{r.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => processRecurrence(r)} className="p-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-400 active:scale-90 transition-all"><CheckCircle2 size={18} /></button>
                                <button onClick={() => handleEditRecurrenceBeforeProcess(r)} className="p-3 bg-indigo-50 text-white rounded-xl hover:bg-indigo-400 active:scale-90 transition-all"><Edit2 size={18} /></button>
                                <button onClick={() => skipRecurrence(r)} className="p-3 bg-white/10 text-slate-300 rounded-xl hover:bg-white/20 active:scale-90 transition-all"><X size={18} /></button>
                            </div>
                        </div>
                    ))}
                </div>
              </div>
          </div>
      )}

      <div className="flex flex-col xl:flex-row justify-between xl:items-end gap-8">
        <div className="space-y-6 text-center md:text-left">
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 tracking-tighter leading-tight">
                Resumen <br className="hidden md:block"/> Financiero.
            </h2>
            <div className="flex flex-col sm:flex-row items-center gap-4 mt-2 justify-center md:justify-start">
                <div className="flex items-center gap-2">
                    <button onClick={() => navigatePeriod('prev')} className="w-10 h-10 flex items-center justify-center bg-white border-2 border-slate-100 rounded-xl hover:bg-slate-50 shadow-sm active:scale-90 transition-all"><ChevronLeft size={20} /></button>
                    <button onClick={() => navigatePeriod('next')} className="w-10 h-10 flex items-center justify-center bg-white border-2 border-slate-100 rounded-xl hover:bg-slate-50 shadow-sm active:scale-90 transition-all"><ChevronRight size={20} /></button>
                </div>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                    {timeRange !== 'CUSTOM' && (
                        <select className="px-4 py-2 bg-white border-2 border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 shadow-sm cursor-pointer" value={referenceDate.getFullYear()} onChange={(e) => { const d = new Date(referenceDate); d.setFullYear(parseInt(e.target.value)); setReferenceDate(d); }}>
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    )}
                    {timeRange === 'MONTH' && (
                        <select className="px-4 py-2 bg-white border-2 border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 shadow-sm cursor-pointer" value={referenceDate.getMonth()} onChange={(e) => { const d = new Date(referenceDate); d.setMonth(parseInt(e.target.value)); setReferenceDate(d); }}>
                            {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                        </select>
                    )}
                    {timeRange === 'QUARTER' && (
                        <select className="px-4 py-2 bg-white border-2 border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 shadow-sm cursor-pointer" value={Math.floor(referenceDate.getMonth() / 3) + 1} onChange={(e) => { const d = new Date(referenceDate); d.setMonth((parseInt(e.target.value) - 1) * 3); setReferenceDate(d); }}>
                            <option value="1">1º Trimestre</option><option value="2">2º Trimestre</option><option value="3">3º Trimestre</option><option value="4">4º Trimestre</option>
                        </select>
                    )}
                    {timeRange === 'CUSTOM' && (
                        <div className="flex items-center gap-3 bg-white p-2 border-2 border-slate-100 rounded-2xl shadow-sm animate-in zoom-in-95 duration-200">
                            <input type="date" className="bg-transparent font-bold text-xs outline-none text-slate-700" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} />
                            <span className="text-slate-300 font-black text-[10px] uppercase">a</span>
                            <input type="date" className="bg-transparent font-bold text-xs outline-none text-slate-700" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} />
                        </div>
                    )}
                </div>
            </div>
        </div>
        <div className="bg-slate-100/80 p-1 rounded-[1.25rem] flex flex-wrap justify-center gap-1 shadow-inner backdrop-blur-sm border border-slate-200/50 w-full sm:w-fit mx-auto xl:mx-0">
            {['MONTH', 'QUARTER', 'YEAR', 'CUSTOM'].map((range) => (
                <button key={range} onClick={() => { setTimeRange(range as any); if(range !== 'CUSTOM') setReferenceDate(new Date()); }} className={`flex-1 sm:flex-none px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${timeRange === range ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    {range === 'MONTH' ? 'Mes' : range === 'QUARTER' ? 'Trim' : range === 'YEAR' ? 'Año' : 'Pers'}
                </button>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 max-w-4xl">
        {[
            { label: 'Balance Global', val: globalStats.balance, color: 'text-indigo-600', icon: <Banknote size={24}/>, bg: 'bg-indigo-50' },
            { label: 'Margen Periodo', val: globalStats.periodBalance, color: globalStats.periodBalance >= 0 ? 'text-emerald-600' : 'text-rose-600', icon: <Scale size={24}/>, bg: globalStats.periodBalance >= 0 ? 'bg-emerald-50' : 'bg-rose-50' }
        ].map((stat, i) => (
            <div key={i} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-between min-h-[140px]">
                <div className={`${stat.bg} ${stat.color} w-12 h-12 rounded-xl flex items-center justify-center mb-4 shadow-sm`}>{stat.icon}</div>
                <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                    <p className={`text-xl font-black tracking-tight ${stat.color}`}>{stat.val.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
                </div>
            </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4">
                  <div className="flex items-center gap-3"><ArrowUpCircle className="text-emerald-500" size={24} /><h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">Ingresos</h3></div>
                  <div className="bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100 flex flex-col items-end shadow-sm"><span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1 leading-none">Total</span><span className="text-sm font-black text-emerald-700">+{globalStats.income.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span></div>
              </div>
              <div className="space-y-4">
                  {flowData.incomes.map(item => (
                      <div key={item.family.id} className={`bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm transition-all ${item.total === 0 ? 'bg-slate-50/40 opacity-70' : ''}`}>
                          <div className="w-full flex items-center justify-between p-6 border-b border-slate-50">
                              <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 shadow-sm ${item.total > 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-100 border-slate-200'}`}>{renderIcon(item.family.icon, "w-8 h-8", "text-2xl")}</div>
                                <span className={`font-black text-base uppercase tracking-tight ${item.total > 0 ? 'text-slate-900' : 'text-slate-400'}`}>{item.family.name}</span>
                              </div>
                              <div className="text-right"><span className={`font-black text-sm block ${item.total > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>+{item.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span></div>
                          </div>
                          <div className="p-5 bg-slate-50/30 space-y-2">
                              {item.categories.map(cat => (
                                  <div key={cat.category.id} onDoubleClick={() => handleCategoryInteraction(cat.category)} onClick={() => handleCategoryInteraction(cat.category)} className={`flex items-center justify-between px-5 py-3 rounded-2xl bg-white border border-slate-100 shadow-sm transition-all hover:border-indigo-300 cursor-pointer select-none active:scale-[0.98] ${cat.total === 0 ? 'opacity-50' : ''}`}>
                                      <div className="flex items-center gap-3">{renderIcon(cat.category.icon, "w-5 h-5", "text-base")}<span className="text-[10px] font-bold text-slate-600 uppercase">{cat.category.name}</span></div>
                                      <span className={`text-xs font-black ${cat.total > 0 ? 'text-slate-900' : 'text-slate-400'}`}>{cat.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                                  </div>
                              ))}
                          </div>
                      </div>
                  ))}
              </div>
          </div>

          <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4">
                  <div className="flex items-center gap-3"><ArrowDownCircle className="text-rose-500" size={24} /><h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">Gastos</h3></div>
                  <div className="bg-rose-50 px-4 py-2 rounded-xl border border-rose-100 flex flex-col items-end shadow-sm"><span className="text-[9px] font-black text-rose-600 uppercase tracking-widest mb-1 leading-none">Total</span><span className="text-sm font-black text-rose-700">-{globalStats.expense.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span></div>
              </div>
              <div className="space-y-4">
                  {flowData.expenses.map(item => (
                      <div key={item.family.id} className={`bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm transition-all ${item.total === 0 ? 'bg-slate-50/40 opacity-70' : ''}`}>
                          <div className="w-full flex items-center justify-between p-6 border-b border-slate-50">
                              <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 shadow-sm ${item.total > 0 ? 'bg-rose-50 border-rose-100' : 'bg-slate-100 border-slate-200'}`}>{renderIcon(item.family.icon, "w-8 h-8", "text-2xl")}</div>
                                <span className={`font-black text-base uppercase tracking-tight ${item.total > 0 ? 'text-slate-900' : 'text-slate-400'}`}>{item.family.name}</span>
                              </div>
                              <div className="text-right"><span className={`font-black text-sm block ${item.total > 0 ? 'text-rose-600' : 'text-slate-300'}`}>-{item.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span></div>
                          </div>
                          <div className="p-5 bg-slate-50/30 space-y-2">
                              {item.categories.map(cat => (
                                  <div key={cat.category.id} onDoubleClick={() => handleCategoryInteraction(cat.category)} onClick={() => handleCategoryInteraction(cat.category)} className={`flex items-center justify-between px-5 py-3 rounded-2xl bg-white border border-slate-100 shadow-sm transition-all hover:border-indigo-300 cursor-pointer select-none active:scale-[0.98] ${cat.total === 0 ? 'opacity-50' : ''}`}>
                                      <div className="flex items-center gap-3">{renderIcon(cat.category.icon, "w-5 h-5", "text-base")}<span className="text-[10px] font-bold text-slate-600 uppercase">{cat.category.name}</span></div>
                                      <span className={`text-xs font-black ${cat.total > 0 ? 'text-slate-900' : 'text-slate-400'}`}>{cat.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                                  </div>
                              ))}
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      </div>

      {quickAddCat && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[100] p-6 animate-in fade-in duration-300">
              <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-8 relative animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                  <button onClick={() => { setQuickAddCat(null); setEditingRecAsTx(null); }} className="absolute top-6 right-6 p-2 bg-slate-50 rounded-full text-slate-400 hover:text-rose-500 transition-colors"><X size={20}/></button>
                  <div className="flex items-center gap-4 mb-8">
                      <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center shrink-0 shadow-sm">{renderIcon(quickAddCat?.icon || '', "w-10 h-10", "text-2xl")}</div>
                      <div><h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Nuevo Movimiento</h4><p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{quickAddCat?.name}</p></div>
                  </div>
                  <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1"><label className="text-[8px] font-black text-slate-400 uppercase ml-1">Importe</label><input type="number" step="0.01" autoFocus className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-black text-lg outline-none focus:border-indigo-500 transition-all" value={quickAmount} onChange={e => setQuickAmount(e.target.value)} /></div>
                        <div className="space-y-1"><label className="text-[8px] font-black text-slate-400 uppercase ml-1">Fecha</label><input type="date" className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-xs outline-none focus:border-indigo-500 transition-all" value={quickDate} onChange={e => setQuickDate(e.target.value)} /></div>
                      </div>
                      <div className="space-y-1"><label className="text-[8px] font-black text-slate-400 uppercase ml-1">Descripción</label><input type="text" className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-indigo-500 transition-all" value={quickDesc} onChange={e => setQuickDesc(e.target.value)} /></div>
                      <div className="space-y-1"><label className="text-[8px] font-black text-slate-400 uppercase ml-1">Cuenta</label><select className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-indigo-500 transition-all" value={quickAccount} onChange={e => setQuickAccount(e.target.value)}>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                      
                      <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase ml-1 flex items-center gap-2"><Paperclip size={12}/> Adjuntar Archivo</label>
                          <button onClick={() => quickFileRef.current?.click()} className={`w-full py-4 px-5 border-2 border-dashed rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${quickAttachment ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-white hover:border-indigo-200'}`}>
                              {quickAttachment ? 'Archivo Seleccionado' : 'Seleccionar Comprobante'}
                          </button>
                          <input type="file" ref={quickFileRef} className="hidden" accept="image/*,application/pdf" onChange={handleFileChange} />
                      </div>

                      <button onClick={saveQuickTransaction} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl hover:bg-indigo-700 active:scale-95 transition-all">Guardar Movimiento</button>
                  </div>
              </div>
          </div>
      )}

      {editingRecAsTx && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[100] p-6 animate-in fade-in duration-300">
              <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-8 relative animate-in zoom-in-95">
                  <button onClick={() => setEditingRecAsTx(null)} className="absolute top-6 right-6 p-2 bg-slate-50 rounded-full text-slate-400 hover:text-rose-500 transition-colors"><X size={20}/></button>
                  <div className="flex items-center gap-4 mb-8"><Repeat size={24} className="text-amber-500" /><div><h4 className="text-lg font-black text-slate-900 uppercase">Procesar Recurrente</h4><p className="text-[10px] font-black text-indigo-500 uppercase">{editingRecAsTx.description}</p></div></div>
                  <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1"><label className="text-[8px] font-black text-slate-400 uppercase ml-1">Importe</label><input type="number" step="0.01" className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-black text-lg outline-none focus:border-indigo-500 transition-all" value={quickAmount} onChange={e => setQuickAmount(e.target.value)} /></div>
                        <div className="space-y-1"><label className="text-[8px] font-black text-slate-400 uppercase ml-1">Fecha</label><input type="date" className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-xs focus:border-indigo-500 transition-all" value={quickDate} onChange={e => setQuickDate(e.target.value)} /></div>
                      </div>
                      <div className="space-y-1"><label className="text-[8px] font-black text-slate-400 uppercase ml-1">Cuenta</label><select className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold focus:border-indigo-500 transition-all" value={quickAccount} onChange={e => setQuickAccount(e.target.value)}>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                      <button onClick={() => processRecurrence(editingRecAsTx, { amount: parseFloat(quickAmount), desc: quickDesc, date: quickDate, accountId: quickAccount })} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl hover:bg-indigo-700 active:scale-95 transition-all">Confirmar y Procesar</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
