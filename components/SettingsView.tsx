
import React, { useState, useRef, useEffect } from 'react';
import { AppState, Account, Family, Category } from '../types';
import { Trash2, Edit2, Upload, Layers, Tag, Wallet, Loader2, Globe, Search, ImageIcon, Zap, CheckCircle2, Maximize2, FileText, ClipboardList, Info, AlertCircle, FileSpreadsheet, MousePointer2 } from 'lucide-react';
import { searchInternetLogos } from '../services/iconService';
import * as XLSX from 'xlsx';

interface SettingsViewProps {
  data: AppState;
  onUpdateData: (newData: Partial<AppState>) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ data, onUpdateData }) => {
  const [activeTab, setActiveTab] = useState<'FAMILIES' | 'CATEGORIES' | 'ACCOUNTS'>('ACCOUNTS');
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  
  const [webLogos, setWebLogos] = useState<{url: string, source: string}[]>([]);
  const [isSearchingWeb, setIsSearchingWeb] = useState(false);
  const searchTimeoutRef = useRef<number | null>(null);

  // --- Helpers de Importación ---
  const processImportData = (rawLines: string[][], type: 'ACCOUNTS' | 'FAMILIES' | 'CATEGORIES') => {
    const newItems: any[] = [];
    
    rawLines.forEach(parts => {
      if (parts.length < 2 || !parts[0]) return;

      if (type === 'ACCOUNTS') {
        newItems.push({
          id: crypto.randomUUID(),
          name: parts[0],
          initialBalance: parseFloat(parts[1]) || 0,
          currency: 'EUR',
          icon: '🏦' // Icono por defecto, se cambia luego con la búsqueda visual
        });
      } else if (type === 'FAMILIES') {
        const flowType = parts[1].toUpperCase().includes('INGRESO') ? 'INCOME' : 'EXPENSE';
        newItems.push({
          id: crypto.randomUUID(),
          name: parts[0],
          type: flowType,
          icon: flowType === 'INCOME' ? '📈' : '📂'
        });
      } else if (type === 'CATEGORIES') {
        const familyName = parts[1];
        const family = data.families.find(f => f.name.toLowerCase() === familyName.toLowerCase());
        if (family) {
          newItems.push({
            id: crypto.randomUUID(),
            name: parts[0],
            familyId: family.id,
            icon: '🏷️'
          });
        }
      }
    });

    if (newItems.length > 0) {
      if (type === 'ACCOUNTS') onUpdateData({ accounts: [...data.accounts, ...newItems] });
      if (type === 'FAMILIES') onUpdateData({ families: [...data.families, ...newItems] });
      if (type === 'CATEGORIES') onUpdateData({ categories: [...data.categories, ...newItems] });
      
      setImportText('');
      setShowImport(false);
      alert(`${newItems.length} registros importados. Ahora puedes editarlos para asignarles un logo oficial.`);
    }
  };

  const handleTextImport = (type: 'ACCOUNTS' | 'FAMILIES' | 'CATEGORIES') => {
    const lines = importText.split('\n')
      .filter(l => l.trim().length > 0)
      .map(line => line.split(';').map(p => p.trim()));
    processImportData(lines, type);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>, type: 'ACCOUNTS' | 'FAMILIES' | 'CATEGORIES') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    reader.onload = (event) => {
      const data = event.target?.result;
      if (isExcel) {
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
        processImportData(json, type);
      } else {
        const text = data as string;
        setImportText(text);
      }
    };

    if (isExcel) reader.readAsBinaryString(file);
    else reader.readAsText(file);
  };

  // --- Lógica de Iconos Visuales ---
  const triggerWebSearch = (text: string) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!text || text.length < 3) {
        setWebLogos([]);
        return;
    }
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
          if (!response.ok) throw new Error();
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

  const [famId, setFamId] = useState<string | null>(null);
  const [famName, setFamName] = useState('');
  const [famType, setFamType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [famIcon, setFamIcon] = useState('📂');
  const famFileInputRef = useRef<HTMLInputElement>(null);

  const [catId, setCatId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');
  const [catParent, setCatParent] = useState('');
  const [catIcon, setCatIcon] = useState('🏷️');
  const catFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setWebLogos([]); setShowImport(false); setImportText(''); }, [activeTab]);

  const resetForm = () => {
      setAccId(null); setAccName(''); setAccBalance(''); setAccIcon('🏦');
      setFamId(null); setFamName(''); setFamIcon('📂');
      setCatId(null); setCatName(''); setCatIcon('🏷️'); setCatParent('');
      setWebLogos([]);
  };

  const renderImportSection = (type: 'ACCOUNTS' | 'FAMILIES' | 'CATEGORIES') => {
    const templates = {
      ACCOUNTS: "Nombre Cuenta; Saldo Inicial\nEjemplo: Banco Santander; 1500",
      FAMILIES: "Nombre Familia; Tipo (Gasto o Ingreso)\nEjemplo: Alimentación; Gasto",
      CATEGORIES: "Nombre Categoría; Nombre Familia Existente\nEjemplo: Mercadona; Alimentación"
    };

    return (
      <div className="mt-12 animate-in slide-in-from-top-8 duration-700">
        <button 
          onClick={() => setShowImport(!showImport)}
          className={`w-full flex items-center justify-between p-8 rounded-[3rem] border-4 transition-all ${showImport ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-50 hover:border-indigo-100 shadow-sm'}`}
        >
          <div className="flex items-center gap-6">
            <div className={`p-4 rounded-[1.5rem] ${showImport ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'bg-slate-100 text-slate-500'}`}>
              <ClipboardList size={28} />
            </div>
            <div className="text-left">
              <span className="block font-black text-slate-900 text-xl tracking-tighter">Importación Masiva (Excel / CSV)</span>
              <span className="block text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Sube archivos o pega datos separados por punto y coma</span>
            </div>
          </div>
          <div className={`p-3 rounded-2xl transition-transform duration-500 ${showImport ? 'rotate-180 bg-indigo-200 text-indigo-700' : 'bg-slate-50 text-slate-300'}`}>
            <Maximize2 size={24} />
          </div>
        </button>

        {showImport && (
          <div className="mt-6 p-10 bg-white border-4 border-indigo-50 rounded-[4rem] shadow-2xl space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div className="flex items-center gap-4 text-indigo-600">
                  <Info size={24} />
                  <span className="text-sm font-black uppercase tracking-[0.2em]">Guía de Formato Simplificado</span>
                </div>
                <div className="bg-slate-50/80 p-8 rounded-[2.5rem] border-2 border-slate-100 font-mono text-sm text-slate-700 whitespace-pre-wrap leading-relaxed shadow-inner">
                  {templates[type]}
                </div>
                <div className="flex items-center gap-4 p-6 bg-amber-50 rounded-[2rem] border-2 border-amber-100/50">
                  <AlertCircle size={24} className="text-amber-500 shrink-0" />
                  <p className="text-xs font-bold text-amber-800 uppercase leading-relaxed tracking-tight">
                    Los iconos se asignan automáticamente tras la importación usando la búsqueda visual en el panel de edición.
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 text-emerald-600">
                    <FileSpreadsheet size={24} />
                    <span className="text-sm font-black uppercase tracking-[0.2em]">Área de Datos</span>
                  </div>
                  <label className="group relative overflow-hidden cursor-pointer bg-emerald-600 text-white px-8 py-4 rounded-[1.5rem] text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 active:scale-95">
                    <input type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" onChange={(e) => handleFileImport(e, type)} />
                    Cargar Excel o CSV
                  </label>
                </div>
                <textarea 
                  className="w-full h-48 p-7 bg-slate-50 border-4 border-slate-100 rounded-[3rem] font-mono text-sm focus:ring-[16px] focus:ring-indigo-500/5 focus:border-indigo-400 outline-none transition-all resize-none shadow-inner"
                  placeholder="Pega aquí tus líneas (Ej: Amazon; Gasto)..."
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                ></textarea>
                <button 
                  disabled={!importText.trim()}
                  onClick={() => handleTextImport(type)}
                  className="w-full py-7 bg-indigo-600 text-white rounded-[2.5rem] font-black uppercase tracking-[0.3em] text-xs shadow-2xl shadow-indigo-100 disabled:opacity-30 disabled:grayscale transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  <Zap size={20} fill="currentColor" /> Procesar Datos Masivos
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderIconInput = (icon: string, setIcon: (s: string) => void, currentName: string, fileRef: React.RefObject<HTMLInputElement>) => {
    const isImage = icon.startsWith('data:image') || icon.startsWith('http');
    return (
      <div className="space-y-10 w-full">
          {/* Avatar Principal - Más grande y definido */}
          <div className="flex flex-col md:flex-row gap-10 items-center bg-slate-50/80 p-10 rounded-[4rem] border-4 border-white shadow-inner backdrop-blur-xl">
                <div 
                    className="relative group w-48 h-48 flex-shrink-0 flex items-center justify-center border-[12px] border-white rounded-[4rem] bg-white overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.15)] cursor-pointer transition-all hover:scale-110 active:scale-95 hover:rotate-2" 
                    onClick={() => fileRef.current?.click()}
                >
                    {isImage ? <img src={icon} className="w-full h-full object-contain p-8" alt="Logo Actual" /> : <span className="text-[7rem] leading-none">{icon}</span>}
                    <div className="absolute inset-0 bg-indigo-600/90 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-all duration-500">
                        <Upload size={56} />
                        <span className="text-xs font-black uppercase mt-3 tracking-widest">Subir Logo</span>
                    </div>
                </div>
                <div className="flex-1 space-y-8 text-center md:text-left">
                    <div className="space-y-2">
                        <h4 className="text-2xl font-black text-slate-900 tracking-tighter">Imagen Corporativa</h4>
                        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em]">Identidad oficial para "{currentName || 'Nuevo Registro'}"</p>
                    </div>
                    <div className="flex flex-wrap justify-center md:justify-start gap-4">
                        <button onClick={() => fileRef.current?.click()} className="px-10 py-6 bg-white border-4 border-slate-100 text-slate-700 rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center gap-4 hover:bg-slate-50 hover:border-indigo-200 transition-all shadow-md active:scale-95">
                            <ImageIcon size={24} className="text-indigo-500" /> Cargar Local
                        </button>
                        <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={async (e) => {
                            if (e.target.files && e.target.files[0]) {
                                const img = new Image();
                                img.src = URL.createObjectURL(e.target.files[0]);
                                img.onload = () => {
                                    const canvas = document.createElement('canvas');
                                    canvas.width = 128; canvas.height = 128;
                                    const ctx = canvas.getContext('2d');
                                    if(ctx) { ctx.drawImage(img, 0, 0, 128, 128); setIcon(canvas.toDataURL('image/png')); }
                                };
                            }
                        }} />
                        {isImage && <button onClick={() => setIcon('🏦')} className="text-rose-600 bg-rose-50/50 hover:bg-rose-100 font-black text-xs uppercase tracking-widest px-10 py-6 rounded-[2rem] border-4 border-transparent hover:border-rose-200 transition-all">Restablecer</button>}
                    </div>
                </div>
          </div>

          {/* Galería de Propuestas - AHORA REALMENTE GRANDE */}
          {(webLogos.length > 0 || isSearchingWeb) && (
            <div className="bg-white p-16 rounded-[5rem] border-[6px] border-indigo-50 shadow-[0_48px_96px_-24px_rgba(79,70,229,0.2)] animate-in fade-in slide-in-from-bottom-20 duration-1000">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10 mb-16">
                    <div className="flex items-center gap-8">
                          <div className="bg-indigo-600 p-6 rounded-[2rem] text-white shadow-2xl shadow-indigo-200 rotate-6"><Zap size={40} fill="currentColor" /></div>
                          <div>
                            <h4 className="text-4xl font-black text-indigo-950 tracking-tighter leading-none mb-3">Sincronización de Marca</h4>
                            <p className="text-lg text-indigo-400 font-bold uppercase tracking-[0.4em]">¿Cuál de estos es el logo correcto?</p>
                          </div>
                    </div>
                    {isSearchingWeb && (
                        <div className="flex items-center gap-6 bg-indigo-50 px-10 py-5 rounded-full border-4 border-indigo-100 animate-pulse">
                            <Loader2 size={32} className="animate-spin text-indigo-600"/>
                            <span className="text-sm font-black text-indigo-600 uppercase tracking-[0.3em]">Rastreando Web...</span>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-12">
                    {webLogos.map((logo, idx) => {
                        const isSelected = icon === logo.url;
                        return (
                            <div key={idx} className="flex flex-col gap-6 group">
                                <button 
                                    onClick={() => handleSelectWebLogo(logo.url, setIcon)} 
                                    className={`relative aspect-square bg-slate-50/20 rounded-[4.5rem] border-[6px] transition-all duration-700 flex items-center justify-center overflow-hidden p-16 hover:shadow-[0_64px_128px_-32px_rgba(79,70,229,0.3)] hover:-translate-y-6 ${isSelected ? 'border-indigo-600 ring-[24px] ring-indigo-50 shadow-2xl bg-white scale-105' : 'border-slate-50 hover:border-indigo-200 hover:bg-white'}`}
                                >
                                    <img src={logo.url} alt="Candidate Logo" className="w-full h-full object-contain transition-all duration-1000 group-hover:scale-150 group-hover:rotate-3" loading="lazy" />
                                    
                                    <div className="absolute inset-0 bg-indigo-900/0 group-hover:bg-indigo-900/5 transition-colors duration-500 pointer-events-none" />
                                    
                                    {isSelected && (
                                        <div className="absolute top-10 right-10 bg-indigo-600 text-white p-4 rounded-[2rem] shadow-2xl animate-in zoom-in-75">
                                            <CheckCircle2 size={32} />
                                        </div>
                                    )}
                                    
                                    <div className="absolute bottom-10 inset-x-10 opacity-0 group-hover:opacity-100 translate-y-6 group-hover:translate-y-0 transition-all duration-500 text-center">
                                        <span className="bg-white/90 backdrop-blur-xl text-indigo-900 px-8 py-4 rounded-full text-xs font-black uppercase tracking-widest shadow-2xl border border-indigo-100">Seleccionar este</span>
                                    </div>
                                </button>
                                <div className="px-10 flex flex-col gap-1 items-center">
                                    <span className="text-xl font-black text-slate-800 tracking-tight uppercase group-hover:text-indigo-600 transition-colors">{logo.source.split('.')[0]}</span>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{logo.source}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
          )}
      </div>
    );
  };

  return (
    <div className="space-y-16 pb-32">
      <div className="flex flex-col gap-4">
        <h2 className="text-5xl font-black text-slate-900 tracking-tighter">Centro de Activos</h2>
        <p className="text-slate-400 text-xl font-medium max-w-2xl">Organiza tus finanzas con una estética impecable mediante importación inteligente y detección visual de marcas.</p>
      </div>

      <div className="flex bg-slate-100/60 p-3 rounded-[3.5rem] shadow-inner border-2 border-slate-200/50 overflow-x-auto scrollbar-hide">
        <button className={`flex-1 flex items-center justify-center gap-5 px-12 py-8 font-black text-sm uppercase tracking-[0.3em] rounded-[3rem] transition-all whitespace-nowrap ${activeTab === 'ACCOUNTS' ? 'bg-indigo-600 text-white shadow-[0_32px_64px_-16px_rgba(79,70,229,0.5)]' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => setActiveTab('ACCOUNTS')}><Wallet size={28} /> Cuentas</button>
        <button className={`flex-1 flex items-center justify-center gap-5 px-12 py-8 font-black text-sm uppercase tracking-[0.3em] rounded-[3rem] transition-all whitespace-nowrap ${activeTab === 'FAMILIES' ? 'bg-indigo-600 text-white shadow-[0_32px_64px_-16px_rgba(79,70,229,0.5)]' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => setActiveTab('FAMILIES')}><Layers size={28} /> Familias</button>
        <button className={`flex-1 flex items-center justify-center gap-5 px-12 py-8 font-black text-sm uppercase tracking-[0.3em] rounded-[3rem] transition-all whitespace-nowrap ${activeTab === 'CATEGORIES' ? 'bg-indigo-600 text-white shadow-[0_32px_64px_-16px_rgba(79,70,229,0.5)]' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => setActiveTab('CATEGORIES')}><Tag size={28} /> Categorías</button>
      </div>

      {activeTab === 'ACCOUNTS' && (
          <div className="grid grid-cols-1 gap-16 animate-in fade-in duration-1000">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-16">
                  <div className="bg-white p-14 rounded-[4.5rem] shadow-sm border border-slate-100 h-fit space-y-14">
                      <div className="flex items-center justify-between">
                        <div className="space-y-3">
                            <h3 className="text-4xl font-black text-slate-900 tracking-tighter">{accId ? 'Redefinir Cuenta' : 'Vincular Capital'}</h3>
                            <p className="text-sm text-slate-400 font-bold uppercase tracking-[0.3em]">Activos maestros de tu patrimonio</p>
                        </div>
                        <div className="p-8 bg-indigo-50 rounded-[3rem] text-indigo-600 shadow-xl shadow-indigo-100/50"><Wallet size={48}/></div>
                      </div>
                      <div className="space-y-12">
                          <div className="space-y-5">
                            <label className="text-xs font-black text-indigo-500 uppercase tracking-[0.5em] ml-4">Nombre del Banco / Entidad</label>
                            <div className="relative group">
                                <Search className="absolute left-10 top-1/2 -translate-y-1/2 text-indigo-300 group-focus-within:text-indigo-600 transition-colors" size={32} />
                                <input type="text" placeholder="Ej: Santander, BBVA, Revolut..." className="w-full pl-24 pr-12 py-10 bg-indigo-50/20 border-4 border-indigo-100/50 text-indigo-950 font-black rounded-[3.5rem] focus:ring-[24px] focus:ring-indigo-500/5 focus:border-indigo-500 outline-none transition-all shadow-inner text-4xl" value={accName} onChange={e => { setAccName(e.target.value); triggerWebSearch(e.target.value); }} />
                            </div>
                          </div>
                          {renderIconInput(accIcon, setAccIcon, accName, accFileInputRef)}
                          <div className="space-y-5">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-[0.5em] ml-4">Saldo Inicial (€)</label>
                            <input type="number" placeholder="0.00" className="w-full px-12 py-10 bg-slate-50 border-4 border-slate-100 rounded-[3.5rem] font-black text-4xl outline-none focus:border-indigo-600 focus:bg-white transition-all" value={accBalance} onChange={e => setAccBalance(e.target.value)} />
                          </div>
                          <div className="flex gap-8 pt-6">
                            {accId && <button onClick={resetForm} className="flex-1 py-10 border-4 border-slate-100 rounded-[3.5rem] hover:bg-slate-50 font-black text-xs uppercase tracking-widest transition-all">Cancelar</button>}
                            <button onClick={() => {
                                if(!accName) return;
                                const balanceVal = parseFloat(accBalance) || 0;
                                if (accId) {
                                    const updated = data.accounts.map(a => a.id === accId ? { ...a, name: accName, initialBalance: balanceVal, icon: accIcon } : a);
                                    onUpdateData({ accounts: updated });
                                } else {
                                    const newAcc: Account = { id: crypto.randomUUID(), name: accName, initialBalance: balanceVal, currency: 'EUR', icon: accIcon };
                                    onUpdateData({ accounts: [...data.accounts, newAcc] });
                                }
                                resetForm();
                            }} className="flex-[2] py-10 bg-slate-950 text-white rounded-[3.5rem] font-black uppercase tracking-[0.4em] text-sm shadow-[0_40px_80px_-20px_rgba(0,0,0,0.2)] active:scale-95 transition-all">{accId ? 'Confirmar Cambios' : 'Vincular Activo'}</button>
                          </div>
                      </div>
                  </div>
                  <div className="bg-white p-14 rounded-[4.5rem] shadow-sm border border-slate-100">
                      <h3 className="text-3xl font-black mb-14 text-slate-900 flex items-center gap-6">Cartera Global <span className="bg-indigo-50 text-indigo-600 px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest">{data.accounts.length}</span></h3>
                      <div className="space-y-10 max-h-[1100px] overflow-y-auto pr-8 custom-scrollbar">
                          {data.accounts.map(acc => (
                              <div key={acc.id} className="flex justify-between items-center p-10 bg-slate-50/40 rounded-[4rem] group border-4 border-transparent transition-all hover:bg-white hover:border-indigo-100 hover:shadow-2xl">
                                  <div className="flex items-center gap-10">
                                      <div className="w-32 h-32 rounded-[3rem] bg-white shadow-2xl flex items-center justify-center overflow-hidden border-4 border-slate-50 p-6 transition-transform group-hover:scale-110">
                                        {acc.icon.startsWith('data:image') || acc.icon.startsWith('http') ? <img src={acc.icon} className="w-full h-full object-contain" alt={acc.name}/> : <span className="text-7xl">{acc.icon}</span>}
                                      </div>
                                      <div>
                                          <span className="font-black text-slate-900 block text-4xl tracking-tighter mb-2">{acc.name}</span>
                                          <span className="text-lg font-black text-indigo-500 uppercase tracking-[0.2em]">{acc.initialBalance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                                      </div>
                                  </div>
                                  <div className="flex gap-4 opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100">
                                      <button onClick={() => { setAccId(acc.id); setAccName(acc.name); setAccBalance(acc.initialBalance.toString()); setAccIcon(acc.icon); }} className="p-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-[2.5rem] transition-all"><Edit2 size={36}/></button>
                                      <button onClick={() => onUpdateData({accounts: data.accounts.filter(a=>a.id!==acc.id)})} className="p-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-[2.5rem] transition-all"><Trash2 size={36}/></button>
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
          <div className="grid grid-cols-1 gap-16 animate-in fade-in duration-1000">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-16">
                  <div className="bg-white p-14 rounded-[4.5rem] shadow-sm border border-slate-100 h-fit space-y-14">
                      <h3 className="text-4xl font-black text-slate-900 tracking-tighter">Gestor de Agrupadores</h3>
                      <div className="space-y-12">
                          <div className="space-y-5">
                            <label className="text-xs font-black text-indigo-500 uppercase tracking-[0.5em] ml-4">Nombre de la Familia</label>
                            <input type="text" placeholder="Ej: Vivienda, Ocio..." className="w-full px-12 py-10 bg-indigo-50/20 border-4 border-indigo-100 text-indigo-950 font-black rounded-[3.5rem] outline-none text-4xl" value={famName} onChange={e => { setFamName(e.target.value); triggerWebSearch(e.target.value); }} />
                          </div>
                          {renderIconInput(famIcon, setFamIcon, famName, famFileInputRef)}
                          <div className="space-y-5">
                              <label className="text-xs font-black text-slate-400 uppercase tracking-[0.5em] ml-4">Tipo de Flujo Financiero</label>
                              <div className="flex bg-slate-100 p-4 rounded-[3.5rem]">
                                <button type="button" className={`flex-1 py-10 text-xs font-black uppercase tracking-widest rounded-[3rem] transition-all ${famType === 'EXPENSE' ? 'bg-white text-rose-600 shadow-2xl' : 'text-slate-500'}`} onClick={() => setFamType('EXPENSE')}>🔴 Gasto</button>
                                <button type="button" className={`flex-1 py-10 text-xs font-black uppercase tracking-widest rounded-[3rem] transition-all ${famType === 'INCOME' ? 'bg-white text-emerald-600 shadow-2xl' : 'text-slate-500'}`} onClick={() => setFamType('INCOME')}>🟢 Ingreso</button>
                              </div>
                          </div>
                          <button onClick={() => {
                              if(!famName) return;
                              const newFam: Family = { id: crypto.randomUUID(), name: famName, type: famType, icon: famIcon };
                              onUpdateData({ families: [...data.families, newFam] });
                              resetForm();
                          }} className="w-full py-10 bg-slate-950 text-white rounded-[3.5rem] font-black uppercase tracking-[0.4em] text-sm shadow-2xl transition-all active:scale-95">Guardar Familia</button>
                      </div>
                  </div>
                  <div className="bg-white p-14 rounded-[4.5rem] shadow-sm border border-slate-100">
                      <h3 className="text-3xl font-black mb-14 text-slate-900">Estructura de Grupos</h3>
                      <div className="space-y-10 max-h-[1100px] overflow-y-auto pr-8 custom-scrollbar">
                          {data.families.map(f => (
                              <div key={f.id} className="flex justify-between items-center p-10 bg-slate-50/40 rounded-[4rem] group border-4 border-transparent transition-all hover:bg-white hover:border-indigo-100">
                                  <div className="flex items-center gap-10">
                                    <div className="w-28 h-28 rounded-[2.5rem] bg-white shadow-2xl flex items-center justify-center overflow-hidden p-6">{f.icon.startsWith('data:image') || f.icon.startsWith('http') ? <img src={f.icon} className="w-full h-full object-contain" alt={f.name}/> : <span className="text-6xl">{f.icon}</span>}</div>
                                    <span className="font-black text-slate-900 block text-4xl tracking-tighter">{f.name}</span>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
              {renderImportSection('FAMILIES')}
          </div>
      )}

      {activeTab === 'CATEGORIES' && (
          <div className="grid grid-cols-1 gap-16 animate-in fade-in duration-1000">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-16">
                  <div className="bg-white p-14 rounded-[4.5rem] shadow-sm border border-slate-100 h-fit space-y-14">
                      <h3 className="text-4xl font-black text-slate-900 tracking-tighter">Categorización Detallada</h3>
                      <div className="space-y-12">
                          <div className="space-y-5">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-[0.5em] ml-4">Familia de Origen</label>
                            <select className="w-full px-12 py-10 border-4 border-slate-100 rounded-[3.5rem] bg-white font-black outline-none focus:border-indigo-600 appearance-none text-2xl shadow-sm cursor-pointer" value={catParent} onChange={e => setCatParent(e.target.value)}>
                                <option value="">Elegir Familia...</option>
                                {data.families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                          </div>
                          <div className="space-y-5">
                            <label className="text-xs font-black text-indigo-500 uppercase tracking-[0.5em] ml-4">Nombre de la Marca / Detalle</label>
                            <div className="relative group">
                                <Search className="absolute left-10 top-1/2 -translate-y-1/2 text-indigo-300 group-focus-within:text-indigo-600 transition-colors" size={32} />
                                <input type="text" placeholder="Ej: Netflix, Amazon, Zara..." className="w-full pl-24 pr-12 py-10 bg-indigo-50/20 border-4 border-indigo-100 text-indigo-950 font-black rounded-[3.5rem] outline-none text-4xl disabled:opacity-30" value={catName} onChange={e => { setCatName(e.target.value); triggerWebSearch(e.target.value); }} disabled={!catParent} />
                            </div>
                          </div>
                          {renderIconInput(catIcon, setCatIcon, catName, catFileInputRef)}
                          <button onClick={() => {
                              if(!catName || !catParent) return;
                              const newCat: Category = { id: crypto.randomUUID(), name: catName, familyId: catParent, icon: catIcon };
                              onUpdateData({ categories: [...data.categories, newCat] });
                              resetForm();
                          }} disabled={!catParent} className="w-full py-10 bg-slate-950 text-white rounded-[3.5rem] font-black uppercase tracking-[0.4em] text-sm shadow-2xl active:scale-95 disabled:opacity-30 transition-all">Vincular Categoría</button>
                      </div>
                  </div>
                  <div className="bg-white p-14 rounded-[4.5rem] shadow-sm border border-slate-100">
                      <h3 className="text-3xl font-black mb-14 text-slate-900">Mapa de Detalles</h3>
                      <div className="space-y-16 max-h-[1100px] overflow-y-auto pr-8 custom-scrollbar">
                          {data.families.map(fam => {
                            const famCats = data.categories.filter(c => c.familyId === fam.id);
                            if (famCats.length === 0) return null;
                            return (
                              <div key={fam.id} className="space-y-10">
                                <h4 className="text-sm font-black text-indigo-400 uppercase tracking-[0.6em] border-b-[6px] border-indigo-50 pb-10">{fam.name}</h4>
                                <div className="grid grid-cols-1 gap-8">
                                  {famCats.map(c => (
                                    <div key={c.id} className="flex justify-between items-center p-10 bg-slate-50/40 rounded-[4rem] border-4 border-slate-100 hover:bg-white hover:shadow-2xl transition-all">
                                        <div className="flex items-center gap-10">
                                            <div className="w-24 h-24 rounded-[2rem] bg-white flex items-center justify-center overflow-hidden border-4 border-slate-50 p-5 shadow-xl">{c.icon.startsWith('data:image') || c.icon.startsWith('http') ? <img src={c.icon} className="w-full h-full object-contain" alt={c.name}/> : <span className="text-5xl">{c.icon}</span>}</div>
                                            <span className="font-black text-slate-800 text-3xl tracking-tighter">{c.name}</span>
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
              {renderImportSection('CATEGORIES')}
          </div>
      )}
    </div>
  );
};
