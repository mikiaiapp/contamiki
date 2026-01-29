
import React, { useState } from 'react';
import { AppState, Transaction, TransactionType } from './types';
import { Plus, Trash2, Search, ArrowRightLeft, X } from 'lucide-react';

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
  const [selectedCategoryId, setSelectedCategoryId] = useState(''); 
  const [transferDestId, setTransferDestId] = useState('');

  const filteredTransactions = data.transactions
    .filter(t => t.description.toLowerCase().includes(filter.toLowerCase()) || 
                 data.families.find(f => f.id === t.familyId)?.name.toLowerCase().includes(filter.toLowerCase()) ||
                 data.categories.find(c => c.id === t.categoryId)?.name.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const resetForm = () => {
      setAmount(''); setDescription(''); setDate(new Date().toISOString().split('T')[0]);
      setSelectedCategoryId(''); setTransferDestId('');
  };

  const renderIcon = (iconStr: string, className = "w-10 h-10") => {
      if (!iconStr) return null;
      if (iconStr.startsWith('data:image') || iconStr.startsWith('http')) {
          return <img src={iconStr} alt="icon" className={`${className} object-contain`} />;
      }
      return <span className={`text-2xl`}>{iconStr}</span>;
  }

  return (
    <div className="space-y-8 md:space-y-12">
      <div className="flex flex-col md:flex-row justify-between items-center md:items-end gap-6 text-center md:text-left">
        <div className="space-y-2">
            <p className="text-indigo-600 font-black uppercase tracking-[0.4em] text-[10px]">Libro Diario</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tighter leading-none">Movimientos.</h2>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="w-full md:w-auto bg-slate-900 text-white px-8 py-5 rounded-xl font-black uppercase tracking-widest text-[9px] shadow-xl hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 active:scale-95"
        >
          <Plus size={18} /> Nuevo Registro
        </button>
      </div>

      <div className="relative group">
        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors">
            <Search size={20} />
        </div>
        <input 
            type="text" 
            placeholder="Rastrear movimiento..." 
            className="w-full pl-14 pr-6 py-4 bg-white border-2 border-slate-100 rounded-xl focus:outline-none focus:border-indigo-500 text-base font-bold tracking-tight shadow-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {/* Lista Responsiva de Transacciones */}
      <div className="grid grid-cols-1 gap-4">
        {filteredTransactions.map(t => {
            const family = data.families.find(f => f.id === t.familyId);
            const account = data.accounts.find(a => a.id === t.accountId);
            const isTransfer = t.type === 'TRANSFER';
            const destAccount = isTransfer ? data.accounts.find(a => a.id === t.transferAccountId) : null;

            return (
              <div key={t.id} className="bg-white p-5 rounded-[1.75rem] shadow-sm border border-slate-100 flex flex-col sm:flex-row items-center gap-5 hover:shadow-md transition-all">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 shrink-0">
                   {isTransfer ? <ArrowRightLeft className="text-indigo-400" size={20} /> : renderIcon(family?.icon || '', "w-6 h-6")}
                </div>
                
                <div className="flex-1 text-center sm:text-left min-w-0">
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">{t.date}</p>
                    <h4 className="text-lg font-black text-slate-800 tracking-tight mb-1 truncate">{t.description}</h4>
                    <div className="flex flex-wrap justify-center sm:justify-start gap-1.5">
                        <span className="bg-slate-50 px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest text-slate-500">
                           {account?.name} {isTransfer && `→ ${destAccount?.name}`}
                        </span>
                    </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-50">
                    <p className={`text-xl font-black tracking-tight ${t.type === 'INCOME' ? 'text-emerald-600' : t.type === 'TRANSFER' ? 'text-slate-400' : 'text-rose-600'}`}>
                        {t.type === 'INCOME' ? '+' : t.type === 'EXPENSE' ? '-' : ''}{t.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                    </p>
                    <button onClick={() => onDeleteTransaction(t.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-all"><Trash2 size={16} /></button>
                </div>
              </div>
            );
        })}
        {filteredTransactions.length === 0 && (
          <div className="py-20 text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-300">
                  <Search size={32} />
              </div>
              <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">No se encontraron movimientos</p>
          </div>
        )}
      </div>

      {/* Modal Responsivo */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center z-[100] p-4 sm:p-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg p-6 sm:p-10 relative max-h-[95vh] overflow-y-auto custom-scrollbar">
                <button onClick={() => setIsModalOpen(false)} className="absolute top-5 right-5 p-2.5 bg-slate-50 text-slate-400 rounded-full hover:bg-rose-50 hover:text-rose-600 transition-all"><X size={18}/></button>
                
                <div className="mb-6">
                    <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Nuevo Registro.</h3>
                </div>

                <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
                    <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
                        {['EXPENSE', 'INCOME', 'TRANSFER'].map((m) => (
                            <button key={m} type="button" onClick={() => setType(m as any)} className={`flex-1 py-3 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all ${type === m ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
                                {m === 'EXPENSE' ? 'Gasto' : m === 'INCOME' ? 'Ingreso' : 'Traspaso'}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Importe (€)</label>
                            <input type="number" step="0.01" className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl text-lg font-black outline-none focus:border-indigo-500" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha</label>
                            <input type="date" className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-indigo-500" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Descripción</label>
                        <input type="text" className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-indigo-500" value={description} onChange={e => setDescription(e.target.value)} placeholder="Ej. Compra semanal" />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Cuenta</label>
                        <select className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none appearance-none" value={accountId} onChange={e => setAccountId(e.target.value)}>
                            {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                    </div>

                    {type !== 'TRANSFER' && (
                        <div className="space-y-1.5">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoría</label>
                            <select className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none appearance-none" value={selectedCategoryId} onChange={e => setSelectedCategoryId(e.target.value)}>
                                <option value="">Seleccionar...</option>
                                {data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    )}

                    {type === 'TRANSFER' && (
                        <div className="space-y-1.5">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Destino</label>
                            <select className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none appearance-none" value={transferDestId} onChange={e => setTransferDestId(e.target.value)}>
                                <option value="">Seleccionar...</option>
                                {data.accounts.map(a => a.id !== accountId && <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                    )}

                    <button 
                        type="button"
                        onClick={() => {
                            if (!amount || !description) return;
                            const newTx: any = { id: crypto.randomUUID(), date, amount: parseFloat(amount), description, accountId, type };
                            if (type === 'TRANSFER') {
                                if (!transferDestId || accountId === transferDestId) return;
                                newTx.transferAccountId = transferDestId;
                                newTx.familyId = ''; newTx.categoryId = '';
                            } else {
                                if (!selectedCategoryId) return;
                                const category = data.categories.find(c => c.id === selectedCategoryId);
                                if (!category) return;
                                newTx.familyId = category.familyId;
                                newTx.categoryId = selectedCategoryId;
                            }
                            onAddTransaction(newTx);
                            setIsModalOpen(false);
                            resetForm();
                        }}
                        className="w-full py-5 bg-indigo-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-all mt-4"
                    >
                        Guardar Movimiento
                    </button>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};
