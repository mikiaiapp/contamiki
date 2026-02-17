import React, { useMemo, useState } from 'react';
import { AppState, GlobalFilter, Family, Category, BookMetadata } from '../types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, LineChart, Line, Legend, ReferenceLine } from 'recharts';
import { TrendingUp, PieChart as PieIcon, LineChart as LineIcon, ChevronRight, ArrowDownCircle, ArrowUpCircle, Wallet, X, ChevronLeft } from 'lucide-react';

interface ChartsViewProps {
  data: AppState;
  filter: GlobalFilter; // Prop kept for interface compatibility but ignored
  onUpdateFilter: (f: GlobalFilter) => void; // Prop kept but ignored
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
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  // Removed catChartType state as logic is now integrated

  // --- LOCAL INDEPENDENT FILTER STATE ---
  // Default: Interanual (Last 12 months)
  const [localFilter, setLocalFilter] = useState<GlobalFilter>(() => {
      const now = new Date();
      // Start: 1st day of month, 1 year ago
      const start = new Date(now.getFullYear() - 1, now.getMonth(), 1);
      // End: Last day of current month
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      const fmt = (d: Date) => d.toISOString().split('T')[0];
      
      return {
          timeRange: 'CUSTOM',
          referenceDate: now,
          customStart: fmt(start),
          customEnd: fmt(end)
      };
  });

  // Helpers for Header Navigation
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
    if (logo && logo.startsWith('/api/')) {
        return `${logo}&key=${localStorage.getItem('auth_token')}`;
    }
    return logo || localStorage.getItem('contamiki_custom_logo') || "/contamiki.jpg";
  }, [currentBook.logo]);

  // Determine if we are in "Detailed Daily Mode" or "Aggregated Monthly Mode"
  const isMonthlyView = localFilter.timeRange === 'MONTH';

  const formatDateTick = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr; // Fallback for pure month strings if passed differently

    if (isMonthlyView) {
        // Daily view: 01/05
        return `${date.getDate()}/${date.getMonth() + 1}`;
    } else {
        // Monthly view: Ene 24
        return `${monthShorts[date.getMonth()]} ${date.getFullYear().toString().slice(-2)}`;
    }
  };

  const renderIcon = (iconStr: string, className = "w-6 h-6") => {
    if (iconStr?.startsWith('http') || iconStr?.startsWith('data:image')) {
        return <img src={iconStr} className={`${className} object-contain rounded-lg`} referrerPolicy="no-referrer" />;
    }
    return <span className="text-xl">{iconStr || '🔹'}</span>;
  };

  // --- DATA PROCESSING HELPERS ---

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

  // 1. SAVINGS EVOLUTION (Accumulated Balance)
  const savingsData = useMemo(() => {
    const timeline = new Map<string, number>();
    const sortedTx = [...data.transactions].sort((a, b) => a.date.localeCompare(b.date));
    
    // Initial balance calculation
    let runningBalance = data.accounts.reduce((acc, a) => acc + a.initialBalance, 0);
    
    // Fill timeline
    sortedTx.forEach(t => {
      // Calculate effect on balance
      let amt = 0;
      if (t.type === 'EXPENSE' || t.type === 'TRANSFER') amt = -Math.abs(t.amount);
      else amt = Math.abs(t.amount);

      // Correction: Internal transfers shouldn't change global balance unless one account is hidden/external
      const isInternal = t.type === 'TRANSFER' && t.transferAccountId && data.accounts.find(a=>a.id===t.transferAccountId);
      if (isInternal) amt = 0;

      if (t.date < dateBounds.start) {
         runningBalance += amt;
      } else if (t.date <= dateBounds.end) {
         runningBalance += amt;
         // Key determination: Day vs Month
         let key = t.date;
         if (!isMonthlyView) {
             key = t.date.substring(0, 7) + '-01'; 
         }
         timeline.set(key, runningBalance);
      }
    });

    // Prepare real data points: { date, balance, projection: null }
    let result: any[] = Array.from(timeline.entries())
        .map(([date, balance]) => ({ date, balance, projection: null }))
        .sort((a, b) => a.date.localeCompare(b.date));
        
    if (result.length === 0) return [];

    // Trend Calculation & Projection (Horizon: 3 Months)
    if (result.length > 3) {
        const n = result.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        // Calculate regression based on indices
        result.forEach((p, i) => { sumX += i; sumY += p.balance; sumXY += i * p.balance; sumXX += i * i; });
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        // Start projection from the last real point to ensure continuity
        const lastRealPoint = result[result.length - 1];
        lastRealPoint.projection = lastRealPoint.balance; // Connect the lines

        const lastDate = new Date(lastRealPoint.date);
        
        // Project 3 steps ahead (Months)
        for (let i = 1; i <= 3; i++) {
            // Ensure we project months into the future regardless of current view granularity
            // to show the "horizon" requested.
            lastDate.setMonth(lastDate.getMonth() + 1);
            
            const nextVal = slope * (n + i) + intercept;
            result.push({ 
                date: lastDate.toISOString().split('T')[0], 
                balance: null, // No real data
                projection: nextVal, 
                isProjection: true 
            });
        }
    }
    return result;
  }, [data.transactions, dateBounds, data.accounts, isMonthlyView]);

  // 2. BREAKDOWN DATA (Pie & Line)
  const breakdownData = useMemo(() => {
      const familyMap = new Map<string, { total: number, history: Map<string, number>, name: string, icon: string }>();
      const categoryMap = new Map<string, { total: number, history: Map<string, number>, name: string, icon: string }>();

      const relevantTx = data.transactions.filter(t => 
          t.date >= dateBounds.start && t.date <= dateBounds.end &&
          t.type === activeTab
      );

      relevantTx.forEach(t => {
          const cat = data.categories.find(c => c.id === t.categoryId);
          const famId = t.familyId || cat?.familyId;
          const fam = data.families.find(f => f.id === famId);
          
          if (fam && cat) {
              const val = Math.abs(t.amount);
              // Key: YYYY-MM-DD or YYYY-MM-01
              const key = isMonthlyView ? t.date : (t.date.substring(0, 7) + '-01');
              
              if (!familyMap.has(fam.id)) familyMap.set(fam.id, { total: 0, history: new Map(), name: fam.name, icon: fam.icon });
              const fEntry = familyMap.get(fam.id)!;
              fEntry.total += val;
              fEntry.history.set(key, (fEntry.history.get(key) || 0) + val);

              if (selectedFamilyId && fam.id === selectedFamilyId) {
                  if (!categoryMap.has(cat.id)) categoryMap.set(cat.id, { total: 0, history: new Map(), name: cat.name, icon: cat.icon });
                  const cEntry = categoryMap.get(cat.id)!;
                  cEntry.total += val;
                  cEntry.history.set(key, (cEntry.history.get(key) || 0) + val);
              }
          }
      });

      const pieData = Array.from(selectedFamilyId ? categoryMap.entries() : familyMap.entries()).map(([id, d]) => ({
          id, name: d.name, value: d.total, icon: d.icon
      })).sort((a, b) => b.value - a.value);

      // Line Data Construction
      const allDates = new Set<string>();
      // Collect all keys from all histories
      const mapToUse = selectedFamilyId ? categoryMap : familyMap;
      mapToUse.forEach(v => {
          for (const k of v.history.keys()) allDates.add(k);
      });
      
      const sortedDates = Array.from(allDates).sort();

      const lineData = sortedDates.map(date => {
          const point: any = { date };
          mapToUse.forEach((v, k) => {
              point[v.name] = v.history.get(date) || 0;
          });
          return point;
      });

      // Specific Category Line Data
      let catLineData: any[] = [];
      if (selectedCategoryId) {
          const cat = data.categories.find(c => c.id === selectedCategoryId);
          if (cat) {
             // We can reuse the loop or filter again. Filtering is cleaner.
             const catTx = relevantTx.filter(t => t.categoryId === selectedCategoryId);
             
             // Aggregate manually
             const aggMap = new Map<string, number>();
             catTx.forEach(t => {
                 const key = isMonthlyView ? t.date : (t.date.substring(0, 7) + '-01');
                 aggMap.set(key, (aggMap.get(key) || 0) + Math.abs(t.amount));
             });

             catLineData = Array.from(aggMap.entries())
                .map(([date, value]) => ({ date, value }))
                .sort((a, b) => a.date.localeCompare(b.date));
          }
      }

      return { pieData, lineData, catLineData };
  }, [data.transactions, activeTab, dateBounds, selectedFamilyId, selectedCategoryId, data.categories, data.families, isMonthlyView]);

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

  const selectedFamily = data.families.find(f => f.id === selectedFamilyId);
  const selectedCategory = data.categories.find(c => c.id === selectedCategoryId);

  const CustomTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
          const title = formatDateTick(label); // Use the same formatter
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

                    <div className="bg-slate-100 p-2 rounded-2xl flex flex-wrap gap-1 shadow-inner