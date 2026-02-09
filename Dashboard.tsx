
import React, { useMemo, useState } from 'react';
import { AppState, Transaction, GlobalFilter, AccountGroup, Account, RecurrentMovement } from './types';
import { Banknote, ChevronRight, ChevronLeft, Scale, ArrowDownCircle, ArrowUpCircle, X, Wallet, Layers, Bell, Check, Clock, History, AlertCircle } from 'lucide-react';

interface DashboardProps {
  data: AppState;
  onAddTransaction: (t: Transaction) => void;
  onUpdateData: (newData: Partial<AppState>) => void;
  filter: GlobalFilter;
  onUpdateFilter: (f: GlobalFilter) => void;
  onNavigateToTransactions: (filters: any) => void;
}

// Se utiliza 'de-DE' para forzar estrictamente el formato 1.000,00 (Punto miles, Coma decimales)
const numberFormatter = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const Dashboard: React.FC<DashboardProps> = ({ data, onAddTransaction, onUpdateData, filter, onUpdateFilter, onNavigateToTransactions }) => {
  const { transactions, accounts, families, categories, accountGroups, recurrents = [] } = data;
  const [showBalanceDetail, setShowBalanceDetail] = useState(false);
  const [showRecurrentsModal, setShowRecurrentsModal] = useState(false);
  const [clickTimer, setClickTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Helper para formatear fecha dd/mm/aa
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '--/--/--';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year.slice(-2)}`;
  };

  // Helper para moneda: Muestra el signo real almacenado
  const formatCurrency = (amount: number) => {
    return `${numberFormatter.format(amount)} €`;
  };

  const getAmountColor = (amount: number) => {
    if (amount > 0) return 'text-emerald-600';
    if (amount < 0) return 'text-rose-600';
    return 'text-slate-400';
  };

  const pendingRecurrents = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return recurrents.filter(r => r.active && r.nextDueDate <= today);
  }, [recurrents]);

  const dateBounds = useMemo(() => {
    const y = filter.referenceDate.getFullYear();
    const m = filter.referenceDate.getMonth();
    let startStr = ''; let endStr = '';

    if (filter.timeRange === 'MONTH') {
      startStr = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m + 1, 0).getDate();
      endStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } else if (filter.timeRange === 'YEAR') {
      startStr = `${y}-01-01`; 
      endStr = `${y}-12-31`;
    } else if (filter.timeRange === 'CUSTOM') {
      startStr = filter.customStart || '1900-01-01';
      endStr = filter.customEnd || '2100-12-31';
    } else {
      startStr = '1900-01-01';
      endStr = '2100-12-31';
    }
    return { startStr, endStr };
  }, [filter]);

  const stats = useMemo(() => {
    const accTotals: Record<string, number> = {};
    accounts.forEach(a => accTotals[a.id] = a.initialBalance);

    let periodIncome = 0;
    let periodExpense = 0;

    transactions.forEach(t => {
      // 1. Cálculo de Saldos de Cuentas (Acumulado histórico algebraico)
      if (t.date <= dateBounds.endStr) {
        accTotals[t.accountId] = (accTotals[t.accountId] || 0) + t.amount;
        
        if (t.type === 'TRANSFER' && t.transferAccountId) {
            accTotals[t.transferAccountId] = (accTotals[t.transferAccountId] || 0) - t.amount;
        }
      }

      // 2. Cálculo del Periodo (Ingresos vs Gastos)
      // La lógica aquí debe ser idéntica a la de 'flowData' para que coincidan los totales.
      // Se basa en la FAMILIA asociada.
      const inPeriod = filter.timeRange === 'ALL' || (t.date >= dateBounds.startStr && t.date <= dateBounds.endStr);
      if (inPeriod && t.type !== 'TRANSFER') {
          // Buscamos la familia
          const cat = categories.find(c => c.id === t.categoryId);
          const fam = families.find(f => f.id === (t.familyId || cat?.familyId));

          if (fam) {
              if (fam.type === 'INCOME') periodIncome += t.amount;
              else if (fam.type === 'EXPENSE') periodExpense += t.amount;
          } else {
              // Si no tiene familia (huérfano), usamos el tipo de transacción como fallback
              if (t.type === 'INCOME') periodIncome += t.amount;
              else if (t.type === 'EXPENSE') periodExpense += t.amount;
          }
      }
    });

    return { 
        income: periodIncome, 
        expense: periodExpense, 
        balance: Object.values(accTotals).reduce((a, b) => a + b, 0), 
        // Ahorro: Suma algebraica de Ingresos + Gastos del periodo
        periodBalance: periodIncome + periodExpense,
        accTotals
    };
  }, [transactions, accounts, dateBounds, filter.timeRange, families, categories]);

  const groupedBalances = useMemo(() => {
    return accountGroups.map(group => {
        const groupAccounts = accounts.filter(a => a.groupId === group.id);
        const groupTotal = groupAccounts.reduce((sum, acc) => sum + (stats.accTotals[acc.id] || 0), 0);
        return {
            group,
            total: groupTotal,
            accounts: groupAccounts.map(acc => ({
                ...acc,
                balance: stats.accTotals[acc.id] || 0
            }))
        };
    }).filter(g => g.accounts.length > 0);
  }, [accountGroups, accounts, stats.accTotals]);

  const flowData = useMemo(() => {
      const periodTxs = transactions.filter(t => filter.timeRange === 'ALL' || (t.date >= dateBounds.startStr && t.date <= dateBounds.endStr));
      
      const buildHierarchy = (type: 'INCOME' | 'EXPENSE') => {
          return families
            .filter(f => f.type === type)
            .map(fam => {
                const famTxs = periodTxs.filter(t => t.familyId === fam.id || (categories.find(c => c.id === t.categoryId)?.familyId === fam.id));
                // Suma directa algebraica
                const totalFam = famTxs.reduce((sum, t) => sum + t.amount, 0);
                
                const cats = categories
                    .filter(c => c.familyId === fam.id)
                    .map(cat => ({
                        category: cat,
                        total: famTxs.filter(t => t.categoryId === cat.id).reduce((sum, t) => sum + t.amount, 0)
                    }))
                    // Ordenamos por magnitud absoluta para ver los mayores movimientos primero
                    .sort((a,b) => Math.abs(b.total) - Math.abs(a.total));
                
                return { family: fam, total: totalFam, categories: cats };
            })
            // Ordenamos por magnitud absoluta
            .sort((a,b) => Math.abs(b.total) - Math.abs(a.total));
      };
      return { incomes: buildHierarchy('INCOME'), expenses: buildHierarchy('EXPENSE') };
  }, [families, categories, transactions, dateBounds, filter.timeRange]);

  const navigatePeriod = (direction: 'prev' | 'next') => {
    const newDate = new Date(filter.referenceDate);
    const step = direction === 'next' ? 1 : -1;
    if (filter.timeRange === 'MONTH') newDate.setMonth(newDate.getMonth() + step);
    else if (filter.timeRange === 'YEAR') newDate.setFullYear(newDate.getFullYear() + step);
    onUpdateFilter({ ...filter, referenceDate: newDate });
  };

  const calculateNextDate = (current: string, frequency: string, interval: number) => {
    const d = new Date(current);
    if (frequency === 'DAYS') d.setDate(d.getDate() + interval);
    else if (frequency === 'WEEKS') d.setDate(d.getDate() + (interval * 7));
    else if (frequency === 'MONTHLY') d.setMonth(d.getMonth() + interval);
    else if (frequency === 'YEARS') d.setFullYear(d.getFullYear() + interval);
    return d.toISOString().split('T')[0];
  };

  const handleProcessRecurrent = (r: RecurrentMovement) => {
    const newTx: Transaction = {
        id: Math.random().toString(36).substring(2, 15),
        date: r.nextDueDate,
        description: r.description,
        amount: r.amount, // Debería venir con signo correcto desde configuración
        accountId: r.accountId,
        transferAccountId: r.transferAccountId,
        familyId: r.familyId,
        categoryId: r.categoryId,
        type: r.type,
        isFromRecurrence: r.id
    };
    onAddTransaction(newTx);
    const nextDate = calculateNextDate(r.nextDueDate, r.frequency, r.interval);
    onUpdateData({
        recurrents: recurrents.map(item => item.id === r.id ? { ...item, nextDueDate: nextDate } : item)
    });
  };

  const handlePostponeRecurrent = (r: RecurrentMovement) => {
    const nextDate = calculateNextDate(r.nextDueDate, r.frequency, r.interval);
    onUpdateData({
        recurrents: recurrents.map(item => item.id === r.id ? { ...item, nextDueDate: nextDate } : item)
    });
  };

  const handleDeactivateRecurrent = (r: RecurrentMovement) => {
    onUpdateData({
        recurrents: recurrents.map(item => item.id === r.id ? { ...item, active: false } : item)
    });
  };

  const renderIcon = (iconStr: string, className = "w-10 h-10") => {
    if (iconStr?.startsWith('http') || iconStr?.startsWith('data:image')) return <img src={iconStr} className={`${className} object-contain rounded-lg`} referrerPolicy="no-referrer" />;
    return <span className="text-xl flex items-center justify-center">{iconStr || '📂'}</span>;
  };

  const handleCategoryClick = (categoryId: string) => {
    if (clickTimer) {
        clearTimeout(clickTimer);
        setClickTimer(null);
        onNavigateToTransactions({ filterCategory: categoryId });
    } else {
        const timer = setTimeout(() => {
            onNavigateToTransactions({ action: 'NEW', categoryId: categoryId });
            setClickTimer(null);
        }, 250);
        setClickTimer(timer);
    }
  };

  const years = Array.from({length: new Date().getFullYear() - 2015 + 5}, (_, i) => 2015 + i);
  const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  return (
    <div className="space-y-8 md:space-y-12 pb-10">
      {/* HEADER y NAVEGACIÓN TEMPORAL */}
      <div className="flex flex-col xl:flex-row justify-between xl:items-end gap-8">
        <div className="space-y-4 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-4">
                <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter">Resumen.</h2>
                {pendingRecurrents.length > 0 && (
                    <button 
                        onClick={() => setShowRecurrentsModal(true)}
                        className="bg-rose-500 text-white px-4 py-2 rounded-2xl flex items-center gap-2 shadow-lg shadow-rose-200 animate-pulse hover:scale-105 transition-transform"
                    >
                        <Bell size={18} />
                        <span className="text-[12px] font-black">{pendingRecurrents.length}</span>
                    </button>
                )}
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 justify-center md:justify-start">
                <div className="flex items-center gap-1">
                    <button onClick={() => navigatePeriod('prev')} className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm active:scale-90 transition-all"><ChevronLeft size={20} /></button>
                    <button onClick={() => navigatePeriod('next')} className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm active:scale-90 transition-all"><ChevronRight size={20} /></button>
                </div>
                <div className="flex gap-2">
                    {filter.timeRange !== 'CUSTOM' && filter.timeRange !== 'ALL' && (
                        <select className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-indigo-500 shadow-sm cursor-pointer" value={filter.referenceDate.getFullYear()} onChange={(e) => { const d = new Date(filter.referenceDate); d.setFullYear(parseInt(e.target.value)); onUpdateFilter({...filter, referenceDate: d}); }}>
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    )}
                    {filter.timeRange === 'MONTH' && (
                        <select className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-indigo-500 shadow-sm cursor-pointer" value={filter.referenceDate.getMonth()} onChange={(e) => { const d = new Date(filter.referenceDate); d.setMonth(parseInt(e.target.value)); onUpdateFilter({...filter, referenceDate: d}); }}>
                            {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                        </select>
                    )}
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

      {/* TARJETAS KPI SUPERIORES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl">
        <button 
          onClick={() => setShowBalanceDetail(true)}
          className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-between min-h-[160px] text-left hover:shadow-xl hover:border-indigo-100 transition-all active:scale-[0.98] group"
        >
            <div className="bg-indigo-50 text-indigo-600 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform"><Banknote size={26}/></div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Patrimonio Global <span className="text-indigo-300 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">Ver detalle</span></p>
                <p className={`text-3xl font-black tracking-tight ${getAmountColor(stats.balance)}`}>
                    {formatCurrency(stats.balance)}
                </p>
            </div>
        </button>
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-between min-h-[160px]">
            <div className={`${stats.periodBalance >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'} w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-sm`}><Scale size={26}/></div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Ahorro del Periodo</p>
                <p className={`text-3xl font-black tracking-tight ${getAmountColor(stats.periodBalance)}`}>
                    {formatCurrency(stats.periodBalance)}
                </p>
            </div>
        </div>
      </div>

      <div className="space-y-16">
          
          {/* BLOQUE HORIZONTAL: INGRESOS */}
          <section className="space-y-6">
              <div className="flex items-center justify-between border-b-2 border-emerald-100 pb-4">
                  <div className="flex items-center gap-3">
                      <div className="bg-emerald-100 text-emerald-600 p-2.5 rounded-2xl"><ArrowUpCircle size={28}/></div>
                      <h3 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tighter">Ingresos</h3>
                  </div>
                  <span className={`text-2xl md:text-3xl font-black tracking-tighter ${getAmountColor(stats.income)}`}>{formatCurrency(stats.income)}</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {flowData.incomes.map(item => (
                      <div key={item.family.id} className={`bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm hover:shadow-lg transition-all ${item.total === 0 ? 'opacity-60' : ''}`}>
                          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-50">
                              <div className="flex items-center gap-3">
                                  <div className="bg-emerald-50 w-12 h-12 rounded-2xl flex items-center justify-center border border-emerald-100">
                                      {renderIcon(item.family.icon, "w-7 h-7")}
                                  </div>
                                  <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{item.family.name}</span>
                              </div>
                              <span className={`text-lg font-black ${getAmountColor(item.total)}`}>{formatCurrency(item.total)}</span>
                          </div>
                          <div className="space-y-2">
                              {item.categories.map(cat => (
                                  <div 
                                    key={cat.category.id} 
                                    onClick={() => handleCategoryClick(cat.category.id)}
                                    className="flex items-center justify-between py-2 px-3 -mx-2 rounded-xl hover:bg-emerald-50 cursor-pointer group transition-colors"
                                  >
                                      <div className="flex items-center gap-3 overflow-hidden">
                                          <span className="text-lg group-hover:scale-110 transition-transform">{renderIcon(cat.category.icon, "w-5 h-5")}</span>
                                          <span className="text-sm font-bold text-slate-600 truncate">{cat.category.name}</span>
                                      </div>
                                      <span className={`text-sm font-black opacity-80 group-hover:opacity-100 ${getAmountColor(cat.total)}`}>
                                          {formatCurrency(cat.total)}
                                      </span>
                                  </div>
                              ))}
                              {item.categories.length === 0 && <p className="text-xs text-slate-400 italic text-center py-2">Sin categorías</p>}
                          </div>
                      </div>
                  ))}
                  {flowData.incomes.length === 0 && <p className="col-span-full text-center text-slate-400 font-bold py-10 uppercase text-sm">No hay familias de ingresos configuradas</p>}
              </div>
          </section>

          {/* BLOQUE HORIZONTAL: GASTOS */}
          <section className="space-y-6">
              <div className="flex items-center justify-between border-b-2 border-rose-100 pb-4">
                  <div className="flex items-center gap-3">
                      <div className="bg-rose-100 text-rose-600 p-2.5 rounded-2xl"><ArrowDownCircle size={28}/></div>
                      <h3 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tighter">Gastos</h3>
                  </div>
                  <span className={`text-2xl md:text-3xl font-black tracking-tighter ${getAmountColor(stats.expense)}`}>{formatCurrency(stats.expense)}</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {flowData.expenses.map(item => (
                      <div key={item.family.id} className={`bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm hover:shadow-lg transition-all ${item.total === 0 ? 'opacity-60' : ''}`}>
                          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-50">
                              <div className="flex items-center gap-3">
                                  <div className="bg-rose-50 w-12 h-12 rounded-2xl flex items-center justify-center border border-rose-100">
                                      {renderIcon(item.family.icon, "w-7 h-7")}
                                  </div>
                                  <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{item.family.name}</span>
                              </div>
                              <span className={`text-lg font-black ${getAmountColor(item.total)}`}>{formatCurrency(item.total)}</span>
                          </div>
                          <div className="space-y-2">
                              {item.categories.map(cat => (
                                  <div 
                                    key={cat.category.id} 
                                    onClick={() => handleCategoryClick(cat.category.id)}
                                    className="flex items-center justify-between py-2 px-3 -mx-2 rounded-xl hover:bg-rose-50 cursor-pointer group transition-colors"
                                  >
                                      <div className="flex items-center gap-3 overflow-hidden">
                                          <span className="text-lg group-hover:scale-110 transition-transform">{renderIcon(cat.category.icon, "w-5 h-5")}</span>
                                          <span className="text-sm font-bold text-slate-600 truncate">{cat.category.name}</span>
                                      </div>
                                      <span className={`text-sm font-black opacity-80 group-hover:opacity-100 ${getAmountColor(cat.total)}`}>
                                          {formatCurrency(cat.total)}
                                      </span>
                                  </div>
                              ))}
                              {item.categories.length === 0 && <p className="text-xs text-slate-400 italic text-center py-2">Sin categorías</p>}
                          </div>
                      </div>
                  ))}
                   {flowData.expenses.length === 0 && <p className="col-span-full text-center text-slate-400 font-bold py-10 uppercase text-sm">No hay familias de gastos configuradas</p>}
              </div>
          </section>

      </div>

      {/* Modales (Sin cambios estructurales, solo visuales para usar getAmountColor) */}
      {showBalanceDetail && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[200] p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl p-8 sm:p-12 relative max-h-[90vh] overflow-y-auto custom-scrollbar border border-white/20">
                <button onClick={() => setShowBalanceDetail(false)} className="absolute top-8 right-8 p-3 bg-slate-50 text-slate-400 rounded-full hover:text-rose-500 hover:bg-rose-50 transition-all"><X size={24}/></button>
                <div className="flex items-center gap-4 mb-10">
                    <div className="bg-indigo-600 p-4 rounded-3xl text-white shadow-xl shadow-indigo-600/20"><Banknote size={28} /></div>
                    <div><h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Desglose de Patrimonio</h3><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Situación al {formatDateDisplay(dateBounds.endStr)}</p></div>
                </div>
                <div className="space-y-10">
                    {groupedBalances.map(groupInfo => (
                        <div key={groupInfo.group.id} className="space-y-4">
                            <div className="flex items-center justify-between px-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 shadow-sm overflow-hidden">{renderIcon(groupInfo.group.icon, "w-6 h-6")}</div>
                                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">{groupInfo.group.name}</h4>
                                </div>
                                <span className={`text-base font-black tracking-tighter ${getAmountColor(groupInfo.total)}`}>{formatCurrency(groupInfo.total)}</span>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                {groupInfo.accounts.map(acc => (
                                    <div key={acc.id} onClick={() => { setShowBalanceDetail(false); onNavigateToTransactions({ filterAccount: acc.id }); }} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-white hover:border-indigo-200 transition-all shadow-sm cursor-pointer group/row active:scale-[0.99]">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-50 shadow-sm overflow-hidden group-hover/row:scale-110 transition-transform">{renderIcon(acc.icon, "w-6 h-6")}</div>
                                            <div><span className="text-[11px] font-bold text-slate-600 uppercase block">{acc.name}</span><span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest opacity-0 group-hover/row:opacity-100 transition-opacity">Ver movimientos</span></div>
                                        </div>
                                        <div className="flex items-center gap-2"><span className={`text-xs font-black ${getAmountColor(acc.balance)}`}>{formatCurrency(acc.balance)}</span><ChevronRight size={14} className="text-slate-300 group-hover/row:text-indigo-400" /></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-12 pt-8 border-t border-slate-100 flex justify-between items-center px-4">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Patrimonio Neto Total</span>
                    <span className={`text-3xl font-black tracking-tighter ${getAmountColor(stats.balance)}`}>{formatCurrency(stats.balance)}</span>
                </div>
                <button onClick={() => setShowBalanceDetail(false)} className="w-full mt-10 py-6 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-indigo-600 transition-all active:scale-95">Entendido</button>
            </div>
        </div>
      )}

      {showRecurrentsModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[200] p-4 animate-in fade-in zoom-in duration-300">
            <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl p-8 sm:p-12 relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                <button onClick={() => setShowRecurrentsModal(false)} className="absolute top-8 right-8 p-3 bg-slate-50 text-slate-400 rounded-full hover:text-rose-500 hover:bg-rose-50 transition-all"><X size={24}/></button>
                <div className="flex items-center gap-4 mb-10"><div className="bg-rose-500 p-4 rounded-3xl text-white shadow-xl shadow-rose-500/20"><Bell size={28} /></div><div><h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Vencimientos</h3><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Movimientos recurrentes pendientes</p></div></div>
                <div className="space-y-4">
                    {pendingRecurrents.map(r => {
                        const acc = accounts.find(a => a.id === r.accountId);
                        const cat = categories.find(c => c.id === r.categoryId);
                        return (
                            <div key={r.id} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4 animate-in slide-in-from-right-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex gap-3"><div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-200">{renderIcon(cat?.icon || '📅', "w-6 h-6")}</div><div><p className="text-sm font-black text-slate-900 uppercase tracking-tight">{r.description}</p><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{acc?.name} • Venció el {formatDateDisplay(r.nextDueDate)}</p></div></div>
                                    <span className={`text-base font-black ${getAmountColor(r.amount)}`}>{formatCurrency(r.amount)}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <button onClick={() => handleProcessRecurrent(r)} className="flex flex-col items-center justify-center gap-1.5 p-3 bg-white border border-slate-200 rounded-2xl hover:border-emerald-300 hover:bg-emerald-50 transition-all group active:scale-95"><Check className="text-slate-400 group-hover:text-emerald-600" size={18} /><span className="text-[8px] font-black uppercase text-slate-400 group-hover:text-emerald-600">Validar</span></button>
                                    <button onClick={() => handlePostponeRecurrent(r)} className="flex flex-col items-center justify-center gap-1.5 p-3 bg-white border border-slate-200 rounded-2xl hover:border-amber-300 hover:bg-amber-50 transition-all group active:scale-95"><Clock className="text-slate-400 group-hover:text-amber-600" size={18} /><span className="text-[8px] font-black uppercase text-slate-400 group-hover:text-amber-600">Posponer</span></button>
                                    <button onClick={() => handleDeactivateRecurrent(r)} className="flex flex-col items-center justify-center gap-1.5 p-3 bg-white border border-slate-200 rounded-2xl hover:border-rose-300 hover:bg-rose-50 transition-all group active:scale-95"><AlertCircle className="text-slate-400 group-hover:text-rose-600" size={18} /><span className="text-[8px] font-black uppercase text-slate-400 group-hover:text-rose-600">Anular</span></button>
                                </div>
                            </div>
                        );
                    })}
                    {pendingRecurrents.length === 0 && <div className="py-12 text-center space-y-4"><div className="mx-auto bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center text-slate-300"><History size={32}/></div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No hay más vencimientos por hoy</p></div>}
                </div>
                <button onClick={() => setShowRecurrentsModal(false)} className="w-full mt-10 py-6 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-indigo-600 transition-all">Cerrar</button>
            </div>
        </div>
      )}
    </div>
  );
};
