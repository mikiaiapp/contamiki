import React, { useMemo, useState } from 'react';
import { AppState, GlobalFilter, BookMetadata, Transaction } from './types';
import { TrendingUp, TrendingDown, Wallet, ArrowUpCircle, ArrowDownCircle, MoreHorizontal, X, ChevronRight, Calendar } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell } from 'recharts';

interface DashboardProps {
  data: AppState;
  onAddTransaction: (t: Transaction) => void;
  onUpdateData: (newData: Partial<AppState>) => void;
  filter: GlobalFilter;
  onUpdateFilter: (f: GlobalFilter) => void;
  onNavigateToTransactions: (filters: any) => void;
  currentBook: BookMetadata;
}

const numberFormatter = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatCurrency = (amount: number) => `${numberFormatter.format(amount)} €`;

const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '--/--/--';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y.slice(-2)}`;
};

const formatDateTick = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', { month: 'short' }); // e.g. "ene"
};

const getAmountColor = (amount: number) => {
    if (amount > 0) return 'text-emerald-600';
    if (amount < 0) return 'text-rose-600';
    return 'text-slate-500';
};

export const Dashboard: React.FC<DashboardProps> = ({ data, filter, onUpdateFilter, onNavigateToTransactions, currentBook }) => {
  const [pointDetailTxs, setPointDetailTxs] = useState<{ date: string, txs: Transaction[] } | null>(null);
  const [showBalanceDetail, setShowBalanceDetail] = useState(false);

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    const y = filter.referenceDate.getFullYear();
    const m = filter.referenceDate.getMonth();
    let start = '', end = '';

    if (filter.timeRange === 'MONTH') {
      start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      end = `${y}-${String(m + 1).padStart(2, '0')}-${new Date(y, m + 1, 0).getDate()}`;
    } else if (filter.timeRange === 'YEAR') {
      start = `${y}-01-01`; end = `${y}-12-31`;
    } else if (filter.timeRange === 'CUSTOM') {
      start = filter.customStart || '1900-01-01'; end = filter.customEnd || '2100-12-31';
    }

    return data.transactions.filter(t => t.date >= start && t.date <= end).sort((a, b) => b.date.localeCompare(a.date));
  }, [data.transactions, filter]);

  // Totals
  const { income, expense, balance } = useMemo(() => {
      let inc = 0, exp = 0;
      filteredTransactions.forEach(t => {
          if (t.type === 'INCOME') inc += t.amount;
          else if (t.type === 'EXPENSE') exp += t.amount;
      });
      return { income: inc, expense: exp, balance: inc + exp };
  }, [filteredTransactions]);

  // Chart Data (Daily Balance Evolution within period)
  const chartData = useMemo(() => {
      const dailyMap = new Map<string, number>();
      // Initialize daily map for the range could be complex, simpler is to just map transactions
      // For dashboard, maybe a bar chart of Income vs Expense per day/month is better? 
      // Or just line of cumulative balance? Let's do simple Daily Net Flow.
      
      const map = new Map<string, { income: number, expense: number }>();
      
      filteredTransactions.forEach(t => {
          const key = t.date;
          if (!map.has(key)) map.set(key, { income: 0, expense: 0 });
          const entry = map.get(key)!;
          if (t.type === 'INCOME') entry.income += t.amount;
          else if (t.type === 'EXPENSE') entry.expense += Math.abs(t.amount);
      });

      // Fill gaps if month? Nah, just sort dates
      return Array.from(map.entries())
          .map(([date, val]) => ({ date, ...val, net: val.income - val.expense }))
          .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredTransactions]);

  const CustomTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
          return (
              <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-xl text-xs">
                  <p className="font-bold text-slate-700 mb-1">{formatDateDisplay(label)}</p>
                  <p className="text-emerald-600 font-medium">Ing: {formatCurrency(payload[0].payload.income)}</p>
                  <p className="text-rose-500 font-medium">Gas: {formatCurrency(payload[0].payload.expense)}</p>
              </div>
          );
      }
      return null;
  };

  const handleChartClick = (data: any) => {
      if (data && data.activePayload && data.activePayload.length > 0) {
          const date = data.activePayload[0].payload.date;
          const txs = filteredTransactions.filter(t => t.date === date);
          setPointDetailTxs({ date, txs });
      }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24">
       {/* HEADER & TOTALS */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Wallet size={64} className="text-indigo-600"/></div>
               <div className="relative z-10">
                   <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Balance Periodo</p>
                   <h3 className={`text-3xl font-black mt-2 ${getAmountColor(balance)}`}>{formatCurrency(balance)}</h3>
               </div>
           </div>
           <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><ArrowUpCircle size={64} className="text-emerald-500"/></div>
               <div className="relative z-10">
                   <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Ingresos</p>
                   <h3 className="text-3xl font-black mt-2 text-emerald-500">{formatCurrency(income)}</h3>
               </div>
           </div>
           <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><ArrowDownCircle size={64} className="text-rose-500"/></div>
               <div className="relative z-10">
                   <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Gastos</p>
                   <h3 className="text-3xl font-black mt-2 text-rose-500">{formatCurrency(Math.abs(expense))}</h3>
               </div>
           </div>
       </div>

       {/* CHART */}
       <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm h-80">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Flujo Diario</h4>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} onClick={handleChartClick}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" tickFormatter={formatDateTick} tickLine={false} axisLine={false} style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }} />
                    <Tooltip content={<CustomTooltip />} cursor={{fill: '#f8fafc'}} />
                    <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} stackId="a" />
                    <Bar dataKey="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} stackId="a" />
                </BarChart>
            </ResponsiveContainer>
       </div>

       {/* RECENT TRANSACTIONS */}
       <div className="space-y-4">
           <div className="flex justify-between items-end px-2">
               <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">Movimientos Recientes</h4>
               <button onClick={() => onNavigateToTransactions({})} className="text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-800 flex items-center gap-1">Ver Todo <ChevronRight size={12}/></button>
           </div>
           <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
               {filteredTransactions.slice(0, 5).map(t => (
                   <div key={t.id} className="p-4 border-b border-slate-50 last:border-0 flex items-center justify-between hover:bg-slate-50 transition-colors">
                       <div className="flex items-center gap-4">
                           <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.type === 'INCOME' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                               {t.type === 'INCOME' ? <ArrowUpCircle size={20}/> : <ArrowDownCircle size={20}/>}
                           </div>
                           <div>
                               <p className="text-xs font-bold text-slate-700">{t.description}</p>
                               <p className="text-[10px] text-slate-400 font-bold uppercase">{formatDateDisplay(t.date)}</p>
                           </div>
                       </div>
                       <p className={`text-sm font-black ${getAmountColor(t.amount)}`}>{formatCurrency(t.amount)}</p>
                   </div>
               ))}
               {filteredTransactions.length === 0 && (
                   <div className="p-8 text-center text-slate-400 text-xs font-bold uppercase">No hay movimientos en este periodo</div>
               )}
           </div>
       </div>

        {/* DETAIL MODAL FOR CHART POINT */}
        {pointDetailTxs && (
            <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[250] p-4 animate-in fade-in zoom-in duration-300">
                <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg p-6 sm:p-8 relative border border-white/20 flex flex-col max-h-[85vh]">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex flex-col">
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Detalle del Día</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {formatDateDisplay(pointDetailTxs.date)}
                            </p>
                        </div>
                        <button onClick={() => setPointDetailTxs(null)} className="p-2 bg-slate-50 text-slate-400 rounded-full hover:text-rose-500 hover:bg-rose-50 transition-all"><X size={20}/></button>
                    </div>
                    
                    <div className="overflow-y-auto custom-scrollbar flex-1 -mx-2 px-2">
                        {pointDetailTxs.txs.map(t => (
                            <div key={t.id} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 rounded-xl px-2 transition-colors">
                                <div className="flex flex-col gap-0.5 flex-1 min-w-0 pr-4">
                                    <span className="text-xs font-bold text-slate-700 uppercase truncate" title={t.description}>{t.description}</span>
                                    <span className="text-[9px] text-slate-400 font-medium">{formatDateDisplay(t.date)}</span>
                                </div>
                                <span className={`text-sm font-black whitespace-nowrap ${getAmountColor(t.amount)}`}>{formatCurrency(t.amount)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* BALANCE DETAIL MODAL (Placeholder for showBalanceDetail state usage) */}
        {showBalanceDetail && (
            <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[250] p-4">
                 <div className="bg-white p-8 rounded-3xl">
                     <h3 className="text-lg font-bold">Detalle de Balance</h3>
                     <button onClick={() => setShowBalanceDetail(false)}>Cerrar</button>
                 </div>
            </div>
        )}
    </div>
  );
};
