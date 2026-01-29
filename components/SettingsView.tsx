import React, { useState, useRef } from 'react';
import { AppState, Account, Family, Category } from '../types';
import { Plus, Trash2, Edit2, Upload, X, RotateCcw, FileSpreadsheet, Download, Layers, Tag, Wallet, Sparkles } from 'lucide-react';
import * as XLSX from 'xlsx';

interface SettingsViewProps {
  data: AppState;
  onUpdateData: (newData: Partial<AppState>) => void;
}

// Diccionario extendido con múltiples opciones por categoría
const ICON_GROUPS: Record<string, string[]> = {
    'vivienda': ['🏠', '🏡', '🏢', '🏘️', '🏰', '🏚️', '🏗️', '🏘', '🏠', '🛋️', '🛏️', '🚿', '🔑', '🔓', '🚪'],
    'hogar': ['🏠', '🏡', '🧹', '🧺', '🧼', '🛋️', '🖼️', '🪴', '🕯️', '🧸', '🪑', '🚿', '🛁', '🔌', '💡'],
    'comida': ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥦', '🥑', '🍔', '🍕', '🌮', '🥗'],
    'restaurante': ['🍽️', '🍴', '🥄', '🥢', '🥣', '🍳', '🍲', '🥘', '🍳', '🍱', '🥡', '🍛', '🍜', '🍜', '🍝', '🍕', '🍔', '🍟', '🥪'],
    'bebida': ['☕', '🍵', '🧃', '🥤', '🧋', '🥛', '🍼', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾'],
    'transporte': ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🛵', '🏍️', '🚲', '🛴'],
    'viaje': ['✈️', '🛫', '🛬', '🛳️', '🚢', '🚀', '🛸', '🗺️', '🧭', '🏔️', '🏖️', '🏝️', '🏕️', '⛺', '🛖', '🎢', '🎡'],
    'salud': ['💊', '💉', '🩹', '🩺', '🌡️', '🧬', '🔬', '🔭', '🏥', '🏥', '🚑', '🧘', '💆', '🧖', '🦷', '👓', '🕶️'],
    'finanzas': ['💰', '💵', '💶', '💷', '💴', '🪙', '💸', '💳', '🧾', '💹', '📈', '📉', '📊', '🏦', '💎', '💍', '⚖️'],
    'ocio': ['🎉', '🎊', '🎈', '🎂', '🎁', '🧨', '🧧', '🎀', '🪄', '🎨', '🎬', '📽️', '🎮', '🕹️', '👾', '🧩', '🃏', '🀄'],
    'ropa': ['👕', '👔', '👚', '👗', '👘', '🥻', '🩱', '🩲', '🩳', '👙', '💄', '👜', '💼', '🎒', '👞', '👟', '👠', '👡', '👢'],
    'tecnologia': ['📱', '💻', '🖥️', '⌨️', '🖱️', '🖨️', '📽️', '📷', '📹', '📻', '🎙️', '🎧', '🔋', '🔌', '💻', '🖥️', '📡'],
    'mascotas': ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐣', '🦆', '🦜'],
    'estudio': ['📚', '📖', '📒', '📓', '📔', '📕', '📗', '📘', '📙', '📝', '✏️', '✒️', '🖋️', '🖌️', '🖍️', '🎓', '🏫'],
    'deporte': ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🏒', '🏑', '🏏', '🏹', '🎣', '🥊', '🥋']
};

const KEYWORD_MAP: Record<string, string> = {
    'casa': 'vivienda', 'piso': 'vivienda', 'alquiler': 'vivienda', 'hipoteca': 'vivienda', 'luz': 'hogar', 'agua': 'hogar', 'gas': 'hogar', 'internet': 'tecnologia',
    'super': 'comida', 'compra': 'comida', 'fruta': 'comida', 'carne': 'comida', 'pescado': 'comida', 'cena': 'restaurante', 'comida': 'comida', 'restaurante': 'restaurante',
    'bar': 'bebida', 'cafe': 'bebida', 'copas': 'bebida', 'vino': 'bebida', 'cerveza': 'bebida',
    'coche': 'transporte', 'gasolina': 'transporte', 'moto': 'transporte', 'parking': 'transporte', 'taller': 'transporte', 'itv': 'transporte',
    'bus': 'transporte', 'metro': 'transporte', 'taxi': 'transporte', 'tren': 'transporte', 'vuelo': 'viaje', 'hotel': 'viaje', 'viaje': 'viaje',
    'medico': 'salud', 'farmacia': 'salud', 'salud': 'salud', 'gym': 'deporte', 'deporte': 'deporte', 'entrenamiento': 'deporte',
    'nomina': 'finanzas', 'sueldo': 'finanzas', 'ingreso': 'finanzas', 'ahorro': 'finanzas', 'banco': 'finanzas', 'inversion': 'finanzas',
    'netflix': 'ocio', 'cine': 'ocio', 'ocio': 'ocio', 'juego': 'ocio', 'fiesta': 'ocio', 'regalo': 'ocio',
    'ropa': 'ropa', 'zapatos': 'ropa', 'moda': 'ropa', 'bolso': 'ropa',
    'movil': 'tecnologia', 'ordenador': 'tecnologia', 'pc': 'tecnologia', 'auriculares': 'tecnologia',
    'perro': 'mascotas', 'gato': 'mascotas', 'animal': 'mascotas', 'pienso': 'mascotas',
    'libro': 'estudio', 'clase': 'estudio', 'curso': 'estudio', 'uni': 'estudio', 'colegio': 'estudio'
};

export const SettingsView: React.FC<SettingsViewProps> = ({ data, onUpdateData }) => {
  const [activeTab, setActiveTab] = useState<'FAMILIES' | 'CATEGORIES' | 'ACCOUNTS'>('ACCOUNTS');
  
  // States para iconos sugeridos dinámicos
  const [accSuggestions, setAccSuggestions] = useState<string[]>([]);
  const [famSuggestions, setFamSuggestions] = useState<string[]>([]);
  const [catSuggestions, setCatSuggestions] = useState<string[]>([]);

  const resizeImage = (file: File): Promise<string> => {
      return new Promise((resolve) => {
          const img = new Image();
          img.src = URL.createObjectURL(file);
          img.onload = () => {
              const canvas = document.createElement('canvas');
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

  const getMultipleSuggestions = (text: string): string[] => {
      const lower = text.toLowerCase().trim();
      if (!lower) return [];
      
      const words = lower.split(/\s+/);
      const foundIcons: string[] = [];

      // 1. Buscar en el mapa de keywords
      for (const word of words) {
          const groupKey = KEYWORD_MAP[word];
          if (groupKey && ICON_GROUPS[groupKey]) {
              foundIcons.push(...ICON_GROUPS[groupKey]);
          }
      }

      // 2. Si no hay mucho, buscar por coincidencias parciales en llaves del mapa
      if (foundIcons.length < 5) {
          for (const [kw, groupKey] of Object.entries(KEYWORD_MAP)) {
              if (lower.includes(kw)) {
                  foundIcons.push(...ICON_GROUPS[groupKey]);
              }
          }
      }

      // Limitar y desordenar un poco para variedad si hay muchos
      const uniqueIcons = Array.from(new Set(foundIcons));
      return uniqueIcons.slice(0, 15);
  };

  // --- CUENTAS STATE ---
  const [accId, setAccId] = useState<string | null>(null);
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
      setAccId(acc.id); setAccName(acc.name); setAccBalance(acc.initialBalance.toString()); setAccIcon(acc.icon);
      setAccSuggestions(getMultipleSuggestions(acc.name));
  };
  
  const handleSaveAccount = () => {
      if(!accName) return;
      const balanceVal = parseFloat(accBalance) || 0;
      if (accId) {
          const updated = data.accounts.map(a => a.id === accId ? { ...a, name: accName, initialBalance: balanceVal, icon: accIcon } : a);
          onUpdateData({ accounts: updated });
      } else {
          const newAcc: Account = { id: crypto.randomUUID(), name: accName, initialBalance: balanceVal, currency: 'EUR', icon: accIcon };
          onUpdateData({ accounts: [...data.accounts, newAcc] });
      }
      setAccId(null); setAccName(''); setAccBalance(''); setAccIcon('🏦'); setAccSuggestions([]);
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>, setIcon: (s: string) => void) => {
      if (e.target.files && e.target.files[0]) {
          const base64 = await resizeImage(e.target.files[0]);
          setIcon(base64);
      }
  };

  // --- HANDLERS FAMILIAS ---
  const handleEditFamily = (fam: Family) => {
      setFamId(fam.id); setFamName(fam.name); setFamType(fam.type); setFamIcon(fam.icon);
      setFamSuggestions(getMultipleSuggestions(fam.name));
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
      setFamId(null); setFamName(''); setFamIcon('📂'); setFamSuggestions([]);
  };

  // --- HANDLERS CATEGORIAS ---
  const handleEditCategory = (cat: Category) => {
      setCatId(cat.id); setCatName(cat.name); setCatParent(cat.familyId); setCatIcon(cat.icon);
      setCatSuggestions(getMultipleSuggestions(cat.name));
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
      setCatId(null); setCatName(''); setCatIcon('🏷️'); setCatSuggestions([]);
  };

  const handleImportEntities = (type: 'ACCOUNT' | 'FAMILY' | 'CATEGORY') => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(ws) as any[];

        if (type === 'ACCOUNT') {
          const newAccounts = [...data.accounts];
          jsonData.forEach(row => {
            const name = (row.Nombre || '').trim();
            if (name && !newAccounts.find(a => a.name.toLowerCase() === name.toLowerCase())) {
              const suggestions = getMultipleSuggestions(name);
              newAccounts.push({
                id: crypto.randomUUID(),
                name,
                initialBalance: parseFloat(row.Saldo) || 0,
                currency: 'EUR',
                icon: row.Icono || (suggestions[0] || '💰')
              });
            }
          });
          onUpdateData({ accounts: newAccounts });
        } else if (type === 'FAMILY') {
          const newFamilies = [...data.families];
          jsonData.forEach(row => {
            const name = (row.Nombre || '').trim();
            if (name && !newFamilies.find(f => f.name.toLowerCase() === name.toLowerCase())) {
              const suggestions = getMultipleSuggestions(name);
              newFamilies.push({
                id: crypto.randomUUID(),
                name,
                type: (row.Naturaleza || 'Gasto').toLowerCase().includes('ingreso') ? 'INCOME' : 'EXPENSE',
                icon: row.Icono || (suggestions[0] || '📂')
              });
            }
          });
          onUpdateData({ families: newFamilies });
        } else if (type === 'CATEGORY') {
          const newCategories = [...data.categories];
          jsonData.forEach(row => {
            const name = (row.Nombre || '').trim();
            const parentName = (row.FamiliaPadre || '').trim();
            if (name && parentName) {
              const family = data.families.find(f => f.name.toLowerCase() === parentName.toLowerCase());
              if (family && !newCategories.find(c => c.name.toLowerCase() === name.toLowerCase() && c.familyId === family.id)) {
                const suggestions = getMultipleSuggestions(name);
                newCategories.push({
                  id: crypto.randomUUID(),
                  name,
                  familyId: family.id,
                  icon: row.Icono || (suggestions[0] || '🏷️')
                });
              }
            }
          });
          onUpdateData({ categories: newCategories });
        }
        alert('Importación completada.');
      } catch (err) {
        alert('Error procesando el archivo.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadSpecificTemplate = (type: 'ACCOUNT' | 'FAMILY' | 'CATEGORY') => {
    let headers: string[] = [];
    let rows: any[][] = [];
    let filename = '';

    if (type === 'ACCOUNT') {
      headers = ['Nombre', 'Saldo', 'Icono'];
      rows = [['Mi Cuenta Ahorro', '5000', '💰']];
      filename = 'plantilla_cuentas.xlsx';
    } else if (type === 'FAMILY') {
      headers = ['Nombre', 'Naturaleza', 'Icono'];
      rows = [['Transporte', 'Gasto', '🚗'], ['Trabajo', 'Ingreso', '💼']];
      filename = 'plantilla_familias.xlsx';
    } else if (type === 'CATEGORY') {
      headers = ['Nombre', 'FamiliaPadre', 'Icono'];
      rows = [['Bus', 'Transporte', '🚌'], ['Nómina', 'Trabajo', '💵']];
      filename = 'plantilla_categorias.xlsx';
    }

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
    XLSX.writeFile(wb, filename);
  };

  const renderIconInputWithSuggestions = (
    icon: string, 
    setIcon: (s: string) => void, 
    nameForReset: string, 
    fileRef: React.RefObject<HTMLInputElement>,
    suggestions: string[]
  ) => {
      const isImage = icon.startsWith('data:image');
      return (
          <div className="space-y-3 w-full">
              <div className="flex gap-2 items-center">
                   <div className="relative group w-12 h-12 flex-shrink-0 flex items-center justify-center border rounded-lg bg-slate-50 overflow-hidden cursor-pointer transition-all hover:border-emerald-300" onClick={() => fileRef.current?.click()}>
                       {isImage ? <img src={icon} className="w-full h-full object-cover" /> : <span className="text-2xl">{icon}</span>}
                       <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                           <Upload size={16} />
                       </div>
                   </div>
                   <input 
                       type="text" placeholder="Emoji" className="w-16 px-2 py-2 border rounded-lg text-center outline-none focus:ring-1 focus:ring-emerald-500"
                       value={!isImage ? icon : ''} onChange={e => setIcon(e.target.value)} disabled={isImage}
                   />
                   <button 
                      onClick={() => {
                        const newSuggestions = getMultipleSuggestions(nameForReset);
                        if (newSuggestions.length > 0) setIcon(newSuggestions[0]);
                      }} 
                      className="p-2 text-slate-500 hover:text-emerald-600 bg-slate-100 rounded-lg transition-colors"
                      title="Sugerir iconos según el nombre"
                    >
                      <RotateCcw size={18} />
                   </button>
                   <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={(e) => handleIconUpload(e, setIcon)} />
                   {isImage && <button onClick={() => setIcon('❓')} className="text-red-500 p-2"><X size={16}/></button>}
              </div>
              
              {suggestions.length > 0 && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 animate-in fade-in slide-in-from-top-1 duration-300">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                        <Sparkles size={10} className="text-amber-500"/> Sugerencias para "{nameForReset}"
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {suggestions.map((emoji, idx) => (
                            <button 
                                key={idx} 
                                type="button"
                                onClick={() => setIcon(emoji)}
                                className={`text-xl p-1.5 rounded-lg transition-all hover:bg-white hover:shadow-sm hover:scale-110 ${icon === emoji ? 'bg-white shadow-sm ring-1 ring-emerald-500' : ''}`}
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                </div>
              )}
          </div>
      )
  }

  const handleNameInputChange = (
    val: string, 
    setName: (s: string) => void, 
    setIcon: (s: string) => void, 
    currentIcon: string,
    setSuggestions: (icons: string[]) => void
  ) => {
      setName(val);
      const suggestions = getMultipleSuggestions(val);
      setSuggestions(suggestions);
      
      // Auto-asignar primer icono si el actual es genérico o por defecto
      const genericIcons = ['📝', '📂', '🏷️', '🏦', '📂'];
      if (suggestions.length > 0 && genericIcons.includes(currentIcon)) {
          setIcon(suggestions[0]);
      }
  }

  const ImportSection = ({ type, title }: { type: 'ACCOUNT' | 'FAMILY' | 'CATEGORY', title: string }) => (
    <div className="mt-8 pt-8 border-t border-slate-100">
        <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-emerald-500" /> Importar {title} (Masivo)
        </h4>
        <div className="flex flex-col sm:flex-row gap-3">
            <button 
                onClick={() => downloadSpecificTemplate(type)}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-4 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
                <Download size={14} /> Plantilla
            </button>
            <div className="flex-1 relative">
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImportEntities(type)} className="absolute inset-0 opacity-0 cursor-pointer" />
                <div className="flex items-center justify-center gap-2 py-2 px-4 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-100">
                    <Upload size={14} /> Subir Archivo
                </div>
            </div>
        </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Configuración</h2>

      <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-hide">
        <button 
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors whitespace-nowrap ${activeTab === 'ACCOUNTS' ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('ACCOUNTS')}
        >
            <Wallet size={18} /> Cuentas
        </button>
        <button 
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors whitespace-nowrap ${activeTab === 'FAMILIES' ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('FAMILIES')}
        >
            <Layers size={18} /> Familias
        </button>
        <button 
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors whitespace-nowrap ${activeTab === 'CATEGORIES' ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('CATEGORIES')}
        >
            <Tag size={18} /> Categorías
        </button>
      </div>

      {activeTab === 'ACCOUNTS' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-300">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-fit">
                  <h3 className="text-lg font-bold mb-4">{accId ? 'Editar Cuenta' : 'Añadir Cuenta'}</h3>
                  <div className="space-y-4">
                      <input 
                        type="text" placeholder="Nombre de la cuenta (ej. Banco Principal)" 
                        className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all" 
                        value={accName} 
                        onChange={e => handleNameInputChange(e.target.value, setAccName, setAccIcon, accIcon, setAccSuggestions)} 
                      />
                      
                      {renderIconInputWithSuggestions(accIcon, setAccIcon, accName, accFileInputRef, accSuggestions)}

                      <input type="number" placeholder="Saldo inicial" className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" value={accBalance} onChange={e => setAccBalance(e.target.value)} />
                      
                      <div className="flex gap-2">
                        {accId && <button onClick={() => { setAccId(null); setAccName(''); setAccBalance(''); setAccIcon('🏦'); setAccSuggestions([]); }} className="flex-1 py-3 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors">Cancelar</button>}
                        <button onClick={handleSaveAccount} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-bold transition-colors">{accId ? 'Actualizar' : 'Añadir'}</button>
                      </div>
                  </div>
                  <ImportSection type="ACCOUNT" title="Cuentas" />
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                  <h3 className="text-lg font-bold mb-4">Cuentas Existentes</h3>
                  <ul className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                      {data.accounts.map(acc => (
                          <li key={acc.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg group border border-slate-100">
                              <div className="flex items-center">
                                  {acc.icon.startsWith('data:image') ? <img src={acc.icon} className="w-8 h-8 mr-3 object-contain"/> : <span className="text-2xl mr-3">{acc.icon}</span>}
                                  <div><span className="font-bold text-slate-800 block text-sm">{acc.name}</span><span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Saldo: {acc.initialBalance} €</span></div>
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

      {activeTab === 'FAMILIES' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-300">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-fit">
                  <h3 className="text-lg font-bold mb-4">{famId ? 'Editar Familia' : 'Nueva Familia'}</h3>
                  <div className="space-y-4">
                      <input 
                        type="text" placeholder="Nombre Familia (p.ej. Vivienda)" 
                        className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all" 
                        value={famName} 
                        onChange={e => handleNameInputChange(e.target.value, setFamName, setFamIcon, famIcon, setFamSuggestions)} 
                      />
                      
                      {renderIconInputWithSuggestions(famIcon, setFamIcon, famName, famFileInputRef, famSuggestions)}

                      <div className="flex gap-2">
                          <select className="flex-1 px-4 py-3 border rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-500" value={famType} onChange={e => setFamType(e.target.value as any)}>
                              <option value="EXPENSE">Gastos 🔴</option>
                              <option value="INCOME">Ingresos 🟢</option>
                          </select>
                          <button onClick={handleSaveFamily} className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold flex-1 transition-colors">{famId ? 'Actualizar' : 'Crear'}</button>
                      </div>
                  </div>
                  <ImportSection type="FAMILY" title="Familias" />
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                  <h3 className="text-lg font-bold mb-4">Familias Registradas</h3>
                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                      {data.families.map(f => (
                          <div key={f.id} className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-100 group">
                              <div className="flex items-center">
                                {f.icon.startsWith('data:image') ? <img src={f.icon} className="w-8 h-8 mr-3 object-contain"/> : <span className="text-2xl mr-3">{f.icon}</span>}
                                <div><span className="font-bold text-slate-800 text-sm">{f.name}</span><span className={`block text-[10px] font-black uppercase ${f.type === 'INCOME' ? 'text-emerald-500' : 'text-rose-500'}`}>{f.type === 'INCOME' ? 'Ingreso' : 'Gasto'}</span></div>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEditFamily(f)} className="text-slate-400 hover:text-blue-500 p-2"><Edit2 size={16}/></button>
                                <button onClick={() => onUpdateData({ families: data.families.filter(i => i.id !== f.id), categories: data.categories.filter(c => c.familyId !== f.id) })} className="text-slate-400 hover:text-red-500 p-2"><Trash2 size={16}/></button>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'CATEGORIES' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-300">
               <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-fit">
                  <h3 className="text-lg font-bold mb-4">{catId ? 'Editar Categoría' : 'Nueva Categoría'}</h3>
                  <div className="space-y-4">
                      <select className="w-full px-4 py-3 border rounded-xl bg-white font-medium outline-none focus:ring-2 focus:ring-emerald-500" value={catParent} onChange={e => setCatParent(e.target.value)}>
                          <option value="">Selecciona Familia...</option>
                          {data.families.map(f => <option key={f.id} value={f.id}>{!f.icon.startsWith('data:') ? f.icon : ''} {f.name}</option>)}
                      </select>
                      
                      <input 
                        type="text" placeholder="Nombre Categoría (p.ej. Alquiler)" 
                        className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all disabled:opacity-50" 
                        value={catName} 
                        onChange={e => handleNameInputChange(e.target.value, setCatName, setCatIcon, catIcon, setCatSuggestions)} 
                        disabled={!catParent}
                      />
                      
                      {renderIconInputWithSuggestions(catIcon, setCatIcon, catName, catFileInputRef, catSuggestions)}

                      <button onClick={handleSaveCategory} disabled={!catParent} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold disabled:opacity-50 transition-colors">
                        {catId ? 'Actualizar' : 'Crear'}
                      </button>
                  </div>
                  <ImportSection type="CATEGORY" title="Categorías" />
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                  <h3 className="text-lg font-bold mb-4">Categorías por Familia</h3>
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                      {data.families.map(fam => {
                        const famCats = data.categories.filter(c => c.familyId === fam.id);
                        if (famCats.length === 0 && !catId) return null;
                        return (
                          <div key={fam.id} className="space-y-2">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              {!fam.icon.startsWith('data:') ? fam.icon : ''} {fam.name}
                            </h4>
                            <div className="grid grid-cols-1 gap-1">
                              {famCats.map(c => (
                                <div key={c.id} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg group border border-slate-100">
                                    <div className="text-sm flex items-center gap-2">
                                        {c.icon.startsWith('data:image') ? <img src={c.icon} className="w-6 h-6 object-contain"/> : <span>{c.icon}</span>}
                                        <span className="font-bold text-slate-700 text-xs">{c.name}</span>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleEditCategory(c)} className="text-slate-400 hover:text-blue-500 p-1"><Edit2 size={14}/></button>
                                        <button onClick={() => onUpdateData({ categories: data.categories.filter(i => i.id !== c.id) })} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={14}/></button>
                                    </div>
                                </div>
                              ))}
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