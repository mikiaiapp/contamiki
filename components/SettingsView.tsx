import React, { useState } from 'react';
import { AppState, Account, Family, Category } from '../types';
import { Plus, Trash2 } from 'lucide-react';

interface SettingsViewProps {
  data: AppState;
  onUpdateData: (newData: Partial<AppState>) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ data, onUpdateData }) => {
  const [activeTab, setActiveTab] = useState<'FAMILIES' | 'ACCOUNTS'>('FAMILIES');
  
  // State helpers for adding items
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountBalance, setNewAccountBalance] = useState('');
  
  const [newFamilyName, setNewFamilyName] = useState('');
  const [newFamilyType, setNewFamilyType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');

  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedFamilyForCategory, setSelectedFamilyForCategory] = useState('');


  const handleAddAccount = () => {
      if(!newAccountName) return;
      const newAcc: Account = {
          id: crypto.randomUUID(),
          name: newAccountName,
          initialBalance: parseFloat(newAccountBalance) || 0,
          currency: 'EUR'
      };
      onUpdateData({ accounts: [...data.accounts, newAcc] });
      setNewAccountName('');
      setNewAccountBalance('');
  };

  const handleDeleteAccount = (id: string) => {
      onUpdateData({ accounts: data.accounts.filter(a => a.id !== id) });
  };

  const handleAddFamily = () => {
      if(!newFamilyName) return;
      const newFam: Family = {
          id: crypto.randomUUID(),
          name: newFamilyName,
          type: newFamilyType
      };
      onUpdateData({ families: [...data.families, newFam] });
      setNewFamilyName('');
  };

  const handleDeleteFamily = (id: string) => {
      // Also delete categories in this family
      onUpdateData({ 
          families: data.families.filter(f => f.id !== id),
          categories: data.categories.filter(c => c.familyId !== id)
      });
  };

  const handleAddCategory = () => {
      if(!newCategoryName || !selectedFamilyForCategory) return;
      const newCat: Category = {
          id: crypto.randomUUID(),
          name: newCategoryName,
          familyId: selectedFamilyForCategory
      };
      onUpdateData({ categories: [...data.categories, newCat] });
      setNewCategoryName('');
  };

  const handleDeleteCategory = (id: string) => {
      onUpdateData({ categories: data.categories.filter(c => c.id !== id) });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Configuración</h2>

      <div className="flex border-b border-slate-200">
        <button 
            className={`px-6 py-3 font-medium transition-colors ${activeTab === 'FAMILIES' ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('FAMILIES')}
        >
            Familias y Categorías
        </button>
        <button 
            className={`px-6 py-3 font-medium transition-colors ${activeTab === 'ACCOUNTS' ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('ACCOUNTS')}
        >
            Cuentas
        </button>
      </div>

      {activeTab === 'ACCOUNTS' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                  <h3 className="text-lg font-bold mb-4">Añadir Cuenta</h3>
                  <div className="space-y-3">
                      <input 
                        type="text" placeholder="Nombre de la cuenta" 
                        className="w-full px-3 py-2 border rounded-lg"
                        value={newAccountName} onChange={e => setNewAccountName(e.target.value)}
                      />
                      <input 
                        type="number" placeholder="Saldo inicial" 
                        className="w-full px-3 py-2 border rounded-lg"
                        value={newAccountBalance} onChange={e => setNewAccountBalance(e.target.value)}
                      />
                      <button onClick={handleAddAccount} className="w-full py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Añadir Cuenta</button>
                  </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                  <h3 className="text-lg font-bold mb-4">Cuentas Existentes</h3>
                  <ul className="space-y-2">
                      {data.accounts.map(acc => (
                          <li key={acc.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                              <div>
                                  <p className="font-medium text-slate-800">{acc.name}</p>
                                  <p className="text-xs text-slate-500">Inicial: {acc.initialBalance} €</p>
                              </div>
                              <button onClick={() => handleDeleteAccount(acc.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                          </li>
                      ))}
                  </ul>
              </div>
          </div>
      )}

      {activeTab === 'FAMILIES' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               {/* Families Manager */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                  <h3 className="text-lg font-bold mb-4">Gestionar Familias</h3>
                  <div className="flex gap-2 mb-4">
                      <input 
                        type="text" placeholder="Nombre de familia" 
                        className="flex-1 px-3 py-2 border rounded-lg"
                        value={newFamilyName} onChange={e => setNewFamilyName(e.target.value)}
                      />
                      <select 
                        className="px-3 py-2 border rounded-lg bg-slate-50"
                        value={newFamilyType} onChange={e => setNewFamilyType(e.target.value as any)}
                      >
                          <option value="EXPENSE">Gastos</option>
                          <option value="INCOME">Ingresos</option>
                      </select>
                      <button onClick={handleAddFamily} className="p-2 bg-emerald-600 text-white rounded-lg"><Plus size={20}/></button>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                      {data.families.map(f => (
                          <div key={f.id} className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100">
                              <span className={`text-sm font-medium ${f.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>{f.name}</span>
                              <button onClick={() => handleDeleteFamily(f.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                          </div>
                      ))}
                  </div>
              </div>

               {/* Categories Manager */}
               <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                  <h3 className="text-lg font-bold mb-4">Gestionar Categorías</h3>
                  <div className="space-y-3 mb-4">
                      <select 
                        className="w-full px-3 py-2 border rounded-lg"
                        value={selectedFamilyForCategory} onChange={e => setSelectedFamilyForCategory(e.target.value)}
                      >
                          <option value="">Seleccionar Familia...</option>
                          {data.families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                      <div className="flex gap-2">
                        <input 
                            type="text" placeholder="Nombre de categoría" 
                            className="flex-1 px-3 py-2 border rounded-lg"
                            value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
                            disabled={!selectedFamilyForCategory}
                        />
                        <button 
                            onClick={handleAddCategory} 
                            disabled={!selectedFamilyForCategory}
                            className="p-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50"
                        ><Plus size={20}/></button>
                      </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                      {data.categories
                        .filter(c => !selectedFamilyForCategory || c.familyId === selectedFamilyForCategory)
                        .map(c => {
                             const fam = data.families.find(f => f.id === c.familyId);
                             return (
                                <div key={c.id} className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100">
                                    <div className="text-sm">
                                        <span className="font-medium text-slate-800">{c.name}</span>
                                        <span className="text-xs text-slate-400 ml-2">({fam?.name})</span>
                                    </div>
                                    <button onClick={() => handleDeleteCategory(c.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                                </div>
                             )
                        })}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};