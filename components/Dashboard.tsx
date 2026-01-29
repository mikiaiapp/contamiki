import React, { useMemo, useState } from 'react';
import { AppState, Family, Category } from '../types';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Calendar, ChevronDown, ChevronRight } from 'lucide-react';

interface DashboardProps {
  data: AppState;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

type TimeRange = 'MONTH' | 'QUARTER' | 'YEAR' | 'CUSTOM';

export const Dashboard: React.FC<DashboardProps> = ({ data }) => {
  const { transactions, accounts, families, categories } = data;
  
  // Estado para filtros de fecha
  const [timeRange, setTimeRange] = useState<TimeRange>('MONTH');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  // Estado para desglose expandible
  const [expandedFamilies, setExpandedFamilies] = useState<Record<string, boolean>>({});

  // Cálculo de fechas
  const dateFilter = useMemo(() => {
    const now = new Date();
    let start = new Date(now.getFullYear(), now.getMonth(), 1);
    let end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    if (timeRange === 'QUARTER') {
      const quarter = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), quarter * 3, 1);
      end = new Date(now.getFullYear(), quarter * 3 + 3, 0);
    } else if (timeRange === 'YEAR') {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31);
    } else if (timeRange === 'CUSTOM' && customStartDate && customEndDate) {
      start = new Date(customStartDate);
      end = new Date(customEndDate);
    }

    return { start, end };
  }, [timeRange, customStartDate, customEndDate]);

  // Transacciones Filtradas por fecha
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const tDate = new Date(t.date);
      return tDate >= dateFilter.start && tDate <= dateFilter.end;
    });
  }, [transactions, dateFilter]);

  // Estadísticas Generales (Balance Global siempre usa TODAS las transacciones para ser real)
  const globalStats = useMemo(() => {
    // El balance actual de las cuentas se calcula con el histórico completo
    const currentTotalBalance = accounts.reduce((acc, account) => {
        let accBalance = account.initialBalance;
        
        transactions.forEach(t => {
            if (t.accountId === account.id) {
                if (t.type === 'INCOME') accBalance += t.amount;
                else if (t.type === 'EXPENSE') accBalance -= t.amount;
                else if (t.type === 'TRANSFER') accBalance -= t.amount; // Salida por traspaso
            }
            if (t.transferAccountId === account.id && t.type === 'TRANSFER') {
                accBalance += t.amount; // Entrada por traspaso
            }
        });
        return acc + accBalance;
    }, 0);

    // Ingresos y Gastos solo del periodo seleccionado
    let periodIncome = 0;
    let periodExpense = 0;

    filteredTransactions.forEach(t => {
      if (t.type === 'INCOME') periodIncome += t.amount;
      if (t.type === 'EXPENSE') periodExpense += t.amount;
    });

    return { income: periodIncome, expense: periodExpense, balance: currentTotalBalance };
  }, [transactions, filteredTransactions, accounts]);

  // Datos para Gráfico Circular (Gastos por Familia en el periodo)
  const expenseByFamilyData = useMemo(() => {
    const map = new Map<string, number>();
    filteredTransactions.filter(t => t.type === 'EXPENSE').forEach(t => {
      const family = families.find(f => f.id === t.familyId);
      const name = family ? family.name : 'Otros';
      map.set(name, (map.get(name) || 0) + t.amount);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a,b) => b.value - a.value);
  }, [filteredTransactions, families]);

  // Datos para Gráfico de Barras (Tendencia dentro del periodo o últimos 6 meses si es CUSTOM muy largo)
  const trendData = useMemo(() => {
      // Simplificación: Agrupar por mes los datos filtrados
      // Si el rango es corto (1 mes), agrupar por semanas? Por ahora mantenemos lógica mensual
      // pero basada en los datos filtrados.
      const map = new Map<string, {income: number, expense: number}>();
      
      // Inicializar claves para ordenar cronológicamente
      const start = new Date(dateFilter.start);
      const end = new Date(dateFilter.end);
      const loop = new Date(start);
      
      while(loop <= end) {
          const key = loop.toLocaleString('es-ES', { month: 'short', year: '2-digit' });
          if(!map.has(key)) map.set(key, {income: 0, expense: 0});
          loop.setMonth(loop.getMonth() + 1);
      }

      filteredTransactions.forEach(t => {
         const tDate = new Date(t.date);
         const key = tDate.toLocaleString('es-ES', { month: 'short', year: '2-digit' });
         if (map.has(key)) { // Solo si cae en los meses generados (por si acaso)
             const entry = map.get(key)!;
             if(t.type === 'INCOME') entry.income += t.amount;
             if(t.type === 'EXPENSE') entry.expense += t.amount;
         }
      });

      return Array.from(map.entries()).map(([name, val]) => ({
          name, 
          Ingresos: val.income, 
          Gastos: val.expense 
      }));
  }, [filteredTransactions, dateFilter]);

  // Estructura Jerárquica para la Tabla (Familia -> Categorías)
  const hierarchicalData = useMemo(() => {
      const data: { family: Family, total: number, categories: { category: Category, total: number }[] }[] = [];

      families.forEach(fam => {
          // Filtrar transacciones de esta familia en el periodo
          const famTxs = filteredTransactions.filter(t => t.familyId === fam.id);
          const totalFam = famTxs.reduce((sum, t) => sum + t.amount, 0);

          if (totalFam > 0 || famTxs.length > 0) {
              const famCats: { category: Category, total: number }[] = [];
              
              categories.filter(c => c.familyId === fam.id).forEach(cat => {
                  const catTotal = famTxs.filter(t => t.categoryId === cat.id).reduce((sum, t) => sum + t.amount, 0);
                  if (catTotal > 0) {
                      famCats.push({ category: cat, total: catTotal });
                  }
              });
              
              // Ordenar categorías por importe
              famCats.sort((a,b) => b.total - a.total);

              data.push({
                  family: fam,
                  total: totalFam,
                  categories: famCats
              });
          }
      });

      // Ordenar familias por importe total
      return data.sort((a,b) => b.total - a.total);
  }, [families, categories, filteredTransactions]);

  const toggleFamily = (id: string) => {
      setExpandedFamilies(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const renderIcon = (iconStr: string) => {
      if (iconStr.startsWith('data:image')) {
          return <img src={iconStr} alt="icon" className="w-5 h-5 object-contain inline-block mr-2" />;
      }
      return <span className="mr-2">{iconStr}</span>;
  }

  return (
    <div className="space-y-6">
      {/* Header & Filtros */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Panel de Control</h2>
            <p className="text-sm text-slate-500">
                {dateFilter.start.toLocaleDateString()} - {dateFilter.end.toLocaleDateString()}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2 items-center">
              <div className="flex bg-slate-100 rounded-lg p-1">
                  <button onClick={() => setTimeRange('MONTH')} className={`px-3 py-1.5 text-sm rounded-md transition-all ${timeRange === 'MONTH' ? 'bg-white shadow text-emerald-600' : 'text-slate-500'}`}>Mes</button>
                  <button onClick={() => setTimeRange('QUARTER')} className={`px-3 py-1.5 text-sm rounded-md transition-all ${timeRange === 'QUARTER' ? 'bg-white shadow text-emerald-600' : 'text-slate-500'}`}>Trimestre</button>
                  <button onClick={() => setTimeRange('YEAR')} className={`px-3 py-1.5 text-sm rounded-md transition-all ${timeRange === 'YEAR' ? 'bg-white shadow text-emerald-600' : 'text-slate-500'}`}>Año</button>
                  <button onClick={() => setTimeRange('CUSTOM')} className={`px-3 py-1.5 text-sm rounded-md transition-all ${timeRange === 'CUSTOM' ? 'bg-white shadow text-emerald-600' : 'text-slate-500'}`}>Otro</button>
              </div>
              
              {timeRange === 'CUSTOM' && (
                  <div className="flex gap-2 items-center">
                      <input type="date" className="border rounded px-2 py-1 text-sm" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} />
                      <span className="text-slate-400">-</span>
                      <input type="date" className="border rounded px-2 py-1 text-sm" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} />
                  </div>
              )}
          </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Saldo Actual (Global)</p>
            <p className="text-3xl font-bold text-slate-800">{globalStats.balance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
          </div>
          <div className="bg-blue-50 p-3 rounded-full text-blue-600">
            <DollarSign size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Ingresos (Periodo)</p>
            <p className="text-3xl font-bold text-emerald-600">+{globalStats.income.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
          </div>
          <div className="bg-emerald-50 p-3 rounded-full text-emerald-600">
            <TrendingUp size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Gastos (Periodo)</p>
            <p className="text-3xl font-bold text-rose-600">-{globalStats.expense.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
          </div>
          <div className="bg-rose-50 p-3 rounded-full text-rose-600">
            <TrendingDown size={24} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Main Chart */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-[400px]">
           <h3 className="text-lg font-semibold text-slate-800 mb-4">Evolución en el periodo</h3>
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
                  label={({ name, percent }) => `${name.substring(0, 10)} ${(percent * 100).toFixed(0)}%`}
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

      {/* Breakdown Table Hierarchy */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-800">Desglose Detallado por Familia</h3>
          </div>
          <div className="divide-y divide-slate-100">
              {hierarchicalData.map((item) => (
                  <div key={item.family.id} className="bg-white">
                      {/* Family Header Row */}
                      <div 
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                        onClick={() => toggleFamily(item.family.id)}
                      >
                          <div className="flex items-center gap-2">
                              {expandedFamilies[item.family.id] ? <ChevronDown size={18} className="text-slate-400"/> : <ChevronRight size={18} className="text-slate-400"/>}
                              {renderIcon(item.family.icon)}
                              <span className="font-semibold text-slate-800">{item.family.name}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${item.family.type === 'INCOME' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                  {item.family.type === 'INCOME' ? 'Ingreso' : 'Gasto'}
                              </span>
                          </div>
                          <span className={`font-bold ${item.family.type === 'INCOME' ? 'text-emerald-600' : 'text-slate-700'}`}>
                              {item.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                          </span>
                      </div>

                      {/* Categories Rows (Expanded) */}
                      {expandedFamilies[item.family.id] && (
                          <div className="bg-slate-50/50 border-t border-slate-100">
                              {item.categories.map(sub => (
                                  <div key={sub.category.id} className="flex items-center justify-between py-3 pl-12 pr-4 text-sm hover:bg-slate-100 transition-colors">
                                      <div className="flex items-center gap-2">
                                          {renderIcon(sub.category.icon)}
                                          <span className="text-slate-600">{sub.category.name}</span>
                                      </div>
                                      <span className="text-slate-700 font-medium">
                                          {sub.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                      </span>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              ))}
              {hierarchicalData.length === 0 && (
                  <div className="p-8 text-center text-slate-400">
                      No hay datos en este periodo.
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};