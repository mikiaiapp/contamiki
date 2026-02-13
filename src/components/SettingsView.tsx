
import React, { useState, useRef, useMemo } from 'react';
import { AppState, Account, Family, Category, Transaction, TransactionType, AccountGroup, ImportReport, RecurrentMovement, FavoriteMovement, RecurrenceFrequency, BookMetadata, BookColor, SettingsViewProps } from '../types';
import { Trash2, Edit2, Layers, Tag, Wallet, Loader2, Sparkles, XCircle, Download, DatabaseZap, CheckCircle2, BoxSelect, FileJson, AlertTriangle, Eraser, FileSpreadsheet, Upload, FolderTree, ArrowRightLeft, Check, Image as ImageIcon, CalendarClock, Heart, Clock, RefreshCw, X, HardDriveDownload, HardDriveUpload, Bot, ShieldAlert, Monitor, Palette, Eye, EyeOff, Plus, ChevronDown, BookCopy, BookPlus, AlertOctagon } from 'lucide-react';
import { searchInternetLogos } from '../services/iconService';

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

export const SettingsView: React.FC<SettingsViewProps> = ({ 
  data, 
  books, 
  onUpdateData, 
  onNavigateToTransactions, 
  onCreateBookFromImport, 
  onDeleteBook, 
  onExportData,
  onRestoreToBook
}) => {
  const [activeTab, setActiveTab] = useState('ACC_GROUPS');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Backup States
  const [restoreFile, setRestoreFile] = useState<any | null>(null);
  const [restoreFileName, setRestoreFileName] = useState('');
  const [exportTarget, setExportTarget] = useState<string>('ALL');
  
  // Restore Modal State
  const [restoreTargetBook, setRestoreTargetBook] = useState<string>('');
  const [newBookName, setNewBookName] = useState('');
  const [newBookColor, setNewBookColor] = useState<BookColor>('BLACK');
  
  // Delete States
  const [yearToDelete, setYearToDelete] = useState<string>('');
  const [verificationModal, setVerificationModal] = useState<{ type: 'YEAR' | 'ALL_TX' | 'BOOK', payload?: any } | null>(null);
  const [verificationInput, setVerificationInput] = useState('');
  
  // UI States
  const [webLogos, setWebLogos] = useState<{url: string, source: string}[]>([]);
  const [isSearchingWeb, setIsSearchingWeb] = useState(false);
  const [customLogoPreview, setCustomLogoPreview] = useState<string>(localStorage.getItem('contamiki_custom_logo') || '');

  // Refs
  const iconUploadRef = useRef<HTMLInputElement>(null);
  const logoUploadRef = useRef<HTMLInputElement>(null);

  // Form States
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
    setWebLogos([]); setRestoreFile(null); setRestoreFileName('');
    setYearToDelete(availableYears[0] || ''); setExportTarget('ALL');
    setVerificationModal(null); setVerificationInput(''); setIsEditModalOpen(false);
    setNewBookName(''); setNewBookColor('BLACK'); setRestoreTargetBook('');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (ev) => {
          try {
              const result = ev.target?.result as string;
              const content = JSON.parse(result);
              
              if (content && typeof content === 'object') {
                  setRestoreFile(content);
                  setRestoreFileName(file.name);
              } else {
                  throw new Error("Formato no válido");
              }
          } catch (err) {
              alert("El archivo seleccionado no es un backup válido de ContaMiki.");
          }
      };
      reader.readAsText(file);
      e.target.value = ''; 
  };

  const executeRestore = (target: 'CURRENT' | 'OTHER' | 'NEW') => {
      if (!restoreFile) return;
      
      let dataToRestore: AppState = restoreFile as AppState;
      
      // Si el backup es completo (MultiBookState), extraemos el libro principal
      if (restoreFile.booksData && restoreFile.booksMetadata) {
          const mb = restoreFile;
          const targetIdFromBackup = mb.currentBookId || (Object.keys(mb.booksData).length > 0 ? Object.keys(mb.booksData)[0] : null);
          
          if (targetIdFromBackup && mb.booksData[targetIdFromBackup]) {
             dataToRestore = mb.booksData[targetIdFromBackup];
          } else {
             alert("El archivo de respaldo no contiene datos utilizables.");
             return;
          }
      }

      if (target === 'CURRENT') {
          if (confirm("¿Estás seguro? Se borrarán todos los datos actuales del libro activo.")) {
              onUpdateData(dataToRestore);
              setRestoreFile(null);
          }
      } else if (target === 'OTHER') {
          if (!restoreTargetBook) return;
          if (confirm("¿Confirmas sobreescribir el libro seleccionado con estos datos?")) {
              onRestoreToBook?.(restoreTargetBook, dataToRestore);
              setRestoreFile(null);
          }
      } else if (target === 'NEW') {
          if (!newBookName.trim()) {
              alert("Por favor, ponle un nombre al nuevo libro.");
              return;
          }
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
          alert("Logo actualizado.");
      } catch (err) {
          alert("Error procesando imagen.");
      }
      e.target.value = '';
  };

  const renderIcon = (iconStr: string, className = "w-10 h-10") => {
    if (!iconStr) return <span className="text-xl">📂</span>;
    if (iconStr.startsWith('http') || iconStr.startsWith('data:image')) return <img src={iconStr} className={`${className} object-contain rounded-lg`} referrerPolicy="no-referrer" />;
    return <span className="text-xl">{iconStr}</span>;
  };

  const renderIconInput = (icon: string, setIcon: (s: string) => void, currentName: string) => (
    <div className="space-y-4 w-full">
        <div className="flex flex-col sm:flex-row items-center gap-6 bg-slate-50 p-4 sm:p-6 rounded-[2rem] border border-slate-100 shadow-inner">
            <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 flex items-center justify-center border-4 border-white rounded-[1.5rem] bg-white overflow-hidden shadow-lg transition-transform hover:scale-105">
                {renderIcon(icon, "w-10 h-10 sm:w-12 sm:h-12")}
            </div>
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
              <div className="flex justify-between items-center">
                  <span className="text-[11px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2"><Sparkles size={14}/> Resultados IA</span>
                  <button onClick={() => setWebLogos([])} className="text-slate-300 hover:text-rose-500"><XCircle size={20}/></button>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 max-h-64 overflow-y-auto p-2 custom-scrollbar">
                  {webLogos.map((l, i) => (
                      <button key={i} onClick={() => { setIcon(l.url); setWebLogos([]) }} className="aspect-square bg-slate-50 rounded-2xl border-2 border-transparent hover:border-indigo-500 p-2 transition-all flex items-center justify-center overflow-hidden shadow-sm group">
                          <img src={l.url} className="w-full h-full object-contain group-hover:scale-110 transition-transform" />
                      </button>
                  ))}
              </div>
          </div>
        )}
    </div>
  );

  const executeDangerousAction = () => {
      if (verificationInput !== 'BORRAR') return;
      if (verificationModal?.type === 'YEAR') { 
          onUpdateData({ transactions: data.transactions.filter(t => !t.date.startsWith(verificationModal.payload)) }); 
      } else if (verificationModal?.type === 'ALL_TX') { 
          onUpdateData({ transactions: [] }); 
      } else if (verificationModal?.type === 'BOOK') { 
          onDeleteBook?.(); 
      }
      resetForm();
  };

  const openVerification = (type: 'YEAR' | 'ALL_TX' | 'BOOK', payload?: any) => {
      setVerificationModal({ type, payload });
      setVerificationInput('');
  };

  return (
    <div className="space-y-12 max-w-full overflow-hidden pb-20">
      <div className="text-center md:text-left space-y-2">
        <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter">Ajustes.</h2>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em]">Configuración y Datos</p>
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
        {activeTab === 'ACC_GROUPS' && (
            <div className="space-y-6">
                <button onClick={() => { resetForm(); setIsEditModalOpen(true); }} className="w-full py-4 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-indigo-600 shadow-xl flex items-center justify-center gap-2"><Plus size={16}/> Nuevo Grupo</button>
                <div className="space-y-4">
                    {data.accountGroups.map(g => (
                        <div key={g.id} className="bg-white p-4 rounded-3xl border border-slate-100 flex items-center justify-between group hover:border-indigo-200 transition-all">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100">{renderIcon(g.icon, "w-6 h-6")}</div>
                                <span className="font-bold text-slate-700 uppercase text-xs">{g.name}</span>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => { setGrpId(g.id); setGrpName(g.name); setGrpIcon(g.icon); setIsEditModalOpen(true); }} className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100"><Edit2 size={16}/></button>
                                <button onClick={() => { if(confirm('¿Borrar?')) onUpdateData({accountGroups: data.accountGroups.filter(x => x.id !== g.id)}); }} className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'ACCOUNTS' && (
            <div className="space-y-6">
                <button onClick={() => { resetForm(); setIsEditModalOpen(true); }} className="w-full py-4 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] hover:bg-indigo-600 shadow-xl flex items-center justify-center gap-2"><Plus size={16}/> Nueva Cuenta</button>
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
                                    <span className="text-[9px] font-black text-slate-400 uppercase">{numberFormatter.format(a.initialBalance)} €</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => { setAccId(a.id); setAccName(a.name); setAccBalance(a.initialBalance.toString()); setAccIcon(a.icon); setAccGroupId(a.groupId); setAccActive(a.active !== false); setIsEditModalOpen(true); }} className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100"><Edit2 size={16}/></button>
                                <button onClick={() => { if(confirm('¿Borrar?')) onUpdateData({accounts: data.accounts.filter(x => x.id !== a.id)}); }} className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'FAMILIES' && (
             <div className="space-y-6">
                <button onClick={() => { resetForm(); setIsEditModalOpen(true); }} className="w-full py-4 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] hover:bg-indigo-600 shadow-xl flex items-center justify-center gap-2"><Plus size={16}/> Nueva Familia</button>
                <div className="space-y-4">
                    {data.families.map(f => (
                         <div key={f.id} className="bg-white p-4 rounded-3xl border border-slate-100 flex items-center justify-between group hover:border-indigo-200 transition-all">
                             <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100">{renderIcon(f.icon, "w-6 h-6")}</div>
                                <div>
                                    <span className="block font-bold text-slate-700 uppercase text-xs">{f.name}</span>
                                    <span className={`text-[9px] font-black uppercase ${f.type === 'INCOME' ? 'text-emerald-500' : 'text-rose-500'}`}>{f.type}</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => { setFamId(f.id); setFamName(f.name); setFamType(f.type); setFamIcon(f.icon); setIsEditModalOpen(true); }} className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100"><Edit2 size={16}/></button>
                                <button onClick={() => { if(confirm('¿Borrar?')) onUpdateData({families: data.families.filter(x => x.id !== f.id)}); }} className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'CATEGORIES' && (
            <div className="space-y-6">
                <button onClick={() => { resetForm(); setIsEditModalOpen(true); }} className="w-full py-4 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] hover:bg-indigo-600 shadow-xl flex items-center justify-center gap-2"><Plus size={16}/> Nueva Categoría</button>
                <div className="space-y-4">
                    {data.categories.map(c => (
                        <div key={c.id} className={`bg-white p-4 rounded-3xl border border-slate-100 flex items-center justify-between group hover:border-indigo-200 transition-all ${c.active === false ? 'opacity-50 grayscale' : ''}`}>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 relative">
                                    {renderIcon(c.icon, "w-6 h-6")}
                                    {c.active === false && <div className="absolute inset-0 bg-slate-100/50 backdrop-blur-[1px] rounded-2xl flex items-center justify-center"><EyeOff size={16} className="text-slate-400"/></div>}
                                </div>
                                <span className="font-bold text-slate-700 uppercase text-xs">{c.name}</span>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => { setCatId(c.id); setCatName(c.name); setCatParent(c.familyId); setCatIcon(c.icon); setCatActive(c.active !== false); setIsEditModalOpen(true); }} className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100"><Edit2 size={16}/></button>
                                <button onClick={() => { if(confirm('¿Borrar?')) onUpdateData({categories: data.categories.filter(x => x.id !== c.id)}); }} className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'UI' && (
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8 animate-in fade-in">
                <h3 className="text-xl font-black text-slate-800 uppercase flex items-center gap-3"><Palette className="text-indigo-600"/> Personalización Visual</h3>
                <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="w-32 h-32 bg-slate-50 border-4 border-white shadow-xl rounded-3xl flex items-center justify-center overflow-hidden">
                        <img src={customLogoPreview || '/contamiki.jpg'} className="w-full h-full object-cover" alt="Logo" />
                    </div>
                    <div className="space-y-4">
                        <p className="text-xs text-slate-500">Cambia el logo de la aplicación por uno personalizado.</p>
                        <div className="flex gap-3">
                            <button onClick={() => logoUploadRef.current?.click()} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg flex items-center gap-2 hover:bg-indigo-700 transition-all">
                                <Upload size={14}/> Subir Logo
                            </button>
                            {customLogoPreview && (
                                <button onClick={() => { localStorage.removeItem('contamiki_custom_logo'); setCustomLogoPreview(''); window.dispatchEvent(new Event('contamiki_logo_changed')); }} className="px-6 py-3 bg-white text-rose-500 border border-rose-100 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-sm hover:bg-rose-50 transition-all">
                                    Restaurar Original
                                </button>
                            )}
                            <input type="file" ref={logoUploadRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                        </div>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'DATA' && (
            <div className="space-y-12 animate-in fade-in">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-indigo-50 p-10 rounded-[3rem] border border-indigo-100 space-y-6 text-center">
                        <div className="mx-auto w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm"><HardDriveDownload size={32}/></div>
                        <h3 className="text-xl font-black text-indigo-900 uppercase">Exportar Datos</h3>
                        <select className="w-full px-4 py-3 bg-white border-2 border-indigo-200 rounded-xl font-bold text-xs" value={exportTarget} onChange={(e) => setExportTarget(e.target.value)}>
                            <option value="ALL">Copia Completa (Multi-libro)</option>
                            {books.map(b => <option key={b.id} value={b.id}>Libro: {b.name}</option>)}
                        </select>
                        <button onClick={() => onExportData(exportTarget)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[11px] shadow-xl hover:bg-indigo-700 transition-all">Descargar JSON</button>
                    </div>

                    <div className="bg-slate-50 p-10 rounded-[3rem] border border-slate-100 space-y-6 text-center">
                        <div className="mx-auto w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-slate-600 shadow-sm"><HardDriveUpload size={32}/></div>
                        <h3 className="text-xl font-black text-slate-900 uppercase">Restaurar Copia</h3>
                        <p className="text-xs text-slate-400 font-medium mb-2">Importa datos desde un archivo .json de backup.</p>
                        <label htmlFor="restore-input" className="w-full py-4 bg-white text-slate-900 border-2 border-slate-200 rounded-2xl font-black uppercase text-[11px] shadow-sm hover:border-indigo-500 transition-all cursor-pointer flex items-center justify-center gap-2">
                            <FileJson size={16}/> Seleccionar Archivo
                        </label>
                        <input id="restore-input" type="file" className="hidden" accept="application/json,.json" onChange={handleFileSelect} />
                    </div>
                </div>

                <div className="bg-rose-50 p-10 rounded-[3rem] border border-rose-100 space-y-6 text-center">
                    <div className="mx-auto w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-rose-600 shadow-sm"><ShieldAlert size={32}/></div>
                    <h3 className="text-xl font-black text-rose-900 uppercase tracking-tighter">Zona de Peligro</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <button onClick={() => openVerification('ALL_TX')} className="p-6 bg-white rounded-[2rem] border border-rose-100 flex flex-col items-center justify-center gap-2 hover:border-rose-300 transition-all">
                            <Eraser size={24} className="text-rose-400"/><span className="text-[9px] font-black text-rose-600 uppercase">Vaciar Libro Actual</span>
                        </button>
                        <button onClick={() => openVerification('BOOK')} className="p-6 bg-rose-600 text-white rounded-[2rem] border border-rose-600 flex flex-col items-center justify-center gap-2 hover:bg-rose-700 transition-all">
                            <Trash2 size={24}/><span className="text-[9px] font-black uppercase">Eliminar Libro</span>
                        </button>
                        <div className="p-4 bg-white rounded-[2rem] border border-rose-100 space-y-2">
                            <p className="text-[8px] font-black uppercase text-slate-400">Borrar por Año</p>
                            <select className="w-full bg-slate-50 border border-slate-200 text-xs rounded-lg px-2 py-1 outline-none" value={yearToDelete} onChange={e => setYearToDelete(e.target.value)}>
                                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                            <button onClick={() => openVerification('YEAR', yearToDelete)} className="text-[9px] font-black uppercase text-rose-500 hover:underline">Confirmar Año</button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'TOOLS' && (
            <div className="bg-indigo-600 p-10 rounded-[3rem] text-white space-y-8 shadow-2xl relative overflow-hidden animate-in fade-in">
                <div className="absolute top-0 right-0 p-12 opacity-10"><Bot size={120}/></div>
                <div className="relative z-10 space-y-4">
                    <h3 className="text-3xl font-black uppercase tracking-tighter">Smart Import</h3>
                    <p className="text-indigo-100 text-sm">Carga tus extractos bancarios y deja que la IA asigne categorías basándose en tu histórico.</p>
                    <button onClick={() => onNavigateToTransactions?.({ action: 'IMPORT' })} className="px-8 py-4 bg-white text-indigo-600 rounded-2xl font-black uppercase text-[11px] shadow-xl hover:scale-105 transition-all">
                        Lanzar Importador
                    </button>
                </div>
            </div>
        )}
      </div>

      {/* MODAL EDITOR (Genérico) */}
      {isEditModalOpen && (
            <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[400] p-4 animate-in fade-in zoom-in duration-300">
                <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg p-10 relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                    <button onClick={resetForm} className="absolute top-8 right-8 p-3 bg-slate-50 text-slate-400 rounded-full hover:text-rose-500 transition-all"><X size={24}/></button>
                    {activeTab === 'ACC_GROUPS' && (
                        <div className="space-y-6">
                            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{grpId ? 'Editar' : 'Nuevo'} Grupo</h3>
                            <input type="text" placeholder="Nombre del grupo..." className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:border-indigo-500 outline-none" value={grpName} onChange={e => setGrpName(e.target.value)} />
                            {renderIconInput(grpIcon, setGrpIcon, grpName)}
                            <button onClick={() => { if(!grpName) return; if(grpId) onUpdateData({accountGroups: data.accountGroups.map(g=>g.id===grpId?{...g,name:grpName,icon:grpIcon}:g)}); else onUpdateData({accountGroups: [...data.accountGroups, {id:generateId(),name:grpName,icon:grpIcon}]}); resetForm(); }} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] hover:bg-indigo-600 shadow-xl transition-all">Guardar Grupo</button>
                        </div>
                    )}
                    {activeTab === 'ACCOUNTS' && (
                        <div className="space-y-6">
                            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{accId ? 'Editar' : 'Nueva'} Cuenta</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <input type="text" placeholder="Nombre..." className="px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:border-indigo-500 outline-none" value={accName} onChange={e => setAccName(e.target.value)} />
                                <input type="number" placeholder="Saldo inicial..." className="px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:border-indigo-500 outline-none" value={accBalance} onChange={e => setAccBalance(e.target.value)} />
                            </div>
                            <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={accGroupId} onChange={e => setAccGroupId(e.target.value)}>
                                <option value="">Selecciona un grupo...</option>
                                {data.accountGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                            <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                                <button onClick={() => setAccActive(true)} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${accActive ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Activa</button>
                                <button onClick={() => setAccActive(false)} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${!accActive ? 'bg-white text-slate-600 shadow-sm' : 'text-slate-400'}`}>Archivada</button>
                            </div>
                            {renderIconInput(accIcon, setAccIcon, accName)}
                            <button onClick={() => { if(!accName || !accGroupId) return; const bal = parseFloat(accBalance) || 0; if(accId) onUpdateData({accounts: data.accounts.map(a=>a.id===accId?{...a,name:accName,initialBalance:bal,icon:accIcon,groupId:accGroupId, active: accActive}:a)}); else onUpdateData({accounts: [...data.accounts, {id:generateId(),name:accName,initialBalance:bal,currency:'EUR',icon:accIcon,groupId:accGroupId, active: true}]}); resetForm(); }} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] hover:bg-indigo-600 shadow-xl transition-all">Guardar Cuenta</button>
                        </div>
                    )}
                    {activeTab === 'FAMILIES' && (
                        <div className="space-y-6">
                            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{famId ? 'Editar' : 'Nueva'} Familia</h3>
                            <input type="text" placeholder="Nombre de familia..." className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:border-indigo-500 outline-none" value={famName} onChange={e => setFamName(e.target.value)} />
                            <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                                <button onClick={() => setFamType('EXPENSE')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${famType === 'EXPENSE' ? 'bg-white text-rose-500 shadow-sm' : 'text-slate-400'}`}>Gasto</button>
                                <button onClick={() => setFamType('INCOME')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${famType === 'INCOME' ? 'bg-white text-emerald-500 shadow-sm' : 'text-slate-400'}`}>Ingreso</button>
                            </div>
                            {renderIconInput(famIcon, setFamIcon, famName)}
                            <button onClick={() => { if(!famName) return; if(famId) onUpdateData({families: data.families.map(f=>f.id===famId?{...f,name:famName,type:famType,icon:famIcon}:f)}); else onUpdateData({families: [...data.families, {id:generateId(),name:famName,type:famType,icon:famIcon}]}); resetForm(); }} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] hover:bg-indigo-600 shadow-xl transition-all">Guardar Familia</button>
                        </div>
                    )}
                    {activeTab === 'CATEGORIES' && (
                        <div className="space-y-6">
                            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{catId ? 'Editar' : 'Nueva'} Categoría</h3>
                            <input type="text" placeholder="Nombre de categoría..." className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:border-indigo-500 outline-none" value={catName} onChange={e => setCatName(e.target.value)} />
                            <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={catParent} onChange={e => setCatParent(e.target.value)}>
                                <option value="">Selecciona una familia...</option>
                                {data.families.map(f => <option key={f.id} value={f.id}>{f.name} ({f.type})</option>)}
                            </select>
                            <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                                <button onClick={() => setCatActive(true)} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${catActive ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Activa</button>
                                <button onClick={() => setCatActive(false)} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${!catActive ? 'bg-white text-slate-600 shadow-sm' : 'text-slate-400'}`}>Archivada</button>
                            </div>
                            {renderIconInput(catIcon, setCatIcon, catName)}
                            <button onClick={() => { if(!catName || !catParent) return; if(catId) onUpdateData({categories: data.categories.map(c=>c.id===catId?{...c,name:catName,familyId:catParent,icon:catIcon, active: catActive}:c)}); else onUpdateData({categories: [...data.categories, {id:generateId(),name:catName,familyId:catParent,icon:catIcon, active: true}]}); resetForm(); }} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] hover:bg-indigo-600 shadow-xl transition-all">Guardar Categoría</button>
                        </div>
                    )}
                </div>
            </div>
      )}

      {/* RESTORE MODAL - SELECCIÓN DE DESTINO (Z-Index alto garantizado) */}
      {restoreFile && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[600] p-6 animate-in fade-in duration-300">
              <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl p-10 text-center relative border border-white/20">
                  <button onClick={resetForm} className="absolute top-6 right-6 p-2 bg-slate-50 text-slate-400 rounded-full hover:text-rose-500 transition-all"><X size={20}/></button>
                  <div className="mx-auto w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center border border-indigo-100 mb-6 shadow-sm text-indigo-500">
                      <HardDriveUpload size={40}/>
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-2">Restaurar Copia de Seguridad</h3>
                  <p className="text-sm text-slate-500 mb-8 max-w-md mx-auto">
                      Has seleccionado el archivo <span className="font-bold text-slate-800">{restoreFileName}</span>. ¿Dónde quieres volcar estos datos?
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                      {/* OPCIÓN 1: SOBREESCRIBIR ACTUAL */}
                      <div className="p-6 bg-slate-50 border border-slate-200 rounded-[2rem] hover:border-indigo-300 transition-all flex flex-col group">
                          <BookCopy className="text-indigo-600 mb-2 group-hover:scale-110 transition-transform" size={28} />
                          <h4 className="font-black text-slate-800 uppercase text-xs">Libro Actual</h4>
                          <p className="text-[10px] text-slate-400 mt-1 mb-4 leading-tight">Reemplaza los datos del libro que estás viendo ahora mismo.</p>
                          <div className="mt-auto">
                              <div className="bg-rose-50 text-rose-600 text-[8px] font-black uppercase p-2 rounded-lg mb-3 flex items-center gap-1"><AlertTriangle size={10}/> ¡Cuidado! Sobreescribe todo.</div>
                              <button onClick={() => executeRestore('CURRENT')} className="w-full py-3 bg-white border-2 border-slate-200 text-slate-700 rounded-xl font-black uppercase text-[9px] tracking-widest hover:border-indigo-500 hover:text-indigo-600 transition-all shadow-sm">Restaurar aquí</button>
                          </div>
                      </div>

                      {/* OPCIÓN 2: OTRO LIBRO EXISTENTE */}
                      <div className="p-6 bg-slate-50 border border-slate-200 rounded-[2rem] hover:border-indigo-300 transition-all flex flex-col group">
                          <ArrowRightLeft className="text-indigo-600 mb-2 group-hover:scale-110 transition-transform" size={28} />
                          <h4 className="font-black text-slate-800 uppercase text-xs">Otro Libro</h4>
                          <p className="text-[10px] text-slate-400 mt-1 mb-4 leading-tight">Vuelca los datos en otra de tus contabilidades existentes.</p>
                          <div className="mt-auto space-y-3">
                              <select className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black outline-none focus:border-indigo-500" value={restoreTargetBook} onChange={e => setRestoreTargetBook(e.target.value)}>
                                  <option value="">Selecciona libro...</option>
                                  {books.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                              </select>
                              <button onClick={() => executeRestore('OTHER')} disabled={!restoreTargetBook} className="w-full py-3 bg-white border-2 border-slate-200 text-slate-700 rounded-xl font-black uppercase text-[9px] tracking-widest hover:border-indigo-500 disabled:opacity-50 transition-all">Restaurar en libro</button>
                          </div>
                      </div>

                      {/* OPCIÓN 3: CREAR NUEVO LIBRO */}
                      <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-[2rem] hover:border-indigo-300 transition-all flex flex-col group">
                          <BookPlus className="text-indigo-600 mb-2 group-hover:scale-110 transition-transform" size={28} />
                          <h4 className="font-black text-indigo-900 uppercase text-xs">Nuevo Libro</h4>
                          <p className="text-[10px] text-indigo-400 mt-1 mb-4 leading-tight">Crea una nueva contabilidad independiente con estos datos.</p>
                          <div className="mt-auto space-y-2">
                              <input type="text" placeholder="Nombre del libro..." className="w-full bg-white border border-indigo-100 rounded-xl px-3 py-2 text-[10px] font-black outline-none focus:border-indigo-500 shadow-sm" value={newBookName} onChange={e => setNewBookName(e.target.value)} />
                              <div className="flex gap-1 justify-between py-1">
                                  {(['BLACK', 'BLUE', 'ROSE', 'EMERALD', 'AMBER', 'VIOLET'] as BookColor[]).map(c => (
                                      <button key={c} onClick={() => setNewBookColor(c)} className={`w-4 h-4 rounded-full transition-all ${newBookColor === c ? 'ring-2 ring-offset-1 ring-indigo-400 scale-110' : 'opacity-40'}`} style={{ backgroundColor: c === 'BLACK' ? '#020617' : c === 'BLUE' ? '#2563eb' : c === 'ROSE' ? '#f43f5e' : c === 'EMERALD' ? '#10b981' : c === 'AMBER' ? '#f59e0b' : '#7c3aed' }} />
                                  ))}
                              </div>
                              <button onClick={() => executeRestore('NEW')} disabled={!newBookName.trim()} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg">Crear y Restaurar</button>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* VERIFICATION MODAL PARA ACCIONES PELIGROSAS */}
      {verificationModal && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[700] p-6 animate-in fade-in duration-300">
              <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-sm p-10 text-center relative border border-white/20">
                  <button onClick={resetForm} className="absolute top-6 right-6 p-2 bg-slate-50 text-slate-400 rounded-full hover:text-rose-500 hover:bg-rose-50 transition-all"><X size={20}/></button>
                  <div className="mx-auto w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center border border-rose-100 mb-6 shadow-sm text-rose-500"><ShieldAlert size={40}/></div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-2">¿Confirmar acción?</h3>
                  <p className="text-xs font-medium text-slate-500 mb-6 leading-relaxed">Esta acción borrará datos financieros de forma irreversible. Escribe la palabra <span className="font-black text-rose-600">BORRAR</span> en mayúsculas para proceder.</p>
                  <input type="text" placeholder="BORRAR" className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-center outline-none focus:border-rose-500 transition-all uppercase mb-6" value={verificationInput} onChange={e => setVerificationInput(e.target.value.toUpperCase())} />
                  <button onClick={executeDangerousAction} disabled={verificationInput !== 'BORRAR'} className={`w-full py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl transition-all ${verificationInput === 'BORRAR' ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>Eliminar permanentemente</button>
              </div>
          </div>
      )}
    </div>
  );
};
