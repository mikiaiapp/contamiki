
import React, { useState, useRef, useMemo } from 'react';
import { AppState, Account, Family, Category, Transaction, TransactionType, AccountGroup, ImportReport, RecurrentMovement, FavoriteMovement, RecurrenceFrequency } from '../types';
import { Trash2, Edit2, Layers, Tag, Wallet, Loader2, Sparkles, XCircle, Download, DatabaseZap, ClipboardPaste, CheckCircle2, BoxSelect, FileJson, Info, AlertTriangle, Eraser, FileSpreadsheet, Upload, FolderTree, ArrowRightLeft, Receipt, Check, Image as ImageIcon, CalendarClock, Heart, Clock, Calendar, Archive, RefreshCw, X, HardDriveDownload, HardDriveUpload, Bot, ShieldAlert, Monitor } from 'lucide-react';
import { searchInternetLogos } from '../services/iconService';
import * as XLSX from 'xlsx';

interface SettingsViewProps {
  data: AppState;
  onUpdateData: (newData: Partial<AppState>) => void;
  onNavigateToTransactions?: (filters: any) => void;
  onCreateBookFromImport?: (data: AppState, name: string) => void;
  onDeleteBook?: () => void;
}

const generateId = () => Math.random().toString(36).substring(2, 15);
const numberFormatter = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const SettingsView: React.FC<SettingsViewProps> = ({ data, onUpdateData, onNavigateToTransactions, onCreateBookFromImport, onDeleteBook }) => {
  const [activeTab, setActiveTab] = useState('ACC_GROUPS');
  
  // Data & Import States
  const [importType, setImportType] = useState<'GROUPS' | 'ACCOUNTS' | 'FAMILIES' | 'CATEGORIES' | 'TRANSACTIONS' | 'TRANSFER'>('TRANSACTIONS');
  const [pasteData, setPasteData] = useState('');
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [structureReport, setStructureReport] = useState<{ added: number, type: string } | null>(null);
  
  // Backup State
  const [restoreFile, setRestoreFile] = useState<AppState | null>(null);
  const [restoreFileName, setRestoreFileName] = useState('');
  
  // Delete State
  const [yearToDelete, setYearToDelete] = useState<string>('');
  const [verificationModal, setVerificationModal] = useState<{ type: 'YEAR' | 'ALL_TX' | 'BOOK', payload?: any } | null>(null);
  const [verificationInput, setVerificationInput] = useState('');
  
  // Icon Search State
  const [webLogos, setWebLogos] = useState<{url: string, source: string}[]>([]);
  const [isSearchingWeb, setIsSearchingWeb] = useState(false);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
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

  const [recId, setRecId] = useState<string | null>(null);
  const [recDesc, setRecDesc] = useState('');
  const [recAmount, setRecAmount] = useState('');
  const [recType, setRecType] = useState<TransactionType>('EXPENSE');
  const [recAcc, setRecAcc] = useState('');
  const [recCat, setRecCat] = useState('');
  const [recFreq, setRecFreq] = useState<RecurrenceFrequency>('MONTHLY');
  const [recInterval, setRecInterval] = useState('1');
  const [recStart, setRecStart] = useState(new Date().toISOString().split('T')[0]);
  const [recEnd, setRecEnd] = useState('');

  const [favId, setFavId] = useState<string | null>(null);
  const [favName, setFavName] = useState('');
  const [favDesc, setFavDesc] = useState('');
  const [favAmount, setFavAmount] = useState('');
  const [favType, setFavType] = useState<TransactionType>('EXPENSE');
  const [favAcc, setFavAcc] = useState('');
  const [favCat, setFavCat] = useState('');
  const [favIcon, setFavIcon] = useState('⭐');

  // Computed
  const availableYears = useMemo(() => {
    const years = new Set(data.transactions.map(t => t.date.substring(0, 4)));
    return Array.from(years).sort().reverse();
  }, [data.transactions]);

  const resetForm = () => {
    setGrpId(null); setGrpName(''); setGrpIcon('🗂️');
    setAccId(null); setAccName(''); setAccBalance(''); setAccIcon('🏦'); setAccGroupId(data.accountGroups[0]?.id || '');
    setFamId(null); setFamName(''); setFamIcon('📂'); setFamType('EXPENSE');
    setCatId(null); setCatName(''); setCatIcon('🏷️'); setCatParent(data.families[0]?.id || '');
    setRecId(null); setRecDesc(''); setRecAmount(''); setRecType('EXPENSE'); setRecAcc(data.accounts[0]?.id || ''); setRecCat(''); setRecFreq('MONTHLY'); setRecInterval('1'); setRecStart(new Date().toISOString().split('T')[0]); setRecEnd('');
    setFavId(null); setFavName(''); setFavDesc(''); setFavAmount(''); setFavType('EXPENSE'); setFavAcc(data.accounts[0]?.id || ''); setFavCat(''); setFavIcon('⭐');
    setImportReport(null); setStructureReport(null); setPasteData('');
    setWebLogos([]);
    setRestoreFile(null); setRestoreFileName('');
    setYearToDelete(availableYears[0] || '');
    setVerificationModal(null); setVerificationInput('');
  };

  const renderIcon = (iconStr: string, className = "w-10 h-10") => {
    if (!iconStr) return <span className="text-xl">📂</span>;
    if (iconStr.startsWith('http') || iconStr.startsWith('data:image')) return <img src={iconStr} className={`${className} object-contain rounded-lg`} referrerPolicy="no-referrer" />;
    return <span className="text-xl">{iconStr}</span>;
  }

  const handleExportBackup = () => {
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_contamiki_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
          try {
              const content = JSON.parse(ev.target?.result as string);
              if (content.transactions && Array.isArray(content.transactions)) {
                  setRestoreFile(content);
                  setRestoreFileName(file.name.replace('.json', ''));
              } else {
                  alert("El archivo no parece una copia de seguridad válida de ContaMiki.");
              }
          } catch (err) {
              alert("Error al leer el archivo JSON.");
          }
      };
      reader.readAsText(file);
      e.target.value = ''; // Reset input
  };

  const openVerification = (type: 'YEAR' | 'ALL_TX' | 'BOOK', payload?: any) => {
      setVerificationModal({ type, payload });
      setVerificationInput('');
  };

  const executeDangerousAction = () => {
      if (verificationInput !== 'BORRAR') return;
      if (verificationModal?.type === 'YEAR') { const yr = verificationModal.payload; const filtered = data.transactions.filter(t => !t.date.startsWith(yr)); onUpdateData({ transactions: filtered }); } 
      else if (verificationModal?.type === 'ALL_TX') { onUpdateData({ transactions: [] }); }
      else if (verificationModal?.type === 'BOOK') { if (onDeleteBook) onDeleteBook(); }
      resetForm();
  };

  const handleProcessImport = (rawData: string) => {
    if (!rawData.trim()) return;
    const lines = rawData.split('\n').filter(l => l.trim());
    const localGroups = [...data.accountGroups]; const localAccs = [...data.accounts];
    const localFamilies = [...data.families]; const localCategories = [...data.categories];
    const localTxs = [...data.transactions];
    let addedCount = 0; const txReport: ImportReport = { added: 0, newAccounts: [], newCategories: [], errors: [] };
    lines.forEach(line => {
      const parts = line.split(';').map(p => p.trim());
      if (parts.length < 2) return;
      switch (importType) {
        case 'GROUPS': if (!localGroups.find(g => g.name.toLowerCase() === parts[0].toLowerCase())) { localGroups.push({ id: generateId(), name: parts[0], icon: parts[1] || '🗂️' }); addedCount++; } break;
        case 'ACCOUNTS': const accGrp = localGroups.find(g => g.name.toLowerCase() === parts[1]?.toLowerCase()) || localGroups[0]; if (!localAccs.find(a => a.name.toLowerCase() === parts[0].toLowerCase())) { localAccs.push({ id: generateId(), name: parts[0], initialBalance: parseFloat(parts[2]) || 0, currency: 'EUR', icon: parts[3] || '🏦', groupId: accGrp?.id || 'g1' }); addedCount++; } break;
        case 'FAMILIES': const fType = parts[1]?.toUpperCase() === 'INCOME' ? 'INCOME' : 'EXPENSE'; if (!localFamilies.find(f => f.name.toLowerCase() === parts[0].toLowerCase())) { localFamilies.push({ id: generateId(), name: parts[0], type: fType, icon: parts[2] || '📂' }); addedCount++; } break;
        case 'CATEGORIES': const fParent = localFamilies.find(f => f.name.toLowerCase() === parts[1]?.toLowerCase()) || localFamilies[0]; if (!localCategories.find(c => c.name.toLowerCase() === parts[0].toLowerCase())) { localCategories.push({ id: generateId(), name: parts[0], familyId: fParent?.id || 'f1', icon: parts[2] || '🏷️' }); addedCount++; } break;
        case 'TRANSACTIONS': const amountVal = parseFloat(parts[4].replace(',', '.')); if (isNaN(amountVal)) return; let txAcc = localAccs.find(a => a.name.toLowerCase() === parts[2].toLowerCase()); if (!txAcc) { txAcc = { id: generateId(), name: parts[2], initialBalance: 0, currency: 'EUR', icon: '🏦', groupId: localGroups[0]?.id || 'g1' }; localAccs.push(txAcc); txReport.newAccounts.push(parts[2]); } let txCat = localCategories.find(c => c.name.toLowerCase() === parts[1].toLowerCase()); if (!txCat) { txCat = { id: generateId(), name: parts[1], familyId: localFamilies[0]?.id || 'f1', icon: '🏷️' }; localCategories.push(txCat); txReport.newCategories.push(parts[1]); } localTxs.push({ id: generateId(), date: parts[0], description: parts[3], amount: amountVal, type: amountVal < 0 ? 'EXPENSE' : 'INCOME', accountId: txAcc.id, categoryId: txCat.id, familyId: txCat.familyId }); txReport.added++; break;
      }
    });
    if (['GROUPS', 'ACCOUNTS', 'FAMILIES', 'CATEGORIES'].includes(importType)) { setStructureReport({ added: addedCount, type: importType }); onUpdateData({ accountGroups: localGroups, accounts: localAccs, families: localFamilies, categories: localCategories }); } else { setImportReport(txReport); onUpdateData({ transactions: localTxs, accounts: localAccs, categories: localCategories }); }
  };

  const renderIconInput = (icon: string, setIcon: (s: string) => void, currentName: string) => (
    <div className="space-y-4 w-full">
        <div className="flex flex-col sm:flex-row items-center gap-6 bg-slate-50 p-6 rounded-[2rem] border border-slate-100 shadow-inner">
            <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center border-4 border-white rounded-[1.5rem] bg-white overflow-hidden shadow-lg transition-transform hover:scale-105">
                {renderIcon(icon, "w-12 h-12")}
            </div>
            <div className="flex-1 space-y-3 w-full">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center sm:text-left">Identidad Visual</p>
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    <button onClick={async () => { if(!currentName) { alert("Escribe un nombre primero para buscar."); return; } setIsSearchingWeb(true); const results = await searchInternetLogos(currentName); setWebLogos(results); setIsSearchingWeb(false); }} className="px-5 py-3 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-950 transition-all flex items-center gap-2 shadow-lg">{isSearchingWeb ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>} IA Smart Search</button>
                    <button onClick={() => iconUploadRef.current?.click()} className="px-5 py-3 bg-white text-slate-900 border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"><ImageIcon size={14}/> Subir</button>
                    <input type="file" ref={iconUploadRef} className="hidden" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = ev => setIcon(ev.target?.result as string); reader.readAsDataURL(file); } }} />
                    <input type="text" className="w-16 px-2 py-3 bg-white border border-slate-200 rounded-xl font-bold text-center text-sm shadow-sm" value={icon.length < 5 ? icon : '📂'} onChange={e => setIcon(e.target.value)} placeholder="Emoji"/>
                </div>
            </div>
        </div>
        {webLogos.length > 0 && (
          <div className="bg-white p-6 rounded-[2.5rem] border-2 border-indigo-100 shadow-2xl space-y-5 animate-in slide-in-from-top-4 z-10 relative">
              <div className="flex justify-between items-center">
                  <span className="text-[11px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2"><Sparkles size={14}/> Resultados Encontrados</span>
                  <button onClick={() => setWebLogos([])} className="text-slate-300 hover:text-rose-500"><XCircle size={20}/></button>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3 max-h-64 overflow-y-auto p-2 custom-scrollbar">
                  {webLogos.map((l, i) => (
                      <button key={i} onClick={() => { setIcon(l.url); setWebLogos([]); }} className="aspect-square bg-slate-50 rounded-2xl border-2 border-transparent hover:border-indigo-500 p-2 transition-all flex items-center justify-center overflow-hidden shadow-sm group">
                          <img src={l.url} className="w-full h-full object-contain group-hover:scale-110 transition-transform" />
                      </button>
                  ))}
              </div>
          </div>
        )}
    </div>
  );

  return (
    <div className="space-y-12 max-w-full overflow-hidden pb-20">
      <div className="text-center md:text-left space-y-2">
        <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter">Ajustes.</h2>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em]">Personalización y Control Maestro</p>
      </div>

      <nav className="flex md:flex-wrap bg-slate-100 p-1.5 rounded-2xl shadow-inner border border-slate-200/50 overflow-x-auto md:overflow-visible scrollbar-hide">
        {[
            {id: 'ACC_GROUPS', label: 'Grupos', icon: <BoxSelect size={16}/>},
            {id: 'ACCOUNTS', label: 'Cuentas', icon: <Wallet size={16}/>},
            {id: 'FAMILIES', label: 'Familias', icon: <Layers size={16}/>},
            {id: 'CATEGORIES', label: 'Categorías', icon: <Tag size={16}/>},
            {id: 'RECURRENTS', label: 'Recurrentes', icon: <CalendarClock size={16}/>},
            {id: 'FAVORITES', label: 'Favoritos', icon: <Heart size={16}/>},
            {id: 'DATA', label: 'Datos', icon: <HardDriveDownload size={16}/>},
            {id: 'TOOLS', label: 'Herramientas', icon: <DatabaseZap size={16}/>}
        ].map(t => (
            <button key={t.id} className={`flex-1 min-w-[70px] sm:min-w-[fit-content] flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-6 py-2 sm:py-3.5 font-black text-[8px] sm:text-[10px] uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => { setActiveTab(t.id); resetForm(); }}>
              {t.icon} <span className="block sm:inline mt-1 sm:mt-0">{t.label}</span>
            </button>
        ))}
      </nav>

      <div className="max-w-4xl mx-auto">
        {/* ... (SECCIONES ACC_GROUPS, ACCOUNTS, FAMILIES, CATEGORIES MANTENIDAS) ... */}
        {activeTab === 'ACC_GROUPS' && (
            <div className="grid grid-cols-1 gap-10">
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
                    <h3 className="text-xl font-black text-slate-800 uppercase flex items-center gap-3"><BoxSelect className="text-indigo-600"/> {grpId ? 'Editar Grupo' : 'Nuevo Grupo de Cuentas'}</h3>
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nombre Descriptivo</label>
                            <input type="text" placeholder="Ej: Bancos..." className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={grpName} onChange={e => setGrpName(e.target.value)} />
                        </div>
                        {renderIconInput(grpIcon, setGrpIcon, grpName)}
                        <button onClick={() => { if(!grpName) return; if(grpId) onUpdateData({accountGroups: data.accountGroups.map(g=>g.id===grpId?{...g,name:grpName,icon:grpIcon}:g)}); else onUpdateData({accountGroups: [...data.accountGroups, {id:generateId(),name:grpName,icon:grpIcon}]}); resetForm(); }} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] hover:bg-indigo-600 shadow-xl">Guardar Grupo</button>
                    </div>
                </div>
                <div className="space-y-4">
                    {data.accountGroups.map(g => (
                        <div key={g.id} className="bg-white p-4 rounded-3xl border border-slate-100 flex items-center justify-between group hover:border-indigo-200 transition-all">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100">{renderIcon(g.icon, "w-6 h-6")}</div>
                                <span className="font-bold text-slate-700 uppercase text-xs">{g.name}</span>
                            </div>
                            <div className="flex gap-2 opacity-50 group-hover:opacity-100">
                                <button onClick={() => { setGrpId(g.id); setGrpName(g.name); setGrpIcon(g.icon); }} className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100"><Edit2 size={16}/></button>
                                <button onClick={() => { if(confirm('¿Borrar grupo?')) onUpdateData({accountGroups: data.accountGroups.filter(x => x.id !== g.id)}); }} className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'ACCOUNTS' && (
            <div className="grid grid-cols-1 gap-10">
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
                    <h3 className="text-xl font-black text-slate-800 uppercase flex items-center gap-3"><Wallet className="text-indigo-600"/> {accId ? 'Editar Cuenta' : 'Nueva Cuenta'}</h3>
                    <div className="space-y-6">
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                             <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nombre</label>
                                <input type="text" placeholder="Ej: Principal..." className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={accName} onChange={e => setAccName(e.target.value)} />
                             </div>
                             <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Saldo Inicial</label>
                                <input type="number" placeholder="0.00" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={accBalance} onChange={e => setAccBalance(e.target.value)} />
                             </div>
                         </div>
                         <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Grupo de Cuentas</label>
                             <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                 {data.accountGroups.map(g => (
                                     <button key={g.id} onClick={() => setAccGroupId(g.id)} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${accGroupId === g.id ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'}`}>
                                         {renderIcon(g.icon, "w-6 h-6")} <span className="text-[9px] font-black uppercase">{g.name}</span>
                                     </button>
                                 ))}
                             </div>
                         </div>
                         {renderIconInput(accIcon, setAccIcon, accName)}
                         <button onClick={() => { 
                             if(!accName || !accGroupId) return; 
                             const bal = parseFloat(accBalance) || 0;
                             if(accId) onUpdateData({accounts: data.accounts.map(a=>a.id===accId?{...a,name:accName,initialBalance:bal,icon:accIcon,groupId:accGroupId}:a)}); 
                             else onUpdateData({accounts: [...data.accounts, {id:generateId(),name:accName,initialBalance:bal,currency:'EUR',icon:accIcon,groupId:accGroupId}]}); 
                             resetForm(); 
                        }} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] hover:bg-indigo-600 shadow-xl">Guardar Cuenta</button>
                    </div>
                </div>
                <div className="space-y-4">
                    {data.accounts.map(a => (
                        <div key={a.id} className="bg-white p-4 rounded-3xl border border-slate-100 flex items-center justify-between group hover:border-indigo-200 transition-all">
                             <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100">{renderIcon(a.icon, "w-6 h-6")}</div>
                                <div>
                                    <span className="block font-bold text-slate-700 uppercase text-xs">{a.name}</span>
                                    <span className="text-[9px] font-black text-slate-400 uppercase">{data.accountGroups.find(g=>g.id===a.groupId)?.name} • {numberFormatter.format(a.initialBalance)}€</span>
                                </div>
                            </div>
                            <div className="flex gap-2 opacity-50 group-hover:opacity-100">
                                <button onClick={() => { setAccId(a.id); setAccName(a.name); setAccBalance(a.initialBalance.toString()); setAccIcon(a.icon); setAccGroupId(a.groupId); }} className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100"><Edit2 size={16}/></button>
                                <button onClick={() => { if(confirm('¿Borrar cuenta?')) onUpdateData({accounts: data.accounts.filter(x => x.id !== a.id)}); }} className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'FAMILIES' && (
            <div className="grid grid-cols-1 gap-10">
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
                    <h3 className="text-xl font-black text-slate-800 uppercase flex items-center gap-3"><Layers className="text-indigo-600"/> {famId ? 'Editar Familia' : 'Nueva Familia'}</h3>
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nombre</label>
                                <input type="text" placeholder="Ej: Vivienda..." className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={famName} onChange={e => setFamName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tipo de Flujo</label>
                                <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                                    <button onClick={() => setFamType('EXPENSE')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${famType === 'EXPENSE' ? 'bg-white shadow-sm text-rose-500' : 'text-slate-400'}`}>Gasto</button>
                                    <button onClick={() => setFamType('INCOME')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${famType === 'INCOME' ? 'bg-white shadow-sm text-emerald-500' : 'text-slate-400'}`}>Ingreso</button>
                                </div>
                            </div>
                        </div>
                        {renderIconInput(famIcon, setFamIcon, famName)}
                        <button onClick={() => { 
                             if(!famName) return; 
                             if(famId) onUpdateData({families: data.families.map(f=>f.id===famId?{...f,name:famName,type:famType,icon:famIcon}:f)}); 
                             else onUpdateData({families: [...data.families, {id:generateId(),name:famName,type:famType,icon:famIcon}]}); 
                             resetForm(); 
                        }} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] hover:bg-indigo-600 shadow-xl">Guardar Familia</button>
                    </div>
                </div>
                <div className="space-y-4">
                    {data.families.map(f => (
                         <div key={f.id} className="bg-white p-4 rounded-3xl border border-slate-100 flex items-center justify-between group hover:border-indigo-200 transition-all">
                             <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100">{renderIcon(f.icon, "w-6 h-6")}</div>
                                <div>
                                    <span className="block font-bold text-slate-700 uppercase text-xs">{f.name}</span>
                                    <span className={`text-[9px] font-black uppercase ${f.type === 'INCOME' ? 'text-emerald-500' : 'text-rose-500'}`}>{f.type === 'INCOME' ? 'Ingresos' : 'Gastos'}</span>
                                </div>
                            </div>
                            <div className="flex gap-2 opacity-50 group-hover:opacity-100">
                                <button onClick={() => { setFamId(f.id); setFamName(f.name); setFamType(f.type); setFamIcon(f.icon); }} className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100"><Edit2 size={16}/></button>
                                <button onClick={() => { if(confirm('¿Borrar familia?')) onUpdateData({families: data.families.filter(x => x.id !== f.id)}); }} className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'CATEGORIES' && (
            <div className="grid grid-cols-1 gap-10">
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
                     <h3 className="text-xl font-black text-slate-800 uppercase flex items-center gap-3"><Tag className="text-indigo-600"/> {catId ? 'Editar Categoría' : 'Nueva Categoría'}</h3>
                     <div className="space-y-6">
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                             <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nombre</label>
                                <input type="text" placeholder="Ej: Supermercado..." className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={catName} onChange={e => setCatName(e.target.value)} />
                             </div>
                             <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Familia Principal</label>
                                <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none cursor-pointer appearance-none" value={catParent} onChange={e => setCatParent(e.target.value)}>
                                    <option value="">Selecciona una familia...</option>
                                    {data.families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                             </div>
                         </div>
                         {renderIconInput(catIcon, setCatIcon, catName)}
                         <button onClick={() => { 
                             if(!catName || !catParent) return; 
                             if(catId) onUpdateData({categories: data.categories.map(c=>c.id===catId?{...c,name:catName,familyId:catParent,icon:catIcon}:c)}); 
                             else onUpdateData({categories: [...data.categories, {id:generateId(),name:catName,familyId:catParent,icon:catIcon}]}); 
                             resetForm(); 
                        }} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] hover:bg-indigo-600 shadow-xl">Guardar Categoría</button>
                     </div>
                </div>
                <div className="space-y-4">
                    {data.categories.map(c => {
                        const fam = data.families.find(f => f.id === c.familyId);
                        return (
                            <div key={c.id} className="bg-white p-4 rounded-3xl border border-slate-100 flex items-center justify-between group hover:border-indigo-200 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100">{renderIcon(c.icon, "w-6 h-6")}</div>
                                    <div>
                                        <span className="block font-bold text-slate-700 uppercase text-xs">{c.name}</span>
                                        <span className="text-[9px] font-black text-slate-400 uppercase">{fam?.name || 'Huérfana'}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2 opacity-50 group-hover:opacity-100">
                                    <button onClick={() => { setCatId(c.id); setCatName(c.name); setCatParent(c.familyId); setCatIcon(c.icon); }} className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100"><Edit2 size={16}/></button>
                                    <button onClick={() => { if(confirm('¿Borrar categoría?')) onUpdateData({categories: data.categories.filter(x => x.id !== c.id)}); }} className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100"><Trash2 size={16}/></button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        )}

        {activeTab === 'RECURRENTS' && (
            <div className="grid grid-cols-1 gap-10">
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
                     <h3 className="text-xl font-black text-slate-800 uppercase flex items-center gap-3"><CalendarClock className="text-indigo-600"/> {recId ? 'Editar Recurrente' : 'Nuevo Recurrente'}</h3>
                     <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Descripción</label><input type="text" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={recDesc} onChange={e => setRecDesc(e.target.value)} /></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Importe</label><input type="number" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={recAmount} onChange={e => setRecAmount(e.target.value)} /></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tipo</label><div className="flex bg-slate-100 p-1.5 rounded-2xl"><button onClick={() => setRecType('EXPENSE')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${recType === 'EXPENSE' ? 'bg-white shadow-sm text-rose-500' : 'text-slate-400'}`}>Gasto</button><button onClick={() => setRecType('INCOME')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${recType === 'INCOME' ? 'bg-white shadow-sm text-emerald-500' : 'text-slate-400'}`}>Ingreso</button></div></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Frecuencia</label><select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={recFreq} onChange={e => setRecFreq(e.target.value as any)}><option value="DAYS">Días</option><option value="WEEKS">Semanas</option><option value="MONTHLY">Meses</option><option value="YEARS">Años</option></select></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Cuenta</label><select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={recAcc} onChange={e => setRecAcc(e.target.value)}>{data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Categoría</label><select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={recCat} onChange={e => setRecCat(e.target.value)}><option value="">Select...</option>{data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Intervalo</label><input type="number" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={recInterval} onChange={e => setRecInterval(e.target.value)} /></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Próximo Vencimiento</label><input type="date" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={recStart} onChange={e => setRecStart(e.target.value)} /></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Fecha Final (Opcional)</label><input type="date" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={recEnd} onChange={e => setRecEnd(e.target.value)} /></div>
                        </div>
                        <button onClick={() => {
                             if(!recDesc || !recAmount || !recAcc) return;
                             const amt = parseFloat(recAmount);
                             const famId = data.categories.find(c => c.id === recCat)?.familyId || '';
                             const newRec: RecurrentMovement = {
                                 id: recId || generateId(),
                                 description: recDesc,
                                 amount: amt,
                                 type: recType,
                                 accountId: recAcc,
                                 categoryId: recCat,
                                 familyId: famId,
                                 frequency: recFreq,
                                 interval: parseInt(recInterval) || 1,
                                 startDate: recStart,
                                 nextDueDate: recStart,
                                 endDate: recEnd,
                                 active: true
                             };
                             if(recId) onUpdateData({ recurrents: data.recurrents?.map(r => r.id === recId ? newRec : r) });
                             else onUpdateData({ recurrents: [...(data.recurrents || []), newRec] });
                             resetForm();
                        }} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] hover:bg-indigo-600 shadow-xl">Guardar Recurrente</button>
                     </div>
                </div>
                <div className="space-y-4">
                    {data.recurrents?.map(r => (
                        <div key={r.id} className={`bg-white p-4 rounded-3xl border border-slate-100 flex items-center justify-between ${!r.active ? 'opacity-50' : ''}`}>
                            <div className="flex flex-col">
                                <span className="font-bold text-slate-700 text-xs uppercase">{r.description}</span>
                                <span className="text-[9px] font-black text-slate-400 uppercase">
                                    {r.active ? `Cada ${r.interval} ${r.frequency} • Próx: ${r.nextDueDate}` : 'INACTIVO'}
                                    {r.endDate && ` • Fin: ${r.endDate}`}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => { setRecId(r.id); setRecDesc(r.description); setRecAmount(r.amount.toString()); setRecType(r.type); setRecAcc(r.accountId); setRecCat(r.categoryId); setRecFreq(r.frequency); setRecInterval(r.interval.toString()); setRecStart(r.nextDueDate); setRecEnd(r.endDate || ''); }} className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><Edit2 size={16}/></button>
                                <button onClick={() => onUpdateData({ recurrents: data.recurrents?.filter(x => x.id !== r.id) })} className="p-3 bg-rose-50 text-rose-500 rounded-xl"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* ... (RESTO DE TABS: FAVORITES, DATA, TOOLS, MODALS MANTENIDOS) ... */}
        {activeTab === 'FAVORITES' && (
            <div className="grid grid-cols-1 gap-10">
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
                     <h3 className="text-xl font-black text-slate-800 uppercase flex items-center gap-3"><Heart className="text-indigo-600"/> {favId ? 'Editar Favorito' : 'Nuevo Favorito'}</h3>
                     <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                             <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Alias (Botón)</label><input type="text" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={favName} onChange={e => setFavName(e.target.value)} /></div>
                             <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Concepto Real</label><input type="text" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={favDesc} onChange={e => setFavDesc(e.target.value)} /></div>
                             <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Importe (Opcional)</label><input type="number" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={favAmount} onChange={e => setFavAmount(e.target.value)} /></div>
                             <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tipo</label><div className="flex bg-slate-100 p-1.5 rounded-2xl"><button onClick={() => setFavType('EXPENSE')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${favType === 'EXPENSE' ? 'bg-white shadow-sm text-rose-500' : 'text-slate-400'}`}>Gasto</button><button onClick={() => setFavType('INCOME')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${favType === 'INCOME' ? 'bg-white shadow-sm text-emerald-500' : 'text-slate-400'}`}>Ingreso</button></div></div>
                             <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Cuenta</label><select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={favAcc} onChange={e => setFavAcc(e.target.value)}>{data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                             <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Categoría</label><select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={favCat} onChange={e => setFavCat(e.target.value)}><option value="">Select...</option>{data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                        </div>
                        {renderIconInput(favIcon, setFavIcon, favName)}
                        <button onClick={() => {
                             if(!favName || !favDesc || !favAcc) return;
                             const amt = favAmount ? parseFloat(favAmount) : 0;
                             const famId = data.categories.find(c => c.id === favCat)?.familyId || '';
                             const newFav: FavoriteMovement = {
                                 id: favId || generateId(),
                                 name: favName,
                                 description: favDesc,
                                 amount: amt,
                                 type: favType,
                                 accountId: favAcc,
                                 categoryId: favCat,
                                 familyId: famId,
                                 icon: favIcon
                             };
                             if(favId) onUpdateData({ favorites: data.favorites?.map(f => f.id === favId ? newFav : f) });
                             else onUpdateData({ favorites: [...(data.favorites || []), newFav] });
                             resetForm();
                        }} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] hover:bg-indigo-600 shadow-xl">Guardar Favorito</button>
                     </div>
                </div>
                 <div className="space-y-4">
                    {data.favorites?.map(f => (
                        <div key={f.id} className="bg-white p-4 rounded-3xl border border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100">{renderIcon(f.icon || '⭐', "w-6 h-6")}</div>
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-700 text-xs uppercase">{f.name}</span>
                                    <span className="text-[9px] font-black text-slate-400 uppercase">{f.description} • {f.amount ? `${f.amount}€` : 'Manual'}</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => { setFavId(f.id); setFavName(f.name); setFavDesc(f.description); setFavAmount(f.amount.toString()); setFavType(f.type); setFavAcc(f.accountId); setFavCat(f.categoryId); setFavIcon(f.icon || '⭐'); }} className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><Edit2 size={16}/></button>
                                <button onClick={() => onUpdateData({ favorites: data.favorites?.filter(x => x.id !== f.id) })} className="p-3 bg-rose-50 text-rose-500 rounded-xl"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'DATA' && (
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-indigo-50 p-10 rounded-[3rem] border border-indigo-100 space-y-6 text-center">
                        <div className="mx-auto w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm"><HardDriveDownload size={32}/></div>
                        <div><h3 className="text-xl font-black text-indigo-900 uppercase">Exportar Datos</h3><p className="text-xs font-bold text-indigo-400 mt-2">Guarda una copia de seguridad completa del libro actual en tu dispositivo.</p></div>
                        <button onClick={handleExportBackup} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-indigo-700 transition-all">Descargar JSON</button>
                    </div>

                    <div className="bg-slate-50 p-10 rounded-[3rem] border border-slate-100 space-y-6 text-center">
                        <div className="mx-auto w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-slate-600 shadow-sm"><HardDriveUpload size={32}/></div>
                        <div><h3 className="text-xl font-black text-slate-900 uppercase">Restaurar Copia</h3><p className="text-xs font-bold text-slate-400 mt-2">Importa datos desde un archivo .json previamente exportado.</p></div>
                        <button onClick={() => backupInputRef.current?.click()} className="w-full py-4 bg-white text-slate-900 border-2 border-slate-200 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-sm hover:border-indigo-500 hover:text-indigo-600 transition-all">Seleccionar Archivo</button>
                        <input type="file" ref={backupInputRef} className="hidden" accept=".json" onChange={handleFileSelect} />
                    </div>
                </div>

                {/* ZONA DE PELIGRO: Borrado */}
                <div className="bg-rose-50 p-10 rounded-[3rem] border border-rose-100 space-y-6 text-center mt-8">
                    <div className="mx-auto w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-rose-600 shadow-sm"><ShieldAlert size={32}/></div>
                    <div>
                        <h3 className="text-xl font-black text-rose-900 uppercase">Zona de Peligro</h3>
                        <p className="text-xs font-bold text-rose-400 mt-2">Acciones destructivas. Requieren verificación.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {/* 1. Borrar por Año */}
                        <div className="p-6 bg-white rounded-[2rem] border border-rose-100 space-y-3 flex flex-col justify-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase">Borrar por Año</p>
                            <div className="flex gap-2">
                                <select 
                                    className="w-full bg-slate-50 border border-slate-200 font-bold text-sm rounded-xl px-3 outline-none text-slate-700" 
                                    value={yearToDelete} 
                                    onChange={e => setYearToDelete(e.target.value)}
                                >
                                    <option value="" disabled>Año</option>
                                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                                <button 
                                    onClick={() => openVerification('YEAR', yearToDelete)}
                                    className="bg-rose-600 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase hover:bg-rose-700 shadow-lg disabled:opacity-50"
                                    disabled={!yearToDelete}
                                >
                                    Borrar
                                </button>
                            </div>
                        </div>

                        {/* 2. Borrar Todos los Movimientos */}
                        <button 
                            onClick={() => openVerification('ALL_TX')}
                            className="p-6 bg-white rounded-[2rem] border border-rose-100 flex flex-col items-center justify-center gap-2 hover:border-rose-300 hover:shadow-lg transition-all group"
                        >
                            <Eraser size={24} className="text-rose-400 group-hover:text-rose-600 mb-1"/>
                            <span className="text-[10px] font-black text-rose-600 uppercase">Borrar TODOS los Movimientos</span>
                        </button>

                         {/* 3. Eliminar Libro Completo (o Reset) */}
                         <button 
                            onClick={() => openVerification('BOOK')}
                            className="p-6 bg-rose-600 text-white rounded-[2rem] border border-rose-600 flex flex-col items-center justify-center gap-2 hover:bg-rose-700 hover:shadow-xl transition-all group"
                        >
                            <Trash2 size={24} className="text-white/80 group-hover:text-white mb-1"/>
                            <span className="text-[10px] font-black text-white uppercase">Eliminar Libro Completo</span>
                        </button>
                    </div>
                </div>

                {restoreFile && (
                    <div className="bg-white p-10 rounded-[3rem] border-2 border-indigo-100 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5"><Archive size={160}/></div>
                        <div className="relative z-10 space-y-8">
                             <div className="flex items-center gap-4">
                                <div className="bg-emerald-100 text-emerald-600 p-3 rounded-2xl"><CheckCircle2 size={24}/></div>
                                <div><h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Archivo Cargado</h3><p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{restoreFileName}</p></div>
                             </div>
                             
                             <div className="bg-slate-50 rounded-2xl p-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
                                 <div><p className="text-[10px] font-black text-slate-400 uppercase">Movimientos</p><p className="text-xl font-black text-slate-800">{restoreFile.transactions?.length || 0}</p></div>
                                 <div><p className="text-[10px] font-black text-slate-400 uppercase">Cuentas</p><p className="text-xl font-black text-slate-800">{restoreFile.accounts?.length || 0}</p></div>
                                 <div><p className="text-[10px] font-black text-slate-400 uppercase">Familias</p><p className="text-xl font-black text-slate-800">{restoreFile.families?.length || 0}</p></div>
                                 <div><p className="text-[10px] font-black text-slate-400 uppercase">Categorías</p><p className="text-xl font-black text-slate-800">{restoreFile.categories?.length || 0}</p></div>
                             </div>

                             <div className="space-y-3 pt-4">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-2">¿Cómo deseas proceder?</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <button 
                                        onClick={() => { 
                                            if(window.confirm('¿Estás seguro? Esto borrará todos los datos del libro actual.')) { 
                                                onUpdateData(restoreFile); 
                                                alert('Datos restaurados correctamente en el libro actual.'); 
                                                resetForm(); 
                                            } 
                                        }} 
                                        className="py-5 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-black uppercase text-[11px] hover:border-rose-500 hover:text-rose-500 transition-all"
                                    >
                                        Sobrescribir Libro Actual
                                    </button>
                                    <button 
                                        onClick={() => { 
                                            if(onCreateBookFromImport) {
                                                const bookName = prompt("Introduce el nombre para el nuevo libro contable:", restoreFileName || "Libro Importado");
                                                if (!bookName) return;
                                                onCreateBookFromImport(restoreFile, bookName);
                                                alert('Se ha creado un nuevo libro con los datos importados.');
                                                resetForm();
                                            }
                                        }} 
                                        className="py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[11px] shadow-xl hover:bg-indigo-700 transition-all"
                                    >
                                        Crear como Nuevo Libro
                                    </button>
                                </div>
                             </div>
                        </div>
                    </div>
                )}
            </div>
        )}

        {activeTab === 'TOOLS' && (
            <div className="space-y-12">
                <div className="bg-indigo-600 p-10 rounded-[3rem] text-white space-y-8 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:scale-110 transition-transform"><Bot size={120}/></div>
                    <div className="relative z-10 space-y-4 text-center sm:text-left">
                        <h3 className="text-3xl font-black uppercase tracking-tighter">Importación Inteligente</h3>
                        <p className="text-indigo-100 text-sm font-medium">Carga tus extractos bancarios y deja que el Bot sugiera categorías basándose en tu historial.</p>
                        <button onClick={() => onNavigateToTransactions?.({ action: 'IMPORT' })} className="px-8 py-4 bg-white text-indigo-600 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl flex items-center justify-center gap-3 hover:scale-105 active:scale-95 transition-all">
                           <Bot size={20}/> Lanzar Smart Import
                        </button>
                    </div>
                </div>

                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3"><ClipboardPaste className="text-indigo-600" size={28}/> Importador Maestro</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pegar desde Portapapeles</label>
                            <textarea className="w-full h-36 p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] font-mono text-[10px] outline-none shadow-inner" placeholder="Pega las líneas aquí..." value={pasteData} onChange={e => setPasteData(e.target.value)} />
                            <button onClick={() => handleProcessImport(pasteData)} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl">Procesar Datos</button>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>

      {verificationModal && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[200] p-6 animate-in fade-in duration-300">
              <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-sm p-10 text-center relative border border-white/20">
                  <button onClick={() => setVerificationModal(null)} className="absolute top-6 right-6 p-2 bg-slate-50 text-slate-400 rounded-full hover:text-rose-500 hover:bg-rose-50 transition-all"><X size={20}/></button>
                  <div className="mx-auto w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center border border-rose-100 mb-6 shadow-sm text-rose-500">
                      <ShieldAlert size={40}/>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Confirmación de Seguridad</h3>
                  <p className="text-xs font-medium text-slate-500 mb-6">
                      Esta acción es irreversible. Para confirmar, escribe la palabra <span className="font-black text-rose-600">BORRAR</span> en el recuadro.
                  </p>
                  
                  <input 
                      type="text" 
                      placeholder="Escribe BORRAR" 
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-center outline-none focus:border-rose-500 transition-all uppercase mb-6"
                      value={verificationInput}
                      onChange={e => setVerificationInput(e.target.value.toUpperCase())}
                  />

                  <button 
                      onClick={executeDangerousAction}
                      disabled={verificationInput !== 'BORRAR'}
                      className={`w-full py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl transition-all flex items-center justify-center gap-2 ${verificationInput === 'BORRAR' ? 'bg-rose-600 text-white hover:bg-rose-700 active:scale-95' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                  >
                      <Trash2 size={16}/> Confirmar Eliminación
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};
