import React, { useMemo, useState } from 'react';
import { AppState, GlobalFilter, BookMetadata } from '../types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, LineChart, Line, Legend, ReferenceLine } from 'recharts';
import { TrendingUp, PieChart as PieIcon, LineChart as LineIcon, ChevronRight, ArrowDownCircle, ArrowUpCircle, ChevronLeft, Home, BarChart3, Grip } from 'lucide-react';

interface ChartsViewProps {
  data: AppState;
  filter: GlobalFilter;
  onUpdateFilter: (f: GlobalFilter) => void;
  currentBook: BookMetadata;
}

// Colors for Pie/Line charts
const COLORS = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
const NUMBER_FORMATTER = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const compactCurrency = (value: number) => {
    if (Math.abs(value) >= 1000) {
        return (value / 1000).toFixed(1) + 'k';
    }
    return value.toString();
};

const formatCurrency = (amount: number) => `${NUMBER_FORMATTER.format(amount)} €`;

// View State Management
type ViewLevel = 'ROOT' | 'TYPE' | 'FAMILY' | 'CATEGORY';
interface ViewState {
    level: ViewLevel;
    type?: 'INCOME' | 'EXPENSE';
    famId?: string;
    catId?: string;
}

export const ChartsView: React.FC<ChartsViewProps> = ({ data, currentBook }) => {
  const [chartType, setChartType] = useState<'PIE' | 'LINE'>('PIE');
  
  // Navigation State
  const [viewState, setViewState] = useState<ViewState>({ level: 'ROOT' });

  // --- LOCAL INDEPENDENT FILTER STATE ---
  const [localFilter, setLocalFilter] = useState<GlobalFilter>(() => {
      const now = new Date();
      // Default to current year if not set
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      const fmt = (d: Date) => d.toISOString().split('T')[0];
      return {
          timeRange: 'YEAR',
          referenceDate: now,
          customStart: fmt(start),
          customEnd: fmt(end)
      };
  });

  const years = Array.from({length: new Date().getFullYear() - 2015 + 5}, (_, i) => 2015 + i);
  const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const monthShorts = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  const navigatePeriod = (direction: 'prev' | 'next') => {
    const newDate = new Date(localFilter.referenceDate);
    const step = direction === 'next' ? 1 : -1;
    if (localFilter.timeRange === 'MONTH') newDate.setMonth(newDate.getMonth() + step);
    else if (localFilter.timeRange === 'YEAR') newDate.setFullYear(newDate.getFullYear() + step);
    setLocalFilter({ ...localFilter, referenceDate: newDate });
  };

  const displayLogo = useMemo(() => {
    let logo = currentBook.logo;
    if (logo && logo.startsWith('/api/')) return `${logo}&key=${localStorage.getItem('auth_token')}`;
    return logo || localStorage.getItem('contamiki_custom_logo') || "/contamiki.jpg";
  }, [currentBook.logo]);

  // --- DATE BOUNDS & GRANULARITY ---
  const { dateBounds, isMonthlyGranularity } = useMemo(() => {
    const y = localFilter.referenceDate.getFullYear();
    const m = localFilter.referenceDate.getMonth();
    let start = '', end = '';
    
    // Determine bounds
    if (localFilter.timeRange === 'MONTH') {
      start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      end = `${y}-${String(m + 1).padStart(2, '0')}-${new Date(y, m + 1, 0).getDate()}`;
    } else if (localFilter.timeRange === 'YEAR') {
      start = `${y}-01-01`; end = `${y}-12-31`;
    } else {
      start = localFilter.customStart || '1900-01-01'; end = localFilter.customEnd || '2100-12-31';
    }

    // Determine Granularity: If filter is MONTH -> Daily granularity. Else -> Monthly granularity.
    const isMonthlyGranularity = localFilter.timeRange === 'MONTH';

    return { dateBounds: { start, end }, isMonthlyGranularity };
  }, [localFilter]);

  // Helpers for formatting
  const getGranularityKey = (dateStr: string) => {
      // If monthly view, key is full date (YYYY-MM-DD). If year/all, key is Month (YYYY-MM)
      return isMonthlyGranularity ? dateStr : dateStr.substring(0, 7);
  };

  const formatKeyDisplay = (key: string) => {
      if (!key) return '';
      if (isMonthlyGranularity) {
          const d = new Date(key);
          return `${d.getDate()}`; // Just the day number for cleaner X-axis in monthly view
      } else {
          const [y, m] = key.split('-');
          return monthShorts[parseInt(m) - 1]; // Month Name
      }
  };

  const formatKeyTooltip = (key: string) => {
      if (!key) return '';
      if (isMonthlyGranularity) {
          const d = new Date(key);
          return `${d.getDate()} de ${months[d.getMonth()]}`;
      } else {
          const [y, m] = key.split('-');
          return `${months[parseInt(m) - 1]} ${y}`;
      }
  };

  const renderIcon = (iconStr: string, className = "w-6 h-6") => {
    if (iconStr?.startsWith('http') || iconStr?.startsWith('data:image')) {
        return <img src={iconStr} className={`${className} object-contain rounded-lg`} referrerPolicy="no-referrer" />;
    }
    return <span className="text-xl">{iconStr || '🔹'}</span>;
  };

  // --- DATA ENGINE: SAVINGS (Patrimonio) ---
  const savingsData = useMemo(() => {
    const timeline = new Map<string, number>();
    const sortedTx = [...data.transactions].sort((a, b) => a.date.localeCompare(b.date));
    let runningBalance = data.accounts.reduce((acc, a) => acc + a.initialBalance, 0);
    
    sortedTx.forEach(t => {
      let amt = t.amount; // Use raw signed amount
      const isInternal = t.type === 'TRANSFER' && t.transferAccountId && data.accounts.find(a=>a.id===t.transferAccountId);
      if (isInternal) amt = 0;

      if (t.date < dateBounds.start) {
         runningBalance += amt;
      } else if (t.date <= dateBounds.end) {
         runningBalance += amt;
         // For savings chart, we always use the granularity determined by filter
         // BUT standard area chart often looks better with full date if points are sparse, 
         // however to match the request logic, let's align with the filter
         const key = isMonthlyGranularity ? t.date : (t.date.substring(0, 7) + '-01'); 
         timeline.set(key, runningBalance);
      }
    });

    let result: any[] = Array.from(timeline.entries()).map(([date, balance]) => ({ date, balance, projection: null })).sort((a, b) => a.date.localeCompare(b.date));
    
    // Simple projection logic
    if (result.length > 3) {
        const n = result.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        result.forEach((p, i) => { sumX += i; sumY += p.balance; sumXY += i * p.balance; sumXX += i * i; });
        const denominator = n * sumXX - sumX * sumX;
        if (denominator !== 0) {
            const slope = (n * sumXY - sumX * sumY) / denominator;
            const intercept = (sumY - slope * sumX) / n;
            const lastRealPoint = result[result.length - 1];
            lastRealPoint.projection = lastRealPoint.balance; 
            const lastDate = new Date(lastRealPoint.date);
            for (let i = 1; i <= 3; i++) {
                lastDate.setMonth(lastDate.getMonth() + 1);
                const nextVal = slope * (n + i) + intercept;
                result.push({ date: lastDate.toISOString().split('T')[0], balance: null, projection: nextVal, isProjection: true });
            }
        }
    }
    return result;
  }, [data.transactions, dateBounds, data.accounts, isMonthlyGranularity]);

  // --- DATA ENGINE: DRILL DOWN (Core Logic) ---
  const chartData = useMemo(() => {
      // 1. Filter Transactions for Period
      const relevantTx = data.transactions.filter(t => 
          t.date >= dateBounds.start && 
          t.date <= dateBounds.end && 
          t.type !== 'TRANSFER'
      );

      // Prepare structures
      const timeSeriesMap = new Map<string, { [key: string]: number }>();
      const aggregateMap = new Map<string, { id: string, name: string, value: number, icon: string, color?: string }>();

      // Helpers
      const getFam = (id: string) => data.families.find(f => f.id === id);
      const getCat = (id: string) => data.categories.find(c => c.id === id);

      // --- LEVEL 0: ROOT (Income vs Expense Lines) ---
      if (viewState.level === 'ROOT') {
          relevantTx.forEach(t => {
              const timeKey = getGranularityKey(t.date);
              
              // Determine if it acts as Income or Expense based on CATEGORY FAMILY TYPE
              // This is crucial: A positive amount in an EXPENSE family is a refund (reduces expense).
              const cat = getCat(t.categoryId);
              const fam = cat ? getFam(cat.familyId) : null;
              
              if (!fam) return;

              if (!timeSeriesMap.has(timeKey)) timeSeriesMap.set(timeKey, { date: timeKey as any, income: 0, expense: 0 });
              const point = timeSeriesMap.get(timeKey)!;

              if (fam.type === 'INCOME') {
                  // Income families: Sum raw amount (usually positive)
                  point.income += t.amount;
              } else {
                  // Expense families: Sum raw amount (usually negative), then flip for display
                  // We sum raw first to handle refunds correctly
                  // Note: We store the raw SUM here, we will flip later or handle logic below
                  // Actually, for the chart we want "Total Expense" to be a positive number representing magnitude
                  // So we subtract the amount (since expenses are negative). 
                  // If t.amount is -50, -= -50 is +50. If t.amount is +10 (refund), -= 10 is -10. Correct.
                  point.expense -= t.amount; 
              }
          });

          // Aggregate totals for potential summary cards
          const totalIncome = relevantTx.reduce((acc, t) => {
              const f = getFam(getCat(t.categoryId)?.familyId || '');
              return (f?.type === 'INCOME') ? acc + t.amount : acc;
          }, 0);
          
          const totalExpense = relevantTx.reduce((acc, t) => {
              const f = getFam(getCat(t.categoryId)?.familyId || '');
              return (f?.type === 'EXPENSE') ? acc - t.amount : acc;
          }, 0);

          // For ROOT, aggregateMap isn't used for Pie, but we can use it for summary buttons
          aggregateMap.set('INCOME', { id: 'INCOME', name: 'Ingresos', value: totalIncome, icon: '💰' });
          aggregateMap.set('EXPENSE', { id: 'EXPENSE', name: 'Gastos', value: totalExpense, icon: '💸' });

      } 
      // --- LEVEL 1: TYPE (Families Breakdown) ---
      else if (viewState.level === 'TYPE' && viewState.type) {
          const targetType = viewState.type;
          
          relevantTx.forEach(t => {
              const cat = getCat(t.categoryId);
              const fam = cat ? getFam(cat.familyId) : null;
              
              if (fam && fam.type === targetType) {
                  // Processing
                  const val = targetType === 'EXPENSE' ? -t.amount : t.amount;
                  const timeKey = getGranularityKey(t.date);

                  // Time Series
                  if (!timeSeriesMap.has(timeKey)) timeSeriesMap.set(timeKey, { date: timeKey as any });
                  const point = timeSeriesMap.get(timeKey)!;
                  point[fam.name] = (point[fam.name] || 0) + val;

                  // Aggregate (Pie)
                  if (!aggregateMap.has(fam.id)) {
                      aggregateMap.set(fam.id, { id: fam.id, name: fam.name, value: 0, icon: fam.icon });
                  }
                  aggregateMap.get(fam.id)!.value += val;
              }
          });
      }
      // --- LEVEL 2: FAMILY (Categories Breakdown) ---
      else if (viewState.level === 'FAMILY' && viewState.famId) {
          const targetFam = getFam(viewState.famId);
          const isExpense = targetFam?.type === 'EXPENSE';

          relevantTx.forEach(t => {
              const cat = getCat(t.categoryId);
              if (cat && cat.familyId === viewState.famId) {
                  const val = isExpense ? -t.amount : t.amount;
                  const timeKey = getGranularityKey(t.date);

                  if (!timeSeriesMap.has(timeKey)) timeSeriesMap.set(timeKey, { date: timeKey as any });
                  const point = timeSeriesMap.get(timeKey)!;
                  point[cat.name] = (point[cat.name] || 0) + val;

                  if (!aggregateMap.has(cat.id)) {
                      aggregateMap.set(cat.id, { id: cat.id, name: cat.name, value: 0, icon: cat.icon });
                  }
                  aggregateMap.get(cat.id)!.value += val;
              }
          });
      }
      // --- LEVEL 3: CATEGORY (Single Line) ---
      else if (viewState.level === 'CATEGORY' && viewState.catId) {
          const targetCat = getCat(viewState.catId);
          const fam = targetCat ? getFam(targetCat.familyId) : null;
          const isExpense = fam?.type === 'EXPENSE';

          relevantTx.forEach(t => {
              if (t.categoryId === viewState.catId) {
                  const val = isExpense ? -t.amount : t.amount;
                  const timeKey = getGranularityKey(t.date);
                  
                  if (!timeSeriesMap.has(timeKey)) timeSeriesMap.set(timeKey, { date: timeKey as any, value: 0 });
                  const point = timeSeriesMap.get(timeKey)!;
                  point.value += val;
              }
          });
          // For aggregation (header info)
          const total = Array.from(timeSeriesMap.values()).reduce((acc, p) => acc + p.value, 0);
          aggregateMap.set(viewState.catId, { id: viewState.catId, name: targetCat?.name || '', value: total, icon: targetCat?.icon || '' });
      }

      // Convert Maps to Arrays and Sort
      const sortedTimeSeries = Array.from(timeSeriesMap.values()).sort((a: any, b: any) => a.date.localeCompare(b.date));
      const sortedAggregates = Array.from(aggregateMap.values()).sort((a, b) => b.value - a.value);

      // Identify dynamic keys for LineChart lines (e.g., family names or category names)
      let lineKeys: string[] = [];
      if (viewState.level === 'ROOT') lineKeys = ['income', 'expense'];
      else if (viewState.level === 'CATEGORY') lineKeys = ['value'];
      else {
          // For Families/Categories levels, keys are the names
          lineKeys = sortedAggregates.map(i => i.name);
      }

      return {
          timeData: sortedTimeSeries,
          pieData: sortedAggregates,
          lineKeys
      };

  }, [data.transactions, viewState, dateBounds, isMonthlyGranularity, data.categories, data.families]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-xl text-xs">
          <p className="font-black text-slate-500 mb-1">{formatKeyTooltip(label)}</p>
          {payload.map((p: any, idx: number) => (
            <div key={idx} className="flex items-center gap-2 font-bold" style={{ color: p.color || p.stroke || '#6366f1' }}>
              <span>{p.name}:</span>
              <span>{formatCurrency(p.value as number)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.05) return null;

    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-[10px] font-bold pointer-events-none">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  // Handlers
  const handleSliceClick = (entry: any) => {
      const item = entry.payload || entry; // Recharts payload or direct click
      if (viewState.level === 'ROOT') {
          // Handled by manual buttons, not chart click usually, but if line click:
          if (item.dataKey === 'income') setViewState({ level: 'TYPE', type: 'INCOME' });
          if (item.dataKey === 'expense') setViewState({ level: 'TYPE', type: 'EXPENSE' });
      } else if (viewState.level === 'TYPE') {
          setViewState({ ...viewState, level: 'FAMILY', famId: item.id });
      } else if (viewState.level === 'FAMILY') {
          setViewState({ ...viewState, level: 'CATEGORY', catId: item.id });
      }
  };

  const goBack = () => {
      if (viewState.level === 'CATEGORY') setViewState({ level: 'FAMILY', type: viewState.type, famId: viewState.famId });
      else if (viewState.level === 'FAMILY') setViewState({ level: 'TYPE', type: viewState.type });
      else if (viewState.level === 'TYPE') setViewState({ level: 'ROOT' });
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-20">
        {/* HEADER */}
        <div className="flex flex-col xl:flex-row justify-between xl:items-end gap-8">
            <div className="space-y-4 w-full xl:w-auto">
                <div className="flex items-center justify-center md:justify-start gap-6">
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-3xl shadow-sm border border-slate-100 p-1.5 shrink-0 overflow-hidden">
                        <img src={displayLogo} className="w-full h-full object-cover rounded-2xl" onError={(e) => e.currentTarget.src = "/contamiki.jpg"} />
                    </div>
                    <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter">Gráficos.</h2>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3 justify-center md:justify-start">
                    <div className="flex items-center gap-2">
                        <button onClick={() => navigatePeriod('prev')} className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm active:scale-90 transition-all"><ChevronLeft size={24} /></button>
                        <button onClick={() => navigatePeriod('next')} className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm active:scale-90 transition-all"><ChevronRight size={24} /></button>
                    </div>
                    <div className="bg-slate-100 p-2 rounded-2xl flex flex-wrap gap-1 shadow-inner border border-slate-200/50">
                        <button onClick={() => setLocalFilter({...localFilter, timeRange: 'ALL'})} className={`px-6 py-3 text-xs sm:text-sm font-black uppercase tracking-widest rounded-xl transition-all ${localFilter.timeRange === 'ALL' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Todo</button>
                        <div className={`px-5 py-3 rounded-xl transition-all flex items-center ${localFilter.timeRange === 'YEAR' ? 'bg-white shadow-sm' : ''}`}>{localFilter.timeRange === 'YEAR' ? (<select className="bg-transparent text-xs sm:text-sm font-black text-indigo-600 uppercase tracking-widest outline-none cursor-pointer py-1 min-w-[60px]" value={localFilter.referenceDate.getFullYear()} onChange={(e) => { const d = new Date(localFilter.referenceDate); d.setFullYear(parseInt(e.target.value)); setLocalFilter({...localFilter, timeRange: 'YEAR', referenceDate: d}); }}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select>) : (<button onClick={() => setLocalFilter({...localFilter, timeRange: 'YEAR'})} className="px-2 text-xs sm:text-sm font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">Año</button>)}</div>
                        <div className={`px-5 py-3 rounded-xl transition-all flex items-center gap-1 ${localFilter.timeRange === 'MONTH' ? 'bg-white shadow-sm' : ''}`}>{localFilter.timeRange === 'MONTH' ? (<div className="flex items-center gap-2"><select className="bg-transparent text-xs sm:text-sm font-black text-indigo-600 uppercase tracking-widest outline-none cursor-pointer py-1 min-w-[80px]" value={localFilter.referenceDate.getMonth()} onChange={(e) => { const d = new Date(localFilter.referenceDate); d.setMonth(parseInt(e.target.value)); setLocalFilter({...localFilter, timeRange: 'MONTH', referenceDate: d}); }}>{months.map((m, i) => <option key={i} value={i}>{m}</option>)}</select><span className="text-slate-300 text-xs font-black">/</span><select className="bg-transparent text-xs sm:text-sm font-black text-indigo-600 uppercase tracking-widest outline-none cursor-pointer py-1 min-w-[70px]" value={localFilter.referenceDate.getFullYear()} onChange={(e) => { const d = new Date(localFilter.referenceDate); d.setFullYear(parseInt(e.target.value)); setLocalFilter({...localFilter, timeRange: 'MONTH', referenceDate: d}); }}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select></div>) : (<button onClick={() => setLocalFilter({...localFilter, timeRange: 'MONTH'})} className="px-2 text-xs sm:text-sm font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">Mes</button>)}</div>
                        <div className={`px-5 py-3 rounded-xl transition-all flex items-center gap-2 ${localFilter.timeRange === 'CUSTOM' ? 'bg-white shadow-sm' : ''}`}>{localFilter.timeRange === 'CUSTOM' ? (<div className="flex items-center gap-2"><input type="date" className="bg-transparent text-xs sm:text-sm font-bold text-slate-700 outline-none w-28 sm:w-32 cursor-pointer py-1" value={localFilter.customStart} onChange={(e) => setLocalFilter({...localFilter, timeRange: 'CUSTOM', customStart: e.target.value})} /><span className="text-slate-300 text-[10px] font-black">➡</span><input type="date" className="bg-transparent text-xs sm:text-sm font-bold text-slate-700 outline-none w-28 sm:w-32 cursor-pointer py-1" value={localFilter.customEnd} onChange={(e) => setLocalFilter({...localFilter, timeRange: 'CUSTOM', customEnd: e.target.value})} /></div>) : (<button onClick={() => setLocalFilter({...localFilter, timeRange: 'CUSTOM'})} className="px-2 text-xs sm:text-sm font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">Pers.</button>)}</div>
                    </div>
                </div>
            </div>
        </div>

        {/* SECTION 1: SAVINGS EVOLUTION (Unchanged Logic, just visual match) */}
        <div className="bg-white p-6 md:p-10 rounded-[3rem] shadow-sm border border-slate-100">
            <div className="flex items-center gap-4 mb-8">
                <div className="bg-slate-950 p-3 rounded-2xl text-white"><TrendingUp size={20}/></div>
                <div><h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Patrimonio Neto</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Evolución de saldo acumulado</p></div>
            </div>
            {savingsData.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-300 opacity-50"><TrendingUp size={48}/><p className="text-[10px] font-black uppercase mt-4">Sin datos de evolución</p></div>
            ) : (
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={savingsData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs><linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="date" tickFormatter={(d) => isMonthlyGranularity ? new Date(d).getDate().toString() : monthShorts[new Date(d).getMonth()]} style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }} tickLine={false} axisLine={false} dy={10} minTickGap={30} />
                            <YAxis domain={['auto', 'auto']} tickFormatter={compactCurrency} style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }} tickLine={false} axisLine={false} width={40} />
                            <Tooltip content={<CustomTooltip />} />
                            <ReferenceLine x={savingsData.find(d => (d as any).isProjection)?.date} stroke="#cbd5e1" strokeDasharray="3 3" label={{ value: "Proyección", position: 'insideTopRight', fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
                            <Area type="monotone" dataKey="balance" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorBalance)" name="Patrimonio" connectNulls={false} />
                            <Area type="monotone" dataKey="projection" stroke="#94a3b8" strokeWidth={3} strokeDasharray="5 5" fillOpacity={0.5} fill="url(#colorBalance)" name="Proyección" connectNulls={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>

        {/* SECTION 2: DYNAMIC DRILL DOWN */}
        <div className="bg-white p-6 md:p-10 rounded-[3rem] shadow-sm border border-slate-100 min-h-[500px] flex flex-col">
            {/* Header & Navigation */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8 border-b border-slate-50 pb-6">
                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto scrollbar-hide">
                    {/* Level 0: Root */}
                    <button onClick={() => setViewState({ level: 'ROOT' })} className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${viewState.level === 'ROOT' ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:text-slate-600'}`}>
                        <Home size={14}/> <span className="text-[10px] font-black uppercase tracking-widest">Resumen</span>
                    </button>

                    {/* Level 1: Type */}
                    {viewState.level !== 'ROOT' && (
                        <>
                            <span className="text-slate-300"><ChevronRight size={14}/></span>
                            <button onClick={() => setViewState({ level: 'TYPE', type: viewState.type })} className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${viewState.level === 'TYPE' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-indigo-50 text-indigo-400 hover:text-indigo-600'}`}>
                                {viewState.type === 'INCOME' ? <ArrowUpCircle size={14}/> : <ArrowDownCircle size={14}/>}
                                <span className="text-[10px] font-black uppercase tracking-widest">{viewState.type === 'INCOME' ? 'Ingresos' : 'Gastos'}</span>
                            </button>
                        </>
                    )}

                    {/* Level 2: Family */}
                    {(viewState.level === 'FAMILY' || viewState.level === 'CATEGORY') && viewState.famId && (
                        <>
                            <span className="text-slate-300"><ChevronRight size={14}/></span>
                            <button onClick={() => setViewState({ level: 'FAMILY', type: viewState.type, famId: viewState.famId })} className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${viewState.level === 'FAMILY' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-indigo-50 text-indigo-400 hover:text-indigo-600'}`}>
                                {renderIcon(data.families.find(f=>f.id===viewState.famId)?.icon || '', "w-4 h-4")} 
                                <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">{data.families.find(f=>f.id===viewState.famId)?.name}</span>
                            </button>
                        </>
                    )}

                    {/* Level 3: Category */}
                    {viewState.level === 'CATEGORY' && viewState.catId && (
                        <>
                            <span className="text-slate-300"><ChevronRight size={14}/></span>
                            <div className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl shadow-lg animate-in slide-in-from-left-2">
                                {renderIcon(data.categories.find(c=>c.id===viewState.catId)?.icon || '', "w-4 h-4")} 
                                <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">{data.categories.find(c=>c.id===viewState.catId)?.name}</span>
                            </div>
                        </>
                    )}
                </div>

                {/* Controls */}
                <div className="flex items-center gap-4">
                    {/* View Toggles for Root */}
                    {viewState.level === 'ROOT' && (
                        <div className="flex gap-2">
                            <button onClick={() => setViewState({ level: 'TYPE', type: 'INCOME' })} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all border border-emerald-100">
                                <BarChart3 size={14}/> Detalle Ingresos
                            </button>
                            <button onClick={() => setViewState({ level: 'TYPE', type: 'EXPENSE' })} className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all border border-rose-100">
                                <BarChart3 size={14}/> Detalle Gastos
                            </button>
                        </div>
                    )}
                    
                    {/* Chart Type Toggle (Hidden for Root/Category as they are usually Line) */}
                    {(viewState.level === 'TYPE' || viewState.level === 'FAMILY') && (
                        <div className="flex bg-slate-50 border border-slate-100 rounded-xl p-1">
                            <button onClick={() => setChartType('PIE')} className={`p-2 rounded-lg transition-all ${chartType === 'PIE' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:text-indigo-600'}`}><PieIcon size={16}/></button>
                            <button onClick={() => setChartType('LINE')} className={`p-2 rounded-lg transition-all ${chartType === 'LINE' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:text-indigo-600'}`}><LineIcon size={16}/></button>
                        </div>
                    )}
                </div>
            </div>

            {/* CHART RENDERER */}
            {chartData.timeData.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-300 opacity-50"><PieIcon size={48}/><p className="text-[10px] font-black uppercase mt-4">Sin datos en este periodo</p></div>
            ) : (
                <div className="flex-1 h-[400px] w-full animate-in fade-in duration-300 relative">
                    <ResponsiveContainer width="100%" height="100%">
                        {(viewState.level === 'ROOT' || viewState.level === 'CATEGORY' || chartType === 'LINE') ? (
                            <LineChart data={chartData.timeData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" tickFormatter={formatKeyDisplay} style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }} tickLine={false} axisLine={false} dy={10} minTickGap={30} />
                                <YAxis tickFormatter={compactCurrency} style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }} tickLine={false} axisLine={false} width={40} />
                                <Tooltip 
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-xl text-xs">
                                                    <p className="font-black text-slate-500 mb-2">{formatKeyTooltip(label)}</p>
                                                    {payload.map((p: any, idx: number) => (
                                                        <div key={idx} style={{ color: p.color }} className="flex items-center gap-2 font-bold uppercase">
                                                            <span>{p.name === 'income' ? 'Ingresos' : p.name === 'expense' ? 'Gastos' : p.name}:</span>
                                                            <span>{formatCurrency(p.value as number)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '20px' }} formatter={(val) => val === 'income' ? 'Ingresos' : val === 'expense' ? 'Gastos' : val} />
                                
                                {chartData.lineKeys.map((key, idx) => {
                                    // Custom colors for Root
                                    let stroke = COLORS[idx % COLORS.length];
                                    if (key === 'income') stroke = '#10b981';
                                    if (key === 'expense') stroke = '#f43f5e';
                                    if (key === 'value') stroke = '#6366f1'; // Single category line

                                    return (
                                        <Line 
                                            key={key} 
                                            type="monotone" 
                                            dataKey={key} 
                                            stroke={stroke} 
                                            strokeWidth={3} 
                                            dot={false} 
                                            activeDot={{ r: 6 }} 
                                            connectNulls 
                                        />
                                    );
                                })}
                            </LineChart>
                        ) : (
                            <PieChart>
                                <Pie
                                    data={chartData.pieData}
                                    cx="50%" cy="50%"
                                    innerRadius={80} outerRadius={120}
                                    paddingAngle={5}
                                    dataKey="value"
                                    label={renderCustomLabel}
                                    labelLine={false}
                                    onClick={handleSliceClick}
                                    cursor="pointer"
                                >
                                    {chartData.pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                                    ))}
                                </Pie>
                                <Tooltip content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const p = payload[0].payload;
                                        return (
                                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-xl text-xs">
                                                <div className="flex items-center gap-2 font-bold text-slate-700">
                                                    {renderIcon(p.icon, "w-4 h-4")} 
                                                    <span>{p.name}: {formatCurrency(p.value as number)}</span>
                                                </div>
                                                <p className="text-[9px] text-slate-400 mt-1 uppercase font-black tracking-widest">Click para desglosar</p>
                                            </div>
                                        );
                                    }
                                    return null;
                                }} />
                                <Legend 
                                    verticalAlign="bottom" height={60} 
                                    content={(props) => (
                                        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-4 max-h-24 overflow-y-auto custom-scrollbar p-2">
                                            {props.payload?.map((entry: any, index: number) => (
                                                <div key={`item-${index}`} className="flex items-center gap-1.5 cursor-pointer opacity-80 hover:opacity-100 transition-opacity" onClick={() => handleSliceClick(chartData.pieData[index])}>
                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}/>
                                                    <span className="text-[9px] font-bold text-slate-600 uppercase">{entry.value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                />
                            </PieChart>
                        )}
                    </ResponsiveContainer>
                    
                    {/* Back Button Overlay for drill down levels */}
                    {viewState.level !== 'ROOT' && (
                        <button onClick={goBack} className="absolute top-0 left-0 p-2 bg-white/80 backdrop-blur-sm border border-slate-100 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors shadow-sm z-10">
                            <ChevronLeft size={20}/>
                        </button>
                    )}
                </div>
            )}
        </div>
    </div>
  );
};