import React, { useState, useRef } from 'react';
import { AppState, Account, Family, Category } from '../types';
import { Plus, Trash2, Edit2, Upload, X } from 'lucide-react';

interface SettingsViewProps {
  data: AppState;
  onUpdateData: (newData: Partial<AppState>) => void;
}

// Icon keywords mapping for auto-suggestion
const ICON_KEYWORDS: Record<string, string> = {
    'casa': '🏠', 'hogar': '🏠', 'alquiler': '🔑', 'hipoteca': '🏦',
    'coche': '🚗', 'auto': '🚗', 'gasolina': '⛽', 'transporte': '🚌',
    'comida': '🍎', 'supermercado': '🛒', 'restaurante': '🍽️',
    'luz': '💡', 'agua': '💧', 'internet': '🌐', 'movil': '📱',
    'salario': '💵', 'nomina': '💵', 'ahorro': '💰', 'banco': '🏦',
    'ocio': '🎉', 'viaje': '✈️', 'regalo': '🎁', 'salud': '💊',
    'deporte': '⚽', 'ropa': '👕', 'mascota': '🐶'
};

export const SettingsView: React.FC<SettingsViewProps> = ({ data, onUpdateData }) => {
  const [activeTab, setActiveTab] = useState<'HIERARCHY' | 'ACCOUNTS'>('HIERARCHY');
  
  // -- Helper para Redimensionar Imágenes --
  const resizeImage = (file: File): Promise<string> => {
      return new Promise((resolve) => {
          const img = new Image();
          img.src = URL.createObjectURL(file);
          img.onload = () => {
              const canvas = document.createElement('canvas');
              // Estandarizamos a 64x64 para mantener homogeneidad
              canvas.width = 64; 
              canvas.height = 64; 
              const ctx = canvas.getContext('2d');
              if(ctx) {
                  ctx.drawImage(img, 0, 0, 64, 64);
                  resolve(canvas.toDataURL('image/png'));
              }
          }
      });
  };

  const suggestIcon = (text: string): string => {
      const lower = text.toLowerCase();
      for (const [key, emoji] of Object.entries(ICON_KEYWORDS)) {
          if (lower.includes(key)) return emoji;
      }
      return '';
  };

  // --- CUENTAS STATE ---
  const [accId, setAccId] = useState<string | null>(null); // If null, creating new
  const [accName, setAccName] = useState('');
  const [accBalance, setAccBalance] = useState('');
  const [accIcon, setAccIcon] = useState('🏦');
  const accFileInputRef = useRef<HTMLInputElement>(null);

  // --- FAMILIAS STATE ---
  const [famId, setFamId] = useState<string | null>(null);
  const [famName, setFamName] = useState('');
  const [famType, setFamType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [famIcon, setFamIcon] = useState('📂');
  const famFileInputRef = useRef<HTMLInputElement>(null);

  // --- CATEGORIAS STATE ---
  const [catId, setCatId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');
  const [catParent, setCatParent] = useState('');
  const [catIcon, setCatIcon] = useState('🏷️');
  const catFileInputRef = useRef<HTMLInputElement>(null);


  // --- HANDLERS CUENTAS ---
  const handleEditAccount = (acc: Account) => {
      setAccId(acc.id);
      setAccName(acc.name);
      setAccBalance(acc.initialBalance.toString());
      setAccIcon(acc.icon);
  };
  
  const handleSaveAccount = () => {
      if(!accName) return;
      const balanceVal = parseFloat(accBalance) || 0;
      
      if (accId) {
          // Update
          const updated = data.accounts.map(a => a.id === accId ? { ...a, name: accName, initialBalance: balanceVal, icon: accIcon } : a);
          onUpdateData({ accounts: updated });
      } else {
          // Create
          const newAcc: Account = { id: crypto.randomUUID(), name: accName, initialBalance: balanceVal, currency: 'EUR', icon: accIcon };
          onUpdateData({ accounts: [...data.accounts, newAcc] });
      }
      // Reset
      setAccId(null); setAccName(''); setAccBalance(''); setAccIcon('🏦');
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>, setIcon: (s: string) => void) => {
      if (e.target.files && e.target.files[0]) {
          const base64 = await resizeImage(e.target.files[0]);
          setIcon(base64);
      }
  };

  // --- HANDLERS FAMILIAS ---
  const handleEditFamily = (fam: Family) => {
      setFamId(fam.id);
      setFamName(fam.name);
      setFamType(fam.type as any); // cast safely
      setFamIcon(fam.icon);
  };

  const handleSaveFamily = () => {
      if(!famName) return;
      if (famId) {
           const updated = data.families.map(f => f.id === famId ? { ...f, name: famName, type: famType, icon: famIcon } : f);
           onUpdateData({ families: updated });
      } else {
           const newFam: Family = { id: crypto.randomUUID(), name: famName, type: famType, icon: famIcon };
           onUpdateData({ families: [...data.families, newFam] });
      }
      setFamId(null); setFamName(''); setFamIcon('📂');
  };

  // --- HANDLERS CATEGORIAS ---
  const handleEditCategory = (cat: Category) => {
      setCatId(cat.id);
      setCatName(cat.name);
      setCatParent(cat.familyId);
      setCatIcon(cat.icon);
  };

  const handleSaveCategory = () => {
      if(!catName || !catParent) return;
      if (catId) {
          const updated = data.categories.map(c => c.id === catId ? { ...c, name: catName, familyId: catParent, icon: catIcon } : c);
          onUpdateData({ categories: updated });
      } else {
          const newCat: Category = { id: crypto.randomUUID(), name: catName, familyId: catParent, icon: catIcon };
          onUpdateData({ categories: [...data.categories, newCat] });
      }
      setCatId(null); setCatName(''); setCatIcon('🏷️');
  };

  // --- Generic Render Icon Input ---
  const renderIconInput = (icon: string, setIcon: (s: string) => void, nameRef: string, fileRef: React.RefObject<HTMLInputElement>) => {
      const isImage = icon.startsWith('data:image');
      return (
          <div className="flex gap-2 items-center">
               <div className="relative group w-12 h-12 flex items-center justify-center border rounded-lg bg-slate-50 overflow-hidden cursor-pointer" onClick={() => fileRef.current?.click()}>
                   {isImage ? <img src={icon} className="w-full h-full object-cover" /> : <span className="text-2xl">{icon}</span>}
                   <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                       <Upload size={16} />
                   </div>
               </div>
               <input 
                   type="text" 
                   placeholder="Emoji"
                   className="w-16 px-2 py-2 border rounded-lg text-center"
                   value={!isImage ? icon : ''}
                   onChange={e => setIcon(e.target.value)}
                   disabled={isImage}
               />
               <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={(e) => handleIconUpload(e, setIcon)} />
               {isImage && <button onClick={() => setIcon('❓')} className="text-red-500"><X size={16}/></button>}
          </div>
      )
  }

  // --- Auto Suggest Effect ---
  const handleNameChange = (val: string, setName: (s: string) => void, setIcon: (s: string) => void, currentIcon: string) => {
      setName(val);
      // Only suggest if not an image and current icon is default or empty
      if (!currentIcon.startsWith('data:image')) {
          const suggestion = suggestIcon(val);
          if (suggestion) setIcon(suggestion);
      }
  }


  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Configuración</h2>

      <div className="flex border-b border-slate-200 overflow-x-auto">
        <button 
            className={`px-6 py-3 font-medium transition-colors whitespace-nowrap ${activeTab === 'HIERARCHY' ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('HIERARCHY')}
        >
            Familias y Categorías
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
                  <h3 className="text-lg font-bold mb-4">{accId ? 'Editar Cuenta' : 'Añadir Cuenta'}</h3>
                  <div className="space-y-4">
                      <div className="flex gap-4">
                        {renderIconInput(accIcon, setAccIcon, accName, accFileInputRef)}
                        <input 
                            type="text" placeholder="Nombre de la cuenta" 
                            className="flex-1 px-3 py-2 border rounded-lg"
                            value={accName} 
                            onChange={e => handleNameChange(e.target.value, setAccName, setAccIcon, accIcon)}
                        />
                      </div>
                      <input 
                        type="number" placeholder="Saldo inicial" 
                        className="w-full px-3 py-2 border rounded-lg"
                        value={accBalance} onChange={e => setAccBalance(e.target.value)}
                      />
                      <div className="flex gap-2">
                        {accId && <button onClick={() => { setAccId(null); setAccName(''); setAccBalance(''); }} className="flex-1 py-2 border border-slate-300 rounded-lg">Cancelar</button>}
                        <button onClick={handleSaveAccount} className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                            {accId ? 'Actualizar' : 'Añadir'}
                        </button>
                      </div>
                  </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                  <h3 className="text-lg font-bold mb-4">Cuentas Existentes</h3>
                  <ul className="space-y-2">
                      {data.accounts.map(acc => (
                          <li key={acc.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg group">
                              <div className="flex items-center">
                                  {acc.icon.startsWith('data:image') ? <img src={acc.icon} className="w-6 h-6 mr-2 object-contain"/> : <span className="text-xl mr-2">{acc.icon}</span>}
                                  <div>
                                    <span className="font-medium text-slate-800 block">{acc.name}</span>
                                    <span className="text-xs text-slate-500">Ini: {acc.initialBalance} €</span>
                                  </div>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => handleEditAccount(acc)} className="p-2 text-slate-400 hover:text-blue-500"><Edit2 size={16}/></button>
                                  <button onClick={() => onUpdateData({accounts: data.accounts.filter(a=>a.id!==acc.id)})} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                              </div>
                          </li>
                      ))}
                  </ul>
              </div>
          </div>
      )}

      {activeTab === 'HIERARCHY' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               {/* Families Manager (Parent) */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                  <h3 className="text-lg font-bold mb-4">1. Familias (Agrupadores)</h3>
                  <div className="flex flex-col gap-4 mb-4 p-4 bg-slate-50 rounded-lg">
                      <div className="flex gap-3">
                          {renderIconInput(famIcon, setFamIcon, famName, famFileInputRef)}
                          <input 
                            type="text" placeholder="Nombre Familia" 
                            className="flex-1 px-3 py-2 border rounded-lg"
                            value={famName} 
                            onChange={e => handleNameChange(e.target.value, setFamName, setFamIcon, famIcon)}
                          />
                      </div>
                      <div className="flex gap-2">
                          <select 
                            className="flex-1 px-3 py-2 border rounded-lg bg-white"
                            value={famType} onChange={e => setFamType(e.target.value as any)}
                          >
                              <option value="EXPENSE">Gastos</option>
                              <option value="INCOME">Ingresos</option>
                          </select>
                          {famId && <button onClick={() => { setFamId(null); setFamName(''); }} className="px-3 py-2 border rounded-lg bg-white"><X size={18}/></button>}
                          <button onClick={handleSaveFamily} className="px-4 py-2 bg-emerald-600 text-white rounded-lg flex-1">
                              {famId ? 'Actualizar' : 'Crear'}
                          </button>
                      </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-2">
                      {data.families.map(f => (
                          <div key={f.id} className="flex justify-between items-center p-2 bg-white rounded border border-slate-100 group">
                              <div className="flex items-center">
                                {f.icon.startsWith('data:image') ? <img src={f.icon} className="w-5 h-5 mr-2 object-contain"/> : <span className="mr-2">{f.icon}</span>}
                                <span className={`text-sm font-medium ${f.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>{f.name}</span>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEditFamily(f)} className="text-slate-400 hover:text-blue-500 px-1"><Edit2 size={14}/></button>
                                <button onClick={() => {
                                    onUpdateData({ 
                                        families: data.families.filter(i => i.id !== f.id),
                                        categories: data.categories.filter(c => c.familyId !== f.id)
                                    });
                                }} className="text-slate-400 hover:text-red-500 px-1"><Trash2 size={14}/></button>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>

               {/* Categories Manager (Children) */}
               <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                  <h3 className="text-lg font-bold mb-4">2. Categorías (Detalle)</h3>
                  
                  <div className="space-y-4 mb-4 p-4 bg-slate-50 rounded-lg">
                      <select 
                        className="w-full px-3 py-2 border rounded-lg bg-white"
                        value={catParent} onChange={e => setCatParent(e.target.value)}
                      >
                          <option value="">Selecciona Familia Padre...</option>
                          {data.families.map(f => <option key={f.id} value={f.id}>{!f.icon.startsWith('data:') ? f.icon : ''} {f.name}</option>)}
                      </select>
                      
                      <div className="flex gap-3">
                        {renderIconInput(catIcon, setCatIcon, catName, catFileInputRef)}
                        <input 
                            type="text" placeholder="Nombre Categoría" 
                            className="flex-1 px-3 py-2 border rounded-lg"
                            value={catName} 
                            onChange={e => handleNameChange(e.target.value, setCatName, setCatIcon, catIcon)}
                            disabled={!catParent}
                        />
                      </div>
                      <div className="flex gap-2">
                        {catId && <button onClick={() => { setCatId(null); setCatName(''); }} className="px-3 py-2 border rounded-lg bg-white"><X size={18}/></button>}
                        <button 
                            onClick={handleSaveCategory} 
                            disabled={!catParent}
                            className="w-full py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50"
                        >
                            {catId ? 'Actualizar' : 'Crear'}
                        </button>
                      </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-2">
                      {data.categories
                        .filter(c => !catParent || c.familyId === catParent)
                        .map(c => {
                             const parent = data.families.find(f => f.id === c.familyId);
                             return (
                                <div key={c.id} className="flex justify-between items-center p-2 bg-white rounded border border-slate-100 group">
                                    <div className="text-sm flex items-center">
                                        {c.icon.startsWith('data:image') ? <img src={c.icon} className="w-5 h-5 mr-2 object-contain"/> : <span className="mr-2">{c.icon}</span>}
                                        <span className="font-medium text-slate-800">{c.name}</span>
                                        <span className="text-xs text-slate-400 ml-2">({parent?.name})</span>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleEditCategory(c)} className="text-slate-400 hover:text-blue-500 px-1"><Edit2 size={14}/></button>
                                        <button onClick={() => onUpdateData({ categories: data.categories.filter(i => i.id !== c.id) })} className="text-slate-400 hover:text-red-500 px-1"><Trash2 size={14}/></button>
                                    </div>
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