
import React, { useState, useRef, useEffect } from 'react';
import { AppState, Account, Family, Category, Transaction, TransactionType, RecurrentMovement, FavoriteMovement, RecurrenceFrequency } from '../types';
import { Trash2, Edit2, Layers, Tag, Wallet, Loader2, ImageIcon, Sparkles, ChevronDown, XCircle, Info, Download, Upload, FileJson, FileSpreadsheet, DatabaseZap, ClipboardPaste, ListOrdered, CheckCircle2, Repeat, Star, Power, Calendar, ArrowRightLeft, ShieldCheck, AlertCircle, Plus, FileText, MoveRight } from 'lucide-react';
import { searchInternetLogos } from '../services/iconService';
import { mapBankTransactions, parseMigrationData } from '../services/geminiService';
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

  // Estados de importación inteligente (Bancos)
  const [isImporting, setIsImporting] = useState(false);
  const [importStep, setImportStep] = useState<'IDLE' | 'PREVIEW' | 'MAPPING' | 'SUCCESS'>('IDLE');
  const [importAccount, setImportAccount] = useState(data.accounts[0]?.id || '');
  const [mappedTransactions, setMappedTransactions] = useState<any[]>([]);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Importador de Entidades (CSV/Excel para Cuentas/Familias/Categorias)
  const entityImportFileRef = useRef<HTMLInputElement>(null);

  // Estado Migración Legacy (Contamoney)
  const [migrationText, setMigrationText] = useState('');
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationPreview, setMigrationPreview] = useState<{accounts: any[], families: any[], categories: any[]} | null>(null);

  // Importación rápida por texto/CSV
  const [showQuickImport, setShowQuickImport] = useState(false);
  const [pasteData, setPasteData] = useState('');

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

  // Estados de formulario Recurrentes
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
      setMappedTransactions([]); setImportStep('IDLE'); setShowQuickImport(false); setPasteData('');
      setMigrationText(''); setMigrationPreview(null);
      if (entityImportFileRef.current) entityImportFileRef.current.value = '';
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

  const handleEntityFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
          try {
              const bstr = evt.target?.result;
              const wb = XLSX.read(bstr, { type: 'binary' });
              const wsname = wb.SheetNames[0];
              const ws = wb.Sheets[wsname];
              const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

              const rows = rawData.filter(row => row && row.length > 0);
              
              let count = 0;

              if (activeTab === 'FAMILIES') {
                  const newFamilies: Family[] = [];
                  rows.forEach(row => {
                      const name = row[0]?.toString().trim();
                      // Simple skip for header row
                      if (!name || name.toLowerCase() === 'nombre') return;
                      
                      const icon = row[1]?.toString().trim() || '📂';
                      let typeStr = row[2]?.toString().trim().toUpperCase();
                      const type = (typeStr === 'INCOME' || typeStr === 'INGRESO') ? 'INCOME' : 'EXPENSE';
                      
                      newFamilies.push({ id: generateId(), name, icon, type });
                  });
                  if(newFamilies.length > 0) {
                      onUpdateData({ families: [...data.families, ...newFamilies] });
                      count = newFamilies.length;
                  }
              } else if (activeTab === 'CATEGORIES') {
                  const newCategories: Category[] = [];
                  rows.forEach(row => {
                      const name = row[0]?.toString().trim();
                      if (!name || name.toLowerCase() === 'nombre') return;

                      const icon = row[1]?.toString().trim() || '🏷️';
                      const familyName = row[2]?.toString().trim();
                      
                      const family = data.families.find(f => f.name.toLowerCase() === familyName?.toLowerCase()) || data.families[0];
                      
                      newCategories.push({ id: generateId(), name, icon, familyId: family?.id || '' });
                  });
                  if(newCategories.length > 0) {
                      onUpdateData({ categories: [...data.categories, ...newCategories] });
                      count = newCategories.length;
                  }
              } else if (activeTab === 'ACCOUNTS') {
                  const newAccounts: Account[] = [];
                  rows.forEach(row => {
                      const name = row[0]?.toString().trim();
                      if (!name || name.toLowerCase() === 'nombre') return;

                      const balance = parseFloat(row[1]?.toString().replace(',','.') || '0');
                      const icon = row[2]?.toString().trim() || '🏦';

                      newAccounts.push({ id: generateId(), name, initialBalance: balance || 0, currency: 'EUR', icon });
                  });
                  if(newAccounts.length > 0) {
                      onUpdateData({ accounts: [...data.accounts, ...newAccounts] });
                      count = newAccounts.length;
                  }
              }
              
              if (count > 0) alert(`¡Importación exitosa! Se han añadido ${count} elementos.`);
              else alert("No se encontraron datos válidos o el formato no es correcto.");
              
              resetForm();
          } catch (err) {
              console.error("Error parsing entity file", err);
              alert("Error al leer el archivo. Asegúrate de que sea un CSV o Excel válido.");
          }
      };
      reader.readAsBinaryString(file);
  };

  const handleQuickImport = () => {
      if (!pasteData.trim()) return;
      const lines = pasteData.trim().split('\n');
      
      if (activeTab === 'FAMILIES') {
          const newFamilies: Family[] = lines.map(line => {
              const [name, icon, type] = line.split(',').map(s => s.trim());
              return {
                  id: generateId(),
                  name: name || 'Nueva Familia',
                  icon: icon || '📂',
                  type: (type === 'INCOME' ? 'INCOME' : 'EXPENSE') as 'INCOME' | 'EXPENSE'
              };
          });
          onUpdateData({ families: [...data.families, ...newFamilies] });
      } else if (activeTab === 'CATEGORIES') {
          const newCategories: Category[] = lines.map(line => {
              const [name, icon, familyName] = line.split(',').map(s => s.trim());
              const family = data.families.find(f => f.name.toLowerCase() === familyName?.toLowerCase()) || data.families[0];
              return {
                  id: generateId(),
                  name: name || 'Nueva Categoría',
                  icon: icon || '🏷️',
                  familyId: family?.id || ''
              };
          });
          onUpdateData({ categories: [...data.categories, ...newCategories] });
      } else if (activeTab === 'ACCOUNTS') {
          const newAccounts: Account[] = lines.map(line => {
              const [name, balance, icon] = line.split(',').map(s => s.trim());
              return {
                  id: generateId(),
                  name: name || 'Nueva Cuenta',
                  initialBalance: parseFloat(balance) || 0,
                  currency: 'EUR',
                  icon: icon || '🏦'
              };
          });
          onUpdateData({ accounts: [...data.accounts, ...newAccounts] });
      }
      resetForm();
  };

  const handleMigrationProcess = async () => {
      if (!migrationText.trim()) return;
      setIsMigrating(true);
      try {
          const result = await parseMigrationData(migrationText);
          setMigrationPreview(result);
      } catch (e) {
          alert("Error al analizar los datos de migración.");
      } finally {
          setIsMigrating(false);
      }
  };

  const confirmMigration = () => {
      if (!migrationPreview) return;
      
      const newAccounts = migrationPreview.accounts.map(a => ({
          id: generateId(),
          name: a.name,
          initialBalance: a.balance || 0,
          currency: 'EUR',
          icon: '🏦'
      }));

      const newFamilies = migrationPreview.families.map(f => ({
          id: generateId(),
          name: f.name,
          type: (f.type === 'INCOME' ? 'INCOME' : 'EXPENSE') as any,
          icon: '📂'
      }));

      // Mapear categorías a las nuevas familias
      const newCategories = migrationPreview.categories.map(c => {
          // Intentar buscar familia existente por nombre o en las nuevas creadas
          const fam = [...data.families, ...newFamilies].find(f => f.name.toLowerCase() === c.familyName?.toLowerCase()) || newFamilies[0];
          return {
              id: generateId(),
              name: c.name,
              familyId: fam?.id || '',
              icon: '🏷️'
          };
      });

      onUpdateData({
          accounts: [...data.accounts, ...newAccounts],
          families: [...data.families, ...newFamilies],
          categories: [...data.categories, ...newCategories]
      });
      
      resetForm();
      alert("¡Migración completada! Se han añadido las estructuras nuevas.");
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsImporting(true);
      const reader = new FileReader();
      reader.onload = async (evt) => {
          try {
              const bstr = evt.target?.result;
              const wb = XLSX.read(bstr, { type: 'binary' });
              const wsname = wb.SheetNames[0];
              const ws = wb.Sheets[wsname];
              const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });
              
              const sample = rawData.slice(0, 50);
              const mapped = await mapBankTransactions(sample, data.categories, data.families);
              
              setMappedTransactions(mapped);
              setImportStep('PREVIEW');
          } catch (err) {
              console.error("Error parsing file", err);
              alert("Error al leer el archivo.");
          } finally {
              setIsImporting(false);
          }
      };
      reader.readAsBinaryString(file);
  };

  const confirmImport = () => {
      const newTransactions: Transaction[] = mappedTransactions.map(item => ({
          id: generateId(),
          date: item.date,
          amount: item.amount,
          description: item.description,
          accountId: importAccount,
          type: item.type as TransactionType,
          categoryId: item.categoryId,
          familyId: item.familyId
      }));

      onUpdateData({ transactions: [...data.transactions, ...newTransactions] });
      setImportStep('SUCCESS');
      setTimeout(() => resetForm(), 3000);
  };

  const exportBackup = () => {
      const dataStr = JSON.stringify(data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `contamiki_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  };

  const renderIconInput = (icon: string, setIcon: (s: string) => void, currentName: string, fileRef: React.RefObject<HTMLInputElement>) => {
    const isImage = icon.startsWith('data:image') || icon.startsWith('http');
    const showBox = isSearchingWeb || webLogos.length > 0 || (hasSearched && !isSearchingWeb);
    return (
      <div className="space-y-4 w-full">
          <div className="flex flex-col sm:flex-row gap-4 items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="relative group w-20 h-20 flex-shrink-0 flex items-center justify-center border-2 border-white rounded-2xl bg-white overflow-hidden shadow-sm cursor-pointer" onClick={() => fileRef.current?.click()}>
                    {isImage ? <img src={icon} className="w-full h-full object-contain p-2" alt="Icono" referrerPolicy="no-referrer" /> : <span className="text-3xl">{icon}</span>}
                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><ImageIcon className="text-white" size={20} /></div>
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

  const renderQuickImport = () => {
    let importHint = "";
    let placeholderExample = "";

    switch(activeTab) {
        case 'ACCOUNTS':
            importHint = "Nombre, Saldo Inicial, Icono/Emoji";
            placeholderExample = "BBVA, 1500.00, 🏦\nCartera Efectivo, 85.50, 💶\nTarjeta Revolut, 300.00, 💳";
            break;
        case 'FAMILIES':
            importHint = "Nombre, Icono/Emoji, Tipo (INCOME/EXPENSE)";
            placeholderExample = "Vivienda, 🏠, EXPENSE\nNómina, 💼, INCOME\nOcio y Viajes, ✈️, EXPENSE";
            break;
        case 'CATEGORIES':
            importHint = "Nombre, Icono/Emoji, Nombre de Familia";
            placeholderExample = "Alquiler, 🔑, Vivienda\nSupermercado, 🛒, Alimentación\nGasolina, ⛽, Vehículo";
            break;
        default:
            importHint = "Formato genérico";
            placeholderExample = "Dato1, Dato2, Dato3";
    }

    return (
        <div className="bg-white p-8 rounded-[2.5rem] border-2 border-dashed border-indigo-100 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2"><ClipboardPaste size={16} /> Importación Rápida: {activeTab === 'FAMILIES' ? 'Familias' : activeTab === 'ACCOUNTS' ? 'Cuentas' : 'Categorías'}</h4>
                <button onClick={() => setShowQuickImport(false)} className="text-slate-300 hover:text-rose-500"><XCircle size={18}/></button>
            </div>
            <p className="text-[9px] font-bold text-slate-400 uppercase leading-relaxed">
                Pega aquí tus datos. Formato esperado: <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">{importHint}</span>. Una fila por elemento.
            </p>
            <textarea 
                className="w-full h-40 p-5 bg-slate-50 border border-slate-100 rounded-xl font-mono text-[11px] outline-none focus:border-indigo-500 transition-all custom-scrollbar placeholder:text-slate-300" 
                placeholder={placeholderExample}
                value={pasteData}
                onChange={e => setPasteData(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
                <button onClick={handleQuickImport} className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg hover:bg-slate-950 transition-all">Importar Texto</button>
                <button onClick={() => entityImportFileRef.current?.click()} className="flex-1 py-4 bg-emerald-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"><Upload size={14}/> Subir CSV/Excel</button>
                <input type="file" ref={entityImportFileRef} className="hidden" accept=".csv, .xlsx, .xls" onChange={handleEntityFileImport} />
                <button onClick={() => resetForm()} className="px-6 py-4 bg-slate-100 text-slate-500 rounded-xl font-black text-[9px] uppercase">Cancelar</button>
            </div>
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
        {/* ... (Bloques de ACCOUNTS, FAMILIES, CATEGORIES, RECURRENTS, FAVORITES se mantienen igual, no los cambiamos aquí por brevedad) ... */}
        {activeTab === 'ACCOUNTS' && (
            <div className="grid grid-cols-1 gap-10">
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-4">
                            <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-2xl"><Wallet size={24}/></div>
                            {accId ? 'Editar Cuenta' : 'Nueva Cuenta'}
                        </h3>
                        {!showQuickImport && (
                            <button onClick={() => setShowQuickImport(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-500 rounded-xl font-black text-[9px] uppercase hover:bg-indigo-50 hover:text-indigo-600 transition-all">
                                <Plus size={14}/> Importar Masivo
                            </button>
                        )}
                    </div>
                    {showQuickImport ? renderQuickImport() : (
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
                    )}
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 px-4">Listado de Cuentas</h4>
                    <div className="space-y-3">
                        {data.accounts.map(acc => (
                            <div key={acc.id} className="flex justify-between items-center p-5 bg-slate-50 rounded-3xl border border-transparent hover:border-slate-200 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center border border-slate-100 p-2 shadow-sm shrink-0">
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
        
        {activeTab === 'FAMILIES' && (
            <div className="grid grid-cols-1 gap-10">
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-4">
                            <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-2xl"><Layers size={24}/></div>
                            {famId ? 'Editar Familia' : 'Nueva Familia'}
                        </h3>
                        {!showQuickImport && (
                            <button onClick={() => setShowQuickImport(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-500 rounded-xl font-black text-[9px] uppercase hover:bg-indigo-50 hover:text-indigo-600 transition-all">
                                <Plus size={14}/> Importar Masivo
                            </button>
                        )}
                    </div>
                    {showQuickImport ? renderQuickImport() : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre</label>
                                    <input type="text" placeholder="Ej: Vivienda, Ocio..." className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={famName} onChange={e => { setFamName(e.target.value); triggerWebSearch(e.target.value); }} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo</label>
                                    <div className="flex bg-slate-50 p-1 rounded-2xl border-2 border-slate-100 h-[64px]">
                                        <button onClick={() => setFamType('EXPENSE')} className={`flex-1 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${famType === 'EXPENSE' ? 'bg-white text-rose-500 shadow-md' : 'text-slate-400'}`}>Gasto</button>
                                        <button onClick={() => setFamType('INCOME')} className={`flex-1 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${famType === 'INCOME' ? 'bg-white text-emerald-500 shadow-md' : 'text-slate-400'}`}>Ingreso</button>
                                    </div>
                                </div>
                            </div>
                            {renderIconInput(famIcon, setFamIcon, famName, famFileInputRef)}
                            <button onClick={() => {
                                if(!famName) return;
                                if (famId) onUpdateData({ families: data.families.map(f => f.id === famId ? { ...f, name: famName, type: famType, icon: famIcon } : f) });
                                else onUpdateData({ families: [...data.families, { id: generateId(), name: famName, type: famType, icon: famIcon }] });
                                resetForm();
                            }} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-2xl hover:bg-indigo-600 transition-all">Guardar Familia</button>
                        </div>
                    )}
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 px-4">Mantenimiento de Familias</h4>
                    <div className="space-y-3">
                        {data.families.map(fam => (
                            <div key={fam.id} className="flex justify-between items-center p-5 bg-slate-50 rounded-3xl border border-transparent hover:border-slate-200 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center border border-slate-100 p-2 shadow-sm shrink-0">
                                      {renderIcon(fam.icon || '📂', "w-full h-full")}
                                    </div>
                                    <div>
                                        <span className="font-black text-slate-900 block text-xs uppercase">{fam.name}</span>
                                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${fam.type === 'INCOME' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>{fam.type === 'INCOME' ? 'Ingreso' : 'Gasto'}</span>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => { setFamId(fam.id); setFamName(fam.name); setFamType(fam.type); setFamIcon(fam.icon || '📂'); }} className="p-3 text-slate-300 hover:text-indigo-600"><Edit2 size={18}/></button>
                                    <button onClick={() => onUpdateData({families: data.families.filter(f=>f.id!==fam.id)})} className="p-3 text-slate-300 hover:text-rose-600"><Trash2 size={18}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'CATEGORIES' && (
            <div className="grid grid-cols-1 gap-10">
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-4">
                            <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-2xl"><Tag size={24}/></div>
                            {catId ? 'Editar Categoría' : 'Nueva Categoría'}
                        </h3>
                        {!showQuickImport && (
                            <button onClick={() => setShowQuickImport(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-500 rounded-xl font-black text-[9px] uppercase hover:bg-indigo-50 hover:text-indigo-600 transition-all">
                                <Plus size={14}/> Importar Masivo
                            </button>
                        )}
                    </div>
                    {showQuickImport ? renderQuickImport() : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre</label>
                                    <input type="text" placeholder="Ej: Supermercado, Cine..." className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={catName} onChange={e => { setCatName(e.target.value); triggerWebSearch(e.target.value); }} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Familia Superior</label>
                                    <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={catParent} onChange={e => setCatParent(e.target.value)}>
                                        <option value="">Seleccionar...</option>
                                        {data.families.map(f => <option key={f.id} value={f.id}>{f.icon} {f.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            {renderIconInput(catIcon, setCatIcon, catName, catFileInputRef)}
                            <button onClick={() => {
                                if(!catName || !catParent) return;
                                if (catId) onUpdateData({ categories: data.categories.map(c => c.id === catId ? { ...c, name: catName, familyId: catParent, icon: catIcon } : c) });
                                else onUpdateData({ categories: [...data.categories, { id: generateId(), name: catName, familyId: catParent, icon: catIcon }] });
                                resetForm();
                            }} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-2xl hover:bg-indigo-600 transition-all">Guardar Categoría</button>
                        </div>
                    )}
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 px-4">Mantenimiento de Categorías</h4>
                    <div className="space-y-3">
                        {data.categories.map(cat => {
                            const family = data.families.find(f => f.id === cat.familyId);
                            return (
                                <div key={cat.id} className="flex justify-between items-center p-5 bg-slate-50 rounded-3xl border border-transparent hover:border-slate-200 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center border border-slate-100 p-2 shadow-sm shrink-0">
                                          {renderIcon(cat.icon || '🏷️', "w-full h-full")}
                                        </div>
                                        <div>
                                            <span className="font-black text-slate-900 block text-xs uppercase">{cat.name}</span>
                                            <span className="text-[8px] font-bold text-slate-400 uppercase">{family?.name || 'Sin Familia'}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => { setCatId(cat.id); setCatName(cat.name); setCatParent(cat.familyId); setCatIcon(cat.icon || '🏷️'); }} className="p-3 text-slate-300 hover:text-indigo-600"><Edit2 size={18}/></button>
                                        <button onClick={() => onUpdateData({categories: data.categories.filter(c=>c.id!==cat.id)})} className="p-3 text-slate-300 hover:text-rose-600"><Trash2 size={18}/></button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        )}

        {/* ... (RECURRENTS y FAVORITES se mantienen igual) ... */}
        {activeTab === 'RECURRENTS' && (
            <div className="grid grid-cols-1 gap-10">
                {/* ... (Contenido de RECURRENTS sin cambios) ... */}
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
                {/* ... (Contenido de FAVORITES sin cambios) ... */}
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
            <div className="space-y-8">
                
                {/* --- NUEVO BLOQUE: MIGRACIÓN CONTAMONEY (Legacy) --- */}
                <div className="bg-amber-50 p-10 rounded-[3rem] shadow-sm border border-amber-100 space-y-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/10 blur-[80px] -mr-16 -mt-16 pointer-events-none"></div>
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 relative z-10">
                        <div className="space-y-2 max-w-lg">
                            <h3 className="text-2xl font-black text-amber-900 uppercase tracking-tighter flex items-center gap-3">
                                <ArrowRightLeft className="text-amber-600" size={28}/> Asistente de Migración
                            </h3>
                            <p className="text-amber-700/60 text-xs font-bold uppercase tracking-widest leading-relaxed">
                                ¿Vienes de <strong>Contamoney</strong> u otra app antigua? Pega aquí el contenido de tus tablas de Cuentas, Categorías o Exportaciones y la IA reconstruirá tu estructura financiera.
                            </p>
                        </div>
                    </div>

                    {!migrationPreview ? (
                        <div className="space-y-4">
                            <textarea 
                                className="w-full h-40 p-5 bg-white border-2 border-amber-100 rounded-2xl font-mono text-[11px] text-slate-600 outline-none focus:border-amber-400 transition-all custom-scrollbar placeholder:text-amber-200"
                                placeholder="Ejemplo: Copia la tabla de categorías de Contamoney y pégala aquí..."
                                value={migrationText}
                                onChange={e => setMigrationText(e.target.value)}
                            />
                            <div className="flex justify-end">
                                <button 
                                    onClick={handleMigrationProcess}
                                    disabled={isMigrating || !migrationText}
                                    className="px-8 py-4 bg-amber-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-600 transition-all shadow-xl shadow-amber-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isMigrating ? <Loader2 className="animate-spin" size={16}/> : <Sparkles size={16}/>}
                                    {isMigrating ? 'Analizando estructura...' : 'Procesar Migración'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white p-6 rounded-3xl border border-amber-100 space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <div className="flex items-center gap-3 border-b border-amber-50 pb-4">
                                <CheckCircle2 className="text-emerald-500" />
                                <h4 className="font-black text-slate-800 uppercase tracking-tight">Estructura Detectada</h4>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cuentas</span>
                                    <p className="text-2xl font-black text-slate-900">{migrationPreview.accounts.length}</p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Familias</span>
                                    <p className="text-2xl font-black text-slate-900">{migrationPreview.families.length}</p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Categorías</span>
                                    <p className="text-2xl font-black text-slate-900">{migrationPreview.categories.length}</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={confirmMigration} className="flex-1 py-4 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100">Aplicar Migración</button>
                                <button onClick={() => { setMigrationPreview(null); setMigrationText(''); }} className="px-6 py-4 bg-slate-100 text-slate-500 rounded-xl font-black text-[10px] uppercase hover:bg-slate-200 transition-all">Cancelar</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* SMART IMPORT BANCARIO (Existente) */}
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-50 pb-8">
                        <div className="space-y-2">
                            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3"><ShieldCheck className="text-indigo-600" size={28}/> Smart Bank Import</h3>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">IA impulsada por Gemini para volcado masivo</p>
                        </div>
                        <button onClick={() => importFileRef.current?.click()} className="flex items-center justify-center gap-3 px-8 py-5 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-950 transition-all shadow-xl shadow-indigo-200">
                           <FileSpreadsheet size={20} /> Seleccionar Extracto
                        </button>
                        <input type="file" ref={importFileRef} className="hidden" accept=".csv, .xlsx, .xls" onChange={handleFileImport} />
                    </div>

                    {isImporting ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-6 animate-pulse">
                            <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                            <div className="text-center space-y-2">
                                <p className="text-[10px] font-black text-slate-900 uppercase tracking-[0.4em]">Gemini está analizando tu extracto...</p>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Identificando columnas y categorizando movimientos</p>
                            </div>
                        </div>
                    ) : importStep === 'IDLE' ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                                { icon: <Upload className="text-indigo-500" />, title: "Sube tu archivo", desc: "Descarga el Excel/CSV de cualquier banco y arrástralo aquí." },
                                { icon: <Sparkles className="text-indigo-500" />, title: "IA de Mapeo", desc: "Nuestra IA identifica fechas, importes y sugiere categorías automáticamente." },
                                { icon: <CheckCircle2 className="text-indigo-500" />, title: "Confirma y vuelca", desc: "Revisa los movimientos sugeridos y añádelos a tu cuenta en un clic." }
                            ].map((step, i) => (
                                <div key={i} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-3">
                                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100">{step.icon}</div>
                                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{step.title}</h4>
                                    <p className="text-[9px] font-bold text-slate-400 leading-relaxed uppercase">{step.desc}</p>
                                </div>
                            ))}
                        </div>
                    ) : importStep === 'PREVIEW' ? (
                        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
                            <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 flex flex-col md:flex-row items-center justify-between gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100"><Info size={24}/></div>
                                    <div className="space-y-1">
                                        <h4 className="text-[11px] font-black text-indigo-900 uppercase">Previsualización de Importación</h4>
                                        <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">Hemos identificado {mappedTransactions.length} movimientos potenciales.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 w-full md:w-auto">
                                    <select className="flex-1 md:w-48 px-4 py-4 bg-white border border-indigo-200 rounded-xl font-bold text-[10px] uppercase outline-none focus:border-indigo-600 transition-all" value={importAccount} onChange={e => setImportAccount(e.target.value)}>
                                        {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                    <button onClick={confirmImport} className="px-8 py-4 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-100">Vuelcar ahora</button>
                                </div>
                            </div>
                            
                            <div className="max-h-[400px] overflow-y-auto pr-4 custom-scrollbar space-y-2">
                                {mappedTransactions.map((tx, idx) => (
                                    <div key={idx} className="p-4 bg-white rounded-2xl border border-slate-100 flex items-center justify-between gap-4 hover:border-indigo-200 transition-colors">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className="bg-slate-50 px-3 py-2 rounded-lg text-[9px] font-black text-slate-400 shrink-0">{tx.date}</div>
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-black text-slate-800 uppercase truncate">{tx.description}</p>
                                                <p className="text-[8px] font-bold text-indigo-500 uppercase tracking-tighter">Categoría: {data.categories.find(c => c.id === tx.categoryId)?.name || 'Sin Categoría'}</p>
                                            </div>
                                        </div>
                                        <span className={`text-xs font-black ${tx.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'} shrink-0`}>
                                            {tx.type === 'INCOME' ? '+' : '-'}{tx.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <button onClick={resetForm} className="w-full py-4 text-[10px] font-black uppercase text-slate-400 hover:text-rose-500 transition-colors">Cancelar Importación</button>
                        </div>
                    ) : (
                        <div className="py-20 flex flex-col items-center justify-center gap-6 animate-in zoom-in-95 duration-500">
                             <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-[2rem] flex items-center justify-center shadow-xl shadow-emerald-100"><ShieldCheck size={40}/></div>
                             <div className="text-center space-y-2">
                                <h4 className="text-xl font-black text-slate-900 uppercase">¡Importación Exitosa!</h4>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em]">Tus finanzas han sido actualizadas correctamente</p>
                             </div>
                        </div>
                    )}
                </div>

                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-10 text-center">
                    <div className="mx-auto bg-indigo-100 text-indigo-600 w-20 h-20 rounded-3xl flex items-center justify-center shadow-xl shadow-indigo-500/10"><Upload size={36} /></div>
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Exportación de Datos</h3>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest leading-relaxed">Genera copias de seguridad de tus datos para máxima soberanía.</p>
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
