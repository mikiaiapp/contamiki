
import React, { useState, useRef, useMemo } from 'react';
import { AppState, Account, Family, Category, TransactionType, RecurrentMovement, FavoriteMovement, RecurrenceFrequency, BookMetadata, BookColor, MultiBookState } from '../types';
import { Trash2, Edit2, Wallet, BoxSelect, Check, X, ChevronDown, AlertTriangle, Loader2, Search, Layers, Tag, CalendarClock, Heart, Palette, DatabaseZap, ShieldAlert, Image as ImageIcon, Sparkles, Eye, EyeOff, Plus, Upload, Eraser, Bot, XCircle, Download, FileJson, CheckCircle2, History } from 'lucide-center';
import { searchInternetLogos } from '../services/iconService';

interface SettingsViewProps {
  data: AppState;
  books: BookMetadata[];
  currentBookId: string;
  multiState: MultiBookState;
  onUpdateData: (newData: Partial<AppState>) => void;
  onReplaceFullState: (newState: MultiBookState) => void;
  onNavigateToTransactions?: (filters: any) => void;
  onDeleteBook?: () => void;
}

const generateId = () => Math.random().toString(36).substring(2, 15);
const numberFormatter = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const compressLogo = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
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

export const SettingsView: React.FC<SettingsViewProps> = ({ data, books, currentBookId, multiState, onUpdateData, onReplaceFullState, onNavigateToTransactions, onDeleteBook }) => {
  const [activeTab, setActiveTab] = useState('ACC_GROUPS');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Delete State
  const [yearToDelete, setYearToDelete] = useState<string>('');
  const [verificationModal, setVerificationModal] = useState<{ type: 'YEAR' | 'ALL_TX' | 'BOOK', payload?: any } | null>(null);
  const [verificationInput, setVerificationInput] = useState('');
  
  // Icon Search State
  const [webLogos, setWebLogos] = useState<{url: string, source: string}[]>([]);
  const [isSearchingWeb, setIsSearchingWeb] = useState(false);
  
  // Custom Logo State
  const [customLogoPreview, setCustomLogoPreview] = useState<string>(localStorage.getItem('contamiki_custom_logo') || '');

  // --- BACKUP & RESTORE STATES ---
  const [backupScope, setBackupScope] = useState<'CURRENT' | 'ALL'>('CURRENT');
  const [backupStats, setBackupStats] = useState<any>(null);
  const [restoreModal, setRestoreModal] = useState<{ type: 'MULTI' | 'SINGLE', data: any } | null>(null);
  const [singleRestoreConfig, setSingleRestoreConfig] = useState<{ target: 'CURRENT' | 'EXISTING' | 'NEW', targetId?: string, newName?: string, newColor?: BookColor }>({
      target: 'CURRENT',
      targetId: '',
      newName: '',
      newColor: 'BLACK'
  });
  const [restoreStats, setRestoreStats] = useState<any>(null);

  const restoreFileRef = useRef<HTMLInputElement>(null);
  const iconUploadRef = useRef<HTMLInputElement>(null);
  const logoUploadRef = useRef<HTMLInputElement>(null);

  // Form States (Reused for all entities)
  const [grpId, setGrpId] = useState<string | null>(null); const [grpName, setGrpName] = useState(''); const [grpIcon, setGrpIcon] = useState('🗂️');
  const [accId, setAccId] = useState<string | null>(null); const [accName, setAccName] = useState(''); const [accBalance, setAccBalance] = useState(''); const [accIcon, setAccIcon] = useState('🏦'); const [accGroupId, setAccGroupId] = useState(''); const [accActive, setAccActive] = useState(true);
  const [famId, setFamId] = useState<string | null>(null); const [famName, setFamName] = useState(''); const [famIcon, setFamIcon] = useState('📂'); const [famType, setFamType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [catId, setCatId] = useState<string | null>(null); const [catName, setCatName] = useState(''); const [catParent, setCatParent] = useState(''); const [catIcon, setCatIcon] = useState('🏷️'); const [catActive, setCatActive] = useState(true);
  const [recId, setRecId] = useState<string | null>(null); const [recDesc, setRecDesc] = useState(''); const [recAmount, setRecAmount] = useState(''); const [recType, setRecType] = useState<TransactionType>('EXPENSE'); const [recAcc, setRecAcc] = useState(''); const [recCat, setRecCat] = useState(''); const [recFreq, setRecFreq] = useState<RecurrenceFrequency>('MONTHLY'); const [recInterval, setRecInterval] = useState('1'); const [recStart, setRecStart] = useState(new Date().toISOString().split('T')[0]); const [recEnd, setRecEnd] = useState('');
  const [favId, setFavId] = useState<string | null>(null); const [favName, setFavName] = useState(''); const [favDesc, setFavDesc] = useState(''); const [favAmount, setFavAmount] = useState(''); const [favType, setFavType] = useState<TransactionType>('EXPENSE'); const [favAcc, setFavAcc] = useState(''); const [favCat, setFavCat] = useState(''); const [favIcon, setFavIcon] = useState('⭐');

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
    
    setWebLogos([]);
    
    setYearToDelete(availableYears[0] || '');
    setVerificationModal(null); setVerificationInput('');
    setIsEditModalOpen(false);
  };

  const openEditor = () => setIsEditModalOpen(true);
  const renderIcon = (iconStr: string, className = "w-10 h-10") => {
    if (!iconStr) return <span className="text-xl">📂</span>;
    if (iconStr.startsWith('http') || iconStr.startsWith('data:image')) return <img src={iconStr} className={`${className} object-contain rounded-lg`} referrerPolicy="no-referrer" />;
    return <span className="text-xl">{iconStr}</span>;
  }

  const attemptDeleteAccount = (account: Account) => {
      const usageCount = data.transactions.filter(t => t.accountId === account.id || t.transferAccountId === account.id).length;
      if (usageCount > 0) { alert(`Cuenta en uso (${usageCount} movs). Archívala en lugar de borrar.`); return; }
      if (confirm('¿Borrar cuenta permanentemente?')) onUpdateData({accounts: data.accounts.filter(x => x.id !== account.id)});
  };

  const attemptDeleteCategory = (category: Category) => {
      const usageCount = data.transactions.filter(t => t.categoryId === category.id).length;
      if (usageCount > 0) { alert(`Categoría en uso (${usageCount} movs). Archívala en lugar de borrar.`); return; }
      if (confirm('¿Borrar categoría permanentemente?')) onUpdateData({categories: data.categories.filter(x => x.id !== category.id)});
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
          const base64 = await compressLogo(file);
          localStorage.setItem('contamiki_custom_logo', base64);
          setCustomLogoPreview(base64);
          window.dispatchEvent(new Event('contamiki_logo_changed'));
          alert("Logo actualizado.");
      } catch (err) { alert("Error al procesar la imagen."); }
      e.target.value = '';
  };

  const openVerification = (type: 'YEAR' | 'ALL_TX' | 'BOOK', payload?: any) => { setVerificationModal({ type, payload }); setVerificationInput(''); };
  const executeDangerousAction = () => {
      if (verificationInput !== 'BORRAR') return;
      if (verificationModal?.type === 'YEAR') { const yr = verificationModal.payload; onUpdateData({ transactions: data.transactions.filter(t => !t.date.startsWith(yr)) }); } 
      else if (verificationModal?.type === 'ALL_TX') { onUpdateData({ transactions: [] }); }
      else if (verificationModal?.type === 'BOOK') { if (onDeleteBook) onDeleteBook(); }
      resetForm();
  };

  const handleBackup = async () => {
      const currentBookMeta = books.find(b => b.id === currentBookId);
      let payload: any = {};
      let stats: any = {};

      if (backupScope === 'CURRENT') {
          payload = {
              version: '1.5.0',
              scope: 'SINGLE',
              timestamp: new Date().toISOString(),
              metadata: currentBookMeta,
              data: data
          };
          stats = {
              type: 'Libro Individual',
              name: currentBookMeta?.name,
              transactions: data.transactions.length,
              attachments: data.transactions.filter(t => t.attachment).length,
              recurrents: data.recurrents?.length || 0,
              favorites: data.favorites?.length || 0
          };
      } else {
          payload = {
              version: '1.5.0',
              scope: 'ALL',
              timestamp: new Date().toISOString(),
              state: multiState
          };
          
          let totalTx = 0;
          let totalAtch = 0;
          Object.values(multiState.booksData).forEach(b => {
              totalTx += b.transactions.length;
              totalAtch += b.transactions.filter(t => t.attachment).length;
          });

          stats = {
              type: 'Backup Global',
              books: multiState.booksMetadata.length,
              transactions: totalTx,
              attachments: totalAtch
          };
      }

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contamiki_backup_${backupScope}_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupStats(stats);
  };

  const handleRestoreFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
          try {
              const json = JSON.parse(evt.target?.result as string);
              if (json.scope === 'ALL') {
                  setRestoreModal({ type: 'MULTI', data: json });
              } else if (json.scope === 'SINGLE') {
                  setRestoreModal({ type: 'SINGLE', data: json });
                  setSingleRestoreConfig(prev => ({ ...prev, newName: json.metadata.name + ' (Copia)', newColor: json.metadata.color }));
              } else {
                  alert("Formato de backup no reconocido.");
              }
          } catch (err) {
              alert("Error leyendo el archivo JSON.");
          }
      };
      reader.readAsText(file);
      e.target.value = '';
  };

  const executeRestore = () => {
      if (!restoreModal) return;

      let finalStats: any = {};

      if (restoreModal.type === 'MULTI') {
          const newState: MultiBookState = restoreModal.data.state;
          onReplaceFullState(newState);
          
          let totalTx = 0;
          Object.values(newState.booksData).forEach(b => totalTx += b.transactions.length);
          finalStats = { type: 'RESTAURACIÓN GLOBAL', result: 'Éxito', detail: `${newState.booksMetadata.length} Libros, ${totalTx} Movimientos integrados.` };
      } else {
          const singleBackup = restoreModal.data;
          const bookData: AppState = singleBackup.data;
          
          // Clonamos el estado actual para no mutar referencias directamente
          const fullState: MultiBookState = JSON.parse(JSON.stringify(multiState));

          if (singleRestoreConfig.target === 'CURRENT') {
              fullState.booksData[currentBookId] = bookData;
          } else if (singleRestoreConfig.target === 'EXISTING') {
              if (!singleRestoreConfig.targetId) {
                  alert("Por favor, selecciona un libro de destino.");
                  return;
              }
              fullState.booksData[singleRestoreConfig.targetId] = bookData;
          } else {
              // NEW
              const newId = generateId();
              fullState.booksMetadata.push({
                  id: newId,
                  name: singleRestoreConfig.newName || 'Nuevo Libro',
                  color: singleRestoreConfig.newColor || 'BLACK',
                  currency: 'EUR'
              });
              fullState.booksData[newId] = bookData;
              fullState.currentBookId = newId;
          }

          onReplaceFullState(fullState);
          finalStats = { 
              type: 'RESTAURACIÓN INDIVIDUAL', 
              result: 'Completada', 
              detail: `Libro "${singleRestoreConfig.target === 'NEW' ? singleRestoreConfig.newName : books.find(b => b.id === (singleRestoreConfig.targetId || currentBookId))?.name}" actualizado con ${bookData.transactions.length} movimientos.` 
          };
      }

      setRestoreStats(finalStats);
      setRestoreModal(null);
  };

  const renderIconInput = (icon: string, setIcon: (s: string) => void, currentName: string) => (
    <div className="space-y-4 w-full">
        <div className="flex flex-col sm:flex-row items-center gap-6 bg-slate-50 p-4 sm:p-6 rounded-[2rem] border border-slate-100 shadow-inner">
            <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 flex items-center justify-center border-4 border-white rounded-[1.5rem] bg-white overflow-hidden shadow-lg hover:scale-105 transition-transform">{renderIcon(icon, "w-10 h-10 sm:w-12 sm:h-12")}</div>
            <div className="flex-1 space-y-3 w-full">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center sm:text-left">Identidad Visual</p>
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    <button onClick={async () => { if(!currentName) { alert("Escribe un nombre."); return; } setIsSearchingWeb(true); const results = await searchInternetLogos(currentName); setWebLogos(results); setIsSearchingWeb(false); }} className="px-5 py-3 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-950 transition-all flex items-center gap-2 shadow-lg">{isSearchingWeb ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>} IA Search</button>
                    <button onClick={() => iconUploadRef.current?.click()} className="px-5 py-3 bg-white text-slate-900 border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"><ImageIcon size={14}/> Subir</button>
                    <input type="file" ref={iconUploadRef} className="hidden" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = ev => setIcon(ev.target?.result as string); reader.readAsDataURL(file); } }} />
                    <input type="text" className="w-16 px-2 py-3 bg-white border border-slate-200 rounded-xl font-bold text-center text-sm shadow-sm" value={icon.length < 5 ? icon : '📂'} onChange={e => setIcon(e.target.value)} placeholder="Emoji"/>
                </div>
            </div>
        </div>
        {webLogos.length > 0 && (
          <div className="bg-white p-6 rounded-[2.5rem] border-2 border-indigo-100 shadow-2xl space-y-5 animate-in slide-in-from-top-4 z-[300] relative">
              <div className="flex justify-between items-center"><span className="text-[11px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2"><Sparkles size={14}/> Resultados</span><button onClick={() => setWebLogos([])} className="text-slate-300 hover:text-rose-500"><XCircle size={20}/></button></div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 max-h-64 overflow-y-auto p-2 custom-scrollbar">{webLogos.map((l, i) => (<button key={i} onClick={() => { setIcon(l.url); setWebLogos([]); }} className="aspect-square bg-slate-50 rounded-2xl border-2 border-transparent hover:border-indigo-500 p-2 transition-all flex items-center justify-center overflow-hidden shadow-sm group"><img src={l.url} className="w-full h-full object-contain group-hover:scale-110 transition-transform" /></button>))}</div>
          </div>
        )}
    </div>
  );

  return (
    <div className="space-y-12 max-w-full overflow-hidden pb-20">
      <div className="text-center md:text-left space-y-2">
        <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter">Ajustes.</h2>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em]">Personalización y Control</p>
      </div>

      <nav className="flex md:flex-wrap bg-slate-100 p-1.5 rounded-2xl shadow-inner border border-slate-200/50 overflow-x-auto md:overflow-visible scrollbar-hide">
        {[{id: 'ACC_GROUPS', label: 'Grupos', icon: <BoxSelect size={16}/>}, {id: 'ACCOUNTS', label: 'Cuentas', icon: <Wallet size={16}/>}, {id: 'FAMILIES', label: 'Familias', icon: <Layers size={16}/>}, {id: 'CATEGORIES', label: 'Categorías', icon: <Tag size={16}/>}, {id: 'RECURRENTS', label: 'Recurrentes', icon: <CalendarClock size={16}/>}, {id: 'FAVORITES', label: 'Favoritos', icon: <Heart size={16}/>}, {id: 'UI', label: 'Interfaz', icon: <Palette size={16}/>}, {id: 'DATA', label: 'Gestión', icon: <ShieldAlert size={16}/>}, {id: 'TOOLS', label: 'Herramientas', icon: <DatabaseZap size={16}/>}].map(t => (
            <button key={t.id} className={`flex-1 min-w-[70px] sm:min-w-[fit-content] flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-6 py-2 sm:py-3.5 font-black text-[8px] sm:text-[10px] uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => { setActiveTab(t.id); resetForm(); }}>{t.icon} <span className="block sm:inline mt-1 sm:mt-0">{t.label}</span></button>
        ))}
      </nav>

      <div className="max-w-4xl mx-auto">
        {activeTab === 'ACC_GROUPS' && (
            <div className="space-y-6">
                <button onClick={() => { resetForm(); openEditor(); }} className="w-full py-4 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-indigo-600 shadow-xl flex items-center justify-center gap-2"><Plus size={16}/> Nuevo Grupo</button>
                <div className="space-y-4">{data.accountGroups.map(g => (<div key={g.id} className="bg-white p-4 rounded-3xl border border-slate-100 flex items-center justify-between group hover:border-indigo-200 transition-all"><div className="flex items-center gap-4"><div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100">{renderIcon(g.icon, "w-6 h-6")}</div><span className="font-bold text-slate-700 uppercase text-xs">{g.name}</span></div><div className="flex gap-2 opacity-50 group-hover:opacity-100"><button onClick={() => { setGrpId(g.id); setGrpName(g.name); setGrpIcon(g.icon); openEditor(); }} className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100"><Edit2 size={16}/></button><button onClick={() => { if(confirm('¿Borrar grupo?')) onUpdateData({accountGroups: data.accountGroups.filter(x => x.id !== g.id)}); }} className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100"><Trash2 size={16}/></button></div></div>))}</div>
                {isEditModalOpen && (<div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-in fade-in"><div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg p-10 relative border border-white/20"><button onClick={resetForm} className="absolute top-8 right-8 p-3 bg-slate-50 text-slate-400 rounded-full hover:text-rose-500"><X size={24}/></button><h3 className="text-2xl font-black text-slate-900 uppercase flex items-center gap-3 mb-8"><BoxSelect className="text-indigo-600"/> {grpId ? 'Editar Grupo' : 'Nuevo Grupo'}</h3><div className="space-y-6"><div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nombre</label><input type="text" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500" value={grpName} onChange={e => setGrpName(e.target.value)} /></div>{renderIconInput(grpIcon, setGrpIcon, grpName)}<button onClick={() => { if(!grpName) return; if(grpId) onUpdateData({accountGroups: data.accountGroups.map(g=>g.id===grpId?{...g,name:grpName,icon:grpIcon}:g)}); else onUpdateData({accountGroups: [...data.accountGroups, {id:generateId(),name:grpName,icon:grpIcon}]}); resetForm(); }} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] hover:bg-indigo-600 shadow-xl">Guardar</button></div></div></div>)}
            </div>
        )}

        {activeTab === 'ACCOUNTS' && (
            <div className="space-y-6">
                <button onClick={() => { resetForm(); openEditor(); }} className="w-full py-4 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-indigo-600 shadow-xl flex items-center justify-center gap-2"><Plus size={16}/> Nueva Cuenta</button>
                <div className="space-y-4">{data.accounts.map(a => (<div key={a.id} className={`bg-white p-4 rounded-3xl border border-slate-100 flex items-center justify-between group hover:border-indigo-200 transition-all ${a.active === false ? 'opacity-50 grayscale' : ''}`}><div className="flex items-center gap-4"><div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 relative">{renderIcon(a.icon, "w-6 h-6")}{a.active === false && <div className="absolute inset-0 bg-slate-100/50 backdrop-blur-[1px] rounded-2xl flex items-center justify-center"><EyeOff size={16} className="text-slate-400"/></div>}</div><div><span className="block font-bold text-slate-700 uppercase text-xs">{a.name}</span><span className="text-[9px] font-black text-slate-400 uppercase">{data.accountGroups.find(g=>g.id===a.groupId)?.name} • {numberFormatter.format(a.initialBalance)}€</span></div></div><div className="flex gap-2 opacity-50 group-hover:opacity-100"><button onClick={() => { setAccId(a.id); setAccName(a.name); setAccBalance(a.initialBalance.toString()); setAccIcon(a.icon); setAccGroupId(a.groupId); setAccActive(a.active !== false); openEditor(); }} className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100"><Edit2 size={16}/></button><button onClick={() => attemptDeleteAccount(a)} className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100"><Trash2 size={16}/></button></div></div>))}</div>
                {isEditModalOpen && (<div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-in fade-in"><div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl p-10 relative border border-white/20 max-h-[90vh] overflow-y-auto"><button onClick={resetForm} className="absolute top-8 right-8 p-3 bg-slate-50 text-slate-400 rounded-full hover:text-rose-500"><X size={24}/></button><h3 className="text-2xl font-black text-slate-900 uppercase flex items-center gap-3 mb-8"><Wallet className="text-indigo-600"/> {accId ? 'Editar Cuenta' : 'Nueva Cuenta'}</h3><div className="space-y-6"><div className="grid grid-cols-2 gap-6"><div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nombre</label><input type="text" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={accName} onChange={e => setAccName(e.target.value)} /></div><div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Saldo</label><input type="number" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={accBalance} onChange={e => setAccBalance(e.target.value)} /></div></div><div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Estado</label><div className="flex bg-slate-100 p-1.5 rounded-2xl"><button onClick={() => setAccActive(true)} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl ${accActive ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400'}`}>Activa</button><button onClick={() => setAccActive(false)} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl ${!accActive ? 'bg-white shadow-sm text-slate-600' : 'text-slate-400'}`}>Archivada</button></div></div><div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Grupo</label><div className="grid grid-cols-4 gap-2">{data.accountGroups.map(g => (<button key={g.id} onClick={() => setAccGroupId(g.id)} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 ${accGroupId === g.id ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-100 text-slate-400'}`}>{renderIcon(g.icon, "w-6 h-6")} <span className="text-[9px] font-black uppercase">{g.name}</span></button>))}</div></div>{renderIconInput(accIcon, setAccIcon, accName)}<button onClick={() => { if(!accName || !accGroupId) return; const bal = parseFloat(accBalance) || 0; if(accId) onUpdateData({accounts: data.accounts.map(a=>a.id===accId?{...a,name:accName,initialBalance:bal,icon:accIcon,groupId:accGroupId, active: accActive}:a)}); else onUpdateData({accounts: [...data.accounts, {id:generateId(),name:accName,initialBalance:bal,currency:'EUR',icon:accIcon,groupId:accGroupId, active: true}]}); resetForm(); }} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] hover:bg-indigo-600 shadow-xl">Guardar</button></div></div></div>)}
            </div>
        )}

        {activeTab === 'DATA' && (
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4">
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
                    <div className="flex items-center gap-4">
                        <div className="bg-indigo-600 p-4 rounded-3xl text-white shadow-xl shadow-indigo-600/20"><Download size={24}/></div>
                        <div><h3 className="text-xl font-black text-slate-900 uppercase">Copia de Seguridad</h3><p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Exportar datos con adjuntos (.json)</p></div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                        <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Alcance de la copia</label>
                             <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500" value={backupScope} onChange={e => setBackupScope(e.target.value as any)}>
                                 <option value="CURRENT">Solo Libro Actual</option>
                                 <option value="ALL">Contabilidad Completa (Todos los Libros)</option>
                             </select>
                        </div>
                        <button onClick={handleBackup} className="w-full py-5 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-indigo-600 transition-all flex items-center justify-center gap-2">
                            <FileJson size={18}/> Iniciar Exportación
                        </button>
                    </div>

                    {backupStats && (
                        <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 space-y-3 animate-in zoom-in-95">
                            <div className="flex justify-between items-center"><span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Resumen del Proceso</span><button onClick={() => setBackupStats(null)}><X size={14} className="text-indigo-300"/></button></div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div><p className="text-[9px] font-black text-indigo-400 uppercase">Tipo</p><p className="text-xs font-bold text-slate-700">{backupStats.type}</p></div>
                                {backupStats.books && <div><p className="text-[9px] font-black text-indigo-400 uppercase">Libros</p><p className="text-xs font-bold text-slate-700">{backupStats.books}</p></div>}
                                <div><p className="text-[9px] font-black text-indigo-400 uppercase">Movimientos</p><p className="text-xs font-bold text-slate-700">{backupStats.transactions}</p></div>
                                <div><p className="text-[9px] font-black text-indigo-400 uppercase">Adjuntos</p><p className="text-xs font-bold text-slate-700">{backupStats.attachments}</p></div>
                            </div>
                            <div className="flex items-center gap-2 text-emerald-600 text-[10px] font-black uppercase pt-2 border-t border-indigo-100/50"><Check size={14}/> Copia generada y descargada correctamente</div>
                        </div>
                    )}
                </div>

                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
                    <div className="flex items-center gap-4">
                        <div className="bg-amber-500 p-4 rounded-3xl text-white shadow-xl shadow-amber-500/20"><History size={24}/></div>
                        <div><h3 className="text-xl font-black text-slate-900 uppercase">Restauración</h3><p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Cargar archivo de copia anterior</p></div>
                    </div>

                    <div className="p-12 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[3rem] text-center space-y-4 group hover:border-indigo-400 hover:bg-white transition-all cursor-pointer relative" onClick={() => restoreFileRef.current?.click()}>
                        <div className="mx-auto w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-slate-300 group-hover:text-indigo-600 shadow-sm transition-colors"><Upload size={32}/></div>
                        <div>
                            <p className="text-sm font-black text-slate-600 uppercase">Selecciona archivo de copia</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Soporta .json de ContaMiki</p>
                        </div>
                        <input type="file" ref={restoreFileRef} className="hidden" accept=".json" onChange={handleRestoreFileSelect} />
                    </div>

                    {restoreStats && (
                        <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 space-y-2 animate-in zoom-in-95">
                            <div className="flex justify-between items-center"><span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{restoreStats.type}</span><button onClick={() => setRestoreStats(null)}><X size={14} className="text-emerald-300"/></button></div>
                            <p className="text-xs font-bold text-slate-700">{restoreStats.detail}</p>
                            <div className="flex items-center gap-2 text-emerald-600 text-[10px] font-black uppercase pt-1"><CheckCircle2 size={14}/> {restoreStats.result}</div>
                        </div>
                    )}
                </div>

                <div className="bg-rose-50 p-10 rounded-[3rem] border border-rose-100 space-y-6 text-center mt-8">
                    <div className="mx-auto w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-rose-600 shadow-sm"><ShieldAlert size={32}/></div>
                    <div><h3 className="text-xl font-black text-rose-900 uppercase">Zona de Peligro</h3><p className="text-xs font-bold text-rose-400 mt-2">Acciones destructivas locales. Requieren verificación.</p></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        <div className="p-6 bg-white rounded-[2rem] border border-rose-100 space-y-3 flex flex-col justify-center"><p className="text-[10px] font-black text-slate-400 uppercase">Borrar por Año</p><div className="flex gap-2"><select className="w-full bg-slate-50 border border-slate-200 font-bold text-sm rounded-xl px-3 outline-none text-slate-700" value={yearToDelete} onChange={e => setYearToDelete(e.target.value)} ><option value="" disabled>Año</option>{availableYears.map(y => <option key={y} value={y}>{y}</option>)}</select><button onClick={() => openVerification('YEAR', yearToDelete)} className="bg-rose-600 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase hover:bg-rose-700 shadow-lg disabled:opacity-50" disabled={!yearToDelete}>Borrar</button></div></div>
                        <button onClick={() => openVerification('ALL_TX')} className="p-6 bg-white rounded-[2rem] border border-rose-100 flex flex-col items-center justify-center gap-2 hover:border-rose-300 hover:shadow-lg transition-all group"><Eraser size={24} className="text-rose-400 group-hover:text-rose-600 mb-1"/><span className="text-[10px] font-black text-rose-600 uppercase">Borrar TODOS los Movimientos</span></button>
                         <button onClick={() => openVerification('BOOK')} className="p-6 bg-rose-600 text-white rounded-[2rem] border border-rose-600 flex flex-col items-center justify-center gap-2 hover:bg-rose-700 hover:shadow-xl transition-all group"><Trash2 size={24} className="text-white/80 group-hover:text-white mb-1"/><span className="text-[10px] font-black text-white uppercase">Eliminar Libro Completo</span></button>
                    </div>
                </div>
            </div>
        )}
      </div>

      {restoreModal && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[250] p-6 animate-in fade-in duration-300">
              <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg p-10 relative border border-white/20 overflow-y-auto max-h-[90vh]">
                  <button onClick={() => setRestoreModal(null)} className="absolute top-8 right-8 p-2 bg-slate-50 text-slate-400 rounded-full hover:text-rose-500 hover:bg-rose-50 transition-all"><X size={20}/></button>
                  <div className="mx-auto w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center border border-amber-100 mb-6 shadow-sm text-amber-500"><History size={40}/></div>
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight text-center mb-2">Restaurar Copia</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center mb-8">Fecha copia: {new Date(restoreModal.data.timestamp).toLocaleString()}</p>
                  
                  <div className="space-y-8">
                      {restoreModal.type === 'MULTI' ? (
                          <div className="bg-rose-50 p-6 rounded-[2rem] border border-rose-100 text-center space-y-4">
                              <AlertTriangle className="mx-auto text-rose-500" size={32} />
                              <p className="text-sm font-bold text-rose-900">ATENCIÓN: Esta es una copia GLOBAL.</p>
                              <p className="text-xs text-rose-700 font-medium leading-relaxed">Se eliminarán todos tus libros actuales y se sustituirán por los de la copia de seguridad. Los datos volverán al estado exacto del día indicado arriba.</p>
                          </div>
                      ) : (
                          <div className="space-y-6">
                              <div className="space-y-3">
                                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">¿Cómo restaurar este libro?</label>
                                  <div className="grid grid-cols-1 gap-2">
                                      <button onClick={() => setSingleRestoreConfig(prev => ({...prev, target: 'CURRENT'}))} className={`p-4 rounded-2xl border-2 text-left transition-all ${singleRestoreConfig.target === 'CURRENT' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-100 text-slate-500'}`}>
                                          <p className="text-xs font-black uppercase">Sobrescribir libro actual</p>
                                          <p className="text-[9px] font-medium mt-1">Sustituir "{books.find(b => b.id === currentBookId)?.name}" por los datos de la copia.</p>
                                      </button>
                                      <button onClick={() => setSingleRestoreConfig(prev => ({...prev, target: 'EXISTING'}))} className={`p-4 rounded-2xl border-2 text-left transition-all ${singleRestoreConfig.target === 'EXISTING' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-100 text-slate-500'}`}>
                                          <p className="text-xs font-black uppercase">Sustituir otro libro existente</p>
                                          {singleRestoreConfig.target === 'EXISTING' && (
                                              <select className="w-full mt-2 bg-white border border-indigo-200 rounded-xl px-3 py-2 text-[11px] font-bold outline-none" value={singleRestoreConfig.targetId} onChange={e => setSingleRestoreConfig(prev => ({...prev, targetId: e.target.value}))}>
                                                  <option value="">Seleccionar libro...</option>
                                                  {books.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                              </select>
                                          )}
                                      </button>
                                      <button onClick={() => setSingleRestoreConfig(prev => ({...prev, target: 'NEW'}))} className={`p-4 rounded-2xl border-2 text-left transition-all ${singleRestoreConfig.target === 'NEW' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-100 text-slate-500'}`}>
                                          <p className="text-xs font-black uppercase">Importar como libro nuevo</p>
                                          {singleRestoreConfig.target === 'NEW' && (
                                              <div className="mt-3 space-y-3 animate-in slide-in-from-top-2">
                                                  <input type="text" placeholder="Nombre de la nueva contabilidad..." className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-3 text-[11px] font-bold outline-none" value={singleRestoreConfig.newName} onChange={e => setSingleRestoreConfig(prev => ({...prev, newName: e.target.value}))} />
                                                  <div className="grid grid-cols-6 gap-1">
                                                      {(['BLACK', 'BLUE', 'ROSE', 'EMERALD', 'AMBER', 'VIOLET'] as BookColor[]).map(c => (
                                                          <button key={c} onClick={() => setSingleRestoreConfig(prev => ({...prev, newColor: c}))} className={`h-8 rounded-lg flex items-center justify-center transition-all ${singleRestoreConfig.newColor === c ? 'ring-2 ring-indigo-500 scale-105 shadow-md' : 'opacity-60'}`} style={{ backgroundColor: c === 'BLACK' ? '#020617' : c === 'BLUE' ? '#2563eb' : c === 'ROSE' ? '#f43f5e' : c === 'EMERALD' ? '#10b981' : c === 'AMBER' ? '#f59e0b' : '#7c3aed' }}>
                                                              {singleRestoreConfig.newColor === c && <Check className="text-white" size={12} />}
                                                          </button>
                                                      ))}
                                                  </div>
                                              </div>
                                          )}
                                      </button>
                                  </div>
                              </div>
                              {singleRestoreConfig.target !== 'NEW' && (
                                  <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-3 text-amber-700">
                                      <AlertTriangle size={20} className="flex-shrink-0"/>
                                      <p className="text-[10px] font-bold leading-relaxed uppercase">Se perderán todos los datos actuales del libro de destino seleccionado.</p>
                                  </div>
                              )}
                          </div>
                      )}

                      <button 
                        onClick={executeRestore}
                        className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase text-[12px] tracking-[0.2em] shadow-2xl hover:bg-emerald-600 transition-all active:scale-95"
                      >
                          Confirmar y Restaurar
                      </button>
                  </div>
              </div>
          </div>
      )}

      {verificationModal && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[200] p-6 animate-in fade-in duration-300">
              <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-sm p-10 text-center relative border border-white/20">
                  <button onClick={() => setVerificationModal(null)} className="absolute top-6 right-6 p-2 bg-slate-50 text-slate-400 rounded-full hover:text-rose-500 hover:bg-rose-50 transition-all"><X size={20}/></button>
                  <div className="mx-auto w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center border border-rose-100 mb-6 shadow-sm text-rose-500"><ShieldAlert size={40}/></div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Confirmación</h3>
                  <p className="text-xs font-medium text-slate-500 mb-6">Escribe <span className="font-black text-rose-600">BORRAR</span> para confirmar.</p>
                  <input type="text" placeholder="Escribe BORRAR" className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-center outline-none focus:border-rose-500 transition-all uppercase mb-6" value={verificationInput} onChange={e => setVerificationInput(e.target.value.toUpperCase())} />
                  <button onClick={executeDangerousAction} disabled={verificationInput !== 'BORRAR'} className={`w-full py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl transition-all flex items-center justify-center gap-2 ${verificationInput === 'BORRAR' ? 'bg-rose-600 text-white hover:bg-rose-700 active:scale-95' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}><Trash2 size={16}/> Confirmar Eliminación</button>
              </div>
          </div>
      )}
    </div>
  );
};
