
import React, { useState, useRef, useEffect } from 'react';
import { AppState, Account, Family, Category } from '../types';
import { Trash2, Edit2, Upload, Layers, Tag, Wallet, Loader2, Search, ImageIcon, Zap, Maximize2, ClipboardList, Info, FileSpreadsheet } from 'lucide-react';
import { searchInternetLogos } from '../services/iconService';
import * as XLSX from 'xlsx';

interface SettingsViewProps {
  data: AppState;
  onUpdateData: (newData: Partial<AppState>) => void;
}

// Helper para generar IDs robustos incluso en entornos no seguros
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
  const searchTimeoutRef = useRef<number | null>(null);

  const processImportData = (rawLines: string[][], type: 'ACCOUNTS' | 'FAMILIES' | 'CATEGORIES') => {
    const newItems: any[] = [];
    rawLines.forEach(parts => {
      if (parts.length < 2 || !parts[0]) return;
      if (type === 'ACCOUNTS') {
        newItems.push({ id: generateId(), name: parts[0], initialBalance: parseFloat(parts[1]) || 0, currency: 'EUR', icon: '🏦' });
      } else if (type === 'FAMILIES') {
        const flowType = parts[1].toUpperCase().includes('INGRESO') ? 'INCOME' : 'EXPENSE';
        newItems.push({ id: generateId(), name: parts[0], type: flowType, icon: flowType === 'INCOME' ? '📈' : '📂' });
      } else if (type === 'CATEGORIES') {
        const family = data.families.find(f => f.name.toLowerCase() === parts[1].toLowerCase());
        if (family) newItems.push({ id: generateId(), name: parts[0], familyId: family.id, icon: '🏷️' });
      }
    });
    if (newItems.length > 0) {
      if (type === 'ACCOUNTS') onUpdateData({ accounts: [...data.accounts, ...newItems] });
      if (type === 'FAMILIES') onUpdateData({ families: [...data.families, ...newItems] });
      if (type === 'CATEGORIES') onUpdateData({ categories: [...data.categories, ...newItems] });
      setImportText(''); setShowImport(false);
      alert(`${newItems.length} registros importados.`);
    }
  };

  const handleTextImport = (type: 'ACCOUNTS' | 'FAMILIES' | 'CATEGORIES') => {
    const lines = importText.split('\n').filter(l => l.trim().length > 0).map(line => line.split(';').map(p => p.trim()));
    processImportData(lines, type);
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
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
        processImportData(json, type);
      } else {
        setImportText(result as string);
      }
    };
    if (isExcel) reader.readAsBinaryString(file);
    else reader.readAsText(file);
  };

  const triggerWebSearch = (text: string) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!text || text.length < 3) { setWebLogos([]); return; }
    searchTimeoutRef.current = window.setTimeout(async () => {
        setIsSearchingWeb(true);
        const results = await searchInternetLogos(text);
        setWebLogos(results);
        setIsSearchingWeb(false);
    }, 450);
  };

  const handleSelectWebLogo = async (url: string, setIcon: (s: string) => void) => {
      try {
          const response = await fetch(url);
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onloadend = () => setIcon(reader.result as string);
          reader.readAsDataURL(blob);
      } catch (e) { setIcon(url); }
      setWebLogos([]);
  };

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

  useEffect(() => { setWebLogos([]); setShowImport(false); setImportText(''); }, [activeTab]);

  const resetForm = () => {
      setAccId(null); setAccName(''); setAccBalance(''); setAccIcon('🏦');
      setFamName(''); setFamIcon('📂'); setCatName(''); setCatIcon('🏷️'); setCatParent('');
      setWebLogos([]);
  };

  const renderImportSection = (type: 'ACCOUNTS' | 'FAMILIES' | 'CATEGORIES') => {
    const templates = {
      ACCOUNTS: "Cuenta; Saldo\nEjemplo: Santander; 1500",
      FAMILIES: "Grupo; Tipo\nEjemplo: Ocio; Gasto",
      CATEGORIES: "Detalle; Grupo\nEjemplo: Cine; Ocio"
    };

    return (
      <div className="mt-8">
        <button onClick={() => setShowImport(!showImport)} className="w-full flex items-center justify-between p-5 bg-white rounded-2xl border-2 border-slate-100 hover:border-indigo-100 shadow-sm transition-all">
          <div className="flex items-center gap-4 text-left">
            <ClipboardList className="text-indigo-600" size={20} />
            <div>
              <span className="block font-black text-slate-800 text-xs">Importación Masiva</span>
              <span className="block text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Excel o Texto</span>
            </div>
          </div>
          <Maximize2 size={14} className={`text-slate-300 transition-transform ${showImport ? 'rotate-180' : ''}`} />
        </button>

        {showImport && (
          <div className="mt-3 p-5 bg-white border-2 border-slate-50 rounded-[1.5rem] shadow-xl space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-indigo-600 text-[9px] font-black uppercase"><Info size={14}/> Formato Sugerido</div>
                <div className="bg-slate-50 p-3 rounded-lg font-mono text-[9px] text-slate-600 leading-relaxed">{templates[type]}</div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-600 text-[9px] font-black uppercase flex items-center gap-2"><FileSpreadsheet size={14}/> Carga de Datos</span>
                  <label className="cursor-pointer bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md text-[8px] font-black uppercase hover:bg-emerald-100">
                    <input type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" onChange={(e) => handleFileImport(e, type)} />
                    Examinar
                  </label>
                </div>
                <textarea className="w-full h-24 p-3 bg-slate-50 border-2 border-slate-100 rounded-lg font-mono text-[9px] outline-none" placeholder="Pega aquí..." value={importText} onChange={(e) => setImportText(e.target.value)}></textarea>
                <button onClick={() => handleTextImport(type)} disabled={!importText.trim()} className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-black uppercase tracking-widest text-[8px] shadow-lg active:scale-95 disabled:opacity-30">Importar Ahora</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderIconInput = (icon: string, setIcon: (s: string) => void, currentName: string, fileRef: React.RefObject<HTMLInputElement>) => {
    // Seguridad contra nulos
    const safeIcon = icon || '🏦';
    const isImage = safeIcon.startsWith('data:image') || safeIcon.startsWith('http');
    
    return (
      <div className="space-y-4 w-full">
          <div className="flex flex-col sm:flex-row gap-4 items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="relative group w-20 h-20 flex-shrink-0 flex items-center justify-center border-2 border-white rounded-2xl bg-white overflow-hidden shadow-sm cursor-pointer" onClick={() => fileRef.current?.click()}>
                    {isImage ? <img src={safeIcon} className="w-full h-full object-contain p-2" /> : <span className="text-3xl">{safeIcon}</span>}
                </div>
                <div className="flex-1 text-center sm:text-left space-y-3">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Avatar del Registro</p>
                    <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                        <button onClick={() => fileRef.current?.click()} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg font-black text-[8px] uppercase tracking-widest flex items-center gap-1.5 hover:bg-slate-50 transition-colors"><ImageIcon size={12} /> Galería</button>
                        <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={async (e) => {
                            if (e.target.files && e.target.files[0]) {
                                const img = new Image(); img.src = URL.createObjectURL(e.target.files[0]);
                                img.onload = () => {
                                    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
                                    canvas.getContext('2d')?.drawImage(img, 0, 0, 128, 128); setIcon(canvas.toDataURL('image/png'));
                                };
                            }
                        }} />
                        {isImage && <button onClick={() => setIcon('🏦')} className="text-rose-500 bg-rose-50 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase">Emoji</button>}
                    </div>
                </div>
          </div>
          {(webLogos.length > 0 || isSearchingWeb) && (
            <div className="bg-white p-4 rounded-[1.5rem] border-2 border-indigo-50 shadow-xl space-y-4">
                <div className="flex justify-between items-center">
                    <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Web: "{currentName}"</span>
                    {isSearchingWeb && <Loader2 size={14} className="animate-spin text-indigo-500" />}
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                    {webLogos.map((logo, idx) => (
                        <button key={idx} onClick={() => handleSelectWebLogo(logo.url, setIcon)} className="aspect-square bg-slate-50 rounded-xl border border-transparent hover:border-indigo-300 p-2.5 transition-all flex items-center justify-center overflow-hidden">
                            <img src={logo.url} className="w-full h-full object-contain" />
                        </button>
                    ))}
                </div>
            </div>
          )}
      </div>
    );
  };

  return (
    <div className="space-y-10 md:space-y-12 max-w-full overflow-hidden">
      <div className="text-center md:text-left space-y-2">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tighter">Ajustes.</h2>
        <p className="text-slate-400 text-xs font-medium">Define tu arquitectura financiera.</p>
      </div>

      <div className="flex bg-slate-100 p-1 rounded-[1.25rem] shadow-inner border border-slate-200/50 overflow-x-auto scrollbar-hide">
        <button className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 font-black text-[9px] uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${activeTab === 'ACCOUNTS' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => setActiveTab('ACCOUNTS')}><Wallet size={16} /> Cuentas</button>
        <button className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 font-black text-[9px] uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${activeTab === 'FAMILIES' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => setActiveTab('FAMILIES')}><Layers size={16} /> Grupos</button>
        <button className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 font-black text-[9px] uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${activeTab === 'CATEGORIES' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => setActiveTab('CATEGORIES')}><Tag size={16} /> Detalles</button>
      </div>

      {activeTab === 'ACCOUNTS' && (
          <div className="grid grid-cols-1 gap-8 animate-in fade-in">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-6">
                      <h3 className="text-xl font-black text-slate-800 tracking-tight">{accId ? 'Editar Cuenta' : 'Nueva Cuenta'}</h3>
                      <div className="space-y-5">
                          <input type="text" placeholder="Entidad (Ej: Santander)..." className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-indigo-500" value={accName} onChange={e => { setAccName(e.target.value); triggerWebSearch(e.target.value); }} />
                          {renderIconInput(accIcon, setAccIcon, accName, accFileInputRef)}
                          <input type="number" placeholder="Saldo (€)" className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-indigo-500" value={accBalance} onChange={e => setAccBalance(e.target.value)} />
                          <button onClick={() => {
                              if(!accName) return;
                              const balanceVal = parseFloat(accBalance) || 0;
                              if (accId) onUpdateData({ accounts: data.accounts.map(a => a.id === accId ? { ...a, name: accName, initialBalance: balanceVal, icon: accIcon } : a) });
                              else onUpdateData({ accounts: [...data.accounts, { id: generateId(), name: accName, initialBalance: balanceVal, currency: 'EUR', icon: accIcon }] });
                              resetForm();
                          }} className="w-full py-4.5 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest text-[9px] shadow-lg active:scale-95">{accId ? 'Confirmar' : 'Crear Cuenta'}</button>
                      </div>
                  </div>
                  <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-5">
                      <h3 className="text-lg font-black text-slate-800">Cuentas Activas</h3>
                      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                          {data.accounts.map(acc => (
                              <div key={acc.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl group border border-transparent hover:border-indigo-100 transition-all">
                                  <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center overflow-hidden border border-slate-100 p-1.5 shadow-sm">
                                        {(acc.icon || '🏦').startsWith('data:image') || (acc.icon || '🏦').startsWith('http') ? <img src={acc.icon} className="w-full h-full object-contain" /> : <span className="text-xl">{acc.icon || '🏦'}</span>}
                                      </div>
                                      <div>
                                          <span className="font-black text-slate-800 block text-xs truncate max-w-[100px]">{acc.name}</span>
                                          <span className="text-[8px] font-bold text-indigo-500">{acc.initialBalance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                                      </div>
                                  </div>
                                  <div className="flex gap-1 group-hover:opacity-100 transition-opacity">
                                      <button onClick={() => { setAccId(acc.id); setAccName(acc.name); setAccBalance(acc.initialBalance.toString()); setAccIcon(acc.icon || '🏦'); }} className="p-1.5 text-slate-300 hover:text-indigo-600"><Edit2 size={16}/></button>
                                      <button onClick={() => onUpdateData({accounts: data.accounts.filter(a=>a.id!==acc.id)})} className="p-1.5 text-slate-300 hover:text-rose-600"><Trash2 size={16}/></button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
              {renderImportSection('ACCOUNTS')}
          </div>
      )}

      {activeTab === 'FAMILIES' && (
          <div className="grid grid-cols-1 gap-8 animate-in fade-in">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-6">
                      <h3 className="text-xl font-black text-slate-800 tracking-tight">Nuevo Grupo</h3>
                      <div className="space-y-5">
                          <input type="text" placeholder="Nombre (Ej: Hogar)..." className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-indigo-500" value={famName} onChange={e => { setFamName(e.target.value); triggerWebSearch(e.target.value); }} />
                          {renderIconInput(famIcon, setFamIcon, famName, famFileInputRef)}
                          <div className="flex bg-slate-100 p-1 rounded-xl">
                            <button type="button" className={`flex-1 py-3 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all ${famType === 'EXPENSE' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`} onClick={() => setFamType('EXPENSE')}>Gasto</button>
                            <button type="button" className={`flex-1 py-3 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all ${famType === 'INCOME' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`} onClick={() => setFamType('INCOME')}>Ingreso</button>
                          </div>
                          <button onClick={() => {
                              if(!famName) return;
                              onUpdateData({ families: [...data.families, { id: generateId(), name: famName, type: famType, icon: famIcon }] });
                              resetForm();
                          }} className="w-full py-4.5 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest text-[9px] shadow-lg active:scale-95">Guardar Grupo</button>
                      </div>
                  </div>
                  <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-5">
                      <h3 className="text-lg font-black text-slate-800">Grupos Existentes</h3>
                      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                          {data.families.map(f => (
                              <div key={f.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center overflow-hidden p-1.5 shadow-sm">{(f.icon || '📂').startsWith('data:image') || (f.icon || '📂').startsWith('http') ? <img src={f.icon} className="w-full h-full object-contain" /> : <span className="text-xl">{f.icon || '📂'}</span>}</div>
                                    <span className="font-black text-slate-800 text-xs">{f.name}</span>
                                  </div>
                                  <span className={`text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${f.type === 'INCOME' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>{f.type === 'INCOME' ? 'Entrada' : 'Salida'}</span>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
              {renderImportSection('FAMILIES')}
          </div>
      )}

      {activeTab === 'CATEGORIES' && (
          <div className="grid grid-cols-1 gap-8 animate-in fade-in">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-6">
                      <h3 className="text-xl font-black text-slate-800 tracking-tight">Nuevo Detalle</h3>
                      <div className="space-y-5">
                          <select className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none appearance-none" value={catParent} onChange={e => setCatParent(e.target.value)}>
                              <option value="">Grupo...</option>
                              {data.families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                          </select>
                          <input type="text" placeholder="Nombre (Ej: Netflix)..." className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-indigo-500" value={catName} onChange={e => { setCatName(e.target.value); triggerWebSearch(e.target.value); }} />
                          {renderIconInput(catIcon, setCatIcon, catName, catFileInputRef)}
                          <button onClick={() => {
                              if(!catName || !catParent) return;
                              onUpdateData({ categories: [...data.categories, { id: generateId(), name: catName, familyId: catParent, icon: catIcon }] });
                              resetForm();
                          }} className="w-full py-4.5 bg-slate-950 text-white rounded-xl font-black uppercase tracking-widest text-[9px] shadow-lg active:scale-95 disabled:opacity-30">Guardar Detalle</button>
                      </div>
                  </div>
                  <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-8">
                      <h3 className="text-lg font-black text-slate-800">Mapa Jerárquico</h3>
                      <div className="space-y-6 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                          {data.families.map(fam => {
                            const famCats = data.categories.filter(c => c.familyId === fam.id);
                            if (famCats.length === 0) return null;
                            return (
                              <div key={fam.id} className="space-y-3">
                                <h4 className="text-[8px] font-black text-indigo-400 uppercase tracking-widest border-b border-indigo-50 pb-1.5">{fam.name}</h4>
                                <div className="grid grid-cols-1 gap-2.5">
                                  {famCats.map(c => (
                                    <div key={c.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-transparent">
                                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center overflow-hidden border border-slate-100 p-1.5 shadow-sm">{(c.icon || '🏷️').startsWith('data:image') || (c.icon || '🏷️').startsWith('http') ? <img src={c.icon} className="w-full h-full object-contain" /> : <span className="text-lg">{c.icon || '🏷️'}</span>}</div>
                                        <span className="font-bold text-slate-800 text-[10px]">{c.name}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                      </div>
                  </div>
              </div>
              {renderImportSection('CATEGORIES')}
          </div>
      )}
    </div>
  );
};
