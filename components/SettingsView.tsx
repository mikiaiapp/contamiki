
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AppState, Account, Family, Category, Transaction, TransactionType, RecurrentMovement, FavoriteMovement, RecurrenceFrequency, AccountGroup } from '../types';
import { Trash2, Edit2, Layers, Tag, Wallet, Loader2, ImageIcon, Sparkles, ChevronDown, XCircle, Info, Download, Upload, FileJson, FileSpreadsheet, DatabaseZap, ClipboardPaste, ListOrdered, CheckCircle2, Repeat, Star, Power, Calendar, ArrowRightLeft, ShieldCheck, AlertCircle, Plus, FileText, MoveRight, BoxSelect, AlertOctagon, Eraser, AlertTriangle, RefreshCcw, ArrowLeftRight } from 'lucide-react';
import { searchInternetLogos } from '../services/iconService';
import { parseMigrationData } from '../services/geminiService';
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

type Tab = 'ACC_GROUPS' | 'ACCOUNTS' | 'FAMILIES' | 'CATEGORIES' | 'RECURRENTS' | 'FAVORITES' | 'TOOLS';
type ImportMode = 'NORMAL' | 'TRANSFER';

interface ImportReport {
  added: number;
  newAccounts: string[];
  newCategories: string[];
  errors: { fila: number; error: string }[];
}

export const SettingsView: React.FC<SettingsViewProps> = ({ data, onUpdateData }) => {
  const [activeTab, setActiveTab] = useState<Tab>('ACC_GROUPS');
  const [importMode, setImportMode] = useState<ImportMode>('NORMAL');
  
  const [webLogos, setWebLogos] = useState<{url: string, source: string}[]>([]);
  const [isSearchingWeb, setIsSearchingWeb] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const searchTimeoutRef = useRef<number | null>(null);

  const entityImportFileRef = useRef<HTMLInputElement>(null);

  const [migrationText, setMigrationText] = useState('');
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationPreview, setMigrationPreview] = useState<{accounts: any[], families: any[], categories: any[]} | null>(null);

  const [pasteMovements, setPasteMovements] = useState('');
  const [importReport, setImportReport] = useState<ImportReport | null>(null);

  const [showQuickImport, setShowQuickImport] = useState(false);
  const [pasteData, setPasteData] = useState('');

  const [grpId, setGrpId] = useState<string | null>(null);
  const [grpName, setGrpName] = useState('');
  const [grpIcon, setGrpIcon] = useState('🗂️');
  const grpFileInputRef = useRef<HTMLInputElement>(null);

  const [accId, setAccId] = useState<string | null>(null);
  const [accName, setAccName] = useState('');
  const [accBalance, setAccBalance] = useState('');
  const [accIcon, setAccIcon] = useState('🏦');
  const [accGroupId, setAccGroupId] = useState('');
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

  const [recId, setRecId] = useState<string | null>(null);
  const [recDesc, setRecDesc] = useState('');
  const [recAmount, setRecAmount] = useState('');
  const [recFreq, setRecFreq] = useState<RecurrenceFrequency>('MONTHLY');
  const [recInterval, setRecInterval] = useState('1');
  const [recStart, setRecStart] = useState(new Date().toISOString().split('T')[0]);
  const [recAcc, setRecAcc] = useState(data.accounts[0]?.id || '');
  const [recCounterpartId, setRecCounterpartId] = useState('');
  const [recCat, setRecCat] = useState('');

  const [favId, setFavId] = useState<string | null>(null);
  const [favName, setFavName] = useState('');
  const [favAmount, setFavAmount] = useState('');
  const [favAcc, setFavAcc] = useState(data.accounts[0]?.id || '');
  const [favCounterpartId, setFavCounterpartId] = useState('');
  const [favCat, setFavCat] = useState('');

  const [massDeleteYear, setMassDeleteYear] = useState<string | null>(null);
  const [showFullResetConfirm, setShowFullResetConfirm] = useState(false);

  useEffect(() => { 
    setWebLogos([]); 
    setHasSearched(false);
    resetForm();
  }, [activeTab]);

  const resetForm = () => {
      setGrpId(null); setGrpName(''); setGrpIcon('🗂️');
      setAccId(null); setAccName(''); setAccBalance(''); setAccIcon('🏦'); setAccGroupId('');
      setFamId(null); setFamName(''); setFamIcon('📂'); setFamType('EXPENSE');
      setCatId(null); setCatName(''); setCatIcon('🏷️'); setCatParent('');
      setRecId(null); setRecDesc(''); setRecAmount(''); setRecFreq('MONTHLY'); setRecInterval('1'); setRecStart(new Date().toISOString().split('T')[0]); setRecAcc(data.accounts[0]?.id || ''); setRecCounterpartId(''); setRecCat('');
      setFavId(null); setFavName(''); setFavAmount(''); setFavAcc(data.accounts[0]?.id || ''); setFavCounterpartId(''); setFavCat('');
      setWebLogos([]); setHasSearched(false);
      setShowQuickImport(false); setPasteData(''); setPasteMovements(''); setImportReport(null);
      setMigrationText(''); setMigrationPreview(null); setMassDeleteYear(null); setShowFullResetConfirm(false);
      if (entityImportFileRef.current) entityImportFileRef.current.value = '';
  };

  // Fix: Adding missing exportBackup function to handle data export to JSON
  const exportBackup = () => {
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const exportFileDefaultName = `contamiki_backup_${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', url);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    URL.revokeObjectURL(url);
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
                      if (!name || name.toLowerCase() === 'nombre') return;
                      const icon = row[1]?.toString().trim() || '📂';
                      let typeStr = row[2]?.toString().trim().toUpperCase();
                      const type = (typeStr === 'INCOME' || typeStr === 'INGRESO') ? 'INCOME' : 'EXPENSE';
                      newFamilies.push({ id: generateId(), name, icon, type });
                  });
                  if(newFamilies.length > 0) { onUpdateData({ families: [...data.families, ...newFamilies] }); count = newFamilies.length; }
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
                  if(newCategories.length > 0) { onUpdateData({ categories: [...data.categories, ...newCategories] }); count = newCategories.length; }
              } else if (activeTab === 'ACC_GROUPS') {
                   const newGroups: AccountGroup[] = [];
                   rows.forEach(row => {
                      const name = row[0]?.toString().trim();
                      if (!name || name.toLowerCase() === 'nombre') return;
                      const icon = row[1]?.toString().trim() || '🗂️';
                      newGroups.push({ id: generateId(), name, icon });
                   });
                   if (newGroups.length > 0) { onUpdateData({ accountGroups: [...(data.accountGroups || []), ...newGroups] }); count = newGroups.length; }
              } else if (activeTab === 'ACCOUNTS') {
                  const newAccounts: Account[] = [];
                  const newGroupsToAdd: AccountGroup[] = [];
                  const currentGroups = [...(data.accountGroups || [])];
                  rows.forEach(row => {
                      const groupName = row[0]?.toString().trim();
                      if (!groupName || groupName.toLowerCase() === 'agrupación' || groupName.toLowerCase() === 'agrupacion') return;
                      const name = row[1]?.toString().trim();
                      if (!name) return;
                      const icon = row[2]?.toString().trim() || '🏦';
                      const balance = parseFloat(row[3]?.toString().replace(',','.') || '0');
                      let group = currentGroups.find(g => g.name.toLowerCase() === groupName.toLowerCase()) || newGroupsToAdd.find(g => g.name.toLowerCase() === groupName.toLowerCase());
                      if (!group) { group = { id: generateId(), name: groupName, icon: '🗂️' }; newGroupsToAdd.push(group); }
                      newAccounts.push({ id: generateId(), name, initialBalance: balance || 0, currency: 'EUR', icon, groupId: group.id });
                  });
                  if (newGroupsToAdd.length > 0) onUpdateData({ accountGroups: [...(data.accountGroups || []), ...newGroupsToAdd] });
                  if(newAccounts.length > 0) { onUpdateData({ accounts: [...data.accounts, ...newAccounts] }); count = newAccounts.length; }
              }
              if (count > 0) alert(`¡Importación exitosa! Se han añadido ${count} elementos.`);
              else alert("No se encontraron datos válidos.");
              resetForm();
          } catch (err) { alert("Error al leer el archivo."); }
      };
      reader.readAsBinaryString(file);
  };

  const handleManualMovementImport = () => {
      if (!pasteMovements.trim()) return;
      const lines = pasteMovements.trim().split('\n');
      const newTransactions: Transaction[] = [];
      
      // Colecciones mutables para esta ejecución
      const localAccounts = [...data.accounts];
      const localCategories = [...data.categories];
      const localAccountGroups = [...(data.accountGroups || [])];
      const localFamilies = [...data.families];

      const report: ImportReport = { added: 0, newAccounts: [], newCategories: [], errors: [] };

      lines.forEach((line, index) => {
          const parts = line.split(';').map(s => s.trim());
          
          if (importMode === 'NORMAL') {
            if (parts.length < 5) { 
                report.errors.push({ fila: index + 1, error: "Formato insuficiente (fecha; categoria; cuenta; concepto; importe)" });
                return; 
            }
            const [fec, catName, accName, concept, amountStr] = parts;
            
            // Buscar o crear cuenta
            let account = localAccounts.find(a => a.name.toLowerCase() === accName.toLowerCase());
            if (!account) {
                const group = localAccountGroups[0] || { id: 'g1', name: 'Otros', icon: '🗂️' };
                account = { id: generateId(), name: accName, initialBalance: 0, currency: 'EUR', icon: '🏦', groupId: group.id };
                localAccounts.push(account);
                report.newAccounts.push(accName);
            }

            // Buscar o crear categoría
            let category = localCategories.find(c => c.name.toLowerCase() === catName.toLowerCase());
            if (!category) {
                const family = localFamilies[0] || { id: 'f1', name: 'Varios', type: 'EXPENSE', icon: '🏷️' };
                category = { id: generateId(), name: catName, familyId: family.id, icon: '🏷️' };
                localCategories.push(category);
                report.newCategories.push(catName);
            }

            const amountVal = parseFloat(amountStr.replace(',', '.'));
            if (isNaN(amountVal)) { report.errors.push({ fila: index + 1, error: `Importe "${amountStr}" no numérico` }); return; }

            const txType: TransactionType = amountVal < 0 ? 'EXPENSE' : 'INCOME';

            newTransactions.push({
                id: generateId(),
                date: fec,
                description: concept,
                amount: Math.abs(amountVal),
                type: txType,
                accountId: account.id,
                categoryId: category.id,
                familyId: category.familyId
            });

          } else {
            // MODO TRASPASO: fecha; origen; destino; concepto; importe
            if (parts.length < 5) { 
                report.errors.push({ fila: index + 1, error: "Formato insuficiente para Traspaso (fecha; origen; destino; concepto; importe)" });
                return; 
            }
            const [fec, srcAccName, dstAccName, concept, amountStr] = parts;

            // Buscar o crear cuenta origen
            let srcAcc = localAccounts.find(a => a.name.toLowerCase() === srcAccName.toLowerCase());
            if (!srcAcc) {
                const group = localAccountGroups[0] || { id: 'g1', name: 'Otros', icon: '🗂️' };
                srcAcc = { id: generateId(), name: srcAccName, initialBalance: 0, currency: 'EUR', icon: '🏦', groupId: group.id };
                localAccounts.push(srcAcc);
                report.newAccounts.push(srcAccName);
            }

            // Buscar o crear cuenta destino
            let dstAcc = localAccounts.find(a => a.name.toLowerCase() === dstAccName.toLowerCase());
            if (!dstAcc) {
                const group = localAccountGroups[0] || { id: 'g1', name: 'Otros', icon: '🗂️' };
                dstAcc = { id: generateId(), name: dstAccName, initialBalance: 0, currency: 'EUR', icon: '🏦', groupId: group.id };
                localAccounts.push(dstAcc);
                report.newAccounts.push(dstAccName);
            }

            const amountVal = parseFloat(amountStr.replace(',', '.'));
            if (isNaN(amountVal)) { report.errors.push({ fila: index + 1, error: `Importe "${amountStr}" no numérico` }); return; }

            newTransactions.push({
                id: generateId(),
                date: fec,
                description: concept,
                amount: Math.abs(amountVal),
                type: 'TRANSFER',
                accountId: srcAcc.id,
                transferAccountId: dstAcc.id,
                familyId: '',
                categoryId: ''
            });
          }
      });

      report.added = newTransactions.length;
      
      // Consolidar cambios en el estado global
      onUpdateData({ 
        transactions: [...data.transactions, ...newTransactions],
        accounts: localAccounts,
        categories: localCategories
      });

      setImportReport(report);
      setPasteMovements('');
  };

  const transactionsPerYear = useMemo(() => {
    const counts: Record<string, number> = {};
    data.transactions.forEach(t => {
        const year = t.date.split('-')[0];
        if (year && year.length === 4) {
            counts[year] = (counts[year] || 0) + 1;
        }
    });
    return Object.entries(counts).sort((a,b) => b[0].localeCompare(a[0]));
  }, [data.transactions]);

  const handleMassDelete = (year: string) => {
      const updatedTxs = data.transactions.filter(t => !t.date.startsWith(year));
      onUpdateData({ transactions: updatedTxs });
      setMassDeleteYear(null);
      alert(`Limpieza completada: Se han borrado todos los movimientos de ${year}.`);
  };

  const handleFullReset = () => {
      onUpdateData({ transactions: [] });
      setShowFullResetConfirm(false);
      alert("Se han eliminado TODOS los movimientos de la aplicación.");
  };

  const handleQuickImport = () => {
      if (!pasteData.trim()) return;
      const lines = pasteData.trim().split('\n');
      if (activeTab === 'FAMILIES') {
          const newFamilies: Family[] = lines.map(line => {
              const [name, icon, type] = line.split(';').map(s => s.trim());
              return { id: generateId(), name: name || 'Nueva Familia', icon: icon || '📂', type: (type === 'INCOME' ? 'INCOME' : 'EXPENSE') as any };
          });
          onUpdateData({ families: [...data.families, ...newFamilies] });
      } else if (activeTab === 'CATEGORIES') {
          const newCategories: Category[] = lines.map(line => {
              const [name, icon, familyName] = line.split(';').map(s => s.trim());
              const family = data.families.find(f => f.name.toLowerCase() === familyName?.toLowerCase()) || data.families[0];
              return { id: generateId(), name: name || 'Nueva Categoría', icon: icon || '🏷️', familyId: family?.id || '' };
          });
          onUpdateData({ categories: [...data.categories, ...newCategories] });
      } else if (activeTab === 'ACC_GROUPS') {
          const newGroups: AccountGroup[] = lines.map(line => {
              const [name, icon] = line.split(';').map(s => s.trim());
              return { id: generateId(), name: name || 'Nuevo Grupo', icon: icon || '🗂️' };
          });
          onUpdateData({ accountGroups: [...(data.accountGroups || []), ...newGroups] });
      } else if (activeTab === 'ACCOUNTS') {
          const newAccounts: Account[] = [];
          const newGroupsToAdd: AccountGroup[] = [];
          const currentGroups = [...(data.accountGroups || [])];
          lines.forEach(line => {
              const parts = line.split(';').map(s => s.trim());
              if (parts.length < 2) return;
              const groupName = parts[0];
              const name = parts[1];
              const icon = parts[2] || '🏦';
              const balance = parseFloat(parts[3] || '0');
              let group = currentGroups.find(g => g.name.toLowerCase() === groupName.toLowerCase()) || newGroupsToAdd.find(g => g.name.toLowerCase() === groupName.toLowerCase());
              if (!group) { group = { id: generateId(), name: groupName, icon: '🗂️' }; newGroupsToAdd.push(group); }
              newAccounts.push({ id: generateId(), name, initialBalance: balance || 0, currency: 'EUR', icon: icon || '🏦', groupId: group.id });
          });
          if (newGroupsToAdd.length > 0) onUpdateData({ accountGroups: [...(data.accountGroups || []), ...newGroupsToAdd] });
          onUpdateData({ accounts: [...data.accounts, ...newAccounts] });
      }
      resetForm();
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
        case 'ACCOUNTS': importHint = "Agrupación; Cuenta; Icono; (Saldo)"; placeholderExample = "Bancos; BBVA; 🏦; 1500.00\nEfectivo; Cartera; 💶; 50.00"; break;
        case 'ACC_GROUPS': importHint = "Nombre Agrupación; Icono"; placeholderExample = "Bancos; 🏦\nCrypto; 🪙"; break;
        case 'FAMILIES': importHint = "Nombre; Icono; Tipo (INCOME/EXPENSE)"; placeholderExample = "Vivienda; 🏠; EXPENSE\nNómina; 💼; INCOME"; break;
        case 'CATEGORIES': importHint = "Nombre; Icono; Nombre de Familia"; placeholderExample = "Alquiler; 🔑; Vivienda\nSupermercado; 🛒; Alimentación"; break;
        default: importHint = "Formato genérico"; placeholderExample = "Dato1; Dato2; Dato3";
    }
    return (
        <div className="bg-white p-8 rounded-[2.5rem] border-2 border-dashed border-indigo-100 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2"><ClipboardPaste size={16} /> Importación Rápida</h4>
                <button onClick={() => setShowQuickImport(false)} className="text-slate-300 hover:text-rose-500"><XCircle size={18}/></button>
            </div>
            <textarea className="w-full h-40 p-5 bg-slate-50 border border-slate-100 rounded-xl font-mono text-[11px] outline-none focus:border-indigo-500 transition-all custom-scrollbar placeholder:text-slate-300" placeholder={placeholderExample} value={pasteData} onChange={e => setPasteData(e.target.value)} />
            <div className="flex flex-wrap gap-2">
                <button onClick={handleQuickImport} className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg hover:bg-slate-950 transition-all">Importar</button>
                <button onClick={() => resetForm()} className="px-6 py-4 bg-slate-100 text-slate-500 rounded-xl font-black text-[9px] uppercase">Cancelar</button>
            </div>
        </div>
    );
  };

  return (
    <div className="space-y-12 max-w-full overflow-hidden pb-10">
      <div className="text-center md:text-left space-y-2">
        <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter leading-none">Ajustes.</h2>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em]">Gestión y mantenimiento del sistema</p>
      </div>

      <div className="flex bg-slate-100 p-1.5 rounded-[1.5rem] shadow-inner border border-slate-200/50 overflow-x-auto scrollbar-hide">
        {[
            { id: 'ACC_GROUPS', label: 'Agrupaciones', icon: <BoxSelect size={18}/> },
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
        {activeTab === 'TOOLS' && (
            <div className="space-y-12 pb-10">
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                        <div className="space-y-2">
                            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
                                <ClipboardPaste className="text-indigo-600" size={28}/> Mega Importador de Movimientos
                            </h3>
                            <div className="flex bg-slate-100 p-1.5 rounded-2xl mt-4 border border-slate-200 w-fit">
                                <button onClick={() => setImportMode('NORMAL')} className={`px-5 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${importMode === 'NORMAL' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-800'}`}>Fase 1: Ingresos/Gastos</button>
                                <button onClick={() => setImportMode('TRANSFER')} className={`px-5 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${importMode === 'TRANSFER' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-800'}`}>Fase 2: Traspasos</button>
                            </div>
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100 space-y-2">
                            <p className="text-indigo-900 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Info size={14}/> Formato Sugerido:</p>
                            <p className="text-indigo-600 font-mono text-[11px] font-bold">
                                {importMode === 'NORMAL' 
                                    ? "fecha; categoría; cuenta; concepto; importe (ej: -25.50 para gastos)" 
                                    : "fecha; cuenta origen; cuenta destino; concepto; importe"}
                            </p>
                            <p className="text-indigo-400 text-[9px] uppercase font-bold italic mt-2">Detección automática: si la cuenta o categoría no existen, ContaMiki las creará por ti.</p>
                        </div>

                        <textarea 
                            className="w-full h-56 p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] font-mono text-[11px] text-slate-600 outline-none focus:border-indigo-500 transition-all custom-scrollbar placeholder:text-slate-300 shadow-inner"
                            placeholder={importMode === 'NORMAL' 
                                ? "2023-10-27; Alimentación; Mi Banco; Compra cena; -25.50\n2023-10-28; Nómina; Mi Banco; Sueldo; 1500.00"
                                : "2023-10-27; Mi Banco; Efectivo; Retirada cajero; 50.00"}
                            value={pasteMovements}
                            onChange={e => setPasteMovements(e.target.value)}
                        />
                        
                        <div className="flex gap-3">
                            <button onClick={handleManualMovementImport} className="flex-1 py-5 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-950 transition-all shadow-xl shadow-indigo-200 flex items-center justify-center gap-2">
                                <Upload size={18} /> Procesar Lote
                            </button>
                            <button onClick={resetForm} className="px-8 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black text-[11px] uppercase">Limpiar</button>
                        </div>
                    </div>

                    {importReport && (
                        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white space-y-6 animate-in zoom-in-95">
                            <div className="flex items-center justify-between border-b border-white/10 pb-4">
                                <h4 className="text-lg font-black uppercase tracking-tight flex items-center gap-3"><CheckCircle2 className="text-emerald-400" /> Resultado de Importación</h4>
                                <button onClick={() => setImportReport(null)}><XCircle size={20} className="text-slate-500" /></button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-center"><span className="text-[9px] font-black text-slate-400 uppercase">Añadidos</span><p className="text-2xl font-black text-emerald-400">{importReport.added}</p></div>
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-center"><span className="text-[9px] font-black text-slate-400 uppercase">Nuevas Cuentas</span><p className="text-2xl font-black text-indigo-400">{importReport.newAccounts.length}</p></div>
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-center"><span className="text-[9px] font-black text-slate-400 uppercase">Nuevas Categorías</span><p className="text-2xl font-black text-amber-400">{importReport.newCategories.length}</p></div>
                            </div>
                            
                            {(importReport.newAccounts.length > 0 || importReport.newCategories.length > 0) && (
                                <div className="space-y-3">
                                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Entidades Autocreadas:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {importReport.newAccounts.map(a => <span key={a} className="px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-[8px] font-black uppercase">Cuenta: {a}</span>)}
                                        {importReport.newCategories.map(c => <span key={c} className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-[8px] font-black uppercase">Cat: {c}</span>)}
                                    </div>
                                </div>
                            )}

                            {importReport.errors.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-2"><AlertOctagon size={12}/> Errores en filas:</p>
                                    <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-1">
                                        {importReport.errors.map((e, i) => (
                                            <p key={i} className="text-[10px] text-rose-300/70 font-bold">Fila {e.fila}: {e.error}</p>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="bg-rose-50 p-10 rounded-[3rem] shadow-sm border border-rose-100 space-y-8">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                        <div className="space-y-2">
                            <h3 className="text-2xl font-black text-rose-900 uppercase tracking-tighter flex items-center gap-3">
                                <Eraser className="text-rose-600" size={28}/> Limpieza de Movimientos
                            </h3>
                            <p className="text-rose-700/60 text-xs font-bold uppercase tracking-widest leading-relaxed">
                                Elimina movimientos de forma selectiva por año. <br/>
                                <span className="text-rose-600 font-black">Historial habilitado desde 2015.</span>
                            </p>
                        </div>
                        <button onClick={() => setShowFullResetConfirm(true)} className="flex items-center gap-2 px-6 py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 shadow-xl shadow-rose-200 transition-all">
                            <RefreshCcw size={16} /> Reset Completo
                        </button>
                    </div>

                    {showFullResetConfirm && (
                        <div className="bg-rose-600 p-8 rounded-3xl text-white space-y-6 animate-in zoom-in-95 shadow-2xl">
                            <div className="flex items-center gap-4">
                                <AlertTriangle size={32} className="animate-bounce" />
                                <h4 className="text-lg font-black uppercase">¡OPERACIÓN CRÍTICA!</h4>
                            </div>
                            <p className="text-sm font-bold leading-relaxed uppercase opacity-90 text-pretty">
                                Estás a punto de eliminar **TODOS** los movimientos registrados. Esta acción es irreversible.
                            </p>
                            <div className="flex gap-3">
                                <button onClick={handleFullReset} className="flex-1 py-4 bg-white text-rose-600 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-slate-50 transition-all">BORRAR TODO EL HISTORIAL</button>
                                <button onClick={() => setShowFullResetConfirm(false)} className="flex-1 py-4 bg-rose-800 text-white rounded-xl border border-rose-400 font-black text-[10px] uppercase hover:bg-rose-900 transition-all">CANCELAR</button>
                            </div>
                        </div>
                    )}
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-rose-100">
                        {transactionsPerYear.length > 0 ? transactionsPerYear.map(([year, count]) => (
                            <div key={year} className="bg-white p-6 rounded-3xl border border-rose-100 flex flex-col justify-between gap-4 group hover:shadow-lg transition-all relative overflow-hidden">
                                {massDeleteYear === year ? (
                                    <div className="absolute inset-0 bg-rose-600 text-white p-6 flex flex-col justify-center items-center text-center animate-in fade-in zoom-in-95">
                                        <AlertTriangle size={32} className="mb-2" />
                                        <p className="text-[11px] font-black uppercase mb-4">¿Borrar {year}?</p>
                                        <div className="flex gap-2 w-full">
                                            <button onClick={() => handleMassDelete(year)} className="flex-1 py-3 bg-white text-rose-600 rounded-xl text-[10px] font-black uppercase shadow-lg">Sí</button>
                                            <button onClick={() => setMassDeleteYear(null)} className="flex-1 py-3 bg-rose-800 text-white rounded-xl text-[10px] font-black uppercase">No</button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div>
                                            <span className="text-3xl font-black text-slate-900 tracking-tighter">{year}</span>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{count} movimientos</p>
                                        </div>
                                        <button onClick={() => setMassDeleteYear(year)} className="w-full py-4 bg-rose-50 text-rose-600 border border-rose-100 rounded-2xl font-black text-[10px] uppercase hover:bg-rose-600 hover:text-white transition-all shadow-sm flex items-center justify-center gap-2 group-hover:scale-105 transition-transform">
                                            <Trash2 size={16} /> Purgar Año
                                        </button>
                                    </>
                                )}
                            </div>
                        )) : !showFullResetConfirm && (
                            <div className="col-span-full py-10 text-center space-y-4">
                                <Info size={40} className="mx-auto text-rose-200" />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">No hay movimientos registrados para purgar.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-slate-900 p-10 rounded-[3rem] shadow-2xl border border-white/5 space-y-10 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-indigo-600/5 mix-blend-overlay"></div>
                    <div className="relative z-10 space-y-8">
                        <div className="mx-auto bg-indigo-600 text-white w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-600/30 rotate-3"><DatabaseZap size={36} /></div>
                        <div className="space-y-2">
                            <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Soberanía de Datos</h3>
                            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest leading-relaxed max-w-md mx-auto text-balance">Tus finanzas son tuyas. Genera copias de seguridad completas en formato JSON o informes listos para imprimir.</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button onClick={exportBackup} className="flex-1 flex items-center justify-center gap-3 p-6 bg-white text-slate-900 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] hover:bg-indigo-50 transition-all shadow-xl active:scale-95"><FileJson size={20} /> Exportar JSON</button>
                            <button onClick={() => window.print()} className="flex-1 flex items-center justify-center gap-3 p-6 bg-slate-800 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] border border-white/10 hover:bg-slate-700 transition-all active:scale-95"><Download size={20} /> Generar PDF</button>
                        </div>
                    </div>
                </div>
            </div>
        )}
        
        {activeTab === 'ACC_GROUPS' && (
             <div className="grid grid-cols-1 gap-10">
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-4"><div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-2xl"><BoxSelect size={24}/></div>{grpId ? 'Editar Agrupación' : 'Nueva Agrupación'}</h3>
                        {!showQuickImport && <button onClick={() => setShowQuickImport(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-500 rounded-xl font-black text-[9px] uppercase hover:bg-indigo-50 hover:text-indigo-600 transition-all"><Plus size={14}/> Importar Masivo</button>}
                    </div>
                    {showQuickImport ? renderQuickImport() : (
                        <div className="space-y-6">
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Agrupación</label><input type="text" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all text-slate-900" value={grpName} onChange={e => { setGrpName(e.target.value); triggerWebSearch(e.target.value); }} /></div>
                            {renderIconInput(grpIcon, setGrpIcon, grpName, grpFileInputRef)}
                            <button onClick={() => { if(!grpName) return; if (grpId) onUpdateData({ accountGroups: (data.accountGroups || []).map(g => g.id === grpId ? { ...g, name: grpName, icon: grpIcon } : g) }); else onUpdateData({ accountGroups: [...(data.accountGroups || []), { id: generateId(), name: grpName, icon: grpIcon }] }); resetForm(); }} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-2xl hover:bg-indigo-600 transition-all">{grpId ? 'Guardar Cambios' : 'Crear Agrupación'}</button>
                        </div>
                    )}
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 px-4">Listado de Agrupaciones</h4>
                    <div className="space-y-3">
                        {(data.accountGroups || []).map(g => (
                            <div key={g.id} className="flex justify-between items-center p-5 bg-slate-50 rounded-3xl border border-transparent hover:border-slate-200 transition-all">
                                <div className="flex items-center gap-4"><div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center border border-slate-100 p-2 shadow-sm shrink-0">{renderIcon(g.icon || '🗂️', "w-full h-full")}</div><span className="font-black text-slate-900 block text-xs uppercase">{g.name}</span></div>
                                <div className="flex gap-1"><button onClick={() => { setGrpId(g.id); setGrpName(g.name); setGrpIcon(g.icon); }} className="p-3 text-slate-300 hover:text-indigo-600"><Edit2 size={18}/></button><button onClick={() => onUpdateData({accountGroups: (data.accountGroups || []).filter(item=>item.id!==g.id)})} className="p-3 text-slate-300 hover:text-rose-600"><Trash2 size={18}/></button></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'ACCOUNTS' && (
            <div className="grid grid-cols-1 gap-10">
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-4"><div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-2xl"><Wallet size={24}/></div>{accId ? 'Editar Cuenta' : 'Nueva Cuenta'}</h3>
                        {!showQuickImport && <button onClick={() => setShowQuickImport(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-500 rounded-xl font-black text-[9px] uppercase hover:bg-indigo-50 hover:text-indigo-600 transition-all"><Plus size={14}/> Importar Masivo</button>}
                    </div>
                    {showQuickImport ? renderQuickImport() : (
                        <div className="space-y-6">
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre o Banco</label><input type="text" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all text-slate-900" value={accName} onChange={e => { setAccName(e.target.value); triggerWebSearch(e.target.value); }} /></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Agrupación</label><select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={accGroupId} onChange={e => setAccGroupId(e.target.value)}><option value="">Seleccionar...</option>{(data.accountGroups || []).map(g => <option key={g.id} value={g.id}>{g.icon} {g.name}</option>)}</select></div>
                            {renderIconInput(accIcon, setAccIcon, accName, accFileInputRef)}
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Saldo Inicial (€)</label><input type="number" step="0.01" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all text-slate-900" value={accBalance} onChange={e => setAccBalance(e.target.value)} /></div>
                            <button onClick={() => { if(!accName) return; const balanceVal = parseFloat(accBalance) || 0; const gid = accGroupId || (data.accountGroups || [])[0]?.id || ''; if (accId) onUpdateData({ accounts: data.accounts.map(a => a.id === accId ? { ...a, name: accName, initialBalance: balanceVal, icon: accIcon, groupId: gid } : a) }); else onUpdateData({ accounts: [...data.accounts, { id: generateId(), name: accName, initialBalance: balanceVal, currency: 'EUR', icon: accIcon, groupId: gid }] }); resetForm(); }} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-2xl hover:bg-indigo-600 transition-all">{accId ? 'Guardar Cambios' : 'Crear Cuenta'}</button>
                        </div>
                    )}
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 px-4">Listado de Cuentas</h4>
                    <div className="space-y-3">
                        {data.accounts.map(acc => {
                             const grp = (data.accountGroups || []).find(g => g.id === acc.groupId);
                             return (
                            <div key={acc.id} className="flex justify-between items-center p-5 bg-slate-50 rounded-3xl border border-transparent hover:border-slate-200 transition-all">
                                <div className="flex items-center gap-4"><div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center border border-slate-100 p-2 shadow-sm shrink-0">{renderIcon(acc.icon || '🏦', "w-full h-full")}</div><div><span className="font-black text-slate-900 block text-xs uppercase">{acc.name}</span><div className="flex gap-2 items-center"><span className="text-[10px] font-bold text-indigo-500">{acc.initialBalance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>{grp && <span className="text-[8px] font-bold text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded-md uppercase">{grp.name}</span>}</div></div></div>
                                <div className="flex gap-1"><button onClick={() => { setAccId(acc.id); setAccName(acc.name); setAccBalance(acc.initialBalance.toString()); setAccIcon(acc.icon || '🏦'); setAccGroupId(acc.groupId || ''); }} className="p-3 text-slate-300 hover:text-indigo-600"><Edit2 size={18}/></button><button onClick={() => onUpdateData({accounts: data.accounts.filter(a=>a.id!==acc.id)})} className="p-3 text-slate-300 hover:text-rose-600"><Trash2 size={18}/></button></div>
                            </div>
                        )})}
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'FAMILIES' && (
            <div className="grid grid-cols-1 gap-10">
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-4"><div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-2xl"><Layers size={24}/></div>{famId ? 'Editar Familia' : 'Nueva Familia'}</h3>
                        {!showQuickImport && <button onClick={() => setShowQuickImport(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-500 rounded-xl font-black text-[9px] uppercase hover:bg-indigo-50 hover:text-indigo-600 transition-all"><Plus size={14}/> Importar Masivo</button>}
                    </div>
                    {showQuickImport ? renderQuickImport() : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre</label><input type="text" placeholder="Ej: Vivienda, Alimentación..." className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={famName} onChange={e => { setFamName(e.target.value); triggerWebSearch(e.target.value); }} /></div>
                                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo</label><div className="flex bg-slate-50 p-1 rounded-2xl border-2 border-slate-100 h-[64px]"><button onClick={() => setFamType('EXPENSE')} className={`flex-1 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${famType === 'EXPENSE' ? 'bg-white text-rose-500 shadow-md' : 'text-slate-400'}`}>Gasto</button><button onClick={() => setFamType('INCOME')} className={`flex-1 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${famType === 'INCOME' ? 'bg-white text-emerald-500 shadow-md' : 'text-slate-400'}`}>Ingreso</button></div></div>
                            </div>
                            {renderIconInput(famIcon, setFamIcon, famName, famFileInputRef)}
                            <button onClick={() => { if(!famName) return; if (famId) onUpdateData({ families: data.families.map(f => f.id === famId ? { ...f, name: famName, type: famType, icon: famIcon } : f) }); else onUpdateData({ families: [...data.families, { id: generateId(), name: famName, type: famType, icon: famIcon }] }); resetForm(); }} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-2xl hover:bg-indigo-600 transition-all">Guardar Familia</button>
                        </div>
                    )}
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 px-4">Listado de Familias</h4>
                    <div className="space-y-3">
                        {data.families.map(fam => (
                            <div key={fam.id} className="flex justify-between items-center p-5 bg-slate-50 rounded-3xl border border-transparent hover:border-slate-200 transition-all">
                                <div className="flex items-center gap-4"><div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center border border-slate-100 p-2 shadow-sm shrink-0">{renderIcon(fam.icon || '📂', "w-full h-full")}</div><div><span className="font-black text-slate-900 block text-xs uppercase">{fam.name}</span><span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${fam.type === 'INCOME' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>{fam.type === 'INCOME' ? 'Ingreso' : 'Gasto'}</span></div></div>
                                <div className="flex gap-1"><button onClick={() => { setFamId(fam.id); setFamName(fam.name); setFamType(fam.type); setFamIcon(fam.icon || '📂'); }} className="p-3 text-slate-300 hover:text-indigo-600"><Edit2 size={18}/></button><button onClick={() => onUpdateData({families: data.families.filter(f=>f.id!==fam.id)})} className="p-3 text-slate-300 hover:text-rose-600"><Trash2 size={18}/></button></div>
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
                        <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-4"><div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-2xl"><Tag size={24}/></div>{catId ? 'Editar Categoría' : 'Nueva Categoría'}</h3>
                        {!showQuickImport && <button onClick={() => setShowQuickImport(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-500 rounded-xl font-black text-[9px] uppercase hover:bg-indigo-50 hover:text-indigo-600 transition-all"><Plus size={14}/> Importar Masivo</button>}
                    </div>
                    {showQuickImport ? renderQuickImport() : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre</label><input type="text" placeholder="Ej: Supermercado, Alquiler..." className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={catName} onChange={e => { setCatName(e.target.value); triggerWebSearch(e.target.value); }} /></div>
                                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Familia Superior</label><select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={catParent} onChange={e => setCatParent(e.target.value)}><option value="">Seleccionar...</option>{data.families.map(f => <option key={f.id} value={f.id}>{f.icon} {f.name}</option>)}</select></div>
                            </div>
                            {renderIconInput(catIcon, setCatIcon, catName, catFileInputRef)}
                            <button onClick={() => { if(!catName || !catParent) return; if (catId) onUpdateData({ categories: data.categories.map(c => c.id === catId ? { ...c, name: catName, familyId: catParent, icon: catIcon } : c) }); else onUpdateData({ categories: [...data.categories, { id: generateId(), name: catName, familyId: catParent, icon: catIcon }] }); resetForm(); }} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-2xl hover:bg-indigo-600 transition-all">Guardar Categoría</button>
                        </div>
                    )}
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 px-4">Listado de Categorías</h4>
                    <div className="space-y-3">
                        {data.categories.map(cat => {
                            const family = data.families.find(f => f.id === cat.familyId);
                            return (
                                <div key={cat.id} className="flex justify-between items-center p-5 bg-slate-50 rounded-3xl border border-transparent hover:border-slate-200 transition-all">
                                    <div className="flex items-center gap-4"><div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center border border-slate-100 p-2 shadow-sm shrink-0">{renderIcon(cat.icon || '🏷️', "w-full h-full")}</div><div><span className="font-black text-slate-900 block text-xs uppercase">{cat.name}</span><span className="text-[8px] font-bold text-slate-400 uppercase">{family?.name || 'Sin Familia'}</span></div></div>
                                    <div className="flex gap-1"><button onClick={() => { setCatId(cat.id); setCatName(cat.name); setCatParent(cat.familyId); setCatIcon(cat.icon || '🏷️'); }} className="p-3 text-slate-300 hover:text-indigo-600"><Edit2 size={18}/></button><button onClick={() => onUpdateData({categories: data.categories.filter(c=>c.id!==cat.id)})} className="p-3 text-slate-300 hover:text-rose-600"><Trash2 size={18}/></button></div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
