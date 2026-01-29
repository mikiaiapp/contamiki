import React, { useState } from 'react';
import { AppState, Transaction, TransactionType } from '../types';
import { Plus, Trash2, Search, ArrowRightLeft, Calendar as CalendarIcon, Tag } from 'lucide-react';

interface TransactionViewProps {
  data: AppState;
  onAddTransaction: (t: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
}

export const TransactionView: React.FC<TransactionViewProps> = ({ data, onAddTransaction, onDeleteTransaction }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState('');
  
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [accountId, setAccountId] = useState(data.accounts[0]?.id || '');
  const [selectedFamilyId, setSelectedFamilyId] = useState(''); 
  const [selectedCategoryId, setSelectedCategoryId] = useState(''); 
  const [transferDestId, setTransferDestId] = useState('');

  const filteredTransactions = data.transactions
    .filter(t => t.description.toLowerCase().includes(filter.toLowerCase()) || 
                 data.families.find(f => f.id === t.familyId)?.name.toLowerCase().includes(filter.toLowerCase()) ||
                 data.categories.find(c => c.id === t.categoryId)?.name.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description || !accountId) return;

    let newTx: Transaction;
    if (type === 'TRANSFER') {
        if (!transferDestId || accountId === transferDestId) {
            alert("Selecciona una cuenta destino diferente");
            return;
        }
        newTx = {
            id: crypto.randomUUID(),
            date,
            amount: parseFloat(amount),
            description: `Traspaso: ${description}`,
            accountId,
            transferAccountId: transferDestId,
            familyId: '', 
            categoryId: '',
            type: 'TRANSFER'
        };
    } else {
        if (!selectedCategoryId) return;
        const category = data.categories.find(c => c.id === selectedCategoryId);
        if (!category) return;
        newTx = { id: crypto.randomUUID(), date, amount: parseFloat(amount), description, accountId, familyId: category.familyId, categoryId: selectedCategoryId, type };
    }

    onAddTransaction(newTx);
    setIsModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
      setAmount(''); setDescription(''); setDate(new Date().toISOString().split('T')[0]);
      setSelectedFamilyId(''); setSelectedCategoryId(''); setTransferDestId('');
  };

  const renderIcon = (iconStr: string, className = "w-5 h-5") => {
      if (!iconStr) return null;
      if (iconStr.startsWith('data:image')) {
          return <img src={iconStr} alt="icon" className={`${className} object-contain inline-block mr-2 align-middle`} />;
      }
      return <span className={`mr-2 ${className} inline-flex items-center justify-center`}>{iconStr}</span>;
  }

  const availableFamilies = data.families.filter(f => f.type === type);
  const availableCategories = data.categories.filter(c => c.familyId === selectedFamilyId);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800">Movimientos</h2>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
        >
          <Plus size={20} /> <span className="font-semibold">Nuevo</span>
        </button>
      </div>

      <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
                type="text" 
                placeholder="Buscar por descripción..." 
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm md:text-base"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
            />
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Fecha</th>
              <th className="px-6 py-4">Descripción</th>
              <th className="px-6 py-4">Detalle</th>
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
                const isTransfer = t.type === 'TRANSFER';
                const destAccount = isTransfer ? data.accounts.find(a => a.id === t.transferAccountId) : null;

                return (
                    <tr key={t.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-sm text-slate-500">{t.date}</td>
                        <td className="px-6 py-4 font-medium">{t.description}</td>
                        <td className="px-6 py-4 text-sm text-slate-700">
                            {isTransfer ? <span className="text-blue-500 flex items-center gap-1"><ArrowRightLeft size={14}/> Traspaso</span> : <>{renderIcon(family?.icon || '')} {category?.name}</>}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                           {renderIcon(account?.icon || '')} {account?.name}
                           {isTransfer && destAccount && <><span className="mx-1">→</span>{renderIcon(destAccount.icon)}{destAccount.name}</>}
                        </td>
                        <td className={`px-6 py-4 text-right font-bold ${t.type === 'INCOME' ? 'text-emerald-600' : t.type === 'TRANSFER' ? 'text-slate-600' : 'text-rose-600'}`}>
                            {t.type === 'INCOME' ? '+' : t.type === 'EXPENSE' ? '-' : ''}{t.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                        </td>
                        <td className="px-6 py-4 text-center">
                            <button onClick={() => onDeleteTransaction(t.id)} className="text-slate-400 hover:text-red-500 p-2"><Trash2 size={18} /></button>
                        </td>
                    </tr>
                );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-3">
        {filteredTransactions.map(t => {
            const category = data.categories.find(c => c.id === t.categoryId);
            const family = data.families.find(f => f.id === t.familyId);
            const account = data.accounts.find(a => a.id === t.accountId);
            const isTransfer = t.type === 'TRANSFER';
            
            return (
              <div key={t.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400 flex items-center gap-1 mb-1">
                      <CalendarIcon size={12} /> {t.date}
                    </span>
                    <span className="font-bold text-slate-800 leading-tight">{t.description}</span>
                  </div>
                  <span className={`text-lg font-black ${t.type === 'INCOME' ? 'text-emerald-600' : t.type === 'TRANSFER' ? 'text-slate-600' : 'text-rose-600'}`}>
                    {t.type === 'INCOME' ? '+' : t.type === 'EXPENSE' ? '-' : ''}{t.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </span>
                </div>
                
                <div className="flex justify-between items-center mt-1 pt-2 border-t border-slate-50">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <div className="bg-slate-50 p-1.5 rounded-md flex items-center">
                      {isTransfer ? <ArrowRightLeft size={12} className="text-blue-500"/> : renderIcon(family?.icon || '', "w-4 h-4")}
                      <span className="ml-1 font-medium">{isTransfer ? 'Traspaso' : category?.name}</span>
                    </div>
                    <div className="bg-slate-50 p-1.5 rounded-md flex items-center">
                      {renderIcon(account?.icon || '', "w-4 h-4")}
                      <span className="ml-1 font-medium">{account?.name}</span>
                    </div>
                  </div>
                  <button onClick={() => onDeleteTransaction(t.id)} className="text-slate-300 hover:text-rose-500 p-1">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
        })}
        {filteredTransactions.length === 0 && (
          <div className="py-12 text-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
            No hay movimientos para mostrar.
          </div>
        )}
      </div>

      {/* Modal Ajustado para Móvil */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-end sm:items-center justify-center z-[100] p-0 sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-slate-800">Añadir Movimiento</h3>
                  <button onClick={() => setIsModalOpen(false)} className="text-slate-400 p-2"><Plus className="rotate-45" size={24}/></button>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-5 pb-6">
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button type="button" className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${type === 'EXPENSE' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`} onClick={() => { setType('EXPENSE'); resetForm(); }}>Gasto</button>
                        <button type="button" className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${type === 'INCOME' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`} onClick={() => { setType('INCOME'); resetForm(); }}>Ingreso</button>
                        <button type="button" className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${type === 'TRANSFER' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`} onClick={() => { setType('TRANSFER'); resetForm(); }}>Traspaso</button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 ml-1">Importe (€)</label>
                            <input type="number" step="0.01" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-lg font-bold" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 ml-1">Fecha</label>
                            <input type="date" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 ml-1">Descripción</label>
                        <input type="text" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" value={description} onChange={e => setDescription(e.target.value)} placeholder="Ej. Compra semanal" />
                    </div>

                    {type !== 'TRANSFER' ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 ml-1">Familia</label>
                                    <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" value={selectedFamilyId} onChange={e => { setSelectedFamilyId(e.target.value); setSelectedCategoryId(''); }} required>
                                        <option value="">Grupo...</option>
                                        {availableFamilies.map(f => <option key={f.id} value={f.id}>{!f.icon.startsWith('data:') && f.icon} {f.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 ml-1">Categoría</label>
                                    <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" value={selectedCategoryId} onChange={e => setSelectedCategoryId(e.target.value)} disabled={!selectedFamilyId} required>
                                        <option value="">Detalle...</option>
                                        {availableCategories.map(c => <option key={c.id} value={c.id}>{!c.icon.startsWith('data:') && c.icon} {c.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 ml-1">Cuenta</label>
                                <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" value={accountId} onChange={e => setAccountId(e.target.value)}>
                                    {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 ml-1">Origen</label>
                                <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" value={accountId} onChange={e => setAccountId(e.target.value)}>
                                    {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 ml-1">Destino</label>
                                <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" value={transferDestId} onChange={e => setTransferDestId(e.target.value)} required>
                                    <option value="">Elegir...</option>
                                    {data.accounts.filter(a => a.id !== accountId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-3 border border-slate-200 rounded-xl font-bold text-slate-500 hover:bg-slate-50">Cancelar</button>
                        <button type="submit" className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 active:scale-95 transition-all">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};