import React, { useMemo, useState } from 'react';
import { AppState, Family, Category } from '../types';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Banknote, ChevronDown, ChevronRight, ChevronLeft, ListFilter, Scale } from 'lucide-react';

interface DashboardProps {
  data: AppState;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

type TimeRange = 'MONTH' | 'QUARTER' | 'YEAR' | 'CUSTOM';

export const Dashboard: React.FC<DashboardProps> = ({ data }) => {
  const { transactions, accounts, families, categories } = data;
  
  const [timeRange, setTimeRange] = useState<TimeRange>('MONTH');
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [expandedFamilies, setExpandedFamilies] = useState<Record<string, boolean>>({});

  const dateFilter = useMemo(() => {
    let start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
    let end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);

    if (timeRange === 'QUARTER') {
      const quarter = Math.floor(referenceDate.getMonth() / 3);
      start = new Date(referenceDate.getFullYear(), quarter * 3, 1);
      end = new Date(referenceDate.getFullYear(), quarter * 3 + 3, 0);
    } else if (timeRange === 'YEAR') {
      start = new Date(referenceDate.getFullYear(), 0, 1);
      end = new Date(referenceDate.getFullYear(), 11, 31);
    } else if (timeRange === 'CUSTOM' && customStartDate && customEndDate) {
      start = new Date(customStartDate);
      end = new Date(customEndDate);
    }
    return { start, end };
  }, [timeRange, referenceDate, customStartDate, customEndDate]);

  const navigatePeriod = (direction: 'prev' | 'next') => {
    const newDate = new Date(referenceDate);
    const step = direction === 'next' ? 1 : -1;

    if (timeRange === 'MONTH') {
      newDate.setMonth(newDate.getMonth() + step);
    } else if (timeRange === 'QUARTER') {
      newDate.setMonth(newDate.getMonth() + (step * 3));
    } else if (timeRange === 'YEAR') {
      newDate.setFullYear(newDate.getFullYear() + step);
    }
    setReferenceDate(newDate);
  };

  const periodLabel = useMemo(() => {
    if (timeRange === 'MONTH') {
      const monthName = referenceDate.toLocaleDateString('es-ES', { month: 'long' });
      return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${referenceDate.getFullYear()}`;
    }
    if (timeRange === 'QUARTER') {
      const quarter = Math.floor(referenceDate.getMonth() / 3) + 1;
      return `${quarter}º Trimestre ${referenceDate.getFullYear()}`;
    }
    if (timeRange === 'YEAR') {
      return `${referenceDate.getFullYear()}`;
    }
    if (timeRange === 'CUSTOM') {
      return `${dateFilter.start.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} - ${dateFilter.end.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return '';
  }, [timeRange, referenceDate, dateFilter]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const tDate = new Date(t.date);
      return tDate >= dateFilter.start && tDate <= dateFilter.end;
    });
  }, [transactions, dateFilter]);

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
    filteredTransactions.forEach(t => {
      if (t.type === 'INCOME') periodIncome += t.amount;
      if (t.type === 'EXPENSE') periodExpense += t.amount;
    });
    
    const periodBalance = periodIncome - periodExpense;

    return { 
      income: periodIncome, 
      expense: periodExpense, 
      balance: currentTotalBalance,
      periodBalance: periodBalance
    };
  }, [transactions, filteredTransactions, accounts]);

  const expenseByFamilyData = useMemo(() => {
    const map = new Map<string, number>();
    filteredTransactions.filter(t => t.type === 'EXPENSE').forEach(t => {
      const family = families.find(f => f.id === t.familyId);
      const name = family ? family.name : 'Otros';
      map.set(name, (map.get(name) || 0) + t.amount);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a,b) => b.value - a.value);
  }, [filteredTransactions, families]);

  const trendData = useMemo(() => {
      const map = new Map<string, {income: number, expense: number}>();
      const start = new Date(dateFilter.start);
      const end = new Date(dateFilter.end);
      const loop = new Date(start);
      while(loop <= end) {
          const key = loop.toLocaleString('es-ES', { month: 'short', year: '2-digit' });
          if(!map.has(key)) map.set(key, {income: 0, expense: 0});
          loop.setMonth(loop.getMonth() + 1);
      }
      filteredTransactions.forEach(t => {
         const tDate = new Date(t.date);
         const key = tDate.toLocaleString('es-ES', { month: 'short', year: '2-digit' });
         if (map.has(key)) {
             const entry = map.get(key)!;
             if(t.type === 'INCOME') entry.income += t.amount;
             if(t.type === 'EXPENSE') entry.expense += t.amount;
         }
      });
      return Array.from(map.entries()).map(([name, val]) => ({ name, Ingresos: val.income, Gastos: val.expense }));
  }, [filteredTransactions, dateFilter]);

  const hierarchicalData = useMemo(() => {
      const data: { family: Family, total: number, categories: { category: Category, total: number }[] }[] = [];
      families.forEach(fam => {
          const famTxs = filteredTransactions.filter(t => t.familyId === fam.id);
          const totalFam = famTxs.reduce((sum, t) => sum + t.amount, 0);
          if (totalFam > 0 || famTxs.length > 0) {
              const famCats: { category: Category, total: number }[] = [];
              categories.filter(c => c.familyId === fam.id).forEach(cat => {
                  const catTotal = famTxs.filter(t => t.categoryId === cat.id).reduce((sum, t) => sum + t.amount, 0);
                  if (catTotal > 0) famCats.push({ category: cat, total: catTotal });
              });
              famCats.sort((a,b) => b.total - a.total);
              data.push({ family: fam, total: totalFam, categories: famCats });
          }
      });
      return data.sort((a,b) => b.total - a.total);
  }, [families, categories, filteredTransactions]);

  const renderIcon = (iconStr: string) => {
      if (iconStr.startsWith('data:image')) return <img src={iconStr} className="w-5 h-5 object-contain inline-block mr-2" />;
      return <span className="mr-2">{iconStr}</span>;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Date Range Picker */}
      <div className="bg-white p-3 md:p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div className="flex items-center gap-2">
              {timeRange !== 'CUSTOM' && (
                <button 
                  onClick={() => navigatePeriod('prev')}
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-emerald-600 transition-colors"
                  title="Periodo anterior"
                >
                  <ChevronLeft size={24} />
                </button>
              )}
              
              <div>
                <h2 className="text-xl md:text-2xl font-black text-slate-800">Resumen</h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  {periodLabel}
                </p>
              </div>

              {timeRange !== 'CUSTOM' && (
                <button 
                  onClick={() => navigatePeriod('next')}
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-emerald-600 transition-colors"
                  title="Siguiente periodo"
                >
                  <ChevronRight size={24} />
                </button>
              )}
            </div>
            
            <div className="flex overflow-x-auto pb-1 sm:pb-0 gap-1 bg-slate-100 p-1 rounded-xl scrollbar-hide">
                <button onClick={() => { setTimeRange('MONTH'); setReferenceDate(new Date()); }} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${timeRange === 'MONTH' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500'}`}>Mes</button>
                <button onClick={() => { setTimeRange('QUARTER'); setReferenceDate(new Date()); }} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${timeRange === 'QUARTER' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500'}`}>Trimestre</button>
                <button onClick={() => { setTimeRange('YEAR'); setReferenceDate(new Date()); }} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${timeRange === 'YEAR' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500'}`}>Año</button>
                <button onClick={() => setTimeRange('CUSTOM')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${timeRange === 'CUSTOM' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500'}`}>Otro</button>
            </div>
          </div>
          {timeRange === 'CUSTOM' && (
              <div className="flex flex-col sm:flex-row gap-2 animate-in fade-in duration-300">
                  <input type="date" className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} />
                  <input type="date" className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} />
              </div>
          )}
      </div>

      {/* Stats Cards - Updated Grid to 4 columns on large screens */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 xl:gap-6">
        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Saldo Global</p>
            <p className="text-xl md:text-2xl font-black text-slate-800 leading-tight">{globalStats.balance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
          </div>
          <div className="bg-blue-50 p-3 rounded-2xl text-blue-600"><Banknote size={24} /></div>
        </div>
        
        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Ingresos</p>
            <p className="text-xl md:text-2xl font-black text-emerald-600 leading-tight">+{globalStats.income.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
          </div>
          <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600"><TrendingUp size={24} /></div>
        </div>
        
        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Gastos</p>
            <p className="text-xl md:text-2xl font-black text-rose-600 leading-tight">-{globalStats.expense.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
          </div>
          <div className="bg-rose-50 p-3 rounded-2xl text-rose-600"><TrendingDown size={24} /></div>
        </div>

        <div className={`bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between overflow-hidden relative`}>
          <div className={`absolute top-0 left-0 w-1 h-full ${globalStats.periodBalance >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Ahorro Periodo</p>
            <p className={`text-xl md:text-2xl font-black leading-tight ${globalStats.periodBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {globalStats.periodBalance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', signDisplay: 'always' })}
            </p>
          </div>
          <div className={`p-3 rounded-2xl ${globalStats.periodBalance >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            <Scale size={24} />
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100">
           <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-widest flex items-center gap-2"><TrendingUp size={16} className="text-emerald-500"/> Evolución</h3>
           <div className="h-[250px] md:h-[300px]">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                  <Bar dataKey="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-widest flex items-center gap-2"><ListFilter size={16} className="text-blue-500"/> Gastos por Familia</h3>
            <div className="h-[250px] md:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={expenseByFamilyData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {expenseByFamilyData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>

      {/* Detailed Table Hierarchy */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Desglose Detallado</h3>
          </div>
          <div className="divide-y divide-slate-100">
              {hierarchicalData.map((item) => (
                  <div key={item.family.id} className="bg-white">
                      <div className="flex items-center justify-between p-4 cursor-pointer active:bg-slate-50 transition-colors" onClick={() => setExpandedFamilies(p => ({...p, [item.family.id]: !p[item.family.id]}))}>
                          <div className="flex items-center gap-3">
                              <div className="p-1.5 bg-slate-100 rounded-lg">{renderIcon(item.family.icon)}</div>
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800 text-sm">{item.family.name}</span>
                                <span className={`text-[10px] font-black uppercase ${item.family.type === 'INCOME' ? 'text-emerald-500' : 'text-rose-500'}`}>{item.family.type === 'INCOME' ? 'Ingreso' : 'Gasto'}</span>
                              </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-800">{item.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                            {expandedFamilies[item.family.id] ? <ChevronDown size={18} className="text-slate-300"/> : <ChevronRight size={18} className="text-slate-300"/>}
                          </div>
                      </div>
                      {expandedFamilies[item.family.id] && (
                          <div className="bg-slate-50/50 border-t border-slate-50 animate-in slide-in-from-top-2 duration-200">
                              {item.categories.map(sub => (
                                  <div key={sub.category.id} className="flex items-center justify-between py-3 pl-14 pr-4 text-xs hover:bg-slate-100">
                                      <div className="flex items-center gap-2">
                                          {renderIcon(sub.category.icon)}
                                          <span className="text-slate-600 font-medium">{sub.category.name}</span>
                                      </div>
                                      <span className="text-slate-700 font-bold">{sub.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              ))}
              {hierarchicalData.length === 0 && (
                <div className="p-12 text-center text-slate-400 italic">
                  No hay datos para este periodo.
                </div>
              )}
          </div>
      </div>
    </div>
  );
};