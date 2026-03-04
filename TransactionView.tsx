import React, { useState, useRef, useMemo, useEffect } from 'react';
import { AppState, Transaction, TransactionType, GlobalFilter, FavoriteMovement, RecurrentMovement, RecurrenceFrequency, Category, Account, BookMetadata } from './types';
import { Plus, Trash2, Search, ArrowRightLeft, X, Paperclip, ChevronLeft, ChevronRight, Edit3, ArrowUpDown, Tag, Receipt, CheckCircle2, Upload, SortAsc, SortDesc, Heart, Bot, Filter, Eraser, Calendar, Sparkles, ChevronDown, Loader2, Download, MoreVertical, Copy, CalendarClock, Save, Repeat, FileSpreadsheet, FileText, CheckSquare, Square, PenTool, LayoutList, Check, AlertTriangle, FileDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  currentBook: BookMetadata;
  onFinished?: () => void;
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
  clearSpecificFilters,
  currentBook,
  onFinished
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
  
  const [recDesc, setRecDesc] = useState('');
  const [recAmount, setRecAmount] = useState('');
  const [recAccountId, setRecAccountId] = useState('');
  const [recCategoryId, setRecCategoryId] = useState('');
  const [recTransferAccountId, setRecTransferAccountId] = useState<string | null>(null);
  const [recType, setRecType] = useState<TransactionType>('EXPENSE');
  const [recStartDate, setRecStartDate] = useState('');
  const [recEndDate, setRecEndDate] = useState('');
  const [isRecSelectorOpen, setIsRecSelectorOpen] = useState(false);
  
  const [recurrenceModalTx, setRecurrenceModalTx] = useState<Transaction | null>(null);
  const [recFreq, setRecFreq] = useState<RecurrenceFrequency>('MONTHLY');
  const [recInterval, setRecInterval] = useState('1');


  const calculateNextDate = (baseDate: string, freq: RecurrenceFrequency, interval: number) => {
      if (!baseDate) return '';
      const d = new Date(baseDate);
      if (isNaN(d.getTime())) return '';
      
      if (freq === 'DAYS') d.setDate(d.getDate() + interval);
      if (freq === 'WEEKS') d.setDate(d.getDate() + (interval * 7));
      if (freq === 'MONTHLY') d.setMonth(d.getMonth() + interval);
      if (freq === 'YEARS') d.setFullYear(d.getFullYear() + interval);
      
      return d.toISOString().split('T')[0];
  };

  const openRecurrenceModal = (t: Transaction) => {
      setRecurrenceModalTx(t);
      setRecDesc(t.description);
      setRecAmount(Math.abs(t.amount).toString());
      setRecAccountId(t.accountId);
      setRecCategoryId(t.categoryId);
      setRecTransferAccountId(t.transferAccountId || null);
      setRecType(t.type);
      setRecFreq('MONTHLY');
      setRecInterval('1');
      setRecEndDate('');

      setRecStartDate(calculateNextDate(t.date, 'MONTHLY', 1));
  };
  
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
  const [selectorSearchTerm, setSelectorSearchTerm] = useState('');
  
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

  const displayLogo = useMemo(() => {
    let logo = currentBook.logo;
    if (logo && logo.startsWith('/api/')) {
        return `${logo}&key=${localStorage.getItem('auth_token')}`;
    }
    return logo || localStorage.getItem('contamiki_custom_logo') || "/contamiki.jpg";
  }, [currentBook.logo]);

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

  // --- NUEVOS MEMOS PARA EL IMPORTADOR (SOLO ACTIVOS) ---
  const activeGroupedCategories = useMemo(() => {
      return data.families.map(family => {
          const categories = data.categories
              .filter(c => c.familyId === family.id && c.active !== false)
              .sort((a, b) => a.name.localeCompare(b.name));
          return { family, categories };
      }).filter(f => f.categories.length > 0);
  }, [data.families, data.categories]);

  const activeGroupedAccounts = useMemo(() => {
      return data.accountGroups.map(group => {
          const accounts = data.accounts
              .filter(a => a.groupId === group.id && a.active !== false)
              .sort((a, b) => a.name.localeCompare(b.name));
          return { group, accounts };
      }).filter(g => g.accounts.length > 0);
  }, [data.accountGroups, data.accounts]);

  useEffect(() => {
      setCurrentPage(1);
      setSelectedIds(new Set());
  }, [colFilterEntry, colFilterExit, colFilterDesc, colFilterClip, colFilterAmountOp, colFilterAmountVal1, filter]);

  useEffect(() => {
    if (initialSpecificFilters) {
      if (initialSpecificFilters.action === 'NEW') {
         resetForm();
         if (initialSpecificFilters.favorite) {
             const fav = initialSpecificFilters.favorite;
             setFType(fav.type);
             setFAmount(fav.amount ? fav.amount.toString() : '');
             setFDesc(fav.description);
             setFDate(new Date().toISOString().split('T')[0]);
             setFAcc(fav.accountId);
             setFCat(fav.categoryId);
             setFTransferDest(fav.transferAccountId || '');
         } else if (initialSpecificFilters.categoryId) {
             const cat = indices.cat.get(initialSpecificFilters.categoryId);
             const fam = cat ? indices.fam.get(cat.familyId) : null;
             setFCat(initialSpecificFilters.categoryId);
             if (fam) setFType(fam.type === 'INCOME' ? 'INCOME' : 'EXPENSE');
         }
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
          } else {
              if (initialSpecificFilters.filterCategory) setColFilterEntry(initialSpecificFilters.filterCategory);
              if (initialSpecificFilters.filterAccount) setColFilterExit(initialSpecificFilters.filterAccount);
          }
      }
      if (clearSpecificFilters) clearSpecificFilters();
    }
  }, [initialSpecificFilters, indices, data.accounts]);

  const findSuggestedCategory = (desc: string): string => {
    const text = desc.toLowerCase().trim();
    if (!text) return '';

    const isMatch = (tDesc: string) => {
        const hText = tDesc.toLowerCase();
        return (hText.length > 2 && text.includes(hText)) || (text.length > 2 && hText.includes(text));
    };

    // Prioritize matches in the current import account
    const accountMatch = data.transactions.find(t => t.accountId === importAccount && isMatch(t.description));
    if (accountMatch) return accountMatch.categoryId;

    // Fallback to global history
    const match = data.transactions.find(t => isMatch(t.description));
    if (match) return match.categoryId;

    const catMatch = data.categories.find(c => text.includes(c.name.toLowerCase()));
    if (catMatch) return catMatch.id;
    return '';
  };

  const processRows = (rows: any[][]) => {
    if (!importAccount) { alert("Selecciona una cuenta primero."); return; }
    
    rows = rows.filter(r => r.length > 0 && r.some((c: any) => c && c.toString().trim()));
    if (rows.length === 0) return;

    let dateIdx = -1;
    let amountIdx = -1;
    let descIdx = -1;

    // Force standard mapping for copy/paste format (Date;Concept;Amount) if 3 columns and no header detected
    if (rows.length > 0 && rows[0].length === 3) {
        const r0 = rows[0];
        const isHeader = r0[0]?.toString().toLowerCase().includes('date') || r0[0]?.toString().toLowerCase().includes('fecha');
        if (!isHeader) {
             // Assume Date;Concept;Amount
             dateIdx = 0;
             descIdx = 1;
             amountIdx = 2;
        }
    }

    const isDate = (val: any) => {
        if (!val) return false;
        const s = val.toString().trim();
        return s.match(/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/) || !isNaN(Date.parse(s));
    };

    const isAmount = (val: any) => {
        if (!val) return false;
        const s = val.toString().trim().replace(/[^\d.,\-+]/g, '');
        return s.length > 0 && !isNaN(parseFloat(s.replace(',','.')));
    };

    const headerRow = rows[0];
    headerRow.forEach((cell: any, idx: number) => {
        const s = cell ? cell.toString().toLowerCase() : '';
        if (s.includes('date') || s.includes('fecha')) dateIdx = idx;
        if (s.includes('amount') || s.includes('importe') || s.includes('cantidad') || s.includes('valor') || s.includes('saldo') === false && (s.includes('haber') || s.includes('debe'))) amountIdx = idx;
        if (s.includes('concept') || s.includes('descrip') || s.includes('detalle')) descIdx = idx;
    });

    if (rows.length > 1 && (dateIdx === -1 || amountIdx === -1)) {
        const sample = rows[1];
        if (dateIdx === -1) dateIdx = sample.findIndex(isDate);
        if (amountIdx === -1) {
             for (let i = sample.length - 1; i >= 0; i--) {
                 if (i !== dateIdx && isAmount(sample[i])) {
                     amountIdx = i;
                     break;
                 }
             }
        }
    }
    
    if (dateIdx === -1) dateIdx = 0;
    if (amountIdx === -1) amountIdx = headerRow.length - 1;
    
    if (descIdx === -1 && rows.length > 1) {
        const sample = rows[1];
        let maxLen = 0;
        sample.forEach((cell: any, idx: number) => {
            if (idx !== dateIdx && idx !== amountIdx) {
                const len = cell ? cell.toString().length : 0;
                if (len > maxLen) {
                    maxLen = len;
                    descIdx = idx;
                }
            }
        });
    }
    
    if (descIdx === -1) descIdx = 1;

    const props: ProposedTransaction[] = [];
    const existingInAcc = data.transactions.filter(t => t.accountId === importAccount || t.transferAccountId === importAccount);

    rows.forEach((row, rIdx) => {
        if (rIdx === 0 && (row[dateIdx]?.toString().toLowerCase().includes('date') || row[dateIdx]?.toString().toLowerCase().includes('fecha'))) return;

        const dateVal = row[dateIdx];
        const amountVal = row[amountIdx];
        const descVal = row[descIdx];

        if (!dateVal && !amountVal) return;

        let dateStrRaw = dateVal ? dateVal.toString() : new Date().toISOString().split('T')[0];
        // Handle Excel serial dates
        if (typeof dateVal === 'number' && dateVal > 20000) {
            const date = new Date((dateVal - (25567 + 2)) * 86400 * 1000);
            dateStrRaw = date.toISOString().split('T')[0];
        }

        let amountStr = amountVal ? amountVal.toString().trim() : '0';
        amountStr = amountStr.replace(/[^\d.,\-+]/g, '');

        if (amountStr.includes('.') && amountStr.includes(',')) {
            if (amountStr.lastIndexOf(',') > amountStr.lastIndexOf('.')) {
                amountStr = amountStr.replace(/\./g, '').replace(',', '.');
            } else {
                amountStr = amountStr.replace(/,/g, '');
            }
        } else if (amountStr.includes(',')) {
            amountStr = amountStr.replace(',', '.');
        } else if (amountStr.includes('.')) {
            const dotCount = (amountStr.match(/\./g) || []).length;
            const parts = amountStr.split('.');
            const lastPart = parts[parts.length - 1];
            if (dotCount > 1 || lastPart.length === 3) {
                amountStr = amountStr.replace(/\./g, '');
            }
        }
        
        const amount = parseFloat(amountStr);
        if (isNaN(amount)) return;

        // Normalize date to YYYY-MM-DD
        let formattedDate = dateStrRaw;
        if (dateStrRaw.includes('/')) {
            const parts = dateStrRaw.split('/');
            // Assume DD/MM/YYYY if parts[0] > 12 or if year is last
            if (parts[2].length === 4) {
                 formattedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            } else {
                 // Fallback or other formats, try to parse
                 const d = new Date(dateStrRaw);
                 if (!isNaN(d.getTime())) formattedDate = d.toISOString().split('T')[0];
            }
        } else if (dateStrRaw.includes('-')) {
             // Ensure YYYY-MM-DD
             const parts = dateStrRaw.split('-');
             if (parts[0].length === 2 && parts[2].length === 4) {
                  // DD-MM-YYYY -> YYYY-MM-DD
                  formattedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
             }
        }

        const description = descVal ? descVal.toString().trim() : 'Sin concepto';

        const isDuplicate = existingInAcc.some(t => 
            t.date === formattedDate && 
            Math.abs(t.amount - amount) < 0.005
        );

        props.push({
            id: generateId(),
            date: formattedDate,
            description: description,
            amount: amount,
            accountId: importAccount, 
            categoryId: findSuggestedCategory(description),
            type: amount < 0 ? 'EXPENSE' : 'INCOME',
            isValidated: false,
            isDuplicate: isDuplicate
        });
    });

    const hasDuplicates = props.some(p => p.isDuplicate);

    setProposedTransactions(props);
    setSelectedImportIds(new Set());
    setImportStep(hasDuplicates ? 2 : 3);
  };

  const handleStartAnalysis = (rawData: string) => {
    if (!importAccount) { alert("Selecciona una cuenta primero."); return; }
    if (!rawData.trim()) return;

    const lines = rawData.split('\n').filter(l => l.trim());
    const parsedRows: any[][] = [];

    // Regex for Date (DD/MM/YYYY or DD-MM-YYYY) at the start
    const dateRegex = /^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/;
    
    // Regex for Amount (European format: xx.xxx,xx or similar) at the end
    // Matches: -1.200,00 | 1.200,00 | 1200,00 | -50 | 50,5
    const amountRegex = /([\+\-]?\s*(?:(?:\d{1,3}(?:\.\d{3})+)|(?:\d+))(?:,\d{1,2})?)$/;

    lines.forEach(line => {
        const trimmed = line.trim();
        
        const dateMatch = trimmed.match(dateRegex);
        const amountMatch = trimmed.match(amountRegex);

        if (dateMatch && amountMatch) {
            const dateStr = dateMatch[1];
            const amountStr = amountMatch[1];
            
            // Ensure valid range
            if (dateStr.length + amountStr.length < trimmed.length) {
                let description = trimmed.substring(dateStr.length, trimmed.length - amountStr.length).trim();
                
                // Remove common separators from the description boundaries
                description = description.replace(/^[\s;\t\|\-]+|[\s;\t\|\-]+$/g, '');
                
                if (!description) description = "Sin concepto";
                
                parsedRows.push([dateStr, description, amountStr]);
                return;
            }
        }
        
        // Fallback: Try simple split if strict regex fails
        if (trimmed.includes('\t')) {
            const parts = trimmed.split('\t');
            if (parts.length >= 3) parsedRows.push(parts);
        } else if (trimmed.includes(';')) {
            const parts = trimmed.split(';');
            if (parts.length >= 3) parsedRows.push(parts);
        }
    });

    if (parsedRows.length > 0) {
        processRows(parsedRows);
    } else {
        // Last resort: Try XLSX parsing for pasted Excel data that might not match the strict text rules
        try {
            const wb = XLSX.read(rawData, { type: 'string', raw: true });
            if (wb.SheetNames.length > 0) {
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
                if (rows.length > 0) processRows(rows);
            }
        } catch (e) {
            console.warn("Analysis failed", e);
        }
    }
  };

  const handleImportFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      if (file.name.toLowerCase().endsWith('.csv')) {
          reader.onload = (evt) => {
              const text = evt.target?.result as string;
              handleStartAnalysis(text);
          };
          reader.readAsText(file);
      } else {
          reader.onload = (evt) => {
              try {
                  const data = evt.target?.result;
                  const wb = XLSX.read(data, { type: 'array' });
                  const wsname = wb.SheetNames[0];
                  const ws = wb.Sheets[wsname];
                  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
                  processRows(rows as any[][]);
              } catch (err) {
                  console.error(err);
                  alert("Error leyendo el archivo. Asegúrate de que es un formato válido (.xlsx, .xls, .csv).");
              }
          };
          reader.readAsArrayBuffer(file);
      }
      e.target.value = '';
  };

  const handleFinalImport = () => {
    const validTransactions = proposedTransactions.filter(p => 
      !p.isDuplicate && 
      ((p.categoryId && p.categoryId !== '') || (p.type === 'TRANSFER' && p.transferAccountId))
    );
    
    const pendingTransactions = proposedTransactions.filter(p => 
      p.isDuplicate || 
      !((p.categoryId && p.categoryId !== '') || (p.type === 'TRANSFER' && p.transferAccountId))
    );

    if (validTransactions.length === 0 && pendingTransactions.length > 0) {
        const hasBlockedDuplicates = pendingTransactions.some(p => p.isDuplicate);
        if (hasBlockedDuplicates) {
            alert("Hay movimientos marcados como duplicados. Debes aceptarlos individualmente o en bloque para poder importarlos.");
        } else {
            alert("Asigna categorías o cuentas de destino a los movimientos pendientes para poder importarlos.");
        }
        return;
    }
    
    if (validTransactions.length === 0) { setIsImportModalOpen(false); return; }

    const newTxs: Transaction[] = validTransactions.map(p => {
      let amt = Math.abs(p.amount);
      if (p.type === 'EXPENSE') amt = -amt;
      return {
        id: generateId(),
        date: p.date,
        amount: amt,
        description: p.description,
        accountId: p.accountId, 
        type: p.type,
        categoryId: p.categoryId,
        familyId: indices.cat.get(p.categoryId)?.familyId || '',
        transferAccountId: p.type === 'TRANSFER' ? p.transferAccountId : undefined,
        attachment: p.attachment
      };
    });

    onUpdateData({ transactions: [...newTxs, ...data.transactions] });
    if (pendingTransactions.length > 0) {
        setProposedTransactions(pendingTransactions);
        setSelectedImportIds(new Set());
        alert(`Se han importado ${validTransactions.length} movimientos correctamente.\n\nQuedan ${pendingTransactions.length} movimientos sin asignar o bloqueados como duplicados.`);
    } else {
        setIsImportModalOpen(false);
        setProposedTransactions([]);
        setSelectedImportIds(new Set());
        resetForm();
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
      const newSet = new Set(selectedImportIds);
      if (allSelected) { allIds.forEach(id => newSet.delete(id)); } else { allIds.forEach(id => newSet.add(id)); }
      setSelectedImportIds(newSet);
  };

  const handleBulkImportDelete = () => {
      const remaining = proposedTransactions.filter(p => !selectedImportIds.has(p.id));
      setProposedTransactions(remaining);
      setSelectedImportIds(new Set());
  };

  const handleBulkImportAssign = () => {
      if (!bulkImportCategory) return;
      const updated = proposedTransactions.map(p => {
          if (selectedImportIds.has(p.id)) { return { ...p, categoryId: bulkImportCategory }; }
          return p;
      });
      setProposedTransactions(updated);
      setBulkImportCategory('');
      setSelectedImportIds(new Set());
  };

  const handleBulkAcceptDuplicates = () => {
      const updated = proposedTransactions.map(p => {
          if (selectedImportIds.has(p.id) && p.isDuplicate) {
              return { ...p, isDuplicate: false };
          }
          return p;
      });
      setProposedTransactions(updated);
      setSelectedImportIds(new Set());
  };

  const handleRowImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && attachingImportId) {
          try {
              const compressed = await compressImage(file);
              setProposedTransactions(prev => prev.map(p => p.id === attachingImportId ? { ...p, attachment: compressed } : p ));
          } catch (err) {
              console.error("Compression error", err);
          } finally {
              setAttachingImportId(null);
          }
      }
      e.target.value = '';
  };

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
      if (allSelected) { allPageIds.forEach(id => newSet.delete(id)); } else { allPageIds.forEach(id => newSet.add(id)); }
      setSelectedIds(newSet);
  };

  const handleBulkAction = () => {
      if (bulkEditTarget === 'DELETE') {
          if (confirm(`¿Estás seguro de borrar ${selectedIds.size} movimientos?`)) {
              const remaining = data.transactions.filter(t => !selectedIds.has(t.id));
              onUpdateData({ transactions: remaining });
              setSelectedIds(new Set());
              setIsBulkEditModalOpen(false);
          }
      } else {
          if (!bulkEditValue) return;
          let updatedTxs = data.transactions.map(t => {
              if (selectedIds.has(t.id)) {
                  const updates: Partial<Transaction> = {};
                  if (bulkEditTarget === 'DATE') updates.date = bulkEditValue;
                  else if (bulkEditTarget === 'ACCOUNT') updates.accountId = bulkEditValue;
                  else if (bulkEditTarget === 'CATEGORY') {
                      updates.categoryId = bulkEditValue;
                      const cat = indices.cat.get(bulkEditValue);
                      if (cat) updates.familyId = cat.familyId;
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
    const buildGroupedOptions = (ids: Set<string>) => {
      const groupsMap = new Map<string, { label: string, options: { id: string, name: string }[] }>();
      ids.forEach(id => {
        let groupLabel = 'Otros';
        let itemName = 'Desconocido';
        if (indices.cat.has(id)) {
          const cat = indices.cat.get(id)!; itemName = cat.name; const fam = indices.fam.get(cat.familyId); groupLabel = fam ? `Fam: ${fam.name}` : 'Sin Familia';
        } else if (indices.acc.has(id)) {
          const acc = indices.acc.get(id)!; itemName = acc.name; const grp = indices.grp.get(acc.groupId); groupLabel = grp ? `Grp: ${grp.name}` : 'Sin Grupo';
        }
        if (!groupsMap.has(groupLabel)) { groupsMap.set(groupLabel, { label: groupLabel, options: [] }); }
        groupsMap.get(groupLabel)!.options.push({ id, name: itemName });
      });
      const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => a.label.localeCompare(b.label));
      sortedGroups.forEach(g => g.options.sort((a, b) => a.name.localeCompare(b.name)));
      return sortedGroups;
    };
    return { entryGroups: buildGroupedOptions(entryIds), exitGroups: buildGroupedOptions(exitIds) };
  }, [timeFilteredList, indices]);

  const filteredList = useMemo(() => {
    const descPattern = colFilterDesc.trim().toLowerCase();
    const v1 = parseFloat(colFilterAmountVal1);
    return timeFilteredList.filter(t => {
      const hasEntryFilter = colFilterEntry !== 'ALL';
      const hasExitFilter = colFilterExit !== 'ALL';
      if (hasEntryFilter || hasExitFilter) {
          let matchEntry = false; let matchExit = false;
          const isIdInTransaction = (id: string, tx: Transaction) => {
              return tx.accountId === id || tx.categoryId === id || (tx.type === 'TRANSFER' && tx.transferAccountId === id);
          };
          if (hasEntryFilter) { if (isIdInTransaction(colFilterEntry, t)) matchEntry = true; }
          if (hasExitFilter) { if (isIdInTransaction(colFilterExit, t)) matchExit = true; }
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
      else if (sortField === 'CATEGORY' || sortField === 'ACCOUNT') { vA = a.description; vB = b.description; }
      if (vA < vB) return sortDirection === 'ASC' ? -1 : 1;
      if (vA > vB) return sortDirection === 'ASC' ? 1 : -1;
      // Secondary sort by ID to ensure stable order matching running balance calculation
      return sortDirection === 'ASC' ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id);
    });
  }, [filteredList, sortField, sortDirection]);

  const activeFilterId = useMemo(() => {
    const hasEntry = colFilterEntry !== 'ALL';
    const hasExit = colFilterExit !== 'ALL';
    if (hasEntry && !hasExit) return colFilterEntry;
    if (!hasEntry && hasExit) return colFilterExit;
    if (hasEntry && hasExit && colFilterEntry === colFilterExit) return colFilterEntry;
    return null;
  }, [colFilterEntry, colFilterExit]);

  const runningBalances = useMemo(() => {
    const balances = new Map<string, number>();
    if (!activeFilterId) return balances;

    const isAccount = indices.acc.has(activeFilterId);
    const isCategory = indices.cat.has(activeFilterId);

    if (isAccount) {
      const acc = indices.acc.get(activeFilterId)!;
      let current = acc.initialBalance;
      const allTxs = [...data.transactions].sort((a, b) => {
        const dateComp = a.date.localeCompare(b.date);
        if (dateComp !== 0) return dateComp;
        return a.id.localeCompare(b.id);
      });
      allTxs.forEach(t => {
        if (t.accountId === activeFilterId) {
          if (t.type === 'TRANSFER') current -= t.amount;
          else current += t.amount;
        } else if (t.transferAccountId === activeFilterId) {
          current += t.amount;
        }
        balances.set(t.id, current);
      });
    } else if (isCategory) {
      let current = 0;
      const chronological = [...sortedTransactions].sort((a, b) => {
        const dateComp = a.date.localeCompare(b.date);
        if (dateComp !== 0) return dateComp;
        return a.id.localeCompare(b.id);
      });
      chronological.forEach(t => {
        current += t.amount;
        balances.set(t.id, current);
      });
    }
    return balances;
  }, [activeFilterId, data.transactions, sortedTransactions, indices]);

  const totalItems = sortedTransactions.length;
  const totalPages = itemsPerPage === -1 ? 1 : Math.ceil(totalItems / itemsPerPage);
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return itemsPerPage === -1 ? sortedTransactions : sortedTransactions.slice(start, start + itemsPerPage);
  }, [sortedTransactions, currentPage, itemsPerPage]);

  const activeFiltersChips = useMemo(() => {
    const chips: { id: string, label: string, onRemove: () => void }[] = [];
    if (colFilterEntry !== 'ALL') { const name = indices.cat.get(colFilterEntry)?.name || indices.acc.get(colFilterEntry)?.name || '...'; chips.push({ id: 'entry', label: `Filtro: ${name}`, onRemove: () => setColFilterEntry('ALL') }); }
    if (colFilterExit !== 'ALL') { const name = indices.cat.get(colFilterExit)?.name || indices.acc.get(colFilterExit)?.name || '...'; chips.push({ id: 'exit', label: `Filtro: ${name}`, onRemove: () => setColFilterExit('ALL') }); }
    if (colFilterDesc) chips.push({ id: 'desc', label: `Texto: "${colFilterDesc}"`, onRemove: () => setColFilterDesc('') });
    if (colFilterClip !== 'ALL') chips.push({ id: 'clip', label: `Clip: ${colFilterClip}`, onRemove: () => setColFilterClip('ALL') });
    if (colFilterAmountOp !== 'ALL') chips.push({ id: 'amount', label: `Imp: ${colFilterAmountOp}`, onRemove: () => setColFilterAmountOp('ALL') });
    return chips;
  }, [colFilterEntry, colFilterExit, colFilterDesc, colFilterClip, colFilterAmountOp, indices]);

  const clearAllFilters = () => { setColFilterEntry('ALL'); setColFilterDesc(''); setColFilterClip('ALL'); setColFilterExit('ALL'); setColFilterAmountOp('ALL'); setColFilterAmountVal1(''); };
  const resetForm = () => { setEditingTx(null); setFType('EXPENSE'); setFAmount(''); setFDesc(''); setFDate(new Date().toISOString().split('T')[0]); setFAcc(data.accounts[0]?.id || ''); setFCat(''); setFTransferDest(''); setFAttachment(undefined); };
  
  const openEditor = (t?: Transaction) => { 
      if (t) { setEditingTx(t); setFType(t.type); setFAmount(Math.abs(t.amount).toString()); setFDesc(t.description); setFDate(t.date); setFAcc(t.accountId); setFCat(t.categoryId); setFTransferDest(t.transferAccountId || ''); setFAttachment(t.attachment); } else { resetForm(); }
      setIsModalOpen(true); 
  };

  const handleDuplicate = (t: Transaction) => {
      setEditingTx(null); setFType(t.type); setFAmount(Math.abs(t.amount).toString()); setFDesc(t.description + ' (Copia)'); setFDate(new Date().toISOString().split('T')[0]); setFAcc(t.accountId); setFCat(t.categoryId); setFTransferDest(t.transferAccountId || ''); setFAttachment(t.attachment); setActiveMenuTxId(null); setIsModalOpen(true);
  };

  const handleSaveRecurrent = () => {
      if (!recurrenceModalTx) return;
      
      if(!recDesc) { alert("Por favor, indica una descripción."); return; }
      if(!recAmount) { alert("Por favor, indica un importe."); return; }
      if(!recAccountId) { alert("Por favor, selecciona una cuenta de origen."); return; }
      if(recType === 'TRANSFER' && !recTransferAccountId) { alert("Por favor, selecciona una cuenta de destino para el traspaso."); return; }
      if(recType !== 'TRANSFER' && !recCategoryId) { alert("Por favor, selecciona una categoría."); return; }
      if(!recStartDate) { alert("Por favor, indica la fecha de inicio de la recurrencia."); return; }

      const interval = parseInt(recInterval) || 1;
      let amt = parseFloat(recAmount);
      if (recType === 'EXPENSE' || recType === 'TRANSFER') {
          amt = -Math.abs(amt);
      } else {
          amt = Math.abs(amt);
      }
      
      const newRec: RecurrentMovement = { 
          id: generateId(), 
          description: recDesc, 
          amount: amt, 
          type: recType, 
          accountId: recAccountId, 
          transferAccountId: recTransferAccountId || undefined, 
          familyId: recurrenceModalTx.familyId, 
          categoryId: recCategoryId, 
          frequency: recFreq, 
          interval: interval, 
          startDate: recStartDate, 
          nextDueDate: recStartDate, 
          endDate: recEndDate || undefined,
          active: true 
      };
      
      // Update familyId based on category if possible
      if (recCategoryId) {
          const cat = data.categories.find(c => c.id === recCategoryId);
          if (cat) newRec.familyId = cat.familyId;
      }

      onUpdateData({ recurrents: [...(data.recurrents || []), newRec] });
      setRecurrenceModalTx(null);
  };

  const handleSaveFavorite = () => {
      if (!favoriteModalTx || !favName) return;
      const t = favoriteModalTx;
      const newFav: FavoriteMovement = { id: generateId(), name: favName, description: t.description, amount: Math.abs(t.amount), type: t.type, accountId: t.accountId, transferAccountId: t.transferAccountId, categoryId: t.categoryId, familyId: t.familyId, icon: '⭐' };
      onUpdateData({ favorites: [...(data.favorites || []), newFav] });
      setFavoriteModalTx(null); setFavName('');
  };

  const handleSave = () => { 
      if (!fAmount || !fDesc || !fAcc || (fType !== 'TRANSFER' && !fCat)) return; 
      let amt = Math.abs(parseFloat(fAmount)); 
      if (fType === 'EXPENSE') amt = -amt; 
      // For INCOME and TRANSFER, amt remains positive
      const cat = indices.cat.get(fCat); 
      const tx: Transaction = { 
          id: editingTx ? editingTx.id : generateId(), 
          date: fDate, 
          amount: amt, 
          description: fDesc, 
          accountId: fAcc, 
          type: fType, 
          categoryId: fCat, 
          familyId: cat?.familyId || '', 
          attachment: fAttachment, 
          transferAccountId: fType === 'TRANSFER' ? fTransferDest : undefined 
      }; 
      if (editingTx) onUpdateTransaction(tx); 
      else onAddTransaction(tx); 
      setIsModalOpen(false); 
      resetForm(); 
      if (initialSpecificFilters?.action === 'NEW' && onFinished) {
          clearSpecificFilters?.();
          onFinished();
      }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setIsCompressing(true);
          try { const compressed = await compressImage(file); setFAttachment(compressed); } catch (err) { console.error("Compression error", err); } finally { setIsCompressing(false); }
      }
  };

  const formatDateDisplay = (dateStr: string) => { if (!dateStr) return '--/--/--'; const [y, m, d] = dateStr.split('-'); return `${d}/${m}/${y.slice(-2)}`; };
  const formatCurrency = (amount: number) => `${numberFormatter.format(amount)} €`;
  const getAmountColor = (amount: number, type?: TransactionType) => {
      if (type === 'TRANSFER') {
          const accountFilter = colFilterEntry !== 'ALL' ? colFilterEntry : (colFilterExit !== 'ALL' ? colFilterExit : null);
          if (!accountFilter) return 'text-slate-900 font-bold';
      }
      return amount > 0 ? 'text-emerald-600 font-bold' : amount < 0 ? 'text-rose-600 font-bold' : 'text-slate-400';
  };

  const getDisplayAmount = (t: Transaction) => {
      if (t.type !== 'TRANSFER') return t.amount;
      const accountFilter = colFilterEntry !== 'ALL' ? colFilterEntry : (colFilterExit !== 'ALL' ? colFilterExit : null);
      if (accountFilter) {
          if (t.accountId === accountFilter) return -Math.abs(t.amount);
          if (t.transferAccountId === accountFilter) return Math.abs(t.amount);
      }
      return Math.abs(t.amount);
  };
  const renderIcon = (iconStr: string, className = "w-4 h-4") => { if (iconStr?.startsWith('http') || iconStr?.startsWith('data:image')) return <img src={iconStr} className={`${className} object-contain rounded-lg`} referrerPolicy="no-referrer" />; return <span className="text-xs">{iconStr || '📂'}</span>; }
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={8} className="opacity-40" />;
    return sortDirection === 'ASC' ? <SortAsc size={8} className="text-indigo-600" /> : <SortDesc size={8} className="text-indigo-600" />;
  };

  const navigatePeriod = (direction: 'prev' | 'next') => {
    const newDate = new Date(filter.referenceDate); const step = direction === 'next' ? 1 : -1;
    if (filter.timeRange === 'MONTH') newDate.setMonth(newDate.getMonth() + step);
    else if (filter.timeRange === 'YEAR') newDate.setFullYear(newDate.getFullYear() + step);
    onUpdateFilter({ ...filter, referenceDate: newDate });
  };

  const years = Array.from({length: new Date().getFullYear() - 2015 + 5}, (_, i) => 2015 + i);
  const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const gridClasses = "grid grid-cols-[22px_45px_1fr_1.2fr_12px_1fr_55px_0px_20px] sm:grid-cols-[25px_65px_1fr_1.4fr_20px_1fr_65px_60px_25px] md:grid-cols-[25px_75px_1fr_1.4fr_25px_1fr_75px_75px_30px] gap-1.5 sm:gap-2 md:gap-2 items-center";

  const duplicateProps = useMemo(() => proposedTransactions.filter(p => p.isDuplicate), [proposedTransactions]);
  const normalProps = useMemo(() => proposedTransactions.filter(p => !p.isDuplicate), [proposedTransactions]);

  const anyDuplicateSelected = useMemo(() => {
      return Array.from(selectedImportIds).some(id => proposedTransactions.find(p => p.id === id)?.isDuplicate);
  }, [selectedImportIds, proposedTransactions]);

  const handleExportExcel = () => {
      const exportData = sortedTransactions.map(t => {
          const displayAmount = getDisplayAmount(t);
          const row: any = {
              Fecha: formatDateDisplay(t.date),
              Concepto: t.description,
              Cuenta: indices.acc.get(t.accountId)?.name || 'N/A',
              Categoría: indices.cat.get(t.categoryId)?.name || (t.type === 'TRANSFER' ? 'Traspaso' : 'N/A'),
              Importe: displayAmount,
              Tipo: t.type === 'EXPENSE' ? 'Gasto' : t.type === 'INCOME' ? 'Ingreso' : 'Traspaso'
          };
          if (activeFilterId) {
              row.Saldo = runningBalances.get(t.id) || 0;
          }
          return row;
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Movimientos");
      XLSX.writeFile(wb, `movimientos_${currentBook.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportPDF = () => {
      const doc = new jsPDF();
      
      // Add title
      doc.setFontSize(18);
      doc.text(`Diario de Movimientos - ${currentBook.name}`, 14, 22);
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Generado el ${new Date().toLocaleString()}`, 14, 30);
      
      const headers = ['Fecha', 'Concepto', 'Cuenta', 'Categoría', 'Importe'];
      if (activeFilterId) headers.push('Saldo');

      const tableData = sortedTransactions.map(t => {
          const displayAmount = getDisplayAmount(t);
          const row = [
              formatDateDisplay(t.date),
              t.description,
              indices.acc.get(t.accountId)?.name || 'N/A',
              indices.cat.get(t.categoryId)?.name || (t.type === 'TRANSFER' ? 'Traspaso' : 'N/A'),
              formatCurrency(displayAmount)
          ];
          if (activeFilterId) {
              row.push(formatCurrency(runningBalances.get(t.id) || 0));
          }
          return row;
      });

      autoTable(doc, {
          startY: 35,
          head: [headers],
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' }, // Slate-900
          styles: { fontSize: 8, cellPadding: 1.5 },
          columnStyles: {
              0: { cellWidth: 22 },
              4: { halign: 'right', minCellWidth: 25 },
              5: activeFilterId ? { halign: 'right', minCellWidth: 25 } : undefined
          }
      });

      doc.save(`movimientos_${currentBook.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-6 md:space-y-10 pb-24 animate-in fade-in duration-500" onClick={() => { setActiveMenuTxId(null); setOpenSelectorId(null); }}>
      <div className="flex flex-col xl:flex-row justify-between xl:items-end gap-8 print:hidden">
        <div className="space-y-4 text-center md:text-left w-full xl:w-auto">
          <div className="flex items-center justify-center md:justify-start gap-6">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-3xl shadow-sm border border-slate-100 p-1.5 shrink-0 overflow-hidden">
                  <img src={displayLogo} className="w-full h-full object-cover rounded-2xl" onError={(e) => e.currentTarget.src = "/contamiki.jpg"} />
              </div>
              <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter">Diario.</h2>
          </div>
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
                <div className="relative">
                    <button onClick={(e) => { e.stopPropagation(); setShowFavoritesList(!showFavoritesList); }} className="w-12 h-12 bg-amber-50 text-amber-600 border border-amber-100 rounded-xl shadow-sm hover:bg-amber-100 flex items-center justify-center transition-all active:scale-95" title="Favoritos"><Heart size={20} fill={showFavoritesList ? "currentColor" : "none"} /></button>
                    {showFavoritesList && (
                        <>
                            <div className="fixed inset-0 z-10 bg-slate-900/20 backdrop-blur-[1px] md:bg-transparent md:backdrop-blur-none" onClick={() => setShowFavoritesList(false)}></div>
                            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:absolute md:top-full md:right-0 md:left-auto md:translate-x-0 md:translate-y-0 md:mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 w-[85vw] max-w-xs md:w-64 p-2 z-20 animate-in fade-in zoom-in duration-200 origin-center md:origin-top-right">
                                <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center md:text-left">Plantillas Rápidas</div>
                                <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-1">
                                    {data.favorites && data.favorites.length > 0 ? (
                                        data.favorites.map(fav => (
                                            <button key={fav.id} onClick={() => handleUseFavorite(fav)} className="w-full flex items-center gap-3 px-3 py-3 md:py-2 rounded-xl hover:bg-amber-50 text-left transition-colors group">
                                                <div className="bg-amber-100 text-amber-600 p-1.5 rounded-lg group-hover:bg-amber-200 transition-colors">{renderIcon(fav.icon || '⭐', "w-4 h-4")}</div>
                                                <div className="flex-1 min-w-0"><div className="text-xs font-bold text-slate-700 truncate">{fav.name}</div><div className="text-[9px] text-slate-400 font-medium truncate">{fav.description}</div></div>
                                            </button>
                                        ))
                                    ) : ( <div className="p-4 text-center text-slate-400 text-xs">No hay favoritos.</div> )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
                <button onClick={(e) => { e.stopPropagation(); setImportAccount(data.accounts[0]?.id || ''); setImportStep(1); setIsImportModalOpen(true); }} className="w-12 h-12 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl shadow-sm hover:bg-indigo-100 flex items-center justify-center transition-all active:scale-95" title="Importador Inteligente"><Bot size={20} /></button>
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button onClick={(e) => { e.stopPropagation(); handleExportExcel(); }} className="w-10 h-10 bg-white text-emerald-600 rounded-lg shadow-sm hover:bg-emerald-50 flex items-center justify-center transition-all active:scale-95" title="Exportar Excel">
                        <div className="relative">
                            <FileSpreadsheet size={18} />
                            <span className="absolute -bottom-1 -right-1 bg-emerald-600 text-white text-[6px] font-black px-0.5 rounded">XLS</span>
                        </div>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleExportPDF(); }} className="w-10 h-10 bg-white text-rose-600 rounded-lg shadow-sm hover:bg-rose-50 flex items-center justify-center transition-all active:scale-95" title="Exportar PDF">
                        <div className="relative">
                            <FileText size={18} />
                            <span className="absolute -bottom-1 -right-1 bg-rose-600 text-white text-[6px] font-black px-0.5 rounded">PDF</span>
                        </div>
                    </button>
                </div>
                <button onClick={(e) => { e.stopPropagation(); openEditor(); }} className="w-12 h-12 bg-slate-950 text-white rounded-xl shadow-lg hover:bg-slate-800 flex items-center justify-center transition-all active:scale-95" title="Nuevo Movimiento"><Plus size={20} /></button>
            </div>
          </div>
        </div>
      </div>

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

      <div className={`bg-slate-900/5 p-2 md:p-4 rounded-2xl border border-slate-100 ${gridClasses}`}>
          <div className="flex items-center justify-center"><button onClick={toggleSelectAllPage} className="text-slate-400 hover:text-indigo-600">{paginatedTransactions.length > 0 && paginatedTransactions.every(t => selectedIds.has(t.id)) ? <CheckSquare size={16}/> : <Square size={16}/>}</button></div>
          <div className="flex flex-col items-center justify-center"><button onClick={() => { if(sortField==='DATE') setSortDirection(sortDirection==='ASC'?'DESC':'ASC'); else setSortField('DATE'); }} className="text-[7px] sm:text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest inline-flex items-center gap-0.5">Fec <SortIcon field="DATE"/></button></div>
          <div className="flex flex-col"><span className="hidden md:block text-[7px] sm:text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Filtro A</span><select className="w-full bg-white border border-slate-200 rounded-lg text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] font-bold py-0.5 md:py-1 outline-none truncate" value={colFilterEntry} onChange={e => setColFilterEntry(e.target.value)}><option value="ALL">Todo</option>{activeDropdownOptions.entryGroups.map(group => (<optgroup key={group.label} label={group.label}>{group.options.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}</optgroup>))}</select></div>
          <div className="flex flex-col"><span className="hidden md:block text-[7px] sm:text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Concepto</span><input type="text" className="w-full bg-white border border-slate-200 rounded-lg text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] font-bold py-0.5 md:py-1 px-1 md:px-2 outline-none" placeholder="..." value={colFilterDesc} onChange={e => setColFilterDesc(e.target.value)} /></div>
          <div className="flex flex-col"><span className="hidden md:block text-[7px] sm:text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Clip</span><select className="bg-white border border-slate-200 rounded-lg text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] font-black uppercase py-0.5 md:py-1 outline-none" value={colFilterClip} onChange={e => setColFilterClip(e.target.value as any)}><option value="ALL">.</option><option value="YES">SI</option><option value="NO">NO</option></select></div>
          <div className="flex flex-col"><span className="hidden md:block text-[7px] sm:text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Filtro B</span><select className="w-full bg-white border border-slate-200 rounded-lg text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] font-bold py-0.5 md:py-1 outline-none truncate" value={colFilterExit} onChange={e => setColFilterExit(e.target.value)}><option value="ALL">Todo</option>{activeDropdownOptions.exitGroups.map(group => (<optgroup key={group.label} label={group.label}>{group.options.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}</optgroup>))}</select></div>
          <div className="flex flex-col"><button onClick={() => { if(sortField==='AMOUNT') setSortDirection(sortDirection==='ASC'?'DESC':'ASC'); else setSortField('AMOUNT'); }} className="text-[7px] sm:text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-end gap-0.5">Imp <SortIcon field="AMOUNT"/></button>
            <div className="flex gap-0.5">
              <select className="bg-white border border-slate-200 rounded-lg text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] font-black uppercase py-0.5 md:py-1 outline-none text-right flex-1" value={colFilterAmountOp} onChange={e => setColFilterAmountOp(e.target.value as any)}>
                <option value="ALL">...</option>
                <option value="GT">{">"}</option>
                <option value="LT">{"<"}</option>
                <option value="EQ">{"="}</option>
              </select>
              {colFilterAmountOp !== 'ALL' && (
                <input 
                  type="number" 
                  className="w-8 md:w-12 bg-white border border-slate-200 rounded-lg text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] font-bold py-0.5 md:py-1 px-1 outline-none text-right" 
                  placeholder="0" 
                  value={colFilterAmountVal1} 
                  onChange={e => setColFilterAmountVal1(e.target.value)} 
                />
              )}
            </div>
          </div>
          <div className="hidden sm:flex flex-col items-end justify-center">
            {activeFilterId && <span className="text-[7px] sm:text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest">Saldo</span>}
          </div>
           <div className="flex justify-center"><button onClick={clearAllFilters} className="text-slate-300 hover:text-rose-500 transition-colors p-1"><Eraser size={14}/></button></div>
      </div>

      <div className="space-y-1.5 md:space-y-2.5">
        {paginatedTransactions.map(t => {
          const srcAcc = indices.acc.get(t.accountId); const dstAcc = t.transferAccountId ? indices.acc.get(t.transferAccountId) : null; const cat = indices.cat.get(t.categoryId); const isSelected = selectedIds.has(t.id);
          let debitNode, creditNode; let debitId = '', creditId = '';
          let typeColorClass = 'text-slate-900'; if (t.type === 'EXPENSE') typeColorClass = 'text-rose-600'; else if (t.type === 'INCOME') typeColorClass = 'text-emerald-600';
          if (t.type === 'TRANSFER') {
            debitId = t.transferAccountId || ''; creditId = t.accountId;
            debitNode = <div className={`flex items-center gap-1 font-bold line-clamp-2 leading-tight cursor-pointer hover:underline ${typeColorClass}`} onClick={(e) => {e.stopPropagation(); setColFilterEntry(debitId);}}>{renderIcon(dstAcc?.icon || '🏦')} <span className="line-clamp-2">{dstAcc?.name}</span></div>;
            creditNode = <div className={`flex items-center gap-1 font-bold line-clamp-2 leading-tight cursor-pointer hover:underline ${typeColorClass}`} onClick={(e) => {e.stopPropagation(); setColFilterExit(creditId);}}>{renderIcon(srcAcc?.icon || '🏦')} <span className="line-clamp-2">{srcAcc?.name}</span></div>;
          } else if (t.type === 'INCOME') {
            debitId = t.accountId; creditId = t.categoryId;
            debitNode = <div className={`flex items-center gap-1 font-bold line-clamp-2 leading-tight cursor-pointer hover:underline ${typeColorClass}`} onClick={(e) => {e.stopPropagation(); setColFilterEntry(debitId);}}>{renderIcon(srcAcc?.icon || '🏦')} <span className="line-clamp-2">{srcAcc?.name}</span></div>;
            creditNode = <div className={`flex items-center gap-1 font-bold line-clamp-2 leading-tight cursor-pointer hover:underline ${typeColorClass}`} onClick={(e) => {e.stopPropagation(); setColFilterExit(creditId);}}>{renderIcon(cat?.icon || '🏷️')} <span className="line-clamp-2">{cat?.name || 'S/C'}</span></div>;
          } else {
            debitId = t.categoryId; creditId = t.accountId;
            debitNode = <div className={`flex items-center gap-1 font-bold line-clamp-2 leading-tight cursor-pointer hover:underline ${typeColorClass}`} onClick={(e) => {e.stopPropagation(); setColFilterEntry(debitId);}}>{renderIcon(cat?.icon || '🏷️')} <span className="line-clamp-2">{cat?.name}</span></div>;
            creditNode = <div className={`flex items-center gap-1 font-bold line-clamp-2 leading-tight cursor-pointer hover:underline ${typeColorClass}`} onClick={(e) => {e.stopPropagation(); setColFilterExit(creditId);}}>{renderIcon(srcAcc?.icon || '🏦')} <span className="line-clamp-2">{srcAcc?.name}</span></div>;
          }
          const balance = runningBalances.get(t.id) || 0;
          const displayAmt = getDisplayAmount(t);
          return (
            <div key={t.id} className={`group bg-white p-2 md:p-4 md:px-6 rounded-2xl border ${isSelected ? 'border-indigo-400 bg-indigo-50/30' : 'border-slate-100'} hover:shadow-lg transition-all relative`}>
                <div className={gridClasses}>
                    <div className="flex justify-center"><button onClick={(e) => { e.stopPropagation(); toggleSelection(t.id); }} className={`text-slate-400 ${isSelected ? 'text-indigo-600' : 'hover:text-indigo-600'}`}>{isSelected ? <CheckSquare size={16} /> : <Square size={16} />}</button></div>
                    <div className="text-left text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] font-black text-slate-400 uppercase tracking-tighter leading-none truncate">{formatDateDisplay(t.date)}</div>
                    <div className="min-w-0 text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] pr-1 sm:pr-0 leading-tight">{debitNode}</div>
                    <div className="min-w-0 text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] font-bold text-slate-800 uppercase line-clamp-2 leading-tight cursor-pointer hover:text-indigo-600 pl-0.5 sm:pl-0" onClick={(e) => {e.stopPropagation(); setColFilterDesc(t.description);}} title={t.description}>{t.description}</div>
                    <div className="flex justify-center">{t.attachment ? ( <button onClick={(e) => { e.stopPropagation(); setPreviewAttachment(t.attachment || null); }} className="p-1 hover:bg-indigo-50 rounded-full text-indigo-500 transition-colors"><Paperclip size={12} className="md:size-4"/></button> ) : <div className="w-1 md:w-2" />}</div>
                    <div className="min-w-0 text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] pr-1 sm:pr-0 leading-tight">{creditNode}</div>
                    <div className={`text-right text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] font-black font-mono tracking-tighter truncate ${getAmountColor(displayAmt, t.type)} pl-0.5 sm:pl-0`}>{formatCurrency(displayAmt)}</div>
                    <div className={`hidden sm:block text-right text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] font-black font-mono tracking-tighter truncate ${activeFilterId ? (balance >= 0 ? 'text-slate-400' : 'text-rose-400') : 'opacity-0'}`}>{activeFilterId ? formatCurrency(balance) : ''}</div>
                    <div className="flex justify-center relative"><button onClick={(e) => { e.stopPropagation(); setActiveMenuTxId(activeMenuTxId === t.id ? null : t.id); }} className="p-1.5 md:p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><MoreVertical size={16} /></button>
                        {activeMenuTxId === t.id && (
                            <div className="absolute top-8 right-0 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 min-w-[180px] p-2 flex flex-col gap-1 animate-in fade-in zoom-in duration-200 origin-top-right" onClick={e => e.stopPropagation()}>
                                <button onClick={() => { setActiveMenuTxId(null); openEditor(t); }} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl text-left transition-colors"><Edit3 size={14} className="text-indigo-600"/> <span className="text-[10px] font-bold text-slate-600 uppercase">Editar</span></button>
                                <button onClick={() => handleDuplicate(t)} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl text-left transition-colors"><Copy size={14} className="text-slate-500"/> <span className="text-[10px] font-bold text-slate-600 uppercase">Duplicar</span></button>
                                <button onClick={() => { setActiveMenuTxId(null); openRecurrenceModal(t); }} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl text-left transition-colors"><Repeat size={14} className="text-emerald-500"/> <span className="text-[10px] font-bold text-slate-600 uppercase">Hacer Recurrente</span></button>
                                <button onClick={() => { setActiveMenuTxId(null); setFavoriteModalTx(t); setFavName(t.description); }} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl text-left transition-colors"><Heart size={14} className="text-amber-500"/> <span className="text-[10px] font-bold text-slate-600 uppercase">Guardar Favorito</span></button>
                                <div className="h-px bg-slate-100 my-1"/>
                                <button onClick={() => { setActiveMenuTxId(null); setDeleteConfirmId(t.id); }} className="flex items-center gap-3 px-3 py-2.5 hover:bg-rose-50 rounded-xl text-left transition-colors text-rose-500"><Trash2 size={14} /> <span className="text-[10px] font-bold uppercase">Borrar</span></button>
                            </div>
                        )}
                    </div>
                </div>
                {deleteConfirmId === t.id && (
                    <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-10 flex items-center justify-center gap-4 animate-in zoom-in-95 p-4 text-center"><p className="text-[10px] md:text-sm font-black uppercase text-slate-900">¿Borrar?</p><div className="flex gap-2"><button onClick={() => { onDeleteTransaction(t.id); setDeleteConfirmId(null); }} className="bg-rose-600 text-white px-3 py-1 md:px-5 md:py-2 rounded-xl font-black text-[9px] uppercase shadow-xl">Sí</button><button onClick={() => setDeleteConfirmId(null)} className="bg-slate-100 text-slate-500 px-3 py-1 md:px-5 md:py-2 rounded-xl font-black text-[9px] uppercase">No</button></div></div>
                )}
            </div>
          );
        })}
      </div>

      {totalItems > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mostrando {paginatedTransactions.length} de {totalItems} movimientos</span>
            <div className="flex items-center gap-4"><select className="bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase py-2 px-3 outline-none" value={itemsPerPage} onChange={(e) => setItemsPerPage(parseInt(e.target.value))}><option value={25}>25 por pág</option><option value={50}>50 por pág</option><option value={100}>100 por pág</option><option value={-1}>Ver Todos</option></select><div className="flex items-center gap-2"><button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"><ChevronLeft size={16} /></button><span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Pág {currentPage} / {totalPages}</span><button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"><ChevronRight size={16} /></button></div></div>
        </div>
      )}

      {selectedIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[150] animate-in slide-in-from-bottom-4 fade-in duration-300">
              <div className="bg-slate-950 text-white rounded-2xl shadow-2xl p-2 px-4 flex items-center gap-4 border border-white/10"><span className="text-[10px] font-black uppercase tracking-widest px-2">{selectedIds.size} Seleccionados</span><div className="h-6 w-px bg-white/20"></div><button onClick={() => { setBulkEditTarget('DATE'); setBulkEditValue(''); setIsBulkEditModalOpen(true); }} className="flex items-center gap-2 px-3 py-2 hover:bg-white/10 rounded-xl transition-all"><PenTool size={14}/> <span className="text-[10px] font-bold uppercase">Editar Bloque</span></button><button onClick={() => { setBulkEditTarget('DELETE'); setIsBulkEditModalOpen(true); }} className="flex items-center gap-2 px-3 py-2 bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-lg"><Trash2 size={14}/> <span className="text-[10px] font-bold uppercase">Borrar</span></button><button onClick={() => setSelectedIds(new Set())} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white"><X size={14}/></button></div>
          </div>
      )}

      {isBulkEditModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-sm p-8 space-y-6"><div className="flex justify-between items-center"><h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">{bulkEditTarget === 'DELETE' ? <Trash2 className="text-rose-500"/> : <LayoutList className="text-indigo-600"/>}{bulkEditTarget === 'DELETE' ? 'Borrado Masivo' : 'Edición en Bloque'}</h3><button onClick={() => setIsBulkEditModalOpen(false)} className="p-2 bg-slate-100 rounded-full hover:bg-rose-100 hover:text-rose-500"><X size={18} /></button></div>
                  {bulkEditTarget === 'DELETE' ? ( <p className="text-sm font-medium text-slate-600">Estás a punto de eliminar permanentemente <span className="font-black text-slate-900">{selectedIds.size}</span> movimientos. ¿Estás seguro?</p> ) : (
                      <div className="space-y-4"><p className="text-xs text-slate-500">Se actualizarán <span className="font-bold">{selectedIds.size}</span> elementos.</p>
                          <div className="flex bg-slate-100 p-1.5 rounded-xl"><button onClick={() => setBulkEditTarget('DATE')} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${bulkEditTarget === 'DATE' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>Fecha</button><button onClick={() => setBulkEditTarget('ACCOUNT')} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${bulkEditTarget === 'ACCOUNT' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>Cuenta</button><button onClick={() => setBulkEditTarget('CATEGORY')} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${bulkEditTarget === 'CATEGORY' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>Categoría</button></div>
                          {bulkEditTarget === 'DATE' && ( <input type="date" className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-indigo-500" value={bulkEditValue} onChange={e => setBulkEditValue(e.target.value)} /> )}
                          {bulkEditTarget === 'ACCOUNT' && ( <select className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-indigo-500" value={bulkEditValue} onChange={e => setBulkEditValue(e.target.value)}><option value="">Seleccionar Cuenta...</option>{groupedAccounts.map(g => (<optgroup key={g.group.id} label={g.group.name}>{g.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</optgroup>))}</select> )}
                          {bulkEditTarget === 'CATEGORY' && ( <select className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-indigo-500" value={bulkEditValue} onChange={e => setBulkEditValue(e.target.value)}><option value="">Seleccionar Categoría...</option>{groupedCategories.map(f => (<optgroup key={f.family.id} label={f.family.name}>{f.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>))}</select> )}
                      </div>
                  )}
                  <button onClick={handleBulkAction} disabled={bulkEditTarget !== 'DELETE' && !bulkEditValue} className={`w-full py-4 text-white rounded-xl font-black uppercase text-[11px] tracking-widest shadow-xl transition-all ${bulkEditTarget === 'DELETE' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50'}`}>{bulkEditTarget === 'DELETE' ? 'Confirmar Borrado' : 'Aplicar Cambios'}</button>
              </div>
          </div>
      )}

      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[200] p-4 animate-in fade-in duration-500" onClick={() => setIsImportModalOpen(false)}>
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl p-8 sm:p-12 relative max-h-[95vh] overflow-y-auto custom-scrollbar border border-white/20" onClick={e => e.stopPropagation()}>
            <button onClick={() => setIsImportModalOpen(false)} className="absolute top-8 right-8 p-3 bg-slate-50 text-slate-400 rounded-full hover:text-rose-500"><X size={24}/></button>
            <div className="flex items-center gap-4 mb-8">
                <div className="bg-indigo-600 p-4 rounded-3xl text-white shadow-xl shadow-indigo-600/20"><Bot size={28} /></div>
                <div><h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Importación Inteligente</h3><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Carga masiva con categorización automática</p></div>
            </div>

            {importStep === 1 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">1. ¿A qué cuenta imputamos los movimientos?</label>
                        <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none text-slate-800 focus:border-indigo-500" value={importAccount} onChange={e => setImportAccount(e.target.value)}>
                            {[...data.accountGroups].sort((a, b) => a.name.localeCompare(b.name)).map(group => {
                                const activeAccounts = data.accounts.filter(a => a.groupId === group.id && a.active !== false).sort((a, b) => a.name.localeCompare(b.name));
                                if (activeAccounts.length === 0) return null;
                                return ( <optgroup key={group.id} label={group.name}>{activeAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</optgroup> );
                            })}
                        </select>
                    </div>
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">2. Copia y Pega tus movimientos</label>
                        <textarea ref={rawImportTextRef} className="w-full h-40 p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] font-mono text-xs outline-none focus:border-indigo-500 transition-all resize-none shadow-inner" placeholder={`Formato esperado:\nDD/MM/AAAA; Concepto del movimiento; -50,00\nDD/MM/AAAA; Ingreso de Nómina; 1500,00\n...`} onBlur={(e) => handleStartAnalysis(e.target.value)} />
                        <div className="flex justify-between items-start">
                            <p className="text-[10px] text-slate-400 font-medium pl-2 max-w-[70%]">El sistema detectará automáticamente fecha, concepto e importe. Usa punto y coma (;) o tabuladores para separar.</p>
                            <button onClick={() => handleStartAnalysis(rawImportTextRef.current?.value || '')} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg flex items-center gap-2 -mt-2"><Sparkles size={14} /> Analizar Texto</button>
                        </div>
                    </div>
                    <div className="relative flex items-center justify-center py-4"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div><span className="relative bg-white px-4 text-[10px] font-black uppercase text-slate-300">O sube un archivo</span></div>
                    <div className="space-y-4">
                        <button onClick={() => importFileRef.current?.click()} className="w-full py-5 bg-white border-2 border-dashed border-indigo-200 text-indigo-500 rounded-3xl font-black uppercase text-[11px] tracking-widest hover:bg-indigo-50 transition-all flex flex-col items-center justify-center gap-2 group"><Upload size={24} className="group-hover:scale-110 transition-transform"/><span>Subir Archivo (.xlsx, .xls, .csv)</span></button>
                        <input type="file" ref={importFileRef} className="hidden" accept=".csv, .xlsx, .xls" onChange={handleImportFileUpload} />
                    </div>
                </div>
            )}

            {importStep === 2 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                    <div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl flex items-start gap-4">
                        <div className="bg-amber-100 p-3 rounded-2xl text-amber-600"><AlertTriangle size={24}/></div>
                        <div>
                            <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight">Posibles Duplicados</h4>
                            <p className="text-xs text-slate-500 mt-1 font-medium">Hemos detectado <span className="font-black text-slate-900">{duplicateProps.length}</span> movimientos que coinciden en fecha e importe con registros existentes. Revisa y decide qué hacer.</p>
                        </div>
                    </div>

                    <div className="space-y-4 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
                        {duplicateProps.map(t => (
                            <div key={t.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="bg-rose-50 text-rose-500 p-2 rounded-xl font-black text-[10px] uppercase tracking-widest w-12 text-center flex flex-col justify-center">
                                        <span>{t.date.split('-')[2]}</span>
                                        <span className="text-[8px] opacity-70">{months[parseInt(t.date.split('-')[1])-1]?.substring(0,3)}</span>
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-700 text-xs truncate max-w-[200px]" title={t.description}>{t.description}</div>
                                        <div className={`text-[10px] font-black ${getAmountColor(t.amount, t.type)}`}>{formatCurrency(t.amount)}</div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => { const newArr = [...proposedTransactions]; const idx = newArr.findIndex(p => p.id === t.id); if(idx !== -1) { newArr[idx].isDuplicate = false; setProposedTransactions(newArr); } }} className="px-3 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[9px] font-black uppercase hover:bg-emerald-100 transition-colors flex items-center gap-1"><CheckCircle2 size={12}/> Importar</button>
                                    <button onClick={() => setProposedTransactions(proposedTransactions.filter(p => p.id !== t.id))} className="px-3 py-2 bg-slate-50 text-slate-400 rounded-xl text-[9px] font-black uppercase hover:bg-rose-50 hover:text-rose-500 transition-colors flex items-center gap-1"><Trash2 size={12}/> Descartar</button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-4 pt-4 border-t border-slate-100">
                        <button onClick={() => { setProposedTransactions(proposedTransactions.filter(p => !p.isDuplicate)); setImportStep(3); }} className="w-full py-4 bg-slate-950 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-600 shadow-xl transition-all flex items-center justify-center gap-2">Continuar (Descartar Duplicados Restantes) <ArrowRightLeft size={16}/></button>
                    </div>
                </div>
            )}

            {importStep === 3 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 relative">
                    <div className="flex justify-between items-center px-2">
                        <div className="flex items-center gap-3">
                            <button onClick={toggleSelectAllImport} className="text-slate-400 hover:text-indigo-600">{proposedTransactions.length > 0 && proposedTransactions.every(p => selectedImportIds.has(p.id)) ? <CheckSquare size={16}/> : <Square size={16}/>}</button>
                            <span className="text-xs font-bold text-slate-500 uppercase">Revisión ({proposedTransactions.length})</span>
                        </div>
                        <div className="flex gap-2"><button onClick={() => { setProposedTransactions([]); setImportStep(1); setSelectedImportIds(new Set()); }} className="text-[10px] font-black uppercase text-rose-500 hover:underline">Descartar Todo</button></div>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto custom-scrollbar space-y-2 pr-2 pb-16">
                        {normalProps.length > 0 && (
                            <div className="space-y-2">
                                {normalProps.map((t) => {
                                    const isAssigned = !!t.categoryId || (t.type === 'TRANSFER' && t.transferAccountId);
                                    const idxInMaster = proposedTransactions.findIndex(pt => pt.id === t.id);
                                    
                                    return (
                                        <div key={t.id} className={`p-4 rounded-2xl flex items-center gap-4 bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all group`}>
                                            <button onClick={() => toggleImportSelection(t.id)} className={`text-slate-300 hover:text-indigo-600 flex-shrink-0 transition-colors`}>{selectedImportIds.has(t.id) ? <CheckSquare size={16} className="text-indigo-600"/> : <Square size={16}/>}</button>
                                            <div className="flex-1 min-w-0 grid grid-cols-[repeat(16,minmax(0,1fr))] gap-4 items-center">
                                                <div className="col-span-2 text-[10px] font-bold text-slate-400 whitespace-nowrap">
                                                    {formatDateDisplay(t.date)}
                                                </div>
                                                <input type="text" className="col-span-6 text-xs font-bold text-slate-800 bg-slate-50/50 hover:bg-white border-b border-slate-200 focus:border-indigo-500 rounded px-2 py-1 outline-none transition-all placeholder-slate-300" value={t.description} title={t.description} onChange={(e) => { const newArr = [...proposedTransactions]; newArr[idxInMaster].description = e.target.value; const newCat = findSuggestedCategory(e.target.value); if (newCat) { newArr[idxInMaster].categoryId = newCat; newArr[idxInMaster].transferAccountId = undefined; } setProposedTransactions(newArr); }} />
                                                <div className={`col-span-3 text-xs font-black text-right whitespace-nowrap ${getAmountColor(t.amount, t.type)}`}>{formatCurrency(t.amount)}</div>
                                                <div className="col-span-5 relative">
                                                    <button onClick={(e) => { e.stopPropagation(); if(openSelectorId === t.id) setOpenSelectorId(null); else { setOpenSelectorId(t.id); setSelectorSearchTerm(''); } }} className={`w-full border rounded-lg text-[11px] font-bold py-1.5 px-2 outline-none transition-colors flex items-center justify-between gap-2 ${isAssigned ? 'bg-indigo-50 border-indigo-100 text-indigo-700' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-300'}`}>
                                                        <span className="truncate">{t.type === 'TRANSFER' && t.transferAccountId ? `➡ ${indices.acc.get(t.transferAccountId)?.name || 'Cuenta...'}` : (indices.cat.get(t.categoryId)?.name || 'Sin Asignar')}</span><ChevronDown size={12} className="opacity-50"/>
                                                    </button>
                                                    {openSelectorId === t.id && (
                                                        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-[2px]" onClick={(e) => { e.stopPropagation(); setOpenSelectorId(null); }}>
                                                            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-[550px] max-w-[95vw] flex overflow-hidden text-left animate-in fade-in zoom-in-95 duration-200 max-h-[60vh]" onClick={e => e.stopPropagation()}>
                                                                <div className="flex-1 border-r border-slate-100 overflow-y-auto custom-scrollbar bg-slate-50/50">
                                                                    <div className="p-3 sticky top-0 bg-slate-50/95 backdrop-blur-sm border-b border-slate-100 z-10 space-y-2">
                                                                        <div className="font-black text-[10px] text-slate-400 uppercase tracking-widest text-center">Categorías Activas</div>
                                                                        <div className="relative">
                                                                            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400"/>
                                                                            <input 
                                                                                type="text" 
                                                                                autoFocus
                                                                                placeholder="Buscar..." 
                                                                                className="w-full pl-7 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:border-indigo-500 transition-all placeholder-slate-300"
                                                                                value={selectorSearchTerm}
                                                                                onChange={e => setSelectorSearchTerm(e.target.value)}
                                                                                onClick={e => e.stopPropagation()}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                    {activeGroupedCategories.map(f => {
                                                                        const matchingCats = f.categories.filter(c => !selectorSearchTerm || c.name.toLowerCase().includes(selectorSearchTerm.toLowerCase()) || f.family.name.toLowerCase().includes(selectorSearchTerm.toLowerCase()));
                                                                        if (matchingCats.length === 0) return null;
                                                                        return ( <div key={f.family.id}><div className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase bg-slate-100/50 sticky top-[88px] z-0">{f.family.name}</div>{matchingCats.map(c => ( <button key={c.id} onClick={() => { const newArr = [...proposedTransactions]; newArr[idxInMaster].categoryId = c.id; newArr[idxInMaster].transferAccountId = undefined; newArr[idxInMaster].type = newArr[idxInMaster].amount < 0 ? 'EXPENSE' : 'INCOME'; setProposedTransactions(newArr); setOpenSelectorId(null); }} className={`w-full text-left px-4 py-3 hover:bg-white hover:text-indigo-600 text-[11px] font-bold text-slate-600 truncate border-b border-slate-50 transition-colors flex items-center gap-3 ${t.categoryId === c.id ? 'bg-indigo-50 text-indigo-700' : ''}`}>{renderIcon(c.icon, "w-5 h-5")} <span>{c.name}</span></button> ))}</div> );
                                                                    })}
                                                                </div>
                                                                <div className="flex-1 overflow-y-auto custom-scrollbar bg-white"><div className="p-3 sticky top-0 bg-white/95 backdrop-blur-sm border-b border-slate-100 font-black text-[10px] text-slate-400 uppercase tracking-widest z-10 text-center">Traspasos Activos</div>{activeGroupedAccounts.map(g => { const availableAccs = g.accounts.filter(a => a.id !== importAccount); if (availableAccs.length === 0) return null; return ( <div key={g.group.id}><div className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase bg-slate-50 sticky top-9 z-0">{g.group.name}</div>{availableAccs.map(a => ( <button key={a.id} onClick={() => { const newArr = [...proposedTransactions]; newArr[idxInMaster].type = 'TRANSFER'; newArr[idxInMaster].transferAccountId = a.id; newArr[idxInMaster].categoryId = ''; setProposedTransactions(newArr); setOpenSelectorId(null); }} className={`w-full text-left px-4 py-3 hover:bg-slate-50 hover:text-emerald-600 text-[11px] font-bold text-slate-600 truncate border-b border-slate-50 transition-colors flex items-center gap-3 ${t.transferAccountId === a.id ? 'bg-emerald-50 text-emerald-700' : ''}`}>➡ {renderIcon(a.icon, "w-5 h-5")} <span>{a.name}</span></button> ))}</div> ); })}</div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <button onClick={() => setProposedTransactions(proposedTransactions.filter(pt => pt.id !== t.id))} className="text-slate-300 hover:text-rose-500 p-2 rounded-full hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100" title="Descartar"><X size={16}/></button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    {selectedImportIds.size > 0 && (
                        <div className="absolute bottom-20 left-0 right-0 z-10 flex justify-center animate-in slide-in-from-bottom-2 fade-in">
                            <div className="bg-slate-900 text-white rounded-xl shadow-xl p-2 px-3 flex items-center gap-3 border border-slate-700">
                                <span className="text-[9px] font-black uppercase whitespace-nowrap">{selectedImportIds.size} Items</span>
                                <div className="h-4 w-px bg-white/20"></div>
                                
                                {anyDuplicateSelected && (
                                    <button onClick={handleBulkAcceptDuplicates} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors text-[9px] font-bold uppercase">
                                        <Check size={14}/> Aceptar Duplicados
                                    </button>
                                )}

                                <select className="bg-slate-800 text-white text-[9px] font-bold py-1.5 px-2 rounded-lg outline-none border border-slate-700 max-w-[120px]" value={bulkImportCategory} onChange={(e) => setBulkImportCategory(e.target.value)}>
                                    <option value="">Asignar Categoría...</option>
                                    {groupedCategories.map(f => (<optgroup key={f.family.id} label={f.family.name}>{f.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>))}
                                </select>
                                <button onClick={handleBulkImportAssign} className="p-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors" disabled={!bulkImportCategory}><Check size={14}/></button>
                                <button onClick={handleBulkImportDelete} className="p-1.5 bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors"><Trash2 size={14}/></button>
                            </div>
                        </div>
                    )}
                    <div className="flex gap-4"><button onClick={handleFinalImport} className="flex-1 py-6 bg-slate-950 text-white rounded-[2rem] font-black uppercase text-[12px] tracking-widest shadow-2xl hover:bg-emerald-600 transition-all">Confirmar Importación ({proposedTransactions.filter(p => !p.isDuplicate && (p.categoryId || p.transferAccountId)).length})</button></div>
                    <input type="file" ref={rowImportFileRef} className="hidden" accept="image/*,application/pdf" onChange={handleRowImportFileChange} />
                </div>
            )}
          </div>
        </div>
      )}

      {isModalOpen && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[200] p-4 animate-in fade-in zoom-in duration-300">
              <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg p-10 relative border border-white/20 max-h-[95vh] overflow-y-auto custom-scrollbar">
                  <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 p-3 bg-slate-50 text-slate-400 rounded-full hover:text-rose-500 hover:bg-rose-50 transition-all"><X size={24}/></button>
                  <h3 className="text-2xl font-black text-slate-900 uppercase flex items-center gap-3 mb-8"><Edit3 className="text-indigo-600"/> {editingTx ? 'Editar Movimiento' : 'Nuevo Movimiento'}</h3>
                  <div className="space-y-6"><div className="bg-slate-100 p-1.5 rounded-2xl flex shadow-inner"><button onClick={() => setFType('EXPENSE')} className={`flex-1 py-4 text-[10px] font-black uppercase rounded-xl transition-all ${fType === 'EXPENSE' ? 'bg-white shadow-sm text-rose-500' : 'text-slate-400 hover:text-slate-600'}`}>Gasto</button><button onClick={() => setFType('INCOME')} className={`flex-1 py-4 text-[10px] font-black uppercase rounded-xl transition-all ${fType === 'INCOME' ? 'bg-white shadow-sm text-emerald-500' : 'text-slate-400 hover:text-slate-600'}`}>Ingreso</button><button onClick={() => { setFType('TRANSFER'); if(!fDesc) setFDesc('Traspaso'); }} className={`flex-1 py-4 text-[10px] font-black uppercase rounded-xl transition-all ${fType === 'TRANSFER' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>Traspaso</button></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Importe</label><div className="relative"><span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-black">€</span><input type="number" step="0.01" inputMode="decimal" placeholder="0.00" className="w-full pl-10 pr-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-xl outline-none focus:border-indigo-500 transition-all" value={fAmount} onChange={e => setFAmount(e.target.value)} autoFocus /></div></div>
                      <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Fecha</label><input type="date" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={fDate} onChange={e => setFDate(e.target.value)} /></div><div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">{fType === 'TRANSFER' ? 'Desde' : 'Cuenta'}</label><select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={fAcc} onChange={e => setFAcc(e.target.value)}>{groupedAccounts.map(g => (<optgroup key={g.group.id} label={g.group.name}>{g.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</optgroup>))}</select></div></div>
                      {fType === 'TRANSFER' ? ( <div className="space-y-2 animate-in slide-in-from-top-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Hacia Cuenta Destino</label><select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={fTransferDest} onChange={e => setFTransferDest(e.target.value)}><option value="">Selecciona destino...</option>{groupedAccounts.map(g => (<optgroup key={g.group.id} label={g.group.name}>{g.accounts.filter(a => a.id !== fAcc).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</optgroup>))}</select></div> ) : ( <div className="space-y-2 animate-in slide-in-from-top-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Categoría</label><select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={fCat} onChange={e => setFCat(e.target.value)}><option value="">Selecciona categoría...</option>{groupedCategories.map(f => (<optgroup key={f.family.id} label={f.family.name}>{f.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>))}</select></div> )}
                      <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Concepto</label><input type="text" placeholder="Ej: Compra semanal..." className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={fDesc} onChange={e => { setFDesc(e.target.value); if(!editingTx && !fCat && fType !== 'TRANSFER') { const sugg = findSuggestedCategory(e.target.value); if(sugg) setFCat(sugg); } }} /></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Comprobante (Opcional)</label><div className="flex items-center gap-3"><button onClick={() => fileInputRef.current?.click()} className="flex-1 py-4 bg-white border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-all font-bold uppercase text-[10px] flex justify-center items-center gap-2" disabled={isCompressing}>{isCompressing ? <span className="animate-spin">⏳</span> : <Paperclip size={16}/>}{fAttachment ? 'Cambiar Archivo' : 'Adjuntar Imagen'}</button>{fAttachment && ( <button onClick={() => setFAttachment(undefined)} className="p-4 bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-100"><Trash2 size={18}/></button> )}</div><input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} />{fAttachment && <p className="text-[10px] text-emerald-500 font-bold flex items-center gap-1"><Check size={12}/> Archivo listo para guardar</p>}</div>
                      <button onClick={handleSave} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] hover:bg-indigo-600 shadow-xl tracking-widest transition-all active:scale-95">{editingTx ? 'Actualizar Movimiento' : 'Guardar Movimiento'}</button>
                  </div>
              </div>
          </div>
      )}

      {recurrenceModalTx && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[200] p-4 animate-in fade-in zoom-in duration-300">
              <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl p-6 relative border border-white/20 max-h-[95vh] overflow-y-auto custom-scrollbar">
                  <button onClick={() => setRecurrenceModalTx(null)} className="absolute top-6 right-6 p-2 bg-slate-50 text-slate-400 rounded-full hover:text-rose-500 transition-colors"><X size={20}/></button>
                  <h3 className="text-xl font-black text-slate-900 uppercase flex items-center gap-2 mb-6"><CalendarClock className="text-indigo-600" size={24}/> Crear Recurrencia</h3>
                  
                  <div className="grid grid-cols-12 gap-4">
                      {/* Row 1: Description (8 cols) + Amount (4 cols) */}
                      <div className="col-span-12 sm:col-span-8 space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Descripción</label>
                          <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none text-sm focus:border-indigo-500 transition-colors" placeholder="Ej: Alquiler" value={recDesc} onChange={e => setRecDesc(e.target.value)} />
                      </div>
                      <div className="col-span-12 sm:col-span-4 space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Importe</label>
                          <input type="number" step="0.01" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none text-sm focus:border-indigo-500 transition-colors" placeholder="0.00" value={recAmount} onChange={e => setRecAmount(e.target.value)} />
                      </div>

                      {/* Row 2: Account (6 cols) + Destination (6 cols) */}
                      <div className="col-span-12 sm:col-span-6 space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Cuenta Origen</label>
                          <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none text-sm focus:border-indigo-500 transition-colors" value={recAccountId} onChange={e => setRecAccountId(e.target.value)}>{data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                      </div>
                      <div className="col-span-12 sm:col-span-6 space-y-1 relative">
                          <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Destino</label>
                          <button onClick={() => setIsRecSelectorOpen(true)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none text-sm focus:border-indigo-500 transition-colors text-left flex items-center justify-between">
                              <span className="truncate flex items-center gap-2">
                                  {recType === 'TRANSFER' && recTransferAccountId ? (
                                      <>
                                          {renderIcon(data.accounts.find(a => a.id === recTransferAccountId)?.icon || '🏦', "w-4 h-4")}
                                          <span>{data.accounts.find(a => a.id === recTransferAccountId)?.name}</span>
                                      </>
                                  ) : (
                                      <>
                                          {renderIcon(data.categories.find(c => c.id === recCategoryId)?.icon || '🏷️', "w-4 h-4")}
                                          <span>{data.categories.find(c => c.id === recCategoryId)?.name || 'Seleccionar...'}</span>
                                      </>
                                  )}
                              </span>
                              <ChevronDown size={14} className="opacity-50"/>
                          </button>
                          {isRecSelectorOpen && (
                              <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-[2px]" onClick={(e) => { e.stopPropagation(); setIsRecSelectorOpen(false); }}>
                                  <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-[550px] max-w-[95vw] flex overflow-hidden text-left animate-in fade-in zoom-in-95 duration-200 max-h-[60vh]" onClick={e => e.stopPropagation()}>
                                      <div className="flex-1 border-r border-slate-100 overflow-y-auto custom-scrollbar bg-slate-50/50">
                                          <div className="p-3 sticky top-0 bg-slate-50/95 backdrop-blur-sm border-b border-slate-100 font-black text-[10px] text-slate-400 uppercase tracking-widest z-10 text-center">Categorías Activas</div>
                                          {activeGroupedCategories.map(f => (
                                              <div key={f.family.id}>
                                                  <div className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase bg-slate-100/50 sticky top-9 z-0">{f.family.name}</div>
                                                  {f.categories.map(c => (
                                                      <button key={c.id} onClick={() => { setRecCategoryId(c.id); setRecTransferAccountId(null); setRecType(f.family.type); setIsRecSelectorOpen(false); }} className={`w-full text-left px-4 py-3 hover:bg-white hover:text-indigo-600 text-[11px] font-bold text-slate-600 truncate border-b border-slate-50 transition-colors flex items-center gap-3 ${recCategoryId === c.id ? 'bg-indigo-50 text-indigo-700' : ''}`}>
                                                          {renderIcon(c.icon, "w-5 h-5")} <span>{c.name}</span>
                                                      </button>
                                                  ))}
                                              </div>
                                          ))}
                                      </div>
                                      <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
                                          <div className="p-3 sticky top-0 bg-white/95 backdrop-blur-sm border-b border-slate-100 font-black text-[10px] text-slate-400 uppercase tracking-widest z-10 text-center">Traspasos Activos</div>
                                          {activeGroupedAccounts.map(g => {
                                              const availableAccs = g.accounts.filter(a => a.id !== recAccountId);
                                              if (availableAccs.length === 0) return null;
                                              return (
                                                  <div key={g.group.id}>
                                                      <div className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase bg-slate-50 sticky top-9 z-0">{g.group.name}</div>
                                                      {availableAccs.map(a => (
                                                          <button key={a.id} onClick={() => { setRecTransferAccountId(a.id); setRecCategoryId(''); setRecType('TRANSFER'); setIsRecSelectorOpen(false); }} className={`w-full text-left px-4 py-3 hover:bg-slate-50 hover:text-emerald-600 text-[11px] font-bold text-slate-600 truncate border-b border-slate-50 transition-colors flex items-center gap-3 ${recTransferAccountId === a.id ? 'bg-emerald-50 text-emerald-700' : ''}`}>
                                                              ➡ {renderIcon(a.icon, "w-5 h-5")} <span>{a.name}</span>
                                                          </button>
                                                      ))}
                                                  </div>
                                              );
                                          })}
                                      </div>
                                  </div>
                              </div>
                          )}
                      </div>

                      {/* Row 3: Frequency (4 cols) + Interval (4 cols) + Start Date (4 cols) */}
                      <div className="col-span-12 sm:col-span-4 space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Frecuencia</label>
                          <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none text-sm focus:border-indigo-500 transition-colors" value={recFreq} onChange={e => { const newFreq = e.target.value as RecurrenceFrequency; setRecFreq(newFreq); if (recurrenceModalTx) setRecStartDate(calculateNextDate(recurrenceModalTx.date, newFreq, parseInt(recInterval) || 1)); }}><option value="DAYS">Días</option><option value="WEEKS">Semanas</option><option value="MONTHLY">Meses</option><option value="YEARS">Años</option></select>
                      </div>
                      <div className="col-span-12 sm:col-span-4 space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Intervalo</label>
                          <input type="number" min="1" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none text-sm focus:border-indigo-500 transition-colors" value={recInterval} onChange={e => { const newInterval = e.target.value; setRecInterval(newInterval); if (recurrenceModalTx) setRecStartDate(calculateNextDate(recurrenceModalTx.date, recFreq, parseInt(newInterval) || 1)); }} />
                      </div>
                      <div className="col-span-12 sm:col-span-4 space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Inicio Recurrencia</label>
                          <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none text-sm focus:border-indigo-500 transition-colors" value={recStartDate} onChange={e => setRecStartDate(e.target.value)} />
                      </div>

                      {/* Row 4: End Date (12 cols) */}
                      <div className="col-span-12 space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Fecha Fin (Opcional)</label>
                          <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none text-sm focus:border-indigo-500 transition-colors" value={recEndDate} onChange={e => setRecEndDate(e.target.value)} />
                      </div>

                      {/* Row 5: Buttons (Full Width) */}
                      <div className="col-span-12 mt-4 flex gap-3">
                          <button onClick={() => setRecurrenceModalTx(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-xl font-black uppercase text-[11px] hover:bg-slate-200 transition-all">Cancelar</button>
                          <button onClick={handleSaveRecurrent} className="flex-[2] py-4 bg-slate-950 text-white rounded-xl font-black uppercase text-[11px] hover:bg-indigo-600 shadow-lg transition-all active:scale-[0.98]">Confirmar Recurrencia</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {favoriteModalTx && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[200] p-4 animate-in fade-in zoom-in duration-300">
              <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-sm p-8 text-center relative border border-white/20"><button onClick={() => setFavoriteModalTx(null)} className="absolute top-6 right-6 p-2 bg-slate-50 text-slate-400 rounded-full hover:text-rose-500 hover:bg-rose-50 transition-all"><X size={20}/></button><div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-amber-500"><Heart size={32}/></div><h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Guardar Favorito</h3>
                  <div className="space-y-4"><div className="space-y-2 text-left"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nombre del Botón</label><input type="text" placeholder="Ej: Café Diario" className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-amber-400 transition-colors" value={favName} onChange={e => setFavName(e.target.value)} autoFocus /></div><button onClick={handleSaveFavorite} className="w-full py-4 bg-amber-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-amber-600 shadow-xl">Guardar Plantilla</button></div>
              </div>
          </div>
      )}

      {previewAttachment && (
          <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center z-[300] p-4 animate-in fade-in zoom-in duration-300" onClick={() => setPreviewAttachment(null)}><div className="relative max-w-3xl max-h-[90vh] w-full flex flex-col items-center"><button onClick={() => setPreviewAttachment(null)} className="absolute -top-12 right-0 p-2 text-white/50 hover:text-white"><X size={32}/></button><img src={previewAttachment} className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border-4 border-white/10" onClick={e => e.stopPropagation()} /><a href={previewAttachment} download={`comprobante_${Date.now()}.jpg`} onClick={e => e.stopPropagation()} className="mt-6 px-6 py-3 bg-white text-slate-900 rounded-full font-black uppercase text-[10px] tracking-widest hover:scale-105 transition-transform shadow-xl flex items-center gap-2"><ArrowUpDown size={14} className="rotate-180"/> Descargar Imagen Original</a></div></div>
      )}
    </div>
  );
};