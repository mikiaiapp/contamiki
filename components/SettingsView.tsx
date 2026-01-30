
import React, { useState, useRef, useEffect } from 'react';
import { AppState, Account, Family, Category, Transaction, TransactionType, RecurrentMovement, FavoriteMovement, RecurrenceFrequency } from '../types';
import { Trash2, Edit2, Layers, Tag, Wallet, Loader2, ImageIcon, Sparkles, ChevronDown, XCircle, Info, Download, Upload, FileJson, FileSpreadsheet, DatabaseZap, ClipboardPaste, ListOrdered, CheckCircle2, Repeat, Star, Power, Calendar, ArrowRightLeft } from 'lucide-react';
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

type Tab = 'FAMILIES' | 'CATEGORIES' | 'ACCOUNTS' | 'RECURRENTS' | 'FAVORITES' | 'TOOLS';

export const SettingsView: React.FC<SettingsViewProps> = ({ data, onUpdateData }) => {
  const [activeTab, setActiveTab] = useState<Tab>('ACCOUNTS');
  
  const [webLogos, setWebLogos] = useState<{url: string, source: string}[]>([]);
  const [isSearchingWeb, setIsSearchingWeb] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const searchTimeoutRef = useRef<number | null>(null);

  // Estados de formulario Cuentas
  const [accId, setAccId] = useState<string | null>(null);
  const [accName, setAccName] = useState('');
  const [accBalance, setAccBalance] = useState('');
  const [accIcon, setAccIcon] = useState('🏦');
  const accFileInputRef = useRef<HTMLInputElement>(null);

  // Estados de formulario Familias
  const [famId, setFamId] = useState<string | null>(null);
  const [famName, setFamName] = useState('');
  const [famType, setFamType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [famIcon, setFamIcon] = useState('📂');
  const famFileInputRef = useRef<HTMLInputElement>(null);

  // Estados de formulario Categorías
  const [catId, setCatId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');
  const [catParent, setCatParent] = useState('');
  const [catIcon, setCatIcon] = useState('🏷️');
  const catFileInputRef = useRef<HTMLInputElement>(null);

  // Estados de formulario Recurrentes mejorados
  const [recId, setRecId] = useState<string | null>(null);
  const [recDesc, setRecDesc] = useState('');
  const [recAmount, setRecAmount] = useState('');
  const [recFreq, setRecFreq] = useState<RecurrenceFrequency>('MONTHLY');
  const [recInterval, setRecInterval] = useState('1');
  const [recStart, setRecStart] = useState(new Date().toISOString().split('T')[0]);
  const [recAcc, setRecAcc] = useState(data.accounts[0]?.id || '');
  const [recCounterpartId, setRecCounterpartId] = useState('');
  const [recCat, setRecCat] = useState('');

  // Estados de formulario Favoritos
  const [favId, setFavId] = useState<string | null>(null);
  const [favName, setFavName] = useState('');
  const [favAmount, setFavAmount] = useState('');
  const [favAcc, setFavAcc] = useState(data.accounts[0]?.id || '');
  const [favCounterpartId, setFavCounterpartId] = useState('');
  const [favCat, setFavCat] = useState('');

  useEffect(() => { 
    setWebLogos([]); 
    setHasSearched(false);
    resetForm();
  }, [activeTab]);

  const resetForm = () => {
      setAccId(null); setAccName(''); setAccBalance(''); setAccIcon('🏦');
      setFamId(null); setFamName(''); setFamIcon('📂'); setFamType('EXPENSE');
      setCatId(null); setCatName(''); setCatIcon('🏷️'); setCatParent('');
      setRecId(null); setRecDesc(''); setRecAmount(''); setRecFreq('MONTHLY'); setRecInterval('1'); setRecStart(new Date().toISOString().split('T')[0]); setRecAcc(data.accounts[0]?.id || ''); setRecCounterpartId(''); setRecCat('');
      setFavId(null); setFavName(''); setFavAmount(''); setFavAcc(data.accounts[0]?.id || ''); setFavCounterpartId(''); setFavCat('');
      setWebLogos([]); setHasSearched(false);
  };

  const triggerWebSearch = (text: string) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    const cleanText = text.trim();
    if (cleanText.length < 2) { setWebLogos([]); setHasSearched(false); return; }
    searchTimeoutRef.current = window.setTimeout(async () => {
        setIsSearchingWeb(true);
        setHasSearched(true);
        try {
            const results = await searchInternetLogos(cleanText);
            setWebLogos(results);
        } catch (e) { console.error("Icon search error", e); }
        finally { setIsSearchingWeb(false); }
    }, 600);
  };

  const handleSelectWebLogo = (url: string, setIcon: (s: string) => void) => {
      setIcon(url);
      setWebLogos([]);
      setHasSearched(false);
  };

  const renderIcon = (iconStr: string, className = "w-12 h-12") => {
    const safeIcon = iconStr || '📂';
    if (safeIcon.startsWith('data:image') || safeIcon.startsWith('http')) {
        return <img src={safeIcon} alt="icon" className={`${className} object-contain`} referrerPolicy="no-referrer" />;
    }
    return <span className="text-2xl">{safeIcon}</span>;
  }

  const exportBackup = () => {
    const dataStr = JSON.stringify(data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `contamiki_backup_${new Date().toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const renderIconInput = (icon: string, setIcon: (s: string) => void, currentName: string, fileRef: React.RefObject<HTMLInputElement>) => {
    const isImage = icon.startsWith('data:image') || icon.startsWith('http');
    const showBox = isSearchingWeb || webLogos.length > 0 || (hasSearched && !isSearchingWeb);
    return (
      <div className="space-y-4 w-full">
          <div className="flex flex-col sm:flex-row gap-4 items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="relative group w-20 h-20 flex-shrink-0 flex items-center justify-center border-2 border-white rounded-2xl bg-white overflow-hidden shadow-sm cursor-pointer" onClick={() => fileRef.current?.click()}>
                    {isImage ? <img src={icon} className="w-full h-full object-contain p-2" alt="Icono" referrerPolicy="no-referrer" /> : <span className="text-3xl">{icon}</span>}
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><ImageIcon className="text-white" size={20} /></div>
                </div>
                <div className="flex-1 text-center sm:text-left space-y-3">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Identidad Visual</p>
                    <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                        <button onClick={() => fileRef.current?.click()} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg font-black text-[8px] uppercase tracking-widest flex items-center gap-1.5 hover:bg-slate-50 transition-colors shadow-sm"><ImageIcon size={12} /> Galería</button>
                        <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={async (e) => {
                            if (e.target.files && e.target.files[0]) {
                                const reader = new FileReader();
                                reader.onload = (ev) => setIcon(ev.target?.result as string);
                                reader.readAsDataURL(e.target.files[0]);
                            }
                        }} />
                        {isImage && <button onClick={() => setIcon('🏷️')} className="text-rose-500 bg-rose-50 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase">Emoji</button>}
                    </div>
                </div>
          </div>
          {showBox && (
            <div className="bg-white p-6 rounded-[2.5rem] border-2 border-indigo-50 shadow-2xl space-y-4 animate-in slide-in-from-top-4 ring-4 ring-indigo-50/20">
                <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2"><Sparkles size={14} className={isSearchingWeb ? 'animate-spin' : ''} /> {isSearchingWeb ? `Buscando para "${currentName}"...` : `Logos e Iconos`}</span>
                    {!isSearchingWeb && <button onClick={() => {setWebLogos([]); setHasSearched(false);}} className="text-slate-300 hover:text-rose-500 transition-colors"><XCircle size={20}/></button>}
                </div>
                {isSearchingWeb && webLogos.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-4"><Loader2 className="animate-spin text-indigo-500" size={32} /><p className="text-[9px] font-black text-indigo-300 uppercase tracking-[0.4em]">Explorando...</p></div>
                ) : webLogos.length > 0 ? (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar p-1">
                        {webLogos.map((logo, idx) => (
                            <button key={idx} onClick={() => handleSelectWebLogo(logo.url, setIcon)} className="aspect-square bg-slate-50 rounded-2xl border-2 border-slate-100 hover:border-indigo-500 p-2.5 transition-all flex items-center justify-center overflow-hidden shadow-sm hover:scale-105 group relative" title={logo.source}>
                                <img src={logo.url} className="w-full h-full object-contain" alt={logo.source} referrerPolicy="no-referrer" onError={(e) => (e.target as HTMLElement).parentElement?.classList.add('hidden')} />
                                <div className="absolute inset-0 bg-indigo-600/5 opacity-0 group-hover:opacity-100" />
                            </button>
                        ))}
                    </div>
                ) : <div className="py-8 text-center text-slate-400 text-[10px] uppercase font-black">No hay resultados.</div>}
            </div>
          )}
      </div>
    );
  };

  return (
    <div className="space-y-12 max-w-full overflow-hidden">
      <div className="text-center md:text-left space-y-2">
        <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter leading-none">Ajustes.</h2>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em]">Gestión y mantenimiento del sistema</p>
      </div>

      <div className="flex bg-slate-100 p-1.5 rounded-[1.5rem] shadow-inner border border-slate-200/50 overflow-x-auto scrollbar-hide">
        {[
            { id: 'ACCOUNTS', label: 'Cuentas', icon: <Wallet size={18}/> },
            { id: 'FAMILIES', label: 'Familias', icon: <Layers size={18}/> },
            { id: 'CATEGORIES', label: 'Categorías', icon: <Tag size={18}/> },
            { id: 'RECURRENTS', label: 'Recurrentes', icon: <Repeat size={18}/> },
            { id: 'FAVORITES', label: 'Favoritos', icon: <Star size={18}/> },
            { id: 'TOOLS', label: 'Herramientas', icon: <DatabaseZap size={18}/> }
        ].map(t => (
            <button key={t.id} className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => setActiveTab(t.id as any)}>
              {t.icon} {t.label}
            </button>
        ))}
      </div>

      <div className="max-w-4xl mx-auto">
        {activeTab === 'ACCOUNTS' && (
            <div className="grid grid-cols-1 gap-10">
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
                    <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-4">
                        <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-2xl"><Wallet size={24}/></div>
                        {accId ? 'Editar Cuenta' : 'Nueva Cuenta'}
                    </h3>
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre o Banco</label>
                            <input type="text" placeholder="Ej: Caixabank, Santander..." className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all text-slate-900" value={accName} onChange={e => { setAccName(e.target.value); triggerWebSearch(e.target.value); }} />
                        </div>
                        {renderIconInput(accIcon, setAccIcon, accName, accFileInputRef)}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Saldo Inicial (€)</label>
                            <input type="number" placeholder="0.00" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all text-slate-900" value={accBalance} onChange={e => setAccBalance(e.target.value)} />
                        </div>
                        <button onClick={() => {
                            if(!accName) return;
                            const balanceVal = parseFloat(accBalance) || 0;
                            if (accId) onUpdateData({ accounts: data.accounts.map(a => a.id === accId ? { ...a, name: accName, initialBalance: balanceVal, icon: accIcon } : a) });
                            else onUpdateData({ accounts: [...data.accounts, { id: generateId(), name: accName, initialBalance: balanceVal, currency: 'EUR', icon: accIcon }] });
                            resetForm();
                        }} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-2xl hover:bg-indigo-600 transition-all">{accId ? 'Guardar Cambios' : 'Crear Cuenta'}</button>
                    </div>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 px-4">Listado de Cuentas</h4>
                    <div className="space-y-3">
                        {data.accounts.map(acc => (
                            <div key={acc.id} className="flex justify-between items-center p-5 bg-slate-50 rounded-3xl border border-transparent hover:border-slate-200 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center overflow-hidden border border-slate-100 p-2 shadow-sm shrink-0">
                                      {renderIcon(acc.icon || '🏦', "w-full h-full")}
                                    </div>
                                    <div>
                                        <span className="font-black text-slate-900 block text-xs uppercase">{acc.name}</span>
                                        <span className="text-[10px] font-bold text-indigo-500">{acc.initialBalance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => { setAccId(acc.id); setAccName(acc.name); setAccBalance(acc.initialBalance.toString()); setAccIcon(acc.icon || '🏦'); }} className="p-3 text-slate-300 hover:text-indigo-600"><Edit2 size={18}/></button>
                                    <button onClick={() => onUpdateData({accounts: data.accounts.filter(a=>a.id!==acc.id)})} className="p-3 text-slate-300 hover:text-rose-600"><Trash2 size={18}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'RECURRENTS' && (
            <div className="grid grid-cols-1 gap-10">
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
                    <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-4">
                        <div className="bg-amber-500 p-3 rounded-2xl text-white shadow-2xl"><Repeat size={24}/></div>
                        {recId ? 'Editar Recurrente' : 'Nueva Recurrencia'}
                    </h3>
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descripción del Movimiento</label>
                            <input type="text" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={recDesc} onChange={e => setRecDesc(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cuenta Principal</label>
                                <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold" value={recAcc} onChange={e => setRecAcc(e.target.value)}>
                                    {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cuenta Contrapartida (Opcional)</label>
                                <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold" value={recCounterpartId} onChange={e => setRecCounterpartId(e.target.value)}>
                                    <option value="">Ninguna</option>
                                    {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Importe Fijo</label>
                                <input type="number" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={recAmount} onChange={e => setRecAmount(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cada (X)</label>
                                <input type="number" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={recInterval} onChange={e => setRecInterval(e.target.value)} min="1" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Periodicidad</label>
                                <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold" value={recFreq} onChange={e => setRecFreq(e.target.value as any)}>
                                    <option value="DAYS">Días</option>
                                    <option value="WEEKS">Semanas</option>
                                    <option value="MONTHLY">Meses</option>
                                    <option value="YEARS">Años</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha Inicio / Prox</label>
                                <input type="date" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold" value={recStart} onChange={e => setRecStart(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoría</label>
                                <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold" value={recCat} onChange={e => setRecCat(e.target.value)}>
                                    <option value="">Seleccionar...</option>
                                    {data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <button onClick={() => {
                            if(!recDesc || !recAmount || !recCat) return;
                            const cat = data.categories.find(c => c.id === recCat);
                            const newRec: RecurrentMovement = {
                                id: recId || generateId(),
                                description: recDesc,
                                amount: parseFloat(recAmount),
                                frequency: recFreq,
                                interval: parseInt(recInterval) || 1,
                                nextDueDate: recStart,
                                startDate: recStart,
                                accountId: recAcc,
                                transferAccountId: recCounterpartId || undefined,
                                categoryId: recCat,
                                familyId: cat?.familyId || '',
                                type: data.families.find(f => f.id === cat?.familyId)?.type || 'EXPENSE',
                                active: true
                            };
                            onUpdateData({ recurrents: recId ? (data.recurrents || []).map(x => x.id === recId ? newRec : x) : [...(data.recurrents || []), newRec] });
                            resetForm();
                        }} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-2xl hover:bg-amber-500 transition-all">{recId ? 'Actualizar' : 'Crear Recurrente'}</button>
                    </div>
                </div>
                
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 px-4">Mantenimiento de Recurrentes</h4>
                    <div className="space-y-4">
                        {(data.recurrents || []).map(r => (
                            <div key={r.id} className={`flex justify-between items-center p-5 rounded-3xl border transition-all ${r.active ? 'bg-slate-50 border-slate-100' : 'bg-slate-100/50 border-slate-200 opacity-60'}`}>
                                <div className="flex items-center gap-5">
                                    <div className={`p-3 rounded-2xl shadow-sm ${r.active ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-400'}`}><Repeat size={20}/></div>
                                    <div>
                                        <span className="font-black text-slate-900 block text-[11px] uppercase tracking-tight">{r.description}</span>
                                        <div className="flex gap-2">
                                            <span className="text-[8px] font-black uppercase text-indigo-500">Cada {r.interval} {r.frequency === 'DAYS' ? 'Días' : r.frequency === 'WEEKS' ? 'Sem' : r.frequency === 'MONTHLY' ? 'Mes' : 'Años'}</span>
                                            {r.transferAccountId && <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter flex items-center gap-1"><ArrowRightLeft size={8}/> {data.accounts.find(a => a.id === r.transferAccountId)?.name}</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => onUpdateData({ recurrents: (data.recurrents || []).map(x => x.id === r.id ? { ...x, active: !x.active } : x) })} className={`p-3 rounded-xl transition-colors ${r.active ? 'text-amber-500 hover:bg-amber-50' : 'text-slate-400 hover:bg-slate-100'}`}><Power size={18}/></button>
                                    <button onClick={() => { setRecId(r.id); setRecDesc(r.description); setRecAmount(r.amount.toString()); setRecFreq(r.frequency); setRecInterval(r.interval.toString()); setRecStart(r.nextDueDate); setRecAcc(r.accountId); setRecCounterpartId(r.transferAccountId || ''); setRecCat(r.categoryId); }} className="p-3 text-slate-300 hover:text-indigo-600"><Edit2 size={18}/></button>
                                    <button onClick={() => onUpdateData({ recurrents: (data.recurrents || []).filter(x => x.id !== r.id) })} className="p-3 text-slate-300 hover:text-rose-600"><Trash2 size={18}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'FAVORITES' && (
            <div className="grid grid-cols-1 gap-10">
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
                    <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-4">
                        <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-2xl"><Star size={24}/></div>
                        {favId ? 'Editar Favorito' : 'Nuevo Favorito'}
                    </h3>
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Atajo</label>
                            <input type="text" placeholder="Ej: Café Diario, Compra Semanal..." className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={favName} onChange={e => setFavName(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cuenta Principal</label>
                                <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold" value={favAcc} onChange={e => setFavAcc(e.target.value)}>
                                    {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cuenta Contrapartida (Opcional)</label>
                                <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold" value={favCounterpartId} onChange={e => setFavCounterpartId(e.target.value)}>
                                    <option value="">Ninguna</option>
                                    {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Importe sugerido</label>
                                <input type="number" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold" value={favAmount} onChange={e => setFavAmount(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoría</label>
                                <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold" value={favCat} onChange={e => setFavCat(e.target.value)}>
                                    <option value="">Seleccionar...</option>
                                    {data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <button onClick={() => {
                            if(!favName || !favAmount || !favCat) return;
                            const cat = data.categories.find(c => c.id === favCat);
                            const newFav: FavoriteMovement = {
                                id: favId || generateId(),
                                name: favName,
                                description: favName,
                                amount: parseFloat(favAmount),
                                accountId: favAcc,
                                transferAccountId: favCounterpartId || undefined,
                                categoryId: favCat,
                                familyId: cat?.familyId || '',
                                type: data.families.find(f => f.id === cat?.familyId)?.type || 'EXPENSE'
                            };
                            onUpdateData({ favorites: favId ? (data.favorites || []).map(x => x.id === favId ? newFav : x) : [...(data.favorites || []), newFav] });
                            resetForm();
                        }} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-indigo-600 transition-all">Guardar Favorito</button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(data.favorites || []).map(fav => (
                        <div key={fav.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 flex items-center justify-between hover:shadow-lg transition-all">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><Star size={20}/></div>
                                <div>
                                    <span className="font-black text-slate-900 block text-[11px] uppercase">{fav.name}</span>
                                    <div className="flex gap-2">
                                        <span className="text-[9px] font-bold text-slate-400">{fav.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                                        {fav.transferAccountId && <span className="text-[9px] font-black text-indigo-400 uppercase tracking-tighter flex items-center gap-1"><ArrowRightLeft size={8}/> {data.accounts.find(a => a.id === fav.transferAccountId)?.name}</span>}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => { setFavId(fav.id); setFavName(fav.name); setFavAmount(fav.amount.toString()); setFavAcc(fav.accountId); setFavCounterpartId(fav.transferAccountId || ''); setFavCat(fav.categoryId); }} className="p-2 text-slate-300 hover:text-indigo-600"><Edit2 size={16}/></button>
                                <button onClick={() => onUpdateData({ favorites: (data.favorites || []).filter(x => x.id !== fav.id) })} className="p-2 text-slate-300 hover:text-rose-600"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'TOOLS' && (
            <div className="space-y-10">
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-10 text-center">
                    <div className="mx-auto bg-indigo-100 text-indigo-600 w-20 h-20 rounded-3xl flex items-center justify-center shadow-xl shadow-indigo-500/10"><Upload size={36} /></div>
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Importación & Exportación</h3>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest leading-relaxed">Sincroniza tus datos de forma masiva o realiza respaldos locales.</p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button onClick={exportBackup} className="flex-1 flex items-center justify-center gap-3 p-6 bg-slate-950 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all shadow-xl active:scale-95"><FileJson size={20} /> Exportar JSON</button>
                        <button onClick={() => window.print()} className="flex-1 flex items-center justify-center gap-3 p-6 bg-white text-slate-900 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] border-2 border-slate-100 hover:bg-slate-50 transition-all active:scale-95"><Download size={20} /> Informe PDF</button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
