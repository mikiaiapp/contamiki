import React, { useState, useRef, useMemo, useEffect } from 'react';
import { AppState, Transaction, TransactionType, GlobalFilter, FavoriteMovement, RecurrentMovement, RecurrenceFrequency } from './types';
import { Plus, Trash2, Search, ArrowRightLeft, X, Paperclip, ChevronLeft, ChevronRight, Edit3, ArrowUpDown, Tag, Receipt, CheckCircle2, Upload, SortAsc, SortDesc, Heart, Bot, Filter, Eraser, Calendar, Sparkles, ChevronDown, Loader2, Download, MoreVertical, Copy, CalendarClock, Save, Repeat, FileSpreadsheet, FileText, CheckSquare, Square, PenTool, LayoutList, Check, AlertTriangle } from 'lucide-react';
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
  attachment?: string;
  transferAccountId?: string;
  isDuplicate?: boolean;
}

const generateId = () => Math.random().toString(36).substring(2, 15);
const numberFormatter = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  const [activeMenuTxId, setActiveMenuTxId] = useState<string | null>(null);
  
  const [recurrenceModalTx, setRecurrenceModalTx] = useState<Transaction | null>(null);
  const [recFreq, setRecFreq] = useState<RecurrenceFrequency>('MONTHLY');
  const [recInterval, setRecInterval] = useState('1');
  
  const [favoriteModalTx, setFavoriteModalTx] = useState<Transaction | null>(null);
  const [favName, setFavName] = useState('');
  const [showFavoritesList, setShowFavoritesList] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [bulkEditTarget, setBulkEditTarget] = useState<'DATE' | 'ACCOUNT' | 'CATEGORY' | 'DELETE'>('DATE');
  const [bulkEditValue, setBulkEditValue] = useState('');

  const [previewAttachment, setPreviewAttachment] = useState<string | null>(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStep, setImportStep] = useState<1 | 2 | 3>(1);
  const [importAccount, setImportAccount] = useState('');
  const [proposedTransactions, setProposedTransactions] = useState<ProposedTransaction[]>([]);
  const [selectedImportIds, setSelectedImportIds] = useState<Set<string>>(new Set());
  const [bulkImportCategory, setBulkImportCategory] = useState('');
  const [attachingImportId, setAttachingImportId] = useState<string | null>(null);
  const rowImportFileRef = useRef<HTMLInputElement>(null);
  const [openSelectorId, setOpenSelectorId] = useState<string | null>(null);
  
  const importFileRef = useRef<HTMLInputElement>(null);
  const rawImportTextRef = useRef<HTMLTextAreaElement>(null);

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

  useEffect(() => {
      setCurrentPage(1);
      setSelectedIds(new Set());
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
          if (initialSpecificFilters.filterCategory) {
              setColFilterEntry(initialSpecificFilters.filterCategory);
              setColFilterExit(initialSpecificFilters.filterCategory);
          } else if (initialSpecificFilters.filterAccount) {
              setColFilterEntry(initialSpecificFilters.filterAccount);
              setColFilterExit(initialSpecificFilters.filterAccount);
          }
      }
      if (clearSpecificFilters) clearSpecificFilters();
    }
  }, [initialSpecificFilters, indices, data.accounts]);

  const findSuggestedCategory = (desc: string): string => {
    const text = desc.toLowerCase().trim();
    if (!text) return '';
    const match = data.transactions.find(t => t.description.toLowerCase().trim() === text);
    if (match) return match.categoryId;
    const partialMatch = data.transactions.find(t => t.description.toLowerCase().includes(text));
    if (partialMatch) return partialMatch.categoryId;
    return '';
  };

  const handleStartAnalysis = (rawData: string) => {
    if (!rawData.trim()) return;
    const lines = rawData.split('\n').filter(l => l.trim());
    const props: ProposedTransaction[] = [];
    const existingInAccount = data.transactions.filter(t => t.accountId === importAccount);

    lines.forEach(line => {
      const parts = line.split(/[;\t]/).map(p => p.trim());
      const effectiveParts = parts.length >= 2 ? parts : line.split(',').map(p => p.trim());
      if (effectiveParts.length < 2) return;
      
      const dateStrRaw = effectiveParts[0];
      const concept = effectiveParts[1];
      let amountStr = effectiveParts[effectiveParts.length - 1].trim();
      amountStr = amountStr.replace(/[^\d.,\-+]/g, '');

      if (amountStr.includes('.') && amountStr.includes(',')) {
          if (amountStr.lastIndexOf(',') > amountStr.lastIndexOf('.')) amountStr = amountStr.replace(/\./g, '').replace(',', '.');
          else amountStr = amountStr.replace(/,/g, '');
      } else if (amountStr.includes(',')) amountStr = amountStr.replace(',', '.');
      
      const amount = parseFloat(amountStr);
      if (isNaN(amount)) return;

      const formattedDate = dateStrRaw.includes('/') ? dateStrRaw.split('/').reverse().join('-') : dateStrRaw;

      const isDuplicate = existingInAccount.some(ex => 
          ex.date === formattedDate &&
          Math.abs(ex.amount - amount) < 0.01 &&
          ex.description.toLowerCase().trim() === concept.toLowerCase().trim()
      );

      props.push({
        id: generateId(),
        date: formattedDate,
        description: concept,
        amount: amount,
        accountId: importAccount, 
        categoryId: findSuggestedCategory(concept),
        type: amount < 0 ? 'EXPENSE' : 'INCOME',
        isValidated: false,
        isDuplicate: isDuplicate
      });
    });

    setProposedTransactions(props);
    // AUTO-SELECCIONAR SOLO LOS NO DUPLICADOS
    setSelectedImportIds(new Set(props.filter(p => !p.isDuplicate).map(p => p.id)));
    setImportStep(3);
  };

  const handleImportFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      if (file.name.endsWith('.csv')) {
          reader.onload = (evt) => handleStartAnalysis(evt.target?.result as string);
          reader.readAsText(file);
      } else {
          reader.onload = (evt) => {
              try {
                  const bstr = evt.target?.result;
                  const wb = XLSX.read(bstr, { type: 'binary' });
                  const csvData = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]], { FS: ';' });
                  handleStartAnalysis(csvData);
              } catch (err) { alert("Error al leer Excel."); }
          };
          reader.readAsBinaryString(file);
      }
      e.target.value = '';
  };

  const handleFinalImport = () => {
    const candidates = proposedTransactions.filter(p => selectedImportIds.has(p.id));
    const validTransactions = candidates.filter(p => (p.categoryId && p.categoryId !== '') || (p.type === 'TRANSFER' && p.transferAccountId));
    
    if (validTransactions.length === 0) {
        alert("Selecciona al menos un movimiento válido (con categoría) para importar.");
        return;
    }

    const newTxs: Transaction[] = validTransactions.map(p => ({
      id: generateId(),
      date: p.date,
      amount: p.amount,
      description: p.description,
      accountId: p.accountId, 
      type: p.type,
      categoryId: p.categoryId,
      familyId: indices.cat.get(p.categoryId)?.familyId || '',
      transferAccountId: p.type === 'TRANSFER' ? p.transferAccountId : undefined,
      attachment: p.attachment
    }));

    onUpdateData({ transactions: [...newTxs, ...data.transactions] });

    const importedIds = new Set(validTransactions.map(v => v.id));
    const remainingTransactions = proposedTransactions.filter(p => !importedIds.has(p.id));

    setProposedTransactions(remainingTransactions);
    const newSelection = new Set(selectedImportIds);
    importedIds.forEach(id => newSelection.delete(id));
    setSelectedImportIds(newSelection);

    if (remainingTransactions.length === 0) {
        setIsImportModalOpen(false);
        resetForm();
        alert("Importación completada con éxito.");
    } else {
         alert(`Importados ${validTransactions.length} movimientos. Quedan elementos pendientes en la lista.`);
    }
  };

  const toggleImportSelection = (id: string) => {
      const newSet = new Set(selectedImportIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedImportIds(newSet);
  };

  const toggleSelectAllImport = () => {
      const allIds = proposedTransactions.map(p => p.id);
      const allSelected = allIds.every(id => selectedImportIds.has(id));
      setSelectedImportIds(allSelected ? new Set() : new Set(allIds));
  };

  const handleRowImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && attachingImportId) {
          try {
              const compressed = await compressImage(file);
              setProposedTransactions(prev => prev.map(p => p.id === attachingImportId ? { ...p, attachment: compressed } : p));
          } catch (err) { console.error(err); } finally { setAttachingImportId(null); }
      }
      e.target.value = '';
  };

  const handleUseFavorite = (fav: FavoriteMovement) => {
      resetForm();
      setFType(fav.type);
      setFAmount(fav.amount ? fav.amount.toString() : '');
      setFDesc(fav.description);
      setFDate(new Date().toISOString().split('T')[0]);
      setFAcc(fav.accountId);
      setFCat(fav.categoryId);
      setFTransferDest(fav.transferAccountId || '');
      setShowFavoritesList(false);
      setIsModalOpen(true);
  };

  const toggleSelection = (id: string) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedIds(newSet);
  };

  const toggleSelectAllPage = () => {
      const allPageIds = paginatedTransactions.map(t => t.id);
      const allSelected = allPageIds.every(id => selectedIds.has(id));
      const newSet = new Set(selectedIds);
      if (allSelected) allPageIds.forEach(id => newSet.delete(id));
      else allPageIds.forEach(id => newSet.add(id));
      setSelectedIds(newSet);
  };

  const handleBulkAction = () => {
      if (bulkEditTarget === 'DELETE') {
          if (confirm(`¿Borrar ${selectedIds.size} movimientos?`)) {
              onUpdateData({ transactions: data.transactions.filter(t => !selectedIds.has(t.id)) });
              setSelectedIds(new Set());
              setIsBulkEditModalOpen(false);
          }
      } else {
          if (!bulkEditValue) return;
          const updatedTxs = data.transactions.map(t => {
              if (selectedIds.has(t.id)) {
                  const updates: any = {};
                  if (bulkEditTarget === 'DATE') updates.date = bulkEditValue;
                  else if (bulkEditTarget === 'ACCOUNT') updates.accountId = bulkEditValue;
                  else if (bulkEditTarget === 'CATEGORY') {
                      updates.categoryId = bulkEditValue;
                      updates.familyId = indices.cat.get(bulkEditValue)?.familyId || '';
                  }
                  return { ...t, ...updates };
              }
              return t;
          });
          onUpdateData({ transactions: updatedTxs });
          setSelectedIds(new Set());
          setIsBulkEditModalOpen(false);
      }
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
    const buildGrouped = (ids: Set<string>) => {
      const groupsMap = new Map<string, { label: string, options: { id: string, name: string }[] }>();
      ids.forEach(id => {
        let label = 'Otros', name = 'Desconocido';
        if (indices.cat.has(id)) { const c = indices.cat.get(id)!; name = c.name; label = indices.fam.get(c.familyId)?.name || 'Sin Fam'; }
        else if (indices.acc.has(id)) { const a = indices.acc.get(id)!; name = a.name; label = indices.grp.get(a.groupId)?.name || 'Sin Grp'; }
        if (!groupsMap.has(label)) groupsMap.set(label, { label, options: [] });
        groupsMap.get(label)!.options.push({ id, name });
      });
      return Array.from(groupsMap.values()).sort((a,b)=>a.label.localeCompare(b.label));
    };
    return { entryGroups: buildGrouped(entryIds), exitGroups: buildGrouped(exitIds) };
  }, [timeFilteredList, indices]);

  const filteredList = useMemo(() => {
    const desc = colFilterDesc.trim().toLowerCase();
    const v1 = parseFloat(colFilterAmountVal1);
    return timeFilteredList.filter(t => {
      if (colFilterEntry !== 'ALL' && ![t.accountId, t.categoryId, t.transferAccountId].includes(colFilterEntry)) return false;
      if (colFilterExit !== 'ALL' && ![t.accountId, t.categoryId, t.transferAccountId].includes(colFilterExit)) return false;
      if (desc && !t.description.toLowerCase().includes(desc)) return false;
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
      else { vA = a.description; vB = b.description; }
      if (vA < vB) return sortDirection === 'ASC' ? -1 : 1;
      if (vA > vB) return sortDirection === 'ASC' ? 1 : -1;
      return 0;
    });
  }, [filteredList, sortField, sortDirection]);

  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return itemsPerPage === -1 ? sortedTransactions : sortedTransactions.slice(start, start + itemsPerPage);
  }, [sortedTransactions, currentPage, itemsPerPage]);

  const clearAllFilters = () => { setColFilterEntry('ALL'); setColFilterDesc(''); setColFilterClip('ALL'); setColFilterExit('ALL'); setColFilterAmountOp('ALL'); setColFilterAmountVal1(''); };
  const resetForm = () => { setEditingTx(null); setFType('EXPENSE'); setFAmount(''); setFDesc(''); setFDate(new Date().toISOString().split('T')[0]); setFAcc(data.accounts[0]?.id || ''); setFCat(''); setFTransferDest(''); setFAttachment(undefined); };
  
  const handleSave = () => {
      if (!fAmount || !fDesc || !fAcc || (fType !== 'TRANSFER' && !fCat)) return;
      let amt = Math.abs(parseFloat(fAmount));
      if (fType === 'EXPENSE' || fType === 'TRANSFER') amt = -amt;
      const tx: Transaction = { id: editingTx ? editingTx.id : generateId(), date: fDate, amount: amt, description: fDesc, accountId: fAcc, type: fType, categoryId: fCat, familyId: indices.cat.get(fCat)?.familyId || '', attachment: fAttachment, transferAccountId: fType === 'TRANSFER' ? fTransferDest : undefined };
      if (editingTx) onUpdateTransaction(tx); else onAddTransaction(tx);
      setIsModalOpen(false); resetForm();
  };

  // --- RECOVERY OF MISSING HELPER FUNCTIONS ---

  /**
   * Helper to open the editor with an existing transaction or a fresh state.
   */
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

  /**
   * Helper to initiate duplication of a transaction.
   */
  const handleDuplicate = (t: Transaction) => {
      setEditingTx(null); 
      setFType(t.type); 
      setFAmount(Math.abs(t.amount).toString()); 
      setFDesc(t.description + ' (Copia)'); 
      setFDate(new Date().toISOString().split('T')[0]); 
      setFAcc(t.accountId); 
      setFCat(t.categoryId); 
      setFTransferDest(t.transferAccountId || ''); 
      setFAttachment(t.attachment);
      setActiveMenuTxId(null);
      setIsModalOpen(true);
  };

  /**
   * Formats dates for display as DD/MM/YY.
   */
  const formatDateDisplay = (dateStr: string) => { 
      if (!dateStr) return '--/--/--'; 
      const [y, m, d] = dateStr.split('-'); 
      return `${d}/${m}/${y.slice(-2)}`; 
  };

  /**
   * Formats numeric currency values.
   */
  const formatCurrency = (amount: number) => `${numberFormatter.format(amount)} €`;

  /**
   * Navigates the global temporal filter.
   */
  const navigatePeriod = (direction: 'prev' | 'next') => {
    const newDate = new Date(filter.referenceDate);
    const step = direction === 'next' ? 1 : -1;
    if (filter.timeRange === 'MONTH') newDate.setMonth(newDate.getMonth() + step);
    else if (filter.timeRange === 'YEAR') newDate.setFullYear(newDate.getFullYear() + step);
    onUpdateFilter({ ...filter, referenceDate: newDate });
  };

  const gridClasses = "grid grid-cols-[25px_52px_1fr_1.2fr_12px_1fr_50px_20px] md:grid-cols-[30px_90px_1fr_1.5fr_40px_1fr_80px_40px] gap-1 md:gap-4 items-center";

  return (
    <div className="space-y-6 md:space-y-10 pb-24 animate-in fade-in duration-500" onClick={() => { setActiveMenuTxId(null); setOpenSelectorId(null); }}>
      <div className="flex flex-col xl:flex-row justify-between xl:items-end gap-8 print:hidden">
        <div className="space-y-4 text-center md:text-left w-full xl:w-auto">
          <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter">Diario.</h2>
          <div className="flex flex-col sm:flex-row items-center gap-3 justify-center md:justify-start">
            <div className="flex items-center gap-1">
              <button onClick={() => navigatePeriod('prev')} className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm"><ChevronLeft size={24} /></button>
              <button onClick={() => navigatePeriod('next')} className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm"><ChevronRight size={24} /></button>
            </div>
            <div className="bg-slate-100 p-2 rounded-2xl flex flex-wrap gap-1 shadow-inner">
                <button onClick={() => onUpdateFilter({...filter, timeRange: 'ALL'})} className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${filter.timeRange === 'ALL' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Todo</button>
                <button onClick={() => onUpdateFilter({...filter, timeRange: 'MONTH'})} className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${filter.timeRange === 'MONTH' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Mes</button>
                <button onClick={() => onUpdateFilter({...filter, timeRange: 'YEAR'})} className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${filter.timeRange === 'YEAR' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Año</button>
            </div>
            <div className="flex gap-2">
                <button onClick={() => setShowFavoritesList(!showFavoritesList)} className="w-12 h-12 bg-amber-50 text-amber-600 border border-amber-100 rounded-xl shadow-sm hover:bg-amber-100 flex items-center justify-center transition-all"><Heart size={20} fill={showFavoritesList ? "currentColor" : "none"}/></button>
                <button onClick={() => { setImportAccount(data.accounts[0]?.id || ''); setImportStep(1); setIsImportModalOpen(true); }} className="w-12 h-12 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl shadow-sm hover:bg-indigo-100 flex items-center justify-center transition-all"><Bot size={20}/></button>
                <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="w-12 h-12 bg-slate-950 text-white rounded-xl shadow-lg hover:bg-slate-800 flex items-center justify-center transition-all"><Plus size={20}/></button>
            </div>
          </div>
        </div>
      </div>

      <div className={`bg-slate-900/5 p-2 md:p-4 rounded-2xl border border-slate-100 ${gridClasses}`}>
          <button onClick={toggleSelectAllPage} className="flex justify-center text-slate-400 hover:text-indigo-600">{paginatedTransactions.every(t=>selectedIds.has(t.id)) ? <CheckSquare size={16}/> : <Square size={16}/>}</button>
          <button onClick={() => { if(sortField==='DATE') setSortDirection(sortDirection==='ASC'?'DESC':'ASC'); else setSortField('DATE'); }} className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest inline-flex items-center gap-0.5">Fec <ArrowUpDown size={8}/></button>
          <select className="w-full bg-white border border-slate-200 rounded-lg text-[8px] md:text-[11px] font-bold py-0.5 outline-none" value={colFilterEntry} onChange={e => setColFilterEntry(e.target.value)}>
              <option value="ALL">Desde...</option>
              {activeDropdownOptions.entryGroups.map(g => <optgroup key={g.label} label={g.label}>{g.options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</optgroup>)}
          </select>
          <input type="text" className="w-full bg-white border border-slate-200 rounded-lg text-[8px] md:text-[11px] font-bold py-0.5 px-1 outline-none" placeholder="Concepto..." value={colFilterDesc} onChange={e => setColFilterDesc(e.target.value)} />
          <select className="bg-white border border-slate-200 rounded-lg text-[8px] md:text-[11px] font-black py-0.5 outline-none" value={colFilterClip} onChange={e => setColFilterClip(e.target.value as any)}><option value="ALL">📎</option><option value="YES">SI</option><option value="NO">NO</option></select>
          <select className="w-full bg-white border border-slate-200 rounded-lg text-[8px] md:text-[11px] font-bold py-0.5 outline-none" value={colFilterExit} onChange={e => setColFilterExit(e.target.value)}>
              <option value="ALL">Hacia...</option>
              {activeDropdownOptions.exitGroups.map(g => <optgroup key={g.label} label={g.label}>{g.options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</optgroup>)}
          </select>
          <button onClick={() => { if(sortField==='AMOUNT') setSortDirection(sortDirection==='ASC'?'DESC':'ASC'); else setSortField('AMOUNT'); }} className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-end gap-0.5">Imp <ArrowUpDown size={8}/></button>
          <button onClick={clearAllFilters} className="flex justify-center text-slate-300 hover:text-rose-500 transition-colors"><Eraser size={14}/></button>
      </div>

      <div className="space-y-1.5 md:space-y-2.5">
        {paginatedTransactions.map(t => {
          const isSelected = selectedIds.has(t.id);
          const srcAcc = indices.acc.get(t.accountId);
          const dstAcc = t.transferAccountId ? indices.acc.get(t.transferAccountId) : null;
          const cat = indices.cat.get(t.categoryId);
          
          let debitNode, creditNode;
          if (t.type === 'TRANSFER') {
              debitNode = <div className="flex items-center gap-1 font-bold text-slate-900 truncate">➡ {dstAcc?.name}</div>;
              creditNode = <div className="flex items-center gap-1 font-bold text-slate-900 truncate">{srcAcc?.name}</div>;
          } else if (t.type === 'INCOME') {
              debitNode = <div className="flex items-center gap-1 font-bold text-emerald-600 truncate">{srcAcc?.name}</div>;
              creditNode = <div className="flex items-center gap-1 font-bold text-emerald-600 truncate">{cat?.name || 'S/C'}</div>;
          } else {
              debitNode = <div className="flex items-center gap-1 font-bold text-rose-600 truncate">{cat?.name}</div>;
              creditNode = <div className="flex items-center gap-1 font-bold text-rose-600 truncate">{srcAcc?.name}</div>;
          }

          return (
            <div key={t.id} className={`group bg-white p-2 md:p-4 md:px-6 rounded-2xl border ${isSelected ? 'border-indigo-400 bg-indigo-50/30' : 'border-slate-100'} hover:shadow-lg transition-all relative`}>
                <div className={gridClasses}>
                    <button onClick={(e) => { e.stopPropagation(); toggleSelection(t.id); }} className={`flex justify-center text-slate-400 ${isSelected ? 'text-indigo-600' : ''}`}>{isSelected ? <CheckSquare size={16} /> : <Square size={16} />}</button>
                    <div className="text-[8px] md:text-sm font-black text-slate-400 uppercase tracking-tighter truncate">{formatDateDisplay(t.date)}</div>
                    <div className="min-w-0 text-[8px] md:text-sm">{debitNode}</div>
                    <div className="min-w-0 text-[8px] md:text-sm font-bold text-slate-800 uppercase truncate">{t.description}</div>
                    <div className="flex justify-center">{t.attachment && <button onClick={() => setPreviewAttachment(t.attachment!)} className="text-indigo-500"><Paperclip size={12}/></button>}</div>
                    <div className="min-w-0 text-[8px] md:text-sm">{creditNode}</div>
                    <div className={`text-right text-[9px] md:text-base font-black font-mono tracking-tighter truncate ${t.type === 'EXPENSE' ? 'text-rose-600' : t.type === 'INCOME' ? 'text-emerald-600' : 'text-slate-900'}`}>{formatCurrency(t.amount)}</div>
                    <div className="flex justify-center relative">
                        <button onClick={(e) => { e.stopPropagation(); setActiveMenuTxId(activeMenuTxId === t.id ? null : t.id); }} className="text-slate-300 hover:text-indigo-600"><MoreVertical size={16} /></button>
                        {activeMenuTxId === t.id && (
                            <div className="absolute top-8 right-0 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 min-w-[180px] p-2 flex flex-col gap-1 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                                <button onClick={() => { openEditor(t); setActiveMenuTxId(null); }} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl text-[10px] font-bold text-slate-600 uppercase"><Edit3 size={14} className="text-indigo-600"/> Editar</button>
                                <button onClick={() => { handleDuplicate(t); setActiveMenuTxId(null); }} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl text-[10px] font-bold text-slate-600 uppercase"><Copy size={14}/> Duplicar</button>
                                <button onClick={() => { setDeleteConfirmId(t.id); setActiveMenuTxId(null); }} className="flex items-center gap-3 px-3 py-2.5 hover:bg-rose-50 rounded-xl text-[10px] font-bold text-rose-500 uppercase"><Trash2 size={14}/> Borrar</button>
                            </div>
                        )}
                    </div>
                </div>
                {deleteConfirmId === t.id && (
                    <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-10 flex items-center justify-center gap-4 animate-in zoom-in-95 p-4 rounded-2xl">
                        <p className="text-[10px] font-black uppercase text-slate-900">¿Borrar?</p>
                        <div className="flex gap-2">
                            <button onClick={() => { onDeleteTransaction(t.id); setDeleteConfirmId(null); }} className="bg-rose-600 text-white px-5 py-2 rounded-xl font-black text-[9px] uppercase shadow-xl">Sí</button>
                            <button onClick={() => setDeleteConfirmId(null)} className="bg-slate-100 text-slate-500 px-5 py-2 rounded-xl font-black text-[9px] uppercase">No</button>
                        </div>
                    </div>
                )}
            </div>
          );
        })}
      </div>

      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[200] p-4 animate-in fade-in" onClick={() => setIsImportModalOpen(false)}>
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl p-8 relative max-h-[95vh] overflow-y-auto border border-white/20" onClick={e => e.stopPropagation()}>
            <button onClick={() => setIsImportModalOpen(false)} className="absolute top-8 right-8 p-3 bg-slate-50 text-slate-400 rounded-full hover:text-rose-500"><X size={24}/></button>
            <div className="flex items-center gap-4 mb-8">
                <div className="bg-indigo-600 p-4 rounded-3xl text-white shadow-xl"><Bot size={28} /></div>
                <div><h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">Smart Import</h3><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Sube archivos y el sistema detectará categorías</p></div>
            </div>

            {importStep === 1 && (
                <div className="space-y-8 animate-in slide-in-from-right-4">
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">1. Cuenta Destino</label>
                        <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500" value={importAccount} onChange={e => setImportAccount(e.target.value)}>
                            {groupedAccounts.map(g => <optgroup key={g.group.id} label={g.group.name}>{g.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</optgroup>)}
                        </select>
                    </div>
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">2. Pega texto o sube archivo</label>
                        <textarea ref={rawImportTextRef} className="w-full h-40 p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] font-mono text-xs outline-none focus:border-indigo-500 resize-none shadow-inner" placeholder="FECHA;CONCEPTO;IMPORTE" onBlur={e => handleStartAnalysis(e.target.value)} />
                        <button onClick={() => importFileRef.current?.click()} className="w-full py-5 bg-white border-2 border-dashed border-indigo-200 text-indigo-500 rounded-3xl font-black uppercase text-[11px] tracking-widest hover:bg-indigo-50 transition-all flex flex-col items-center justify-center gap-2 group">
                            <Upload size={24} className="group-hover:scale-110 transition-transform"/> <span>Subir Excel o CSV</span>
                        </button>
                        <input type="file" ref={importFileRef} className="hidden" accept=".csv, .xlsx" onChange={handleImportFileUpload} />
                    </div>
                </div>
            )}

            {importStep === 3 && (
                <div className="space-y-6 animate-in slide-in-from-right-4">
                    <div className="flex justify-between items-center px-2">
                        <div className="flex items-center gap-3">
                            <button onClick={toggleSelectAllImport} className="text-slate-400 hover:text-indigo-600">{proposedTransactions.every(p => selectedImportIds.has(p.id)) ? <CheckSquare size={16}/> : <Square size={16}/>}</button>
                            <span className="text-xs font-bold text-slate-500 uppercase">Revisión ({proposedTransactions.length})</span>
                        </div>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto custom-scrollbar space-y-2 pr-2 pb-16">
                        {proposedTransactions.map((t, idx) => {
                            const isSelected = selectedImportIds.has(t.id);
                            const rowBg = t.isDuplicate ? 'bg-rose-50 border-rose-200' : (isSelected ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100');
                            return (
                                <div key={t.id} className={`p-4 rounded-2xl flex items-center gap-4 ${rowBg}`}>
                                    <button onClick={() => toggleImportSelection(t.id)} className="text-slate-400 hover:text-indigo-600">{isSelected ? <CheckSquare size={16}/> : <Square size={16}/>}</button>
                                    <div className="flex-1 grid grid-cols-[repeat(16,minmax(0,1fr))] gap-4 items-center">
                                        <div className="col-span-3 text-[10px] font-bold text-slate-500">{formatDateDisplay(t.date)} {t.isDuplicate && <span className="text-rose-600 font-black uppercase ml-1">Dup</span>}</div>
                                        <div className="col-span-4 text-xs font-bold text-slate-800 truncate">{t.description}</div>
                                        <div className={`col-span-3 text-xs font-black text-right ${t.amount < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatCurrency(t.amount)}</div>
                                        <div className="col-span-6 relative">
                                            <button onClick={(e) => { e.stopPropagation(); setOpenSelectorId(openSelectorId === t.id ? null : t.id); }} className={`w-full border rounded-lg text-[9px] font-bold py-1.5 px-2 flex items-center justify-between gap-2 ${t.categoryId ? 'bg-white border-emerald-200 text-emerald-700' : 'bg-white border-rose-200 text-slate-500'}`}>
                                                <span className="truncate">{indices.cat.get(t.categoryId)?.name || 'Sin Asignar'}</span>
                                                <ChevronDown size={12}/>
                                            </button>
                                            {openSelectorId === t.id && (
                                                <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-[2px]" onClick={(e) => { e.stopPropagation(); setOpenSelectorId(null); }}>
                                                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-[550px] max-w-[95vw] flex overflow-hidden animate-in zoom-in-95 max-h-[60vh]" onClick={e => e.stopPropagation()}>
                                                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50">
                                                            <div className="p-3 sticky top-0 bg-slate-50/95 border-b font-black text-[10px] text-slate-400 uppercase tracking-widest z-10">Categorías</div>
                                                            {groupedCategories.map(f => (
                                                                <div key={f.family.id}>
                                                                    <div className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase bg-slate-100/50 sticky top-9">{f.family.name}</div>
                                                                    {f.categories.map(c => (
                                                                        <button key={c.id} onClick={() => { const newArr = [...proposedTransactions]; newArr[idx].categoryId = c.id; setProposedTransactions(newArr); setOpenSelectorId(null); }} className={`w-full text-left px-4 py-3 hover:bg-white hover:text-indigo-600 text-[11px] font-bold text-slate-600 truncate border-b border-slate-50 transition-colors ${t.categoryId === c.id ? 'bg-indigo-50 text-indigo-700' : ''}`}> {c.icon} {c.name} </button>
                                                                    ))}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <button onClick={() => setProposedTransactions(proposedTransactions.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-rose-500"><X size={16}/></button>
                                </div>
                            );
                        })}
                    </div>
                    <button onClick={handleFinalImport} className="w-full py-6 bg-slate-950 text-white rounded-[2rem] font-black uppercase text-[12px] tracking-widest shadow-2xl hover:bg-emerald-600 transition-all">
                        Importar Selección ({proposedTransactions.filter(p => selectedImportIds.has(p.id) && p.categoryId).length})
                    </button>
                </div>
            )}
          </div>
        </div>
      )}

      {isModalOpen && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[200] p-4 animate-in fade-in zoom-in duration-300">
              <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg p-10 relative border border-white/20 max-h-[95vh] overflow-y-auto">
                  <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 p-3 bg-slate-50 text-slate-400 rounded-full hover:text-rose-500"><X size={24}/></button>
                  <h3 className="text-2xl font-black text-slate-900 uppercase flex items-center gap-3 mb-8"><Edit3 className="text-indigo-600"/> {editingTx ? 'Editar Movimiento' : 'Nuevo Movimiento'}</h3>
                  <div className="space-y-6">
                      <div className="bg-slate-100 p-1.5 rounded-2xl flex shadow-inner">
                          <button onClick={() => setFType('EXPENSE')} className={`flex-1 py-4 text-[10px] font-black uppercase rounded-xl transition-all ${fType === 'EXPENSE' ? 'bg-white shadow-sm text-rose-500' : 'text-slate-400'}`}>Gasto</button>
                          <button onClick={() => setFType('INCOME')} className={`flex-1 py-4 text-[10px] font-black uppercase rounded-xl transition-all ${fType === 'INCOME' ? 'bg-white shadow-sm text-emerald-500' : 'text-slate-400'}`}>Ingreso</button>
                          <button onClick={() => setFType('TRANSFER')} className={`flex-1 py-4 text-[10px] font-black uppercase rounded-xl transition-all ${fType === 'TRANSFER' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>Traspaso</button>
                      </div>
                      <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Importe</label>
                          <input type="number" step="0.01" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-xl outline-none focus:border-indigo-500" value={fAmount} onChange={e => setFAmount(e.target.value)} autoFocus />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                           <input type="date" className="px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={fDate} onChange={e => setFDate(e.target.value)} />
                           <select className="px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={fAcc} onChange={e => setFAcc(e.target.value)}>
                               {groupedAccounts.map(g => <optgroup key={g.group.id} label={g.group.name}>{g.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</optgroup>)}
                           </select>
                      </div>
                      <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Concepto</label>
                          <input type="text" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500" value={fDesc} onChange={e => setFDesc(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Categoría</label>
                          <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500" value={fCat} onChange={e => setFCat(e.target.value)}>
                              <option value="">Selecciona...</option>
                              {groupedCategories.map(f => <optgroup key={f.family.id} label={f.family.name}>{f.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>)}
                          </select>
                      </div>
                      <button onClick={handleSave} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] hover:bg-indigo-600 shadow-xl tracking-widest transition-all">Guardar</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
