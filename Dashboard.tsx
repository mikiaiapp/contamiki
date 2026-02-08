
import React, { useMemo, useState, useRef } from 'react';
import { AppState, Family, Category, Transaction, RecurrentMovement, GlobalFilter, TimeRange } from './types';
import { TrendingUp, TrendingDown, Banknote, ChevronDown, ChevronRight, ChevronLeft, Scale, ArrowDownCircle, ArrowUpCircle, Calendar, X, Plus, List, Info, ArrowRightLeft, Paperclip, FileText, Trash2, Bell, CheckCircle2, MoreHorizontal, Edit2, Repeat } from 'lucide-react';

interface DashboardProps {
  data: AppState;
  onAddTransaction: (t: Transaction) => void;
  onUpdateData: (newData: Partial<AppState>) => void;
  filter: GlobalFilter;
  onUpdateFilter: (f: GlobalFilter) => void;
  onNavigateToTransactions: (filters: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ data, onAddTransaction, onUpdateData, filter, onUpdateFilter, onNavigateToTransactions }) => {
  const { transactions, accounts, families, categories, recurrents = [] } = data;
  
  const [quickAddCat, setQuickAddCat] = useState<Category | null>(null);
  const [quickAmount, setQuickAmount] = useState('');
  const [quickDesc, setQuickDesc] = useState('');
  const [quickDate, setQuickDate] = useState(new Date().toISOString().split('T')[0]);
  const [quickAccount, setQuickAccount] = useState(accounts[0]?.id || '');
  const [quickAttachment, setQuickAttachment] = useState<string | undefined>(undefined);
  const [editingRecAsTx, setEditingRecAsTx] = useState<RecurrentMovement | null>(null);

  // Lógica de fechas unificada
  const dateBounds = useMemo(() => {
    const y = filter.referenceDate.getFullYear();
    const m = filter.referenceDate.getMonth();
    let startStr = ''; let endStr = '';

    if (filter.timeRange === 'MONTH') {
      startStr = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m + 1, 0).getDate();
      endStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } else if (filter.timeRange === 'QUARTER') {
      const quarter = Math.floor(m / 3);
      startStr = `${y}-${String(quarter * 3 + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(y, quarter * 3 + 3, 0).getDate();
      endStr = `${y}-${String(quarter * 3 + 3).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } else if (filter.timeRange === 'YEAR') {
      startStr = `${y}-01-01`; endStr = `${y}-12-31`;
    } else if (filter.timeRange === 'CUSTOM' && filter.customStart && filter.customEnd) {
      startStr = filter.customStart; endStr = filter.customEnd;
    }
    return { startStr, endStr };
  }, [filter]);

  // OPTIMIZACIÓN DE TOTALES: O(N+M) en lugar de O(NxM)
  const stats = useMemo(() => {
    const accTotals: Record<string, number> = {};
    accounts.forEach(a => accTotals[a.id] = a.initialBalance);

    let periodIncome = 0;
    let periodExpense = 0;

    transactions.forEach(t => {
      // Balance Global (siempre suma a la cuenta)
      if (t.type === 'INCOME') accTotals[t.accountId] = (accTotals[t.accountId] || 0) + t.amount;
      else if (t.type === 'EXPENSE') accTotals[t.accountId] = (accTotals[t.accountId] || 0) - t.amount;
      else if (t.type === 'TRANSFER' && t.transferAccountId) {
        accTotals[t.accountId] = (accTotals[t.accountId] || 0) - t.amount;
        accTotals[t.transferAccountId] = (accTotals[t.transferAccountId] || 0) + t.amount;
      }

      // Totales del Periodo
      const isAll = filter.timeRange === 'ALL';
      if (isAll || (t.date >= dateBounds.startStr && t.date <= dateBounds.endStr)) {
        if (t.type === 'INCOME') periodIncome += t.amount;
        if (t.type === 'EXPENSE') periodExpense += t.amount;
      }
    });

    const globalBalance = Object.values(accTotals).reduce((a, b) => a + b, 0);
    return { income: periodIncome, expense: periodExpense, balance: globalBalance, periodBalance: periodIncome - periodExpense };
  }, [transactions, accounts, dateBounds, filter.timeRange]);

  const flowData = useMemo(() => {
      const periodTxs = transactions.filter(t => filter.timeRange === 'ALL' || (t.date >= dateBounds.startStr && t.date <= dateBounds.endStr));
      
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
  }, [families, categories, transactions, dateBounds, filter.timeRange]);

  const dueRecurrents = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return (recurrents || []).filter(r => r.active && r.nextDueDate <= today);
  }, [recurrents]);

  const navigatePeriod = (direction: 'prev' | 'next') => {
    const newDate = new Date(filter.referenceDate);
    const step = direction === 'next' ? 1 : -1;
    if (filter.timeRange === 'MONTH') newDate.setMonth(newDate.getMonth() + step);
    else if (filter.timeRange === 'QUARTER') newDate.setMonth(newDate.getMonth() + (step * 3));
    else if (filter.timeRange === 'YEAR') newDate.setFullYear(newDate.getFullYear() + step);
    onUpdateFilter({ ...filter, referenceDate: newDate });
  };

  const years = Array.from({length: new Date().getFullYear() - 2015 + 3}, (_, i) => 2015 + i);
  const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  return (
    <div className="space-y-8 md:space-y-12 max-w-full pb-10">
      <div className="flex flex-col xl:flex-row justify-between xl:items-end gap-8">
        <div className="space-y-6 text-center md:text-left">
            <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-slate-900 tracking-tighter leading-tight">Métrica Total.</h2>
            <div className="flex flex-col sm:flex-row items-center gap-4 mt-2 justify-center md:justify-start">
                <div className="flex items-center gap-2">
                    <button onClick={() => navigatePeriod('prev')} className="w-10 h-10 flex items-center justify-center bg-white border-2 border-slate-100 rounded-xl hover:bg-slate-50 shadow-sm active:scale-90 transition-all"><ChevronLeft size={20} /></button>
                    <button onClick={() => navigatePeriod('next')} className="w-10 h-10 flex items-center justify-center bg-white border-2 border-slate-100 rounded-xl hover:bg-slate-50 shadow-sm active:scale-90 transition-all"><ChevronRight size={20} /></button>
                </div>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                    {filter.timeRange !== 'CUSTOM' && filter.timeRange !== 'ALL' && (
                        <select className="px-4 py-2 bg-white border-2 border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 shadow-sm cursor-pointer" 
                                value={filter.referenceDate.getFullYear()} 
                                onChange={(e) => { const d = new Date(filter.referenceDate); d.setFullYear(parseInt(e.target.value)); onUpdateFilter({...filter, referenceDate: d}); }}>
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    )}
                    {filter.timeRange === 'MONTH' && (
                        <select className="px-4 py-2 bg-white border-2 border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 shadow-sm cursor-pointer" 
                                value={filter.referenceDate.getMonth()} 
                                onChange={(e) => { const d = new Date(filter.referenceDate); d.setMonth(parseInt(e.target.value)); onUpdateFilter({...filter, referenceDate: d}); }}>
                            {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                        </select>
                    )}
                </div>
            </div>
        </div>
        <div className="bg-slate-100/80 p-1 rounded-[1.25rem] flex flex-wrap justify-center gap-1 shadow-inner border border-slate-200/50 w-full sm:w-fit mx-auto xl:mx-0">
            {['ALL', 'MONTH', 'QUARTER', 'YEAR', 'CUSTOM'].map((range) => (
                <button key={range} onClick={() => onUpdateFilter({...filter, timeRange: range as any})} className={`flex-1 sm:flex-none px-5 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${filter.timeRange === range ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    {range === 'ALL' ? 'Todo' : range === 'MONTH' ? 'Mes' : range === 'QUARTER' ? 'Trim' : range === 'YEAR' ? 'Año' : 'Pers'}
                </button>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 max-w-4xl">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-between min-h-[160px]">
            <div className="bg-indigo-50 text-indigo-600 w-12 h-12 rounded-xl flex items-center justify-center mb-4 shadow-sm"><Banknote size={24}/></div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Balance Global Actual</p>
                <p className="text-3xl font-black tracking-tight text-indigo-600">{stats.balance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
            </div>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-between min-h-[160px]">
            <div className={`${stats.periodBalance >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'} w-12 h-12 rounded-xl flex items-center justify-center mb-4 shadow-sm`}><Scale size={24}/></div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Margen del Periodo</p>
                <p className={`text-3xl font-black tracking-tight ${stats.periodBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{stats.periodBalance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {[
              { label: 'Ingresos', data: flowData.incomes, total: stats.income, color: 'emerald', icon: <ArrowUpCircle size={24}/> },
              { label: 'Gastos', data: flowData.expenses, total: stats.expense, color: 'rose', icon: <ArrowDownCircle size={24}/> }
          ].map((sec, idx) => (
              <div key={idx} className="space-y-6">
                  <div className="flex items-center justify-between px-4">
                      <div className="flex items-center gap-3"><div className={`text-${sec.color}-500`}>{sec.icon}</div><h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">{sec.label}</h3></div>
                      <div className={`bg-${sec.color}-50 px-4 py-2 rounded-xl border border-${sec.color}-100 flex flex-col items-end shadow-sm`}><span className={`text-[9px] font-black text-${sec.color}-600 uppercase mb-1`}>Total</span><span className={`text-sm font-black text-${sec.color}-700`}>{idx === 0 ? '+' : '-'}{sec.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span></div>
                  </div>
                  <div className="space-y-4">
                      {sec.data.map(item => (
                          <div key={item.family.id} className={`bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm transition-all ${item.total === 0 ? 'opacity-50' : ''}`}>
                              <div className="w-full flex items-center justify-between p-6 border-b border-slate-50">
                                  <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 bg-slate-50 text-2xl">{item.family.icon || '📂'}</div>
                                    <span className="font-black text-base uppercase tracking-tight text-slate-900">{item.family.name}</span>
                                  </div>
                                  <span className={`font-black text-sm ${idx === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{idx === 0 ? '+' : '-'}{item.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                              </div>
                              <div className="p-4 bg-slate-50/20 space-y-2">
                                  {item.categories.map(cat => (
                                      <div key={cat.category.id} onClick={() => onNavigateToTransactions({ filterCategory: cat.category.id })} className="flex items-center justify-between px-5 py-3 rounded-2xl bg-white border border-slate-100 shadow-sm hover:border-indigo-300 cursor-pointer transition-all active:scale-95">
                                          <div className="flex items-center gap-3"><span className="text-xl">{cat.category.icon}</span><span className="text-[10px] font-bold text-slate-600 uppercase">{cat.category.name}</span></div>
                                          <span className="text-xs font-black text-slate-900">{cat.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          ))}
      </div>
    </div>
  );
};
