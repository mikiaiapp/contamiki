import React, { useMemo, useState } from 'react';
import { AppState, GlobalFilter, BookMetadata } from './types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, LineChart, Line, Legend, ReferenceLine, BarChart, Bar } from 'recharts';
import { TrendingUp, PieChart as PieIcon, LineChart as LineIcon, ChevronRight, ArrowDownCircle, ArrowUpCircle, ChevronLeft, Home, BarChart3, Grip, Search, X } from 'lucide-react';

interface ChartsViewProps {
  data: AppState;
  filter: GlobalFilter;
  onUpdateFilter: (f: GlobalFilter) => void;
  currentBook: BookMetadata;
}

const COLORS = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
const NUMBER_FORMATTER = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const compactCurrency = (value: number) => {
    if (Math.abs(value) >= 1000) return (value / 1000).toFixed(1) + 'k';
    return value.toString();
};

const formatCurrency = (amount: number) => `${NUMBER_FORMATTER.format(amount)} €`;

// Estado de Navegación del Gráfico
type ViewLevel = 'ROOT' | 'FAMILY' | 'CATEGORY';
interface ViewState {
    level: ViewLevel;
    itemId?: string; // Family ID or Category ID
    itemName?: string;
    itemType?: 'INCOME' | 'EXPENSE';
}

export const ChartsView: React.FC<ChartsViewProps> = ({ data, currentBook }) => {
  // Estado de navegación (Drill-down)
  const [viewState, setViewState] = useState<ViewState>({ level: 'ROOT' });

  // --- FILTRO LOCAL INTERANUAL POR DEFECTO ---
  const [localFilter, setLocalFilter] = useState<GlobalFilter>(() => {
      const now = new Date();
      // Calcular los últimos 12 meses FINALIZADOS
      // Fecha Fin: Último día del mes anterior
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      // Fecha Inicio: Primer día del mes, 11 meses antes del mes fin (total 12 meses)
      const start = new Date(end.getFullYear(), end.getMonth() - 11, 1);
      
      const fmt = (d: Date) => d.toISOString().split('T')[0];
      return {
          timeRange: 'CUSTOM', // Forzamos custom para que tome las fechas exactas
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

  // --- LÓGICA DE FECHAS ---
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

  const renderIcon = (iconStr: string, className = "w-6 h-6") => {
    if (iconStr?.startsWith('http') || iconStr?.startsWith('data:image')) {
        return <img src={iconStr} className={`${className} object-contain rounded-lg`} referrerPolicy="no-referrer" />;
    }
    return <span className="text-xl">{iconStr || '🔹'}</span>;
  };

  // --- DATA: EVOLUCIÓN PATRIMONIO (Sección 1) ---
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

    let result: any[] = Array.from(timeline.entries()).map(([date, balance]) => ({ date, balance })).sort((a, b) => a.date.localeCompare(b.date));
    return result;
  }, [data.transactions, dateBounds, data.accounts, isMonthlyGranularity]);

  // --- DATA: DRILL DOWN DINÁMICO (Sección 2) ---
  const chartData = useMemo(() => {
      // 1. Transacciones en rango
      const relevantTx = data.transactions.filter(t => 
          t.date >= dateBounds.start && 
          t.date <= dateBounds.end && 
          t.type !== 'TRANSFER'
      );

      const getFam = (id: string) => data.families.find(f => f.id === id);
      const getCat = (id: string) => data.categories.find(c => c.id === id);

      // --- CASO 1: ROOT -> Dos Arrays para Pie Chart (Ingresos y Gastos por Familia)
      if (viewState.level === 'ROOT') {
          const incomeMap = new Map<string, number>();
          const expenseMap = new Map<string, number>();

          relevantTx.forEach(t => {
              const cat = getCat(t.categoryId);
              const fam = cat ? getFam(cat.familyId) : null;
              if (!fam) return;

              // IMPORTANTE: Sumamos el importe CON SIGNO para que las devoluciones resten
              const val = t.amount; 
              
              if (fam.type === 'INCOME') {
                  incomeMap.set(fam.id, (incomeMap.get(fam.id) || 0) + val);
              } else {
                  expenseMap.set(fam.id, (expenseMap.get(fam.id) || 0) + val);
              }
          });

          // Al generar los datos del gráfico, tomamos el valor ABSOLUTO del total neto
          const mapToPieData = (map: Map<string, number>) => Array.from(map.entries())
              .map(([id, value]) => ({ 
                  id, 
                  name: getFam(id)?.name || '?', 
                  value: Math.abs(value), // Valor absoluto del saldo neto
                  icon: getFam(id)?.icon, 
                  type: getFam(id)?.type 
              }))
              .filter(item => item.value > 0.01) // Filtramos saldos 0
              .sort((a, b) => b.value - a.value);

          return {
              type: 'ROOT',
              incomeData: mapToPieData(incomeMap),
              expenseData: mapToPieData(expenseMap)
          };
      }

      // --- CASO 2: FAMILY -> Un Array para Pie Chart (Categorías de la Familia)
      if (viewState.level === 'FAMILY' && viewState.itemId) {
          const catMap = new Map<string, number>();
          
          relevantTx.forEach(t => {
              const cat = getCat(t.categoryId);
              if (cat && cat.familyId === viewState.itemId) {
                  // Sumar con signo para calcular neto
                  catMap.set(cat.id, (catMap.get(cat.id) || 0) + t.amount);
              }
          });

          const pieData = Array.from(catMap.entries())
              .map(([id, value]) => ({ 
                  id, 
                  name: getCat(id)?.name || '?', 
                  value: Math.abs(value), // Valor absoluto del saldo neto
                  icon: getCat(id)?.icon 
              }))
              .filter(item => item.value > 0.01)
              .sort((a, b) => b.value - a.value);

          return { type: 'FAMILY', data: pieData };
      }

      // --- CASO 3: CATEGORY -> Un Array para Line Chart (Evolución)
      if (viewState.level === 'CATEGORY' && viewState.itemId) {
          const timeMap = new Map<string, number>();
          
          relevantTx.forEach(t => {
              if (t.categoryId === viewState.itemId) {
                  const key = isMonthlyGranularity ? t.date : t.date.substring(0, 7);
                  // Sumar con signo
                  timeMap.set(key, (timeMap.get(key) || 0) + t.amount);
              }
          });

          const lineData = Array.from(timeMap.entries())
              .map(([date, value]) => ({ 
                  date, 
                  value: Math.abs(value) // Valor absoluto para la gráfica
              }))
              .sort((a, b) => a.date.localeCompare(b.date));

          return { type: 'CATEGORY', data: lineData };
      }

      return { type: 'EMPTY' };

  }, [data.transactions, viewState, dateBounds, isMonthlyGranularity, data.categories, data.families]);

  // Tooltip Customizado
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const d = payload[0].payload;
        return (
            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-xl text-xs z-50">
                <div className="font-black text-slate-700 mb-1">{label || d.name}</div>
                <div className="flex items-center gap-2 text-indigo-600 font-bold">
                    <span>{formatCurrency(d.value)}</span>
                </div>
            </div>
        );
    }
    return null;
  };

  const formatDateLabel = (val: string) => {
      if (isMonthlyGranularity) {
          const d = new Date(val);
          return `${d.getDate()}`;
      }
      const [y, m] = val.split('-');
      return monthShorts[parseInt(m)-1];
  };

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
                        {/* BOTÓN 12 MESES (Por defecto ahora es Custom, lo simulamos visualmente) */}
                        <button onClick={() => {
                             const now = new Date();
                             const end = new Date(now.getFullYear(), now.getMonth(), 0);
                             const start = new Date(end.getFullYear(), end.getMonth() - 11, 1);
                             setLocalFilter({ timeRange: 'CUSTOM', referenceDate: now, customStart: start.toISOString().split('T')[0], customEnd: end.toISOString().split('T')[0] });
                        }} className={`px-4 py-3 text-xs sm:text-sm font-black uppercase tracking-widest rounded-xl transition-all ${localFilter.timeRange === 'CUSTOM' && !localFilter.customStart.startsWith('1900') ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>12 Meses</button>
                        
                        <div className={`px-5 py-3 rounded-xl transition-all flex items-center ${localFilter.timeRange === 'YEAR' ? 'bg-white shadow-sm' : ''}`}>{localFilter.timeRange === 'YEAR' ? (<select className="bg-transparent text-xs sm:text-sm font-black text-indigo-600 uppercase tracking-widest outline-none cursor-pointer py-1 min-w-[60px]" value={localFilter.referenceDate.getFullYear()} onChange={(e) => { const d = new Date(localFilter.referenceDate); d.setFullYear(parseInt(e.target.value)); setLocalFilter({...localFilter, timeRange: 'YEAR', referenceDate: d}); }}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select>) : (<button onClick={() => setLocalFilter({...localFilter, timeRange: 'YEAR'})} className="px-2 text-xs sm:text-sm font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">Año</button>)}</div>
                        <div className={`px-5 py-3 rounded-xl transition-all flex items-center gap-1 ${localFilter.timeRange === 'MONTH' ? 'bg-white shadow-sm' : ''}`}>{localFilter.timeRange === 'MONTH' ? (<div className="flex items-center gap-2"><select className="bg-transparent text-xs sm:text-sm font-black text-indigo-600 uppercase tracking-widest outline-none cursor-pointer py-1 min-w-[80px]" value={localFilter.referenceDate.getMonth()} onChange={(e) => { const d = new Date(localFilter.referenceDate); d.setMonth(parseInt(e.target.value)); setLocalFilter({...localFilter, timeRange: 'MONTH', referenceDate: d}); }}>{months.map((m, i) => <option key={i} value={i}>{m}</option>)}</select><span className="text-slate-300 text-xs font-black">/</span><select className="bg-transparent text-xs sm:text-sm font-black text-indigo-600 uppercase tracking-widest outline-none cursor-pointer py-1 min-w-[70px]" value={localFilter.referenceDate.getFullYear()} onChange={(e) => { const d = new Date(localFilter.referenceDate); d.setFullYear(parseInt(e.target.value)); setLocalFilter({...localFilter, timeRange: 'MONTH', referenceDate: d}); }}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select></div>) : (<button onClick={() => setLocalFilter({...localFilter, timeRange: 'MONTH'})} className="px-2 text-xs sm:text-sm font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">Mes</button>)}</div>
                    </div>
                </div>
            </div>
        </div>

        {/* SECTION 1: EVOLUCIÓN PATRIMONIO */}
        <div className="bg-white p-6 md:p-10 rounded-[3rem] shadow-sm border border-slate-100">
            <div className="flex items-center gap-4 mb-8">
                <div className="bg-slate-950 p-3 rounded-2xl text-white"><TrendingUp size={20}/></div>
                <div><h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Patrimonio Neto</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Evolución de saldo acumulado</p></div>
            </div>
            <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={savingsData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs><linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" tickFormatter={formatDateLabel} style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }} tickLine={false} axisLine={false} dy={10} minTickGap={30} />
                        <YAxis domain={['auto', 'auto']} tickFormatter={compactCurrency} style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }} tickLine={false} axisLine={false} width={40} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="balance" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorBalance)" name="Patrimonio" connectNulls={false} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* SECTION 2: DRILL DOWN (GASTOS E INGRESOS) */}
        <div className="bg-white p-6 md:p-10 rounded-[3rem] shadow-sm border border-slate-100 min-h-[500px] flex flex-col">
            
            {/* HEADER DE NAVEGACIÓN */}
            <div className="flex items-center gap-2 mb-8 border-b border-slate-50 pb-4">
                <button onClick={() => setViewState({ level: 'ROOT' })} className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${viewState.level === 'ROOT' ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:text-slate-600'}`}>
                    <Home size={14}/> <span className="text-[10px] font-black uppercase tracking-widest">Resumen</span>
                </button>

                {viewState.level !== 'ROOT' && (
                    <>
                        <ChevronRight size={14} className="text-slate-300" />
                        <button onClick={() => setViewState({ level: 'FAMILY', itemId: viewState.level === 'CATEGORY' ? data.categories.find(c=>c.id===viewState.itemId)?.familyId : viewState.itemId, itemName: viewState.level === 'CATEGORY' ? data.families.find(f=>f.id === data.categories.find(c=>c.id===viewState.itemId)?.familyId)?.name : viewState.itemName, itemType: viewState.itemType })} className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${viewState.level === 'FAMILY' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-indigo-50 text-indigo-400 hover:text-indigo-600'}`}>
                            {viewState.itemType === 'INCOME' ? <ArrowUpCircle size={14}/> : <ArrowDownCircle size={14}/>}
                            <span className="text-[10px] font-black uppercase tracking-widest">{viewState.level === 'CATEGORY' ? data.families.find(f=>f.id === data.categories.find(c=>c.id===viewState.itemId)?.familyId)?.name : viewState.itemName}</span>
                        </button>
                    </>
                )}

                {viewState.level === 'CATEGORY' && (
                    <>
                        <ChevronRight size={14} className="text-slate-300" />
                        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl shadow-lg">
                            <span className="text-[10px] font-black uppercase tracking-widest">{viewState.itemName}</span>
                        </div>
                    </>
                )}
            </div>

            <div className="flex-1 w-full relative min-h-[400px]">
                {/* NIVEL 0: ROOT - DOS DONUTS (Ingresos y Gastos) */}
                {viewState.level === 'ROOT' && (chartData as any).type === 'ROOT' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 h-full">
                        {/* IZQUIERDA: INGRESOS */}
                        <div className="flex flex-col items-center">
                            <div className="flex items-center gap-2 mb-4 text-emerald-600">
                                <ArrowUpCircle size={20}/>
                                <span className="text-sm font-black uppercase tracking-widest">Ingresos por Familia</span>
                            </div>
                            <div className="w-full h-[300px] relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={(chartData as any).incomeData}
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={5}
                                            dataKey="value"
                                            onClick={(entry) => setViewState({ level: 'FAMILY', itemId: entry.id, itemName: entry.name, itemType: 'INCOME' })}
                                            cursor="pointer"
                                        >
                                            {(chartData as any).incomeData.map((entry: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '10px', fontWeight: 'bold'}}/>
                                    </PieChart>
                                </ResponsiveContainer>
                                {(chartData as any).incomeData.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-xs font-bold uppercase">Sin datos</div>}
                            </div>
                        </div>

                        {/* DERECHA: GASTOS */}
                        <div className="flex flex-col items-center">
                            <div className="flex items-center gap-2 mb-4 text-rose-500">
                                <ArrowDownCircle size={20}/>
                                <span className="text-sm font-black uppercase tracking-widest">Gastos por Familia</span>
                            </div>
                            <div className="w-full h-[300px] relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={(chartData as any).expenseData}
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={5}
                                            dataKey="value"
                                            onClick={(entry) => setViewState({ level: 'FAMILY', itemId: entry.id, itemName: entry.name, itemType: 'EXPENSE' })}
                                            cursor="pointer"
                                        >
                                            {(chartData as any).expenseData.map((entry: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '10px', fontWeight: 'bold'}}/>
                                    </PieChart>
                                </ResponsiveContainer>
                                {(chartData as any).expenseData.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-xs font-bold uppercase">Sin datos</div>}
                            </div>
                        </div>
                    </div>
                )}

                {/* NIVEL 1: FAMILIA - UN DONUT (Categorías) */}
                {viewState.level === 'FAMILY' && (chartData as any).type === 'FAMILY' && (
                    <div className="flex flex-col items-center h-full animate-in zoom-in-95 duration-300">
                        <div className="flex items-center gap-2 mb-6">
                            <span className="text-slate-400 text-xs font-bold uppercase">Desglose de:</span>
                            <span className={`text-xl font-black uppercase tracking-tighter ${viewState.itemType === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>{viewState.itemName}</span>
                        </div>
                        <div className="w-full h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={(chartData as any).data}
                                        innerRadius={80}
                                        outerRadius={140}
                                        paddingAngle={2}
                                        dataKey="value"
                                        onClick={(entry) => setViewState({ level: 'CATEGORY', itemId: entry.id, itemName: entry.name, itemType: viewState.itemType })}
                                        cursor="pointer"
                                    >
                                        {(chartData as any).data.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend 
                                        layout="vertical" verticalAlign="middle" align="right" 
                                        content={(props) => (
                                            <div className="flex flex-col gap-2 ml-4">
                                                {props.payload?.map((entry: any, index: number) => (
                                                    <div key={`item-${index}`} className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => setViewState({ level: 'CATEGORY', itemId: (chartData as any).data[index].id, itemName: (chartData as any).data[index].name, itemType: viewState.itemType })}>
                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}/>
                                                        {entry.value}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* NIVEL 2: CATEGORÍA - LINE CHART (Evolución) */}
                {viewState.level === 'CATEGORY' && (chartData as any).type === 'CATEGORY' && (
                    <div className="flex flex-col items-center h-full animate-in slide-in-from-right-8 duration-300">
                        <div className="flex items-center gap-2 mb-6">
                            <span className="text-slate-400 text-xs font-bold uppercase">Evolución:</span>
                            <span className="text-xl font-black text-amber-500 uppercase tracking-tighter">{viewState.itemName}</span>
                        </div>
                        <div className="w-full h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={(chartData as any).data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" tickFormatter={formatDateLabel} style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }} tickLine={false} axisLine={false} dy={10} minTickGap={30} />
                                    <YAxis tickFormatter={compactCurrency} style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }} tickLine={false} axisLine={false} width={40} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Line 
                                        type="monotone" 
                                        dataKey="value" 
                                        stroke={viewState.itemType === 'INCOME' ? '#10b981' : '#f43f5e'} 
                                        strokeWidth={4} 
                                        dot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: viewState.itemType === 'INCOME' ? '#10b981' : '#f43f5e' }} 
                                        activeDot={{ r: 6 }} 
                                        connectNulls 
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};