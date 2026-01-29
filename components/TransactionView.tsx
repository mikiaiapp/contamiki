import React, { useState } from 'react';
import { AppState, Transaction, TransactionType } from '../types';
import { Plus, Trash2, Filter, Search } from 'lucide-react';

interface TransactionViewProps {
  data: AppState;
  onAddTransaction: (t: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
}

export const TransactionView: React.FC<TransactionViewProps> = ({ data, onAddTransaction, onDeleteTransaction }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState('');
  
  // Form State
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [accountId, setAccountId] = useState(data.accounts[0]?.id || '');
  
  // Hierarchy Selection
  const [selectedCategoryId, setSelectedCategoryId] = useState(''); // First select parent
  const [selectedFamilyId, setSelectedFamilyId] = useState(''); // Then select child (target)

  // Filtered Logic
  const filteredTransactions = data.transactions
    .filter(t => t.description.toLowerCase().includes(filter.toLowerCase()) || 
                 data.families.find(f => f.id === t.familyId)?.name.toLowerCase().includes(filter.toLowerCase()) ||
                 data.categories.find(c => c.id === t.categoryId)?.name.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description || !accountId || !selectedFamilyId) return;

    // We store the familyId (User selection) and the categoryId (Parent of family)
    const family = data.families.find(f => f.id === selectedFamilyId);
    if (!family) return;

    const newTx: Transaction = {
      id: crypto.randomUUID(),
      date,
      amount: parseFloat(amount),
      description,
      accountId,
      familyId: selectedFamilyId,
      categoryId: family.categoryId,
      type
    };

    onAddTransaction(newTx);
    setIsModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
      setAmount('');
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);
      setSelectedCategoryId('');
      setSelectedFamilyId('');
  };

  // 1. Filtrar Categorías por Tipo (Ingreso/Gasto)
  const availableCategories = data.categories.filter(c => c.type === type);
  
  // 2. Filtrar Familias por la Categoría seleccionada
  const availableFamilies = data.families.filter(f => f.categoryId === selectedCategoryId);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Movimientos</h2>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus size={18} /> Añadir Movimiento
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex gap-4">
        <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
                type="text" 
                placeholder="Buscar movimientos..." 
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
            />
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Fecha</th>
              <th className="px-6 py-4">Descripción</th>
              <th className="px-6 py-4">Categoría (Grupo)</th>
              <th className="px-6 py-4">Familia (Detalle)</th>
              <th className="px-6 py-4">Cuenta</th>
              <th className="px-6 py-4 text-right">Importe</th>
              <th className="px-6 py-4 text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTransactions.map(t => {
                const category = data.categories.find(c => c.id === t.categoryId);
                const family = data.families.find(f => f.id === t.familyId);
                const account = data.accounts.find(a => a.id === t.accountId);
                
                return (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-600">{t.date}</td>
                        <td className="px-6 py-4 font-medium text-slate-800">{t.description}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                           {category ? `${category.icon} ${category.name}` : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700 font-medium">
                            {family ? `${family.icon} ${family.name}` : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                           {account ? `${account.icon} ${account.name}` : '-'}
                        </td>
                        <td className={`px-6 py-4 text-right font-bold ${t.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {t.type === 'INCOME' ? '+' : '-'}{t.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                        </td>
                        <td className="px-6 py-4 text-center">
                            <button 
                                onClick={() => onDeleteTransaction(t.id)}
                                className="text-slate-400 hover:text-red-500 transition-colors"
                            >
                                <Trash2 size={18} />
                            </button>
                        </td>
                    </tr>
                );
            })}
            {filteredTransactions.length === 0 && (
                <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                        No se encontraron movimientos.
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 my-8">
                <h3 className="text-xl font-bold mb-4">Añadir Movimiento</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Type Toggle */}
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button 
                            type="button"
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${type === 'EXPENSE' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`}
                            onClick={() => { setType('EXPENSE'); setSelectedCategoryId(''); setSelectedFamilyId(''); }}
                        >
                            Gasto
                        </button>
                        <button 
                            type="button"
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${type === 'INCOME' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
                            onClick={() => { setType('INCOME'); setSelectedCategoryId(''); setSelectedFamilyId(''); }}
                        >
                            Ingreso
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Importe</label>
                            <input 
                                type="number" step="0.01" required 
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                value={amount} onChange={e => setAmount(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                            <input 
                                type="date" required 
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                value={date} onChange={e => setDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                        <input 
                            type="text" required 
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={description} onChange={e => setDescription(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Cuenta Bancaria / Caja</label>
                        <select 
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={accountId} onChange={e => setAccountId(e.target.value)}
                        >
                            {data.accounts.map(a => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
                            <select 
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                value={selectedCategoryId} 
                                onChange={e => { setSelectedCategoryId(e.target.value); setSelectedFamilyId(''); }}
                                required
                            >
                                <option value="">Seleccionar...</option>
                                {availableCategories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                            </select>
                            <p className="text-xs text-slate-400 mt-1">Selecciona el grupo principal.</p>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Familia (Detalle)</label>
                            <select 
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                value={selectedFamilyId} 
                                onChange={e => setSelectedFamilyId(e.target.value)}
                                disabled={!selectedCategoryId}
                                required
                            >
                                <option value="">Seleccionar...</option>
                                {availableFamilies.map(f => <option key={f.id} value={f.id}>{f.icon} {f.name}</option>)}
                            </select>
                            <p className="text-xs text-slate-400 mt-1">Aquí es donde se guarda el apunte.</p>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50">Cancelar</button>
                        <button type="submit" className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-md">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};