import React, { useState } from 'react';
import { AppState, Account, Family, Category } from '../types';
import { Plus, Trash2 } from 'lucide-react';

interface SettingsViewProps {
  data: AppState;
  onUpdateData: (newData: Partial<AppState>) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ data, onUpdateData }) => {
  const [activeTab, setActiveTab] = useState<'CATEGORIES' | 'ACCOUNTS'>('CATEGORIES');
  
  // -- Cuentas --
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountBalance, setNewAccountBalance] = useState('');
  const [newAccountIcon, setNewAccountIcon] = useState('🏦');

  // -- Categorías (Padres) --
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [newCategoryIcon, setNewCategoryIcon] = useState('🏷️');

  // -- Familias (Hijos) --
  const [newFamilyName, setNewFamilyName] = useState('');
  const [newFamilyIcon, setNewFamilyIcon] = useState('🔹');
  const [selectedParentCategory, setSelectedParentCategory] = useState('');


  const handleAddAccount = () => {
      if(!newAccountName) return;
      const newAcc: Account = {
          id: crypto.randomUUID(),
          name: newAccountName,
          initialBalance: parseFloat(newAccountBalance) || 0,
          currency: 'EUR',
          icon: newAccountIcon
      };
      onUpdateData({ accounts: [...data.accounts, newAcc] });
      setNewAccountName('');
      setNewAccountBalance('');
  };

  const handleDeleteAccount = (id: string) => {
      onUpdateData({ accounts: data.accounts.filter(a => a.id !== id) });
  };

  const handleAddCategory = () => {
      if(!newCategoryName) return;
      const newCat: Category = {
          id: crypto.randomUUID(),
          name: newCategoryName,
          type: newCategoryType,
          icon: newCategoryIcon
      };
      onUpdateData({ categories: [...data.categories, newCat] });
      setNewCategoryName('');
  };

  const handleDeleteCategory = (id: string) => {
      // Borrar categoría y sus familias hijas
      onUpdateData({ 
          categories: data.categories.filter(c => c.id !== id),
          families: data.families.filter(f => f.categoryId !== id)
      });
  };

  const handleAddFamily = () => {
      if(!newFamilyName || !selectedParentCategory) return;
      const newFam: Family = {
          id: crypto.randomUUID(),
          name: newFamilyName,
          categoryId: selectedParentCategory,
          icon: newFamilyIcon
      };
      onUpdateData({ families: [...data.families, newFam] });
      setNewFamilyName('');
  };

  const handleDeleteFamily = (id: string) => {
      onUpdateData({ families: data.families.filter(f => f.id !== id) });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Configuración</h2>

      <div className="flex border-b border-slate-200 overflow-x-auto">
        <button 
            className={`px-6 py-3 font-medium transition-colors whitespace-nowrap ${activeTab === 'CATEGORIES' ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('CATEGORIES')}
        >
            Categorías y Familias
        </button>
        <button 
            className={`px-6 py-3 font-medium transition-colors whitespace-nowrap ${activeTab === 'ACCOUNTS' ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
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
                      <div className="flex gap-2">
                        <input 
                            type="text" placeholder="Icono (Emoji)" 
                            className="w-16 px-3 py-2 border rounded-lg text-center"
                            value={newAccountIcon} onChange={e => setNewAccountIcon(e.target.value)}
                        />
                        <input 
                            type="text" placeholder="Nombre de la cuenta" 
                            className="flex-1 px-3 py-2 border rounded-lg"
                            value={newAccountName} onChange={e => setNewAccountName(e.target.value)}
                        />
                      </div>
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
                                  <span className="text-xl mr-2">{acc.icon}</span>
                                  <span className="font-medium text-slate-800">{acc.name}</span>
                                  <span className="text-xs text-slate-500 ml-2">Inicial: {acc.initialBalance} €</span>
                              </div>
                              <button onClick={() => handleDeleteAccount(acc.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                          </li>
                      ))}
                  </ul>
              </div>
          </div>
      )}

      {activeTab === 'CATEGORIES' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               {/* Categories Manager (Parent) */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                  <h3 className="text-lg font-bold mb-4">1. Categorías (Grupos)</h3>
                  <p className="text-sm text-slate-500 mb-3">Crea primero los grupos principales (Ej: Vivienda, Transporte).</p>
                  
                  <div className="flex flex-col gap-2 mb-4">
                      <div className="flex gap-2">
                          <input 
                                type="text" placeholder="Emoji" 
                                className="w-16 px-3 py-2 border rounded-lg text-center"
                                value={newCategoryIcon} onChange={e => setNewCategoryIcon(e.target.value)}
                            />
                          <input 
                            type="text" placeholder="Nombre Categoría" 
                            className="flex-1 px-3 py-2 border rounded-lg"
                            value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
                          />
                      </div>
                      <div className="flex gap-2">
                          <select 
                            className="flex-1 px-3 py-2 border rounded-lg bg-slate-50"
                            value={newCategoryType} onChange={e => setNewCategoryType(e.target.value as any)}
                          >
                              <option value="EXPENSE">Gastos</option>
                              <option value="INCOME">Ingresos</option>
                          </select>
                          <button onClick={handleAddCategory} className="p-2 bg-emerald-600 text-white rounded-lg"><Plus size={20}/></button>
                      </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-2">
                      {data.categories.map(c => (
                          <div key={c.id} className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100">
                              <div>
                                <span className="mr-2">{c.icon}</span>
                                <span className={`text-sm font-medium ${c.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>{c.name}</span>
                              </div>
                              <button onClick={() => handleDeleteCategory(c.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                          </div>
                      ))}
                  </div>
              </div>

               {/* Families Manager (Children) */}
               <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                  <h3 className="text-lg font-bold mb-4">2. Familias (Detalle)</h3>
                  <p className="text-sm text-slate-500 mb-3">Crea los elementos específicos dentro de una categoría.</p>
                  
                  <div className="space-y-3 mb-4">
                      <select 
                        className="w-full px-3 py-2 border rounded-lg"
                        value={selectedParentCategory} onChange={e => setSelectedParentCategory(e.target.value)}
                      >
                          <option value="">Selecciona una Categoría Padre...</option>
                          {data.categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                      </select>
                      
                      <div className="flex gap-2">
                        <input 
                            type="text" placeholder="Emoji" 
                            className="w-16 px-3 py-2 border rounded-lg text-center"
                            value={newFamilyIcon} onChange={e => setNewFamilyIcon(e.target.value)}
                            disabled={!selectedParentCategory}
                        />
                        <input 
                            type="text" placeholder="Nombre Familia (Ej. Alquiler)" 
                            className="flex-1 px-3 py-2 border rounded-lg"
                            value={newFamilyName} onChange={e => setNewFamilyName(e.target.value)}
                            disabled={!selectedParentCategory}
                        />
                        <button 
                            onClick={handleAddFamily} 
                            disabled={!selectedParentCategory}
                            className="p-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50"
                        ><Plus size={20}/></button>
                      </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-2">
                      {data.families
                        .filter(f => !selectedParentCategory || f.categoryId === selectedParentCategory)
                        .map(f => {
                             const parent = data.categories.find(c => c.id === f.categoryId);
                             return (
                                <div key={f.id} className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100">
                                    <div className="text-sm">
                                        <span className="mr-2">{f.icon}</span>
                                        <span className="font-medium text-slate-800">{f.name}</span>
                                        <span className="text-xs text-slate-400 ml-2">({parent?.name})</span>
                                    </div>
                                    <button onClick={() => handleDeleteFamily(f.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
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