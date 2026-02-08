
import React, { useMemo, useState } from 'react';
import { AppState, Category, Transaction, GlobalFilter } from './types';
import { Banknote, ChevronRight, ChevronLeft, Scale, ArrowDownCircle, ArrowUpCircle, X, Paperclip, Bell, CheckCircle2, Edit2, Repeat } from 'lucide-react';

interface DashboardProps {
  data: AppState;
  onAddTransaction: (t: Transaction) => void;
  onUpdateData: (newData: Partial<AppState>) => void;
  filter: GlobalFilter;
  onUpdateFilter: (f: GlobalFilter) => void;
  onNavigateToTransactions: (filters: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ data, filter, onUpdateFilter, onNavigateToTransactions }) => {
  const { transactions, accounts, families, categories, recurrents = [] } = data;

  const dateBounds = useMemo(() => {
    const y = filter.referenceDate.getFullYear();
    const m = filter.referenceDate.getMonth();
    let startStr = ''; let endStr = '';

    if (filter.timeRange === 'MONTH') {
      startStr = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      endStr = `${y}-${String(m + 1).padStart(2, '0')}-${new Date(y, m + 1, 0).getDate()}`;
    } else if (filter.timeRange === 'QUARTER') {
      const q = Math.floor(m / 3);
      startStr = `${y}-${String(q * 3 + 1).padStart(2, '0')}-01`;
      endStr = `${y}-${String(q * 3 + 3).padStart(2, '0')}-${new Date(y, q * 3 + 3, 0).getDate()}`;
    } else if (filter.timeRange === 'YEAR') {
      startStr = `${y}-01-01`; endStr = `${y}-12-31`;
    } else if (filter.timeRange === 'CUSTOM') {
      startStr = filter.customStart; endStr = filter.customEnd;
    }
    return { startStr, endStr };
  }, [filter]);

  const stats = useMemo(() => {
    const accTotals: Record<string, number> = {};
    accounts.forEach(a => accTotals[a.id] = a.initialBalance);

    let periodIncome = 0;
    let periodExpense = 0;

    transactions.forEach(t => {
      if (t.type === 'INCOME') accTotals[t.accountId] = (accTotals[t.accountId] || 0) + t.amount;
      else if (t.type === 'EXPENSE') accTotals[t.accountId] = (accTotals[t.accountId] || 0) - t.amount;
      else if (t.type === 'TRANSFER' && t.transferAccountId) {
        accTotals[t.accountId] = (accTotals[t.accountId] || 0) - t.amount;
        accTotals[t.transferAccountId] = (accTotals[t.transferAccountId] || 0) + t.amount;
      }

      const inPeriod = filter.timeRange === 'ALL' || (t.date >= dateBounds.startStr && t.date <= dateBounds.endStr);
      if (inPeriod) {
        if (t.type === 'INCOME') periodIncome += t.amount;
        if (t.type === 'EXPENSE') periodExpense += t.amount;
      }
    });

    return { 
        income: periodIncome, 
        expense: periodExpense, 
        balance: Object.values(accTotals).reduce((a, b) => a + b, 0), 
        periodBalance: periodIncome - periodExpense 
    };
  }, [transactions, accounts, dateBounds, filter.timeRange]);

  const flowData = useMemo(() => {
      const periodTxs = transactions.filter(t => filter.timeRange === 'ALL' || (t.date >= dateBounds.startStr && t.date <= dateBounds.endStr));
      const buildHierarchy = (type: 'INCOME' | 'EXPENSE') => {
          return families
            .filter(f => f.type === type)
            .map(fam => {
                const famTxs = periodTxs.filter(t => t.familyId === fam.id);
                const cats = categories
                    .filter(c => c.familyId === fam.id)
                    .map(cat => ({
                        category: cat,
                        total: famTxs.filter(t => t.categoryId === cat.id).reduce((sum, t) => sum + t.amount, 0)
                    }))
                    .sort((a,b) => b.total - a.total);
                return { family: fam, total: famTxs.reduce((sum, t) => sum + t.amount, 0), categories: cats };
            })
            .sort((a,b) => b.total - a.total);
      };
      return { incomes: buildHierarchy('INCOME'), expenses: buildHierarchy('EXPENSE') };
  }, [families, categories, transactions, dateBounds, filter.timeRange]);

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
    <div className="space-y-8 md:space-y-12 pb-10">
      <div className="flex flex-col xl:flex-row justify-between xl:items-end gap-8">
        <div className="space-y-4 text-center md:text-left">
            <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter">Resumen.</h2>
            <div className="flex flex-col sm:flex-row items-center gap-3 justify-center md:justify-start">
                <div className="flex items-center gap-1">
                    <button onClick={() => navigatePeriod('prev')} className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm active:scale-90 transition-all"><ChevronLeft size={20} /></button>
                    <button onClick={() => navigatePeriod('next')} className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm active:scale-90 transition-all"><ChevronRight size={20} /></button>
                </div>
                <div className="flex gap-2">
                    {filter.timeRange !== 'CUSTOM' && filter.timeRange !== 'ALL' && (
                        <select className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-indigo-500 shadow-sm" value={filter.referenceDate.getFullYear()} onChange={(e) => { const d = new Date(filter.referenceDate); d.setFullYear(parseInt(e.target.value)); onUpdateFilter({...filter, referenceDate: d}); }}>
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    )}
                    {filter.timeRange === 'MONTH' && (
                        <select className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-indigo-500 shadow-sm" value={filter.referenceDate.getMonth()} onChange={(e) => { const d = new Date(filter.referenceDate); d.setMonth(parseInt(e.target.value)); onUpdateFilter({...filter, referenceDate: d}); }}>
                            {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                        </select>
                    )}
                </div>
            </div>
        </div>
        <div className="bg-slate-100/80 p-1.5 rounded-2xl flex flex-wrap justify-center gap-1 shadow-inner border border-slate-200/50 w-full sm:w-fit mx-auto xl:mx-0">
            {['ALL', 'MONTH', 'QUARTER', 'YEAR', 'CUSTOM'].map((range) => (
                <button key={range} onClick={() => onUpdateFilter({...filter, timeRange: range as any})} className={`flex-1 sm:flex-none px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${filter.timeRange === range ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    {range === 'ALL' ? 'Todo' : range === 'MONTH' ? 'Mes' : range === 'QUARTER' ? 'Trim' : range === 'YEAR' ? 'Año' : 'Pers'}
                </button>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-between min-h-[160px]">
            <div className="bg-indigo-50 text-indigo-600 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-sm"><Banknote size={26}/></div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Patrimonio Global</p>
                <p className="text-3xl font-black tracking-tight text-slate-900">{stats.balance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
            </div>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-between min-h-[160px]">
            <div className={`${stats.periodBalance >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'} w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-sm`}><Scale size={26}/></div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Ahorro del Periodo</p>
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
                          <div key={item.family.id} className={`bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm transition-all ${item.total === 0 ? 'opacity-40 grayscale' : ''}`}>
                              <div className="w-full flex items-center justify-between p-6 border-b border-slate-50">
                                  <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 bg-slate-50 text-2xl">
                                        {item.family.icon.startsWith('http') ? <img src={item.family.icon} className="w-8 h-8 object-contain" /> : item.family.icon}
                                    </div>
                                    <span className="font-black text-base uppercase tracking-tight text-slate-900">{item.family.name}</span>
                                  </div>
                                  <span className={`font-black text-sm ${idx === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{idx === 0 ? '+' : '-'}{item.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                              </div>
                              <div className="p-4 bg-slate-50/20 space-y-2">
                                  {item.categories.map(cat => (
                                      <div key={cat.category.id} onClick={() => onNavigateToTransactions({ filterCategory: cat.category.id })} className="flex items-center justify-between px-5 py-3 rounded-2xl bg-white border border-slate-100 shadow-sm hover:border-indigo-300 cursor-pointer transition-all active:scale-95 group">
                                          <div className="flex items-center gap-3">
                                            <span className="text-xl group-hover:scale-125 transition-transform">
                                                {cat.category.icon.startsWith('http') ? <img src={cat.category.icon} className="w-6 h-6 object-contain" /> : cat.category.icon}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-600 uppercase">{cat.category.name}</span>
                                          </div>
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
