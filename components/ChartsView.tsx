import React, { useMemo, useState } from 'react';
import { AppState, GlobalFilter, BookMetadata } from '../types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, LineChart, Line, Legend, ReferenceLine, BarChart, Bar } from 'recharts';
import { TrendingUp, PieChart as PieIcon, LineChart as LineIcon, ChevronRight, ArrowDownCircle, ArrowUpCircle, ChevronLeft, Home, BarChart3, Grip, Search, X } from 'lucide-react';

interface ChartsViewProps {
  data: AppState;
  filter: GlobalFilter;
  onUpdateFilter: (f: GlobalFilter) => void;
  currentBook: BookMetadata;
}

// Paleta de colores consistente
const COLORS = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
const NUMBER_FORMATTER = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const compactCurrency = (value: number) => {
    if (Math.abs(value) >= 1000) {
        return (value / 1000).toFixed(1) + 'k';
    }
    return value.toString();
};

const formatCurrency = (amount: number) => `${NUMBER_FORMATTER.format(amount)} €`;

// Estado de Navegación del Gráfico
type ViewLevel = 'ROOT' | 'TYPE' | 'FAMILY' | 'CATEGORY';
interface ViewState {
    level: ViewLevel;
    type?: 'INCOME' | 'EXPENSE';
    famId?: string;
    catId?: string;
}

export const ChartsView: React.FC<ChartsViewProps> = ({ data, currentBook }) => {
  const [chartType, setChartType] = useState<'LINE' | 'BAR' | 'PIE'>('LINE');
  
  // Estado de navegación (Drill-down)
  const [viewState, setViewState] = useState<ViewState>({ level: 'ROOT' });

  // --- FILTRO LOCAL INDEPENDIENTE ---
  const [localFilter, setLocalFilter] = useState<GlobalFilter>(() => {
      const now = new Date();
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

  // --- LÓGICA DE FECHAS Y GRANULARIDAD ---
  const { dateBounds, isMonthlyGranularity } = useMemo(() => {
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

    const isMonthlyGranularity = localFilter.timeRange === 'MONTH';

    return { dateBounds: { start, end }, isMonthlyGranularity };
  }, [localFilter]);

  // Helpers de formateo de ejes
  const getGranularityKey = (dateStr: string) => {
      return isMonthlyGranularity ? dateStr : dateStr.substring(0, 7);
  };

  const formatKeyDisplay = (key: string) => {
      if (!key) return '';
      if (isMonthlyGranularity) {
          const d = new Date(key);
          return `${d.getDate()}`; // Día del mes
      } else {
          const [y, m] = key.split('-');
          return monthShorts[parseInt(m) - 1]; // Nombre del mes
      }
  };

  const formatKeyTooltip = (key: string) => {
      if (!key) return '';
      if (isMonthlyGranularity) {
          const d = new Date(key);
          if (isNaN(d.getTime())) return key;
          return `${d.getDate()} de ${months[d.getMonth()]} ${d.getFullYear()}`;
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

  // --- MOTOR DE DATOS 1: EVOLUCIÓN PATRIMONIO ---
  const savingsData = useMemo(() => {
    const timeline = new Map<string, number>();
    const sortedTx = [...data.transactions].sort((a, b) => a.date.localeCompare(b.date));
    let runningBalance = data.accounts.reduce((acc, a) => acc + a.initialBalance, 0);
    
    sortedTx.forEach(t => {
      let amt = t.amount;
      const isInternal = t.type === 'TRANSFER' && t.transferAccountId && data.accounts.find(a=>a.id===t.transferAccountId);
      if (isInternal) amt = 0;

      if (t.date < dateBounds.start) {
         runningBalance += amt;
      } else if (t.date <= dateBounds.end) {
         runningBalance += amt;
         const key = isMonthlyGranularity ? t.date : (t.date.substring(0, 7) + '-01'); 
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
                if (isMonthlyGranularity) lastDate.setDate(lastDate.getDate() + 1);
                else lastDate.setMonth(lastDate.getMonth() + 1);
                
                const nextVal = slope * (n + i) + intercept;
                result.push({ date: lastDate.toISOString().split('T')[0], balance: null, projection: nextVal, isProjection: true });
            }
        }
    }
    return result;
  }, [data.transactions, dateBounds, data.accounts, isMonthlyGranularity]);

  // --- MOTOR DE DATOS 2: DRILL DOWN DINÁMICO ---
  const chartData = useMemo(() => {
      const relevantTx = data.transactions.filter(t => 
          t.date >= dateBounds.start && 
          t.date <= dateBounds.end && 
          t.type !== 'TRANSFER'
      );

      const timeSeriesMap = new Map<string, { [key: string]: number }>();
      const pieMap = new Map<string, { id: string, name: string, value: number, icon: string, color?: string }>();

      const getFam = (id: string) => data.families.find(f => f.id === id);
      const getCat = (id: string) => data.categories.find(c => c.id === id);

      // --- NIVEL 0: ROOT (Líneas de Ingresos vs Gastos) ---
      if (viewState.level === 'ROOT') {
          relevantTx.forEach(t => {
              const timeKey = getGranularityKey(t.date);
              const cat = getCat(t.categoryId);
              const fam = cat ? getFam(cat.familyId) : null;
              
              if (!fam) return;

              if (!timeSeriesMap.has(timeKey)) timeSeriesMap.set(timeKey, { date: timeKey as any, income: 0, expense: 0 });
              const point = timeSeriesMap.get(timeKey)!;

              if (fam.type === 'INCOME') {
                  point.income += t.amount;
              } else {
                  point.expense += t.amount; 
              }
          });

          const totalIncome = relevantTx.reduce((acc, t) => {
              const f = getFam(getCat(t.categoryId)?.familyId || '');
              return (f?.type === 'INCOME') ? acc + t.amount : acc;
          }, 0);
          
          const totalExpense = Math.abs(relevantTx.reduce((acc, t) => {
              const f = getFam(getCat(t.categoryId)?.familyId || '');
              return (f?.type === 'EXPENSE') ? acc + t.amount : acc;
          }, 0));

          pieMap.set('INCOME', { id: 'INCOME', name: 'Ingresos', value: totalIncome, icon: '💰' });
          pieMap.set('EXPENSE', { id: 'EXPENSE', name: 'Gastos', value: totalExpense, icon: '💸' });
      } 
      // --- NIVEL 1: TIPO (Desglose por Familias) ---
      else if (viewState.level === 'TYPE' && viewState.type) {
          const targetType = viewState.type;
          relevantTx.forEach(t => {
              const cat = getCat(t.categoryId);
              const fam = cat ? getFam(cat.familyId) : null;
              
              if (fam && fam.type === targetType) {
                  const timeKey = getGranularityKey(t.date);
                  const val = targetType === 'EXPENSE' ? -t.amount : t.amount;

                  if (!timeSeriesMap.has(timeKey)) timeSeriesMap.set(timeKey, { date: timeKey as any });
                  const point = timeSeriesMap.get(timeKey)!;
                  point[fam.name] = (point[fam.name] || 0) + val;

                  if (!pieMap.has(fam.id)) {
                      pieMap.set(fam.id, { id: fam.id, name: fam.name, value: 0, icon: fam.icon });
                  }
                  pieMap.get(fam.id)!.value += val;
              }
          });
      }
      // --- NIVEL 2: FAMILIA (Desglose por Categorías) ---
      else if (viewState.level === 'FAMILY' && viewState.famId) {
          const targetFam = getFam(viewState.famId);
          const isExpenseFam = targetFam?.type === 'EXPENSE';

          relevantTx.forEach(t => {
              const cat = getCat(t.categoryId);
              if (cat && cat.familyId === viewState.famId) {
                  const timeKey = getGranularityKey(t.date);
                  const val = isExpenseFam ? -t.amount : t.amount;

                  if (!timeSeriesMap.has(timeKey)) timeSeriesMap.set(timeKey, { date: timeKey as any });
                  const point = timeSeriesMap.get(timeKey)!;
                  point[cat.name] = (point[cat.name] || 0) + val;

                  if (!pieMap.has(cat.id)) {
                      pieMap.set(cat.id, { id: cat.id, name: cat.name, value: 0, icon: cat.icon });
                  }
                  pieMap.get(cat.id)!.value += val;
              }
          });
      }
      // --- NIVEL 3: CATEGORÍA (Evolución única) ---
      else if (viewState.level === 'CATEGORY' && viewState.catId) {
          const targetCat = getCat(viewState.catId);
          const fam = targetCat ? getFam(targetCat.familyId) : null;
          const isExpense = fam?.type === 'EXPENSE';

          relevantTx.forEach(t => {
              if (t.categoryId === viewState.catId) {
                  const timeKey = getGranularityKey(t.date);
                  const val = isExpense ? -t.amount : t.amount;
                  
                  if (!timeSeriesMap.has(timeKey)) timeSeriesMap.set(timeKey, { date: timeKey as any, value: 0 });
                  const point = timeSeriesMap.get(timeKey)!;
                  point.value += val;
              }
          });
          
          const total = Array.from(timeSeriesMap.values()).reduce((acc, p) => acc + p.value, 0);
          pieMap.set(viewState.catId, { id: viewState.catId, name: targetCat?.name || '', value: total, icon: targetCat?.icon || '' });
      }

      let sortedTimeSeries = Array.from(timeSeriesMap.values()).sort((a: any, b: any) => a.date.localeCompare(b.date));
      
      if (viewState.level === 'ROOT') {
          sortedTimeSeries = sortedTimeSeries.map(pt => ({
              ...pt,
              expense: Math.abs(pt.expense) 
          }));
      }

      const sortedPieData = Array.from(pieMap.values()).sort((a, b) => b.value - a.value);

      let lineKeys: string[] = [];
      if (viewState.level === 'ROOT') lineKeys = ['income', 'expense'];
      else if (viewState.level === 'CATEGORY') lineKeys = ['value'];
      else lineKeys = sortedPieData.map(i => i.name);

      return {
          timeData: sortedTimeSeries,
          pieData: sortedPieData,
          lineKeys,
          totalValue: sortedPieData.reduce((acc, i) => acc + i.value, 0)
      };

  }, [data.transactions, viewState, dateBounds, isMonthlyGranularity, data.categories, data.families]);

  // Handlers de Interacción
  const handleKPISelect = (type: 'INCOME' | 'EXPENSE') => {
      setViewState({ level: 'TYPE', type });
      setChartType('PIE'); // Al bajar a Nivel 1 (Familias), forzamos Gráfico Circular
  };

  const handleSliceClick = (entry: any) => {
      if (viewState.level === 'TYPE') {
          setViewState({ ...viewState, level: 'FAMILY', famId: entry.id });
          setChartType('PIE'); // Al bajar a Nivel 2 (Categorías), mantenemos Circular
      } else if (viewState.level === 'FAMILY') {
          setViewState({ ...viewState, level: 'CATEGORY', catId: entry.id });
          setChartType('LINE'); // Al bajar a Nivel 3 (Evolución), forzamos Línea
      }
  };

  const goBack = () => {
      if (viewState.level === 'CATEGORY') {
          setViewState({ level: 'FAMILY', type: viewState.type, famId: viewState.famId });
          setChartType('PIE'); // Volver a Categorías -> Circular
      } else if (viewState.level === 'FAMILY') {
          setViewState({ level: 'TYPE', type: viewState.type });
          setChartType('PIE'); // Volver a Familias -> Circular
      } else if (viewState.level === 'TYPE') {
          setViewState({ level: 'ROOT' });
          setChartType('LINE'); // Volver a Root -> Línea
      }
  };

  const renderTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-xl text-xs">
                <p className="font-black text-slate-500 mb-1">{formatKeyTooltip(label as string)}</p>
                {payload.map((p: any) => (
                    <div key={p.name} className="flex items-center gap-2 font-bold" style={{ color: p.color || p.stroke || p.fill }}>
                         <span>{p.name === 'income' ? 'Ingresos' : p.name === 'expense' ? 'Gastos' : p.name === 'value' ? 'Valor' : p.name}:</span>
                         <span>{formatCurrency(p.value as number)}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
  };

  // Determinamos qué gráfico mostrar
  // Root y Category: Preferencia por LINE, pero usuario puede cambiar.
  // Type y Family: Preferencia por PIE, pero usuario puede cambiar.
  // La lógica de renderizado debe respetar chartType, pero viewState.level puede imponer defaults implícitos si chartType no se forzó en la transición (lo cual hemos hecho en los handlers).
  
  const showLineChart = (viewState.level === 'ROOT') || (viewState.level === 'CATEGORY' && chartType !== 'BAR') || chartType === 'LINE';
  const showBarChart = chartType === 'BAR';
  const showPieChart = (viewState.level === 'TYPE' || viewState.level === 'FAMILY') && chartType === 'PIE';

  // Override simple logic based on specific requests: 
  // Level 0 (ROOT) -> Always Line (initially)
  // Level 1/2 (Type/Family) -> Default Pie
  // Level 3 (Cat) -> Default Line

  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-20">
        {/* HEADER & FILTROS */}
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

        {/* SECTION 1: EVOLUCIÓN PATRIMONIO (Sin cambios lógicos, solo UI) */}
        <div className="bg-white p-6 md:p-10 rounded-[3rem] shadow-sm border border-slate-100">
            <div className="flex items-center gap-4 mb-8">
                <div className="bg-slate-950 p-3 rounded-2xl text-white"><TrendingUp size={20}/></div>
                <div><h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Patrimonio Neto</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Evolución de saldo acumulado</p></div>
            </div>
            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={savingsData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs><linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" tickFormatter={formatKeyDisplay} style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }} tickLine={false} axisLine={false} dy={10} minTickGap={30} />
                        <YAxis domain={['auto', 'auto']} tickFormatter={compactCurrency} style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }} tickLine={false} axisLine={false} width={40} />
                        <Tooltip content={<CustomTooltip />} />
                        <ReferenceLine x={savingsData.find(d => (d as any).isProjection)?.date} stroke="#cbd5e1" strokeDasharray="3 3" label={{ value: "Proyección", position: 'insideTopRight', fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
                        <Area type="monotone" dataKey="balance" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorBalance)" name="Patrimonio" connectNulls={false} />
                        <Area type="monotone" dataKey="projection" stroke="#94a3b8" strokeWidth={3} strokeDasharray="5 5" fillOpacity={0.5} fill="url(#colorBalance)" name="Proyección" connectNulls={false} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* SECTION 2: DRILL DOWN CHART (Bloque Principal Corregido) */}
        <div className="bg-white p-6 md:p-10 rounded-[3rem] shadow-sm border border-slate-100 min-h-[600px] flex flex-col">
            
            {/* 2.1 BREADCRUMBS Y NAVEGACIÓN */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8 border-b border-slate-50 pb-6">
                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto scrollbar-hide">
                    {/* Botón ROOT */}
                    <button onClick={() => { setViewState({ level: 'ROOT' }); setChartType('LINE'); }} className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${viewState.level === 'ROOT' ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:text-slate-600'}`}>
                        <Home size={14}/> <span className="text-[10px] font-black uppercase tracking-widest">Resumen</span>
                    </button>

                    {/* Botón TYPE */}
                    {viewState.level !== 'ROOT' && (
                        <>
                            <span className="text-slate-300"><ChevronRight size={14}/></span>
                            <button onClick={() => { setViewState({ level: 'TYPE', type: viewState.type }); setChartType('PIE'); }} className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${viewState.level === 'TYPE' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-indigo-50 text-indigo-400 hover:text-indigo-600'}`}>
                                {viewState.type === 'INCOME' ? <ArrowUpCircle size={14}/> : <ArrowDownCircle size={14}/>}
                                <span className="text-[10px] font-black uppercase tracking-widest">{viewState.type === 'INCOME' ? 'Ingresos' : 'Gastos'}</span>
                            </button>
                        </>
                    )}

                    {/* Botón FAMILY / CATEGORY */}
                    {(viewState.level === 'FAMILY' || viewState.level === 'CATEGORY') && viewState.famId && (
                        <>
                            <span className="text-slate-300"><ChevronRight size={14}/></span>
                            <button onClick={() => { setViewState({ level: 'FAMILY', type: viewState.type, famId: viewState.famId }); setChartType('PIE'); }} className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${viewState.level === 'FAMILY' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-indigo-50 text-indigo-400 hover:text-indigo-600'}`}>
                                {renderIcon(data.families.find(f=>f.id===viewState.famId)?.icon || '', "w-4 h-4")} 
                                <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">{data.families.find(f=>f.id===viewState.famId)?.name}</span>
                            </button>
                        </>
                    )}

                    {/* Etiqueta CATEGORY */}
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

                {/* Controles de Tipo de Gráfico */}
                <div className="flex items-center gap-4">
                    {viewState.level !== 'ROOT' && (
                        <div className="flex bg-slate-50 border border-slate-100 rounded-xl p-1">
                            <button onClick={() => setChartType('PIE')} className={`p-2 rounded-lg transition-all ${chartType === 'PIE' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:text-indigo-600'}`}><PieIcon size={16}/></button>
                            <button onClick={() => setChartType('LINE')} className={`p-2 rounded-lg transition-all ${chartType === 'LINE' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:text-indigo-600'}`}><LineIcon size={16}/></button>
                            <button onClick={() => setChartType('BAR')} className={`p-2 rounded-lg transition-all ${chartType === 'BAR' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:text-indigo-600'}`}><BarChart3 size={16}/></button>
                        </div>
                    )}
                </div>
            </div>

            {/* 2.2 BOTONES DE RESUMEN (KPIs) - SOLO EN ROOT */}
            {viewState.level === 'ROOT' && (
                <div className="grid grid-cols-2 gap-4 mb-8">
                    {chartData.pieData.map(kpi => (
                        <button 
                            key={kpi.id} 
                            onClick={() => handleKPISelect(kpi.id as 'INCOME' | 'EXPENSE')}
                            className={`p-6 rounded-3xl border-2 transition-all flex items-center justify-between group ${kpi.id === 'INCOME' ? 'bg-emerald-50 border-emerald-100 hover:border-emerald-300' : 'bg-rose-50 border-rose-100 hover:border-rose-300'}`}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm ${kpi.id === 'INCOME' ? 'bg-emerald-200 text-emerald-700' : 'bg-rose-200 text-rose-700'}`}>
                                    {kpi.id === 'INCOME' ? <ArrowUpCircle size={24}/> : <ArrowDownCircle size={24}/>}
                                </div>
                                <div className="text-left">
                                    <p className={`text-[10px] font-black uppercase tracking-widest ${kpi.id === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>{kpi.name}</p>
                                    <p className="text-2xl font-black text-slate-900">{formatCurrency(kpi.value)}</p>
                                </div>
                            </div>
                            <ChevronRight className={`transition-transform group-hover:translate-x-1 ${kpi.id === 'INCOME' ? 'text-emerald-400' : 'text-rose-400'}`} />
                        </button>
                    ))}
                </div>
            )}

            {/* 2.3 RENDERIZADO DEL GRÁFICO */}
            <div className="flex-1 min-h-[400px] w-full relative">
                {/* Back Button Overlay */}
                {viewState.level !== 'ROOT' && (
                    <button onClick={goBack} className="absolute top-0 left-0 p-2 bg-white/80 backdrop-blur-sm border border-slate-100 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors shadow-sm z-10">
                        <ChevronLeft size={20}/>
                    </button>
                )}

                <ResponsiveContainer width="100%" height="100%">
                    {/* LOGIC GATE: Use chartType state but respect view levels preference if default */}
                    {(chartType === 'LINE' || (viewState.level === 'ROOT')) ? (
                        <LineChart data={chartData.timeData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="date" tickFormatter={formatKeyDisplay} style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }} tickLine={false} axisLine={false} dy={10} minTickGap={30} />
                            <YAxis tickFormatter={compactCurrency} style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }} tickLine={false} axisLine={false} width={40} />
                            <Tooltip content={renderTooltip} />
                            <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', paddingTop: '20px' }} formatter={(val) => val === 'income' ? 'Ingresos' : val === 'expense' ? 'Gastos' : val} />
                            
                            {chartData.lineKeys.map((key, idx) => {
                                let stroke = COLORS[idx % COLORS.length];
                                if (key === 'income') stroke = '#10b981';
                                if (key === 'expense') stroke = '#f43f5e';
                                if (key === 'value') stroke = '#6366f1'; 

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
                    ) : chartType === 'BAR' ? (
                        <BarChart data={chartData.timeData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="date" tickFormatter={formatKeyDisplay} style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }} tickLine={false} axisLine={false} dy={10} minTickGap={30} />
                            <YAxis tickFormatter={compactCurrency} style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }} tickLine={false} axisLine={false} width={40} />
                            <Tooltip content={renderTooltip} />
                            <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', paddingTop: '20px' }} />
                            {chartData.lineKeys.map((key, idx) => (
                                <Bar key={key} dataKey={key} fill={COLORS[idx % COLORS.length]} radius={[4, 4, 0, 0]} stackId="a" />
                            ))}
                        </BarChart>
                    ) : (
                        <PieChart>
                            <Pie
                                data={chartData.pieData}
                                cx="50%" cy="50%"
                                innerRadius={80} outerRadius={120}
                                paddingAngle={5}
                                dataKey="value"
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
                                verticalAlign="bottom" height={80} 
                                content={(props) => (
                                    <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-4 max-h-24 overflow-y-auto custom-scrollbar p-2">
                                        {props.payload?.map((entry: any, index: number) => {
                                            const item = chartData.pieData[index];
                                            return (
                                                <div key={`item-${index}`} className="flex items-center gap-1.5 cursor-pointer opacity-80 hover:opacity-100 transition-opacity" onClick={() => handleSliceClick(item)}>
                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}/>
                                                    <span className="text-[9px] font-bold text-slate-600 uppercase">{item.name} ({((item.value / chartData.totalValue) * 100).toFixed(0)}%)</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            />
                        </PieChart>
                    )}
                </ResponsiveContainer>
            </div>
        </div>
    </div>
  );
};

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-xl text-xs">
          {/* We assume label is formatted date here, logic is handled by parent but we can reuse format logic or pass it */}
          <p className="font-black text-slate-500 mb-1">{label}</p>
          {payload.map((p: any, idx: number) => (
            <div key={idx} className="flex items-center gap-2 font-bold" style={{ color: p.color || p.stroke || '#6366f1' }}>
              <span>{p.name === 'balance' ? 'Patrimonio' : p.name === 'projection' ? 'Proyección' : p.name}:</span>
              <span>{new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(p.value)} €</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };
