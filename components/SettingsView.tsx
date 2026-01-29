
import React, { useState, useRef, useEffect } from 'react';
import { AppState, Account, Family, Category } from '../types';
import { Trash2, Edit2, Upload, Layers, Tag, Wallet, Loader2, Globe, ExternalLink, Search, ImageIcon, Zap, CheckCircle2, ImageOff, MousePointer2, Maximize2 } from 'lucide-react';
import { searchInternetLogos } from '../services/iconService';

interface SettingsViewProps {
  data: AppState;
  onUpdateData: (newData: Partial<AppState>) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ data, onUpdateData }) => {
  const [activeTab, setActiveTab] = useState<'FAMILIES' | 'CATEGORIES' | 'ACCOUNTS'>('ACCOUNTS');
  
  const [webLogos, setWebLogos] = useState<{url: string, source: string}[]>([]);
  const [isSearchingWeb, setIsSearchingWeb] = useState(false);
  const searchTimeoutRef = useRef<number | null>(null);

  const resizeImage = (file: File): Promise<string> => {
      return new Promise((resolve) => {
          const img = new Image();
          img.src = URL.createObjectURL(file);
          img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = 128; 
              canvas.height = 128; 
              const ctx = canvas.getContext('2d');
              if(ctx) {
                  ctx.drawImage(img, 0, 0, 128, 128);
                  resolve(canvas.toDataURL('image/png'));
              }
          }
      });
  };

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
      } catch (e) {
          setIcon(url); 
      }
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

  useEffect(() => {
    setWebLogos([]);
  }, [activeTab, accId, famId, catId]);

  const resetForm = () => {
      setAccId(null); setAccName(''); setAccBalance(''); setAccIcon('🏦');
      setFamId(null); setFamName(''); setFamIcon('📂');
      setCatId(null); setCatName(''); setCatIcon('🏷️'); setCatParent('');
      setWebLogos([]);
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>, setIcon: (s: string) => void) => {
      if (e.target.files && e.target.files[0]) {
          const base64 = await resizeImage(e.target.files[0]);
          setIcon(base64);
      }
  };

  // Genera un gradiente estético basado en el nombre de la fuente para placeholders
  const getPlaceholderStyle = (name: string) => {
    const colors = [
        'from-indigo-500 to-purple-500',
        'from-emerald-500 to-teal-500',
        'from-blue-500 to-indigo-600',
        'from-rose-500 to-pink-500',
        'from-amber-500 to-orange-500'
    ];
    const index = name.length % colors.length;
    return colors[index];
  };

  const renderIconInput = (
    icon: string, 
    setIcon: (s: string) => void, 
    currentName: string, 
    fileRef: React.RefObject<HTMLInputElement>
  ) => {
      const isImage = icon.startsWith('data:image') || icon.startsWith('http');
      return (
          <div className="space-y-8 w-full">
              <div className="flex flex-col sm:flex-row gap-8 items-center bg-slate-50/80 p-8 rounded-[3rem] border border-slate-200/60 backdrop-blur-md">
                   <div className="relative group w-40 h-40 flex-shrink-0 flex items-center justify-center border-8 border-white rounded-[3.5rem] bg-white overflow-hidden shadow-2xl cursor-pointer transition-all hover:scale-105 active:scale-95 hover:rotate-2" onClick={() => fileRef.current?.click()}>
                       {isImage ? <img src={icon} className="w-full h-full object-contain p-6" /> : <span className="text-8xl">{icon}</span>}
                       <div className="absolute inset-0 bg-indigo-600/80 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-all duration-300">
                           <Upload size={48} />
                           <span className="text-[10px] font-black uppercase mt-2">Cambiar</span>
                       </div>
                   </div>
                   
                   <div className="flex-1 space-y-6 text-center sm:text-left">
                       <div>
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] block mb-4">Avatar del Activo</label>
                            <div className="flex flex-wrap justify-center sm:justify-start gap-4">
                                <button 
                                    onClick={() => fileRef.current?.click()}
                                    className="px-8 py-5 bg-white border-2 border-slate-100 text-slate-700 rounded-3xl font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-slate-50 hover:border-indigo-200 transition-all shadow-sm active:scale-95"
                                >
                                    <ImageIcon size={20} className="text-indigo-500" /> Cargar Local
                                </button>
                                <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={(e) => handleIconUpload(e, setIcon)} />
                                {isImage && (
                                    <button onClick={() => setIcon('🏦')} className="text-rose-500 bg-rose-50/50 hover:bg-rose-100 font-black text-xs uppercase tracking-widest px-8 py-5 rounded-3xl transition-colors">Restablecer</button>
                                )}
                            </div>
                       </div>
                   </div>
              </div>

              {/* Panel de Propuestas Gigantes */}
              {(webLogos.length > 0 || isSearchingWeb) && (
                <div className="bg-white p-12 rounded-[4rem] border-4 border-indigo-50 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] animate-in fade-in slide-in-from-bottom-12 duration-700">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-12">
                        <div className="flex items-center gap-6">
                             <div className="bg-indigo-600 p-4 rounded-[1.5rem] text-white shadow-2xl shadow-indigo-200 rotate-3">
                                <Zap size={28} fill="currentColor" />
                             </div>
                             <div>
                                <h4 className="text-2xl font-black text-indigo-950 tracking-tighter leading-none mb-2">
                                    Catálogo de Identidad Web
                                </h4>
                                <p className="text-xs text-indigo-400 font-bold uppercase tracking-[0.3em]">Resultados de alta definición para "{currentName}"</p>
                             </div>
                        </div>
                        {isSearchingWeb ? (
                            <div className="flex items-center gap-4 bg-indigo-50/50 px-6 py-3 rounded-full border border-indigo-100 animate-pulse">
                                <Loader2 size={20} className="animate-spin text-indigo-600"/>
                                <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">Escaneando la red...</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 text-emerald-600 bg-emerald-50 px-6 py-3 rounded-full border border-emerald-100 shadow-sm">
                                <CheckCircle2 size={20} />
                                <span className="text-xs font-black uppercase tracking-widest">Sincronización Completa</span>
                            </div>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
                        {webLogos.map((logo, idx) => {
                            const isSelected = icon === logo.url;
                            return (
                                <div key={idx} className="flex flex-col gap-5 group">
                                    <button 
                                        onClick={() => handleSelectWebLogo(logo.url, setIcon)}
                                        className={`relative aspect-square bg-slate-50/30 rounded-[3.5rem] border-4 transition-all duration-500 flex items-center justify-center overflow-hidden p-12 hover:shadow-[0_40px_80px_-20px_rgba(79,70,229,0.2)] hover:-translate-y-4 ${isSelected ? 'border-indigo-600 ring-[20px] ring-indigo-50 shadow-2xl bg-white scale-105' : 'border-slate-100 hover:border-indigo-300 hover:bg-white'}`}
                                    >
                                        <img 
                                            src={logo.url} 
                                            alt="Candidate Logo" 
                                            className="w-full h-full object-contain transition-all duration-700 group-hover:scale-125 group-hover:rotate-1" 
                                            loading="lazy"
                                            onError={(e) => {
                                                const parent = e.currentTarget.parentElement;
                                                if(parent) {
                                                    e.currentTarget.style.display = 'none';
                                                    const placeholder = document.createElement('div');
                                                    const gradClass = getPlaceholderStyle(logo.source);
                                                    placeholder.className = `w-full h-full rounded-[2rem] bg-gradient-to-br ${gradClass} flex items-center justify-center text-6xl font-black text-white uppercase shadow-inner`;
                                                    placeholder.innerText = logo.source.charAt(0);
                                                    parent.appendChild(placeholder);
                                                }
                                            }}
                                        />
                                        
                                        {/* Overlay de selección e info */}
                                        <div className="absolute inset-0 bg-indigo-900/0 group-hover:bg-indigo-900/5 transition-colors duration-500 pointer-events-none" />
                                        
                                        <div className="absolute top-6 right-6 flex gap-2">
                                            {isSelected && (
                                                <div className="bg-indigo-600 text-white p-2.5 rounded-2xl shadow-2xl animate-in zoom-in-50">
                                                    <CheckCircle2 size={20} />
                                                </div>
                                            )}
                                            <div className="bg-white/90 backdrop-blur-md text-indigo-600 p-2.5 rounded-2xl shadow-xl opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                                                <Maximize2 size={20} />
                                            </div>
                                        </div>
                                    </button>
                                    
                                    <div className="px-6 flex justify-between items-center">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-slate-800 uppercase tracking-tight truncate max-w-[150px]">
                                                {logo.source.split('.')[0]}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                {logo.source}
                                            </span>
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                                            <MousePointer2 size={16} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    
                    <div className="mt-16 p-8 bg-indigo-50/30 rounded-[2.5rem] border border-indigo-100/50 flex flex-col sm:flex-row items-center justify-center gap-6 text-center sm:text-left">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-indigo-600 shadow-md">
                            <Globe size={28} />
                        </div>
                        <div>
                            <p className="text-sm font-black text-indigo-900 uppercase tracking-tight">¿No encuentras el logo correcto?</p>
                            <p className="text-xs text-indigo-400 font-bold">Prueba a escribir el nombre oficial de la marca o su página web completa.</p>
                        </div>
                    </div>
                </div>
              )}
          </div>
      )
  }

  return (
    <div className="space-y-12 pb-20">
      <div className="flex flex-col gap-3">
        <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Gestión de Identidad</h2>
        <p className="text-slate-400 text-lg font-medium">Define la estética de tu contabilidad con activos visuales rastreados por IA.</p>
      </div>

      <div className="flex bg-slate-100/60 p-2.5 rounded-[3rem] shadow-inner border border-slate-200/50 overflow-x-auto scrollbar-hide">
        <button className={`flex-1 flex items-center justify-center gap-4 px-10 py-7 font-black text-xs uppercase tracking-[0.25em] rounded-[2.5rem] transition-all whitespace-nowrap ${activeTab === 'ACCOUNTS' ? 'bg-indigo-600 text-white shadow-[0_20px_40px_-10px_rgba(79,70,229,0.4)]' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => setActiveTab('ACCOUNTS')}><Wallet size={24} /> Cuentas</button>
        <button className={`flex-1 flex items-center justify-center gap-4 px-10 py-7 font-black text-xs uppercase tracking-[0.25em] rounded-[2.5rem] transition-all whitespace-nowrap ${activeTab === 'FAMILIES' ? 'bg-indigo-600 text-white shadow-[0_20px_40px_-10px_rgba(79,70,229,0.4)]' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => setActiveTab('FAMILIES')}><Layers size={24} /> Familias</button>
        <button className={`flex-1 flex items-center justify-center gap-4 px-10 py-7 font-black text-xs uppercase tracking-[0.25em] rounded-[2.5rem] transition-all whitespace-nowrap ${activeTab === 'CATEGORIES' ? 'bg-indigo-600 text-white shadow-[0_20px_40px_-10px_rgba(79,70,229,0.4)]' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => setActiveTab('CATEGORIES')}><Tag size={24} /> Categorías</button>
      </div>

      {activeTab === 'ACCOUNTS' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-12 animate-in fade-in zoom-in-95 duration-700">
              <div className="bg-white p-12 rounded-[4rem] shadow-sm border border-slate-100 h-fit space-y-12">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <h3 className="text-3xl font-black text-slate-800 tracking-tighter">{accId ? 'Editar Activo' : 'Vincular Cuenta'}</h3>
                        <p className="text-sm text-slate-400 font-bold uppercase tracking-[0.2em]">Depósito Maestro de Capital</p>
                    </div>
                    <div className="p-6 bg-indigo-50 rounded-[2.5rem] text-indigo-600 shadow-xl shadow-indigo-100/50"><Wallet size={40}/></div>
                  </div>

                  <div className="space-y-10">
                      <div className="space-y-4">
                        <label className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.4em] ml-3">Entidad Financiera o Alias</label>
                        <div className="relative group">
                            <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-indigo-300 group-focus-within:text-indigo-600 transition-colors" size={30} />
                            <input 
                                type="text" placeholder="Ej: BBVA, Revolut, Efectivo..." 
                                className="w-full pl-20 pr-10 py-8 bg-indigo-50/20 border-2 border-indigo-100/50 text-indigo-950 font-black placeholder:text-indigo-200 rounded-[3rem] focus:ring-[16px] focus:ring-indigo-500/5 focus:border-indigo-500 outline-none transition-all shadow-inner text-3xl" 
                                value={accName} 
                                onChange={e => { setAccName(e.target.value); triggerWebSearch(e.target.value); }} 
                            />
                        </div>
                      </div>
                      
                      {renderIconInput(accIcon, setAccIcon, accName, accFileInputRef)}

                      <div className="space-y-4">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] ml-3">Balance Inicial</label>
                        <input type="number" placeholder="0.00" className="w-full px-10 py-8 bg-slate-50 border-2 border-slate-100 rounded-[3rem] focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-600 outline-none font-black text-3xl" value={accBalance} onChange={e => setAccBalance(e.target.value)} />
                      </div>
                      
                      <div className="flex gap-6 pt-8">
                        {accId && <button onClick={resetForm} className="flex-1 py-8 border-2 border-slate-100 rounded-[3rem] hover:bg-slate-50 font-black text-xs uppercase tracking-widest transition-all active:scale-95">Anular</button>}
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
                        }} className="flex-[2] py-8 bg-slate-950 text-white rounded-[3rem] hover:bg-black font-black uppercase tracking-[0.3em] text-sm shadow-2xl shadow-slate-300 transition-all active:scale-95">{accId ? 'Actualizar' : 'Registrar'}</button>
                      </div>
                  </div>
              </div>

              <div className="bg-white p-12 rounded-[4rem] shadow-sm border border-slate-100">
                  <h3 className="text-2xl font-black mb-12 flex items-center gap-5 text-slate-800">Cartera Activa <span className="text-xs bg-indigo-50 px-6 py-3 rounded-full text-indigo-600 uppercase tracking-widest shadow-sm font-black">{data.accounts.length}</span></h3>
                  <div className="space-y-8 max-h-[1000px] overflow-y-auto pr-6 custom-scrollbar">
                      {data.accounts.map(acc => (
                          <div key={acc.id} className="flex justify-between items-center p-8 bg-slate-50/40 rounded-[3.5rem] group border border-slate-100/50 transition-all hover:bg-white hover:shadow-2xl hover:-translate-y-2">
                              <div className="flex items-center gap-8">
                                  <div className="w-28 h-28 rounded-[2.5rem] bg-white shadow-xl flex items-center justify-center overflow-hidden border-2 border-slate-50 p-5 transition-transform group-hover:scale-110">
                                    {acc.icon.startsWith('data:image') || acc.icon.startsWith('http') ? <img src={acc.icon} className="w-full h-full object-contain" alt={acc.name}/> : <span className="text-6xl">{acc.icon}</span>}
                                  </div>
                                  <div>
                                      <span className="font-black text-slate-900 block text-3xl tracking-tighter mb-2">{acc.name}</span>
                                      <span className="text-base font-black text-indigo-500 uppercase tracking-widest">{acc.initialBalance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                                  </div>
                              </div>
                              <div className="flex gap-4 opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100">
                                  <button onClick={() => { setAccId(acc.id); setAccName(acc.name); setAccBalance(acc.initialBalance.toString()); setAccIcon(acc.icon); }} className="p-6 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-[2rem] transition-all"><Edit2 size={32}/></button>
                                  <button onClick={() => onUpdateData({accounts: data.accounts.filter(a=>a.id!==acc.id)})} className="p-6 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-[2rem] transition-all"><Trash2 size={32}/></button>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* Secciones FAMILIES y CATEGORIES también disfrutan del renderIconInput mejorado */}
      {activeTab === 'FAMILIES' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-12 animate-in fade-in zoom-in-95 duration-700">
              <div className="bg-white p-12 rounded-[4rem] shadow-sm border border-slate-100 h-fit space-y-12">
                  <h3 className="text-3xl font-black text-slate-800 tracking-tighter">Maestro de Grupos</h3>
                  <div className="space-y-10">
                      <div className="space-y-4">
                        <label className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.4em] ml-3">Nombre del Agrupador</label>
                        <div className="relative group">
                            <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-indigo-300 group-focus-within:text-indigo-600 transition-colors" size={30} />
                            <input 
                                type="text" placeholder="Vivienda, Ocio, Compras..." 
                                className="w-full pl-20 pr-10 py-8 bg-indigo-50/20 border-2 border-indigo-100 text-indigo-950 font-black placeholder:text-indigo-200 rounded-[3rem] focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none transition-all shadow-inner text-3xl" 
                                value={famName} 
                                onChange={e => { setFamName(e.target.value); triggerWebSearch(e.target.value); }} 
                            />
                        </div>
                      </div>
                      {renderIconInput(famIcon, setFamIcon, famName, famFileInputRef)}
                      <div className="space-y-4">
                          <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] ml-3">Tipo de Flujo</label>
                          <div className="flex bg-slate-100 p-3 rounded-[3rem]">
                            <button type="button" className={`flex-1 py-7 text-xs font-black uppercase tracking-widest rounded-[2.5rem] transition-all ${famType === 'EXPENSE' ? 'bg-white text-rose-600 shadow-xl' : 'text-slate-500'}`} onClick={() => setFamType('EXPENSE')}>Gasto 🔴</button>
                            <button type="button" className={`flex-1 py-7 text-xs font-black uppercase tracking-widest rounded-[2.5rem] transition-all ${famType === 'INCOME' ? 'bg-white text-emerald-600 shadow-xl' : 'text-slate-500'}`} onClick={() => setFamType('INCOME')}>Ingreso 🟢</button>
                          </div>
                      </div>
                      <div className="flex gap-6 pt-8">
                        <button onClick={() => {
                            if(!famName) return;
                            const newFam: Family = { id: crypto.randomUUID(), name: famName, type: famType, icon: famIcon };
                            onUpdateData({ families: [...data.families, newFam] });
                            resetForm();
                        }} className="w-full py-8 bg-slate-950 text-white rounded-[3rem] hover:bg-black font-black uppercase tracking-[0.3em] text-sm shadow-2xl transition-all active:scale-95">Almacenar Familia</button>
                      </div>
                  </div>
              </div>
              <div className="bg-white p-12 rounded-[4rem] shadow-sm border border-slate-100">
                  <h3 className="text-2xl font-black mb-12">Estructuras Maestras</h3>
                  <div className="space-y-8 max-h-[1000px] overflow-y-auto pr-6 custom-scrollbar">
                      {data.families.map(f => (
                          <div key={f.id} className="flex justify-between items-center p-8 bg-slate-50/40 rounded-[3.5rem] group border border-slate-100 transition-all hover:bg-white hover:shadow-2xl">
                              <div className="flex items-center gap-8">
                                <div className="w-28 h-28 rounded-[2.5rem] bg-white shadow-xl flex items-center justify-center overflow-hidden border border-slate-50 p-5">
                                  {f.icon.startsWith('data:image') || f.icon.startsWith('http') ? <img src={f.icon} className="w-full h-full object-contain" alt={f.name}/> : <span className="text-6xl">{f.icon}</span>}
                                </div>
                                <div>
                                    <span className="font-black text-slate-900 block text-3xl tracking-tighter mb-2">{f.name}</span>
                                    <span className={`text-xs font-black uppercase tracking-widest ${f.type === 'INCOME' ? 'text-emerald-500' : 'text-rose-500'}`}>{f.type === 'INCOME' ? 'Ingreso' : 'Gasto'}</span>
                                </div>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'CATEGORIES' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-12 animate-in fade-in zoom-in-95 duration-700">
               <div className="bg-white p-12 rounded-[4rem] shadow-sm border border-slate-100 h-fit space-y-12">
                  <h3 className="text-3xl font-black text-slate-800 tracking-tighter">Detalle de Gasto</h3>
                  <div className="space-y-10">
                      <div className="space-y-4">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] ml-3">Familia de Origen</label>
                        <select className="w-full px-10 py-8 border-2 border-slate-100 rounded-[3rem] bg-white font-black outline-none focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-600 appearance-none shadow-sm cursor-pointer text-xl" value={catParent} onChange={e => setCatParent(e.target.value)}>
                            <option value="">Seleccionar Grupo...</option>
                            {data.families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-4">
                        <label className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.4em] ml-3">Marca / Concepto Específico</label>
                        <div className="relative group">
                            <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-indigo-300 group-focus-within:text-indigo-600 transition-colors" size={30} />
                            <input 
                                type="text" placeholder="Ej: Amazon, Carrefour, Netflix..." 
                                className="w-full pl-20 pr-10 py-8 bg-indigo-50/20 border-2 border-indigo-100 text-indigo-950 font-black placeholder:text-indigo-200 rounded-[3rem] focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none transition-all shadow-inner text-3xl disabled:opacity-50" 
                                value={catName} 
                                onChange={e => { setCatName(e.target.value); triggerWebSearch(e.target.value); }} 
                                disabled={!catParent}
                            />
                        </div>
                      </div>
                      {renderIconInput(catIcon, setCatIcon, catName, catFileInputRef)}
                      <div className="flex gap-6 pt-8">
                        <button onClick={() => {
                            if(!catName || !catParent) return;
                            const newCat: Category = { id: crypto.randomUUID(), name: catName, familyId: catParent, icon: catIcon };
                            onUpdateData({ categories: [...data.categories, newCat] });
                            resetForm();
                        }} disabled={!catParent} className="w-full py-8 bg-slate-950 text-white rounded-[3rem] font-black uppercase tracking-[0.3em] text-sm shadow-2xl active:scale-95 disabled:opacity-50 transition-all">
                            Vincular Categoría
                        </button>
                      </div>
                  </div>
              </div>
              <div className="bg-white p-12 rounded-[4rem] shadow-sm border border-slate-100">
                  <h3 className="text-2xl font-black mb-12">Mapa de Categorías</h3>
                  <div className="space-y-16 max-h-[1000px] overflow-y-auto pr-6 custom-scrollbar">
                      {data.families.map(fam => {
                        const famCats = data.categories.filter(c => c.familyId === fam.id);
                        if (famCats.length === 0) return null;
                        return (
                          <div key={fam.id} className="space-y-8">
                            <h4 className="text-sm font-black text-indigo-400 uppercase tracking-[0.6em] flex items-center gap-6 border-b-4 border-indigo-50 pb-8">
                              {fam.name}
                            </h4>
                            <div className="grid grid-cols-1 gap-6">
                              {famCats.map(c => (
                                <div key={c.id} className="flex justify-between items-center p-8 bg-slate-50/40 rounded-[3rem] group border border-slate-100 hover:bg-white hover:shadow-2xl transition-all">
                                    <div className="flex items-center gap-8">
                                        <div className="w-20 h-20 rounded-[1.75rem] bg-white flex items-center justify-center overflow-hidden border-2 border-slate-50 p-4 shadow-md">
                                            {c.icon.startsWith('data:image') || c.icon.startsWith('http') ? <img src={c.icon} className="w-full h-full object-contain" alt={c.name}/> : <span className="text-5xl">{c.icon}</span>}
                                        </div>
                                        <span className="font-black text-slate-800 text-2xl tracking-tighter">{c.name}</span>
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
