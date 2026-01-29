
import React, { useMemo, useState } from 'react';
import { AppState, Family, Category } from './types';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
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

  const renderIcon = (iconStr: string, size = "w-8 h-8", textSize = "text-2xl") => {
      if (iconStr.startsWith('data:image') || iconStr.startsWith('http')) return <img src={iconStr} className={`${size} object-contain`} />;
      return <span className={textSize}>{iconStr}</span>;
  }

  return (
    <div className="space-y-12">
      {/* Header Sección con Control de Tiempo */}
      <div className="flex flex-col xl:flex-row justify-between xl:items-end gap-10">
        <div className="space-y-4">
            <div className="flex items-center gap-4 text-indigo-600 font-black uppercase tracking-[0.4em] text-xs">
                <Calendar size={18} /> Control Temporal
            </div>
            <h2 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter leading-none">
                Estado <br className="hidden md:block"/> Financiero.
            </h2>
            <div className="flex items-center gap-6 mt-4">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigatePeriod('prev')} className="w-14 h-14 flex items-center justify-center bg-white border-2 border-slate-100 rounded-2xl hover:bg-slate-50 transition-all shadow-sm active:scale-90"><ChevronLeft size={28} /></button>
                    <button onClick={() => navigatePeriod('next')} className="w-14 h-14 flex items-center justify-center bg-white border-2 border-slate-100 rounded-2xl hover:bg-slate-50 transition-all shadow-sm active:scale-90"><ChevronRight size={28} /></button>
                </div>
                <div>
                    <p className="text-2xl font-black text-slate-800 tracking-tight">{periodLabel}</p>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Periodo de análisis actual</p>
                </div>
            </div>
        </div>

        <div className="bg-slate-100/80 p-2 rounded-[2rem] flex flex-wrap gap-1 shadow-inner backdrop-blur-sm border border-slate-200/50 w-fit">
            {['MONTH', 'QUARTER', 'YEAR', 'CUSTOM'].map((range) => (
                <button 
                    key={range}
                    onClick={() => { setTimeRange(range as any); if(range !== 'CUSTOM') setReferenceDate(new Date()); }}
                    className={`px-8 py-4 text-xs font-black uppercase tracking-widest rounded-[1.5rem] transition-all ${timeRange === range ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    {range === 'MONTH' ? 'Mes' : range === 'QUARTER' ? 'Trimestre' : range === 'YEAR' ? 'Año' : 'Personalizar'}
                </button>
            ))}
        </div>
      </div>

      {/* Grid de Estadísticas con diseño neumórfico sutil */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {[
            { label: 'Balance Global', val: globalStats.balance, color: 'text-indigo-600', icon: <Banknote size={32}/>, bg: 'bg-indigo-50' },
            { label: 'Ingresos', val: globalStats.income, color: 'text-emerald-600', icon: <TrendingUp size={32}/>, bg: 'bg-emerald-50', prefix: '+' },
            { label: 'Gastos', val: globalStats.expense, color: 'text-rose-600', icon: <TrendingDown size={32}/>, bg: 'bg-rose-50', prefix: '-' },
            { label: 'Margen Neto', val: globalStats.periodBalance, color: globalStats.periodBalance >= 0 ? 'text-indigo-600' : 'text-rose-600', icon: <Scale size={32}/>, bg: globalStats.periodBalance >= 0 ? 'bg-indigo-50' : 'bg-rose-50' }
        ].map((stat, i) => (
            <div key={i} className="bg-white p-10 rounded-[3.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.02)] border border-slate-100 flex flex-col justify-between min-h-[220px] group hover:-translate-y-2 transition-transform duration-500">
                <div className={`${stat.bg} ${stat.color} w-20 h-20 rounded-[2rem] flex items-center justify-center shadow-inner mb-6`}>
                    {stat.icon}
                </div>
                <div>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">{stat.label}</p>
                    <p className={`text-3xl md:text-4xl font-black tracking-tighter ${stat.color}`}>
                        {stat.prefix}{stat.val.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                    </p>
                </div>
            </div>
        ))}
      </div>

      {/* Gráficos de Gran Formato */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 bg-white p-12 rounded-[4.5rem] shadow-sm border border-slate-100">
            <h3 className="text-xl font-black text-slate-800 mb-10 uppercase tracking-widest flex items-center gap-4">
                <ListFilter className="text-indigo-500" /> Desglose por Agrupadores
            </h3>
            <div className="space-y-8">
                {hierarchicalData.map((item) => (
                    <div key={item.family.id} className="group">
                        <div 
                            className="flex items-center justify-between p-8 rounded-[2.5rem] bg-slate-50/50 hover:bg-white hover:shadow-2xl hover:scale-[1.02] cursor-pointer transition-all border border-transparent hover:border-indigo-100"
                            onClick={() => setExpandedFamilies(p => ({...p, [item.family.id]: !p[item.family.id]}))}
                        >
                            <div className="flex items-center gap-6">
                                <div className="w-20 h-20 bg-white rounded-3xl shadow-lg flex items-center justify-center border border-slate-50 group-hover:rotate-3 transition-transform">
                                    {renderIcon(item.family.icon)}
                                </div>
                                <div>
                                    <p className="text-2xl font-black text-slate-900 tracking-tighter">{item.family.name}</p>
                                    <p className={`text-xs font-bold uppercase tracking-widest ${item.family.type === 'INCOME' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        {item.family.type === 'INCOME' ? 'Flujo de Entrada' : 'Flujo de Salida'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-6">
                                <span className="text-2xl font-black text-slate-800 tracking-tight">
                                    {item.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                </span>
                                <div className={`w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center transition-transform ${expandedFamilies[item.family.id] ? 'rotate-180' : ''}`}>
                                    <ChevronDown size={20} className="text-slate-400" />
                                </div>
                            </div>
                        </div>
                        {expandedFamilies[item.family.id] && (
                            <div className="mt-4 px-8 space-y-4 animate-in slide-in-from-top-4 duration-300">
                                {item.categories.map((sub: any) => (
                                    <div key={sub.category.id} className="flex items-center justify-between p-6 bg-white border-2 border-slate-50 rounded-3xl hover:border-indigo-100 transition-colors">
                                        <div className="flex items-center gap-4">
                                            {renderIcon(sub.category.icon, "w-6 h-6", "text-lg")}
                                            <span className="font-bold text-slate-600">{sub.category.name}</span>
                                        </div>
                                        <span className="font-black text-slate-800">{sub.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>

        <div className="bg-slate-900 p-12 rounded-[4.5rem] shadow-2xl flex flex-col items-center justify-center text-center space-y-10">
            <h3 className="text-indigo-400 text-xs font-black uppercase tracking-[0.5em]">Composición de Gastos</h3>
            <div className="h-[400px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={expenseByFamilyData} cx="50%" cy="50%" innerRadius={100} outerRadius={140} paddingAngle={8} dataKey="value">
                            {expenseByFamilyData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', background: '#fff', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }} />
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Total Gastado</p>
                    <p className="text-white text-3xl font-black tracking-tighter">-{globalStats.expense.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}</p>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4 w-full">
                {expenseByFamilyData.slice(0, 4).map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full shadow-lg" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                        <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest truncate">{item.name}</span>
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};
