
import React, { useState, useRef } from 'react';
import { AppState, Account, Family, Category, Transaction, TransactionType, AccountGroup, ImportReport } from '../types';
import { Trash2, Edit2, Layers, Tag, Wallet, Loader2, Sparkles, XCircle, Download, DatabaseZap, ClipboardPaste, CheckCircle2, BoxSelect, FileJson, Info, AlertTriangle, Eraser, FileSpreadsheet, Upload, FolderTree, ArrowRightLeft, Receipt, Check, Image as ImageIcon } from 'lucide-react';
import { searchInternetLogos } from '../services/iconService';
import * as XLSX from 'xlsx';

interface SettingsViewProps {
  data: AppState;
  onUpdateData: (newData: Partial<AppState>) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

export const SettingsView: React.FC<SettingsViewProps> = ({ data, onUpdateData }) => {
  const [activeTab, setActiveTab] = useState('ACC_GROUPS');
  const [importType, setImportType] = useState<'GROUPS' | 'ACCOUNTS' | 'FAMILIES' | 'CATEGORIES' | 'TRANSACTIONS' | 'TRANSFER'>('TRANSACTIONS');
  const [pasteData, setPasteData] = useState('');
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [structureReport, setStructureReport] = useState<{ added: number, type: string } | null>(null);
  const [massDeleteYear, setMassDeleteYear] = useState('');
  
  const [webLogos, setWebLogos] = useState<{url: string, source: string}[]>([]);
  const [isSearchingWeb, setIsSearchingWeb] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const iconUploadRef = useRef<HTMLInputElement>(null);

  // Form States
  const [grpId, setGrpId] = useState<string | null>(null);
  const [grpName, setGrpName] = useState('');
  const [grpIcon, setGrpIcon] = useState('🗂️');

  const [accId, setAccId] = useState<string | null>(null);
  const [accName, setAccName] = useState('');
  const [accBalance, setAccBalance] = useState('');
  const [accIcon, setAccIcon] = useState('🏦');
  const [accGroupId, setAccGroupId] = useState('');

  const [famId, setFamId] = useState<string | null>(null);
  const [famName, setFamName] = useState('');
  const [famType, setFamType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [famIcon, setFamIcon] = useState('📂');

  const [catId, setCatId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');
  const [catParent, setCatParent] = useState('');
  const [catIcon, setCatIcon] = useState('🏷️');

  const renderIcon = (iconStr: string, className = "w-10 h-10") => {
    if (!iconStr) return <span className="text-xl">📂</span>;
    if (iconStr.startsWith('http') || iconStr.startsWith('data:image')) {
        return <img src={iconStr} className={`${className} object-contain rounded-lg`} referrerPolicy="no-referrer" />;
    }
    return <span className="text-xl">{iconStr}</span>;
  }

  const resetForm = () => {
    setGrpId(null); setGrpName(''); setGrpIcon('🗂️');
    setAccId(null); setAccName(''); setAccBalance(''); setAccIcon('🏦'); setAccGroupId('');
    setFamId(null); setFamName(''); setFamIcon('📂'); setFamType('EXPENSE');
    setCatId(null); setCatName(''); setCatIcon('🏷️'); setCatParent('');
    setImportReport(null); setStructureReport(null); setPasteData('');
    setWebLogos([]);
  };

  const parseDate = (dateStr: string) => {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    const s = dateStr.trim();
    if (s.includes('/')) {
        const parts = s.split('/');
        let day = parts[0].padStart(2, '0');
        let month = parts[1].padStart(2, '0');
        let year = parts[2];
        if (year.length === 2) year = '20' + year;
        return `${year}-${month}-${day}`;
    }
    return s;
  };

  const handleProcessImport = (rawData: string) => {
    if (!rawData.trim()) return;
    const lines = rawData.split('\n').filter(l => l.trim());
    
    const localGroups = [...data.accountGroups];
    const localAccs = [...data.accounts];
    const localFamilies = [...data.families];
    const localCategories = [...data.categories];
    const localTxs = [...data.transactions];

    let addedCount = 0;
    const txReport: ImportReport = { added: 0, newAccounts: [], newCategories: [], errors: [] };

    lines.forEach(line => {
      const parts = line.split(';').map(p => p.trim());
      if (parts.length < 2) return;

      switch (importType) {
        case 'GROUPS':
          if (!localGroups.find(g => g.name.toLowerCase() === parts[0].toLowerCase())) {
            localGroups.push({ id: generateId(), name: parts[0], icon: parts[1] || '🗂️' });
            addedCount++;
          }
          break;
        case 'ACCOUNTS':
          const accGrp = localGroups.find(g => g.name.toLowerCase() === parts[1]?.toLowerCase()) || localGroups[0];
          if (!localAccs.find(a => a.name.toLowerCase() === parts[0].toLowerCase())) {
            localAccs.push({ id: generateId(), name: parts[0], initialBalance: parseFloat(parts[2]) || 0, currency: 'EUR', icon: parts[3] || '🏦', groupId: accGrp?.id || 'g1' });
            addedCount++;
          }
          break;
        case 'FAMILIES':
          const fType = parts[1]?.toUpperCase() === 'INCOME' ? 'INCOME' : 'EXPENSE';
          if (!localFamilies.find(f => f.name.toLowerCase() === parts[0].toLowerCase())) {
            localFamilies.push({ id: generateId(), name: parts[0], type: fType, icon: parts[2] || '📂' });
            addedCount++;
          }
          break;
        case 'CATEGORIES':
          const fParent = localFamilies.find(f => f.name.toLowerCase() === parts[1]?.toLowerCase()) || localFamilies[0];
          if (!localCategories.find(c => c.name.toLowerCase() === parts[0].toLowerCase())) {
            localCategories.push({ id: generateId(), name: parts[0], familyId: fParent?.id || 'f1', icon: parts[2] || '🏷️' });
            addedCount++;
          }
          break;
        case 'TRANSACTIONS':
          const fec = parseDate(parts[0]);
          const amountVal = parseFloat(parts[4].replace(',', '.'));
          if (isNaN(amountVal)) return;

          let txAcc = localAccs.find(a => a.name.toLowerCase() === parts[2].toLowerCase());
          if (!txAcc) {
            txAcc = { id: generateId(), name: parts[2], initialBalance: 0, currency: 'EUR', icon: '🏦', groupId: localGroups[0]?.id || 'g1' };
            localAccs.push(txAcc); txReport.newAccounts.push(parts[2]);
          }
          let txCat = localCategories.find(c => c.name.toLowerCase() === parts[1].toLowerCase());
          if (!txCat) {
            txCat = { id: generateId(), name: parts[1], familyId: localFamilies[0]?.id || 'f1', icon: '🏷️' };
            localCategories.push(txCat); txReport.newCategories.push(parts[1]);
          }
          localTxs.push({ 
            id: generateId(), date: fec, description: parts[3], amount: Math.abs(amountVal), 
            type: amountVal < 0 ? 'EXPENSE' : 'INCOME', accountId: txAcc.id, 
            categoryId: txCat.id, familyId: txCat.familyId 
          });
          txReport.added++;
          break;
        case 'TRANSFER':
          const tFec = parseDate(parts[0]);
          const tAmount = Math.abs(parseFloat(parts[4].replace(',', '.')));
          if (isNaN(tAmount)) return;

          let tSrc = localAccs.find(a => a.name.toLowerCase() === parts[1].toLowerCase());
          if (!tSrc) { tSrc = { id: generateId(), name: parts[1], initialBalance: 0, currency: 'EUR', icon: '🏦', groupId: 'g1' }; localAccs.push(tSrc); txReport.newAccounts.push(parts[1]); }
          let tDst = localAccs.find(a => a.name.toLowerCase() === parts[2].toLowerCase());
          if (!tDst) { tDst = { id: generateId(), name: parts[2], initialBalance: 0, currency: 'EUR', icon: '🏦', groupId: 'g1' }; localAccs.push(tDst); txReport.newAccounts.push(parts[2]); }
          
          localTxs.push({ 
            id: generateId(), date: tFec, description: parts[3], amount: tAmount, 
            type: 'TRANSFER', accountId: tSrc.id, transferAccountId: tDst.id, familyId: '', categoryId: '' 
          });
          txReport.added++;
          break;
      }
    });

    if (['GROUPS', 'ACCOUNTS', 'FAMILIES', 'CATEGORIES'].includes(importType)) {
      setStructureReport({ added: addedCount, type: importType });
      onUpdateData({ accountGroups: localGroups, accounts: localAccs, families: localFamilies, categories: localCategories });
    } else {
      setImportReport(txReport);
      onUpdateData({ transactions: localTxs, accounts: localAccs, categories: localCategories });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const dataJson = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        const lines = dataJson.map(row => row.join(';')).join('\n');
        handleProcessImport(lines);
    };
    reader.readAsBinaryString(file);
  };

  const handleMassDelete = (mode: 'YEAR' | 'ALL') => {
    const msg = mode === 'ALL' 
        ? "¿Estás seguro de que quieres borrar ABSOLUTAMENTE TODOS los movimientos del historial? Esta acción no se puede deshacer."
        : `¿Confirmas el borrado de TODOS los movimientos del año ${massDeleteYear}?`;
    
    if (window.confirm(msg)) {
      if (mode === 'ALL') {
        // Usamos una actualización directa del estado
        onUpdateData({ transactions: [] });
        alert("Historial vaciado correctamente.");
      } else if (massDeleteYear) {
        const filtered = data.transactions.filter(t => !t.date.startsWith(massDeleteYear));
        onUpdateData({ transactions: filtered });
        alert(`Se han borrado los movimientos del año ${massDeleteYear}.`);
      }
      setMassDeleteYear('');
    }
  };

  const exportBackup = () => {
    const backupData = JSON.stringify(data, null, 2);
    const blob = new Blob([backupData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `contamiki_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const handleLocalIconUpload = (e: React.ChangeEvent<HTMLInputElement>, setIcon: (s: string) => void) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
              if (ev.target?.result) setIcon(ev.target.result as string);
          };
          reader.readAsDataURL(file);
      }
  };

  const renderIconInput = (icon: string, setIcon: (s: string) => void, currentName: string) => {
    return (
      <div className="space-y-4 w-full">
          <div className="flex flex-col sm:flex-row items-center gap-6 bg-slate-50 p-6 rounded-[2rem] border border-slate-100 shadow-inner">
                <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center border-4 border-white rounded-[1.5rem] bg-white overflow-hidden shadow-lg transition-transform hover:scale-105">
                    {renderIcon(icon, "w-12 h-12")}
                </div>
                <div className="flex-1 space-y-3 w-full">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center sm:text-left">Identidad Visual</p>
                    <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                        <button onClick={async () => {
                             if(!currentName) { alert("Escribe un nombre primero para buscar."); return; }
                             setIsSearchingWeb(true);
                             const results = await searchInternetLogos(currentName);
                             setWebLogos(results);
                             setIsSearchingWeb(false);
                        }} className="px-5 py-3 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-950 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100">
                            {isSearchingWeb ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>} IA Smart Search
                        </button>
                        <button onClick={() => iconUploadRef.current?.click()} className="px-5 py-3 bg-white text-slate-900 border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm">
                            <ImageIcon size={14}/> Subir Archivo
                        </button>
                        <input type="file" ref={iconUploadRef} className="hidden" accept="image/*" onChange={(e) => handleLocalIconUpload(e, setIcon)} />
                        <input type="text" className="w-16 px-2 py-3 bg-white border border-slate-200 rounded-xl font-bold text-center text-sm shadow-sm" value={icon.length < 5 ? icon : '📂'} onChange={e => setIcon(e.target.value)} placeholder="Emoji" title="Pega un emoji o escribe"/>
                    </div>
                </div>
          </div>
          {webLogos.length > 0 && (
            <div className="bg-white p-6 rounded-[2.5rem] border-2 border-indigo-100 shadow-2xl space-y-5 animate-in slide-in-from-top-4 z-10 relative">
                <div className="flex justify-between items-center">
                    <span className="text-[11px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                        <Sparkles size={14}/> Resultados Encontrados
                    </span>
                    <button onClick={() => setWebLogos([])} className="text-slate-300 hover:text-rose-500 transition-colors">
                        <XCircle size={20}/>
                    </button>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3 max-h-64 overflow-y-auto p-2 custom-scrollbar">
                    {webLogos.map((l, i) => (
                        <button key={i} onClick={() => { setIcon(l.url); setWebLogos([]); }} className="aspect-square bg-slate-50 rounded-2xl border-2 border-transparent hover:border-indigo-500 p-2 transition-all flex items-center justify-center overflow-hidden shadow-sm hover:shadow-md group">
                            <img src={l.url} className="w-full h-full object-contain group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
                        </button>
                    ))}
                </div>
            </div>
          )}
      </div>
    );
  };

  return (
    <div className="space-y-12 max-w-full overflow-hidden pb-20">
      <div className="text-center md:text-left space-y-2">
        <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter">Ajustes.</h2>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em]">Personalización y Control Maestro</p>
      </div>

      <nav className="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner border border-slate-200/50 overflow-x-auto scrollbar-hide">
        {[
            {id: 'ACC_GROUPS', label: 'Grupos', icon: <BoxSelect size={16}/>},
            {id: 'ACCOUNTS', label: 'Cuentas', icon: <Wallet size={16}/>},
            {id: 'FAMILIES', label: 'Familias', icon: <Layers size={16}/>},
            {id: 'CATEGORIES', label: 'Categorías', icon: <Tag size={16}/>},
            {id: 'TOOLS', label: 'Herramientas', icon: <DatabaseZap size={16}/>}
        ].map(t => (
            <button key={t.id} className={`flex-1 flex items-center justify-center gap-2 px-6 py-3.5 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => { setActiveTab(t.id); resetForm(); }}>
              {t.icon} <span className="hidden sm:inline">{t.label}</span>
            </button>
        ))}
      </nav>

      <div className="max-w-4xl mx-auto">
        {activeTab === 'ACC_GROUPS' && (
            <div className="grid grid-cols-1 gap-10">
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
                    <h3 className="text-xl font-black text-slate-800 uppercase flex items-center gap-3"><BoxSelect className="text-indigo-600"/> {grpId ? 'Editar Grupo' : 'Nuevo Grupo de Cuentas'}</h3>
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Descriptivo</label>
                            <input type="text" placeholder="Ej: Bancos, Efectivo..." className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={grpName} onChange={e => setGrpName(e.target.value)} />
                        </div>
                        {renderIconInput(grpIcon, setGrpIcon, grpName)}
                        <button onClick={() => { if(!grpName) return; if(grpId) onUpdateData({accountGroups: data.accountGroups.map(g=>g.id===grpId?{...g,name:grpName,icon:grpIcon}:g)}); else onUpdateData({accountGroups: [...data.accountGroups, {id:generateId(),name:grpName,icon:grpIcon}]}); resetForm(); }} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] hover:bg-indigo-600 transition-all shadow-xl">Guardar Grupo</button>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {data.accountGroups.map(g => (
                        <div key={g.id} className="p-6 bg-white rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm hover:border-indigo-200 transition-all group">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 flex items-center justify-center bg-slate-50 rounded-xl overflow-hidden">{renderIcon(g.icon, "w-8 h-8")}</div>
                                <span className="font-black text-slate-900 uppercase text-xs">{g.name}</span>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => { setGrpId(g.id); setGrpName(g.name); setGrpIcon(g.icon); }} className="p-2 text-indigo-400 hover:bg-indigo-50 rounded-lg"><Edit2 size={16}/></button><button onClick={() => onUpdateData({accountGroups: data.accountGroups.filter(x=>x.id!==g.id)})} className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg"><Trash2 size={16}/></button></div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'ACCOUNTS' && (
            <div className="grid grid-cols-1 gap-10">
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
                    <h3 className="text-xl font-black text-slate-800 uppercase flex items-center gap-3"><Wallet className="text-indigo-600"/> {accId ? 'Editar Cuenta' : 'Nueva Cuenta Bancaria'}</h3>
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre de la Cuenta</label>
                                <input type="text" placeholder="Ej: Cuenta Corriente..." className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={accName} onChange={e => setAccName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Grupo de Cuentas</label>
                                <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={accGroupId} onChange={e => setAccGroupId(e.target.value)}>
                                    <option value="">Seleccionar Grupo...</option>
                                    {data.accountGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                </select>
                            </div>
                        </div>
                        {renderIconInput(accIcon, setAccIcon, accName)}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Saldo de Apertura (€)</label>
                            <input type="number" step="0.01" placeholder="0.00" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={accBalance} onChange={e => setAccBalance(e.target.value)} />
                        </div>
                        <button onClick={() => { if(!accName) return; const balanceVal = parseFloat(accBalance) || 0; if (accId) onUpdateData({ accounts: data.accounts.map(a => a.id === accId ? { ...a, name: accName, initialBalance: balanceVal, icon: accIcon, groupId: accGroupId } : a) }); else onUpdateData({ accounts: [...data.accounts, { id: generateId(), name: accName, initialBalance: balanceVal, currency: 'EUR', icon: accIcon, groupId: accGroupId || (data.accountGroups[0]?.id || 'g1') }] }); resetForm(); }} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] hover:bg-indigo-600 transition-all shadow-xl">Confirmar Cuenta</button>
                    </div>
                </div>
                <div className="space-y-3">
                    {data.accounts.map(acc => {
                        const grp = data.accountGroups.find(g => g.id === acc.groupId);
                        return (
                            <div key={acc.id} className="flex justify-between items-center p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:border-indigo-100 transition-all group">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 overflow-hidden">{renderIcon(acc.icon, "w-10 h-10")}</div>
                                    <div>
                                        <span className="font-black text-slate-900 block text-xs uppercase">{acc.name}</span>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{grp?.name || 'Sin grupo'}</span>
                                        <span className="text-[10px] font-black text-indigo-500 block mt-0.5">{acc.initialBalance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => { setAccId(acc.id); setAccName(acc.name); setAccBalance(acc.initialBalance.toString()); setAccIcon(acc.icon); setAccGroupId(acc.groupId); }} className="p-3 text-indigo-400 hover:bg-indigo-50 rounded-xl"><Edit2 size={18}/></button><button onClick={() => onUpdateData({accounts: data.accounts.filter(a=>a.id!==acc.id)})} className="p-3 text-rose-400 hover:bg-rose-50 rounded-xl"><Trash2 size={18}/></button></div>
                            </div>
                        );
                    })}
                </div>
            </div>
        )}

        {activeTab === 'FAMILIES' && (
            <div className="grid grid-cols-1 gap-10">
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
                    <h3 className="text-xl font-black text-slate-800 uppercase flex items-center gap-3"><Layers className="text-indigo-600"/> {famId ? 'Editar Familia' : 'Nueva Familia Presupuestaria'}</h3>
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre de la Familia</label>
                                <input type="text" placeholder="Ej: Vivienda, Ocio..." className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={famName} onChange={e => setFamName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Naturaleza</label>
                                <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1.5">
                                    <button onClick={() => setFamType('EXPENSE')} className={`flex-1 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${famType === 'EXPENSE' ? 'bg-white text-rose-500 shadow-sm' : 'text-slate-400'}`}>Gasto</button>
                                    <button onClick={() => setFamType('INCOME')} className={`flex-1 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${famType === 'INCOME' ? 'bg-white text-emerald-500 shadow-sm' : 'text-slate-400'}`}>Ingreso</button>
                                </div>
                            </div>
                        </div>
                        {renderIconInput(famIcon, setFamIcon, famName)}
                        <button onClick={() => { if(!famName) return; if(famId) onUpdateData({families: data.families.map(f=>f.id===famId?{...f,name:famName,type:famType,icon:famIcon}:f)}); else onUpdateData({families: [...data.families, {id:generateId(),name:famName,type:famType,icon:famIcon}]}); resetForm(); }} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] hover:bg-indigo-600 transition-all">Guardar Familia</button>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {data.families.map(f => (
                        <div key={f.id} className="p-6 bg-white rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm group">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 flex items-center justify-center bg-slate-50 rounded-xl overflow-hidden">{renderIcon(f.icon, "w-8 h-8")}</div>
                                <div><span className="font-black text-slate-900 uppercase text-xs block">{f.name}</span><span className={`text-[8px] font-black uppercase tracking-widest ${f.type === 'EXPENSE' ? 'text-rose-400' : 'text-emerald-400'}`}>{f.type === 'EXPENSE' ? 'Gasto' : 'Ingreso'}</span></div>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => { setFamId(f.id); setFamName(f.name); setFamType(f.type); setFamIcon(f.icon); }} className="p-2 text-indigo-400 hover:bg-indigo-50 rounded-lg"><Edit2 size={16}/></button><button onClick={() => onUpdateData({families: data.families.filter(x=>x.id!==f.id)})} className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg"><Trash2 size={16}/></button></div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'CATEGORIES' && (
            <div className="grid grid-cols-1 gap-10">
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
                    <h3 className="text-xl font-black text-slate-800 uppercase flex items-center gap-3"><Tag className="text-indigo-600"/> {catId ? 'Editar Categoría' : 'Nueva Categoría de Gasto'}</h3>
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre de la Categoría</label>
                                <input type="text" placeholder="Ej: Supermercado, Alquiler..." className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={catName} onChange={e => setCatName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Familia Superior</label>
                                <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={catParent} onChange={e => setCatParent(e.target.value)}>
                                    <option value="">Vincular a Familia...</option>
                                    {data.families.map(f => <option key={f.id} value={f.id}>{f.name} ({f.type === 'EXPENSE' ? 'Gasto' : 'Ingreso'})</option>)}
                                </select>
                            </div>
                        </div>
                        {renderIconInput(catIcon, setCatIcon, catName)}
                        <button onClick={() => { if(!catName || !catParent) return; if(catId) onUpdateData({categories: data.categories.map(c=>c.id===catId?{...c,name:catName,familyId:catParent,icon:catIcon}:c)}); else onUpdateData({categories: [...data.categories, {id:generateId(),name:catName,familyId:catParent,icon:catIcon}]}); resetForm(); }} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] hover:bg-indigo-600 transition-all shadow-xl">Guardar Categoría</button>
                    </div>
                </div>
                <div className="space-y-3">
                    {data.categories.map(c => {
                        const fam = data.families.find(f => f.id === c.familyId);
                        return (
                            <div key={c.id} className="p-6 bg-white rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm group">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 flex items-center justify-center bg-slate-50 rounded-xl overflow-hidden">{renderIcon(c.icon, "w-8 h-8")}</div>
                                    <div><span className="font-black text-slate-900 uppercase text-xs block">{c.name}</span><span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Familia: {fam?.name || '---'}</span></div>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => { setCatId(c.id); setCatName(c.name); setCatParent(c.familyId); setCatIcon(c.icon); }} className="p-2 text-indigo-400 hover:bg-indigo-50 rounded-lg"><Edit2 size={16}/></button><button onClick={() => onUpdateData({categories: data.categories.filter(x=>x.id!==c.id)})} className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg"><Trash2 size={16}/></button></div>
                            </div>
                        );
                    })}
                </div>
            </div>
        )}

        {activeTab === 'TOOLS' && (
            <div className="space-y-12">
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3"><ClipboardPaste className="text-indigo-600" size={28}/> Importador Maestro</h3>
                    </div>

                    <div className="flex flex-col gap-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Selecciona el tipo de importación:</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 bg-slate-100 p-1.5 rounded-2xl gap-1 shadow-inner overflow-hidden">
                            {[
                                { id: 'GROUPS', label: 'Grupos', icon: <BoxSelect size={12}/> },
                                { id: 'ACCOUNTS', label: 'Cuentas', icon: <Wallet size={12}/> },
                                { id: 'FAMILIES', label: 'Familias', icon: <Layers size={12}/> },
                                { id: 'CATEGORIES', label: 'Categorías', icon: <Tag size={12}/> },
                                { id: 'TRANSACTIONS', label: 'Movimientos', icon: <Receipt size={12}/> },
                                { id: 'TRANSFER', label: 'Traspasos', icon: <ArrowRightLeft size={12}/> }
                            ].map(btn => (
                                <button 
                                    key={btn.id}
                                    onClick={() => { setImportType(btn.id as any); setImportReport(null); setStructureReport(null); }}
                                    className={`px-3 py-3 text-[9px] font-black uppercase tracking-tighter rounded-xl transition-all flex items-center justify-center gap-1.5 ${importType === btn.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-200'}`}
                                >
                                    {btn.icon} <span>{btn.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100 space-y-2">
                        <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2"><Info size={14}/> Guía de formato para {importType}:</p>
                        <p className="text-[11px] font-medium text-slate-600 italic">
                            {importType === 'GROUPS' && "Nombre; Icono/Emoji (ej: Bancos; 🏦)"}
                            {importType === 'ACCOUNTS' && "Nombre; Nombre del Grupo; Saldo Inicial; Icono (ej: BBVA; Bancos; 1500.50; 🏦)"}
                            {importType === 'FAMILIES' && "Nombre; Tipo (Gasto/Ingreso); Icono (ej: Alimentación; Gasto; 🍎)"}
                            {importType === 'CATEGORIES' && "Nombre; Nombre de la Familia; Icono (ej: Supermercado; Alimentación; 🛒)"}
                            {importType === 'TRANSACTIONS' && "Fecha; Categoría; Cuenta; Concepto; Importe (ej: 27/10/23; Super; BBVA; Compra; -50.00)"}
                            {importType === 'TRANSFER' && "Fecha; Cuenta Origen; Cuenta Destino; Concepto; Importe (ej: 27/10/23; BBVA; Efectivo; Sacar; 50.00)"}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Archivo CSV / Excel</label>
                            <div onClick={() => fileInputRef.current?.click()} className="group border-2 border-dashed border-slate-200 rounded-[2rem] p-10 text-center hover:border-indigo-500 hover:bg-indigo-50/30 transition-all cursor-pointer bg-slate-50/50">
                                <FileSpreadsheet className="mx-auto text-slate-300 group-hover:text-indigo-500 mb-4" size={48} />
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Arrastra o selecciona un archivo</p>
                                <input type="file" ref={fileInputRef} className="hidden" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pegar desde Portapapeles</label>
                            <textarea 
                              className="w-full h-36 p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] font-mono text-[10px] outline-none shadow-inner placeholder:text-slate-300 focus:border-indigo-500 transition-all" 
                              placeholder="Pega las líneas aquí..." 
                              value={pasteData} 
                              onChange={e => setPasteData(e.target.value)} 
                            />
                            <button onClick={() => handleProcessImport(pasteData)} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-indigo-200 hover:bg-slate-900 transition-all active:scale-95">Procesar Datos</button>
                        </div>
                    </div>

                    {structureReport && (
                        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white space-y-4 animate-in zoom-in-95 border-b-4 border-indigo-500 shadow-xl">
                            <h4 className="text-sm font-black uppercase flex items-center gap-2 text-indigo-400"><Check size={20} /> Importación completada</h4>
                            <div className="flex items-center gap-4">
                                <div className="bg-white/5 p-4 rounded-2xl flex-1 text-center"><p className="text-[9px] uppercase text-slate-400 mb-1">Tipo procesado</p><p className="text-lg font-black text-indigo-400 uppercase tracking-widest">{structureReport.type}</p></div>
                                <div className="bg-white/5 p-4 rounded-2xl flex-1 text-center"><p className="text-[9px] uppercase text-slate-400 mb-1">Nuevos registros</p><p className="text-4xl font-black text-emerald-400">{structureReport.added}</p></div>
                            </div>
                        </div>
                    )}

                    {importReport && (
                        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white space-y-4 animate-in zoom-in-95 border-b-4 border-emerald-500 shadow-xl">
                            <h4 className="text-sm font-black uppercase flex items-center gap-2 text-emerald-400"><CheckCircle2 size={20} /> Movimientos importados</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                                <div className="bg-white/5 p-4 rounded-2xl"><p className="text-[9px] uppercase text-slate-400 mb-1">Añadidos</p><p className="text-3xl font-black text-emerald-400">{importReport.added}</p></div>
                                <div className="bg-white/5 p-4 rounded-2xl"><p className="text-[9px] uppercase text-slate-400 mb-1">Nuevas Cuentas</p><p className="text-3xl font-black text-indigo-400">{importReport.newAccounts.length}</p></div>
                                <div className="bg-white/5 p-4 rounded-2xl"><p className="text-[9px] uppercase text-slate-400 mb-1">Nuevas Cats</p><p className="text-3xl font-black text-amber-400">{importReport.newCategories.length}</p></div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-rose-50 p-10 rounded-[3rem] border border-rose-100 space-y-6 shadow-sm">
                    <h3 className="text-2xl font-black text-rose-800 uppercase tracking-tighter flex items-center gap-3"><Eraser className="text-rose-600" size={28}/> Limpieza de Datos</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-white p-6 rounded-3xl border border-rose-200 space-y-4 shadow-sm">
                            <p className="text-rose-900 text-[10px] font-black uppercase tracking-widest">Eliminar un año completo</p>
                            <div className="flex gap-4">
                                <input type="number" placeholder="Año (ej: 2024)" className="flex-1 px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-rose-500" value={massDeleteYear} onChange={e => setMassDeleteYear(e.target.value)} />
                                <button onClick={() => handleMassDelete('YEAR')} className="px-6 py-4 bg-rose-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all active:scale-95">Borrar Año</button>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-3xl border border-rose-200 flex flex-col justify-center space-y-4 shadow-sm">
                            <p className="text-rose-900 text-[10px] font-black uppercase tracking-widest">Borrado total de historial</p>
                            <button onClick={() => handleMassDelete('ALL')} className="w-full py-4 bg-rose-950 text-white rounded-xl font-black text-[10px] uppercase shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3 active:scale-95"><AlertTriangle size={16}/> VACIAR TODO EL DIARIO</button>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 p-10 rounded-[3rem] text-center space-y-6 shadow-2xl overflow-hidden relative group border-t-4 border-indigo-500">
                    <div className="mx-auto bg-indigo-600 text-white w-16 h-16 rounded-3xl flex items-center justify-center shadow-2xl rotate-3 group-hover:rotate-12 transition-transform duration-500"><DatabaseZap size={32} /></div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Copia de Seguridad</h3>
                    <button onClick={exportBackup} className="flex items-center justify-center gap-3 w-full p-5 bg-white text-slate-900 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-xl active:scale-95"><FileJson size={20} /> Exportar JSON completo</button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
