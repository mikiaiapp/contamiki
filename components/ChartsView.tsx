import React, { useMemo, useState } from 'react';
import { AppState, GlobalFilter, Family, Category, BookMetadata } from '../types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, LineChart, Line, Legend, ReferenceLine } from 'recharts';
import { TrendingUp, PieChart as PieIcon, LineChart as LineIcon, ChevronRight, ArrowDownCircle, ArrowUpCircle, Wallet, X, ChevronLeft } from 'lucide-react';

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

const formatDateTick = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return `${date.getDate()}/${date.getMonth() + 1}`;
};

export const ChartsView: React.FC<ChartsViewProps> = ({ data, filter, onUpdateFilter, currentBook }) => {
  const [activeTab, setActiveTab] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [chartType, setChartType] = useState<'PIE' | 'LINE'>('PIE');
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [catChartType, setCatChartType] = useState<'PIE' | 'LINE'>('PIE');

  // Helpers for Header Navigation
  const years = Array.from({length: new Date().getFullYear() - 2015 + 5}, (_, i) => 2015 + i);
  const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  const navigatePeriod = (direction: 'prev' | 'next') => {
    const newDate = new Date(filter.referenceDate);
    const step = direction === 'next' ? 1 : -1;
    if (filter.timeRange === 'MONTH') newDate.setMonth(newDate.getMonth() + step);
    else if (filter.timeRange === 'YEAR') newDate.setFullYear(newDate.getFullYear() + step);
    onUpdateFilter({ ...filter, referenceDate: newDate });
  };

  const displayLogo = useMemo(() => {
    let logo = currentBook.logo;
    if (logo && logo.startsWith('/api/')) {
        return `${logo}&key=${localStorage.getItem('auth_token')}`;
    }
    return logo || localStorage.getItem('contamiki_custom_logo') || "/contamiki.jpg";
  }, [currentBook.logo]);

  // --- DATA PROCESSING HELPERS ---

  const dateBounds = useMemo(() => {
    const y = filter.referenceDate.getFullYear();
    const m = filter.referenceDate.getMonth();
    let start = '', end = '';
    if (filter.timeRange === 'MONTH') {
      start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      end = `${y}-${String(m + 1).padStart(2, '0')}-${new Date(y, m + 1, 0).getDate()}`;
    } else if (filter.timeRange === 'YEAR') {
      start = `${y}-01-01`; end = `${y}-12-31`;
    } else {
      start = filter.customStart || '1900-01-01'; end = filter.customEnd || '2100-12-31';
    }
    return { start, end };
  }, [filter]);

  // 1. SAVINGS EVOLUTION (Accumulated Balance)
  const savingsData = useMemo(() => {
    const timeline = new Map<string, number>();
    const sortedTx = [...data.transactions].sort((a, b) => a.date.localeCompare(b.date));
    
    // Initial balance calculation (sum of initial balances of all accounts)
    let runningBalance = data.accounts.reduce((acc, a) => acc + a.initialBalance, 0);
    
    // Fill timeline
    sortedTx.forEach(t => {
      if (t.date < dateBounds.start) {
         // Apply to initial balance if before period
         const amt = t.type === 'EXPENSE' || t.type === 'TRANSFER' ? -Math.abs(t.amount) : Math.abs(t.amount);
         // Correction: Transfers within own accounts shouldn't change global balance, 
         // but here we simplify assuming simple sum. Ideally filter out internal transfers.
         if (t.type !== 'TRANSFER' || (t.transferAccountId && !data.accounts.find(a=>a.id===t.transferAccountId))) {
             runningBalance += amt;
         }
      } else if (t.date <= dateBounds.end) {
         const amt = t.type === 'EXPENSE' || t.type === 'TRANSFER' ? -Math.abs(t.amount) : Math.abs(t.amount);
         if (t.type !== 'TRANSFER') {
             runningBalance += amt;
             timeline.set(t.date, runningBalance);
         }
      }
    });

    const result = Array.from(timeline.entries()).map(([date, balance]) => ({ date, balance }));
    if (result.length === 0) return [];

    // Trend Calculation (Simple Linear Regression)
    if (result.length > 5) {
        const n = result.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        result.forEach((p, i) => {
            sumX += i;
            sumY += p.balance;
            sumXY += i * p.balance;
            sumXX += i * i;
        });
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        // Project 3 periods ahead
        const lastDate = new Date(result[result.length - 1].date);
        for (let i = 1; i <= 3; i++) {
            lastDate.setDate(lastDate.getDate() + 10); // +10 days approx steps
            const nextVal = slope * (n + i) + intercept;
            result.push({ date: lastDate.toISOString().split('T')[0], balance: nextVal, isProjection: true } as any);
        }
    }
    return result;
  }, [data.transactions, dateBounds, data.accounts]);

  // 2. BREAKDOWN DATA (Pie & Line)
  const breakdownData = useMemo(() => {
      const familyMap = new Map<string, { total: number, history: Map<string, number>, name: string, icon: string }>();
      const categoryMap = new Map<string, { total: number, history: Map<string, number>, name: string, icon: string }>();

      // Filter active transactions
      const relevantTx = data.transactions.filter(t => 
          t.date >= dateBounds.start && t.date <= dateBounds.end &&
          t.type === activeTab // INCOME or EXPENSE
      );

      relevantTx.forEach(t => {
          const cat = data.categories.find(c => c.id === t.categoryId);
          const famId = t.familyId || cat?.familyId;
          const fam = data.families.find(f => f.id === famId);
          
          if (fam && cat) {
              const val = Math.abs(t.amount);
              
              // Family Aggregation
              if (!familyMap.has(fam.id)) familyMap.set(fam.id, { total: 0, history: new Map(), name: fam.name, icon: fam.icon });
              const fEntry = familyMap.get(fam.id)!;
              fEntry.total += val;
              fEntry.history.set(t.date, (fEntry.history.get(t.date) || 0) + val);

              // Category Aggregation (Only if belonging to selected family or generally)
              if (selectedFamilyId && fam.id === selectedFamilyId) {
                  if (!categoryMap.has(cat.id)) categoryMap.set(cat.id, { total: 0, history: new Map(), name: cat.name, icon: cat.icon });
                  const cEntry = categoryMap.get(cat.id)!;
                  cEntry.total += val;
                  cEntry.history.set(t.date, (cEntry.history.get(t.date) || 0) + val);
              }
          }
      });

      // Format for Pie Chart
      const pieData = Array.from(selectedFamilyId ? categoryMap.entries() : familyMap.entries()).map(([id, d]) => ({
          id, name: d.name, value: d.total, icon: d.icon
      })).sort((a, b) => b.value - a.value);

      // Format for Line Chart
      // Get all unique dates
      const allDates = new Set<string>();
      relevantTx.forEach(t => allDates.add(t.date));
      const sortedDates = Array.from(allDates).sort();

      const lineData = sortedDates.map(date => {
          const point: any = { date };
          const mapToUse = selectedFamilyId ? categoryMap : familyMap;
          mapToUse.forEach((v, k) => {
              point[v.name] = v.history.get(date) || 0;
          });
          return point;
      });

      // Specific Category Line Data (Section 4)
      let catLineData: any[] = [];
      if (selectedCategoryId) {
          const cat = data.categories.find(c => c.id === selectedCategoryId);
          if (cat) {
             const catTx = relevantTx.filter(t => t.categoryId === selectedCategoryId).sort((a, b) => a.date.localeCompare(b.date));
             catLineData = catTx.map(t => ({ date: t.date, value: Math.abs(t.amount) }));
          }
      }

      return { pieData, lineData, catLineData };
  }, [data.transactions, activeTab, dateBounds, selectedFamilyId, selectedCategoryId, data.categories, data.families]);

  // UI Components
  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, icon }: any) => {
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

  const renderIcon = (iconStr: string, className = "w-6 h-6") => {
    if (iconStr?.startsWith('http') || iconStr?.startsWith('data:image')) {
        return <img src={iconStr} className={`${className} object-contain rounded-lg`} referrerPolicy="no-referrer" />;
    }
    return <span className="text-xl">{iconStr || '🔹'}</span>;
  };

  const selectedFamily = data.families.find(f => f.id === selectedFamilyId);
  const selectedCategory = data.categories.find(c => c.id === selectedCategoryId);

  const CustomTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
          return (
              <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-xl text-xs">
                  <p className="font-black text-slate-500 mb-2">{label}</p>
                  {payload.map((p: any, idx: number) => (
                      <div key={idx} style={{ color: p.color }} className="flex items-center gap-2 font-bold">
                          <span>{p.name}:</span>
                          <span>{NUMBER_FORMATTER.format(p.value)}€</span>
                      </div>
                  ))}
              </div>
          );
      }
      return null;
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
                        {/* TODO */}
                        <button 
                            onClick={() => onUpdateFilter({...filter, timeRange: 'ALL'})} 
                            className={`px-6 py-3 text-xs sm:text-sm font-black uppercase tracking-widest rounded-xl transition-all ${filter.timeRange === 'ALL' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Todo
                        </button>

                        {/* AÑO */}
                        <div className={`px-5 py-3 rounded-xl transition-all flex items-center ${filter.timeRange === 'YEAR' ? 'bg-white shadow-sm' : ''}`}>
                             {filter.timeRange === 'YEAR' ? (
                                <select className="bg-transparent text-xs sm:text-sm font-black text-indigo-600 uppercase tracking-widest outline-none cursor-pointer py-1 min-w-[60px]" value={filter.referenceDate.getFullYear()} onChange={(e) => { const d = new Date(filter.referenceDate); d.setFullYear(parseInt(e.target.value)); onUpdateFilter({...filter, timeRange: 'YEAR', referenceDate: d}); }}>
                                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                             ) : (
                                <button onClick={() => onUpdateFilter({...filter, timeRange: 'YEAR'})} className="px-2 text-xs sm:text-sm font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">Año</button>
                             )}
                        </div>

                        {/* MES */}
                        <div className={`px-5 py-3 rounded-xl transition-all flex items-center gap-1 ${filter.timeRange === 'MONTH' ? 'bg-white shadow-sm' : ''}`}>
                            {filter.timeRange === 'MONTH' ? (
                                <div className="flex items-center gap-2">
                                    <select className="bg-transparent text-xs sm:text-sm font-black text-indigo-600 uppercase tracking-widest outline-none cursor-pointer py-1 min-w-[80px]" value={filter.referenceDate.getMonth()} onChange={(e) => { const d = new Date(filter.referenceDate); d.setMonth(parseInt(e.target.value)); onUpdateFilter({...filter, timeRange: 'MONTH', referenceDate: d}); }}>
                                        {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                                    </select>
                                    <span className="text-slate-300 text-xs font-black">/</span>
                                    <select className="bg-transparent text-xs sm:text-sm font-black text-indigo-600 uppercase tracking-widest outline-none cursor-pointer py-1 min-w-[70px]" value={filter.referenceDate.getFullYear()} onChange={(e) => { const d = new Date(filter.referenceDate); d.setFullYear(parseInt(e.target.value)); onUpdateFilter({...filter, timeRange: 'MONTH', referenceDate: d}); }}>
                                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                            ) : (
                                <button onClick={() => onUpdateFilter({...filter, timeRange: 'MONTH'})} className="px-2 text-xs sm:text-sm font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">Mes</button>
                            )}
                        </div>

                        {/* PERSONALIZADO */}
                        <div className={`px-5 py-3 rounded-xl transition-all flex items-center gap-2 ${filter.timeRange === 'CUSTOM' ? 'bg-white shadow-sm' : ''}`}>
                            {filter.timeRange === 'CUSTOM' ? (
                                <div className="flex items-center gap-2">
                                    <input type="date" className="bg-transparent text-xs sm:text-sm font-bold text-slate-700 outline-none w-28 sm:w-32 cursor-pointer py-1" value={filter.customStart} onChange={(e) => onUpdateFilter({...filter, timeRange: 'CUSTOM', customStart: e.target.value})} />
                                    <span className="text-slate-300 text-[10px] font-black">➡</span>
                                    <input type="date" className="bg-transparent text-xs sm:text-sm font-bold text-slate-700 outline-none w-28 sm:w-32 cursor-pointer py-1" value={filter.customEnd} onChange={(e) => onUpdateFilter({...filter, timeRange: 'CUSTOM', customEnd: e.target.value})} />
                                </div>
                            ) : (
                                <button onClick={() => onUpdateFilter({...filter, timeRange: 'CUSTOM'})} className="px-2 text-xs sm:text-sm font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">Pers.</button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* SECTION 1: SAVINGS EVOLUTION */}
        <div className="bg-white p-6 md:p-10 rounded-[3rem] shadow-sm border border-slate-100">
            <div className="flex items-center gap-4 mb-8">
                <div className="bg-slate-950 p-3 rounded-2xl text-white"><TrendingUp size={20}/></div>
                <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Evolución de Patrimonio</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Tendencia proyectada a futuro</p>
                </div>
            </div>
            {savingsData.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-300 opacity-50"><TrendingUp size={48}/><p className="text-[10px] font-black uppercase mt-4">Sin datos de evolución</p></div>
            ) : (
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="99%" height="100%">
                        <AreaChart data={savingsData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                                dataKey="date" 
                                tickFormatter={formatDateTick} 
                                style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }}
                                tickLine={false}
                                axisLine={false}
                                dy={10}
                            />
                            <YAxis 
                                domain={['auto', 'auto']}
                                tickFormatter={compactCurrency}
                                style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }}
                                tickLine={false}
                                axisLine={false}
                                width={40}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <ReferenceLine x={savingsData.find(d => (d as any).isProjection)?.date} stroke="#cbd5e1" strokeDasharray="3 3" />
                            <Area type="monotone" dataKey="balance" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorBalance)" name="Patrimonio" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>

        {/* SECTION 2: GLOBAL COMPOSITION */}
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="bg-slate-100 p-1.5 rounded-2xl flex shadow-inner">
                    <button onClick={() => { setActiveTab('INCOME'); setSelectedFamilyId(null); setSelectedCategoryId(null); }} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'INCOME' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><ArrowUpCircle size={14}/> Ingresos</button>
                    <button onClick={() => { setActiveTab('EXPENSE'); setSelectedFamilyId(null); setSelectedCategoryId(null); }} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'EXPENSE' ? 'bg-white text-rose-500 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><ArrowDownCircle size={14}/> Gastos</button>
                </div>
                <div className="flex bg-white border border-slate-100 rounded-xl p-1">
                    <button onClick={() => setChartType('PIE')} className={`p-2 rounded-lg transition-all ${chartType === 'PIE' ? 'bg-slate-900 text-white' : 'text-slate-300 hover:text-indigo-600'}`}><PieIcon size={16}/></button>
                    <button onClick={() => setChartType('LINE')} className={`p-2 rounded-lg transition-all ${chartType === 'LINE' ? 'bg-slate-900 text-white' : 'text-slate-300 hover:text-indigo-600'}`}><LineIcon size={16}/></button>
                </div>
            </div>

            <div className="bg-white p-6 md:p-10 rounded-[3rem] shadow-sm border border-slate-100 min-h-[400px]">
                <h3 className="text-center text-sm font-black text-slate-900 uppercase tracking-widest mb-8">
                    {activeTab === 'INCOME' ? 'Origen de Ingresos' : 'Distribución de Gastos'} por Familia
                </h3>
                
                {breakdownData.pieData.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-slate-300 opacity-50"><PieIcon size={48}/><p className="text-[10px] font-black uppercase mt-4">Sin datos en este periodo</p></div>
                ) : (
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="99%" height="100%">
                            {chartType === 'PIE' ? (
                                <PieChart>
                                    <Pie
                                        data={breakdownData.pieData}
                                        cx="50%" cy="50%"
                                        innerRadius={60} outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                        label={renderCustomLabel}
                                        labelLine={false}
                                        onClick={(data) => { setSelectedFamilyId(data.id); setSelectedCategoryId(null); }}
                                        cursor="pointer"
                                    >
                                        {breakdownData.pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend 
                                        verticalAlign="bottom" height={36} 
                                        content={(props) => (
                                            <div className="flex flex-wrap justify-center gap-4 mt-4">
                                                {props.payload?.map((entry: any, index: number) => (
                                                    <div key={`item-${index}`} className="flex items-center gap-1.5 cursor-pointer opacity-80 hover:opacity-100 transition-opacity" onClick={() => { setSelectedFamilyId(breakdownData.pieData[index].id); setSelectedCategoryId(null); }}>
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
                                    <XAxis 
                                        dataKey="date" 
                                        tickFormatter={formatDateTick} 
                                        style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }}
                                        tickLine={false}
                                        axisLine={false}
                                        dy={10}
                                    />
                                    <YAxis 
                                        tickFormatter={compactCurrency} 
                                        style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }}
                                        tickLine={false}
                                        axisLine={false}
                                        width={40}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                                    {Object.keys(breakdownData.lineData[0] || {}).filter(k => k !== 'date').map((key, idx) => (
                                        <Line key={key} type="monotone" dataKey={key} stroke={COLORS[idx % COLORS.length]} strokeWidth={3} dot={false} />
                                    ))}
                                </LineChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>

        {/* SECTION 3: FAMILY DRILL-DOWN */}
        {selectedFamilyId && selectedFamily && (
            <div className="space-y-6 animate-in slide-in-from-bottom-8 fade-in">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-100 text-indigo-600 p-2 rounded-xl w-12 h-12 flex items-center justify-center">
                            {renderIcon(selectedFamily.icon, "w-8 h-8")}
                        </div>
                        <h3 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tighter">
                            Detalle: <span className="text-indigo-600">{selectedFamily.name}</span>
                        </h3>
                    </div>
                    <button onClick={() => setSelectedFamilyId(null)} className="p-2 bg-slate-100 rounded-full hover:bg-rose-100 hover:text-rose-500 transition-colors"><X size={20}/></button>
                </div>

                <div className="bg-white p-6 md:p-10 rounded-[3rem] shadow-sm border border-slate-100 min-h-[400px] relative">
                    <div className="absolute top-6 right-8 flex bg-slate-50 border border-slate-100 rounded-xl p-1 z-10">
                        <button onClick={() => setCatChartType('PIE')} className={`p-2 rounded-lg transition-all ${catChartType === 'PIE' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-300 hover:text-indigo-600'}`}><PieIcon size={14}/></button>
                        <button onClick={() => setCatChartType('LINE')} className={`p-2 rounded-lg transition-all ${catChartType === 'LINE' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-300 hover:text-indigo-600'}`}><LineIcon size={14}/></button>
                    </div>

                    <h3 className="text-center text-sm font-black text-slate-900 uppercase tracking-widest mb-8">Desglose por Categorías</h3>
                    
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="99%" height="100%">
                            {catChartType === 'PIE' ? (
                                <PieChart>
                                    <Pie
                                        data={breakdownData.pieData} // Uses filtered data from memo based on selectedFamilyId
                                        cx="50%" cy="50%"
                                        innerRadius={60} outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                        label={renderCustomLabel}
                                        onClick={(data) => setSelectedCategoryId(data.id)}
                                        cursor="pointer"
                                    >
                                        {breakdownData.pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} stroke="none" />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend 
                                        verticalAlign="bottom" height={36} 
                                        content={(props) => (
                                            <div className="flex flex-wrap justify-center gap-4 mt-4">
                                                {props.payload?.map((entry: any, index: number) => (
                                                    <div key={`item-${index}`} className="flex items-center gap-1.5 cursor-pointer opacity-80 hover:opacity-100 transition-opacity" onClick={() => setSelectedCategoryId(breakdownData.pieData[index].id)}>
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
                                    <XAxis 
                                        dataKey="date" 
                                        tickFormatter={formatDateTick} 
                                        style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }}
                                        tickLine={false}
                                        axisLine={false}
                                        dy={10}
                                    />
                                    <YAxis 
                                        tickFormatter={compactCurrency} 
                                        style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }}
                                        tickLine={false}
                                        axisLine={false}
                                        width={40}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                                    {Object.keys(breakdownData.lineData[0] || {}).filter(k => k !== 'date').map((key, idx) => (
                                        <Line key={key} type="monotone" dataKey={key} stroke={COLORS[(idx + 3) % COLORS.length]} strokeWidth={3} dot={false} />
                                    ))}
                                </LineChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        )}

        {/* SECTION 4: CATEGORY DETAIL */}
        {selectedCategoryId && selectedCategory && selectedFamilyId && (
            <div className="space-y-6 animate-in slide-in-from-bottom-8 fade-in">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-white border border-slate-200 p-2 rounded-xl w-12 h-12 flex items-center justify-center">
                            {renderIcon(selectedCategory.icon, "w-8 h-8")}
                        </div>
                        <h3 className="text-lg md:text-xl font-black text-slate-900 uppercase tracking-tighter">
                            Foco: <span className="text-slate-500">{selectedCategory.name}</span>
                        </h3>
                    </div>
                    <button onClick={() => setSelectedCategoryId(null)} className="p-2 bg-slate-100 rounded-full hover:bg-rose-100 hover:text-rose-500 transition-colors"><X size={18}/></button>
                </div>

                <div className="bg-white p-6 md:p-10 rounded-[3rem] shadow-sm border border-slate-100">
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="99%" height="100%">
                            <LineChart data={breakdownData.catLineData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                    dataKey="date" 
                                    tickFormatter={formatDateTick} 
                                    style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }}
                                    tickLine={false}
                                    axisLine={false}
                                    dy={10}
                                />
                                <YAxis 
                                    tickFormatter={compactCurrency} 
                                    style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }}
                                    tickLine={false}
                                    axisLine={false}
                                    width={40}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '10px' }} />
                                <Line type="monotone" dataKey="value" name={selectedCategory.name} stroke="#f59e0b" strokeWidth={4} dot={{ r: 4, fill: '#f59e0b', strokeWidth: 2, stroke: 'white' }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};