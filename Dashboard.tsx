
import React, { useMemo, useState } from 'react';
import { AppState, Family, Category } from './types';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Banknote, ChevronDown, ChevronRight, ChevronLeft, ListFilter, Scale, Calendar } from 'lucide-react';

interface DashboardProps {
  data: AppState;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#3b82f6'];

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
    if (timeRange === 'YEAR') return `${referenceDate.getFullYear()}`;
    if (timeRange === 'CUSTOM') {
      return `${dateFilter.start.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} - ${dateFilter.end.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return '';
  }, [timeRange, referenceDate, dateFilter]);

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
    transactions.filter(t => {
      const tDate = new Date(t.date);
      return tDate >= dateFilter.start && tDate <= dateFilter.end;
    }).forEach(t => {
      if (t.type === 'INCOME') periodIncome += t.amount;
      if (t.type === 'EXPENSE') periodExpense += t.amount;
    });
    
    return { income: periodIncome, expense: periodExpense, balance: currentTotalBalance, periodBalance: periodIncome - periodExpense };
  }, [transactions, dateFilter, accounts]);

  const expenseByFamilyData = useMemo(() => {
    const map = new Map<string, number>();
    transactions.filter(t => {
      const tDate = new Date(t.date);
      return tDate >= dateFilter.start && tDate <= dateFilter.end && t.type === 'EXPENSE';
    }).forEach(t => {
      const family = families.find(f => f.id === t.familyId);
      const name = family ? family.name : 'Otros';
      map.set(name, (map.get(name) || 0) + t.amount);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  }, [transactions, dateFilter, families]);

  const hierarchicalData = useMemo(() => {
      const data: any[] = [];
      const periodTxs = transactions.filter(t => {
          const tDate = new Date(t.date);
          return tDate >= dateFilter.start && tDate <= dateFilter.end;
      });

      families.forEach(fam => {
          const famTxs = periodTxs.filter(t => t.familyId === fam.id);
          const totalFam = famTxs.reduce((sum, t) => sum + t.amount, 0);
          if (totalFam > 0) {
              const famCats: any[] = [];
              categories.filter(c => c.familyId === fam.id).forEach(cat => {
                  const catTotal = famTxs.filter(t => t.categoryId === cat.id).reduce((sum, t) => sum + t.amount, 0);
                  if (catTotal > 0) famCats.push({ category: cat, total: catTotal });
              });
              famCats.sort((a,b) => b.total - a.total);
              data.push({ family: fam, total: totalFam, categories: famCats });
          }
      });
      return data.sort((a,b) => b.total - a.total);
  }, [families, categories, transactions, dateFilter]);

  const renderIcon = (iconStr: string, size = "w-8 h-8", textSize = "text-xl") => {
      if (iconStr.startsWith('data:image') || iconStr.startsWith('http')) return <img src={iconStr} className={`${size} object-contain`} />;
      return <span className={textSize}>{iconStr}</span>;
  }

  return (
    <div className="space-y-8 md:space-y-12 max-w-full">
      {/* Header Responsivo */}
      <div className="flex flex-col xl:flex-row justify-between xl:items-end gap-8">
        <div className="space-y-4 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-4 text-indigo-600 font-black uppercase tracking-[0.4em] text-[10px]">
                <Calendar size={16} /> Control Temporal
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 tracking-tighter leading-tight mb-2">
                Estado <br className="hidden md:block"/> Financiero.
            </h2>
            <div className="flex flex-col sm:flex-row items-center gap-4 mt-2 justify-center md:justify-start">
                <div className="flex items-center gap-2">
                    <button onClick={() => navigatePeriod('prev')} className="w-10 h-10 flex items-center justify-center bg-white border-2 border-slate-100 rounded-xl hover:bg-slate-50 transition-all shadow-sm active:scale-90"><ChevronLeft size={20} /></button>
                    <button onClick={() => navigatePeriod('next')} className="w-10 h-10 flex items-center justify-center bg-white border-2 border-slate-100 rounded-xl hover:bg-slate-50 transition-all shadow-sm active:scale-90"><ChevronRight size={20} /></button>
                </div>
                <div className="text-center sm:text-left">
                    <p className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">{periodLabel}</p>
                </div>
            </div>
        </div>

        <div className="bg-slate-100/80 p-1 rounded-[1.25rem] flex flex-wrap justify-center gap-1 shadow-inner backdrop-blur-sm border border-slate-200/50 w-full sm:w-fit mx-auto xl:mx-0">
            {['MONTH', 'QUARTER', 'YEAR', 'CUSTOM'].map((range) => (
                <button 
                    key={range}
                    onClick={() => { setTimeRange(range as any); if(range !== 'CUSTOM') setReferenceDate(new Date()); }}
                    className={`flex-1 sm:flex-none px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${timeRange === range ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                >
                    {range === 'MONTH' ? 'Mes' : range === 'QUARTER' ? 'Trim' : range === 'YEAR' ? 'Año' : 'Pers'}
                </button>
            ))}
        </div>
      </div>

      {/* Grid de Estadísticas Adaptativo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[
            { label: 'Balance Global', val: globalStats.balance, color: 'text-indigo-600', icon: <Banknote size={24}/>, bg: 'bg-indigo-50' },
            { label: 'Ingresos', val: globalStats.income, color: 'text-emerald-600', icon: <TrendingUp size={24}/>, bg: 'bg-emerald-50', prefix: '+' },
            { label: 'Gastos', val: globalStats.expense, color: 'text-rose-600', icon: <TrendingDown size={24}/>, bg: 'bg-rose-50', prefix: '-' },
            { label: 'Margen Neto', val: globalStats.periodBalance, color: globalStats.periodBalance >= 0 ? 'text-indigo-600' : 'text-rose-600', icon: <Scale size={24}/>, bg: globalStats.periodBalance >= 0 ? 'bg-indigo-50' : 'bg-rose-50' }
        ].map((stat, i) => (
            <div key={i} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-between min-h-[150px]">
                <div className={`${stat.bg} ${stat.color} w-12 h-12 rounded-xl flex items-center justify-center mb-4`}>
                    {stat.icon}
                </div>
                <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                    <p className={`text-xl font-black tracking-tight ${stat.color}`}>
                        {stat.prefix}{stat.val.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                    </p>
                </div>
            </div>
        ))}
      </div>

      {/* Visualizaciones en Tablets/Móviles */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-10">
        <div className="lg:col-span-2 bg-white p-5 sm:p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <h3 className="text-md font-black text-slate-800 mb-6 uppercase tracking-widest flex items-center gap-3">
                <ListFilter className="text-indigo-500" size={18} /> Detalle de Agrupadores
            </h3>
            <div className="space-y-3">
                {hierarchicalData.map((item) => (
                    <div key={item.family.id} className="group">
                        <div 
                            className="flex items-center justify-between p-4 rounded-[1.25rem] bg-slate-50 hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-indigo-100 cursor-pointer"
                            onClick={() => setExpandedFamilies(p => ({...p, [item.family.id]: !p[item.family.id]}))}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center border border-slate-100">
                                    {renderIcon(item.family.icon, "w-6 h-6", "text-lg")}
                                </div>
                                <div>
                                    <p className="text-sm font-black text-slate-900 tracking-tight">{item.family.name}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-black text-slate-800 tracking-tight">
                                    {item.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                </span>
                                <ChevronDown size={16} className={`text-slate-400 transition-transform ${expandedFamilies[item.family.id] ? 'rotate-180' : ''}`} />
                            </div>
                        </div>
                        {expandedFamilies[item.family.id] && (
                            <div className="mt-2 px-3 space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                                {item.categories.map((sub: any) => (
                                    <div key={sub.category.id} className="flex items-center justify-between p-3 bg-white border border-slate-50 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            {renderIcon(sub.category.icon, "w-4 h-4", "text-xs")}
                                            <span className="text-[10px] font-bold text-slate-600">{sub.category.name}</span>
                                        </div>
                                        <span className="text-xs font-black text-slate-800">{sub.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>

        <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl flex flex-col items-center justify-center text-center">
            <h3 className="text-indigo-400 text-[9px] font-black uppercase tracking-[0.4em] mb-8">Estructura de Gastos</h3>
            <div className="h-[250px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={expenseByFamilyData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value">
                            {expenseByFamilyData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-slate-500 text-[8px] font-black uppercase tracking-widest">Gasto</p>
                    <p className="text-white text-lg font-black tracking-tight">-{globalStats.expense.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}</p>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3 w-full mt-6">
                {expenseByFamilyData.slice(0, 4).map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                        <span className="text-slate-400 text-[8px] font-black uppercase tracking-widest truncate">{item.name}</span>
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};
