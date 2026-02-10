
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { AppState, Transaction, TransactionType, GlobalFilter, FavoriteMovement, Category } from './types';
import { Plus, Trash2, Search, ArrowRightLeft, X, Paperclip, ChevronLeft, ChevronRight, Edit3, ArrowUpDown, Link2, Link2Off, Filter, Wallet, Tag, Receipt, CheckCircle2, Upload, SortAsc, SortDesc, FileDown, FileSpreadsheet, Printer, ChevronsLeft, ChevronsRight, ListFilter, Heart, Star, Bot, FileText, Check, AlertTriangle, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';

interface TransactionViewProps {
  data: AppState;
  onAddTransaction: (t: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onUpdateTransaction: (t: Transaction) => void;
  onUpdateData: (newData: Partial<AppState>) => void;
  filter: GlobalFilter;
  onUpdateFilter: (f: GlobalFilter) => void;
  initialSpecificFilters?: any;
  clearSpecificFilters?: () => void;
}

type SortField = 'DATE' | 'DESCRIPTION' | 'AMOUNT' | 'ACCOUNT' | 'CATEGORY' | 'ATTACHMENT';
type SortDirection = 'ASC' | 'DESC';
type AmountOperator = 'ALL' | 'GT' | 'LT' | 'EQ' | 'BETWEEN';

// Estructura para la previsualización de importación
interface PendingImport {
    tempId: string;
    date: string;
    description: string;
    amount: string; // String para edición fácil
    categoryId: string;
    accountId: string; // La cuenta seleccionada para importar
    isValid: boolean;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

// Formateador estático
const numberFormatter = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const TransactionView: React.FC<TransactionViewProps> = ({ data, onAddTransaction, onDeleteTransaction, onUpdateTransaction, filter, onUpdateFilter, initialSpecificFilters, clearSpecificFilters }) => {
  // Editor State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [fType, setFType] = useState<TransactionType>('EXPENSE');
  const [fAmount, setFAmount] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fDate, setFDate] = useState('');
  const [fAcc, setFAcc] = useState('');
  const [fCat, setFCat] = useState('');
  const [fTransferDest, setFTransferDest] = useState('');
  const [fAttachment, setFAttachment] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // SMART IMPORT STATE
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStep, setImportStep] = useState<1 | 2>(1); // 1: Config, 2: Preview
  const [importAccount, setImportAccount] = useState('');
  const [importRawData, setImportRawData] = useState('');
  const [pendingImports, setPendingImports] = useState<PendingImport[]>([]);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Favorites State
  const [showFavoritesMenu, setShowFavoritesMenu] = useState(false);

  // Filters State
  const [colFilterEntry, setColFilterEntry] = useState('ALL');
  const [colFilterDesc, setColFilterDesc] = useState('');
  const [colFilterClip, setColFilterClip] = useState<'ALL' | 'YES' | 'NO'>('ALL');
  const [colFilterExit, setColFilterExit] = useState('ALL');
  
  // Advanced Amount Filters
  const [colFilterAmountOp, setColFilterAmountOp] = useState<AmountOperator>('ALL');
  const [colFilterAmountVal1, setColFilterAmountVal1] = useState('');
  const [colFilterAmountVal2, setColFilterAmountVal2] = useState('');

  // Sorting & Pagination
  const [sortField, setSortField] = useState<SortField>('DATE');
  const [sortDirection, setSortDirection] = useState<SortDirection>('DESC');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // --- CAPA 1: ÍNDICES (Memoized) ---
  const indices = useMemo(() => {
    const acc = new Map(data.accounts.map(a => [a.id, a]));
    const cat = new Map(data.categories.map(c => [c.id, c]));
    const fam = new Map(data.families.map(f => [f.id, f]));
    return { acc, cat, fam };
  }, [data.accounts, data.categories, data.families]);

  // --- CAPA 2: ESTRUCTURAS UI ---
  const groupedLists = useMemo(() => {
    const sortedGroups = [...data.accountGroups].sort((a,b) => a.name.localeCompare(b.name));
    const sortedFamilies = [...data.families].sort((a,b) => a.name.localeCompare(b.name));

    const accounts = sortedGroups.map(g => ({
        group: g,
        items: data.accounts.filter(a => a.groupId === g.id).sort((a,b) => a.name.localeCompare(b.name))
    })).filter(g => g.items.length > 0);

    const categories = sortedFamilies.map(f => ({
        family: f,
        items: data.categories.filter(c => c.familyId === f.id).sort((a,b) => a.name.localeCompare(b.name))
    })).filter(f => f.items.length > 0);

    return { accounts, categories };
  }, [data.accountGroups, data.accounts, data.families, data.categories]);

  // Helpers
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '--/--/--';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year.slice(-2)}`;
  };
  const formatCurrency = (amount: number) => `${numberFormatter.format(amount)} €`;
  const getAmountColor = (amount: number) => {
      if (amount > 0) return 'text-emerald-600';
      if (amount < 0) return 'text-rose-600';
      return 'text-slate-400';
  };

  useEffect(() => {
    if (initialSpecificFilters) {
      if (initialSpecificFilters.action === 'NEW' && initialSpecificFilters.categoryId) {
         resetForm();
         const cat = indices.cat.get(initialSpecificFilters.categoryId);
         const fam = cat ? indices.fam.get(cat.familyId) : null;
         setFCat(initialSpecificFilters.categoryId);
         if (fam) setFType(fam.type === 'INCOME' ? 'INCOME' : 'EXPENSE');
         setIsModalOpen(true);
      } else {
          if (initialSpecificFilters.filterCategory) setColFilterEntry(initialSpecificFilters.filterCategory);
          if (initialSpecificFilters.filterAccount) setColFilterExit(initialSpecificFilters.filterAccount);
      }
      if (clearSpecificFilters) clearSpecificFilters();
    }
  }, [initialSpecificFilters, indices]);

  // RESET PAGE ON FILTER CHANGE
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, colFilterEntry, colFilterDesc, colFilterClip, colFilterExit, colFilterAmountOp, colFilterAmountVal1, colFilterAmountVal2, sortField, sortDirection]);

  // --- LOGIC: RESETEAR FILTROS DE COLUMNA SI CAMBIA EL TIEMPO ---
  // Opcional: Si el usuario cambia de año, es probable que quiera ver todo, o al menos
  // recalcular las opciones disponibles.
  /* useEffect(() => {
      setColFilterEntry('ALL');
      setColFilterExit('ALL');
  }, [filter.timeRange, filter.referenceDate, filter.customStart, filter.customEnd]); */

  // ... (Reset Form, Load Favorite, Open Editor, Handle Save remain same) ...
  const resetForm = () => {
    setEditingTx(null);
    setFType('EXPENSE');
    setFAmount('');
    setFDesc('');
    setFDate(new Date().toISOString().split('T')[0]);
    const defaultAcc = groupedLists.accounts[0]?.items[0]?.id || data.accounts[0]?.id || '';
    setFAcc(defaultAcc);
    setFCat('');
    setFTransferDest('');
    setFAttachment(undefined);
  };

  const loadFavorite = (fav: FavoriteMovement) => {
    resetForm();
    setFType(fav.type);
    setFAmount(Math.abs(fav.amount).toString());
    setFDesc(fav.description);
    setFAcc(fav.accountId);
    setFCat(fav.categoryId);
    if(fav.transferAccountId) setFTransferDest(fav.transferAccountId);
    setShowFavoritesMenu(false);
    setIsModalOpen(true);
  };

  const openEditor = (t?: Transaction) => {
    if (t) {
      setEditingTx(t);
      setFType(t.type);
      setFAmount(Math.abs(t.amount).toString());
      setFDesc(t.description);
      setFDate(t.date); 
      setFAcc(t.accountId);
      setFCat(t.categoryId);
      setFTransferDest(t.transferAccountId || '');
      setFAttachment(t.attachment);
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!fAmount || !fDesc || !fAcc || (fType !== 'TRANSFER' && !fCat)) {
      alert("Faltan datos obligatorios."); return;
    }
    let rawAmount = parseFloat(fAmount);
    rawAmount = Math.abs(rawAmount);
    if (fType === 'EXPENSE' || fType === 'TRANSFER') rawAmount = -rawAmount;
    
    const cat = indices.cat.get(fCat);
    const finalTx: Transaction = {
      id: editingTx ? editingTx.id : generateId(),
      date: fDate,
      amount: rawAmount,
      description: fDesc,
      accountId: fAcc,
      type: fType,
      categoryId: fCat,
      familyId: cat?.familyId || '',
      attachment: fAttachment,
      transferAccountId: fType === 'TRANSFER' ? fTransferDest : undefined
    };
    if (editingTx) onUpdateTransaction(finalTx);
    else onAddTransaction(finalTx);
    setIsModalOpen(false);
    resetForm();
  };

  // ... (Smart Import Logic remains same) ...
  const parseDateSmart = (dateStr: string) => {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    const s = dateStr.trim();
    const parts = s.split(/[\/\-]/);
    if (parts.length === 3) {
       if (parts[0].length <= 2 && parseInt(parts[0]) <= 31) {
           let y = parts[2];
           if (y.length === 2) y = '20' + y;
           return `${y}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
       }
       return `${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`;
    }
    return new Date().toISOString().split('T')[0];
  };

  const predictCategory = (desc: string): string => {
      if (!desc) return '';
      const lowerDesc = desc.toLowerCase();
      const match = data.transactions.find(t => 
          t.description.toLowerCase().includes(lowerDesc) || 
          lowerDesc.includes(t.description.toLowerCase())
      );
      return match ? match.categoryId : '';
  };

  const handleProcessSmartImport = () => {
      if (!importAccount) { alert("Selecciona primero la cuenta asociada."); return; }
      if (!importRawData.trim()) { alert("No hay datos para procesar."); return; }

      const lines = importRawData.split('\n').filter(l => l.trim().length > 0);
      const newPending: PendingImport[] = [];

      lines.forEach(line => {
          let parts: string[] = [];
          if (line.includes('\t')) parts = line.split('\t');
          else if (line.includes(';')) parts = line.split(';');
          else parts = line.split(',');

          parts = parts.map(p => p.trim().replace(/"/g, ''));

          if (parts.length >= 3) {
              const dateStr = parts[0];
              const descStr = parts[1];
              const amountStr = parts[parts.length - 1];

              const parsedDate = parseDateSmart(dateStr);
              const cleanAmount = amountStr.replace(/[^0-9.,-]/g, '').replace(',', '.');
              const predictedCat = predictCategory(descStr);

              newPending.push({
                  tempId: generateId(),
                  date: parsedDate,
                  description: descStr,
                  amount: cleanAmount,
                  categoryId: predictedCat,
                  accountId: importAccount,
                  isValid: true
              });
          }
      });

      if (newPending.length > 0) {
          setPendingImports(newPending);
          setImportStep(2);
      } else {
          alert("No se pudieron interpretar las líneas. Asegúrate del formato: Fecha ; Concepto ; Importe");
      }
  };

  const handleImportFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
          setImportRawData(lines);
      };
      reader.readAsBinaryString(file);
  };

  const validateImportRow = (tempId: string) => {
      const row = pendingImports.find(p => p.tempId === tempId);
      if (!row) return;

      const amountVal = parseFloat(row.amount);
      if (isNaN(amountVal) || !row.description) {
          alert("Revisa el importe y concepto."); return;
      }

      const type: TransactionType = amountVal >= 0 ? 'INCOME' : 'EXPENSE';
      const cat = indices.cat.get(row.categoryId);
      const famId = cat ? cat.familyId : '';

      const newTx: Transaction = {
          id: generateId(),
          date: row.date,
          description: row.description,
          amount: amountVal,
          type: type,
          accountId: row.accountId,
          categoryId: row.categoryId,
          familyId: famId,
      };

      onAddTransaction(newTx);
      setPendingImports(prev => prev.filter(p => p.tempId !== tempId));
  };

  const validateAllImports = () => {
      const validOnes = pendingImports.filter(p => !isNaN(parseFloat(p.amount)) && p.description.trim() !== '');
      validOnes.forEach(row => {
          const amountVal = parseFloat(row.amount);
          const type: TransactionType = amountVal >= 0 ? 'INCOME' : 'EXPENSE';
          const cat = indices.cat.get(row.categoryId);
          const newTx: Transaction = {
              id: generateId(),
              date: row.date,
              description: row.description,
              amount: amountVal,
              type: type,
              accountId: row.accountId,
              categoryId: row.categoryId,
              familyId: cat?.familyId || ''
          };
          onAddTransaction(newTx);
      });
      setPendingImports([]);
      setIsImportModalOpen(false);
      setImportRawData('');
      setImportStep(1);
  };

  // --- PASO 1: FILTRADO TEMPORAL ---
  // Primero obtenemos las transacciones que entran en el rango de fechas
  const timeFilteredList = useMemo(() => {
    const y = filter.referenceDate.getFullYear();
    const m = filter.referenceDate.getMonth();
    let start = ''; let end = '';
    
    if (filter.timeRange === 'MONTH') {
      start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      end = `${y}-${String(m + 1).padStart(2, '0')}-${new Date(y, m + 1, 0).getDate()}`;
    } else if (filter.timeRange === 'YEAR') {
      start = `${y}-01-01`; end = `${y}-12-31`;
    } else if (filter.timeRange === 'CUSTOM') {
      start = filter.customStart || '1900-01-01';
      end = filter.customEnd || '2100-12-31';
    }

    return data.transactions.filter(t => {
      if (filter.timeRange !== 'ALL' && (t.date < start || t.date > end)) return false;
      return true;
    });
  }, [data.transactions, filter.timeRange, filter.referenceDate, filter.customStart, filter.customEnd]);

  // --- PASO 2: CALCULAR OPCIONES DE FILTRO ACTIVAS ---
  // Basándonos en la lista temporal, determinamos qué cuentas y categorías están "activas" en las columnas
  const activeFilterOptions = useMemo(() => {
      const activeEntryIds = new Set<string>();
      const activeExitIds = new Set<string>();

      timeFilteredList.forEach(t => {
          // Columna IZQUIERDA (Entrada)
          if (t.type === 'EXPENSE') activeEntryIds.add(t.categoryId); // Categoría de gasto
          else if (t.type === 'INCOME') activeEntryIds.add(t.accountId); // Cuenta de cobro
          else if (t.type === 'TRANSFER') { if(t.transferAccountId) activeEntryIds.add(t.transferAccountId); } // Cuenta destino

          // Columna DERECHA (Salida)
          if (t.type === 'EXPENSE') activeExitIds.add(t.accountId); // Cuenta de pago
          else if (t.type === 'INCOME') activeExitIds.add(t.categoryId); // Categoría de ingreso
          else if (t.type === 'TRANSFER') activeExitIds.add(t.accountId); // Cuenta origen
      });

      return { activeEntryIds, activeExitIds };
  }, [timeFilteredList]);

  // --- PASO 3: FILTRADO COMPLETO (Columnas, Texto, Importe) ---
  const filteredList = useMemo(() => {
    const hasDescFilter = colFilterDesc && colFilterDesc.trim() !== '';
    const descPattern = hasDescFilter ? colFilterDesc.trim().toLowerCase() : '';
    const descIsRegex = hasDescFilter && (descPattern.includes('*') || descPattern.includes('?'));
    let regex: RegExp | null = null;
    if (descIsRegex) {
        let regexStr = descPattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*').replace(/\\\?/g, '.');
        regex = new RegExp(`^${regexStr}$`, 'i');
    }

    const v1 = parseFloat(colFilterAmountVal1);
    const v2 = parseFloat(colFilterAmountVal2);
    const hasAmountFilter = colFilterAmountOp !== 'ALL' && !isNaN(v1);

    return timeFilteredList.filter(t => {
      // 1. Filtro Columna IZQUIERDA (Entrada/Cat)
      if (colFilterEntry !== 'ALL') {
          const val = t.type === 'EXPENSE' ? t.categoryId :
                      t.type === 'INCOME' ? t.accountId :
                      t.type === 'TRANSFER' ? t.transferAccountId : '';
          if (val !== colFilterEntry) return false;
      }

      // 2. Filtro Columna DERECHA (Cuenta/Salida)
      if (colFilterExit !== 'ALL') {
          const val = t.type === 'EXPENSE' ? t.accountId :
                      t.type === 'INCOME' ? t.categoryId :
                      t.type === 'TRANSFER' ? t.accountId : '';
          if (val !== colFilterExit) return false;
      }

      // 3. Filtro Descripción
      if (hasDescFilter) {
          if (regex) { if (!regex.test(t.description)) return false; }
          else { if (!t.description.toLowerCase().includes(descPattern)) return false; }
      }
      
      // 4. Filtro Clip
      if (colFilterClip === 'YES' && !t.attachment) return false;
      if (colFilterClip === 'NO' && t.attachment) return false;

      // 5. Filtro Importe
      if (hasAmountFilter) {
          const val = t.amount;
          if (colFilterAmountOp === 'GT' && val <= v1) return false;
          if (colFilterAmountOp === 'LT' && val >= v1) return false;
          if (colFilterAmountOp === 'EQ' && Math.abs(val - v1) > 0.01) return false;
          if (colFilterAmountOp === 'BETWEEN') {
              if (isNaN(v2)) { if (val < v1) return false; }
              else { if (val < v1 || val > v2) return false; }
          }
      }
      return true;
    });
  }, [timeFilteredList, colFilterEntry, colFilterDesc, colFilterClip, colFilterExit, colFilterAmountOp, colFilterAmountVal1, colFilterAmountVal2]);

  // --- CAPA 4: ORDENACIÓN ---
  const sortedTransactions = useMemo(() => {
    return [...filteredList].sort((a, b) => {
      let vA: any, vB: any;
      if (sortField === 'DATE') { vA = a.date; vB = b.date; }
      else if (sortField === 'DESCRIPTION') { vA = a.description.toLowerCase(); vB = b.description.toLowerCase(); }
      else if (sortField === 'AMOUNT') { vA = a.amount; vB = b.amount; }
      else if (sortField === 'CATEGORY') { 
          // Ordenar por lo que se ve en la columna "Entrada/Cat"
          const getText = (tx: Transaction) => {
              if (tx.type === 'INCOME') return indices.acc.get(tx.accountId)?.name.toLowerCase() || '';
              if (tx.type === 'TRANSFER') return indices.acc.get(tx.transferAccountId || '')?.name.toLowerCase() || '';
              return indices.cat.get(tx.categoryId)?.name.toLowerCase() || '';
          };
          vA = getText(a);
          vB = getText(b);
      }
      else if (sortField === 'ACCOUNT') { 
          // Ordenar por lo que se ve en la columna "Cuenta" (Derecha)
          const getText = (tx: Transaction) => {
              if (tx.type === 'INCOME') return indices.cat.get(tx.categoryId)?.name.toLowerCase() || '';
              return indices.acc.get(tx.accountId)?.name.toLowerCase() || '';
          };
          vA = getText(a);
          vB = getText(b);
      }
      else if (sortField === 'ATTACHMENT') { vA = a.attachment ? 1 : 0; vB = b.attachment ? 1 : 0; }
      
      if (vA < vB) return sortDirection === 'ASC' ? -1 : 1;
      if (vA > vB) return sortDirection === 'ASC' ? 1 : -1;
      return 0;
    });
  }, [filteredList, sortField, sortDirection, indices]);

  // ... (Pagination and Export Logic remains same) ...
  const totalItems = sortedTransactions.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  const paginatedTransactions = useMemo(() => {
    if (itemsPerPage === -1) return sortedTransactions;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedTransactions.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedTransactions, currentPage, itemsPerPage]);

  const handleSort = (field: SortField) => {
      if (sortField === field) setSortDirection(sortDirection === 'ASC' ? 'DESC' : 'ASC');
      else { setSortField(field); setSortDirection('DESC'); }
  };

  const navigatePeriod = (direction: 'prev' | 'next') => {
    const newDate = new Date(filter.referenceDate);
    const step = direction === 'next' ? 1 : -1;
    if (filter.timeRange === 'MONTH') newDate.setMonth(newDate.getMonth() + step);
    else if (filter.timeRange === 'YEAR') newDate.setFullYear(newDate.getFullYear() + step);
    onUpdateFilter({ ...filter, referenceDate: newDate });
  };

  const handleExport = (type: 'CSV' | 'EXCEL') => {
      const exportData = sortedTransactions.map(t => {
          const srcAcc = indices.acc.get(t.accountId);
          const dstAcc = t.transferAccountId ? indices.acc.get(t.transferAccountId) : null;
          const cat = indices.cat.get(t.categoryId);
          const fam = cat ? indices.fam.get(cat.familyId) : null;
          return {
              Fecha: t.date,
              Tipo: t.type === 'EXPENSE' ? 'GASTO' : t.type === 'INCOME' ? 'INGRESO' : 'TRASPASO',
              Importe: t.amount,
              Concepto: t.description,
              Cuenta: srcAcc?.name || '---',
              'Cuenta Destino': dstAcc?.name || '',
              Categoria: cat?.name || '---',
              Familia: fam?.name || '---'
          };
      });

      if (type === 'EXCEL') {
          const ws = XLSX.utils.json_to_sheet(exportData);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Movimientos");
          XLSX.writeFile(wb, `contamiki_export_${new Date().toISOString().split('T')[0]}.xlsx`);
      } else if (type === 'CSV') {
          const ws = XLSX.utils.json_to_sheet(exportData);
          const csv = XLSX.utils.sheet_to_csv(ws);
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.setAttribute("href", url);
          link.setAttribute("download", `contamiki_export_${new Date().toISOString().split('T')[0]}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      }
  };

  const years = Array.from({length: new Date().getFullYear() - 2015 + 5}, (_, i) => 2015 + i);
  const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  const renderIcon = (iconStr: string, className = "w-10 h-10") => {
    if (iconStr?.startsWith('http') || iconStr?.startsWith('data:image')) return <img src={iconStr} className={`${className} object-contain rounded-lg`} referrerPolicy="no-referrer" />;
    return <span className="text-xl">{iconStr || '📂'}</span>;
  }

  const SortIcon = ({ field }: { field: SortField }) => {
      if (sortField !== field) return <ArrowUpDown size={12} className="opacity-20" />;
      return sortDirection === 'ASC' ? <SortAsc size={12} className="text-indigo-600" /> : <SortDesc size={12} className="text-indigo-600" />;
  };

  const clearAllFilters = () => {
    setColFilterEntry('ALL'); setColFilterDesc(''); setColFilterClip('ALL');
    setColFilterExit('ALL'); setColFilterAmountOp('ALL');
    setColFilterAmountVal1(''); setColFilterAmountVal2('');
  };

  return (
    <div className="space-y-6 md:space-y-10 pb-24">
      {/* ... (Header Section remains same) ... */}
      <div className="flex flex-col xl:flex-row justify-between xl:items-end gap-8 print:hidden">
        <div className="space-y-4 text-center md:text-left w-full xl:w-auto">
            <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter">Diario.</h2>
            <div className="flex flex-col sm:flex-row items-center gap-3 justify-center md:justify-start">
                <div className="flex items-center gap-1">
                    <button onClick={() => navigatePeriod('prev')} className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm active:scale-90 transition-all"><ChevronLeft size={20} /></button>
                    <button onClick={() => navigatePeriod('next')} className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm active:scale-90 transition-all"><ChevronRight size={20} /></button>
                </div>
                
                <div className="flex gap-2 items-center flex-wrap justify-center">
                    {filter.timeRange === 'CUSTOM' ? (
                        <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border-2 border-indigo-100 shadow-sm animate-in fade-in zoom-in duration-200">
                            <div className="flex flex-col px-2">
                                <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Desde</span>
                                <input 
                                    type="date" 
                                    className="text-xs font-bold outline-none text-slate-700 bg-transparent cursor-pointer"
                                    value={filter.customStart}
                                    onChange={(e) => onUpdateFilter({...filter, customStart: e.target.value})}
                                />
                            </div>
                            <div className="w-px h-6 bg-slate-200"></div>
                            <div className="flex flex-col px-2">
                                <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Hasta</span>
                                <input 
                                    type="date" 
                                    className="text-xs font-bold outline-none text-slate-700 bg-transparent cursor-pointer"
                                    value={filter.customEnd}
                                    onChange={(e) => onUpdateFilter({...filter, customEnd: e.target.value})}
                                />
                            </div>
                        </div>
                    ) : (
                        <>
                            {filter.timeRange !== 'ALL' && (
                                <select className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-indigo-500 shadow-sm cursor-pointer" value={filter.referenceDate.getFullYear()} onChange={(e) => { const d = new Date(filter.referenceDate); d.setFullYear(parseInt(e.target.value)); onUpdateFilter({...filter, referenceDate: d}); }}>
                                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            )}
                            {filter.timeRange === 'MONTH' && (
                                <select className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-indigo-500 shadow-sm cursor-pointer" value={filter.referenceDate.getMonth()} onChange={(e) => { const d = new Date(filter.referenceDate); d.setMonth(parseInt(e.target.value)); onUpdateFilter({...filter, referenceDate: d}); }}>
                                    {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                                </select>
                            )}
                        </>
                    )}
                </div>

                <div className="flex gap-2 sm:ml-4 relative">
                    <div className="relative">
                        <button onClick={() => setShowFavoritesMenu(!showFavoritesMenu)} className="bg-white text-indigo-600 border border-slate-200 px-4 py-2.5 rounded-xl font-black uppercase text-[10px] shadow-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2 active:scale-95 h-full">
                            <Heart size={16} className={showFavoritesMenu ? 'fill-indigo-600' : ''} /> <span className="hidden sm:inline">Favoritos</span>
                        </button>
                        
                        {showFavoritesMenu && (
                            <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-50 animate-in fade-in slide-in-from-top-2 max-h-80 overflow-y-auto custom-scrollbar">
                                {data.favorites && data.favorites.length > 0 ? (
                                    data.favorites.map(fav => (
                                        <button 
                                            key={fav.id}
                                            onClick={() => loadFavorite(fav)}
                                            className="w-full text-left p-3 hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors group"
                                        >
                                            <div className="w-8 h-8 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-lg group-hover:scale-110 transition-transform">
                                                {renderIcon(fav.icon || '⭐', "w-5 h-5")}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-black uppercase text-slate-800 truncate">{fav.name}</p>
                                                <p className="text-[9px] text-slate-400 truncate">{formatCurrency(fav.amount)}</p>
                                            </div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="p-4 text-center text-slate-400 text-[10px]">
                                        <p>No tienes favoritos configurados.</p>
                                        <p className="text-[9px] mt-1">Ve a Ajustes {'>'} Favoritos para crearlos.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={() => { setIsImportModalOpen(true); setImportStep(1); setPendingImports([]); setImportRawData(''); setImportAccount(''); }}
                        className="bg-white text-indigo-600 border border-slate-200 px-4 py-2.5 rounded-xl font-black uppercase text-[10px] shadow-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2 active:scale-95 h-full"
                    >
                        <Bot size={16} /> <span className="hidden sm:inline">Importar</span>
                    </button>

                    <button onClick={() => openEditor()} className="bg-slate-950 text-white px-6 py-2.5 rounded-xl font-black uppercase text-[10px] shadow-lg hover:bg-indigo-600 transition-all flex items-center justify-center gap-2 active:scale-95">
                      <Plus size={16} /> Nuevo
                    </button>
                </div>
            </div>
        </div>
        <div className="flex flex-col items-end gap-2">
            <div className="bg-slate-100/80 p-1.5 rounded-2xl flex flex-wrap justify-center gap-1 shadow-inner border border-slate-200/50 w-full sm:w-fit mx-auto xl:mx-0">
                {[
                    { id: 'ALL', label: 'Todo' },
                    { id: 'MONTH', label: 'Mes' },
                    { id: 'YEAR', label: 'Año' },
                    { id: 'CUSTOM', label: 'Pers' }
                ].map((range) => (
                    <button key={range.id} onClick={() => onUpdateFilter({...filter, timeRange: range.id as any})} className={`flex-1 sm:flex-none px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${filter.timeRange === range.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        {range.label}
                    </button>
                ))}
            </div>
            <div className="flex gap-2">
                <button onClick={() => handleExport('EXCEL')} className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl font-bold text-[10px] hover:bg-emerald-100 transition-colors flex items-center gap-2"><FileSpreadsheet size={14}/> Excel</button>
                <button onClick={() => handleExport('CSV')} className="px-4 py-2 bg-slate-50 text-slate-600 rounded-xl font-bold text-[10px] hover:bg-slate-100 transition-colors flex items-center gap-2"><FileDown size={14}/> CSV</button>
            </div>
        </div>
      </div>

      <div className="space-y-4">
          <div className="hidden lg:grid grid-cols-[100px_180px_1fr_60px_180px_180px_100px] gap-4 px-10 py-6 items-start bg-white rounded-[2.5rem] border border-slate-100 shadow-sm print:hidden">
            <div className="space-y-3">
                <button onClick={() => handleSort('DATE')} className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors pt-2">
                    Fecha <SortIcon field="DATE" />
                </button>
            </div>
            
            <div className="space-y-3">
                <button onClick={() => handleSort('CATEGORY')} className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors">
                    Entrada/Cat <SortIcon field="CATEGORY" />
                </button>
                <select 
                    className="w-full px-2 py-2 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold outline-none cursor-pointer focus:border-indigo-300 transition-all" 
                    value={colFilterEntry} 
                    onChange={e => setColFilterEntry(e.target.value)}
                >
                    <option value="ALL">TODAS</option>
                    {/* Generación dinámica de opciones basadas en lo visible actualmente */}
                    <optgroup label="Categorías (Gastos)">
                        {groupedLists.categories.map(group => {
                            // Filtramos items que existan en activeFilterOptions
                            const visibleItems = group.items.filter(c => activeFilterOptions.activeEntryIds.has(c.id));
                            if (visibleItems.length === 0) return null;
                            return (
                                <optgroup key={group.family.id} label={group.family.name}>
                                    {visibleItems.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </optgroup>
                            );
                        })}
                    </optgroup>
                    <optgroup label="Cuentas (Ingresos/Traspasos)">
                        {groupedLists.accounts.map(group => {
                            const visibleItems = group.items.filter(a => activeFilterOptions.activeEntryIds.has(a.id));
                            if (visibleItems.length === 0) return null;
                            return (
                                <optgroup key={group.group.id} label={group.group.name}>
                                    {visibleItems.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </optgroup>
                            );
                        })}
                    </optgroup>
                </select>
            </div>

            <div className="space-y-3">
                <button onClick={() => handleSort('DESCRIPTION')} className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors">
                    Descripción <SortIcon field="DESCRIPTION" />
                </button>
                <div className="relative group">
                    <input 
                      type="text" 
                      placeholder="Ej: Sup* o Com?ra" 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold outline-none focus:border-indigo-300 transition-all placeholder:text-slate-300" 
                      value={colFilterDesc} 
                      onChange={e => setColFilterDesc(e.target.value)} 
                    />
                    {colFilterDesc && <button onClick={() => setColFilterDesc('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-rose-500"><X size={12} /></button>}
                </div>
            </div>

            <div className="space-y-3 flex flex-col items-center">
                <button onClick={() => handleSort('ATTACHMENT')} className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors">
                    Clip <SortIcon field="ATTACHMENT" />
                </button>
                <select className="w-full px-1 py-2 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-black outline-none cursor-pointer focus:border-indigo-300 transition-all" value={colFilterClip} onChange={e => setColFilterClip(e.target.value as any)}>
                    <option value="ALL">TODOS</option>
                    <option value="YES">SÍ</option>
                    <option value="NO">NO</option>
                </select>
            </div>

            <div className="space-y-3">
                <button onClick={() => handleSort('ACCOUNT')} className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors">
                    Cuenta <SortIcon field="ACCOUNT" />
                </button>
                <select 
                    className="w-full px-2 py-2 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold outline-none cursor-pointer focus:border-indigo-300 transition-all" 
                    value={colFilterExit} 
                    onChange={e => setColFilterExit(e.target.value)}
                >
                    <option value="ALL">TODAS</option>
                    <optgroup label="Cuentas (Pagos/Traspasos)">
                        {groupedLists.accounts.map(group => {
                            const visibleItems = group.items.filter(a => activeFilterOptions.activeExitIds.has(a.id));
                            if (visibleItems.length === 0) return null;
                            return (
                                <optgroup key={group.group.id} label={group.group.name}>
                                    {visibleItems.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </optgroup>
                            );
                        })}
                    </optgroup>
                    <optgroup label="Categorías (Ingresos)">
                        {groupedLists.categories.map(group => {
                            const visibleItems = group.items.filter(c => activeFilterOptions.activeExitIds.has(c.id));
                            if (visibleItems.length === 0) return null;
                            return (
                                <optgroup key={group.family.id} label={group.family.name}>
                                    {visibleItems.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </optgroup>
                            );
                        })}
                    </optgroup>
                </select>
            </div>

            <div className="space-y-3">
                <button onClick={() => handleSort('AMOUNT')} className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors justify-end w-full">
                    Importe <SortIcon field="AMOUNT" />
                </button>
                <div className="space-y-1.5">
                    <select className="w-full px-2 py-2 bg-slate-50 border border-slate-100 rounded-lg text-[9px] font-black uppercase outline-none cursor-pointer focus:border-indigo-300 transition-all" value={colFilterAmountOp} onChange={e => setColFilterAmountOp(e.target.value as AmountOperator)}>
                        <option value="ALL">Todos</option>
                        <option value="GT">{"Mayor que (>)..."}</option>
                        <option value="LT">{"Menor que (<)..."}</option>
                        <option value="EQ">{"Igual a (=)..."}</option>
                        <option value="BETWEEN">{"Entre..."}</option>
                    </select>
                    {colFilterAmountOp !== 'ALL' && (
                        <div className={`grid gap-1 ${colFilterAmountOp === 'BETWEEN' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                            <input type="number" step="0.01" className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:border-indigo-500" placeholder="Val 1" value={colFilterAmountVal1} onChange={e => setColFilterAmountVal1(e.target.value)} />
                            {colFilterAmountOp === 'BETWEEN' && (
                                <input type="number" step="0.01" className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:border-indigo-500" placeholder="Val 2" value={colFilterAmountVal2} onChange={e => setColFilterAmountVal2(e.target.value)} />
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-col items-center justify-center pt-2 h-full">
                <button onClick={clearAllFilters} className="p-2 text-slate-300 hover:text-rose-500 transition-colors group/clear" title="Limpiar todos los filtros">
                    <X size={18} />
                </button>
            </div>
          </div>

          {paginatedTransactions.map(t => {
              // ... (Transaction Row remains identical) ...
              const srcAcc = indices.acc.get(t.accountId);
              const dstAcc = t.transferAccountId ? indices.acc.get(t.transferAccountId) : null;
              const cat = indices.cat.get(t.categoryId);
              
              let entryNode: React.ReactNode;
              let exitNode: React.ReactNode;

              if (t.type === 'TRANSFER') {
                entryNode = <div onClick={(e) => { e.stopPropagation(); setColFilterEntry(dstAcc?.id || ''); }} className="flex items-center gap-2 text-indigo-600 font-bold truncate cursor-pointer hover:underline decoration-2 underline-offset-4 decoration-indigo-200" title="Filtrar por esta cuenta">{renderIcon(dstAcc?.icon || '🏦', "w-6 h-6")} {dstAcc?.name}</div>;
                exitNode = <div onClick={(e) => { e.stopPropagation(); setColFilterExit(srcAcc?.id || ''); }} className="flex items-center gap-2 text-slate-500 font-bold truncate cursor-pointer hover:underline decoration-2 underline-offset-4 decoration-slate-200" title="Filtrar por esta cuenta">{renderIcon(srcAcc?.icon || '🏦', "w-6 h-6")} {srcAcc?.name}</div>;
              } else if (t.type === 'INCOME') {
                entryNode = <div onClick={(e) => { e.stopPropagation(); setColFilterEntry(srcAcc?.id || ''); }} className="flex items-center gap-2 text-emerald-600 font-bold truncate cursor-pointer hover:underline decoration-2 underline-offset-4 decoration-emerald-200" title="Filtrar por esta cuenta">{renderIcon(srcAcc?.icon || '🏦', "w-6 h-6")} {srcAcc?.name}</div>;
                exitNode = <div onClick={(e) => { e.stopPropagation(); setColFilterExit(cat?.id || ''); }} className="flex items-center gap-2 text-slate-300 italic truncate cursor-pointer hover:text-emerald-500 transition-colors" title="Filtrar por esta categoría">{cat ? renderIcon(cat.icon, "w-5 h-5") : <Tag size={14}/>} {cat?.name || 'S/C'}</div>;
              } else {
                entryNode = <div onClick={(e) => { e.stopPropagation(); setColFilterEntry(cat?.id || ''); }} className="flex items-center gap-2 text-rose-500 font-bold truncate cursor-pointer hover:underline decoration-2 underline-offset-4 decoration-rose-200" title="Filtrar por esta categoría">{renderIcon(cat?.icon || '🏷️', "w-6 h-6")} {cat?.name}</div>;
                exitNode = <div onClick={(e) => { e.stopPropagation(); setColFilterExit(srcAcc?.id || ''); }} className="flex items-center gap-2 text-slate-500 font-bold truncate cursor-pointer hover:underline decoration-2 underline-offset-4 decoration-slate-200" title="Filtrar por esta cuenta">{renderIcon(srcAcc?.icon || '🏦', "w-6 h-6")} {srcAcc?.name}</div>;
              }

              return (
                  <div key={t.id} className="group bg-white p-4 lg:p-5 lg:px-10 rounded-[1.5rem] lg:rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-2xl hover:border-indigo-100 transition-all relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 print:border-b print:border-slate-200 print:rounded-none print:shadow-none">
                      
                      {/* Mobile View (Compact) */}
                      <div className="flex justify-between items-start lg:hidden">
                        <div className="flex-1 min-w-0 pr-3">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{formatDateDisplay(t.date)}</span>
                                {t.attachment && <Paperclip size={10} className="text-indigo-400" />}
                            </div>
                            <div className="font-black text-slate-800 text-xs truncate uppercase tracking-tight mb-1.5">{t.description}</div>
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] leading-none">
                                {t.type === 'TRANSFER' ? (
                                    <>
                                        <span onClick={(e) => { e.stopPropagation(); setColFilterExit(srcAcc?.id || ''); }} className="flex items-center gap-1 text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-[0.4rem] cursor-pointer active:scale-95">
                                            {renderIcon(srcAcc?.icon, "w-3 h-3")} <span className="truncate max-w-[80px]">{srcAcc?.name}</span>
                                        </span>
                                        <ArrowRightLeft size={10} className="text-slate-300" />
                                        <span onClick={(e) => { e.stopPropagation(); setColFilterEntry(dstAcc?.id || ''); }} className="flex items-center gap-1 text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-[0.4rem] cursor-pointer active:scale-95">
                                            {renderIcon(dstAcc?.icon, "w-3 h-3")} <span className="truncate max-w-[80px]">{dstAcc?.name}</span>
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <span onClick={(e) => { e.stopPropagation(); setColFilterEntry(cat?.id || ''); }} className={`flex items-center gap-1 px-1.5 py-0.5 rounded-[0.4rem] cursor-pointer active:scale-95 ${t.type === 'EXPENSE' ? 'text-rose-600 bg-rose-50' : 'text-emerald-600 bg-emerald-50'}`}>
                                            {cat ? renderIcon(cat.icon, "w-3 h-3") : <Tag size={10}/>} 
                                            <span className="truncate max-w-[100px]">{cat?.name || 'S/C'}</span>
                                        </span>
                                        <span className="text-slate-300 text-[8px]">•</span>
                                        <span onClick={(e) => { e.stopPropagation(); setColFilterExit(srcAcc?.id || ''); }} className="text-slate-400 flex items-center gap-1 truncate max-w-[80px] cursor-pointer hover:text-indigo-500">
                                            {renderIcon(srcAcc?.icon, "w-3 h-3")} {srcAcc?.name}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                        
                        <div className="flex flex-col items-end gap-3">
                            <span className={`text-sm font-black tracking-tighter ${getAmountColor(t.amount)}`}>
                                {formatCurrency(t.amount)}
                            </span>
                            <div className="flex gap-1 print:hidden">
                                <button onClick={() => openEditor(t)} className="p-1.5 bg-slate-50 text-slate-400 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-all active:scale-90"><Edit3 size={14}/></button>
                                <button onClick={() => setDeleteConfirmId(t.id)} className="p-1.5 bg-slate-50 text-slate-400 rounded-lg hover:bg-rose-50 hover:text-rose-600 transition-all active:scale-90"><Trash2 size={14}/></button>
                            </div>
                        </div>
                      </div>

                      {/* Desktop View (Full Grid) */}
                      <div className="hidden lg:grid grid-cols-[100px_180px_1fr_60px_180px_180px_100px] items-center gap-4 lg:gap-6">
                        <div className="text-[11px] font-black text-slate-400 uppercase tracking-tighter">
                            {formatDateDisplay(t.date)}
                        </div>
                        <div className="text-xs uppercase">{entryNode}</div>
                        <div className="text-sm font-black text-slate-800 truncate uppercase tracking-tight">{t.description}</div>
                        <div className="flex justify-center print:hidden">
                            {t.attachment ? (
                                <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-lg shadow-indigo-100 group-hover:scale-110 transition-transform cursor-pointer" title="Ver adjunto">
                                    <Link2 size={18} />
                                </div>
                            ) : (
                                <div className="text-slate-100 p-2.5"><Link2Off size={18} /></div>
                            )}
                        </div>
                        <div className="text-xs uppercase">{exitNode}</div>
                        <div className={`text-right text-xl font-black tracking-tighter ${getAmountColor(t.amount)}`}>
                            {formatCurrency(t.amount)}
                        </div>
                        <div className="flex justify-center gap-1 print:hidden">
                            <button onClick={() => openEditor(t)} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all active:scale-90"><Edit3 size={18}/></button>
                            <button onClick={() => setDeleteConfirmId(t.id)} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-all active:scale-90"><Trash2 size={18}/></button>
                        </div>
                      </div>

                      {deleteConfirmId === t.id && (
                        <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-[1.5rem] lg:rounded-[2.5rem] z-10 flex flex-col lg:flex-row items-center justify-center gap-3 lg:gap-6 animate-in zoom-in-95 p-4 text-center print:hidden">
                          <p className="text-xs font-black text-slate-900 uppercase tracking-widest">¿Confirmar borrado definitivo?</p>
                          <div className="flex gap-2">
                            <button onClick={() => { onDeleteTransaction(t.id); setDeleteConfirmId(null); }} className="bg-rose-600 text-white px-4 py-2 lg:px-8 lg:py-3 rounded-xl font-black text-[10px] uppercase shadow-xl active:scale-95 transition-all">Eliminar</button>
                            <button onClick={() => setDeleteConfirmId(null)} className="bg-slate-100 text-slate-500 px-4 py-2 lg:px-8 lg:py-3 rounded-xl font-black text-[10px] uppercase active:scale-95 transition-all">Cancelar</button>
                          </div>
                        </div>
                      )}
                  </div>
              );
          })}
          
          {sortedTransactions.length === 0 && (
            <div className="py-32 text-center space-y-6 bg-slate-50/50 rounded-[3rem] border-4 border-dashed border-slate-100">
                <div className="mx-auto bg-white p-8 w-24 h-24 rounded-full flex items-center justify-center text-slate-200 shadow-sm border border-slate-100"><Search size={48}/></div>
                <div className="space-y-1">
                  <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest">Sin coincidencias</p>
                  <p className="text-[10px] font-medium text-slate-300 uppercase tracking-widest">Ajusta los filtros para encontrar lo que buscas</p>
                </div>
                <button onClick={clearAllFilters} className="px-6 py-3 bg-indigo-50 text-indigo-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 transition-all">Limpiar filtros</button>
            </div>
          )}

          {/* CONTROL DE PAGINACIÓN */}
          {/* ... (Same as before) ... */}
          {sortedTransactions.length > 0 && (
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-8 pt-6 border-t border-slate-200 px-4 print:hidden">
                  <div className="flex items-center gap-3 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                        {[25, 50, 100, -1].map(limit => (
                            <button 
                                key={limit} 
                                onClick={() => { setItemsPerPage(limit); setCurrentPage(1); }}
                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${itemsPerPage === limit ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                {limit === -1 ? 'Todo' : limit}
                            </button>
                        ))}
                  </div>

                  <div className="flex items-center gap-2">
                      <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-2 bg-white border border-slate-200 rounded-xl text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-indigo-50 hover:text-indigo-600 transition-all"><ChevronsLeft size={16}/></button>
                      <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-2 bg-white border border-slate-200 rounded-xl text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-indigo-50 hover:text-indigo-600 transition-all"><ChevronLeft size={16}/></button>
                      
                      <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-600 tracking-widest min-w-[100px] text-center">
                          {itemsPerPage === -1 ? 'Vista Completa' : `Pág ${currentPage} / ${totalPages}`}
                      </div>

                      <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || itemsPerPage === -1} className="p-2 bg-white border border-slate-200 rounded-xl text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-indigo-50 hover:text-indigo-600 transition-all"><ChevronRight size={16}/></button>
                      <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages || itemsPerPage === -1} className="p-2 bg-white border border-slate-200 rounded-xl text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-indigo-50 hover:text-indigo-600 transition-all"><ChevronsRight size={16}/></button>
                  </div>

                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:block">
                      {totalItems} Registros
                  </div>
              </div>
          )}
      </div>

      {/* ... (Modals remain identical) ... */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[200] p-4 animate-in fade-in duration-500">
            <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl p-8 sm:p-12 relative max-h-[95vh] overflow-y-auto custom-scrollbar border border-white/20">
                {/* ... (Modal content) ... */}
                <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="absolute top-8 right-8 p-3 bg-slate-50 text-slate-400 rounded-full hover:text-rose-500 hover:bg-rose-50 transition-all"><X size={24}/></button>
                <div className="flex items-center gap-4 mb-10">
                    <div className="bg-indigo-600 p-4 rounded-3xl text-white shadow-xl shadow-indigo-600/20">< Receipt size={28} /></div>
                    <div>
                      <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">{editingTx ? 'Editar' : 'Nuevo'}</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Registro de Movimiento</p>
                    </div>
                </div>
                <div className="space-y-8">
                    <div className="bg-slate-100 p-2 rounded-[1.5rem] flex gap-2 shadow-inner">
                        {[
                          {id: 'EXPENSE', label: 'Gasto', color: 'rose'},
                          {id: 'INCOME', label: 'Ingreso', color: 'emerald'},
                          {id: 'TRANSFER', label: 'Traspaso', color: 'indigo'}
                        ].map(m => (
                          <button key={m.id} type="button" onClick={() => setFType(m.id as any)} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${fType === m.id ? `bg-white text-${m.color}-600 shadow-xl` : 'text-slate-400 hover:text-slate-600'}`}>{m.label}</button>
                        ))}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Importe (Sin signo)</label>
                          <div className="relative">
                            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 font-bold">€</span>
                            <span className={`absolute left-10 top-1/2 -translate-y-1/2 font-black text-xl ${(fType === 'EXPENSE' || fType === 'TRANSFER') ? 'text-rose-500' : 'text-emerald-500'}`}>
                                {(fType === 'EXPENSE' || fType === 'TRANSFER') ? '-' : '+'}
                            </span>
                            <input type="number" step="0.01" className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-3xl font-black outline-none focus:border-indigo-500 transition-all shadow-inner" value={fAmount} onChange={e => setFAmount(e.target.value)} />
                          </div>
                          <p className="text-[9px] text-slate-400 italic ml-2">El signo se asignará automáticamente según el tipo.</p>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha Operación</label>
                          <input type="date" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all shadow-inner" value={fDate} onChange={e => setFDate(e.target.value)} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descripción / Concepto</label>
                        <input type="text" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all shadow-inner" placeholder="Escribe un concepto claro..." value={fDesc} onChange={e => setFDesc(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{fType === 'TRANSFER' ? 'Desde Cuenta' : 'Cuenta de Pago/Cobro'}</label>
                          <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all shadow-inner" value={fAcc} onChange={e => setFAcc(e.target.value)}>
                              {groupedLists.accounts.map(group => (
                                  <optgroup key={group.group.id} label={group.group.name}>
                                      {group.items.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                  </optgroup>
                              ))}
                          </select>
                        </div>
                        {fType === 'TRANSFER' ? (
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hacia Cuenta</label>
                            <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all shadow-inner" value={fTransferDest} onChange={e => setFTransferDest(e.target.value)}>
                                <option value="">Destino...</option>
                                {groupedLists.accounts.map(group => (
                                    <optgroup key={group.group.id} label={group.group.name}>
                                        {group.items.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </optgroup>
                                ))}
                            </select>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoría</label>
                            <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all shadow-inner" value={fCat} onChange={e => setFCat(e.target.value)}>
                                <option value="">Sin categoría...</option>
                                {groupedLists.categories.map(group => (
                                    <optgroup key={group.family.id} label={group.family.name}>
                                        {group.items.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </optgroup>
                                ))}
                            </select>
                          </div>
                        )}
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Paperclip size={14} /> Adjuntar Comprobante (Opcional)</label>
                        <div className="flex gap-3">
                          <button type="button" onClick={() => fileInputRef.current?.click()} className={`flex-1 px-8 py-5 border-2 border-dashed rounded-3xl font-black text-[11px] uppercase transition-all flex items-center justify-center gap-3 ${fAttachment ? 'bg-indigo-50 border-indigo-300 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-indigo-200'}`}>
                            {fAttachment ? <CheckCircle2 size={18}/> : <Upload size={18}/>}
                            {fAttachment ? 'Adjunto Preparado' : 'Subir Imagen / PDF'}
                          </button>
                          {fAttachment && <button type="button" onClick={() => setFAttachment(undefined)} className="p-5 bg-rose-50 text-rose-500 rounded-3xl border border-rose-100 shadow-sm active:scale-90 transition-all"><X size={24}/></button>}
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={e => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = ev => setFAttachment(ev.target?.result as string); reader.readAsDataURL(file); }}} />
                    </div>
                    <button onClick={handleSave} className="w-full py-7 bg-slate-950 text-white rounded-[2.5rem] font-black uppercase text-[12px] tracking-widest shadow-2xl hover:bg-indigo-600 transition-all active:scale-95 mt-10">
                      {editingTx ? 'Guardar Cambios' : 'Confirmar y Registrar'}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* ... (Import Modal remains identical) ... */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center z-[200] p-4 animate-in fade-in duration-300">
            <div className={`bg-white rounded-[3rem] shadow-2xl w-full ${importStep === 2 ? 'max-w-6xl h-[90vh]' : 'max-w-xl'} p-8 sm:p-12 relative flex flex-col border border-white/20 transition-all duration-500`}>
                {/* ... (Content of Smart Import) ... */}
                <button onClick={() => { setIsImportModalOpen(false); setPendingImports([]); }} className="absolute top-8 right-8 p-3 bg-slate-50 text-slate-400 rounded-full hover:text-rose-500 hover:bg-rose-50 transition-all z-10"><X size={24}/></button>
                
                <div className="flex items-center gap-4 mb-8 flex-none">
                    <div className="bg-indigo-600 p-4 rounded-3xl text-white shadow-xl shadow-indigo-600/20"><Bot size={28} /></div>
                    <div>
                      <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Importador Inteligente</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Carga masiva de extractos bancarios</p>
                    </div>
                </div>

                {importStep === 1 ? (
                    <div className="space-y-8">
                        <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100 space-y-2">
                            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2"><AlertTriangle size={14}/> Instrucciones</p>
                            <p className="text-[11px] font-medium text-slate-600 italic leading-relaxed">
                                1. Selecciona la cuenta bancaria de origen.<br/>
                                2. Pega las líneas del extracto o sube un Excel/CSV.<br/>
                                3. Formato esperado: <strong>Fecha | Concepto | Importe</strong><br/>
                                4. El sistema detectará automáticamente las categorías basándose en tu historial.
                            </p>
                        </div>
                        
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cuenta Bancaria (Obligatorio)</label>
                            <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all shadow-inner" value={importAccount} onChange={e => setImportAccount(e.target.value)}>
                                <option value="">Seleccionar cuenta...</option>
                                {groupedLists.accounts.map(group => (
                                    <optgroup key={group.group.id} label={group.group.name}>
                                        {group.items.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </optgroup>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div onClick={() => importFileRef.current?.click()} className="group border-2 border-dashed border-slate-200 rounded-[2rem] p-8 text-center hover:border-indigo-500 hover:bg-indigo-50/30 transition-all cursor-pointer bg-slate-50/30 flex flex-col items-center justify-center gap-2">
                                <FileSpreadsheet className="text-slate-300 group-hover:text-indigo-500" size={32} />
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Subir Excel / CSV</span>
                                <input type="file" ref={importFileRef} className="hidden" accept=".csv, .xlsx, .xls" onChange={handleImportFileUpload} />
                            </div>
                             <textarea 
                                className="w-full h-32 p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] font-mono text-[10px] outline-none shadow-inner placeholder:text-slate-300 focus:border-indigo-500 transition-all resize-none" 
                                placeholder="O pega aquí las filas:&#10;01/01/2024; Mercadona; -50.00" 
                                value={importRawData} 
                                onChange={e => setImportRawData(e.target.value)} 
                            />
                        </div>

                        <button onClick={handleProcessSmartImport} className="w-full py-6 bg-slate-950 text-white rounded-[2rem] font-black uppercase text-[11px] tracking-widest shadow-2xl hover:bg-indigo-600 transition-all active:scale-95 flex items-center justify-center gap-2">
                           <RefreshCw size={16}/> Analizar y Previsualizar
                        </button>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="flex justify-between items-center mb-4 px-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{pendingImports.length} Movimientos detectados</span>
                            <div className="flex gap-2">
                                <button onClick={() => setImportStep(1)} className="px-4 py-2 text-slate-400 hover:text-slate-600 text-[10px] font-bold uppercase tracking-widest">Volver</button>
                                <button onClick={validateAllImports} className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg flex items-center gap-2"><CheckCircle2 size={14}/> Validar Todos</button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 p-2">
                            {pendingImports.map((item) => {
                                const cat = indices.cat.get(item.categoryId);
                                const isIncome = parseFloat(item.amount) >= 0;
                                return (
                                    <div key={item.tempId} className="bg-white border border-slate-100 rounded-3xl p-4 flex flex-col lg:flex-row items-center gap-4 shadow-sm hover:border-indigo-200 transition-colors group">
                                        <div className="w-full lg:w-32">
                                            <input type="date" className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[10px] font-bold outline-none focus:border-indigo-300" value={item.date} onChange={(e) => setPendingImports(prev => prev.map(p => p.tempId === item.tempId ? {...p, date: e.target.value} : p))} />
                                        </div>
                                        <div className="flex-1 w-full">
                                            <input type="text" className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[11px] font-black uppercase text-slate-700 outline-none focus:border-indigo-300" value={item.description} onChange={(e) => setPendingImports(prev => prev.map(p => p.tempId === item.tempId ? {...p, description: e.target.value} : p))} />
                                        </div>
                                        <div className="w-full lg:w-48">
                                             <select 
                                                className={`w-full px-3 py-2 border rounded-xl text-[10px] font-bold outline-none appearance-none cursor-pointer transition-colors ${item.categoryId ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`} 
                                                value={item.categoryId} 
                                                onChange={(e) => setPendingImports(prev => prev.map(p => p.tempId === item.tempId ? {...p, categoryId: e.target.value} : p))}
                                            >
                                                <option value="">Sin categoría...</option>
                                                {groupedLists.categories.map(group => (
                                                    <optgroup key={group.family.id} label={group.family.name}>
                                                        {group.items.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                    </optgroup>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="w-full lg:w-32 relative">
                                            <input type="number" step="0.01" className={`w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-right text-[12px] font-black outline-none focus:border-indigo-300 ${isIncome ? 'text-emerald-600' : 'text-rose-600'}`} value={item.amount} onChange={(e) => setPendingImports(prev => prev.map(p => p.tempId === item.tempId ? {...p, amount: e.target.value} : p))} />
                                        </div>
                                        <div className="flex gap-2 w-full lg:w-auto justify-end">
                                            <button onClick={() => validateImportRow(item.tempId)} className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors" title="Validar fila"><Check size={16}/></button>
                                            <button onClick={() => setPendingImports(prev => prev.filter(p => p.tempId !== item.tempId))} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-colors" title="Descartar"><Trash2 size={16}/></button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
};
