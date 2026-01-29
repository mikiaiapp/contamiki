
import React, { useState } from 'react';
import { AppState, Transaction, TransactionType } from './types';
import { Plus, Trash2, Search, ArrowRightLeft, Calendar as CalendarIcon, Filter, X } from 'lucide-react';

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

  const resetForm = () => {
      setAmount(''); setDescription(''); setDate(new Date().toISOString().split('T')[0]);
      setSelectedFamilyId(''); setSelectedCategoryId(''); setTransferDestId('');
  };

  const renderIcon = (iconStr: string, className = "w-10 h-10") => {
      if (!iconStr) return null;
      if (iconStr.startsWith('data:image') || iconStr.startsWith('http')) {
          return <img src={iconStr} alt="icon" className={`${className} object-contain`} />;
      }
      return <span className={`text-2xl`}>{iconStr}</span>;
  }

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
        <div className="space-y-4">
            <p className="text-indigo-600 font-black uppercase tracking-[0.4em] text-xs">Libro Diario</p>
            <h2 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter leading-none">Movimientos.</h2>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-slate-900 text-white px-10 py-6 rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-2xl hover:bg-indigo-600 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
        >
          <Plus size={20} /> Nuevo Registro
        </button>
      </div>

      <div className="relative group">
        <div className="absolute left-10 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors">
            <Search size={32} />
        </div>
        <input 
            type="text" 
            placeholder="Rastrear transacción por nombre, familia o detalle..." 
            className="w-full pl-24 pr-10 py-10 bg-white border-4 border-slate-100 rounded-[3.5rem] focus:outline-none focus:ring-[24px] focus:ring-indigo-500/5 focus:border-indigo-500 text-2xl font-black tracking-tight placeholder:text-slate-200 transition-all shadow-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {/* Vista de Transacciones */}
      <div className="grid grid-cols-1 gap-6">
        {filteredTransactions.map(t => {
            const category = data.categories.find(c => c.id === t.categoryId);
            const family = data.families.find(f => f.id === t.familyId);
            const account = data.accounts.find(a => a.id === t.accountId);
            const isTransfer = t.type === 'TRANSFER';
            const destAccount = isTransfer ? data.accounts.find(a => a.id === t.transferAccountId) : null;

            return (
              <div key={t.id} className="bg-white p-8 md:p-10 rounded-[3.5rem] shadow-sm border border-slate-100 group hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 flex flex-col md:flex-row items-center gap-8 md:gap-12">
                <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center border-2 border-white shadow-inner flex-shrink-0 group-hover:rotate-6 transition-transform">
                   {isTransfer ? <ArrowRightLeft className="text-indigo-400" size={32} /> : renderIcon(family?.icon || '')}
                </div>
                
                <div className="flex-1 text-center md:text-left">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">{t.date}</p>
                    <h4 className="text-3xl font-black text-slate-800 tracking-tighter mb-2">{t.description}</h4>
                    <div className="flex flex-wrap justify-center md:justify-start gap-3">
                        <span className="bg-slate-50 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500 border border-slate-100">
                           {isTransfer ? 'Transferencia' : category?.name}
                        </span>
                        <span className="bg-slate-50 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500 border border-slate-100">
                           {account?.name} {isTransfer && `→ ${destAccount?.name}`}
                        </span>
                    </div>
                </div>

                <div className="text-center md:text-right">
                    <p className={`text-4xl font-black tracking-tighter mb-2 ${t.type === 'INCOME' ? 'text-emerald-600' : t.type === 'TRANSFER' ? 'text-slate-400' : 'text-rose-600'}`}>
                        {t.type === 'INCOME' ? '+' : t.type === 'EXPENSE' ? '-' : ''}{t.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                    </p>
                    <button onClick={() => onDeleteTransaction(t.id)} className="p-4 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all"><Trash2 size={24} /></button>
                </div>
              </div>
            );
        })}
      </div>

      {/* Modal - Rediseño Total */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl flex items-center justify-center z-[100] p-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-[4rem] shadow-2xl w-full max-w-2xl p-12 relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                <button onClick={() => setIsModalOpen(false)} className="absolute top-10 right-10 p-4 bg-slate-100 text-slate-400 rounded-full hover:bg-rose-50 hover:text-rose-600 transition-all active:scale-90"><X size={28}/></button>
                
                <div className="mb-12">
                    <h3 className="text-4xl font-black text-slate-900 tracking-tighter">Crear Apunte.</h3>
                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em] mt-2">Detalla tu nuevo flujo económico</p>
                </div>

                <form onSubmit={(e) => e.preventDefault()} className="space-y-10">
                    <div className="bg-slate-100 p-2.5 rounded-[2.5rem] flex gap-2">
                        {['EXPENSE', 'INCOME', 'TRANSFER'].map((m) => (
                            <button key={m} type="button" onClick={() => setType(m as any)} className={`flex-1 py-5 text-[11px] font-black uppercase tracking-widest rounded-[2rem] transition-all ${type === m ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-400'}`}>
                                {m === 'EXPENSE' ? '🔴 Gasto' : m === 'INCOME' ? '🟢 Ingreso' : '🔵 Traspaso'}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em] ml-3">Importe (€)</label>
                            <input type="number" step="0.01" className="w-full px-10 py-7 bg-indigo-50/30 border-2 border-indigo-100/50 rounded-[2.5rem] text-3xl font-black outline-none focus:border-indigo-600 transition-all" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-3">Fecha</label>
                            <input type="date" className="w-full px-10 py-7 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] text-xl font-black outline-none focus:border-indigo-600 transition-all" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-3">Descripción</label>
                        <input type="text" className="w-full px-10 py-7 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] text-xl font-black outline-none focus:border-indigo-600 transition-all" value={description} onChange={e => setDescription(e.target.value)} placeholder="Ej. Almuerzo corporativo" />
                    </div>

                    <button 
                        type="button"
                        onClick={() => {
                            if (!amount || !description) return;
                            const newTx: any = { id: crypto.randomUUID(), date, amount: parseFloat(amount), description, accountId, type };
                            if (type === 'TRANSFER') {
                                if (accountId === transferDestId) return;
                                newTx.transferAccountId = transferDestId;
                            } else {
                                const category = data.categories.find(c => c.id === selectedCategoryId);
                                if (!category) return;
                                newTx.familyId = category.familyId;
                                newTx.categoryId = selectedCategoryId;
                            }
                            onAddTransaction(newTx);
                            setIsModalOpen(false);
                            resetForm();
                        }}
                        className="w-full py-10 bg-slate-900 text-white rounded-[3rem] font-black uppercase tracking-[0.4em] text-sm shadow-2xl hover:bg-indigo-600 transition-all active:scale-95"
                    >
                        Confirmar Movimiento
                    </button>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};
