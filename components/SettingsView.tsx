
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AppState, Account, Family, Category, Transaction, TransactionType, RecurrentMovement, FavoriteMovement, RecurrenceFrequency, AccountGroup } from '../types';
import { Trash2, Edit2, Layers, Tag, Wallet, Loader2, ImageIcon, Sparkles, ChevronDown, XCircle, Info, Download, Upload, FileJson, FileSpreadsheet, DatabaseZap, ClipboardPaste, ListOrdered, CheckCircle2, Repeat, Star, Power, Calendar, ArrowRightLeft, ShieldCheck, AlertCircle, Plus, FileText, MoveRight, BoxSelect, AlertOctagon, Eraser, AlertTriangle } from 'lucide-react';
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

export const SettingsView: React.FC<SettingsViewProps> = ({ data, onUpdateData }) => {
  const [activeTab, setActiveTab] = useState<Tab>('ACC_GROUPS');
  
  const [webLogos, setWebLogos] = useState<{url: string, source: string}[]>([]);
  const [isSearchingWeb, setIsSearchingWeb] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const searchTimeoutRef = useRef<number | null>(null);

  // Importador de Entidades (CSV/Excel para Cuentas/Familias/Categorias)
  const entityImportFileRef = useRef<HTMLInputElement>(null);

  // Estado Migración Legacy (Contamoney)
  const [migrationText, setMigrationText] = useState('');
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationPreview, setMigrationPreview] = useState<{accounts: any[], families: any[], categories: any[]} | null>(null);

  // Importación rápida por texto/CSV de movimientos
  const [pasteMovements, setPasteMovements] = useState('');
  const [importErrors, setImportErrors] = useState<{fila: number, dato: string, error: string}[]>([]);

  // Estados de formulario masivo general
  const [showQuickImport, setShowQuickImport] = useState(false);
  const [pasteData, setPasteData] = useState('');

  // Estados de formulario Agrupaciones de Cuentas
  const [grpId, setGrpId] = useState<string | null>(null);
  const [grpName, setGrpName] = useState('');
  const [grpIcon, setGrpIcon] = useState('🗂️');
  const grpFileInputRef = useRef<HTMLInputElement>(null);

  // Estados de formulario Cuentas
  const [accId, setAccId] = useState<string | null>(null);
  const [accName, setAccName] = useState('');
  const [accBalance, setAccBalance] = useState('');
  const [accIcon, setAccIcon] = useState('🏦');
  const [accGroupId, setAccGroupId] = useState('');
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

  // Estados Borrado Masivo
  const [massDeleteYear, setMassDeleteYear] = useState<string | null>(null);

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
      setShowQuickImport(false); setPasteData(''); setPasteMovements(''); setImportErrors([]);
      setMigrationText(''); setMigrationPreview(null); setMassDeleteYear(null);
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
      const errors: {fila: number, dato: string, error: string}[] = [];

      lines.forEach((line, index) => {
          const parts = line.split(',').map(s => s.trim());
          if (parts.length < 5) { 
              errors.push({ fila: index + 1, dato: line, error: "Formato insuficiente (fecha, categoria, cuenta, concepto, importe)" });
              return; 
          }

          const [fec, catName, accName] = parts;
          let txType: TransactionType = 'EXPENSE';
          let catId = '';
          let familyId = '';
          let accId = '';
          let transferAccId = undefined;
          let concept = '';
          let amountStr = '';

          // Buscar cuenta origen
          const account = data.accounts.find(a => a.name.toLowerCase() === accName.toLowerCase());
          if (!account) { 
              errors.push({ fila: index + 1, dato: line, error: `Cuenta "${accName}" no encontrada en el sistema` });
              return; 
          }
          accId = account.id;

          if (catName.toLowerCase() === 'traspaso entre cuentas') {
              if (parts.length < 6) { 
                  errors.push({ fila: index + 1, dato: line, error: "Formato insuficiente para traspaso (faltan campos)" });
                  return; 
              }
              txType = 'TRANSFER';
              const destAccName = parts[3];
              concept = parts[4];
              amountStr = parts[5];
              const destAcc = data.accounts.find(a => a.name.toLowerCase() === destAccName.toLowerCase());
              if (!destAcc) { 
                  errors.push({ fila: index + 1, dato: line, error: `Cuenta destino "${destAccName}" no encontrada` });
                  return; 
              }
              transferAccId = destAcc.id;
          } else {
              concept = parts[3];
              amountStr = parts[4];
              const category = data.categories.find(c => c.name.toLowerCase() === catName.toLowerCase());
              if (!category) { 
                  errors.push({ fila: index + 1, dato: line, error: `Categoría "${catName}" no existe` });
                  return; 
              }
              catId = category.id;
              familyId = category.familyId;
          }

          const amountVal = parseFloat(amountStr.replace(',','.'));
          if (isNaN(amountVal)) {
              errors.push({ fila: index + 1, dato: line, error: `Importe "${amountStr}" no numérico` });
              return;
          }

          // Lógica de signos inteligente:
          // Negativo -> Gasto (EXPENSE)
          // Positivo -> Ingreso o Devolución de Gasto (INCOME)
          if (txType !== 'TRANSFER') {
              txType = amountVal < 0 ? 'EXPENSE' : 'INCOME';
          }

          newTransactions.push({
              id: generateId(),
              date: fec,
              description: concept,
              amount: Math.abs(amountVal),
              type: txType,
              accountId: accId,
              transferAccountId: transferAccId,
              categoryId: catId,
              familyId: familyId
          });
      });

      if (newTransactions.length > 0) {
          onUpdateData({ transactions: [...data.transactions, ...newTransactions] });
      }

      if (errors.length > 0) {
          setImportErrors(errors);
          if (newTransactions.length > 0) {
              alert(`Importación completada con avisos: ${newTransactions.length} añadidos, ${errors.length} errores detectados. Revisa el reporte.`);
          }
      } else {
          alert(`¡Éxito! ${newTransactions.length} movimientos importados correctamente.`);
          resetForm();
      }
  };

  const downloadErrorReport = () => {
      if (importErrors.length === 0) return;
      const ws = XLSX.utils.json_to_sheet(importErrors);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Errores Importacion");
      XLSX.writeFile(wb, `errores_importacion_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const transactionsPerYear = useMemo(() => {
    const counts: Record<string, number> = {};
    data.transactions.forEach(t => {
        const year = t.date.split('-')[0];
        if (year && year.length === 4) {
            counts[year] = (counts[year] || 0) + 1;
        }
    });
    // Aseguramos que el listado pueda manejar años desde 2015 aunque no haya movimientos
    // pero aquí mostramos solo los que TIENEN datos para que el usuario sepa qué puede borrar.
    return Object.entries(counts).sort((a,b) => b[0].localeCompare(a[0]));
  }, [data.transactions]);

  const handleMassDelete = (year: string) => {
      const updatedTxs = data.transactions.filter(t => !t.date.startsWith(year));
      onUpdateData({ transactions: updatedTxs });
      setMassDeleteYear(null);
      alert(`Limpieza completada: Se han borrado todos los movimientos de ${year}.`);
  };

  const handleQuickImport = () => {
      if (!pasteData.trim()) return;
      const lines = pasteData.trim().split('\n');
      if (activeTab === 'FAMILIES') {
          const newFamilies: Family[] = lines.map(line => {
              const [name, icon, type] = line.split(',').map(s => s.trim());
              return { id: generateId(), name: name || 'Nueva Familia', icon: icon || '📂', type: (type === 'INCOME' ? 'INCOME' : 'EXPENSE') as any };
          });
          onUpdateData({ families: [...data.families, ...newFamilies] });
      } else if (activeTab === 'CATEGORIES') {
          const newCategories: Category[] = lines.map(line => {
              const [name, icon, familyName] = line.split(',').map(s => s.trim());
              const family = data.families.find(f => f.name.toLowerCase() === familyName?.toLowerCase()) || data.families[0];
              return { id: generateId(), name: name || 'Nueva Categoría', icon: icon || '🏷️', familyId: family?.id || '' };
          });
          onUpdateData({ categories: [...data.categories, ...newCategories] });
      } else if (activeTab === 'ACC_GROUPS') {
          const newGroups: AccountGroup[] = lines.map(line => {
              const [name, icon] = line.split(',').map(s => s.trim());
              return { id: generateId(), name: name || 'Nuevo Grupo', icon: icon || '🗂️' };
          });
          onUpdateData({ accountGroups: [...(data.accountGroups || []), ...newGroups] });
      } else if (activeTab === 'ACCOUNTS') {
          const newAccounts: Account[] = [];
          const newGroupsToAdd: AccountGroup[] = [];
          const currentGroups = [...(data.accountGroups || [])];
          lines.forEach(line => {
              const parts = line.split(',').map(s => s.trim());
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

  const handleMigrationProcess = async () => {
      if (!migrationText.trim()) return;
      setIsMigrating(true);
      try {
          const result = await parseMigrationData(migrationText);
          setMigrationPreview(result);
      } catch (e) { alert("Error al analizar los datos con Gemini."); }
      finally { setIsMigrating(false); }
  };

  const confirmMigration = () => {
      if (!migrationPreview) return;
      const newAccounts = migrationPreview.accounts.map(a => ({ id: generateId(), name: a.name, initialBalance: a.balance || 0, currency: 'EUR', icon: '🏦', groupId: (data.accountGroups || [])[0]?.id || 'g1' }));
      const newFamilies = migrationPreview.families.map(f => ({ id: generateId(), name: f.name, type: (f.type === 'INCOME' ? 'INCOME' : 'EXPENSE') as any, icon: '📂' }));
      const newCategories = migrationPreview.categories.map(c => {
          const fam = [...data.families, ...newFamilies].find(f => f.name.toLowerCase() === c.familyName?.toLowerCase()) || newFamilies[0];
          return { id: generateId(), name: c.name, familyId: fam?.id || '', icon: '🏷️' };
      });
      onUpdateData({ accounts: [...data.accounts, ...newAccounts], families: [...data.families, ...newFamilies], categories: [...data.categories, ...newCategories] });
      resetForm();
      alert("¡Estructura migrada correctamente!");
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
        case 'ACCOUNTS': importHint = "Agrupación, Cuenta, Icono/URL, (Saldo - Opcional)"; placeholderExample = "Bancos, BBVA, 🏦, 1500.00\nEfectivo, Cartera, 💶, 50.00"; break;
        case 'ACC_GROUPS': importHint = "Nombre Agrupación, Icono"; placeholderExample = "Bancos, 🏦\nCrypto, 🪙"; break;
        case 'FAMILIES': importHint = "Nombre, Icono/Emoji, Tipo (INCOME/EXPENSE)"; placeholderExample = "Vivienda, 🏠, EXPENSE\nNómina, 💼, INCOME"; break;
        case 'CATEGORIES': importHint = "Nombre, Icono/Emoji, Nombre de Familia"; placeholderExample = "Alquiler, 🔑, Vivienda\nSupermercado, 🛒, Alimentación"; break;
        default: importHint = "Formato genérico"; placeholderExample = "Dato1, Dato2, Dato3";
    }
    return (
        <div className="bg-white p-8 rounded-[2.5rem] border-2 border-dashed border-indigo-100 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2"><ClipboardPaste size={16} /> Importación Rápida</h4>
                <button onClick={() => setShowQuickImport(false)} className="text-slate-300 hover:text-rose-500"><XCircle size={18}/></button>
            </div>
            <p className="text-[9px] font-bold text-slate-400 uppercase leading-relaxed">
                Pega aquí tus datos. Formato esperado: <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">{importHint}</span>. Una fila por elemento.
            </p>
            <textarea className="w-full h-40 p-5 bg-slate-50 border border-slate-100 rounded-xl font-mono text-[11px] outline-none focus:border-indigo-500 transition-all custom-scrollbar placeholder:text-slate-300" placeholder={placeholderExample} value={pasteData} onChange={e => setPasteData(e.target.value)} />
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
            <div className="space-y-8 pb-10">
                
                {/* BORRADO MASIVO POR AÑO */}
                <div className="bg-rose-50 p-10 rounded-[3rem] shadow-sm border border-rose-100 space-y-8">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                        <div className="space-y-2">
                            <h3 className="text-2xl font-black text-rose-900 uppercase tracking-tighter flex items-center gap-3">
                                <Eraser className="text-rose-600" size={28}/> Borrado Masivo por Año
                            </h3>
                            <p className="text-rose-700/60 text-xs font-bold uppercase tracking-widest leading-relaxed">
                                Elimina permanentemente todos los movimientos de un año específico. <br/>
                                <span className="text-rose-600">Punto de partida configurado para historiales desde 2015.</span>
                            </p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {transactionsPerYear.length > 0 ? transactionsPerYear.map(([year, count]) => (
                            <div key={year} className="bg-white p-6 rounded-3xl border border-rose-100 flex flex-col justify-between gap-4 group hover:shadow-lg transition-all relative overflow-hidden">
                                {massDeleteYear === year ? (
                                    <div className="absolute inset-0 bg-rose-600 text-white p-6 flex flex-col justify-center items-center text-center animate-in fade-in zoom-in-95">
                                        <AlertTriangle size={32} className="mb-2" />
                                        <p className="text-[11px] font-black uppercase mb-4">¿Borrar {year} permanentemente?</p>
                                        <div className="flex gap-2 w-full">
                                            <button onClick={() => handleMassDelete(year)} className="flex-1 py-3 bg-white text-rose-600 rounded-xl text-[10px] font-black uppercase shadow-lg">Confirmar</button>
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
                        )) : (
                            <div className="col-span-full py-20 text-center space-y-4 border-2 border-dashed border-rose-200 rounded-[2.5rem] bg-white">
                                <Info size={40} className="mx-auto text-rose-200" />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">No hay movimientos registrados para purgar.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* IMPORTADOR DE MOVIMIENTOS POR TEXTO */}
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                        <div className="space-y-2">
                            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
                                <ClipboardPaste className="text-indigo-600" size={28}/> Importador de Movimientos
                            </h3>
                            <div className="space-y-1">
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest leading-relaxed">
                                    Formato: <strong>fecha, categoria, cuenta, concepto, importe</strong>
                                </p>
                                <p className="text-indigo-500 text-[10px] font-black uppercase tracking-widest">
                                    Si es Traspaso: <strong>fecha, Traspaso entre cuentas, cuenta_origen, cuenta_destino, concepto, importe</strong>
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <textarea 
                            className="w-full h-48 p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] font-mono text-[11px] text-slate-600 outline-none focus:border-indigo-500 transition-all custom-scrollbar placeholder:text-slate-200 shadow-inner"
                            placeholder="2023-10-27, Alimentación, Mi Banco, Compra cena, -25.50&#10;2023-10-28, Traspaso entre cuentas, Mi Banco, Efectivo, Retirada de cajero, 50.00"
                            value={pasteMovements}
                            onChange={e => setPasteMovements(e.target.value)}
                        />
                        <div className="flex justify-between items-center bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                             <div className="flex items-center gap-3 text-indigo-600">
                                <Sparkles size={20} />
                                <p className="text-[10px] font-black uppercase tracking-widest leading-none">El sistema detectará el signo: Negativos son Gastos, Positivos son Ingresos.</p>
                             </div>
                             <div className="flex gap-3">
                                <button onClick={handleManualMovementImport} className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-950 transition-all shadow-xl shadow-indigo-200">
                                    Importar Datos
                                </button>
                                <button onClick={() => { setPasteMovements(''); setImportErrors([]); }} className="px-6 py-4 bg-white text-slate-500 border border-slate-200 rounded-xl font-black text-[10px] uppercase">Limpiar</button>
                             </div>
                        </div>
                    </div>

                    {importErrors.length > 0 && (
                        <div className="bg-rose-50 p-8 rounded-[2.5rem] border border-rose-100 space-y-6 animate-in fade-in slide-in-from-top-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rose-100 pb-4">
                                <div className="flex items-center gap-3 text-rose-600">
                                    <AlertOctagon size={28} />
                                    <div>
                                        <h4 className="font-black uppercase text-base tracking-tight">Detectados {importErrors.length} errores</h4>
                                        <p className="text-[10px] font-bold uppercase text-rose-400">Corrige los datos en el Excel y vuelve a pegarlos</p>
                                    </div>
                                </div>
                                <button onClick={downloadErrorReport} className="flex items-center justify-center gap-3 px-6 py-4 bg-white text-rose-600 border-2 border-rose-200 rounded-2xl font-black text-[11px] uppercase hover:bg-rose-600 hover:text-white transition-all shadow-lg active:scale-95">
                                    <FileSpreadsheet size={20} /> Descargar Reporte (.xlsx)
                                </button>
                            </div>
                            <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-2 pr-4">
                                {importErrors.map((err, i) => (
                                    <div key={i} className="bg-white/80 p-4 rounded-xl border border-rose-100 flex flex-col sm:flex-row justify-between gap-4 text-[10px] font-bold shadow-sm">
                                        <div className="flex gap-4 items-center">
                                            <span className="text-rose-600 bg-rose-100 px-3 py-1 rounded-lg shrink-0">Fila {err.fila}</span>
                                            <span className="text-slate-400 italic flex-1 break-all line-clamp-1">"{err.dato}"</span>
                                        </div>
                                        <span className="text-rose-700 font-black uppercase text-right shrink-0">{err.error}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* MIGRACIÓN INTELIGENTE */}
                <div className="bg-amber-50 p-10 rounded-[3rem] shadow-sm border border-amber-100 space-y-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/10 blur-[80px] -mr-16 -mt-16 pointer-events-none"></div>
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 relative z-10">
                        <div className="space-y-2 max-w-lg">
                            <h3 className="text-2xl font-black text-amber-900 uppercase tracking-tighter flex items-center gap-3">
                                <ArrowRightLeft className="text-amber-600" size={28}/> Asistente de Migración IA
                            </h3>
                            <p className="text-amber-700/60 text-xs font-bold uppercase tracking-widest leading-relaxed">
                                Pega aquí tablas crudas de **Contamoney** u otras apps. Gemini extraerá automáticamente cuentas y categorías con iconos apropiados.
                            </p>
                        </div>
                    </div>

                    {!migrationPreview ? (
                        <div className="space-y-4">
                            <textarea className="w-full h-40 p-5 bg-white border-2 border-amber-100 rounded-[2rem] font-mono text-[11px] text-slate-600 outline-none focus:border-amber-400 transition-all custom-scrollbar placeholder:text-amber-200" placeholder="Pega aquí el contenido copiado de tus tablas antiguas..." value={migrationText} onChange={e => setMigrationText(e.target.value)} />
                            <div className="flex justify-end"><button onClick={handleMigrationProcess} disabled={isMigrating || !migrationText} className="px-8 py-4 bg-amber-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-600 transition-all shadow-xl shadow-amber-200 disabled:opacity-50 flex items-center gap-2">{isMigrating ? <Loader2 className="animate-spin" size={16}/> : <Sparkles size={16}/>}{isMigrating ? 'Analizando con Gemini...' : 'Procesar Estructura'}</button></div>
                        </div>
                    ) : (
                        <div className="bg-white p-8 rounded-[2.5rem] border border-amber-100 space-y-6 animate-in fade-in slide-in-from-bottom-4 shadow-xl">
                            <div className="flex items-center gap-3 border-b border-amber-50 pb-4"><CheckCircle2 className="text-emerald-500" /><h4 className="font-black text-slate-800 uppercase tracking-tight">Estructura Detectada por la IA</h4></div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 text-center"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cuentas</span><p className="text-3xl font-black text-slate-900">{migrationPreview.accounts.length}</p></div>
                                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 text-center"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Familias</span><p className="text-3xl font-black text-slate-900">{migrationPreview.families.length}</p></div>
                                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 text-center"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Categorías</span><p className="text-3xl font-black text-slate-900">{migrationPreview.categories.length}</p></div>
                            </div>
                            <div className="flex gap-3"><button onClick={confirmMigration} className="flex-1 py-5 bg-emerald-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100">Aplicar Nueva Estructura</button><button onClick={() => { setMigrationPreview(null); setMigrationText(''); }} className="px-8 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black text-[11px] uppercase hover:bg-slate-200 transition-all">Cancelar</button></div>
                        </div>
                    )}
                </div>

                {/* COPIAS DE SEGURIDAD */}
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
      </div>
    </div>
  );
};
