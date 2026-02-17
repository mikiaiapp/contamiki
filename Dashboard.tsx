import React, { useMemo, useState } from 'react';
import { AppState, GlobalFilter, Transaction, BookMetadata } from './types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, Wallet, ArrowUpCircle, ArrowDownCircle, X, Plus } from 'lucide-react';

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
const getAmountColor = (amount: number) => amount > 0 ? 'text-emerald-600' : amount < 0 ? 'text-rose-600' : 'text-slate-400';

export const Dashboard: React.FC<DashboardProps> = ({ data, onAddTransaction, onUpdateData, filter, onUpdateFilter, onNavigateToTransactions, currentBook }) => {
  const [pointDetailTxs, setPointDetailTxs] = useState<{ date: string, txs: Transaction[] } | null>(null);
  const [showBalanceDetail, setShowBalanceDetail] = useState(false);

  // Filter transactions based on global filter
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
    
    return data.transactions
        .filter(t => t.date >= start && t.date <= end)
        .sort((a, b) => b.date.localeCompare(a.date));
  }, [data.transactions, filter]);

  // Calculations
  const { totalIncome, totalExpense, balanceChange } = useMemo(() => {
    let inc = 0, exp = 0;
    filteredTransactions.forEach(t => {
       if (t.type === 'INCOME') inc += t.amount;
       else if (t.type === 'EXPENSE') exp += Math.abs(t.amount);
    });
    return { totalIncome: inc, totalExpense: exp, balanceChange: inc - exp };
  }, [filteredTransactions]);

  const currentTotalBalance = useMemo(() => {
      // Calculate total balance of all active accounts
      let initial = 0;
      data.accounts.forEach(a => { if(a.active !== false) initial += a.initialBalance; });
      
      // Add all transactions up to today (or end of filter?) -> Usually current balance implies ALL transactions
      // But for dashboard context, maybe we want "End of Period Balance"? 
      // Let's stick to Current Actual Balance (All time)
      const allTxSum = data.transactions.reduce((acc, t) => {
           // Exclude transfers that are internal if we sum everything, but here we just sum amounts relative to accounts.
           // Actually simpler: sum(incomes) - sum(expenses). Transfers cancel out if both accounts are ours.
           // However, if we filter by account active status it's complex.
           // Simplification: Sum all transaction amounts.
           return acc + t.amount;
      }, 0);
      
      return initial + allTxSum;
  }, [data.accounts, data.transactions]);

  // Chart Data
  const chartData = useMemo(() => {
      if (filteredTransactions.length === 0) return [];
      
      const dailyMap = new Map<string, number>();
      // Initialize with 0 for range? optional.
      
      // We want cumulative or daily? Let's do Daily Net for now, or Cumulative for the period.
      // Let's do Daily Flow (Income - Expense)
      filteredTransactions.forEach(t => {
          const val = t.type === 'EXPENSE' ? t.amount : t.type === 'INCOME' ? t.amount : 0; // Transfers 0 for net flow
          dailyMap.set(t.date, (dailyMap.get(t.date) || 0) + val);
      });

      const sortedDates = Array.from(dailyMap.keys()).sort();
      return sortedDates.map(date => ({ date, value: dailyMap.get(date) || 0 }));
  }, [filteredTransactions]);

  const handleChartClick = (data: any) => {
      if (data && data.activePayload && data.activePayload.length > 0) {
          const clickedDate = data.activePayload[0].payload.date;
          const txs = filteredTransactions.filter(t => t.date === clickedDate);
          setPointDetailTxs({ date: clickedDate, txs });
      }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform"><Wallet size={100}/></div>
              <div className="relative z-10">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Balance Global</p>
                  <h3 className="text-4xl font-black tracking-tighter mb-1">{formatCurrency(currentTotalBalance)}</h3>
                  <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase ${balanceChange >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                      {balanceChange >= 0 ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                      <span>{balanceChange >= 0 ? '+' : ''}{formatCurrency(balanceChange)} este periodo</span>
                  </div>
              </div>
          </div>

          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between group hover:border-emerald-200 transition-colors">
              <div className="flex justify-between items-start">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><ArrowUpCircle size={24}/></div>
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Ingresos</span>
              </div>
              <div>
                  <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{formatCurrency(totalIncome)}</h3>
              </div>
          </div>

          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between group hover:border-rose-200 transition-colors">
              <div className="flex justify-between items-start">
                  <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl"><ArrowDownCircle size={24}/></div>
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Gastos</span>
              </div>
              <div>
                  <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{formatCurrency(totalExpense)}</h3>
              </div>
          </div>
      </div>

      {/* CHART AREA */}
      <div className="bg-white p-6 md:p-10 rounded-[3rem] shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-6">
               <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Flujo Diario</h3>
          </div>
          <div className="h-[250px] w-full">
               {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} onClick={handleChartClick}>
                        <defs>
                            <linearGradient id="colorFlow" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" tickFormatter={(val) => val.split('-')[2]} style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }} tickLine={false} axisLine={false} dy={10} minTickGap={30} />
                        <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            labelStyle={{ color: '#64748b', fontWeight: 'bold', fontSize: '12px' }}
                            formatter={(value: number) => [formatCurrency(value), 'Flujo Neto']}
                        />
                        <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorFlow)" />
                    </AreaChart>
                </ResponsiveContainer>
               ) : (
                   <div className="h-full flex items-center justify-center text-slate-300 text-xs font-bold uppercase tracking-widest">Sin datos para graficar</div>
               )}
          </div>
      </div>

      {/* RECENT TRANSACTIONS */}
      <div className="bg-white p-6 md:p-8 rounded-[3rem] shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-6 px-2">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Movimientos Recientes</h3>
              <button onClick={() => onNavigateToTransactions({})} className="text-xs font-black text-indigo-600 uppercase tracking-widest hover:underline">Ver Todo</button>
          </div>
          <div className="space-y-2">
              {filteredTransactions.slice(0, 5).map(t => (
                  <div key={t.id} className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-colors group">
                      <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${t.type === 'INCOME' ? 'bg-emerald-50' : t.type === 'EXPENSE' ? 'bg-rose-50' : 'bg-slate-100'}`}>
                             {t.type === 'INCOME' ? '💰' : t.type === 'EXPENSE' ? '💸' : '↔️'}
                          </div>
                          <div>
                              <div className="font-bold text-slate-700 text-sm">{t.description}</div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase">{formatDateDisplay(t.date)}</div>
                          </div>
                      </div>
                      <span className={`font-black text-sm ${getAmountColor(t.amount)}`}>{formatCurrency(t.amount)}</span>
                  </div>
              ))}
              {filteredTransactions.length === 0 && (
                  <div className="text-center py-10 text-slate-400 text-xs font-bold uppercase">No hay movimientos en este periodo</div>
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

      {/* Balance Detail Modal (Placeholder if needed) */}
      {showBalanceDetail && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[250] p-4 animate-in fade-in zoom-in duration-300">
              <div className="bg-white rounded-[2rem] shadow-2xl p-8 max-w-sm w-full relative">
                  <button onClick={() => setShowBalanceDetail(false)} className="absolute top-4 right-4 p-2 bg-slate-50 rounded-full"><X size={16}/></button>
                  <h3 className="text-lg font-black uppercase mb-4">Detalle de Cuentas</h3>
                  <div className="space-y-2">
                      {data.accounts.filter(a => a.active !== false).map(acc => {
                          // Calculate balance per account (approx)
                          // Note: Real balance calculation per account requires filtering all transactions by accountId
                          const bal = acc.initialBalance + data.transactions.filter(t => t.accountId === acc.id || t.transferAccountId === acc.id).reduce((sum, t) => {
                              if (t.accountId === acc.id) return sum + t.amount;
                              if (t.transferAccountId === acc.id) return sum - t.amount; // Transfer IN is positive (t.amount is negative for sender, so we subtract negative? No, logic depends on how transfer is stored)
                              // Assuming t.amount is negative for expense/transfer-out.
                              // If t is TRANSFER, amount is negative. Sender (accountId) gets amount. Receiver (transferAccountId) gets -amount.
                              // Wait, standard logic: Expense is negative. Income is positive. Transfer is negative from Source.
                              // So Receiver should add abs(amount).
                              if (t.transferAccountId === acc.id) return sum + Math.abs(t.amount);
                              return sum;
                          }, 0);
                          
                          return (
                              <div key={acc.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                                  <span className="text-xs font-bold text-slate-600">{acc.name}</span>
                                  <span className="text-xs font-black">{formatCurrency(bal)}</span>
                              </div>
                          );
                      })}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
