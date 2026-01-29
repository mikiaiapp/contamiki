import React, { useMemo } from 'react';
import { AppState } from '../types';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

interface DashboardProps {
  data: AppState;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

export const Dashboard: React.FC<DashboardProps> = ({ data }) => {
  const { transactions, accounts, categories } = data;

  const stats = useMemo(() => {
    let income = 0;
    let expense = 0;
    transactions.forEach(t => {
      if (t.type === 'INCOME') income += t.amount;
      if (t.type === 'EXPENSE') expense += t.amount;
    });

    const currentTotalBalance = accounts.reduce((acc, account) => {
        const accountTx = transactions.filter(t => t.accountId === account.id);
        const accIncome = accountTx.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
        const accExpense = accountTx.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0);
        return acc + (account.initialBalance + accIncome - accExpense);
    }, 0);

    return { income, expense, balance: currentTotalBalance };
  }, [transactions, accounts]);

  // Subtotales por Categoría (Padre)
  const expenseByCategoryData = useMemo(() => {
    const map = new Map<string, number>();
    transactions.filter(t => t.type === 'EXPENSE').forEach(t => {
      const category = categories.find(c => c.id === t.categoryId);
      const name = category ? `${category.icon} ${category.name}` : 'Desconocido';
      map.set(name, (map.get(name) || 0) + t.amount);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  }, [transactions, categories]);

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Main Chart */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-[400px]">
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

        {/* Expense Breakdown */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-[400px]">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Gastos por Categoría</h3>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseByCategoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {expenseByCategoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} />
              </PieChart>
            </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};