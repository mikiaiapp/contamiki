import React, { useMemo, useState } from 'react';
import { AppState, GlobalFilter, BookMetadata } from '../types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, LineChart, Line, Legend, ReferenceLine } from 'recharts';
import { TrendingUp, PieChart as PieIcon, LineChart as LineIcon, ChevronRight, ArrowDownCircle, ArrowUpCircle, ChevronLeft, Home } from 'lucide-react';

interface ChartsViewProps {
  data: AppState;
  filter: GlobalFilter;
  onUpdateFilter: (f: GlobalFilter) => void;
  currentBook: BookMetadata;
}

const COLORS = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
const NUMBER_FORMATTER = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const compactCurrency = (value: number) => {
    if (Math.abs(value) >= 1000) {
        return (value / 1000).toFixed(1) + 'k';
    }
    return value.toString();
};

export const ChartsView: React.FC<ChartsViewProps> = ({ data, currentBook }) => {
  const [activeTab, setActiveTab] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [chartType, setChartType] = useState<'PIE' | 'LINE'>('PIE');
  
  // Navigation State: Stack of IDs. Empty = Root.
  const [drillPath, setDrillPath] = useState<{ famId?: string, catId?: string }>({});

  // --- LOCAL INDEPENDENT FILTER STATE ---
  const [localFilter, setLocalFilter] = useState<GlobalFilter>(() => {
      const now = new Date();
      // Default to last 12 months roughly if not set
      const start = new Date(now.getFullYear() - 1, now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const fmt = (d: Date) => d.toISOString().split('T')[0];
      return {
          timeRange: 'CUSTOM',
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

  const isMonthlyView = localFilter.timeRange === 'MONTH';

  const formatDateTick = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return isMonthlyView 
        ? `${date.getDate()}/${date.getMonth() + 1}` 
        : `${monthShorts[date.getMonth()]} ${date.getFullYear().toString().slice(-2)}`;
  };

  const renderIcon = (iconStr: string, className = "w-6 h-6") => {
    if (iconStr?.startsWith('http') || iconStr?.startsWith('data:image')) {
        return <img src={iconStr} className={`${className} object-contain rounded-lg`} referrerPolicy="no-referrer" />;
    }
    return <span className="text-xl">{iconStr || '🔹'}</span>;
  };

  const dateBounds = useMemo(() => {
    const y = localFilter.referenceDate.getFullYear();
    const m = localFilter.referenceDate.getMonth();
    let start = '', end = '';
    if (localFilter.timeRange === 'MONTH') {
      start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      end = `${y}-${String(m + 1).padStart(2, '0')}-${new Date(y, m + 1, 0).getDate()}`;
    } else if (localFilter.timeRange === 'YEAR') {
      start = `${y}-01-01`; end = `${y}-12-31`;
    } else {
      start = localFilter.customStart || '1900-01-01'; end = localFilter.customEnd || '2100-12-31';
    }
    return { start, end };
  }, [localFilter]);

  const savingsData = useMemo(() => {
    const timeline = new Map<string, number>();
    const sortedTx = [...data.transactions].sort((a, b) => a.date.localeCompare(b.date));
    let runningBalance = data.accounts.reduce((acc, a) => acc + a.initialBalance, 0);
    
    sortedTx.forEach(t => {
      let amt = 0;
      if (t.type === 'EXPENSE' || t.type === 'TRANSFER') amt = -Math.abs(t.amount);
      else amt = Math.abs(t.amount);
      const isInternal = t.type === 'TRANSFER' && t.transferAccountId && data.accounts.find(a=>a.id===t.transferAccountId);
      if (isInternal) amt = 0;

      if (t.date < dateBounds.start) {
         runningBalance += amt;
      } else if (t.date <= dateBounds.end) {
         runningBalance += amt;
         const key = isMonthlyView ? t.date : (t.date.substring(0, 7) + '-01'); 
         timeline.set(key, runningBalance);
      }
    });

    let result: any[] = Array.from(timeline.entries()).map(([date, balance]) => ({ date, balance, projection: null })).sort((a, b) => a.date.localeCompare(b.date));
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
  }, [data.transactions, dateBounds, data.accounts, isMonthlyView]);

  const breakdownData = useMemo(() => {
      const relevantTx = data.transactions.filter(t => t.date >= dateBounds.start && t.date <= dateBounds.end && t.type === activeTab);
      
      let items: { id: string, name: string, value: number, icon: string, history: Map<string, number> }[] = [];
      const historyKeys = new Set<string>();

      if (!drillPath.famId) {
          const map = new Map<string, typeof items[0]>();
          relevantTx.forEach(t => {
              const cat = data.categories.find(c => c.id === t.categoryId);
              const famId = t.familyId || cat?.familyId;
              if (famId) {
                  if (!map.has(famId)) {
                      const fam = data.families.find(f => f.id === famId);
                      map.set(famId, { id: famId, name: fam?.name || '?', value: 0, icon: fam?.icon || '', history: new Map() });
                  }
                  const entry = map.get(famId)!;
                  const val = Math.abs(t.amount);
                  entry.value += val;
                  const key = isMonthlyView ? t.date : (t.date.substring(0, 7) + '-01');
                  entry.history.set(key, (entry.history.get(key) || 0) + val);
                  historyKeys.add(key);
              }
          });
          items = Array.from(map.values());
      } else if (!drillPath.catId) {
          const map = new Map<string, typeof items[0]>();
          relevantTx.filter(t => {
              const cat = data.categories.find(c => c.id === t.categoryId);
              return t.familyId === drillPath.famId || cat?.familyId === drillPath.famId;
          }).forEach(t => {
              const catId = t.categoryId;
              if (catId) {
                  if (!map.has(catId)) {
                      const cat = data.categories.find(c => c.id === catId);
                      map.set(catId, { id: catId, name: cat?.name || '?', value: 0, icon: cat?.icon || '', history: new Map() });
                  }
                  const entry = map.get(catId)!;
                  const val = Math.abs(t.amount);
                  entry.value += val;
                  const key = isMonthlyView ? t.date : (t.date.substring(0, 7) + '-01');
                  entry.history.set(key, (entry.history.get(key) || 0) + val);
                  historyKeys.add(key);
              }
          });
          items = Array.from(map.values());
      } else {
          const catId = drillPath.catId;
          const cat = data.categories.find(c => c.id === catId);
          const history = new Map<string, number>();
          relevantTx.filter(t => t.categoryId === catId).forEach(t => {
              const val = Math.abs(t.amount);
              const key = isMonthlyView ? t.date : (t.date.substring(0, 7) + '-01');
              history.set(key, (history.get(key) || 0) + val);
              historyKeys.add(key);
          });
          items = [{ id: catId, name: cat?.name || '?', value: Array.from(history.values()).reduce((a,b)=>a+b,0), icon: cat?.icon || '', history }];
      }

      items.sort((a, b) => b.value - a.value);

      const sortedDates = Array.from(historyKeys).sort();
      const lineData = sortedDates.map(date => {
          const point: any = { date };
          items.forEach(item => { point[item.name] = item.history.get(date) || 0; });
          return point;
      });

      return { items, lineData };
  }, [data.transactions, activeTab, dateBounds, drillPath, isMonthlyView, data.categories, data.families]);

  const CustomTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
          const title = formatDateTick(label);
          const isProj = payload[0]?.payload?.isProjection;
          return (
              <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-xl text-xs">
                  <p className="font-black text-slate-500 mb-2">{title} {isProj ? '(Est.)' : ''}</p>
                  {payload.map((p: any, idx: number) => {
                      if (p.value === null || p.value === undefined) return null;
                      return (
                        <div key={idx} style={{ color: p.color }} className="flex items-center gap-2 font-bold">
                            <span>{p.name === 'projection' ? 'Proyección' : p.name}:</span>
                            <span>{NUMBER_FORMATTER.format(p.value)}€</span>
                        </div>
                      );
                  })}
              </div>
          );
      }
      return null;
  };

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return percent > 0.05 ? (
      <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={10} fontWeight="bold">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    ) : null;
  };

  const handleSliceClick = (input: any) => {
      // Recharts may wrap data in payload
      const item = input.payload || input;
      if (!drillPath.famId) {
          setDrillPath({ famId: item.id });
      } else if (!drillPath.catId) {
          setDrillPath({ ...drillPath, catId: item.id });
      }
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

        {/* SECTION 1: SAVINGS EVOLUTION */}
        <div className="bg-white p-6 md:p-10 rounded-[3rem] shadow-sm border border-slate-100">
            <div className="flex items-center gap-4 mb-8">
                <div className="bg-slate-950 p-3 rounded-2xl text-white"><TrendingUp size={20}/></div>
                <div><h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Evolución de Patrimonio</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Tendencia proyectada a 3 meses</p></div>
            </div>
            {savingsData.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-300 opacity-50"><TrendingUp size={48}/><p className="text-[10px] font-black uppercase mt-4">Sin datos de evolución</p></div>
            ) : (
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={savingsData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs><linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="date" tickFormatter={formatDateTick} style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }} tickLine={false} axisLine={false} dy={10} />
                            <YAxis domain={['auto', 'auto']} tickFormatter={compactCurrency} style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }} tickLine={false} axisLine={false} width={40} />
                            <Tooltip content={<CustomTooltip />} />
                            <ReferenceLine x={savingsData.find(d => (d as any).isProjection)?.date} stroke="#cbd5e1" strokeDasharray="3 3" />
                            <Area type="monotone" dataKey="balance" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorBalance)" name="Patrimonio" connectNulls={false} />
                            <Area type="monotone" dataKey="projection" stroke="#94a3b8" strokeWidth={3} strokeDasharray="5 5" fillOpacity={0.5} fill="url(#colorBalance)" name="Proyección" connectNulls={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>

        {/* SECTION 2: GLOBAL COMPOSITION & DRILL DOWN */}
        <div className="bg-white p-6 md:p-10 rounded-[3rem] shadow-sm border border-slate-100 min-h-[500px] flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8 border-b border-slate-50 pb-6">
                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
                    {/* BREADCRUMBS */}
                    <button onClick={() => setDrillPath({})} className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${!drillPath.famId ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:text-slate-600'}`}>
                        <Home size={14}/> <span className="text-[10px] font-black uppercase tracking-widest">{activeTab === 'INCOME' ? 'Ingresos' : 'Gastos'}</span>
                    </button>
                    {drillPath.famId && (
                        <>
                            <span className="text-slate-300"><ChevronRight size={14}/></span>
                            <button onClick={() => setDrillPath({ famId: drillPath.famId })} className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${!drillPath.catId ? 'bg-indigo-600 text-white shadow-lg' : 'bg-indigo-50 text-indigo-400 hover:text-indigo-600'}`}>
                                {renderIcon(data.families.find(f=>f.id===drillPath.famId)?.icon || '', "w-4 h-4")} <span className="text-[10px] font-black uppercase tracking-widest">{data.families.find(f=>f.id===drillPath.famId)?.name}</span>
                            </button>
                        </>
                    )}
                    {drillPath.catId && (
                        <>
                            <span className="text-slate-300"><ChevronRight size={14}/></span>
                            <div className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl shadow-lg animate-in slide-in-from-left-2">
                                {renderIcon(data.categories.find(c=>c.id===drillPath.catId)?.icon || '', "w-4 h-4")} <span className="text-[10px] font-black uppercase tracking-widest">{data.categories.find(c=>c.id===drillPath.catId)?.name}</span>
                            </div>
                        </>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    {/* TYPE TOGGLE (Only at root) */}
                    {!drillPath.famId && (
                        <div className="bg-slate-100 p-1 rounded-xl flex shadow-inner">
                            <button onClick={() => setActiveTab('INCOME')} className={`p-2 rounded-lg transition-all ${activeTab === 'INCOME' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}><ArrowUpCircle size={16}/></button>
                            <button onClick={() => setActiveTab('EXPENSE')} className={`p-2 rounded-lg transition-all ${activeTab === 'EXPENSE' ? 'bg-white text-rose-500 shadow-sm' : 'text-slate-400'}`}><ArrowDownCircle size={16}/></button>
                        </div>
                    )}
                    {/* CHART TYPE TOGGLE */}
                    <div className="flex bg-slate-50 border border-slate-100 rounded-xl p-1">
                        <button onClick={() => setChartType('PIE')} className={`p-2 rounded-lg transition-all ${chartType === 'PIE' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:text-indigo-600'}`} disabled={!!drillPath.catId}><PieIcon size={16}/></button>
                        <button onClick={() => setChartType('LINE')} className={`p-2 rounded-lg transition-all ${chartType === 'LINE' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:text-indigo-600'}`}><LineIcon size={16}/></button>
                    </div>
                </div>
            </div>

            {breakdownData.items.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-300 opacity-50"><PieIcon size={48}/><p className="text-[10px] font-black uppercase mt-4">Sin datos en este periodo</p></div>
            ) : (
                <div className="flex-1 h-[400px] w-full animate-in fade-in duration-300">
                    <ResponsiveContainer width="100%" height="100%">
                        {(chartType === 'PIE' && !drillPath.catId) ? (
                            <PieChart>
                                <Pie
                                    data={breakdownData.items}
                                    cx="50%" cy="50%"
                                    innerRadius={80} outerRadius={120}
                                    paddingAngle={5}
                                    dataKey="value"
                                    label={renderCustomLabel}
                                    labelLine={false}
                                    onClick={handleSliceClick}
                                    isAnimationActive={true}
                                >
                                    {breakdownData.items.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" cursor="pointer" />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend 
                                    verticalAlign="bottom" height={36} 
                                    content={(props) => (
                                        <div className="flex flex-wrap justify-center gap-4 mt-8">
                                            {props.payload?.map((entry: any, index: number) => (
                                                <div key={`item-${index}`} className="flex items-center gap-1.5 cursor-pointer opacity-80 hover:opacity-100 transition-opacity" onClick={() => handleSliceClick(breakdownData.items[index])}>
                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}/>
                                                    <span className="text-[9px] font-bold text-slate-600 uppercase">{entry.value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                />
                            </PieChart>
                        ) : (
                            <LineChart data={breakdownData.lineData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" tickFormatter={formatDateTick} style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }} tickLine={false} axisLine={false} dy={10} />
                                <YAxis tickFormatter={compactCurrency} style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }} tickLine={false} axisLine={false} width={40} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '20px' }} />
                                {breakdownData.items.map((item, idx) => (
                                    <Line key={item.id} type="monotone" dataKey={item.name} stroke={COLORS[idx % COLORS.length]} strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                                ))}
                            </LineChart>
                        )}
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    </div>
  );
};