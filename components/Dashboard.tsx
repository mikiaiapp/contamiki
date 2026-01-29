import React, { useMemo } from 'react';
import { AppState } from '../types';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Users } from 'lucide-react';

interface DashboardProps {
  data: AppState;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

export const Dashboard: React.FC<DashboardProps> = ({ data }) => {
  const { transactions, accounts, families, entities } = data;

  const stats = useMemo(() => {
    let income = 0;
    let expense = 0;
    transactions.forEach(t => {
      if (t.type === 'INCOME') income += t.amount;
      if (t.type === 'EXPENSE') expense += t.amount;
    });

    const currentTotalBalance = accounts.reduce((acc, account) => {
        // Calculate balance for each account dynamically based on transactions
        const accountTx = transactions.filter(t => t.accountId === account.id);
        const accIncome = accountTx.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
        const accExpense = accountTx.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0);
        return acc + (account.initialBalance + accIncome - accExpense);
    }, 0);

    return { income, expense, balance: currentTotalBalance };
  }, [transactions, accounts]);

  const expenseByFamilyData = useMemo(() => {
    const map = new Map<string, number>();
    transactions.filter(t => t.type === 'EXPENSE').forEach(t => {
      const familyName = families.find(f => f.id === t.familyId)?.name || 'Desconocido';
      map.set(familyName, (map.get(familyName) || 0) + t.amount);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [transactions, families]);

  // Entity Balances (Saldo en Contrapartidas)
  const entityBalances = useMemo(() => {
      if (!entities) return [];
      
      return entities.map(entity => {
          const entityTx = transactions.filter(t => t.entityId === entity.id);
          // Interpretation of "Saldo" for Contrapartida:
          // Expenses paid TO them increases the volume/balance (e.g. how much I paid them)
          // Income received FROM them increases their contribution
          // To make it a "Balance" in a debt sense: 
          // If I buy on credit, debt increases. But here we have generic accounts.
          // We will show "Volumen Total" (Total Volume) and net direction.
          
          const totalPaidTo = entityTx.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0);
          const totalReceivedFrom = entityTx.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
          
          return {
              id: entity.id,
              name: entity.name,
              paid: totalPaidTo,
              received: totalReceivedFrom,
              net: totalReceivedFrom - totalPaidTo // Positive means they gave me more money
          };
      }).filter(e => e.paid > 0 || e.received > 0).sort((a, b) => (b.paid + b.received) - (a.paid + a.received)).slice(0, 5); // Top 5
  }, [transactions, entities]);

  // Last 6 months trend
  const trendData = useMemo(() => {
      const result = [];
      const today = new Date();
      for(let i=5; i>=0; i--) {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const monthKey = d.toLocaleString('es-ES', { month: 'short' });
          
          let monthIncome = 0;
          let monthExpense = 0;

          transactions.forEach(t => {
              const tDate = new Date(t.date);
              if (tDate.getMonth() === d.getMonth() && tDate.getFullYear() === d.getFullYear()) {
                  if (t.type === 'INCOME') monthIncome += t.amount;
                  else monthExpense += t.amount;
              }
          });

          result.push({ name: monthKey, Ingresos: monthIncome, Gastos: monthExpense });
      }
      return result;
  }, [transactions]);


  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Resumen Financiero</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Saldo Total</p>
            <p className="text-3xl font-bold text-slate-800">{stats.balance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
          </div>
          <div className="bg-blue-50 p-3 rounded-full text-blue-600">
            <DollarSign size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Ingresos Totales</p>
            <p className="text-3xl font-bold text-emerald-600">+{stats.income.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
          </div>
          <div className="bg-emerald-50 p-3 rounded-full text-emerald-600">
            <TrendingUp size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Gastos Totales</p>
            <p className="text-3xl font-bold text-rose-600">-{stats.expense.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
          </div>
          <div className="bg-rose-50 p-3 rounded-full text-rose-600">
            <TrendingDown size={24} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chart */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 lg:col-span-2 h-[400px]">
           <h3 className="text-lg font-semibold text-slate-800 mb-4">Tendencia (6 Meses)</h3>
           <ResponsiveContainer width="100%" height="100%">
             <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip formatter={(value: number) => value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} />
                <Legend />
                <Bar dataKey="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
             </BarChart>
           </ResponsiveContainer>
        </div>

        {/* Counterpart Balances */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-[400px] overflow-y-auto">
            <div className="flex items-center gap-2 mb-4">
                <Users className="text-indigo-500" size={20} />
                <h3 className="text-lg font-semibold text-slate-800">Top Contrapartidas</h3>
            </div>
            <div className="space-y-4">
                {entityBalances.length === 0 && <p className="text-slate-400 text-sm">No hay datos de contrapartidas.</p>}
                {entityBalances.map(e => (
                    <div key={e.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                        <div className="flex flex-col">
                            <span className="font-medium text-slate-800 text-sm">{e.name}</span>
                            <span className="text-xs text-slate-500">
                                {e.paid > 0 && `Pagado: ${e.paid.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`}
                                {e.paid > 0 && e.received > 0 && ' | '}
                                {e.received > 0 && `Recibido: ${e.received.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`}
                            </span>
                        </div>
                        <span className={`font-bold text-sm ${e.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {e.net >= 0 ? '+' : ''}{e.net.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                        </span>
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* Expense Breakdown */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-[400px]">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Gastos por Familia</h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={expenseByFamilyData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                fill="#8884d8"
                paddingAngle={5}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {expenseByFamilyData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} />
            </PieChart>
          </ResponsiveContainer>
      </div>
    </div>
  );
};