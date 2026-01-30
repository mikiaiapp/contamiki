
import React, { useState, useRef, useEffect } from 'react';
import { AppState, Account, Family, Category } from '../types';
import { Trash2, Edit2, Layers, Tag, Wallet, Loader2, ImageIcon, Sparkles, Maximize2, ClipboardList, Info, FileSpreadsheet, ChevronDown, XCircle } from 'lucide-react';
import { searchInternetLogos } from '../services/iconService';
import * as XLSX from 'xlsx';

interface SettingsViewProps {
  data: AppState;
  onUpdateData: (newData: Partial<AppState>) => void;
}

const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const SettingsView: React.FC<SettingsViewProps> = ({ data, onUpdateData }) => {
  const [activeTab, setActiveTab] = useState<'FAMILIES' | 'CATEGORIES' | 'ACCOUNTS'>('ACCOUNTS');
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  
  const [webLogos, setWebLogos] = useState<{url: string, source: string}[]>([]);
  const [isSearchingWeb, setIsSearchingWeb] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const searchTimeoutRef = useRef<number | null>(null);

  // States
  const [accId, setAccId] = useState<string | null>(null);
  const [accName, setAccName] = useState('');
  const [accBalance, setAccBalance] = useState('');
  const [accIcon, setAccIcon] = useState('🏦');
  const accFileInputRef = useRef<HTMLInputElement>(null);

  const [famName, setFamName] = useState('');
  const [famType, setFamType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [famIcon, setFamIcon] = useState('📂');
  const famFileInputRef = useRef<HTMLInputElement>(null);

  const [catName, setCatName] = useState('');
  const [catParent, setCatParent] = useState('');
  const [catIcon, setCatIcon] = useState('🏷️');
  const catFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { 
    setWebLogos([]); 
    setHasSearched(false);
    resetForm();
  }, [activeTab]);

  const resetForm = () => {
      setAccId(null); setAccName(''); setAccBalance(''); setAccIcon('🏦');
      setFamName(''); setFamIcon('📂'); setCatName(''); setCatIcon('🏷️'); setCatParent('');
      setWebLogos([]); setHasSearched(false);
  };

  const triggerWebSearch = (text: string) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!text || text.trim().length < 2) { 
        setWebLogos([]); 
        setHasSearched(false);
        return; 
    }
    
    searchTimeoutRef.current = window.setTimeout(async () => {
        setIsSearchingWeb(true);
        setHasSearched(true);
        const results = await searchInternetLogos(text);
        setWebLogos(results);
        setIsSearchingWeb(false);
    }, 800);
  };

  const handleSelectWebLogo = async (url: string, setIcon: (s: string) => void) => {
      setIcon(url); // Establecemos primero la URL para respuesta inmediata
      try {
          const response = await fetch(url);
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
              setIcon(reader.result as string); // Luego persistimos como Base64
              setWebLogos([]);
              setHasSearched(false);
          };
          reader.readAsDataURL(blob);
      } catch (e) { 
          // Si hay CORS, mantenemos la URL original (funciona en <img> pero no se guarda como base64)
          setWebLogos([]);
          setHasSearched(false);
      }
  };

  const renderIconInput = (icon: string, setIcon: (s: string) => void, currentName: string, fileRef: React.RefObject<HTMLInputElement>) => {
    const isImage = icon.startsWith('data:image') || icon.startsWith('http');
    const showResults = isSearchingWeb || webLogos.length > 0 || (hasSearched && !isSearchingWeb && webLogos.length === 0);
    
    return (
      <div className="space-y-4 w-full">
          <div className="flex flex-col sm:flex-row gap-4 items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="relative group w-20 h-20 flex-shrink-0 flex items-center justify-center border-2 border-white rounded-2xl bg-white overflow-hidden shadow-sm cursor-pointer" onClick={() => fileRef.current?.click()}>
                    {isImage ? <img src={icon} className="w-full h-full object-contain p-2" alt="Icono" /> : <span className="text-3xl">{icon}</span>}
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <ImageIcon className="text-white" size={20} />
                    </div>
                </div>
                <div className="flex-1 text-center sm:text-left space-y-3">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Avatar Personalizado</p>
                    <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                        <button onClick={() => fileRef.current?.click()} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg font-black text-[8px] uppercase tracking-widest flex items-center gap-1.5 hover:bg-slate-50 transition-colors shadow-sm"><ImageIcon size={12} /> Galería</button>
                        <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={async (e) => {
                            if (e.target.files && e.target.files[0]) {
                                const reader = new FileReader();
                                reader.onload = (ev) => setIcon(ev.target?.result as string);
                                reader.readAsDataURL(e.target.files[0]);
                            }
                        }} />
                        {isImage && <button onClick={() => setIcon('🏦')} className="text-rose-500 bg-rose-50 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase">Borrar</button>}
                    </div>
                </div>
          </div>

          {showResults && (
            <div className="bg-white p-5 rounded-[2rem] border-2 border-indigo-50 shadow-2xl space-y-4 animate-in slide-in-from-top-4 duration-500 ring-4 ring-indigo-50/30">
                <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                    <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                        <Sparkles size={14} className={isSearchingWeb ? 'animate-pulse' : ''} /> 
                        {isSearchingWeb ? `Buscando logos para "${currentName}"...` : `Sugerencias para "${currentName}"`}
                    </span>
                    {!isSearchingWeb && (
                        <button onClick={() => {setWebLogos([]); setHasSearched(false);}} className="text-slate-300 hover:text-rose-500 transition-colors"><XCircle size={18}/></button>
                    )}
                </div>
                
                {webLogos.length > 0 ? (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar p-1">
                        {webLogos.map((logo, idx) => (
                            <button 
                                key={idx} 
                                onClick={() => handleSelectWebLogo(logo.url, setIcon)} 
                                className="aspect-square bg-white rounded-xl border-2 border-slate-100 hover:border-indigo-500 p-2 transition-all flex items-center justify-center overflow-hidden shadow-sm hover:scale-110 active:scale-95"
                            >
                                <img src={logo.url} className="w-full h-full object-contain" alt={logo.source} title={logo.source} />
                            </button>
                        ))}
                    </div>
                ) : !isSearchingWeb && hasSearched && (
                    <div className="py-8 text-center flex flex-col items-center gap-2">
                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-300"><Info size={20}/></div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No se encontraron marcas oficiales</p>
                    </div>
                )}
                
                {isSearchingWeb && (
                    <div className="py-12 flex flex-col items-center justify-center gap-4">
                        <div className="relative">
                            <Loader2 className="animate-spin text-indigo-500" size={32} />
                            <Sparkles className="absolute top-0 right-0 text-indigo-300 animate-bounce" size={14} />
                        </div>
                        <span className="text-[9px] font-black text-indigo-300 uppercase tracking-[0.4em]">Consultando Red de Logos</span>
                    </div>
                )}
            </div>
          )}
      </div>
    );
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>, type: 'ACCOUNTS' | 'FAMILIES' | 'CATEGORIES') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    reader.onload = (event) => {
      const result = event.target?.result;
      if (isExcel) {
        const workbook = XLSX.read(result, { type: 'binary' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        const newItems: any[] = [];
        json.forEach(parts => {
            if (parts.length < 2 || !parts[0]) return;
            if (type === 'ACCOUNTS') newItems.push({ id: generateId(), name: String(parts[0]), initialBalance: parseFloat(String(parts[1])) || 0, currency: 'EUR', icon: '🏦' });
            else if (type === 'FAMILIES') {
                const flowType = String(parts[1]).toUpperCase().includes('INGRESO') ? 'INCOME' : 'EXPENSE';
                newItems.push({ id: generateId(), name: String(parts[0]), type: flowType, icon: flowType === 'INCOME' ? '📈' : '📂' });
            } else if (type === 'CATEGORIES') {
                const family = data.families.find(f => f.name.toLowerCase() === String(parts[1]).toLowerCase());
                if (family) newItems.push({ id: generateId(), name: String(parts[0]), familyId: family.id, icon: '🏷️' });
            }
        });
        if (newItems.length > 0) {
            if (type === 'ACCOUNTS') onUpdateData({ accounts: [...data.accounts, ...newItems] });
            if (type === 'FAMILIES') onUpdateData({ families: [...data.families, ...newItems] });
            if (type === 'CATEGORIES') onUpdateData({ categories: [...data.categories, ...newItems] });
        }
      } else {
        setImportText(result as string);
      }
    };
    if (isExcel) reader.readAsBinaryString(file);
    else reader.readAsText(file);
  };

  return (
    <div className="space-y-12 max-w-full overflow-hidden">
      <div className="text-center md:text-left space-y-2">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tighter leading-none">Ajustes.</h2>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em]">Configuración del Entorno</p>
      </div>

      <div className="flex bg-slate-100 p-1.5 rounded-[1.5rem] shadow-inner border border-slate-200/50 overflow-x-auto scrollbar-hide">
        <button className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all whitespace-nowrap ${activeTab === 'ACCOUNTS' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => setActiveTab('ACCOUNTS')}><Wallet size={18} /> Cuentas</button>
        <button className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all whitespace-nowrap ${activeTab === 'FAMILIES' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => setActiveTab('FAMILIES')}><Layers size={18} /> Grupos</button>
        <button className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all whitespace-nowrap ${activeTab === 'CATEGORIES' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => setActiveTab('CATEGORIES')}><Tag size={18} /> Detalles</button>
      </div>

      {activeTab === 'ACCOUNTS' && (
          <div className="grid grid-cols-1 gap-10 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                  <div className="bg-white p-8 sm:p-12 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
                      <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-4">
                          <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-2xl shadow-indigo-100"><Wallet size={24}/></div>
                          {accId ? 'Modificar Cuenta' : 'Añadir Cuenta'}
                      </h3>
                      <div className="space-y-6">
                          <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                  <Sparkles size={12} className="text-indigo-400" /> Entidad Financiera
                              </label>
                              <input type="text" placeholder="Ej: Santander, Revolut, BBVA..." className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all text-slate-900 shadow-sm" value={accName} onChange={e => { setAccName(e.target.value); triggerWebSearch(e.target.value); }} />
                          </div>
                          {renderIconInput(accIcon, setAccIcon, accName, accFileInputRef)}
                          <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Capital Inicial (€)</label>
                              <input type="number" placeholder="0.00" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all text-slate-900 shadow-sm" value={accBalance} onChange={e => setAccBalance(e.target.value)} />
                          </div>
                          <button onClick={() => {
                              if(!accName) return;
                              const balanceVal = parseFloat(accBalance) || 0;
                              if (accId) onUpdateData({ accounts: data.accounts.map(a => a.id === accId ? { ...a, name: accName, initialBalance: balanceVal, icon: accIcon } : a) });
                              else onUpdateData({ accounts: [...data.accounts, { id: generateId(), name: accName, initialBalance: balanceVal, currency: 'EUR', icon: accIcon }] });
                              resetForm();
                          }} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-2xl hover:bg-indigo-600 transition-all active:scale-95">Guardar Configuración</button>
                      </div>
                  </div>
                  <div className="bg-white p-8 sm:p-12 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col">
                      <h3 className="text-lg font-black text-slate-800 mb-8 uppercase tracking-widest">Patrimonio Conectado</h3>
                      <div className="space-y-4 flex-1 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                          {data.accounts.map(acc => (
                              <div key={acc.id} className="flex justify-between items-center p-6 bg-slate-50 rounded-[2rem] group border border-transparent hover:border-indigo-100 hover:bg-white hover:shadow-xl transition-all">
                                  <div className="flex items-center gap-5 min-w-0">
                                      <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center overflow-hidden border border-slate-100 p-2 shadow-sm shrink-0">
                                        {(acc.icon || '🏦').startsWith('data:image') || (acc.icon || '🏦').startsWith('http') ? <img src={acc.icon} className="w-full h-full object-contain" alt={acc.name} /> : <span className="text-3xl">{acc.icon || '🏦'}</span>}
                                      </div>
                                      <div className="truncate">
                                          <span className="font-black text-slate-900 block text-[13px] uppercase tracking-tight truncate">{acc.name}</span>
                                          <span className="text-[11px] font-bold text-indigo-500">{acc.initialBalance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                                      </div>
                                  </div>
                                  <div className="flex gap-2">
                                      <button onClick={() => { setAccId(acc.id); setAccName(acc.name); setAccBalance(acc.initialBalance.toString()); setAccIcon(acc.icon || '🏦'); }} className="p-3 text-slate-300 hover:text-indigo-600 transition-colors"><Edit2 size={20}/></button>
                                      <button onClick={() => onUpdateData({accounts: data.accounts.filter(a=>a.id!==acc.id)})} className="p-3 text-slate-300 hover:text-rose-600 transition-colors"><Trash2 size={20}/></button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'FAMILIES' && (
          <div className="grid grid-cols-1 gap-10 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                  <div className="bg-white p-8 sm:p-12 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
                      <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-4">
                          <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-2xl shadow-indigo-100"><Layers size={24}/></div>
                          Nuevo Agrupador
                      </h3>
                      <div className="space-y-6">
                          <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                  <Sparkles size={12} className="text-indigo-400" /> Título del Grupo
                              </label>
                              <input type="text" placeholder="Ej: Hogar, Suscripciones, Ocio..." className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all text-slate-900 shadow-sm" value={famName} onChange={e => { setFamName(e.target.value); triggerWebSearch(e.target.value); }} />
                          </div>
                          {renderIconInput(famIcon, setFamIcon, famName, famFileInputRef)}
                          <div className="flex bg-slate-100 p-2 rounded-2xl">
                            <button type="button" className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${famType === 'EXPENSE' ? 'bg-white text-rose-600 shadow-lg' : 'text-slate-400'}`} onClick={() => setFamType('EXPENSE')}>Gasto</button>
                            <button type="button" className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${famType === 'INCOME' ? 'bg-white text-emerald-600 shadow-lg' : 'text-slate-400'}`} onClick={() => setFamType('INCOME')}>Ingreso</button>
                          </div>
                          <button onClick={() => {
                              if(!famName) return;
                              onUpdateData({ families: [...data.families, { id: generateId(), name: famName, type: famType, icon: famIcon }] });
                              resetForm();
                          }} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-2xl hover:bg-indigo-600 transition-all active:scale-95">Guardar Grupo</button>
                      </div>
                  </div>
                  <div className="bg-white p-8 sm:p-12 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col">
                      <h3 className="text-lg font-black text-slate-800 mb-8 uppercase tracking-widest">Estructura Global</h3>
                      <div className="space-y-4 flex-1 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                          {data.families.map(f => (
                              <div key={f.id} className="flex justify-between items-center p-6 bg-slate-50 rounded-[2rem] border border-transparent hover:border-indigo-100 hover:bg-white hover:shadow-xl transition-all">
                                  <div className="flex items-center gap-5">
                                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center overflow-hidden border border-slate-100 p-2 shadow-sm shrink-0">
                                        {(f.icon || '📂').startsWith('data:image') || (f.icon || '📂').startsWith('http') ? <img src={f.icon} className="w-full h-full object-contain" alt={f.name} /> : <span className="text-3xl">{f.icon || '📂'}</span>}
                                    </div>
                                    <span className="font-black text-slate-900 text-[13px] uppercase tracking-tight">{f.name}</span>
                                  </div>
                                  <span className={`text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-full ${f.type === 'INCOME' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                      {f.type === 'INCOME' ? 'Entrada' : 'Salida'}
                                  </span>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'CATEGORIES' && (
          <div className="grid grid-cols-1 gap-10 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                  <div className="bg-white p-8 sm:p-12 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
                      <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-4">
                          <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-2xl shadow-indigo-100"><Tag size={24}/></div>
                          Nuevo Detalle
                      </h3>
                      <div className="space-y-6">
                          <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vincular a Grupo</label>
                              <div className="relative">
                                  <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none appearance-none focus:border-indigo-500 transition-all text-slate-900 shadow-sm" value={catParent} onChange={e => setCatParent(e.target.value)}>
                                      <option value="">Selecciona un grupo...</option>
                                      {data.families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                  </select>
                                  <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                              </div>
                          </div>
                          <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                  <Sparkles size={12} className="text-indigo-400" /> Nombre del Detalle
                              </label>
                              <input type="text" placeholder="Ej: Netflix, Cine, Mercadona..." className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all text-slate-900 shadow-sm" value={catName} onChange={e => { setCatName(e.target.value); triggerWebSearch(e.target.value); }} />
                          </div>
                          {renderIconInput(catIcon, setCatIcon, catName, catFileInputRef)}
                          <button onClick={() => {
                              if(!catName || !catParent) return;
                              onUpdateData({ categories: [...data.categories, { id: generateId(), name: catName, familyId: catParent, icon: catIcon }] });
                              resetForm();
                          }} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-2xl hover:bg-indigo-600 transition-all active:scale-95">Guardar Detalle</button>
                      </div>
                  </div>
                  <div className="bg-white p-8 sm:p-12 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col">
                      <h3 className="text-lg font-black text-slate-800 mb-8 uppercase tracking-widest">Jerarquía Actual</h3>
                      <div className="space-y-10 flex-1 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                          {data.families.map(fam => {
                            const famCats = data.categories.filter(c => c.familyId === fam.id);
                            if (famCats.length === 0) return null;
                            return (
                              <div key={fam.id} className="space-y-5">
                                <h4 className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.4em] border-b-2 border-indigo-50 pb-4 flex items-center gap-3">
                                    {fam.name}
                                    <span className="bg-indigo-50 text-indigo-500 px-3 py-1 rounded-lg text-[9px] font-black">{famCats.length}</span>
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  {famCats.map(c => (
                                    <div key={c.id} className="flex items-center gap-5 p-5 bg-slate-50 rounded-[1.75rem] border-2 border-transparent hover:border-indigo-50 hover:bg-white hover:shadow-xl transition-all">
                                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center overflow-hidden border border-slate-100 p-2 shadow-sm shrink-0">
                                            {(c.icon || '🏷️').startsWith('data:image') || (c.icon || '🏷️').startsWith('http') ? <img src={c.icon} className="w-full h-full object-contain" alt={c.name} /> : <span className="text-2xl">{c.icon || '🏷️'}</span>}
                                        </div>
                                        <span className="font-bold text-slate-700 text-[12px] uppercase truncate">{c.name}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
