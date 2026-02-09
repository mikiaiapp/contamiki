
import React, { useState, useRef, useMemo } from 'react';
import { AppState, Account, Family, Category, Transaction, TransactionType, AccountGroup, ImportReport, RecurrentMovement, FavoriteMovement, RecurrenceFrequency } from '../types';
import { Trash2, Edit2, Layers, Tag, Wallet, Loader2, Sparkles, XCircle, Download, DatabaseZap, ClipboardPaste, CheckCircle2, BoxSelect, FileJson, Info, AlertTriangle, Eraser, FileSpreadsheet, Upload, FolderTree, ArrowRightLeft, Receipt, Check, Image as ImageIcon, CalendarClock, Heart, Clock, Calendar } from 'lucide-react';
import { searchInternetLogos } from '../services/iconService';
import * as XLSX from 'xlsx';

interface SettingsViewProps {
  data: AppState;
  onUpdateData: (newData: Partial<AppState>) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

// Se utiliza 'de-DE' para forzar estrictamente el formato 1.000,00 (Punto miles, Coma decimales)
const numberFormatter = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

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

  // Recurrents Form State
  const [recId, setRecId] = useState<string | null>(null);
  const [recDesc, setRecDesc] = useState('');
  const [recAmount, setRecAmount] = useState('');
  const [recType, setRecType] = useState<TransactionType>('EXPENSE');
  const [recAcc, setRecAcc] = useState('');
  const [recCat, setRecCat] = useState('');
  const [recFreq, setRecFreq] = useState<RecurrenceFrequency>('MONTHLY');
  const [recInterval, setRecInterval] = useState('1');
  const [recStart, setRecStart] = useState(new Date().toISOString().split('T')[0]);

  // Favorites Form State
  const [favId, setFavId] = useState<string | null>(null);
  const [favName, setFavName] = useState('');
  const [favDesc, setFavDesc] = useState('');
  const [favAmount, setFavAmount] = useState('');
  const [favType, setFavType] = useState<TransactionType>('EXPENSE');
  const [favAcc, setFavAcc] = useState('');
  const [favCat, setFavCat] = useState('');
  const [favIcon, setFavIcon] = useState('⭐');

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '--/--/--';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year.slice(-2)}`;
  };

  const formatCurrency = (amount: number, type: 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'NEUTRAL' = 'NEUTRAL') => {
    const value = type === 'EXPENSE' ? -Math.abs(amount) : amount;
    return `${numberFormatter.format(value)} €`;
  };

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
    
    setRecId(null); setRecDesc(''); setRecAmount(''); setRecType('EXPENSE'); setRecAcc(data.accounts[0]?.id || ''); setRecCat(''); setRecFreq('MONTHLY'); setRecInterval('1'); setRecStart(new Date().toISOString().split('T')[0]);
    
    setFavId(null); setFavName(''); setFavDesc(''); setFavAmount(''); setFavType('EXPENSE'); setFavAcc(data.accounts[0]?.id || ''); setFavCat(''); setFavIcon('⭐');

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

  const handleSaveRecurrent = () => {
    if (!recDesc || !recAmount || !recAcc || !recCat) {
      alert("Faltan datos obligatorios."); return;
    }
    const newRec: RecurrentMovement = {
      id: recId || generateId(),
      description: recDesc,
      amount: Math.abs(parseFloat(recAmount)),
      type: recType,
      accountId: recAcc,
      familyId: data.categories.find(c => c.id === recCat)?.familyId || '',
      categoryId: recCat,
      frequency: recFreq,
      interval: parseInt(recInterval) || 1,
      startDate: recStart,
      nextDueDate: recStart, // Para simplificar, asumimos que vence en la fecha de inicio al crearlo
      active: true
    };

    const currentRecurrents = data.recurrents || [];
    if (recId) {
      onUpdateData({ recurrents: currentRecurrents.map(r => r.id === recId ? newRec : r) });
    } else {
      onUpdateData({ recurrents: [...currentRecurrents, newRec] });
    }
    resetForm();
  };

  const handleSaveFavorite = () => {
    if (!favName || !favDesc || !favAmount || !favAcc || !favCat) {
      alert("Faltan datos obligatorios."); return;
    }
    const newFav: FavoriteMovement = {
      id: favId || generateId(),
      name: favName,
      description: favDesc,
      amount: Math.abs(parseFloat(favAmount)),
      type: favType,
      accountId: favAcc,
      familyId: data.categories.find(c => c.id === favCat)?.familyId || '',
      categoryId: favCat,
      icon: favIcon
    };

    const currentFavorites = data.favorites || [];
    if (favId) {
      onUpdateData({ favorites: currentFavorites.map(f => f.id === favId ? newFav : f) });
    } else {
      onUpdateData({ favorites: [...currentFavorites, newFav] });
    }
    resetForm();
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
            {id: 'RECURRENTS', label: 'Recurrentes', icon: <CalendarClock size={16}/>},
            {id: 'FAVORITES', label: 'Favoritos', icon: <Heart size={16}/>},
            {id: 'TOOLS', label: 'Herramientas', icon: <DatabaseZap size={16}/>}
        ].map(t => (
            <button key={t.id} className={`flex-1 flex items-center justify-center gap-2 px-6 py-3.5 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => { setActiveTab(t.id); resetForm(); }}>
              {t.icon} <span className="hidden sm:inline">{t.label}</span>
            </button>
        ))}
      </nav>

      <div className="max-w-4xl mx-auto">
        {activeTab === 'ACC_GROUPS' && (
            <div className="