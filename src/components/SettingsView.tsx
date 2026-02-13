
// ... existing imports ...
import React, { useState, useRef, useMemo } from 'react';
import { AppState, Account, Family, Category, Transaction, TransactionType, AccountGroup, ImportReport, RecurrentMovement, FavoriteMovement, RecurrenceFrequency, BookMetadata, BookColor } from '../types';
import { Trash2, Edit2, Layers, Tag, Wallet, Loader2, Sparkles, XCircle, Download, DatabaseZap, ClipboardPaste, CheckCircle2, BoxSelect, FileJson, Info, AlertTriangle, Eraser, FileSpreadsheet, Upload, FolderTree, ArrowRightLeft, Receipt, Check, Image as ImageIcon, CalendarClock, Heart, Clock, Calendar, Archive, RefreshCw, X, HardDriveDownload, HardDriveUpload, Bot, ShieldAlert, Monitor, Palette, Eye, EyeOff, Plus, ChevronDown, BookCopy, BookPlus, AlertOctagon } from 'lucide-react';
import { searchInternetLogos } from '../services/iconService';
import * as XLSX from 'xlsx';

// ... existing interfaces ...
interface SettingsViewProps {
  data: AppState;
  books: BookMetadata[];
  onUpdateData: (newData: Partial<AppState>) => void;
  onNavigateToTransactions?: (filters: any) => void;
  onCreateBookFromImport?: (data: AppState, name: string, color?: BookColor) => void;
  onDeleteBook?: () => void;
  onExportData: (targetId: string) => void;
  onRestoreToBook?: (bookId: string, data: AppState) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 15);
const numberFormatter = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ... existing helper functions (compressLogo) ...
const compressLogo = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Limitamos tamaño para localStorage
                const MAX_WIDTH = 512; 
                let width = img.width;
                let height = img.height;
                
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};

export const SettingsView: React.FC<SettingsViewProps> = ({ data, books, onUpdateData, onNavigateToTransactions, onCreateBookFromImport, onDeleteBook, onExportData, onRestoreToBook }) => {
  // ... existing state definitions ...
  const [activeTab, setActiveTab] = useState('ACC_GROUPS');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Data & Import States
  const [importType, setImportType] = useState<'GROUPS' | 'ACCOUNTS' | 'FAMILIES' | 'CATEGORIES' | 'TRANSACTIONS' | 'TRANSFER'>('TRANSACTIONS');
  const [pasteData, setPasteData] = useState('');
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [structureReport, setStructureReport] = useState<{ added: number, type: string } | null>(null);
  
  // Backup State
  const [restoreFile, setRestoreFile] = useState<AppState | null>(null);
  const [restoreFileName, setRestoreFileName] = useState('');
  const [exportTarget, setExportTarget] = useState<string>('ALL');
  
  // Restore Modal State
  const [restoreTargetBook, setRestoreTargetBook] = useState<string>('');
  const [newBookName, setNewBookName] = useState('');
  const [newBookColor, setNewBookColor] = useState<BookColor>('BLACK');
  
  // Delete State
  const [yearToDelete, setYearToDelete] = useState<string>('');
  const [verificationModal, setVerificationModal] = useState<{ type: 'YEAR' | 'ALL_TX' | 'BOOK', payload?: any } | null>(null);
  const [verificationInput, setVerificationInput] = useState('');
  
  // Icon Search State
  const [webLogos, setWebLogos] = useState<{url: string, source: string}[]>([]);
  const [isSearchingWeb, setIsSearchingWeb] = useState(false);
  
  // Custom Logo State
  const [customLogoPreview, setCustomLogoPreview] = useState<string>(localStorage.getItem('contamiki_custom_logo') || '');

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const iconUploadRef = useRef<HTMLInputElement>(null);
  const logoUploadRef = useRef<HTMLInputElement>(null);

  // Form States (Acc, Fam, Cat, etc)
  const [grpId, setGrpId] = useState<string | null>(null);
  const [grpName, setGrpName] = useState('');
  const [grpIcon, setGrpIcon] = useState('🗂️');

  const [accId, setAccId] = useState<string | null>(null);
  const [accName, setAccName] = useState('');
  const [accBalance, setAccBalance] = useState('');
  const [accIcon, setAccIcon] = useState('🏦');
  const [accGroupId, setAccGroupId] = useState('');
  const [accActive, setAccActive] = useState(true);

  const [famId, setFamId] = useState<string | null>(null);
  const [famName, setFamName] = useState('');
  const [famType, setFamType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [famIcon, setFamIcon] = useState('📂');

  const [catId, setCatId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');
  const [catParent, setCatParent] = useState('');
  const [catIcon, setCatIcon] = useState('🏷️');
  const [catActive, setCatActive] = useState(true);

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
    setAccId(null); setAccName(''); setAccBalance(''); setAccIcon('🏦'); setAccGroupId(data.accountGroups[0]?.id || ''); setAccActive(true);
    setFamId(null); setFamName(''); setFamIcon('📂'); setFamType('EXPENSE');
    setCatId(null); setCatName(''); setCatIcon('🏷️'); setCatParent(data.families[0]?.id || ''); setCatActive(true);
    setRecId(null); setRecDesc(''); setRecAmount(''); setRecType('EXPENSE'); setRecAcc(data.accounts[0]?.id || ''); setRecCat(''); setRecFreq('MONTHLY'); setRecInterval('1'); setRecStart(new Date().toISOString().split('T')[0]); setRecEnd('');
    setFavId(null); setFavName(''); setFavDesc(''); setFavAmount(''); setFavType('EXPENSE'); setFavAcc(data.accounts[0]?.id || ''); setFavCat(''); setFavIcon('⭐');
    setImportReport(null); setStructureReport(null); setPasteData('');
    setWebLogos([]);
    setRestoreFile(null); setRestoreFileName('');
    setYearToDelete(availableYears[0] || '');
    setExportTarget('ALL');
    setVerificationModal(null); setVerificationInput('');
    setIsEditModalOpen(false);
    setNewBookName(''); setNewBookColor('BLACK'); setRestoreTargetBook('');
  };

  const openEditor = () => {
      setIsEditModalOpen(true);
  };

  const renderIcon = (iconStr: string, className = "w-10 h-10") => {
    if (!iconStr) return <span className="text-xl">📂</span>;
    if (iconStr.startsWith('http') || iconStr.startsWith('data:image')) return <img src={iconStr} className={`${className} object-contain rounded-lg`} referrerPolicy="no-referrer" />;
    return <span className="text-xl">{iconStr}</span>;
  }

  // ... (Delete protectors) ...
  const attemptDeleteAccount = (account: Account) => {
      const usageCount = data.transactions.filter(t => t.accountId === account.id || t.transferAccountId === account.id).length;
      if (usageCount > 0) {
          alert(`No se puede borrar esta cuenta porque tiene ${usageCount} movimientos asociados. Edítala y desactívala (Archivar) para ocultarla sin perder datos.`);
          return;
      }
      if (confirm('¿Borrar cuenta permanentemente?')) {
          onUpdateData({accounts: data.accounts.filter(x => x.id !== account.id)});
      }
  };

  const attemptDeleteCategory = (category: Category) => {
      const usageCount = data.transactions.filter(t => t.categoryId === category.id).length;
      if (usageCount > 0) {
          alert(`No se puede borrar esta categoría porque tiene ${usageCount} movimientos asociados. Edítala y desactívala (Archivar) para ocultarla sin perder datos.`);
          return;
      }
      if (confirm('¿Borrar categoría permanentemente?')) {
          onUpdateData({categories: data.categories.filter(x => x.id !== category.id)});
      }
  };

  // HANDLER PRINCIPAL DE RESTAURACIÓN
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (ev) => {
          try {
              const content = JSON.parse(ev.target?.result as string);
              // Validación básica: Comprobar si es AppState (tiene transactions) o MultiBookState (tiene booksData)
              const isSingleBook = Array.isArray(content.transactions);
              const isMultiBook = content.booksMetadata && Array.isArray(content.booksMetadata);

              if (isSingleBook || isMultiBook) {
                  setRestoreFile(content);
                  setRestoreFileName(file.name.replace('.json', ''));
              } else {
                  alert("El archivo no parece una copia de seguridad válida de ContaMiki.");
              }
          } catch (err) {
              console.error(err);
              alert("Error al leer el archivo JSON.");
          }
      };
      reader.readAsText(file);
      e.target.value = ''; // Reset input
  };

  // ... (executeRestore, handleLogoUpload, handleRemoveLogo, openVerification, executeDangerousAction, handleProcessImport, renderIconInput) ...
  const executeRestore = (target: 'CURRENT' | 'OTHER' | 'NEW') => {
      if (!restoreFile) return;
      
      let dataToRestore: AppState = restoreFile as AppState;
      
      if ((restoreFile as any).booksData) {
          const mb = restoreFile as any;
          const targetId = mb.currentBookId || (mb.booksData && Object.keys(mb.booksData).length > 0 ? Object.keys(mb.booksData)[0] : null);
          
          if (targetId && mb.booksData[targetId]) {
             dataToRestore = mb.booksData[targetId];
             alert("Aviso: Has seleccionado un backup completo del sistema. Se restaurarán los datos del libro principal contenido en el archivo.");
          } else {
             alert("Error crítico: El archivo de respaldo está dañado o no contiene libros válidos.");
             return;
          }
      }

      if (target === 'CURRENT') {
          if (confirm("ATENCIÓN: Esto SOBREESCRIBIRÁ todos los datos del libro actual. ¿Continuar?")) {
              onUpdateData(dataToRestore);
              setRestoreFile(null);
          }
      } else if (target === 'OTHER') {
          if (!restoreTargetBook) return;
          if (confirm("ATENCIÓN: Esto SOBREESCRIBIRÁ los datos del libro seleccionado. ¿Continuar?")) {
              onRestoreToBook?.(restoreTargetBook, dataToRestore);
              setRestoreFile(null);
          }
      } else if (target === 'NEW') {
          if (!newBookName) return;
          onCreateBookFromImport?.(dataToRestore, newBookName, newBookColor);
          setRestoreFile(null);
      }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
          const base64 = await compressLogo(file);
          localStorage.setItem('contamiki_custom_logo', base64);
          setCustomLogoPreview(base64);
          window.dispatchEvent(new Event('contamiki_logo_changed'));
          alert("Logo actualizado correctamente.");
      } catch (err) {
          console.error(err);
          alert("Error al procesar la imagen.");
      }
      e.target.value = '';
  };

  const handleRemoveLogo = () => {
      localStorage.removeItem('contamiki_custom_logo');
      setCustomLogoPreview('');
      window.dispatchEvent(new Event('contamiki_logo_changed'));
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
    // ... (same as original) ...
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
        case 'ACCOUNTS': const accGrp = localGroups.find(g => g.name.toLowerCase() === parts[1]?.toLowerCase()) || localGroups[0]; if (!localAccs.find(a => a.name.toLowerCase() === parts[0].toLowerCase())) { localAccs.push({ id: generateId(), name: parts[0], initialBalance: parseFloat(parts[2]) || 0, currency: 'EUR', icon: parts[3] || '🏦', groupId: accGrp?.id || 'g1', active: true }); addedCount++; } break;
        case 'FAMILIES': const fType = parts[1]?.toUpperCase() === 'INCOME' ? 'INCOME' : 'EXPENSE'; if (!localFamilies.find(f => f.name.toLowerCase() === parts[0].toLowerCase())) { localFamilies.push({ id: generateId(), name: parts[0], type: fType, icon: parts[2] || '📂' }); addedCount++; } break;
        case 'CATEGORIES': const fParent = localFamilies.find(f => f.name.toLowerCase() === parts[1]?.toLowerCase()) || localFamilies[0]; if (!localCategories.find(c => c.name.toLowerCase() === parts[0].toLowerCase())) { localCategories.push({ id: generateId(), name: parts[0], familyId: fParent?.id || 'f1', icon: parts[2] || '🏷️', active: true }); addedCount++; } break;
        case 'TRANSACTIONS': const amountVal = parseFloat(parts[4].replace(',', '.')); if (isNaN(amountVal)) return; let txAcc = localAccs.find(a => a.name.toLowerCase() === parts[2].toLowerCase()); if (!txAcc) { txAcc = { id: generateId(), name: parts[2], initialBalance: 0, currency: 'EUR', icon: '🏦', groupId: localGroups[0]?.id || 'g1', active: true }; localAccs.push(txAcc); txReport.newAccounts.push(parts[2]); } let txCat = localCategories.find(c => c.name.toLowerCase() === parts[1].toLowerCase()); if (!txCat) { txCat = { id: generateId(), name: parts[1], familyId: localFamilies[0]?.id || 'f1', icon: '🏷️', active: true }; localCategories.push(txCat); txReport.newCategories.push(parts[1]); } localTxs.push({ id: generateId(), date: parts[0], description: parts[3], amount: amountVal, type: amountVal < 0 ? 'EXPENSE' : 'INCOME', accountId: txAcc.id, categoryId: txCat.id, familyId: txCat.familyId }); txReport.added++; break;
      }
    });
    if (['GROUPS', 'ACCOUNTS', 'FAMILIES', 'CATEGORIES'].includes(importType)) { setStructureReport({ added: addedCount, type: importType }); onUpdateData({ accountGroups: localGroups, accounts: localAccs, families: localFamilies, categories: localCategories }); } else { setImportReport(txReport); onUpdateData({ transactions: localTxs, accounts: localAccs, categories: localCategories }); }
  };

  const renderIconInput = (icon: string, setIcon: (s: string) => void, currentName: string) => (
    // ... (same as original) ...
    <div className="space-y-4 w-full">
        <div className="flex flex-col sm:flex-row items-center gap-6 bg-slate-50 p-4 sm:p-6 rounded-[2rem] border border-slate-100 shadow-inner">
            <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 flex items-center justify-center border-4 border-white rounded-[1.5rem] bg-white overflow-hidden shadow-lg transition-transform hover:scale-105">
                {renderIcon(icon, "w-10 h-10 sm:w-12 sm:h-12")}
            </div>
            <div className="flex-1 space-y-3 w-full">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center sm:text-left">Identidad Visual</p>
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    <button onClick={async () => { if(!currentName) { alert("Escribe un nombre primero para buscar."); return; } setIsSearchingWeb(true); const results = await searchInternetLogos(currentName); setWebLogos(results); setIsSearchingWeb(false); }} className="px-5 py-3 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-950 transition-all flex items-center gap-2 shadow-lg">{isSearchingWeb ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>} IA Search</button>
                    <button onClick={() => iconUploadRef.current?.click()} className="px-5 py-3 bg-white text-slate-900 border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"><ImageIcon size={14}/> Subir</button>
                    <input type="file" ref={iconUploadRef} className="hidden" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = ev => setIcon(ev.target?.result as string); reader.readAsDataURL(file); } }} />
                    <input type="text" className="w-16 px-2 py-3 bg-white border border-slate-200 rounded-xl font-bold text-center text-sm shadow-sm" value={icon.length < 5 ? icon : '📂'} onChange={e => setIcon(e.target.value)} placeholder="Emoji"/>
                </div>
            </div>
        </div>
        {webLogos.length > 0 && (
          <div className="bg-white p-6 rounded-[2.5rem] border-2 border-indigo-100 shadow-2xl space-y-5 animate-in slide-in-from-top-4 z-[300] relative">
              <div className="flex justify-between items-center">
                  <span className="text-[11px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2"><Sparkles size={14}/> Resultados Encontrados</span>
                  <button onClick={() => setWebLogos([])} className="text-slate-300 hover:text-rose-500"><XCircle size={20}/></button>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 max-h-64 overflow-y-auto p-2 custom-scrollbar">
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
            {id: 'UI', label: 'Interfaz', icon: <Palette size={16}/>},
            {id: 'DATA', label: 'Datos', icon: <HardDriveDownload size={16}/>},
            {id: 'TOOLS', label: 'Herramientas', icon: <DatabaseZap size={16}/>}
        ].map(t => (
            <button key={t.id} className={`flex-1 min-w-[70px] sm:min-w-[fit-content] flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-6 py-2 sm:py-3.5 font-black text-[8px] sm:text-[10px] uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => { setActiveTab(t.id); resetForm(); }}>
              {t.icon} <span className="block sm:inline mt-1 sm:mt-0">{t.label}</span>
            </button>
        ))}
      </nav>

      <div className="max-w-4xl mx-auto">
        
        {/* ... (Existing Tabs content for ACC_GROUPS, ACCOUNTS, FAMILIES, CATEGORIES, RECURRENTS, FAVORITES, UI, TOOLS) ... */}
        {activeTab === 'ACC_GROUPS' && (
            // ... (Same content as before)
            <div className="space-y-6">
                <button onClick={() => { resetForm(); openEditor(); }} className="w-full py-4 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-indigo-600 shadow-xl flex items-center justify-center gap-2"><Plus size={16}/> Nueva Grupo</button>
                <div className="space-y-4">
                    {data.accountGroups.map(g => (
                        <div key={g.id} className="bg-white p-4 rounded-3xl border border-slate-100 flex items-center justify-between group hover:border-indigo-200 transition-all">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100">{renderIcon(g.icon, "w-6 h-6")}</div>
                                <span className="font-bold text-slate-700 uppercase text-xs">{g.name}</span>
                            </div>
                            <div className="flex gap-2 opacity-50 group-hover:opacity-100">
                                <button onClick={() => { setGrpId(g.id); setGrpName(g.name); setGrpIcon(g.icon); openEditor(); }} className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100"><Edit2 size={16}/></button>
                                <button onClick={() => { if(confirm('¿Borrar grupo?')) onUpdateData({accountGroups: data.accountGroups.filter(x => x.id !== g.id)}); }} className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))}
                </div>
                {/* MODAL EDITOR GRUPOS */}
                {isEditModalOpen && (
                    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-in fade-in zoom-in duration-300">
                        <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg p-10 relative border border-white/20">
                            <button onClick={resetForm} className="absolute top-8 right-8 p-3 bg-slate-50 text-slate-400 rounded-full hover:text-rose-500 hover:bg-rose-50 transition-all"><X size={24}/></button>
                            <h3 className="text-2xl font-black text-slate-900 uppercase flex items-center gap-3 mb-8"><BoxSelect className="text-indigo-600"/> {grpId ? 'Editar Grupo' : 'Nuevo Grupo'}</h3>
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nombre Descriptivo</label>
                                    <input type="text" placeholder="Ej: Bancos..." className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={grpName} onChange={e => setGrpName(e.target.value)} />
                                </div>
                                {renderIconInput(grpIcon, setGrpIcon, grpName)}
                                <button onClick={() => { if(!grpName) return; if(grpId) onUpdateData({accountGroups: data.accountGroups.map(g=>g.id===grpId?{...g,name:grpName,icon:grpIcon}:g)}); else onUpdateData({accountGroups: [...data.accountGroups, {id:generateId(),name:grpName,icon:grpIcon}]}); resetForm(); }} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] hover:bg-indigo-600 shadow-xl">Guardar Grupo</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}
        
        {/* ... (Repeat for ACCOUNTS, FAMILIES, CATEGORIES, RECURRENTS, FAVORITES, UI) ... */}
        {activeTab === 'ACCOUNTS' && (
            <div className="space-y-6">
                <button onClick={() => { resetForm(); openEditor(); }} className="w-full py-4 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-indigo-600 shadow-xl flex items-center justify-center gap-2"><Plus size={16}/> Nueva Cuenta</button>
                <div className="space-y-4">
                    {data.accounts.map(a => (
                        <div key={a.id} className={`bg-white p-4 rounded-3xl border border-slate-100 flex items-center justify-between group hover:border-indigo-200 transition-all ${a.active === false ? 'opacity-50 grayscale' : ''}`}>
                             <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 relative">
                                    {renderIcon(a.icon, "w-6 h-6")}
                                    {a.active === false && <div className="absolute inset-0 bg-slate-100/50 backdrop-blur-[1px] rounded-2xl flex items-center justify-center"><EyeOff size={16} className="text-slate-400"/></div>}
                                </div>
                                <div>
                                    <span className="block font-bold text-slate-700 uppercase text-xs">{a.name}</span>
                                    <span className="text-[9px] font-black text-slate-400 uppercase">{data.accountGroups.find(g=>g.id===a.groupId)?.name} • {numberFormatter.format(a.initialBalance)}€</span>
                                </div>
                            </div>
                            <div className="flex gap-2 opacity-50 group-hover:opacity-100">
                                <button onClick={() => { setAccId(a.id); setAccName(a.name); setAccBalance(a.initialBalance.toString()); setAccIcon(a.icon); setAccGroupId(a.groupId); setAccActive(a.active !== false); openEditor(); }} className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100"><Edit2 size={16}/></button>
                                <button onClick={() => attemptDeleteAccount(a)} className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))}
                </div>
                {/* MODAL EDITOR CUENTAS */}
                {isEditModalOpen && (
                    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-in fade-in zoom-in duration-300">
                        <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl p-10 relative border border-white/20 max-h-[90vh] overflow-y-auto custom-scrollbar">
                            <button onClick={resetForm} className="absolute top-8 right-8 p-3 bg-slate-50 text-slate-400 rounded-full hover:text-rose-500 hover:bg-rose-50 transition-all"><X size={24}/></button>
                            <h3 className="text-2xl font-black text-slate-900 uppercase flex items-center gap-3 mb-8"><Wallet className="text-indigo-600"/> {accId ? 'Editar Cuenta' : 'Nueva Cuenta'}</h3>
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
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Estado</label>
                                    <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                                        <button onClick={() => setAccActive(true)} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all flex items-center justify-center gap-2 ${accActive ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400'}`}><Eye size={14}/> Activa</button>
                                        <button onClick={() => setAccActive(false)} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all flex items-center justify-center gap-2 ${!accActive ? 'bg-white shadow-sm text-slate-600' : 'text-slate-400'}`}><EyeOff size={14}/> Archivada</button>
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
                                    if(accId) onUpdateData({accounts: data.accounts.map(a=>a.id===accId?{...a,name:accName,initialBalance:bal,icon:accIcon,groupId:accGroupId, active: accActive}:a)}); 
                                    else onUpdateData({accounts: [...data.accounts, {id:generateId(),name:accName,initialBalance:bal,currency:'EUR',icon:accIcon,groupId:accGroupId, active: true}]}); 
                                    resetForm(); 
                                }} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] hover:bg-indigo-600 shadow-xl">Guardar Cuenta</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}
        {activeTab === 'FAMILIES' && (
             <div className="space-y-6">
                <button onClick={() => { resetForm(); openEditor(); }} className="w-full py-4 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-indigo-600 shadow-xl flex items-center justify-center gap-2"><Plus size={16}/> Nueva Familia</button>
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
                                <button onClick={() => { setFamId(f.id); setFamName(f.name); setFamType(f.type); setFamIcon(f.icon); openEditor(); }} className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100"><Edit2 size={16}/></button>
                                <button onClick={() => { if(confirm('¿Borrar familia?')) onUpdateData({families: data.families.filter(x => x.id !== f.id)}); }} className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))}
                </div>
                {/* MODAL EDITOR FAMILIAS */}
                {isEditModalOpen && (
                    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-in fade-in zoom-in duration-300">
                        <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg p-10 relative border border-white/20">
                            <button onClick={resetForm} className="absolute top-8 right-8 p-3 bg-slate-50 text-slate-400 rounded-full hover:text-rose-500 hover:bg-rose-50 transition-all"><X size={24}/></button>
                            <h3 className="text-2xl font-black text-slate-900 uppercase flex items-center gap-3 mb-8"><Layers className="text-indigo-600"/> {famId ? 'Editar Familia' : 'Nueva Familia'}</h3>
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
                    </div>
                )}
            </div>
        )}
        {activeTab === 'CATEGORIES' && (
            <div className="space-y-6">
                <button onClick={() => { resetForm(); openEditor(); }} className="w-full py-4 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-indigo-600 shadow-xl flex items-center justify-center gap-2"><Plus size={16}/> Nueva Categoría</button>
                <div className="space-y-4">
                    {data.categories.map(c => {
                        const fam = data.families.find(f => f.id === c.familyId);
                        return (
                            <div key={c.id} className={`bg-white p-4 rounded-3xl border border-slate-100 flex items-center justify-between group hover:border-indigo-200 transition-all ${c.active === false ? 'opacity-50 grayscale' : ''}`}>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 relative">
                                        {renderIcon(c.icon, "w-6 h-6")}
                                        {c.active === false && <div className="absolute inset-0 bg-slate-100/50 backdrop-blur-[1px] rounded-2xl flex items-center justify-center"><EyeOff size={16} className="text-slate-400"/></div>}
                                    </div>
                                    <div>
                                        <span className="block font-bold text-slate-700 uppercase text-xs">{c.name}</span>
                                        <span className="text-[9px] font-black text-slate-400 uppercase">{fam?.name || 'Huérfana'}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2 opacity-50 group-hover:opacity-100">
                                    <button onClick={() => { setCatId(c.id); setCatName(c.name); setCatParent(c.familyId); setCatIcon(c.icon); setCatActive(c.active !== false); openEditor(); }} className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100"><Edit2 size={16}/></button>
                                    <button onClick={() => attemptDeleteCategory(c)} className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100"><Trash2 size={16}/></button>
                                </div>
                            </div>
                        );
                    })}
                </div>
                {/* MODAL EDITOR CATEGORÍAS */}
                {isEditModalOpen && (
                    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-in fade-in zoom-in duration-300">
                        <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl p-10 relative border border-white/20 max-h-[90vh] overflow-y-auto custom-scrollbar">
                            <button onClick={resetForm} className="absolute top-8 right-8 p-3 bg-slate-50 text-slate-400 rounded-full hover:text-rose-500 hover:bg-rose-50 transition-all"><X size={24}/></button>
                            <h3 className="text-2xl font-black text-slate-900 uppercase flex items-center gap-3 mb-8"><Tag className="text-indigo-600"/> {catId ? 'Editar Categoría' : 'Nueva Categoría'}</h3>
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
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Estado</label>
                                    <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                                        <button onClick={() => setCatActive(true)} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all flex items-center justify-center gap-2 ${catActive ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400'}`}><Eye size={14}/> Activa</button>
                                        <button onClick={() => setCatActive(false)} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all flex items-center justify-center gap-2 ${!catActive ? 'bg-white shadow-sm text-slate-600' : 'text-slate-400'}`}><EyeOff size={14}/> Archivada</button>
                                    </div>
                                </div>
                                {renderIconInput(catIcon, setCatIcon, catName)}
                                <button onClick={() => { 
                                    if(!catName || !catParent) return; 
                                    if(catId) onUpdateData({categories: data.categories.map(c=>c.id===catId?{...c,name:catName,familyId:catParent,icon:catIcon, active: catActive}:c)}); 
                                    else onUpdateData({categories: [...data.categories, {id:generateId(),name:catName,familyId:catParent,icon:catIcon, active: true}]}); 
                                    resetForm(); 
                                }} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] hover:bg-indigo-600 shadow-xl">Guardar Categoría</button>
                            </div>
                        </div>
                    </div>
                )}
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
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Cuenta</label><select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={recAcc} onChange={e => setRecAcc(e.target.value)}>{data.accounts.filter(a => a.active !== false).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Categoría</label><select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={recCat} onChange={e => setRecCat(e.target.value)}><option value="">Select...</option>{data.categories.filter(c => c.active !== false).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
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
                             <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Cuenta</label><select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={favAcc} onChange={e => setFavAcc(e.target.value)}>{data.accounts.filter(a => a.active !== false).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                             <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Categoría</label><select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={favCat} onChange={e => setFavCat(e.target.value)}><option value="">Select...</option>{data.categories.filter(c => c.active !== false).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
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
        {activeTab === 'UI' && (
            <div className="grid grid-cols-1 gap-10 animate-in fade-in slide-in-from-bottom-4">
                 <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
                    <h3 className="text-xl font-black text-slate-800 uppercase flex items-center gap-3"><Palette className="text-indigo-600"/> Personalización Visual</h3>
                    
                    <div className="space-y-6">
                        <div className="flex flex-col md:flex-row items-center gap-8">
                            <div className="flex-shrink-0 text-center">
                                <div className="w-32 h-32 bg-slate-50 border-4 border-white shadow-xl rounded-3xl flex items-center justify-center overflow-hidden mb-3">
                                    <img 
                                        src={customLogoPreview || '/contamiki.jpg'} 
                                        className="w-full h-full object-cover" 
                                        onError={(e) => e.currentTarget.src = "https://cdn-icons-png.flaticon.com/512/2910/2910296.png"}
                                        alt="Logo Preview"
                                    />
                                </div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Logo Actual</p>
                            </div>
                            
                            <div className="flex-1 space-y-4 w-full">
                                <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
                                    <h4 className="text-sm font-black text-indigo-900 uppercase mb-2">Subir Logo Personalizado</h4>
                                    <p className="text-xs text-indigo-600/80 mb-4">Sube una imagen para reemplazar el logo de ContaMiki. Se guardará localmente en este navegador.</p>
                                    
                                    <div className="flex gap-3">
                                        <button onClick={() => logoUploadRef.current?.click()} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2">
                                            <Upload size={14}/> Seleccionar Imagen
                                        </button>
                                        {customLogoPreview && (
                                            <button onClick={handleRemoveLogo} className="px-6 py-3 bg-white text-rose-500 border border-rose-100 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-sm hover:bg-rose-50 transition-all flex items-center gap-2">
                                                <Trash2 size={14}/> Restaurar Original
                                            </button>
                                        )}
                                        <input type="file" ref={logoUploadRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

         {activeTab === 'DATA' && (
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-indigo-50 p-10 rounded-[3rem] border border-indigo-100 space-y-6 text-center">
                        <div className="mx-auto w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm"><HardDriveDownload size={32}/></div>
                        <div><h3 className="text-xl font-black text-indigo-900 uppercase">Exportar Datos</h3><p className="text-xs font-bold text-indigo-400 mt-2">Guarda una copia de seguridad completa o de un libro específico.</p></div>
                        
                        <div className="space-y-2 text-left">
                            <label className="text-[10px] font-black text-indigo-400 uppercase ml-1">Alcance de la copia</label>
                            <div className="relative">
                                <select 
                                    className="w-full px-4 py-3 bg-white border-2 border-indigo-200 rounded-xl font-bold text-xs text-indigo-900 outline-none appearance-none"
                                    value={exportTarget}
                                    onChange={(e) => setExportTarget(e.target.value)}
                                >
                                    <option value="ALL">Copia Completa (Todos los Libros)</option>
                                    {books.map(b => (
                                        <option key={b.id} value={b.id}>Libro: {b.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-300 pointer-events-none" size={16}/>
                            </div>
                        </div>

                        <button onClick={() => onExportData(exportTarget)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-indigo-700 transition-all">Descargar JSON</button>
                    </div>

                    <div className="bg-slate-50 p-10 rounded-[3rem] border border-slate-100 space-y-6 text-center">
                        <div className="mx-auto w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-slate-600 shadow-sm"><HardDriveUpload size={32}/></div>
                        <div><h3 className="text-xl font-black text-slate-900 uppercase">Restaurar Copia</h3><p className="text-xs font-bold text-slate-400 mt-2">Importa datos desde un archivo .json previamente exportado.</p></div>
                        <button onClick={() => backupInputRef.current?.click()} className="w-full py-4 bg-white text-slate-900 border-2 border-slate-200 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-sm hover:border-indigo-500 hover:text-indigo-600 transition-all">Seleccionar Archivo</button>
                        {/* Hidden input moved to bottom to prevent unmounting */}
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
                        <div className="p-6 bg-white rounded-[2rem] border border-rose-100 space-y-3 flex flex-col justify-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase">Borrar por Año</p>
                            <div className="flex gap-2">
                                <select className="w-full bg-slate-50 border border-slate-200 font-bold text-sm rounded-xl px-3 outline-none text-slate-700" value={yearToDelete} onChange={e => setYearToDelete(e.target.value)} >
                                    <option value="" disabled>Año</option>
                                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                                <button onClick={() => openVerification('YEAR', yearToDelete)} className="bg-rose-600 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase hover:bg-rose-700 shadow-lg disabled:opacity-50" disabled={!yearToDelete}>Borrar</button>
                            </div>
                        </div>

                        <button onClick={() => openVerification('ALL_TX')} className="p-6 bg-white rounded-[2rem] border border-rose-100 flex flex-col items-center justify-center gap-2 hover:border-rose-300 hover:shadow-lg transition-all group">
                            <Eraser size={24} className="text-rose-400 group-hover:text-rose-600 mb-1"/>
                            <span className="text-[10px] font-black text-rose-600 uppercase">Borrar TODOS los Movimientos</span>
                        </button>

                         <button onClick={() => openVerification('BOOK')} className="p-6 bg-rose-600 text-white rounded-[2rem] border border-rose-600 flex flex-col items-center justify-center gap-2 hover:bg-rose-700 hover:shadow-xl transition-all group">
                            <Trash2 size={24} className="text-white/80 group-hover:text-white mb-1"/>
                            <span className="text-[10px] font-black text-white uppercase">Eliminar Libro Completo</span>
                        </button>
                    </div>
                </div>
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

      {/* RESTORE MODAL - SELECCIÓN DE DESTINO */}
      {restoreFile && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[200] p-6 animate-in fade-in duration-300">
              <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl p-10 text-center relative border border-white/20">
                  <button onClick={resetForm} className="absolute top-6 right-6 p-2 bg-slate-50 text-slate-400 rounded-full hover:text-rose-500 hover:bg-rose-50 transition-all"><X size={20}/></button>
                  <div className="mx-auto w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center border border-indigo-100 mb-6 shadow-sm text-indigo-500">
                      <HardDriveUpload size={40}/>
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-2">Restaurar Copia</h3>
                  <p className="text-sm text-slate-500 mb-8 max-w-md mx-auto">
                      Has cargado <span className="font-bold text-slate-800">{restoreFileName}</span>. ¿Dónde quieres restaurar estos datos?
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                      {/* OPCIÓN 1: LIBRO ACTUAL */}
                      <div className="p-6 bg-slate-50 border border-slate-200 rounded-[2rem] hover:border-indigo-300 transition-all group flex flex-col">
                          <div className="mb-4">
                              <BookCopy className="text-indigo-600 mb-2" size={24} />
                              <h4 className="font-black text-slate-800 uppercase text-xs">Libro Actual</h4>
                              <p className="text-[10px] text-slate-400 mt-1 leading-tight">Sobreescribe los datos del libro que estás viendo ahora.</p>
                          </div>
                          <div className="mt-auto">
                              <div className="bg-rose-50 text-rose-600 text-[9px] font-bold p-2 rounded-lg mb-3 flex items-center gap-2"><AlertOctagon size={12}/> Acción Destructiva</div>
                              <button onClick={() => executeRestore('CURRENT')} className="w-full py-3 bg-white border-2 border-slate-200 text-slate-700 rounded-xl font-black uppercase text-[9px] tracking-widest hover:border-indigo-500 hover:text-indigo-600 transition-all">Restaurar Aquí</button>
                          </div>
                      </div>

                      {/* OPCIÓN 2: OTRO LIBRO */}
                      <div className="p-6 bg-slate-50 border border-slate-200 rounded-[2rem] hover:border-indigo-300 transition-all group flex flex-col">
                          <div className="mb-4">
                              <ArrowRightLeft className="text-indigo-600 mb-2" size={24} />
                              <h4 className="font-black text-slate-800 uppercase text-xs">Otro Libro</h4>
                              <p className="text-[10px] text-slate-400 mt-1 leading-tight">Elige otro libro existente para volcar los datos.</p>
                          </div>
                          <div className="mt-auto space-y-3">
                              <select 
                                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-bold outline-none focus:border-indigo-500"
                                  value={restoreTargetBook}
                                  onChange={e => setRestoreTargetBook(e.target.value)}
                              >
                                  <option value="">Selecciona...</option>
                                  {books.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                              </select>
                              <button onClick={() => executeRestore('OTHER')} disabled={!restoreTargetBook} className="w-full py-3 bg-white border-2 border-slate-200 text-slate-700 rounded-xl font-black uppercase text-[9px] tracking-widest hover:border-indigo-500 hover:text-indigo-600 disabled:opacity-50 transition-all">Restaurar</button>
                          </div>
                      </div>

                      {/* OPCIÓN 3: NUEVO LIBRO */}
                      <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-[2rem] hover:border-indigo-300 transition-all group flex flex-col relative overflow-hidden">
                          <div className="mb-4 relative z-10">
                              <BookPlus className="text-white bg-indigo-500 p-1 rounded-lg mb-2 box-content" size={20} />
                              <h4 className="font-black text-indigo-900 uppercase text-xs">Nuevo Libro</h4>
                              <p className="text-[10px] text-indigo-400 mt-1 leading-tight">Crea un libro limpio y restaura los datos allí.</p>
                          </div>
                          <div className="mt-auto space-y-2 relative z-10">
                              <input type="text" placeholder="Nombre..." className="w-full bg-white border border-indigo-100 rounded-xl px-3 py-2 text-[10px] font-bold outline-none focus:border-indigo-500" value={newBookName} onChange={e => setNewBookName(e.target.value)} />
                              <div className="flex gap-1 justify-between">
                                  {(['BLACK', 'BLUE', 'ROSE', 'EMERALD', 'AMBER', 'VIOLET'] as BookColor[]).map(c => (
                                      <button key={c} onClick={() => setNewBookColor(c)} className={`w-4 h-4 rounded-full transition-all ${newBookColor === c ? 'ring-2 ring-offset-1 ring-indigo-400 scale-110' : 'opacity-50'}`} style={{ backgroundColor: c === 'BLACK' ? '#020617' : c === 'BLUE' ? '#2563eb' : c === 'ROSE' ? '#f43f5e' : c === 'EMERALD' ? '#10b981' : c === 'AMBER' ? '#f59e0b' : '#7c3aed' }} />
                                  ))}
                              </div>
                              <button onClick={() => executeRestore('NEW')} disabled={!newBookName} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg">Crear y Restaurar</button>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}
      
      {/* File Input always rendered to ensure ref consistency and prevent unmounting issues */}
      <input type="file" ref={backupInputRef} className="hidden" accept=".json" onChange={handleFileSelect} />
    </div>
  );
};
