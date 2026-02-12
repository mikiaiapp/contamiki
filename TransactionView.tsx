import React, { useState, useRef, useMemo, useEffect } from 'react';
import { AppState, Transaction, TransactionType, GlobalFilter, FavoriteMovement, RecurrentMovement, RecurrenceFrequency } from './types';
import { Plus, Trash2, Search, ArrowRightLeft, X, Paperclip, ChevronLeft, ChevronRight, Edit3, ArrowUpDown, Tag, Receipt, CheckCircle2, Upload, SortAsc, SortDesc, Heart, Bot, Filter, Eraser, Calendar, Sparkles, ChevronDown, Loader2, Download, MoreVertical, Copy, CalendarClock, Save, Repeat, FileSpreadsheet, FileText } from 'lucide-react';
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

interface ProposedTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  categoryId: string;
  accountId: string;
  type: TransactionType;
  isValidated: boolean;
}

const generateId = () => Math.random().toString(36).substring(2, 15);
const numberFormatter = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Utility para comprimir imágenes
const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
                // Comprimir a JPEG calidad 0.6
                resolve(canvas.toDataURL('image/jpeg', 0.6));
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};

export const TransactionView: React.FC<TransactionViewProps> = ({ 
  data, 
  onAddTransaction, 
  onDeleteTransaction, 
  onUpdateTransaction, 
  onUpdateData, 
  filter, 
  onUpdateFilter, 
  initialSpecificFilters, 
  clearSpecificFilters 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  
  // Form State
  const [fType, setFType] = useState<TransactionType>('EXPENSE');
  const [fAmount, setFAmount] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fDate, setFDate] = useState('');
  const [fAcc, setFAcc] = useState('');
  const [fCat, setFCat] = useState('');
  const [fTransferDest, setFTransferDest] = useState('');
  const [fAttachment, setFAttachment] = useState<string | undefined>(undefined);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- ACTIONS MENU STATE ---
  const [activeMenuTxId, setActiveMenuTxId] = useState<string | null>(null);
  
  // --- RECURRENCE & FAVORITE MODALS STATE ---
  const [recurrenceModalTx, setRecurrenceModalTx] = useState<Transaction | null>(null);
  const [recFreq, setRecFreq] = useState<RecurrenceFrequency>('MONTHLY');
  const [recInterval, setRecInterval] = useState('1');
  
  const [favoriteModalTx, setFavoriteModalTx] = useState<Transaction | null>(null);
  const [favName, setFavName] = useState('');
  const [showFavoritesList, setShowFavoritesList] = useState(false);

  // --- PREVIEW STATE ---
  const [previewAttachment, setPreviewAttachment] = useState<string | null>(null);

  // --- SMART IMPORT STATE ---
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStep, setImportStep] = useState<1 | 2 | 3>(1);
  const [importAccount, setImportAccount] = useState('');
  const [proposedTransactions, setProposedTransactions] = useState<ProposedTransaction[]>([]);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Filters & Sort
  const [colFilterEntry, setColFilterEntry] = useState('ALL');
  const [colFilterDesc, setColFilterDesc] = useState('');
  const [colFilterClip, setColFilterClip] = useState<'ALL' | 'YES' | 'NO'>('ALL');
  const [colFilterExit, setColFilterExit] = useState('ALL');
  const [colFilterAmountOp, setColFilterAmountOp] = useState<AmountOperator>('ALL');
  const [colFilterAmountVal1, setColFilterAmountVal1] = useState('');
  const [sortField, setSortField] = useState<SortField>('DATE');
  const [sortDirection, setSortDirection] = useState<SortDirection>('DESC');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const indices = useMemo(() => {
    const acc = new Map(data.accounts.map(a => [a.id, a]));
    const cat = new Map(data.categories.map(c => [c.id, c]));
    const fam = new Map(data.families.map(f => [f.id, f]));
    const grp = new Map(data.accountGroups.map(g => [g.id, g]));
    return { acc, cat, fam, grp };
  }, [data.accounts, data.categories, data.families, data.accountGroups]);

  // --- DATA PREPARATION FOR SELECTORS ---
  const groupedAccounts = useMemo(() => {
      const sortedGroups = [...data.accountGroups].sort((a, b) => a.name.localeCompare(b.name));
      return sortedGroups.map(group => {
          const accounts = data.accounts
              .filter(a => a.groupId === group.id && (a.active !== false || (editingTx && (editingTx.accountId === a.id || editingTx.transferAccountId === a.id))))
              .sort((a, b) => a.name.localeCompare(b.name));
          return { group, accounts };
      }).filter(g => g.accounts.length > 0);
  }, [data.accountGroups, data.accounts, editingTx]);

  const groupedCategories = useMemo(() => {
      const sortedFamilies = [...data.families].sort((a, b) => a.name.localeCompare(b.name));
      return sortedFamilies.map(family => {
          const categories = data.categories
              .filter(c => c.familyId === family.id && (c.active !== false || (editingTx && editingTx.categoryId === c.id)))
              .sort((a, b) => a.name.localeCompare(b.name));
          return { family, categories };
      }).filter(f => f.categories.length > 0);
  }, [data.families, data.categories, editingTx]);

  // RESET PAGE ON FILTER CHANGE
  useEffect(() => {
      setCurrentPage(1);
  }, [colFilterEntry, colFilterExit, colFilterDesc, colFilterClip, colFilterAmountOp, colFilterAmountVal1, filter]);

  useEffect(() => {
    if (initialSpecificFilters) {
      if (initialSpecificFilters.action === 'NEW' && initialSpecificFilters.categoryId) {
         resetForm();
         const cat = indices.cat.get(initialSpecificFilters.categoryId);
         const fam = cat ? indices.fam.get(cat.familyId) : null;
         setFCat(initialSpecificFilters.categoryId);
         if (fam) setFType(fam.type === 'INCOME' ? 'INCOME' : 'EXPENSE');
         setIsModalOpen(true);
      } else if (initialSpecificFilters.action === 'IMPORT') {
         setImportAccount(data.accounts[0]?.id || '');
         setImportStep(1);
         setIsImportModalOpen(true);
      } else {
          // Lógica Mejorada: Si venimos filtrando por categoría o cuenta, aplicamos el filtro en AMBAS columnas.
          // Junto con la lógica "OR" del filtrado, esto mostrará ingresos y gastos relacionados.
          if (initialSpecificFilters.filterCategory) {
              setColFilterEntry(initialSpecificFilters.filterCategory);
              setColFilterExit(initialSpecificFilters.filterCategory);
          } else if (initialSpecificFilters.filterAccount) {
              setColFilterEntry(initialSpecificFilters.filterAccount);
              setColFilterExit(initialSpecificFilters.filterAccount);
          } else {
              // Fallback por si acaso
              if (initialSpecificFilters.filterCategory) setColFilterEntry(initialSpecificFilters.filterCategory);
              if (initialSpecificFilters.filterAccount) setColFilterExit(initialSpecificFilters.filterAccount);
          }
      }
      if (clearSpecificFilters) clearSpecificFilters();
    }
  }, [initialSpecificFilters, indices, data.accounts]);

  // ... (Helper functions: findSuggestedCategory, handleStartAnalysis, handleFinalImport kept same) ...
  const findSuggestedCategory = (desc: string): string => {
    const text = desc.toLowerCase();
    const match = data.transactions.find(t => t.description.toLowerCase().includes(text));
    if (match) return match.categoryId;
    const catMatch = data.categories.find(c => text.includes(c.name.toLowerCase()));
    if (catMatch) return catMatch.id;
    return '';
  };

  const handleStartAnalysis = (rawData: string) => {
    if (!rawData.trim()) return;
    const lines = rawData.split('\n').filter(l => l.trim());
    const props: ProposedTransaction[] = [];
    lines.forEach(line => {
      // Intenta separar por punto y coma, tabulador o coma (si es CSV simple)
      const parts = line.split(/[;\t]/).map(p => p.trim());
      // Si falla, intenta comas, pero cuidado con las comas en descripciones o decimales
      const effectiveParts = parts.length >= 2 ? parts : line.split(',').map(p => p.trim());

      if (effectiveParts.length < 2) return;
      
      // Asumimos formato: FECHA ; DESCRIPCION ; IMPORTE (opcionalmente)
      // Ajuste heurístico básico
      const dateStr = effectiveParts[0];
      const concept = effectiveParts[1];
      const amountStr = effectiveParts[effectiveParts.length - 1].replace(',', '.'); // Asumimos importe al final
      const amount = parseFloat(amountStr);
      
      if (isNaN(amount)) return; // Si no hay importe válido, saltamos

      props.push({
        id: generateId(),
        // Normalizar fecha si viene DD/MM/YYYY
        date: dateStr.includes('/') ? dateStr.split('/').reverse().join('-') : dateStr,
        description: concept,
        amount: amount,
        accountId: importAccount, // USA LA CUENTA SELECCIONADA
        categoryId: findSuggestedCategory(concept),
        type: amount < 0 ? 'EXPENSE' : 'INCOME',
        isValidated: false
      });
    });
    setProposedTransactions(props);
    setImportStep(3);
  };

  const handleImportFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      
      if (file.name.endsWith('.csv')) {
          reader.onload = (evt) => {
              const text = evt.target?.result as string;
              handleStartAnalysis(text);
          };
          reader.readAsText(file);
      } else {
          // Excel Support
          reader.onload = (evt) => {
              try {
                  const bstr = evt.target?.result;
                  const wb = XLSX.read(bstr, { type: 'binary' });
                  const wsname = wb.SheetNames[0];
                  const ws = wb.Sheets[wsname];
                  // Convertir a CSV para reutilizar la lógica de análisis de texto existente
                  // Usamos ; como delimitador para compatibilidad con nuestra lógica de parsing
                  const csvData = XLSX.utils.sheet_to_csv(ws, { FS: ';' });
                  handleStartAnalysis(csvData);
              } catch (err) {
                  alert("Error leyendo el archivo Excel. Asegúrate de que no esté corrupto.");
                  console.error(err);
              }
          };
          reader.readAsBinaryString(file);
      }
      // Limpiar input
      e.target.value = '';
  };

  const handleFinalImport = () => {
    const validOnes = proposedTransactions.filter(p => !p.isValidated);
    if (validOnes.length === 0) { setIsImportModalOpen(false); return; }
    const newTxs: Transaction[] = validOnes.map(p => ({
      id: generateId(),
      date: p.date,
      amount: p.amount,
      description: p.description,
      accountId: p.accountId, // Ya viene asignado desde el paso 1
      type: p.type,
      categoryId: p.categoryId,
      familyId: indices.cat.get(p.categoryId)?.familyId || ''
    }));
    onUpdateData({ transactions: [...newTxs, ...data.transactions] });
    setIsImportModalOpen(false);
    resetForm();
  };

  // USAR FAVORITO
  const handleUseFavorite = (fav: FavoriteMovement) => {
      setEditingTx(null);
      setFType(fav.type);
      setFAmount(fav.amount ? fav.amount.toString() : '');
      setFDesc(fav.description);
      setFDate(new Date().toISOString().split('T')[0]);
      setFAcc(fav.accountId);
      setFCat(fav.categoryId);
      setFTransferDest(fav.transferAccountId || '');
      setFAttachment(undefined);
      setShowFavoritesList(false);
      setIsModalOpen(true);
  };

  const timeFilteredList = useMemo(() => {
    const y = filter.referenceDate.getFullYear();
    const m = filter.referenceDate.getMonth();
    let start = '', end = '';
    if (filter.timeRange === 'MONTH') {
      start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      end = `${y}-${String(m + 1).padStart(2, '0')}-${new Date(y, m + 1, 0).getDate()}`;
    } else if (filter.timeRange === 'YEAR') {
      start = `${y}-01-01`; end = `${y}-12-31`;
    } else if (filter.timeRange === 'CUSTOM') {
      start = filter.customStart || '1900-01-01'; end = filter.customEnd || '2100-12-31';
    }
    return data.transactions.filter(t => filter.timeRange === 'ALL' || (t.date >= start && t.date <= end));
  }, [data.transactions, filter]);

  const activeDropdownOptions = useMemo(() => {
    const entryIds = new Set<string>();
    const exitIds = new Set<string>();

    timeFilteredList.forEach(t => {
      if (t.type === 'EXPENSE') entryIds.add(t.categoryId);
      else if (t.type === 'INCOME') entryIds.add(t.accountId);
      else if (t.type === 'TRANSFER' && t.transferAccountId) entryIds.add(t.transferAccountId);

      if (t.type === 'EXPENSE') exitIds.add(t.accountId);
      else if (t.type === 'INCOME') exitIds.add(t.categoryId);
      else if (t.type === 'TRANSFER') exitIds.add(t.accountId);
    });

    const buildGroupedOptions = (ids: Set<string>) => {
      const groupsMap = new Map<string, { label: string, options: { id: string, name: string }[] }>();

      ids.forEach(id => {
        let groupLabel = 'Otros';
        let itemName = 'Desconocido';

        if (indices.cat.has(id)) {
          const cat = indices.cat.get(id)!;
          itemName = cat.name;
          const fam = indices.fam.get(cat.familyId);
          groupLabel = fam ? `Fam: ${fam.name}` : 'Sin Familia';
        } else if (indices.acc.has(id)) {
          const acc = indices.acc.get(id)!;
          itemName = acc.name;
          const grp = indices.grp.get(acc.groupId);
          groupLabel = grp ? `Grp: ${grp.name}` : 'Sin Grupo';
        }

        if (!groupsMap.has(groupLabel)) {
          groupsMap.set(groupLabel, { label: groupLabel, options: [] });
        }
        groupsMap.get(groupLabel)!.options.push({ id, name: itemName });
      });

      const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => a.label.localeCompare(b.label));
      sortedGroups.forEach(g => g.options.sort((a, b) => a.name.localeCompare(b.name)));
      
      return sortedGroups;
    };

    return {
      entryGroups: buildGroupedOptions(entryIds),
      exitGroups: buildGroupedOptions(exitIds)
    };
  }, [timeFilteredList, indices]);

  const filteredList = useMemo(() => {
    const descPattern = colFilterDesc.trim().toLowerCase();
    const v1 = parseFloat(colFilterAmountVal1);
    return timeFilteredList.filter(t => {
      // LOGICA DE COLUMNAS DEBE / HABER EN MODO "OR"
      const hasEntryFilter = colFilterEntry !== 'ALL';
      const hasExitFilter = colFilterExit !== 'ALL';

      // Si hay algún filtro de columna activo, evaluamos.
      if (hasEntryFilter || hasExitFilter) {
          let matchEntry = false;
          let matchExit = false;

          // Helper para comprobar si un ID participa en la transacción en cualquier rol
          const isIdInTransaction = (id: string, tx: Transaction) => {
              return tx.accountId === id || 
                     tx.categoryId === id || 
                     (tx.type === 'TRANSFER' && tx.transferAccountId === id);
          };

          if (hasEntryFilter) {
             if (isIdInTransaction(colFilterEntry, t)) matchEntry = true;
          }

          if (hasExitFilter) {
             if (isIdInTransaction(colFilterExit, t)) matchExit = true;
          }

          // La lógica es OR: Debe coincidir en entrada O en salida.
          // Si solo hay filtro de entrada, matchExit será false, y viceversa.
          // Si ambos filtros están puestos, basta con que uno coincida.
          if (!matchEntry && !matchExit) return false;
      }

      if (descPattern && !t.description.toLowerCase().includes(descPattern)) return false;
      if (colFilterClip === 'YES' && !t.attachment) return false;
      if (colFilterClip === 'NO' && t.attachment) return false;
      if (colFilterAmountOp !== 'ALL' && !isNaN(v1)) {
        const val = Math.abs(t.amount);
        if (colFilterAmountOp === 'GT' && val <= v1) return false;
        if (colFilterAmountOp === 'LT' && val >= v1) return false;
        if (colFilterAmountOp === 'EQ' && Math.abs(val - v1) > 0.01) return false;
      }
      return true;
    });
  }, [timeFilteredList, colFilterEntry, colFilterExit, colFilterDesc, colFilterClip, colFilterAmountOp, colFilterAmountVal1]);

  const sortedTransactions = useMemo(() => {
    return [...filteredList].sort((a, b) => {
      let vA: any, vB: any;
      if (sortField === 'DATE') { vA = a.date; vB = b.date; }
      else if (sortField === 'DESCRIPTION') { vA = a.description.toLowerCase(); vB = b.description.toLowerCase(); }
      else if (sortField === 'AMOUNT') { vA = Math.abs(a.amount); vB = Math.abs(b.amount); }
      else if (sortField === 'CATEGORY' || sortField === 'ACCOUNT') { 
         vA = a.description; vB = b.description; 
      }
      if (vA < vB) return sortDirection === 'ASC' ? -1 : 1;
      if (vA > vB) return sortDirection === 'ASC' ? 1 : -1;
      return 0;
    });
  }, [filteredList, sortField, sortDirection]);

  const totalItems = sortedTransactions.length;
  const totalPages = itemsPerPage === -1 ? 1 : Math.ceil(totalItems / itemsPerPage);

  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return itemsPerPage === -1 ? sortedTransactions : sortedTransactions.slice(start, start + itemsPerPage);
  }, [sortedTransactions, currentPage, itemsPerPage]);

  const activeFiltersChips = useMemo(() => {
    const chips: { id: string, label: string, onRemove: () => void }[] = [];
    if (colFilterEntry !== 'ALL') {
        const name = indices.cat.get(colFilterEntry)?.name || indices.acc.get(colFilterEntry)?.name || '...';
        chips.push({ id: 'entry', label: `Filtro: ${name}`, onRemove: () => setColFilterEntry('ALL') });
    }
    if (colFilterExit !== 'ALL') {
        const name = indices.cat.get(colFilterExit)?.name || indices.acc.get(colFilterExit)?.name || '...';
        chips.push({ id: 'exit', label: `Filtro: ${name}`, onRemove: () => setColFilterExit('ALL') });
    }
    if (colFilterDesc) chips.push({ id: 'desc', label: `Texto: "${colFilterDesc}"`, onRemove: () => setColFilterDesc('') });
    if (colFilterClip !== 'ALL') chips.push({ id: 'clip', label: `Clip: ${colFilterClip}`, onRemove: () => setColFilterClip('ALL') });
    if (colFilterAmountOp !== 'ALL') chips.push({ id: 'amount', label: `Imp: ${colFilterAmountOp}`, onRemove: () => setColFilterAmountOp('ALL') });
    return chips;
  }, [colFilterEntry, colFilterExit, colFilterDesc, colFilterClip, colFilterAmountOp, indices]);

  const clearAllFilters = () => { setColFilterEntry('ALL'); setColFilterDesc(''); setColFilterClip('ALL'); setColFilterExit('ALL'); setColFilterAmountOp('ALL'); setColFilterAmountVal1(''); };
  const resetForm = () => { setEditingTx(null); setFType('EXPENSE'); setFAmount(''); setFDesc(''); setFDate(new Date().toISOString().split('T')[0]); setFAcc(data.accounts[0]?.id || ''); setFCat(''); setFTransferDest(''); setFAttachment(undefined); };
  
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

  // ACTIONS LOGIC
  const handleDuplicate = (t: Transaction) => {
      // Abre el editor con los datos pero SIN ID (creará uno nuevo)
      setEditingTx(null); 
      setFType(t.type); 
      setFAmount(Math.abs(t.amount).toString()); 
      setFDesc(t.description + ' (Copia)'); 
      setFDate(new Date().toISOString().split('T')[0]); // Fecha hoy por defecto
      setFAcc(t.accountId); 
      setFCat(t.categoryId); 
      setFTransferDest(t.transferAccountId || ''); 
      setFAttachment(t.attachment);
      setActiveMenuTxId(null);
      setIsModalOpen(true);
  };

  const handleSaveRecurrent = () => {
      if (!recurrenceModalTx) return;
      const t = recurrenceModalTx;
      const newRec: RecurrentMovement = {
          id: generateId(),
          description: t.description,
          amount: t.amount,
          type: t.type,
          accountId: t.accountId,
          transferAccountId: t.transferAccountId,
          familyId: t.familyId,
          categoryId: t.categoryId,
          frequency: recFreq,
          interval: parseInt(recInterval) || 1,
          startDate: t.date,
          nextDueDate: t.date,
          active: true
      };
      onUpdateData({ recurrents: [...(data.recurrents || []), newRec] });
      setRecurrenceModalTx(null);
  };

  const handleSaveFavorite = () => {
      if (!favoriteModalTx || !favName) return;
      const t = favoriteModalTx;
      const newFav: FavoriteMovement = {
          id: generateId(),
          name: favName,
          description: t.description,
          amount: Math.abs(t.amount),
          type: t.type,
          accountId: t.accountId,
          transferAccountId: t.transferAccountId,
          categoryId: t.categoryId,
          familyId: t.familyId,
          icon: '⭐'
      };
      onUpdateData({ favorites: [...(data.favorites || []), newFav] });
      setFavoriteModalTx(null);
      setFavName('');
  };

  const handleSave = () => { if (!fAmount || !fDesc || !fAcc || (fType !== 'TRANSFER' && !fCat)) return; let amt = Math.abs(parseFloat(fAmount)); if (fType === 'EXPENSE' || fType === 'TRANSFER') amt = -amt; const cat = indices.cat.get(fCat); const tx: Transaction = { id: editingTx ? editingTx.id : generateId(), date: fDate, amount: amt, description: fDesc, accountId: fAcc, type: fType, categoryId: fCat, familyId: cat?.familyId || '', attachment: fAttachment, transferAccountId: fType === 'TRANSFER' ? fTransferDest : undefined }; if (editingTx) onUpdateTransaction(tx); else onAddTransaction(tx); setIsModalOpen(false); resetForm(); };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setIsCompressing(true);
          try {
              const compressed = await compressImage(file);
              setFAttachment(compressed);
          } catch (err) {
              console.error("Compression error", err);
          } finally {
              setIsCompressing(false);
          }
      }
  };

  const formatDateDisplay = (dateStr: string) => { if (!dateStr) return '--/--/--'; const [y, m, d] = dateStr.split('-'); return `${d}/${m}/${y.slice(-2)}`; };
  const formatCurrency = (amount: number) => `${numberFormatter.format(amount)} €`;
  
  const getAmountColor = (amount: number, type?: TransactionType) => {
      if (type === 'TRANSFER') return 'text-slate-900';
      return amount > 0 ? 'text-emerald-600' : amount < 0 ? 'text-rose-600' : 'text-slate-400';
  };

  const renderIcon = (iconStr: string, className = "w-4 h-4") => { if (iconStr?.startsWith('http') || iconStr?.startsWith('data:image')) return <img src={iconStr} className={`${className} object-contain rounded-lg`} referrerPolicy="no-referrer" />; return <span className="text-xs">{iconStr || '📂'}</span>; }
  
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={8} className="opacity-40" />;
    return sortDirection === 'ASC' ? <SortAsc size={8} className="text-indigo-600" /> : <SortDesc size={8} className="text-indigo-600" />;
  };

  const navigatePeriod = (direction: 'prev' | 'next') => {
    const newDate = new Date(filter.referenceDate);
    const step = direction === 'next' ? 1 : -1;
    if (filter.timeRange === 'MONTH') newDate.setMonth(newDate.getMonth() + step);
    else if (filter.timeRange === 'YEAR') newDate.setFullYear(newDate.getFullYear() + step);
    onUpdateFilter({ ...filter, referenceDate: newDate });
  };

  const years = Array.from({length: new Date().getFullYear() - 2015 + 5}, (_, i) => 2015 + i);
  const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  // Ajustado gridClasses para mover columna menú al final
  const gridClasses = "grid grid-cols-[52px_1fr_1.2fr_12px_1fr_50px_20px] md:grid-cols-[90px_1fr_1.5fr_40px_1fr_80px_40px] gap-1 md:gap-4 items-center";

  return (
    <div className="space-y-6 md:space-y-10 pb-24 animate-in fade-in duration-500" onClick={() => setActiveMenuTxId(null)}>
      {/* CABECERA PRINCIPAL */}
      <div className="flex flex-col xl:flex-row justify-between xl:items-end gap-8 print:hidden">
        <div className="space-y-4 text-center md:text-left w-full xl:w-auto">
          <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter">Diario.</h2>
          <div className="flex flex-col sm:flex-row items-center gap-3 justify-center md:justify-start">
            <div className="flex items-center gap-1">
              <button onClick={() => navigatePeriod('prev')} className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm active:scale-90 transition-all"><ChevronLeft size={24} /></button>
              <button onClick={() => navigatePeriod('next')} className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm active:scale-90 transition-all"><ChevronRight size={24} /></button>
            </div>

            <div className="bg-slate-100 p-2 rounded-2xl flex flex-wrap gap-1 shadow-inner border border-slate-200/50">
                    <button onClick={() => onUpdateFilter({...filter, timeRange: 'ALL'})} className={`px-6 py-3 text-xs sm:text-sm font-black uppercase tracking-widest rounded-xl transition-all ${filter.timeRange === 'ALL' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Todo</button>
                    <div className={`px-5 py-3 rounded-xl transition-all flex items-center ${filter.timeRange === 'YEAR' ? 'bg-white shadow-sm' : ''}`}>
                         {filter.timeRange === 'YEAR' ? (<select className="bg-transparent text-xs sm:text-sm font-black text-indigo-600 uppercase tracking-widest outline-none cursor-pointer py-1 min-w-[60px]" value={filter.referenceDate.getFullYear()} onChange={(e) => { const d = new Date(filter.referenceDate); d.setFullYear(parseInt(e.target.value)); onUpdateFilter({...filter, timeRange: 'YEAR', referenceDate: d}); }}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select>) : (<button onClick={() => onUpdateFilter({...filter, timeRange: 'YEAR'})} className="px-2 text-xs sm:text-sm font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">Año</button>)}
                    </div>
                    <div className={`px-5 py-3 rounded-xl transition-all flex items-center gap-1 ${filter.timeRange === 'MONTH' ? 'bg-white shadow-sm' : ''}`}>
                        {filter.timeRange === 'MONTH' ? (<div className="flex items-center gap-2"><select className="bg-transparent text-xs sm:text-sm font-black text-indigo-600 uppercase tracking-widest outline-none cursor-pointer py-1 min-w-[80px]" value={filter.referenceDate.getMonth()} onChange={(e) => { const d = new Date(filter.referenceDate); d.setMonth(parseInt(e.target.value)); onUpdateFilter({...filter, timeRange: 'MONTH', referenceDate: d}); }}>{months.map((m, i) => <option key={i} value={i}>{m}</option>)}</select><span className="text-slate-300 text-xs font-black">/</span><select className="bg-transparent text-xs sm:text-sm font-black text-indigo-600 uppercase tracking-widest outline-none cursor-pointer py-1 min-w-[70px]" value={filter.referenceDate.getFullYear()} onChange={(e) => { const d = new Date(filter.referenceDate); d.setFullYear(parseInt(e.target.value)); onUpdateFilter({...filter, timeRange: 'MONTH', referenceDate: d}); }}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select></div>) : (<button onClick={() => onUpdateFilter({...filter, timeRange: 'MONTH'})} className="px-2 text-xs sm:text-sm font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">Mes</button>)}
                    </div>
                    <div className={`px-5 py-3 rounded-xl transition-all flex items-center gap-2 ${filter.timeRange === 'CUSTOM' ? 'bg-white shadow-sm' : ''}`}>
                        {filter.timeRange === 'CUSTOM' ? (<div className="flex items-center gap-2"><input type="date" className="bg-transparent text-xs sm:text-sm font-bold text-slate-700 outline-none w-28 sm:w-32 cursor-pointer py-1" value={filter.customStart} onChange={(e) => onUpdateFilter({...filter, timeRange: 'CUSTOM', customStart: e.target.value})} /><span className="text-slate-300 text-[10px] font-black">➡</span><input type="date" className="bg-transparent text-xs sm:text-sm font-bold text-slate-700 outline-none w-28 sm:w-32 cursor-pointer py-1" value={filter.customEnd} onChange={(e) => onUpdateFilter({...filter, timeRange: 'CUSTOM', customEnd: e.target.value})} /></div>) : (<button onClick={() => onUpdateFilter({...filter, timeRange: 'CUSTOM'})} className="px-2 text-xs sm:text-sm font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">Pers.</button>)}
                    </div>
            </div>

             <div className="flex gap-2">
                {/* FAVORITOS BUTTON */}
                <div className="relative">
                    <button 
                        onClick={() => setShowFavoritesList(!showFavoritesList)} 
                        className="w-12 h-12 bg-amber-50 text-amber-600 border border-amber-100 rounded-xl shadow-sm hover:bg-amber-100 flex items-center justify-center transition-all active:scale-95"
                        title="Favoritos"
                    >
                        <Heart size={20} fill={showFavoritesList ? "currentColor" : "none"} />
                    </button>
                    {showFavoritesList && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowFavoritesList(false)}></div>
                            <div className="absolute top-full right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 w-64 p-2 z-20 animate-in fade-in zoom-in duration-200 origin-top-right">
                                <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Plantillas Rápidas</div>
                                <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-1">
                                    {data.favorites && data.favorites.length > 0 ? (
                                        data.favorites.map(fav => (
                                            <button 
                                                key={fav.id} 
                                                onClick={() => handleUseFavorite(fav)}
                                                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-amber-50 text-left transition-colors group"
                                            >
                                                <div className="bg-amber-100 text-amber-600 p-1.5 rounded-lg group-hover:bg-amber-200 transition-colors">
                                                    {renderIcon(fav.icon || '⭐', "w-4 h-4")}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-bold text-slate-700 truncate">{fav.name}</div>
                                                    <div className="text-[9px] text-slate-400 font-medium truncate">{fav.description}</div>
                                                </div>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="p-4 text-center text-slate-400 text-xs">No hay favoritos. Créalos desde el menú de acciones de un movimiento.</div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <button 
                    onClick={(e) => { e.stopPropagation(); setImportAccount(data.accounts[0]?.id || ''); setImportStep(1); setIsImportModalOpen(true); }} 
                    className="w-12 h-12 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl shadow-sm hover:bg-indigo-100 flex items-center justify-center transition-all active:scale-95"
                    title="Importador Inteligente"
                >
                    <Bot size={20} />
                </button>
                
                <button 
                    onClick={() => openEditor()} 
                    className="w-12 h-12 bg-slate-950 text-white rounded-xl shadow-lg hover:bg-slate-800 flex items-center justify-center transition-all active:scale-95"
                    title="Nuevo Movimiento"
                >
                    <Plus size={20} />
                </button>
            </div>
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS ACTIVA */}
      {activeFiltersChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 px-6 bg-white rounded-2xl border border-slate-100 shadow-sm mt-4">
          <span className="text-[9px] font-black text-slate-400 uppercase mr-2 flex items-center gap-1"><Filter size={12}/> Filtros:</span>
          {activeFiltersChips.map(c => (
            <div key={c.id} className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
              <span className="text-[9px] font-black text-indigo-600 uppercase">{c.label}</span>
              <button onClick={c.onRemove} className="text-indigo-300 hover:text-rose-500"><X size={12}/></button>
            </div>
          ))}
          <button onClick={clearAllFilters} className="ml-auto text-rose-500 text-[9px] font-black uppercase flex items-center gap-1"><Eraser size={12}/> Limpiar</button>
        </div>
      )}

      {/* CABECERA DE FILTROS */}
      <div className={`bg-slate-900/5 p-2 md:p-4 rounded-2xl border border-slate-100 ${gridClasses}`}>
          <div className="flex flex-col items-center justify-center">
              <button onClick={() => { if(sortField==='DATE') setSortDirection(sortDirection==='ASC'?'DESC':'ASC'); else setSortField('DATE'); }} className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest inline-flex items-center gap-0.5">Fec <SortIcon field="DATE"/></button>
          </div>
          <div className="flex flex-col">
              <span className="hidden md:block text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Filtro A</span>
              <select className="w-full bg-white border border-slate-200 rounded-lg text-[8px] md:text-[11px] font-bold py-0.5 md:py-1 outline-none truncate" value={colFilterEntry} onChange={e => setColFilterEntry(e.target.value)}>
                  <option value="ALL">Todo</option>
                  {activeDropdownOptions.entryGroups.map(group => (
                    <optgroup key={group.label} label={group.label}>
                        {group.options.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                    </optgroup>
                  ))}
              </select>
          </div>
          <div className="flex flex-col">
              <span className="hidden md:block text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Concepto</span>
              <input type="text" className="w-full bg-white border border-slate-200 rounded-lg text-[8px] md:text-[11px] font-bold py-0.5 md:py-1 px-1 md:px-2 outline-none" placeholder="..." value={colFilterDesc} onChange={e => setColFilterDesc(e.target.value)} />
          </div>
          <div className="flex flex-col">
              <span className="hidden md:block text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Clip</span>
              <select className="bg-white border border-slate-200 rounded-lg text-[8px] md:text-[11px] font-black uppercase py-0.5 md:py-1 outline-none" value={colFilterClip} onChange={e => setColFilterClip(e.target.value as any)}><option value="ALL">.</option><option value="YES">SI</option><option value="NO">NO</option></select>
          </div>
          <div className="flex flex-col">
              <span className="hidden md:block text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Filtro B</span>
              <select className="w-full bg-white border border-slate-200 rounded-lg text-[8px] md:text-[11px] font-bold py-0.5 md:py-1 outline-none truncate" value={colFilterExit} onChange={e => setColFilterExit(e.target.value)}>
                  <option value="ALL">Todo</option>
                  {activeDropdownOptions.exitGroups.map(group => (
                    <optgroup key={group.label} label={group.label}>
                        {group.options.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                    </optgroup>
                  ))}
              </select>
          </div>
          <div className="flex flex-col">
              <button onClick={() => { if(sortField==='AMOUNT') setSortDirection(sortDirection==='ASC'?'DESC':'ASC'); else setSortField('AMOUNT'); }} className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-end gap-0.5">Imp <SortIcon field="AMOUNT"/></button>
              <select className="bg-white border border-slate-200 rounded-lg text-[8px] md:text-[11px] font-black uppercase py-0.5 md:py-1 outline-none text-right" value={colFilterAmountOp} onChange={e => setColFilterAmountOp(e.target.value as any)}><option value="ALL">...</option><option value="GT">{">"}</option><option value="LT">{"<"}</option></select>
          </div>
           <div className="flex justify-center">
              <button onClick={clearAllFilters} className="text-slate-300 hover:text-rose-500 transition-colors p-1"><Eraser size={14}/></button>
          </div>
      </div>

      {/* LISTADO DE MOVIMIENTOS */}
      <div className="space-y-1.5 md:space-y-2.5">
        {paginatedTransactions.map(t => {
          const srcAcc = indices.acc.get(t.accountId);
          const dstAcc = t.transferAccountId ? indices.acc.get(t.transferAccountId) : null;
          const cat = indices.cat.get(t.categoryId);
          
          let debitNode, creditNode;
          let debitId = '', creditId = '';
          
          let typeColorClass = 'text-slate-900'; 
          if (t.type === 'EXPENSE') typeColorClass = 'text-rose-600';
          else if (t.type === 'INCOME') typeColorClass = 'text-emerald-600';

          if (t.type === 'TRANSFER') {
            debitId = t.transferAccountId || '';
            creditId = t.accountId;
            debitNode = <div className={`flex items-center gap-1 font-bold truncate leading-none cursor-pointer hover:underline ${typeColorClass}`} onClick={(e) => {e.stopPropagation(); setColFilterEntry(debitId);}}>{renderIcon(dstAcc?.icon || '🏦')} <span className="truncate">{dstAcc?.name}</span></div>;
            creditNode = <div className={`flex items-center gap-1 font-bold truncate leading-none cursor-pointer hover:underline ${typeColorClass}`} onClick={(e) => {e.stopPropagation(); setColFilterExit(creditId);}}>{renderIcon(srcAcc?.icon || '🏦')} <span className="truncate">{srcAcc?.name}</span></div>;
          } else if (t.type === 'INCOME') {
            debitId = t.accountId;
            creditId = t.categoryId;
            debitNode = <div className={`flex items-center gap-1 font-bold truncate leading-none cursor-pointer hover:underline ${typeColorClass}`} onClick={(e) => {e.stopPropagation(); setColFilterEntry(debitId);}}>{renderIcon(srcAcc?.icon || '🏦')} <span className="truncate">{srcAcc?.name}</span></div>;
            creditNode = <div className={`flex items-center gap-1 font-bold truncate leading-none cursor-pointer hover:underline ${typeColorClass}`} onClick={(e) => {e.stopPropagation(); setColFilterExit(creditId);}}>{renderIcon(cat?.icon || '🏷️')} <span className="truncate">{cat?.name || 'S/C'}</span></div>;
          } else {
            debitId = t.categoryId;
            creditId = t.accountId;
            debitNode = <div className={`flex items-center gap-1 font-bold truncate leading-none cursor-pointer hover:underline ${typeColorClass}`} onClick={(e) => {e.stopPropagation(); setColFilterEntry(debitId);}}>{renderIcon(cat?.icon || '🏷️')} <span className="truncate">{cat?.name}</span></div>;
            creditNode = <div className={`flex items-center gap-1 font-bold truncate leading-none cursor-pointer hover:underline ${typeColorClass}`} onClick={(e) => {e.stopPropagation(); setColFilterExit(creditId);}}>{renderIcon(srcAcc?.icon || '🏦')} <span className="truncate">{srcAcc?.name}</span></div>;
          }

          return (
            <div key={t.id} className="group bg-white p-2 md:p-4 md:px-6 rounded-2xl border border-slate-100 hover:shadow-lg transition-all relative">
                <div className={gridClasses}>
                    <div className="text-left text-[8px] md:text-sm font-black text-slate-400 uppercase tracking-tighter leading-none truncate">
                        {formatDateDisplay(t.date)}
                    </div>
                    <div className="min-w-0 text-[8px] md:text-sm">{debitNode}</div>
                    <div className="min-w-0 text-[8px] md:text-sm font-bold text-slate-800 uppercase truncate leading-tight cursor-pointer hover:text-indigo-600" onClick={(e) => {e.stopPropagation(); setColFilterDesc(t.description);}}>
                        {t.description}
                    </div>
                    <div className="flex justify-center">
                        {t.attachment ? (
                            <button 
                                onClick={(e) => { e.stopPropagation(); setPreviewAttachment(t.attachment || null); }}
                                className="p-1 hover:bg-indigo-50 rounded-full text-indigo-500 transition-colors"
                            >
                                <Paperclip size={12} className="md:size-4"/>
                            </button>
                        ) : <div className="w-1 md:w-2" />}
                    </div>
                    <div className="min-w-0 text-[8px] md:text-sm">{creditNode}</div>
                    
                    <div className={`text-right text-[9px] md:text-base font-black font-mono tracking-tighter truncate ${getAmountColor(t.amount, t.type)}`}>
                        {formatCurrency(t.amount)}
                    </div>

                     {/* MENÚ DE ACCIONES */}
                     <div className="flex justify-center relative">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setActiveMenuTxId(activeMenuTxId === t.id ? null : t.id); }} 
                            className="p-1.5 md:p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                            <MoreVertical size={16} />
                        </button>
                        
                        {activeMenuTxId === t.id && (
                            <div className="absolute top-8 right-0 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 min-w-[180px] p-2 flex flex-col gap-1 animate-in fade-in zoom-in duration-200 origin-top-right" onClick={e => e.stopPropagation()}>
                                <button onClick={() => { setActiveMenuTxId(null); openEditor(t); }} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl text-left transition-colors">
                                    <Edit3 size={14} className="text-indigo-600"/> <span className="text-[10px] font-bold text-slate-600 uppercase">Editar</span>
                                </button>
                                <button onClick={() => handleDuplicate(t)} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl text-left transition-colors">
                                    <Copy size={14} className="text-slate-500"/> <span className="text-[10px] font-bold text-slate-600 uppercase">Duplicar</span>
                                </button>
                                <button onClick={() => { setActiveMenuTxId(null); setRecurrenceModalTx(t); }} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl text-left transition-colors">
                                    <Repeat size={14} className="text-emerald-500"/> <span className="text-[10px] font-bold text-slate-600 uppercase">Hacer Recurrente</span>
                                </button>
                                <button onClick={() => { setActiveMenuTxId(null); setFavoriteModalTx(t); setFavName(t.description); }} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl text-left transition-colors">
                                    <Heart size={14} className="text-amber-500"/> <span className="text-[10px] font-bold text-slate-600 uppercase">Guardar Favorito</span>
                                </button>
                                <div className="h-px bg-slate-100 my-1"/>
                                <button onClick={() => { setActiveMenuTxId(null); setDeleteConfirmId(t.id); }} className="flex items-center gap-3 px-3 py-2.5 hover:bg-rose-50 rounded-xl text-left transition-colors text-rose-500">
                                    <Trash2 size={14} /> <span className="text-[10px] font-bold uppercase">Borrar</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {deleteConfirmId === t.id && (
                    <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-10 flex items-center justify-center gap-4 animate-in zoom-in-95 p-4 text-center">
                        <p className="text-[10px] md:text-sm font-black uppercase text-slate-900">¿Borrar?</p>
                        <div className="flex gap-2">
                            <button onClick={() => { onDeleteTransaction(t.id); setDeleteConfirmId(null); }} className="bg-rose-600 text-white px-3 py-1 md:px-5 md:py-2 rounded-xl font-black text-[9px] uppercase shadow-xl">Sí</button>
                            <button onClick={() => setDeleteConfirmId(null)} className="bg-slate-100 text-slate-500 px-3 py-1 md:px-5 md:py-2 rounded-xl font-black text-[9px] uppercase">No</button>
                        </div>
                    </div>
                )}
            </div>
          );
        })}
      </div>

      {/* PAGINACIÓN */}
      {totalItems > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Mostrando {paginatedTransactions.length} de {totalItems} movimientos
            </span>
            
            <div className="flex items-center gap-4">
                <select 
                    className="bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase py-2 px-3 outline-none"
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(parseInt(e.target.value))}
                >
                    <option value={25}>25 por pág</option>
                    <option value={50}>50 por pág</option>
                    <option value={100}>100 por pág</option>
                    <option value={-1}>Ver Todos</option>
                </select>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                        Pág {currentPage} / {totalPages}
                    </span>
                    <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* MODAL SMART IMPORT MEJORADO */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[200] p-4 animate-in fade-in duration-500" onClick={() => setIsImportModalOpen(false)}>
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl p-8 sm:p-12 relative max-h-[95vh] overflow-y-auto custom-scrollbar border border-white/20" onClick={e => e.stopPropagation()}>
            <button onClick={() => setIsImportModalOpen(false)} className="absolute top-8 right-8 p-3 bg-slate-50 text-slate-400 rounded-full hover:text-rose-500"><X size={24}/></button>
            <div className="flex items-center gap-4 mb-8">
                <div className="bg-indigo-600 p-4 rounded-3xl text-white shadow-xl shadow-indigo-600/20"><Bot size={28} /></div>
                <div><h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Importación Inteligente</h3><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Carga masiva con categorización automática</p></div>
            </div>

            {importStep === 1 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">1. ¿A qué cuenta imputamos los movimientos?</label>
                        <select 
                            className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none text-slate-800 focus:border-indigo-500" 
                            value={importAccount} 
                            onChange={e => setImportAccount(e.target.value)}
                        >
                            {groupedAccounts.map(g => (
                                <optgroup key={g.group.id} label={g.group.name}>
                                    {g.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </optgroup>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">2. Copia y Pega tus movimientos</label>
                        <textarea 
                            className="w-full h-40 p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] font-mono text-xs outline-none focus:border-indigo-500 transition-all resize-none shadow-inner" 
                            placeholder={`Formato esperado:\nDD/MM/AAAA; Concepto del movimiento; -50,00\nDD/MM/AAAA; Ingreso de Nómina; 1500,00\n...`}
                            onBlur={(e) => handleStartAnalysis(e.target.value)}
                        />
                        <p className="text-[10px] text-slate-400 font-medium pl-2">El sistema detectará automáticamente fecha, concepto e importe. Usa punto y coma (;) o tabuladores para separar.</p>
                    </div>

                    <div className="relative flex items-center justify-center py-4">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                        <span className="relative bg-white px-4 text-[10px] font-black uppercase text-slate-300">O sube un archivo</span>
                    </div>

                    <div className="space-y-4">
                        <button onClick={() => importFileRef.current?.click()} className="w-full py-5 bg-white border-2 border-dashed border-indigo-200 text-indigo-500 rounded-3xl font-black uppercase text-[11px] tracking-widest hover:bg-indigo-50 transition-all flex flex-col items-center justify-center gap-2 group">
                            <Upload size={24} className="group-hover:scale-110 transition-transform"/>
                            <span>Subir Excel (.xlsx) o CSV</span>
                        </button>
                        <input type="file" ref={importFileRef} className="hidden" accept=".csv, .xlsx" onChange={handleImportFileUpload} />
                    </div>
                </div>
            )}

            {importStep === 3 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                    <div className="flex justify-between items-center px-2">
                        <span className="text-xs font-bold text-slate-500 uppercase">Revisión ({proposedTransactions.length})</span>
                        <div className="flex gap-2">
                            <button onClick={() => { setProposedTransactions([]); setImportStep(1); }} className="text-[10px] font-black uppercase text-rose-500 hover:underline">Descartar Todo</button>
                        </div>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto custom-scrollbar space-y-2 pr-2">
                        {proposedTransactions.map((t, idx) => (
                            <div key={idx} className={`p-4 rounded-2xl flex items-center gap-4 ${t.isValidated ? 'bg-emerald-50 border border-emerald-100 opacity-50' : 'bg-slate-50 border border-slate-100'}`}>
                                <button onClick={() => { const newArr = [...proposedTransactions]; newArr[idx].isValidated = !newArr[idx].isValidated; setProposedTransactions(newArr); }} className={`p-2 rounded-full transition-colors ${t.isValidated ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-300 hover:text-indigo-500 shadow-sm'}`}><CheckCircle2 size={18}/></button>
                                <div className="flex-1 min-w-0 grid grid-cols-12 gap-4 items-center">
                                    <div className="col-span-2 text-[10px] font-bold text-slate-500">{t.date}</div>
                                    <div className="col-span-5 text-xs font-bold text-slate-800 truncate" title={t.description}>{t.description}</div>
                                    <div className={`col-span-2 text-xs font-black text-right ${getAmountColor(t.amount, t.type)}`}>{formatCurrency(t.amount)}</div>
                                    <div className="col-span-3">
                                        <select 
                                            className="w-full bg-white border border-slate-200 rounded-lg text-[9px] font-bold py-1.5 px-2 outline-none"
                                            value={t.categoryId}
                                            onChange={(e) => { const newArr = [...proposedTransactions]; newArr[idx].categoryId = e.target.value; setProposedTransactions(newArr); }}
                                        >
                                            <option value="">Sin Categoría</option>
                                            {groupedCategories.map(f => (
                                                <optgroup key={f.family.id} label={f.family.name}>
                                                    {f.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                </optgroup>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <button onClick={() => setProposedTransactions(proposedTransactions.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-rose-500"><X size={16}/></button>
                            </div>
                        ))}
                    </div>
                    <button onClick={handleFinalImport} className="w-full py-6 bg-slate-950 text-white rounded-[2rem] font-black uppercase text-[12px] tracking-widest shadow-2xl hover:bg-emerald-600 transition-all">Confirmar Importación</button>
                </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL EDITOR NORMAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[200] p-4 animate-in fade-in duration-500" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl p-8 sm:p-12 relative max-h-[95vh] overflow-y-auto custom-scrollbar border border-white/20">
            <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="absolute top-8 right-8 p-3 bg-slate-50 text-slate-400 rounded-full hover:text-rose-500"><X size={24}/></button>
            <div className="flex items-center gap-4 mb-10">
              <div className="bg-indigo-600 p-4 rounded-3xl text-white shadow-xl shadow-indigo-600/20"><Receipt size={28} /></div>
              <div><h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">{editingTx ? 'Editar' : 'Nuevo'}</h3><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Asiento Diario</p></div>
            </div>
            {/* ... Resto del contenido del modal editor ... */}
            <div className="space-y-8">
              <div className="bg-slate-100 p-2 rounded-[1.5rem] flex gap-2">
                {['EXPENSE', 'INCOME', 'TRANSFER'].map(m => (
                  <button key={m} type="button" onClick={() => setFType(m as any)} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${fType === m ? `bg-white text-indigo-600 shadow-xl` : 'text-slate-400'}`}>{m === 'EXPENSE' ? 'Gasto' : m === 'INCOME' ? 'Ingreso' : 'Traspaso'}</button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Importe</label>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 font-bold">€</span>
                    <input type="number" step="0.01" className="w-full pl-10 pr-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-2xl font-black outline-none focus:border-indigo-500 transition-all shadow-inner" value={fAmount} onChange={e => setFAmount(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Fecha</label>
                  <input type="date" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500" value={fDate} onChange={e => setFDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Descripción</label>
                <input type="text" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500" placeholder="Ej: Compra mensual..." value={fDesc} onChange={e => setFDesc(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{fType === 'TRANSFER' ? 'Origen' : 'Cuenta'}</label>
                  <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={fAcc} onChange={e => setFAcc(e.target.value)}>
                    {groupedAccounts.map(g => (
                       <optgroup key={g.group.id} label={g.group.name}>
                           {g.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                       </optgroup>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{fType === 'TRANSFER' ? 'Destino' : 'Categoría'}</label>
                  <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={fType === 'TRANSFER' ? fTransferDest : fCat} onChange={e => fType === 'TRANSFER' ? setFTransferDest(e.target.value) : setFCat(e.target.value)}>
                    <option value="">Seleccionar...</option>
                    {fType === 'TRANSFER' ? (
                        groupedAccounts.map(g => (
                           <optgroup key={g.group.id} label={g.group.name}>
                               {g.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                           </optgroup>
                        ))
                    ) : (
                        groupedCategories.map(f => (
                            <optgroup key={f.family.id} label={f.family.name}>
                                {f.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </optgroup>
                        ))
                    )}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 flex items-center gap-2"><Paperclip size={14} /> Adjunto (Se comprimirá automáticamente)</label>
                <div className="flex gap-3">
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isCompressing} className={`flex-1 px-8 py-5 border-2 border-dashed rounded-3xl font-black text-[11px] uppercase transition-all flex items-center justify-center gap-3 ${fAttachment ? 'bg-indigo-50 border-indigo-300 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                    {isCompressing ? <Loader2 size={18} className="animate-spin" /> : fAttachment ? <CheckCircle2 size={18}/> : <Upload size={18}/>} 
                    {isCompressing ? 'Comprimiendo...' : fAttachment ? 'Listo (Optimizado)' : 'Subir'}
                  </button>
                  {fAttachment && <button type="button" onClick={() => setFAttachment(undefined)} className="p-5 bg-rose-50 text-rose-500 rounded-3xl active:scale-90"><X size={24}/></button>}
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} />
              </div>
              <button onClick={handleSave} disabled={isCompressing} className="w-full py-7 bg-slate-950 text-white rounded-[2.5rem] font-black uppercase text-[12px] tracking-widest shadow-2xl hover:bg-indigo-600 active:scale-95 transition-all mt-10 disabled:opacity-50">Guardar Asiento Contable</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR RECURRENTE */}
      {recurrenceModalTx && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[250] p-4 animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
              <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl space-y-6">
                  <div className="flex justify-between items-center"><h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Crear Recurrente</h3><button onClick={() => setRecurrenceModalTx(null)} className="p-2 bg-slate-100 rounded-full hover:bg-rose-100 hover:text-rose-500"><X size={18} /></button></div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-xs font-bold text-slate-700">{recurrenceModalTx.description}</p>
                      <p className={`text-lg font-black ${getAmountColor(recurrenceModalTx.amount)}`}>{formatCurrency(recurrenceModalTx.amount)}</p>
                  </div>
                  <div className="space-y-4">
                      <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Frecuencia</label>
                          <select className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl font-bold outline-none" value={recFreq} onChange={e => setRecFreq(e.target.value as any)}>
                              <option value="DAYS">Días</option><option value="WEEKS">Semanas</option><option value="MONTHLY">Meses</option><option value="YEARS">Años</option>
                          </select>
                      </div>
                      <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Intervalo</label>
                          <input type="number" className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl font-bold outline-none" value={recInterval} onChange={e => setRecInterval(e.target.value)} />
                      </div>
                  </div>
                  <button onClick={handleSaveRecurrent} className="w-full py-4 bg-emerald-500 text-white rounded-xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-emerald-600 transition-all">Generar Programación</button>
              </div>
          </div>
      )}

      {/* MODAL CREAR FAVORITO */}
      {favoriteModalTx && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[250] p-4 animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
              <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl space-y-6">
                  <div className="flex justify-between items-center"><h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Guardar Favorito</h3><button onClick={() => setFavoriteModalTx(null)} className="p-2 bg-slate-100 rounded-full hover:bg-rose-100 hover:text-rose-500"><X size={18} /></button></div>
                  <div className="space-y-4">
                      <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Alias (Nombre Corto)</label>
                          <input type="text" className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-amber-400" placeholder="Ej: Café" value={favName} onChange={e => setFavName(e.target.value)} autoFocus />
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">Se guardará una plantilla con la categoría, cuenta e importe actual.</p>
                  </div>
                  <button onClick={handleSaveFavorite} className="w-full py-4 bg-amber-500 text-white rounded-xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-amber-600 transition-all">Guardar Plantilla</button>
              </div>
          </div>
      )}

      {/* VISOR DE ADJUNTOS (LIGHTBOX) */}
      {previewAttachment && (
        <div className="fixed inset-0 z-[300] bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setPreviewAttachment(null)}>
            <button onClick={() => setPreviewAttachment(null)} className="absolute top-4 right-4 p-4 text-white/50 hover:text-white transition-colors"><X size={32}/></button>
            <img 
                src={previewAttachment} 
                className="max-w-full max-h-[85vh] rounded-xl shadow-2xl object-contain" 
                onClick={(e) => e.stopPropagation()} 
                alt="Documento adjunto"
            />
            <a 
                href={previewAttachment} 
                download={`adjunto-contamiki-${Date.now()}.jpg`}
                className="mt-6 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all backdrop-blur-md border border-white/10"
                onClick={(e) => e.stopPropagation()}
            >
                <Download size={16}/> Descargar Original
            </a>
        </div>
      )}
    </div>
  );
};