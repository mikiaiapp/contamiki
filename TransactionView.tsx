import React, { useState, useRef, useMemo, useEffect } from 'react';
import { AppState, Transaction, TransactionType, GlobalFilter, FavoriteMovement, RecurrentMovement, RecurrenceFrequency, Category, Account, BookMetadata } from './types';
import { Building2, RefreshCw, Plus, Trash2, Search, ArrowRightLeft, X, Paperclip, ChevronLeft, ChevronRight, Edit3, ArrowUpDown, Tag, Receipt, CheckCircle2, Upload, SortAsc, SortDesc, Heart, Bot, Filter, Eraser, Calendar, Sparkles, ChevronDown, Loader2, Download, MoreVertical, Copy, CalendarClock, Save, Repeat, FileSpreadsheet, FileText, CheckSquare, Square, PenTool, LayoutList, Check, AlertTriangle, FileDown, CircleDot } from 'lucide-react';
import { getToken } from './services/authService';
import { PdfViewer } from './components/PdfViewer';
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
  onRefreshData?: () => Promise<void>;
  onFinished?: () => void;
  mode?: 'FULL' | 'MODAL_ONLY';
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
  onRefreshData,
  onFinished,
  mode = 'FULL'
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
  const [selectorTarget, setSelectorTarget] = useState<'ACC' | 'CAT' | null>(null);
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [fAttachment, setFAttachment] = useState<string | undefined>(undefined);
  const [isCompressing, setIsCompressing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeMenuTxId, setActiveMenuTxId] = useState<string | null>(null);
  const [isBankSyncModalOpen, setIsBankSyncModalOpen] = useState(false);
  const [bankAccountsList, setBankAccountsList] = useState<any[]>([]);
  const [selectedBankUids, setSelectedBankUids] = useState<string[]>([]);
  const [isLoadingBankAccounts, setIsLoadingBankAccounts] = useState(false);
  const [isSyncingBanks, setIsSyncingBanks] = useState(false);
  const [bankSyncFeedback, setBankSyncFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [filterPendingOnly, setFilterPendingOnly] = useState<boolean>(Boolean(initialSpecificFilters?.filterPending));
  const [filterReviewedState, setFilterReviewedState] = useState<'ALL' | 'PENDING' | 'REVIEWED'>('ALL');

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
  }, [colFilterEntry, colFilterExit, colFilterDesc, colFilterClip, colFilterAmountOp, colFilterAmountVal1, filterReviewedState, filter]);

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
        if (initialSpecificFilters.filterPending) {
          setFilterPendingOnly(true);
        }
        if (initialSpecificFilters.filterUnreviewed) {
          setFilterReviewedState('PENDING');
        }
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
      if (mode === 'FULL' && clearSpecificFilters) clearSpecificFilters();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSpecificFilters]);

  const findSuggestedCategory = (desc: string): string => {
    const text = desc.toLowerCase().trim();
    if (!text) return '';

    const GENERIC_STOP_WORDS = new Set([
      'pago', 'recibo', 'tarjeta', 'tarj', 'compra', 'transferencia', 'trans', 'abono', 'cargo',
      'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'es', 'esp', 'spain',
      'cerdanyola', 'barcelona', 'madrid', 'valles', 'sant', 'cugat', 'ripollet', 'sabadell'
    ]);

    // 1. Extracción y cotejo directo de nombre de comercio en datáfonos bancarios
    const merchantMatch = text.match(/(?:pago\s+m[oó]vil\s+en|compra\s+(?:pago\s+m[oó]vil\s+en\s+)?en|compra\s+|recibo\s+)(.+?)(?:,|\s+tarj|\s+n[ºo]|\s+ref|\s+dees|\s+es\b|$)/i);
    const merchant = (merchantMatch && merchantMatch[1].trim().length >= 3) ? merchantMatch[1].trim() : '';
    if (merchant) {
      const merchantTxs = data.transactions.filter(t =>
        Boolean(t.categoryId) && (t.description || '').toLowerCase().includes(merchant)
      );
      if (merchantTxs.length > 0) {
        const votes = new Map<string, number>();
        for (const t of merchantTxs) {
          const accWeight = t.accountId === importAccount ? 3 : 1;
          const recWeight = (t.date && t.date >= '2025-01-01') ? 2 : 1;
          votes.set(t.categoryId, (votes.get(t.categoryId) || 0) + (accWeight * recWeight));
        }
        let bestId = '';
        let maxVotes = 0;
        for (const [cid, v] of votes.entries()) {
          if (v > maxVotes) {
            maxVotes = v;
            bestId = cid;
          }
        }
        if (bestId) return bestId;
      }
    }

    const isMatch = (tDesc: string) => {
      const hText = tDesc.toLowerCase().trim();
      if (!hText || hText.length < 3 || GENERIC_STOP_WORDS.has(hText)) return false;
      return (hText.length > 2 && text.includes(hText)) || (text.length > 2 && hText.includes(text));
    };

    // Priorizar coincidencias en la cuenta actual (exigiendo que tenga categoría asignada y no sea traspaso)
    const validAccountTxs = data.transactions.filter(t => t.accountId === importAccount && Boolean(t.categoryId) && isMatch(t.description));
    if (validAccountTxs.length > 0) {
      validAccountTxs.sort((a, b) => (b.description || '').length - (a.description || '').length);
      return validAccountTxs[0].categoryId;
    }

    // Coincidencias en el histórico global (ordenadas por especificidad/longitud de descripción)
    const validGlobalTxs = data.transactions.filter(t => Boolean(t.categoryId) && isMatch(t.description));
    if (validGlobalTxs.length > 0) {
      validGlobalTxs.sort((a, b) => (b.description || '').length - (a.description || '').length);
      return validGlobalTxs[0].categoryId;
    }

    // Coincidencia con nombre de categoría directa
    const catMatch = data.categories.find(c => {
      const name = c.name.toLowerCase().trim();
      return name.length >= 3 && !GENERIC_STOP_WORDS.has(name) && text.includes(name);
    });
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
      return s.length > 0 && !isNaN(parseFloat(s.replace(',', '.')));
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

      const isDuplicate = existingInAcc.some(t => {
        const tEffAmount = t.type === 'TRANSFER'
          ? (t.accountId === importAccount ? -t.amount : t.amount)
          : t.amount;
        return t.date === formattedDate && Math.abs(tEffAmount - amount) < 0.005;
      });

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

    if (validTransactions.length === 0) { closeImportModal(); return; }

    const newTxs: Transaction[] = validTransactions.map(p => {
      let amt = Math.abs(p.amount);
      if (p.type === 'EXPENSE') amt = -amt;

      let accId = p.accountId;
      let transAccId = p.type === 'TRANSFER' ? p.transferAccountId : undefined;

      if (p.type === 'TRANSFER') {
        if (p.amount >= 0) {
          accId = p.transferAccountId || '';
          transAccId = p.accountId;
        } else {
          accId = p.accountId;
          transAccId = p.transferAccountId;
        }
      }

      return {
        id: generateId(),
        date: p.date,
        amount: amt,
        description: p.description,
        accountId: accId,
        type: p.type,
        categoryId: p.categoryId,
        familyId: indices.cat.get(p.categoryId)?.familyId || '',
        transferAccountId: transAccId,
        attachment: p.attachment,
        isReviewed: false
      };
    });

    onUpdateData({ transactions: [...newTxs, ...data.transactions] });
    if (pendingTransactions.length > 0) {
      setProposedTransactions(pendingTransactions);
      setSelectedImportIds(new Set());
      alert(`Se han importado ${validTransactions.length} movimientos correctamente.\n\nQuedan ${pendingTransactions.length} movimientos sin asignar o bloqueados como duplicados.`);
    } else {
      closeImportModal();
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
        setProposedTransactions(prev => prev.map(p => p.id === attachingImportId ? { ...p, attachment: compressed } : p));
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
      const remaining = data.transactions.filter(t => !selectedIds.has(t.id));
      onUpdateData({ transactions: remaining });
      setSelectedIds(new Set());
      setIsBulkEditModalOpen(false);
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

  const handleBulkMarkReviewed = () => {
    const updatedTxs = data.transactions.map(t => {
      if (selectedIds.has(t.id)) {
        return { ...t, isReviewed: true };
      }
      return t;
    });
    onUpdateData({ transactions: updatedTxs });
    setSelectedIds(new Set());
  };

  const handleBulkUnmarkReviewed = () => {
    const updatedTxs = data.transactions.map(t => {
      if (selectedIds.has(t.id)) {
        return { ...t, isReviewed: false };
      }
      return t;
    });
    onUpdateData({ transactions: updatedTxs });
    setSelectedIds(new Set());
  };

  const handleToggleReviewed = (txId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const tx = data.transactions.find(t => t.id === txId);
    if (!tx) return;
    const updatedTx: Transaction = {
      ...tx,
      isReviewed: tx.isReviewed === false ? true : false
    };
    onUpdateTransaction(updatedTx);
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
      if (filterPendingOnly) {
        const isPending = t.type !== 'TRANSFER' && (!t.categoryId || t.categoryId === '' || t.isPendingCategorization);
        if (!isPending) return false;
      }
      if (filterReviewedState === 'PENDING' && t.isReviewed !== false) return false;
      if (filterReviewedState === 'REVIEWED' && t.isReviewed !== true) return false;
      return true;
    });
  }, [timeFilteredList, colFilterEntry, colFilterExit, colFilterDesc, colFilterClip, colFilterAmountOp, colFilterAmountVal1, filterPendingOnly, filterReviewedState]);

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
    if (filterPendingOnly) chips.push({ id: 'pendingOnly', label: 'Por Categorizar', onRemove: () => setFilterPendingOnly(false) });
    if (filterReviewedState === 'PENDING') chips.push({ id: 'reviewedPending', label: 'Sin Revisar / No Punteados', onRemove: () => setFilterReviewedState('ALL') });
    if (filterReviewedState === 'REVIEWED') chips.push({ id: 'reviewedDone', label: 'Solo Punteados', onRemove: () => setFilterReviewedState('ALL') });
    return chips;
  }, [colFilterEntry, colFilterExit, colFilterDesc, colFilterClip, colFilterAmountOp, filterPendingOnly, filterReviewedState, indices]);

  const clearAllFilters = () => { setColFilterEntry('ALL'); setColFilterDesc(''); setColFilterClip('ALL'); setColFilterExit('ALL'); setColFilterAmountOp('ALL'); setColFilterAmountVal1(''); setFilterPendingOnly(false); setFilterReviewedState('ALL'); };
  const resetForm = () => { setEditingTx(null); setFType('EXPENSE'); setFAmount(''); setFDesc(''); setFDate(new Date().toISOString().split('T')[0]); setFAcc(data.accounts[0]?.id || ''); setFCat(''); setFTransferDest(''); setFAttachment(undefined); setSelectorTarget(null); setModalSearchTerm(''); };

  const openEditor = (t?: Transaction) => {
    if (t) { setEditingTx(t); setFType(t.type); setFAmount(Math.abs(t.amount).toString()); setFDesc(t.description); setFDate(t.date); setFAcc(t.accountId); setFCat(t.categoryId); setFTransferDest(t.transferAccountId || ''); setFAttachment(t.attachment); } else { resetForm(); }
    setSelectorTarget(null); setModalSearchTerm('');
    setIsModalOpen(true);
  };

  const handleDuplicate = (t: Transaction) => {
    setEditingTx(null); setFType(t.type); setFAmount(Math.abs(t.amount).toString()); setFDesc(t.description); setFDate(new Date().toISOString().split('T')[0]); setFAcc(t.accountId); setFCat(t.categoryId); setFTransferDest(t.transferAccountId || ''); setFAttachment(t.attachment); setActiveMenuTxId(null); setSelectorTarget(null); setModalSearchTerm(''); setIsModalOpen(true);
  };

  const handleOpenBankSync = async () => {
    setIsBankSyncModalOpen(true);
    setIsLoadingBankAccounts(true);
    setBankSyncFeedback(null);
    try {
      const token = getToken() || localStorage.getItem('auth_token');
      const res = await fetch('/api/bank/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const statusData = await res.json();
        const list: any[] = [];
        for (const conn of (statusData.connections || [])) {
          const bankName = conn.aspsp?.name || 'Entidad Bancaria';
          for (const acc of (conn.accounts || [])) {
            if (acc.mappedAccountId && acc.enabled !== false) {
              const matchedAcc = data.accounts.find(a => a.id === acc.mappedAccountId);
              list.push({
                uid: acc.uid,
                name: acc.name || 'Cuenta Corriente',
                iban: acc.iban || '',
                bankName,
                isCurrentBook: acc.mappedBookId === currentBook.id,
                mappedAccountName: matchedAcc ? matchedAcc.name : 'Cuenta asociada',
                lastSync: acc.lastSync
              });
            }
          }
        }
        setBankAccountsList(list);
        // Pre-select accounts
        const currentBookUids = list.filter(a => a.isCurrentBook).map(a => a.uid);
        setSelectedBankUids(currentBookUids.length > 0 ? currentBookUids : list.map(a => a.uid));
      } else {
        setBankSyncFeedback({ message: 'No se pudo cargar el estado bancario.', type: 'error' });
      }
    } catch (err: any) {
      console.error('Error fetching bank status:', err);
      setBankSyncFeedback({ message: 'Error al conectar con el servicio bancario.', type: 'error' });
    } finally {
      setIsLoadingBankAccounts(false);
    }
  };

  const handleExecuteBankSync = async () => {
    if (selectedBankUids.length === 0) return;
    setIsSyncingBanks(true);
    setBankSyncFeedback(null);
    try {
      const token = getToken() || localStorage.getItem('auth_token');
      const res = await fetch('/api/bank/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ accountUids: selectedBankUids })
      });
      const result = await res.json();
      if (result.success) {
        if (onRefreshData) {
          await onRefreshData();
        }
        let balanceMsg = '';
        if (result.balanceReconciliations && result.balanceReconciliations.length > 0) {
          const squared = result.balanceReconciliations.filter((r: any) => r.isCuadrado).length;
          const total = result.balanceReconciliations.length;
          if (squared === total) {
            balanceMsg = ` • ⚖️ Saldos: ${squared}/${total} cuadrados ✅`;
          } else {
            balanceMsg = ` • ⚠️ Saldos: ${squared}/${total} cuadrados (${total - squared} con diferencia)`;
          }
        }
        setBankSyncFeedback({
          message: `✨ ¡Sincronizado! ${result.newTxs || 0} movimientos nuevos (${result.categorizedCount || 0} categorizados, ${result.pendingCategorizationCount || 0} pendientes)${balanceMsg}`,
          type: 'success'
        });
        setTimeout(() => {
          setIsBankSyncModalOpen(false);
          setBankSyncFeedback(null);
        }, 1800);
      } else {
        setBankSyncFeedback({ message: result.error || result.message || 'Error en la sincronización', type: 'error' });
      }
    } catch (err: any) {
      setBankSyncFeedback({ message: err.message || 'Error al sincronizar con el banco', type: 'error' });
    } finally {
      setIsSyncingBanks(false);
    }
  };

  const handleSaveRecurrent = () => {
    if (!recurrenceModalTx) return;

    if (!recDesc) { alert("Por favor, indica una descripción."); return; }
    if (!recAmount) { alert("Por favor, indica un importe."); return; }
    if (!recAccountId) { alert("Por favor, selecciona una cuenta de origen."); return; }
    if (recType === 'TRANSFER' && !recTransferAccountId) { alert("Por favor, selecciona una cuenta de destino para el traspaso."); return; }
    if (recType !== 'TRANSFER' && !recCategoryId) { alert("Por favor, selecciona una categoría."); return; }
    if (!recStartDate) { alert("Por favor, indica la fecha de inicio de la recurrencia."); return; }

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

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
    if (initialSpecificFilters?.action === 'NEW' && onFinished) {
      clearSpecificFilters?.();
      onFinished();
    }
  };

  const closeImportModal = () => {
    setIsImportModalOpen(false);
    if (initialSpecificFilters?.action === 'IMPORT' && onFinished) {
      clearSpecificFilters?.();
      onFinished();
    }
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
      transferAccountId: fType === 'TRANSFER' ? fTransferDest : undefined,
      isReviewed: editingTx ? (editingTx.isReviewed ?? true) : true
    };
    if (editingTx) onUpdateTransaction(tx);
    else onAddTransaction(tx);
    closeModal();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsCompressing(true);
      try {
        if (file.type === 'application/pdf') {
          const reader = new FileReader();
          reader.onload = () => setFAttachment(reader.result as string);
          reader.readAsDataURL(file);
        } else {
          const compressed = await compressImage(file);
          setFAttachment(compressed);
        }
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

  const years = Array.from({ length: new Date().getFullYear() - 2015 + 5 }, (_, i) => 2015 + i);
  const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const gridClasses = "grid grid-cols-[22px_24px_45px_1fr_1.2fr_12px_1fr_55px_0px_20px] sm:grid-cols-[24px_28px_65px_1fr_1.4fr_20px_1fr_65px_60px_25px] md:grid-cols-[26px_28px_75px_1fr_1.4fr_25px_1fr_75px_75px_30px] gap-1.5 sm:gap-2 md:gap-2 items-center";

  const pendingCategorizationCount = useMemo(() => {
    return (data.transactions || []).filter(t =>
      t.type !== 'TRANSFER' && (!t.categoryId || t.categoryId === '' || t.isPendingCategorization)
    ).length;
  }, [data.transactions]);

  const unreviewedCount = useMemo(() => {
    return (data.transactions || []).filter(t => t.isReviewed === false).length;
  }, [data.transactions]);

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
    <>
      {mode === 'FULL' && (
        <>
          <div className="space-y-6 md:space-y-10 pb-24 animate-in fade-in duration-500">
            <div className="flex flex-col xl:flex-row justify-between xl:items-end gap-8 print:hidden">
              <div className="space-y-4 text-center md:text-left w-full xl:w-auto">
                <div className="flex items-center justify-center md:justify-start gap-6">
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-3xl shadow-sm border border-slate-100 p-1.5 shrink-0 overflow-hidden">
                    <img src={displayLogo} className="w-full h-full object-cover rounded-2xl" onError={(e) => e.currentTarget.src = "/contamiki.jpg"} />
                  </div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter">Diario.</h2>
                    {pendingCategorizationCount > 0 && (
                      <button
                        onClick={() => setFilterPendingOnly(!filterPendingOnly)}
                        className={`${filterPendingOnly ? 'bg-rose-700 ring-4 ring-rose-200' : 'bg-rose-500'
                          } text-white px-3.5 py-1.5 md:px-4 md:py-2 rounded-2xl flex items-center gap-2 shadow-lg shadow-rose-200 animate-pulse transition-all active:scale-95 cursor-pointer`}
                        title={filterPendingOnly ? "Mostrando pendientes (clic para ver todos)" : "Filtrar movimientos pendientes de categorizar"}
                      >
                        <AlertTriangle size={16} />
                        <span className="text-xs font-black">{pendingCategorizationCount}</span>
                        <span className="hidden sm:inline text-xs font-bold">por categorizar</span>
                      </button>
                    )}
                    {unreviewedCount > 0 && (
                      <button
                        onClick={() => setFilterReviewedState(filterReviewedState === 'PENDING' ? 'ALL' : 'PENDING')}
                        className={`${filterReviewedState === 'PENDING' ? 'bg-amber-600 ring-4 ring-amber-200' : 'bg-amber-500'
                          } text-white px-3.5 py-1.5 md:px-4 md:py-2 rounded-2xl flex items-center gap-2 shadow-lg shadow-amber-200 transition-all active:scale-95 cursor-pointer`}
                        title={filterReviewedState === 'PENDING' ? "Mostrando no revisados (clic para ver todos)" : "Filtrar movimientos pendientes de revisar / puntear"}
                      >
                        <CircleDot size={16} />
                        <span className="text-xs font-black">{unreviewedCount}</span>
                        <span className="hidden sm:inline text-xs font-bold">por revisar</span>
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3 justify-center md:justify-start">
                  <div className="flex items-center gap-1">
                    <button onClick={() => navigatePeriod('prev')} className="p-3 bg-white border border-slate-200 rounded-xl active:bg-slate-50 lg:hover:bg-slate-50 shadow-sm active:scale-90 transition-all"><ChevronLeft size={24} /></button>
                    <button onClick={() => navigatePeriod('next')} className="p-3 bg-white border border-slate-200 rounded-xl active:bg-slate-50 lg:hover:bg-slate-50 shadow-sm active:scale-90 transition-all"><ChevronRight size={24} /></button>
                  </div>
                  <div className="bg-slate-100 p-2 rounded-2xl flex flex-wrap gap-1 shadow-inner border border-slate-200/50">
                    <button onClick={() => onUpdateFilter({ ...filter, timeRange: 'ALL' })} className={`px-6 py-3 text-xs sm:text-sm font-black uppercase tracking-widest rounded-xl transition-all touch-action-manipulation ${filter.timeRange === 'ALL' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 active:text-slate-600 lg:hover:text-slate-600'}`}>Todo</button>
                    <div className={`px-5 py-3 rounded-xl transition-all flex items-center ${filter.timeRange === 'YEAR' ? 'bg-white shadow-sm' : ''}`}>
                      {filter.timeRange === 'YEAR' ? (<select className="bg-transparent text-xs sm:text-sm font-black text-indigo-600 uppercase tracking-widest outline-none cursor-pointer py-1 min-w-[60px]" value={filter.referenceDate.getFullYear()} onChange={(e) => { const d = new Date(filter.referenceDate); d.setFullYear(parseInt(e.target.value)); onUpdateFilter({ ...filter, timeRange: 'YEAR', referenceDate: d }); }}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select>) : (<button onClick={() => onUpdateFilter({ ...filter, timeRange: 'YEAR' })} className="px-2 text-xs sm:text-sm font-black uppercase tracking-widest text-slate-400 active:text-slate-600 lg:hover:text-slate-600">Año</button>)}
                    </div>
                    <div className={`px-5 py-3 rounded-xl transition-all flex items-center gap-1 ${filter.timeRange === 'MONTH' ? 'bg-white shadow-sm' : ''}`}>
                      {filter.timeRange === 'MONTH' ? (<div className="flex items-center gap-2"><select className="bg-transparent text-xs sm:text-sm font-black text-indigo-600 uppercase tracking-widest outline-none cursor-pointer py-1 min-w-[80px]" value={filter.referenceDate.getMonth()} onChange={(e) => { const d = new Date(filter.referenceDate); d.setMonth(parseInt(e.target.value)); onUpdateFilter({ ...filter, timeRange: 'MONTH', referenceDate: d }); }}>{months.map((m, i) => <option key={i} value={i}>{m}</option>)}</select><span className="text-slate-300 text-xs font-black">/</span><select className="bg-transparent text-xs sm:text-sm font-black text-indigo-600 uppercase tracking-widest outline-none cursor-pointer py-1 min-w-[70px]" value={filter.referenceDate.getFullYear()} onChange={(e) => { const d = new Date(filter.referenceDate); d.setFullYear(parseInt(e.target.value)); onUpdateFilter({ ...filter, timeRange: 'MONTH', referenceDate: d }); }}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select></div>) : (<button onClick={() => onUpdateFilter({ ...filter, timeRange: 'MONTH' })} className="px-2 text-xs sm:text-sm font-black uppercase tracking-widest text-slate-400 active:text-slate-600 lg:hover:text-slate-600">Mes</button>)}
                    </div>
                    <div className={`px-5 py-3 rounded-xl transition-all flex items-center gap-2 ${filter.timeRange === 'CUSTOM' ? 'bg-white shadow-sm' : ''}`}>
                      {filter.timeRange === 'CUSTOM' ? (
                        <div className="flex flex-col sm:flex-row items-center gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Desde</span>
                            <input type="date" className="bg-transparent text-xs sm:text-sm font-bold text-slate-700 outline-none w-28 sm:w-32 cursor-pointer py-1" value={filter.customStart} onChange={(e) => onUpdateFilter({ ...filter, timeRange: 'CUSTOM', customStart: e.target.value })} />
                          </div>
                          <span className="hidden sm:inline text-slate-300 text-[10px] font-black">➡</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hasta</span>
                            <input type="date" className="bg-transparent text-xs sm:text-sm font-bold text-slate-700 outline-none w-28 sm:w-32 cursor-pointer py-1" value={filter.customEnd} onChange={(e) => onUpdateFilter({ ...filter, timeRange: 'CUSTOM', customEnd: e.target.value })} />
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => onUpdateFilter({ ...filter, timeRange: 'CUSTOM' })} className="px-2 text-xs sm:text-sm font-black uppercase tracking-widest text-slate-400 active:text-slate-600 lg:hover:text-slate-600">Pers.</button>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative">
                      <button onClick={(e) => { e.stopPropagation(); setShowFavoritesList(!showFavoritesList); }} className="w-12 h-12 bg-amber-50 text-amber-600 border border-amber-100 rounded-xl shadow-sm active:bg-amber-100 lg:hover:bg-amber-100 flex items-center justify-center transition-all active:scale-95 touch-action-manipulation"><Heart size={20} fill={showFavoritesList ? "currentColor" : "none"} /></button>
                      {showFavoritesList && (
                        <>
                          <div className="fixed inset-0 z-10 bg-transparent cursor-pointer" onClick={() => setShowFavoritesList(false)}></div>
                          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:absolute md:top-full md:right-0 md:left-auto md:translate-x-0 md:translate-y-0 md:mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 w-[85vw] max-w-xs md:w-64 p-2 z-20 animate-in fade-in zoom-in duration-200 origin-center md:origin-top-right">
                            <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center md:text-left">Plantillas Rápidas</div>
                            <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-1">
                              {data.favorites && data.favorites.length > 0 ? (
                                data.favorites.map(fav => (
                                  <button key={fav.id} onClick={() => handleUseFavorite(fav)} className="w-full flex items-center gap-3 px-3 py-3 md:py-2 rounded-xl active:bg-amber-50 lg:hover:bg-amber-50 text-left transition-colors group touch-action-manipulation">
                                    <div className="bg-amber-100 text-amber-600 p-1.5 rounded-lg active:bg-amber-200 lg:group-hover:bg-amber-200 transition-colors">{renderIcon(fav.icon || '⭐', "w-4 h-4")}</div>
                                    <div className="flex-1 min-w-0"><div className="text-xs font-bold text-slate-700 truncate">{fav.name}</div><div className="text-[9px] text-slate-400 font-medium truncate">{fav.description}</div></div>
                                  </button>
                                ))
                              ) : (<div className="p-4 text-center text-slate-400 text-xs">No hay favoritos.</div>)}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleOpenBankSync(); }}
                      className="w-12 h-12 bg-sky-50 text-sky-600 border border-sky-100 rounded-xl shadow-sm active:bg-sky-100 lg:hover:bg-sky-100 flex items-center justify-center transition-all active:scale-95 touch-action-manipulation"
                      title="Sincronización Bancaria Automática (Open Banking)"
                    >
                      <Building2 size={20} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setImportAccount(data.accounts[0]?.id || ''); setImportStep(1); setIsImportModalOpen(true); }} className="w-12 h-12 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl shadow-sm active:bg-indigo-100 lg:hover:bg-indigo-100 flex items-center justify-center transition-all active:scale-95 touch-action-manipulation"><Bot size={20} /></button>
                    <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                      <button onClick={(e) => { e.stopPropagation(); handleExportExcel(); }} className="w-10 h-10 bg-white text-emerald-600 rounded-lg shadow-sm active:bg-emerald-50 lg:hover:bg-emerald-50 flex items-center justify-center transition-all active:scale-95 touch-action-manipulation">
                        <div className="relative">
                          <FileSpreadsheet size={18} />
                          <span className="absolute -bottom-1 -right-1 bg-emerald-600 text-white text-[6px] font-black px-0.5 rounded">XLS</span>
                        </div>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleExportPDF(); }} className="w-10 h-10 bg-white text-rose-600 rounded-lg shadow-sm active:bg-rose-50 lg:hover:bg-rose-50 flex items-center justify-center transition-all active:scale-95 touch-action-manipulation">
                        <div className="relative">
                          <FileText size={18} />
                          <span className="absolute -bottom-1 -right-1 bg-rose-600 text-white text-[6px] font-black px-0.5 rounded">PDF</span>
                        </div>
                      </button>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); openEditor(); }} className="w-12 h-12 bg-slate-950 text-white rounded-xl shadow-lg active:bg-slate-800 lg:hover:bg-slate-800 flex items-center justify-center transition-all active:scale-95 touch-action-manipulation"><Plus size={20} /></button>
                  </div>
                </div>
              </div>
            </div>

            {activeFiltersChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 p-3 px-6 bg-white rounded-2xl border border-slate-100 shadow-sm mt-4">
                <span className="text-[9px] font-black text-slate-400 uppercase mr-2 flex items-center gap-1"><Filter size={12} /> Filtros:</span>
                {activeFiltersChips.map(c => (
                  <div key={c.id} className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
                    <span className="text-[9px] font-black text-indigo-600 uppercase">{c.label}</span>
                    <button onClick={c.onRemove} className="text-indigo-300 active:text-rose-500 lg:hover:text-rose-500"><X size={12} /></button>
                  </div>
                ))}
                <button onClick={clearAllFilters} className="ml-auto text-rose-500 text-[9px] font-black uppercase flex items-center gap-1"><Eraser size={12} /> Limpiar</button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 mt-4 mb-2 px-1">
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200/70 shadow-inner">
                <span className="text-[9px] font-black uppercase text-slate-400 px-2 tracking-wider flex items-center gap-1">
                  <Check size={12} strokeWidth={3} className="text-slate-500"/> Punteo:
                </span>
                <button 
                  onClick={() => setFilterReviewedState('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    filterReviewedState === 'ALL' 
                      ? 'bg-white text-slate-900 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Todos
                </button>
                <button 
                  onClick={() => setFilterReviewedState('PENDING')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    filterReviewedState === 'PENDING' 
                      ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-300' 
                      : 'text-amber-700 hover:bg-amber-50'
                  }`}
                  title="Ver solo movimientos pendientes de puntear / repasar"
                >
                  <CircleDot size={13} className={filterReviewedState === 'PENDING' ? 'text-white' : 'text-amber-500'} />
                  <span>Por repasar {unreviewedCount > 0 ? `(${unreviewedCount})` : ''}</span>
                </button>
                <button 
                  onClick={() => setFilterReviewedState('REVIEWED')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    filterReviewedState === 'REVIEWED' 
                      ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-300' 
                      : 'text-emerald-700 hover:bg-emerald-50'
                  }`}
                  title="Ver solo movimientos revisados / punteados"
                >
                  <Check size={13} strokeWidth={3} className={filterReviewedState === 'REVIEWED' ? 'text-white' : 'text-emerald-600'} />
                  <span>Repasados</span>
                </button>
              </div>

              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleBulkMarkReviewed}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 active:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase shadow-sm transition-all cursor-pointer"
                    title="Marcar seleccionados como repasados"
                  >
                    <Check size={13} strokeWidth={3}/> Puntear ({selectedIds.size})
                  </button>
                  <button 
                    onClick={handleBulkUnmarkReviewed}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 active:bg-amber-700 text-white rounded-xl text-[10px] font-black uppercase shadow-sm transition-all cursor-pointer"
                    title="Marcar seleccionados como pendientes de repasar"
                  >
                    <CircleDot size={13}/> Desmarcar
                  </button>
                </div>
              )}
            </div>

            <div className={`bg-slate-900/5 p-2 md:p-4 rounded-2xl border border-slate-100 ${gridClasses}`}>
              <div className="flex items-center justify-center"><button onClick={toggleSelectAllPage} className="text-slate-400 active:text-indigo-600 lg:hover:text-indigo-600 cursor-pointer" title="Seleccionar todos">{paginatedTransactions.length > 0 && paginatedTransactions.every(t => selectedIds.has(t.id)) ? <CheckSquare size={16} /> : <Square size={16} />}</button></div>
              <div className="flex flex-col items-center justify-center">
                <span className="hidden md:block text-[7px] sm:text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest text-center" title="Revisión / Punteo">Rev</span>
                <button
                  onClick={() => {
                    if (filterReviewedState === 'ALL') setFilterReviewedState('PENDING');
                    else if (filterReviewedState === 'PENDING') setFilterReviewedState('REVIEWED');
                    else setFilterReviewedState('ALL');
                  }}
                  className={`w-5 h-5 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center text-[10px] font-black border transition-all cursor-pointer ${
                    filterReviewedState === 'PENDING'
                      ? 'bg-amber-500 border-amber-600 text-white shadow-xs'
                      : filterReviewedState === 'REVIEWED'
                      ? 'bg-emerald-600 border-emerald-700 text-white shadow-xs'
                      : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'
                  }`}
                  title="Filtro rápido de punteo: Clic para alternar (Todos / Pendientes / Repasados)"
                >
                  {filterReviewedState === 'PENDING' ? '⚠️' : filterReviewedState === 'REVIEWED' ? '✓' : '✓?'}
                </button>
              </div>
              <div className="flex flex-col items-center justify-center"><button onClick={() => { if (sortField === 'DATE') setSortDirection(sortDirection === 'ASC' ? 'DESC' : 'ASC'); else setSortField('DATE'); }} className="text-[7px] sm:text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest inline-flex items-center gap-0.5">Fec <SortIcon field="DATE" /></button></div>
              <div className="flex flex-col"><span className="hidden md:block text-[7px] sm:text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Filtro A</span><select className="w-full bg-white border border-slate-200 rounded-lg text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] font-bold py-0.5 md:py-1 outline-none truncate" value={colFilterEntry} onChange={e => setColFilterEntry(e.target.value)}><option value="ALL">Todo</option>{activeDropdownOptions.entryGroups.map(group => (<optgroup key={group.label} label={group.label}>{group.options.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}</optgroup>))}</select></div>
              <div className="flex flex-col"><span className="hidden md:block text-[7px] sm:text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Concepto</span><input type="text" className="w-full bg-white border border-slate-200 rounded-lg text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] font-bold py-0.5 md:py-1 px-1 md:px-2 outline-none" placeholder="..." value={colFilterDesc} onChange={e => setColFilterDesc(e.target.value)} /></div>
              <div className="flex flex-col"><span className="hidden md:block text-[7px] sm:text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Clip</span><select className="bg-white border border-slate-200 rounded-lg text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] font-black uppercase py-0.5 md:py-1 outline-none" value={colFilterClip} onChange={e => setColFilterClip(e.target.value as any)}><option value="ALL">.</option><option value="YES">SI</option><option value="NO">NO</option></select></div>
              <div className="flex flex-col"><span className="hidden md:block text-[7px] sm:text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Filtro B</span><select className="w-full bg-white border border-slate-200 rounded-lg text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] font-bold py-0.5 md:py-1 outline-none truncate" value={colFilterExit} onChange={e => setColFilterExit(e.target.value)}><option value="ALL">Todo</option>{activeDropdownOptions.exitGroups.map(group => (<optgroup key={group.label} label={group.label}>{group.options.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}</optgroup>))}</select></div>
              <div className="flex flex-col"><button onClick={() => { if (sortField === 'AMOUNT') setSortDirection(sortDirection === 'ASC' ? 'DESC' : 'ASC'); else setSortField('AMOUNT'); }} className="text-[7px] sm:text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-end gap-0.5">Imp <SortIcon field="AMOUNT" /></button>
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
              <div className="flex justify-center"><button onClick={clearAllFilters} className="text-slate-300 active:text-rose-500 lg:hover:text-rose-500 transition-colors p-1"><Eraser size={14} /></button></div>
            </div>

            <div className="space-y-1.5 md:space-y-2.5">
              {paginatedTransactions.map(t => {
                const srcAcc = indices.acc.get(t.accountId); const dstAcc = t.transferAccountId ? indices.acc.get(t.transferAccountId) : null; const cat = indices.cat.get(t.categoryId); const isSelected = selectedIds.has(t.id);
                let debitNode, creditNode; let debitId = '', creditId = '';
                let typeColorClass = 'text-slate-900'; if (t.type === 'EXPENSE') typeColorClass = 'text-rose-600'; else if (t.type === 'INCOME') typeColorClass = 'text-emerald-600';
                if (t.type === 'TRANSFER') {
                  debitId = t.transferAccountId || ''; creditId = t.accountId;
                  debitNode = <button className={`flex items-center gap-1 font-bold text-left line-clamp-2 leading-tight active:underline lg:hover:underline ${typeColorClass}`} onClick={(e) => { e.stopPropagation(); setColFilterEntry(debitId); }}>{renderIcon(dstAcc?.icon || '🏦')} <span className="line-clamp-2">{dstAcc?.name}</span></button>;
                  creditNode = <button className={`flex items-center gap-1 font-bold text-left line-clamp-2 leading-tight active:underline lg:hover:underline ${typeColorClass}`} onClick={(e) => { e.stopPropagation(); setColFilterExit(creditId); }}>{renderIcon(srcAcc?.icon || '🏦')} <span className="line-clamp-2">{srcAcc?.name}</span></button>;
                } else if (t.type === 'INCOME') {
                  debitId = t.accountId; creditId = t.categoryId;
                  debitNode = <button className={`flex items-center gap-1 font-bold text-left line-clamp-2 leading-tight active:underline lg:hover:underline ${typeColorClass}`} onClick={(e) => { e.stopPropagation(); setColFilterEntry(debitId); }}>{renderIcon(srcAcc?.icon || '🏦')} <span className="line-clamp-2">{srcAcc?.name}</span></button>;
                  const isUncategorized = t.type !== 'TRANSFER' && (!t.categoryId || t.categoryId === '' || t.isPendingCategorization);
                  creditNode = isUncategorized ? (
                    <button
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 font-bold text-[10px] hover:bg-rose-100 transition-colors shadow-xs active:scale-95 cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); openEditor(t); }}
                      title="Movimiento pendiente de categorizar. Clic para asignar categoría."
                    >
                      <AlertTriangle size={11} className="text-rose-500 shrink-0" />
                      <span className="truncate">Pendiente</span>
                    </button>
                  ) : (
                    <button className={`flex items-center gap-1 font-bold text-left line-clamp-2 leading-tight active:underline lg:hover:underline ${typeColorClass}`} onClick={(e) => { e.stopPropagation(); setColFilterExit(creditId); }}>{renderIcon(cat?.icon || '🏷️')} <span className="line-clamp-2">{cat?.name || 'S/C'}</span></button>
                  );
                } else {
                  debitId = t.categoryId; creditId = t.accountId;
                  const isUncategorized = t.type !== 'TRANSFER' && (!t.categoryId || t.categoryId === '' || t.isPendingCategorization);
                  debitNode = isUncategorized ? (
                    <button
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 font-bold text-[10px] hover:bg-rose-100 transition-colors shadow-xs active:scale-95 cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); openEditor(t); }}
                      title="Movimiento pendiente de categorizar. Clic para asignar categoría."
                    >
                      <AlertTriangle size={11} className="text-rose-500 shrink-0" />
                      <span className="truncate">Pendiente</span>
                    </button>
                  ) : (
                    <button className={`flex items-center gap-1 font-bold text-left line-clamp-2 leading-tight active:underline lg:hover:underline ${typeColorClass}`} onClick={(e) => { e.stopPropagation(); setColFilterEntry(debitId); }}>{renderIcon(cat?.icon || '🏷️')} <span className="line-clamp-2">{cat?.name || 'S/C'}</span></button>
                  );
                  creditNode = <button className={`flex items-center gap-1 font-bold text-left line-clamp-2 leading-tight active:underline lg:hover:underline ${typeColorClass}`} onClick={(e) => { e.stopPropagation(); setColFilterExit(creditId); }}>{renderIcon(srcAcc?.icon || '🏦')} <span className="line-clamp-2">{srcAcc?.name}</span></button>;
                }
                const balance = runningBalances.get(t.id) || 0;
                const displayAmt = getDisplayAmount(t);
                return (
                  <div key={t.id} className={`group bg-white p-2 md:p-4 md:px-6 rounded-2xl border ${isSelected ? 'border-indigo-400 bg-indigo-50/30' : 'border-slate-100'} active:shadow-lg lg:hover:shadow-lg transition-all relative touch-action-manipulation`}>
                    <div className={gridClasses}>
                      <div className="flex justify-center"><button onClick={(e) => { e.stopPropagation(); toggleSelection(t.id); }} className={`text-slate-400 touch-action-manipulation ${isSelected ? 'text-indigo-600' : 'active:text-indigo-600 lg:hover:text-indigo-600'}`}>{isSelected ? <CheckSquare size={16} /> : <Square size={16} />}</button></div>
                      <div className="flex justify-center">
                        <button
                          onClick={(e) => handleToggleReviewed(t.id, e)}
                          className={`w-5 h-5 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center transition-all active:scale-90 cursor-pointer touch-action-manipulation ${
                            t.isReviewed === false
                              ? 'border-2 border-amber-400 bg-amber-50/80 text-amber-600 hover:bg-amber-100 shadow-xs'
                              : 'border-2 border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600 shadow-xs'
                          }`}
                          title={t.isReviewed === false ? "Pendiente de repasar / puntear. Clic para marcar como repasado." : "Movimiento repasado / punteado. Clic para desmarcar."}
                        >
                          {t.isReviewed === false ? (
                            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                          ) : (
                            <Check size={14} strokeWidth={3} className="text-white" />
                          )}
                        </button>
                      </div>
                      <div className="text-left text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] font-black text-slate-400 uppercase tracking-tighter leading-none truncate">{formatDateDisplay(t.date)}</div>
                      <div className="min-w-0 text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] pr-1 sm:pr-0 leading-tight">{debitNode}</div>
                      <button className="min-w-0 text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] font-bold text-slate-800 uppercase text-left line-clamp-2 leading-tight active:text-indigo-600 lg:hover:text-indigo-600 pl-0.5 sm:pl-0 touch-action-manipulation" onClick={(e) => { e.stopPropagation(); setColFilterDesc(t.description); }}>{t.description}</button>
                      <div className="flex justify-center">{t.attachment ? (<button onClick={(e) => { e.stopPropagation(); setPreviewAttachment(t.attachment || null); }} className="p-1 active:bg-indigo-50 lg:hover:bg-indigo-50 rounded-full text-indigo-500 transition-colors touch-action-manipulation"><Paperclip size={12} className="md:size-4" /></button>) : <div className="w-1 md:w-2" />}</div>
                      <div className="min-w-0 text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] pr-1 sm:pr-0 leading-tight">{creditNode}</div>
                      <div className={`text-right text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] font-black font-mono tracking-tighter truncate ${getAmountColor(displayAmt, t.type)} pl-0.5 sm:pl-0`}>{formatCurrency(displayAmt)}</div>
                      <div className={`hidden sm:block text-right text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] font-black font-mono tracking-tighter truncate ${activeFilterId ? (balance >= 0 ? 'text-slate-400' : 'text-rose-400') : 'opacity-0'}`}>{activeFilterId ? formatCurrency(balance) : ''}</div>
                      <div className="flex justify-center relative"><button onClick={(e) => { e.stopPropagation(); setActiveMenuTxId(activeMenuTxId === t.id ? null : t.id); }} className="p-1.5 md:p-2 text-slate-300 active:text-indigo-600 active:bg-indigo-50 lg:hover:text-indigo-600 lg:hover:bg-indigo-50 rounded-lg transition-colors touch-action-manipulation"><MoreVertical size={16} /></button>
                        {activeMenuTxId === t.id && (
                          <>
                            <div className="fixed inset-0 z-40 cursor-pointer" onClick={(e) => { e.stopPropagation(); setActiveMenuTxId(null); }}></div>
                            <div className="absolute top-8 right-0 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 min-w-[180px] p-2 flex flex-col gap-1 animate-in fade-in zoom-in duration-200 origin-top-right" onClick={e => e.stopPropagation()}>
                              <button onClick={() => { setActiveMenuTxId(null); openEditor(t); }} className="flex items-center gap-3 px-3 py-2.5 active:bg-slate-50 lg:hover:bg-slate-50 rounded-xl text-left transition-colors"><Edit3 size={14} className="text-indigo-600" /> <span className="text-[10px] font-bold text-slate-600 uppercase">Editar</span></button>
                              <button onClick={() => handleDuplicate(t)} className="flex items-center gap-3 px-3 py-2.5 active:bg-slate-50 lg:hover:bg-slate-50 rounded-xl text-left transition-colors"><Copy size={14} className="text-slate-500" /> <span className="text-[10px] font-bold text-slate-600 uppercase">Duplicar</span></button>
                              <button onClick={() => { setActiveMenuTxId(null); openRecurrenceModal(t); }} className="flex items-center gap-3 px-3 py-2.5 active:bg-slate-50 lg:hover:bg-slate-50 rounded-xl text-left transition-colors"><Repeat size={14} className="text-emerald-500" /> <span className="text-[10px] font-bold text-slate-600 uppercase">Hacer Recurrente</span></button>
                              <button onClick={() => { setActiveMenuTxId(null); setFavoriteModalTx(t); setFavName(t.description); }} className="flex items-center gap-3 px-3 py-2.5 active:bg-slate-50 lg:hover:bg-slate-50 rounded-xl text-left transition-colors"><Heart size={14} className="text-amber-500" /> <span className="text-[10px] font-bold text-slate-600 uppercase">Guardar Favorito</span></button>
                              <div className="h-px bg-slate-100 my-1" />
                              <button onClick={() => { setActiveMenuTxId(null); setDeleteConfirmId(t.id); }} className="flex items-center gap-3 px-3 py-2.5 active:bg-rose-50 lg:hover:bg-rose-50 rounded-xl text-left transition-colors text-rose-500"><Trash2 size={14} /> <span className="text-[10px] font-bold uppercase">Borrar</span></button>
                            </div>
                          </>
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
                <div className="flex items-center gap-4"><select className="bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase py-2 px-3 outline-none" value={itemsPerPage} onChange={(e) => setItemsPerPage(parseInt(e.target.value))}><option value={25}>25 por pág</option><option value={50}>50 por pág</option><option value={100}>100 por pág</option><option value={-1}>Ver Todos</option></select><div className="flex items-center gap-2"><button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 bg-white border border-slate-200 rounded-xl active:bg-slate-50 lg:hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"><ChevronLeft size={16} /></button><span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Pág {currentPage} / {totalPages}</span><button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 bg-white border border-slate-200 rounded-xl active:bg-slate-50 lg:hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"><ChevronRight size={16} /></button></div></div>
              </div>
            )}
          </div>

          {selectedIds.size > 0 && (
            <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[150] animate-in slide-in-from-bottom-4 fade-in duration-300 w-max max-w-[95vw]">
              <div className="bg-slate-950 text-white rounded-2xl shadow-2xl p-2 px-4 flex items-center gap-2 sm:gap-4 border border-white/10 flex-wrap sm:flex-nowrap">
                <span className="text-[10px] font-black uppercase tracking-widest px-2">{selectedIds.size} Seleccionados</span>
                <div className="h-6 w-px bg-white/20 hidden sm:block"></div>
                <button onClick={handleBulkMarkReviewed} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 active:bg-emerald-700 lg:hover:bg-emerald-700 rounded-xl transition-all shadow-lg text-white" title="Marcar seleccionados como punteados / revisados">
                  <CheckCircle2 size={14} /> <span className="text-[10px] font-bold uppercase">Puntear ({selectedIds.size})</span>
                </button>
                <button onClick={handleBulkUnmarkReviewed} className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 active:bg-amber-700 lg:hover:bg-amber-700 rounded-xl transition-all shadow-lg text-white" title="Marcar seleccionados como pendientes de revisión">
                  <CircleDot size={14} /> <span className="text-[10px] font-bold uppercase">Desmarcar</span>
                </button>
                <div className="h-6 w-px bg-white/20 hidden sm:block"></div>
                <button onClick={() => { setBulkEditTarget('DATE'); setBulkEditValue(''); setIsBulkEditModalOpen(true); }} className="flex items-center gap-2 px-3 py-2 active:bg-white/10 lg:hover:bg-white/10 rounded-xl transition-all"><PenTool size={14} /> <span className="text-[10px] font-bold uppercase">Editar Bloque</span></button>
                <button onClick={() => { setBulkEditTarget('DELETE'); setIsBulkEditModalOpen(true); }} className="flex items-center gap-2 px-3 py-2 bg-rose-600 active:bg-rose-700 lg:hover:bg-rose-700 rounded-xl transition-all shadow-lg"><Trash2 size={14} /> <span className="text-[10px] font-bold uppercase">Borrar</span></button>
                <button onClick={() => setSelectedIds(new Set())} className="p-2 active:bg-white/10 lg:hover:bg-white/10 rounded-full text-slate-400 active:text-white lg:hover:text-white"><X size={14} /></button>
              </div>
            </div>
          )}

          {isBulkEditModalOpen && (
            <div className="fixed inset-0 bg-slate-900/5 flex items-start justify-center pt-4 md:pt-10 z-[200] p-4 animate-in fade-in duration-200 cursor-pointer" onClick={() => setIsBulkEditModalOpen(false)}>
              <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-sm p-8 space-y-6" onClick={e => e.stopPropagation()}><div className="flex justify-between items-center"><h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">{bulkEditTarget === 'DELETE' ? <Trash2 className="text-rose-500" /> : <LayoutList className="text-indigo-600" />}{bulkEditTarget === 'DELETE' ? 'Borrado Masivo' : 'Edición en Bloque'}</h3><button onClick={() => setIsBulkEditModalOpen(false)} className="p-2 bg-slate-100 rounded-full active:bg-rose-100 active:text-rose-500 lg:hover:bg-rose-100 lg:hover:text-rose-500 transition-colors"><X size={18} /></button></div>
                {bulkEditTarget === 'DELETE' ? (<p className="text-sm font-medium text-slate-600">Estás a punto de eliminar permanentemente <span className="font-black text-slate-900">{selectedIds.size}</span> movimientos. ¿Estás seguro?</p>) : (
                  <div className="space-y-4"><p className="text-xs text-slate-500">Se actualizarán <span className="font-bold">{selectedIds.size}</span> elementos.</p>
                    <div className="flex bg-slate-100 p-1.5 rounded-xl"><button onClick={() => setBulkEditTarget('DATE')} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${bulkEditTarget === 'DATE' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>Fecha</button><button onClick={() => setBulkEditTarget('ACCOUNT')} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${bulkEditTarget === 'ACCOUNT' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>Cuenta</button><button onClick={() => setBulkEditTarget('CATEGORY')} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${bulkEditTarget === 'CATEGORY' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>Categoría</button></div>
                    {bulkEditTarget === 'DATE' && (<input type="date" className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-indigo-500 touch-action-manipulation" value={bulkEditValue} onChange={e => setBulkEditValue(e.target.value)} />)}
                    {bulkEditTarget === 'ACCOUNT' && (<select className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-indigo-500" value={bulkEditValue} onChange={e => setBulkEditValue(e.target.value)}><option value="">Seleccionar Cuenta...</option>{groupedAccounts.map(g => (<optgroup key={g.group.id} label={g.group.name}>{g.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</optgroup>))}</select>)}
                    {bulkEditTarget === 'CATEGORY' && (<select className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-indigo-500" value={bulkEditValue} onChange={e => setBulkEditValue(e.target.value)}><option value="">Seleccionar Categoría...</option>{groupedCategories.map(f => (<optgroup key={f.family.id} label={f.family.name}>{f.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>))}</select>)}
                  </div>
                )}
                <button onClick={handleBulkAction} disabled={bulkEditTarget !== 'DELETE' && !bulkEditValue} className={`w-full py-4 text-white rounded-xl font-black uppercase text-[11px] tracking-widest shadow-xl transition-all ${bulkEditTarget === 'DELETE' ? 'bg-rose-600 active:bg-rose-700 lg:hover:bg-rose-700' : 'bg-indigo-600 active:bg-indigo-700 lg:hover:bg-indigo-700 disabled:opacity-50'}`}>{bulkEditTarget === 'DELETE' ? 'Confirmar Borrado' : 'Aplicar Cambios'}</button>

              </div>
            </div>
          )}
        </>
      )}

      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/5 flex items-start justify-center pt-4 md:pt-10 z-[200] p-4 animate-in fade-in duration-500 cursor-pointer" onClick={closeImportModal}>
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl p-8 sm:p-12 relative max-h-[95vh] overflow-y-auto custom-scrollbar border border-slate-200" onClick={e => e.stopPropagation()}>
            <button onClick={closeImportModal} className="absolute top-8 right-8 p-3 bg-slate-50 text-slate-400 rounded-full active:text-rose-50 lg:hover:text-rose-500"><X size={24} /></button>
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
                      return (<optgroup key={group.id} label={group.name}>{activeAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</optgroup>);
                    })}
                  </select>
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">2. Copia y Pega tus movimientos</label>
                  <textarea ref={rawImportTextRef} className="w-full h-40 p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] font-mono text-xs outline-none focus:border-indigo-500 transition-all resize-none shadow-inner" placeholder={`Formato esperado:\nDD/MM/AAAA; Concepto del movimiento; -50,00\nDD/MM/AAAA; Ingreso de Nómina; 1500,00\n...`} onBlur={(e) => handleStartAnalysis(e.target.value)} />
                  <div className="flex justify-between items-start">
                    <p className="text-[10px] text-slate-400 font-medium pl-2 max-w-[70%]">El sistema detectará automáticamente fecha, concepto e importe. Usa punto y coma (;) o tabuladores para separar.</p>
                    <button onClick={() => handleStartAnalysis(rawImportTextRef.current?.value || '')} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:bg-indigo-700 lg:hover:bg-indigo-700 transition-all shadow-lg flex items-center gap-2 -mt-2"><Sparkles size={14} /> Analizar Texto</button>
                  </div>
                </div>
                <div className="relative flex items-center justify-center py-4"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div><span className="relative bg-white px-4 text-[10px] font-black uppercase text-slate-300">O sube un archivo</span></div>
                <div className="space-y-4">
                  <button onClick={() => importFileRef.current?.click()} className="w-full py-5 bg-white border-2 border-dashed border-indigo-200 text-indigo-500 rounded-3xl font-black uppercase text-[11px] tracking-widest active:bg-indigo-50 lg:hover:bg-indigo-50 transition-all flex flex-col items-center justify-center gap-2 group"><Upload size={24} className="active:scale-110 lg:group-hover:scale-110 transition-transform" /><span>Subir Archivo (.xlsx, .xls, .csv)</span></button>
                  <input type="file" ref={importFileRef} className="hidden" accept=".csv, .xlsx, .xls" onChange={handleImportFileUpload} />
                </div>
              </div>
            )}

            {importStep === 2 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                <div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl flex items-start gap-4">
                  <div className="bg-amber-100 p-3 rounded-2xl text-amber-600"><AlertTriangle size={24} /></div>
                  <div>
                    <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight">Posibles Duplicados</h4>
                    <p className="text-xs text-slate-500 mt-1 font-medium">Hemos detectado <span className="font-black text-slate-900">{duplicateProps.length}</span> movimientos que coinciden en fecha e importe con registros existentes. Revisa y decide qué hacer.</p>
                  </div>
                </div>

                <div className="space-y-4 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
                  {duplicateProps.map(t => (
                    <div key={t.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group active:border-indigo-200 lg:hover:border-indigo-200 transition-all">
                      <div className="flex items-center gap-4">

                        <div className="bg-rose-50 text-rose-500 p-2 rounded-xl font-black text-[10px] uppercase tracking-widest w-12 text-center flex flex-col justify-center">
                          <span>{t.date.split('-')[2]}</span>
                          <span className="text-[8px] opacity-70">{months[parseInt(t.date.split('-')[1]) - 1]?.substring(0, 3)}</span>
                        </div>
                        <div>
                          <div className="font-bold text-slate-700 text-xs truncate max-w-[200px]">{t.description}</div>
                          <div className={`text-[10px] font-black ${t.amount > 0 ? 'text-emerald-600 font-bold' : t.amount < 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>{formatCurrency(t.amount)}</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { const newArr = [...proposedTransactions]; const idx = newArr.findIndex(p => p.id === t.id); if (idx !== -1) { newArr[idx].isDuplicate = false; setProposedTransactions(newArr); } }} className="px-3 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[9px] font-black uppercase active:bg-emerald-100 lg:hover:bg-emerald-100 transition-colors flex items-center gap-1"><CheckCircle2 size={12} /> Importar</button>
                        <button onClick={() => setProposedTransactions(proposedTransactions.filter(p => p.id !== t.id))} className="px-3 py-2 bg-slate-50 text-slate-400 rounded-xl text-[9px] font-black uppercase active:bg-rose-50 lg:hover:bg-rose-50 active:text-rose-500 lg:hover:text-rose-500 transition-colors flex items-center gap-1"><Trash2 size={12} /> Descartar</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-4 pt-4 border-t border-slate-100">
                  <button onClick={() => { setProposedTransactions(proposedTransactions.filter(p => !p.isDuplicate)); setImportStep(3); }} className="w-full py-4 bg-slate-950 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest active:bg-indigo-600 lg:hover:bg-indigo-600 shadow-xl transition-all flex items-center justify-center gap-2">Continuar (Descartar Duplicados Restantes) <ArrowRightLeft size={16} /></button>
                </div>
              </div>
            )}

            {importStep === 3 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 relative">
                <div className="flex justify-between items-center px-2">
                  <div className="flex items-center gap-3">
                    <button onClick={toggleSelectAllImport} className="text-slate-400 active:text-indigo-600 lg:hover:text-indigo-600">{proposedTransactions.length > 0 && proposedTransactions.every(p => selectedImportIds.has(p.id)) ? <CheckSquare size={16} /> : <Square size={16} />}</button>
                    <span className="text-xs font-bold text-slate-500 uppercase">Revisión ({proposedTransactions.length})</span>
                  </div>
                  <div className="flex gap-2"><button onClick={() => { setProposedTransactions([]); setImportStep(1); setSelectedImportIds(new Set()); }} className="text-[10px] font-black uppercase text-rose-500 active:underline lg:hover:underline">Descartar Todo</button></div>
                </div>
                <div className="max-h-[400px] overflow-y-auto custom-scrollbar space-y-2 pr-2 pb-16">
                  {normalProps.length > 0 && (
                    <div className="space-y-2">
                      {normalProps.map((t) => {
                        const isAssigned = !!t.categoryId || (t.type === 'TRANSFER' && t.transferAccountId);
                        const idxInMaster = proposedTransactions.findIndex(pt => pt.id === t.id);

                        return (
                          <div key={t.id} className={`p-4 rounded-2xl flex items-center gap-4 bg-white border border-slate-100 shadow-sm active:shadow-md lg:hover:shadow-md transition-all group`}>
                            <button onClick={() => toggleImportSelection(t.id)} className={`text-slate-300 active:text-indigo-600 lg:hover:text-indigo-600 flex-shrink-0 transition-colors`}>{selectedImportIds.has(t.id) ? <CheckSquare size={16} className="text-indigo-600" /> : <Square size={16} />}</button>
                            <div className="flex-1 min-w-0 grid grid-cols-[repeat(16,minmax(0,1fr))] gap-4 items-center">
                              <div className="col-span-2 text-[10px] font-bold text-slate-400 whitespace-nowrap">
                                {formatDateDisplay(t.date)}
                              </div>
                              <input type="text" className="col-span-6 text-xs font-bold text-slate-800 bg-slate-50/50 active:bg-white lg:hover:bg-white border-b border-slate-200 focus:border-indigo-500 rounded px-2 py-1 outline-none transition-all placeholder-slate-300 touch-action-manipulation" value={t.description} onChange={(e) => { const newArr = [...proposedTransactions]; newArr[idxInMaster].description = e.target.value; const newCat = findSuggestedCategory(e.target.value); if (newCat) { newArr[idxInMaster].categoryId = newCat; newArr[idxInMaster].transferAccountId = undefined; } setProposedTransactions(newArr); }} />
                              <div className={`col-span-3 text-xs font-black text-right whitespace-nowrap ${t.amount > 0 ? 'text-emerald-600 font-bold' : t.amount < 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>{formatCurrency(t.amount)}</div>
                              <div className="col-span-5 relative">
                                <button onClick={(e) => { e.stopPropagation(); if (openSelectorId === t.id) setOpenSelectorId(null); else { setOpenSelectorId(t.id); setSelectorSearchTerm(''); } }} className={`w-full border rounded-lg text-[11px] font-bold py-1.5 px-2 outline-none transition-colors flex items-center justify-between gap-2 cursor-pointer ${isAssigned ? 'bg-indigo-50 border-indigo-100 text-indigo-700' : 'bg-slate-50 border-slate-100 text-slate-400 active:border-slate-300 lg:hover:border-slate-300'}`}>
                                  <span className="truncate">{t.type === 'TRANSFER' && t.transferAccountId ? `${t.amount < 0 ? '➡' : '⬅'} ${indices.acc.get(t.transferAccountId)?.name || 'Cuenta...'}` : (indices.cat.get(t.categoryId)?.name || 'Sin Asignar')}</span><ChevronDown size={12} className="opacity-50" />
                                </button>
                              </div>
                            </div>
                            <button onClick={() => setProposedTransactions(proposedTransactions.filter(pt => pt.id !== t.id))} className="text-slate-300 active:text-rose-50 p-2 rounded-full active:bg-rose-50 lg:hover:bg-rose-50 active:text-rose-500 lg:hover:text-rose-500 transition-colors opacity-100 lg:opacity-0 lg:group-hover:opacity-100 touch-action-manipulation"><X size={16} /></button>
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
                        <button onClick={handleBulkAcceptDuplicates} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 active:bg-emerald-500 lg:hover:bg-emerald-500 rounded-lg transition-colors text-[9px] font-bold uppercase">
                          <Check size={14} /> Aceptar Duplicados
                        </button>
                      )}

                      <select className="bg-slate-800 text-white text-[9px] font-bold py-1.5 px-2 rounded-lg outline-none border border-slate-700 max-w-[120px]" value={bulkImportCategory} onChange={(e) => setBulkImportCategory(e.target.value)}>
                        <option value="">Asignar Categoría...</option>
                        {groupedCategories.map(f => (<optgroup key={f.family.id} label={f.family.name}>{f.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>))}
                      </select>
                      <button onClick={handleBulkImportAssign} className="p-1.5 bg-indigo-600 active:bg-indigo-500 lg:hover:bg-indigo-500 rounded-lg transition-colors" disabled={!bulkImportCategory}><Check size={14} /></button>
                      <button onClick={handleBulkImportDelete} className="p-1.5 bg-rose-600 active:bg-rose-500 lg:hover:bg-rose-500 rounded-lg transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </div>
                )}
                <div className="flex gap-4"><button onClick={handleFinalImport} className="flex-1 py-6 bg-slate-950 text-white rounded-[2rem] font-black uppercase text-[12px] tracking-widest shadow-2xl active:bg-emerald-600 lg:hover:bg-emerald-600 transition-all">Confirmar Importación ({proposedTransactions.filter(p => !p.isDuplicate && (p.categoryId || p.transferAccountId)).length})</button></div>
                <input type="file" ref={rowImportFileRef} className="hidden" accept="image/*,application/pdf" onChange={handleRowImportFileChange} />
              </div>
            )}
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/5 flex items-start justify-center pt-4 md:pt-10 z-[200] p-4 animate-in fade-in zoom-in duration-300 cursor-pointer" onClick={closeModal}>
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg p-10 relative border border-slate-200 max-h-[95vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
            <button onClick={closeModal} className="absolute top-8 right-8 p-3 bg-slate-50 text-slate-400 rounded-full active:text-rose-50 lg:hover:text-rose-500 active:bg-rose-50 lg:hover:bg-rose-50 transition-all"><X size={24} /></button>
            <h3 className="text-2xl font-black text-slate-900 uppercase flex items-center gap-3 mb-8"><Edit3 className="text-indigo-600" /> {editingTx ? 'Editar Movimiento' : 'Nuevo Movimiento'}</h3>
            {formError && <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold animate-in fade-in slide-in-from-top-2">{formError}</div>}
            <div className="space-y-6"><div className="bg-slate-100 p-1.5 rounded-2xl flex shadow-inner"><button onClick={() => setFType('EXPENSE')} className={`flex-1 py-4 text-[10px] font-black uppercase rounded-xl transition-all ${fType === 'EXPENSE' ? 'bg-white shadow-sm text-rose-500' : 'text-slate-400 active:text-slate-600 lg:hover:text-slate-600'}`}>Gasto</button><button onClick={() => setFType('INCOME')} className={`flex-1 py-4 text-[10px] font-black uppercase rounded-xl transition-all ${fType === 'INCOME' ? 'bg-white shadow-sm text-emerald-500' : 'text-slate-400 active:text-slate-600 lg:hover:text-slate-600'}`}>Ingreso</button><button onClick={() => { setFType('TRANSFER'); if (!fDesc) setFDesc('Traspaso'); }} className={`flex-1 py-4 text-[10px] font-black uppercase rounded-xl transition-all ${fType === 'TRANSFER' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 active:text-slate-600 lg:hover:text-slate-600'}`}>Traspaso</button></div>
              <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Importe</label><div className="relative"><span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-black">€</span><input type="number" step="0.01" inputMode="decimal" placeholder="0.00" className="w-full pl-10 pr-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-xl outline-none focus:border-indigo-500 transition-all touch-action-manipulation" value={fAmount} onChange={e => setFAmount(e.target.value)} /></div></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Fecha</label>
                  <input type="date" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={fDate} onChange={e => setFDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{fType === 'TRANSFER' ? 'Desde' : 'Cuenta'}</label>
                  <button
                    onClick={() => setSelectorTarget('ACC')}
                    className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all text-left flex items-center justify-between cursor-pointer touch-action-manipulation"
                  >
                    <span className="truncate flex items-center gap-2">
                      {renderIcon(indices.acc.get(fAcc)?.icon || '🏦', "w-5 h-5")}
                      <span>{indices.acc.get(fAcc)?.name || 'Cuenta...'}</span>
                    </span>
                    <ChevronDown size={16} className="opacity-50" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 animate-in slide-in-from-top-2 relative">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">
                  {fType === 'TRANSFER' ? 'Hacia Cuenta Destino' : 'Categoría / Destino'}
                </label>
                <button
                  onClick={() => setSelectorTarget('CAT')}
                  className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all text-left flex items-center justify-between cursor-pointer touch-action-manipulation"
                >
                  <span className="truncate flex items-center gap-2">
                    {fType === 'TRANSFER' && fTransferDest ? (
                      <>
                        {renderIcon(indices.acc.get(fTransferDest)?.icon || '🏦', "w-5 h-5")}
                        <span>{indices.acc.get(fTransferDest)?.name || 'Cuenta...'}</span>
                      </>
                    ) : (
                      <>
                        {renderIcon(indices.cat.get(fCat)?.icon || '🏷️', "w-5 h-5")}
                        <span>{fCat ? indices.cat.get(fCat)?.name || 'Categoría...' : 'Selecciona categoría o destino...'}</span>
                      </>
                    )}
                  </span>
                  <ChevronDown size={16} className="opacity-50" />
                </button>
              </div>

              <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Concepto</label><input type="text" placeholder="Ej: Compra semanal..." className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={fDesc} onChange={e => { setFDesc(e.target.value); if (!editingTx && !fCat && fType !== 'TRANSFER') { const sugg = findSuggestedCategory(e.target.value); if (sugg) setFCat(sugg); } }} /></div>
              <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Comprobante (Opcional)</label><div className="flex items-center gap-3"><button type="button" onClick={() => fileInputRef.current?.click()} className="flex-1 py-4 bg-white border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 active:border-indigo-400 lg:hover:border-indigo-400 active:text-indigo-500 lg:hover:text-indigo-500 transition-all font-bold uppercase text-[10px] flex justify-center items-center gap-2" disabled={isCompressing}>{isCompressing ? <span className="animate-spin">⏳</span> : <Paperclip size={16} />}{fAttachment ? 'Cambiar Archivo' : 'Adjuntar Imagen'}</button>{fAttachment && (<button type="button" onClick={() => setFAttachment(undefined)} className="p-4 bg-rose-50 text-rose-500 rounded-2xl active:bg-rose-100 lg:hover:bg-rose-100"><Trash2 size={18} /></button>)}</div><input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} />{fAttachment && <div className="flex items-center gap-2 text-[10px] text-emerald-500 font-bold"><p className="flex items-center gap-1"><Check size={12} /> {fAttachment.startsWith('data:') ? 'Archivo listo para guardar' : 'Comprobante adjuntado'}</p><button type="button" onClick={() => setPreviewAttachment(fAttachment)} className="text-indigo-500 underline font-bold ml-1">Ver</button></div>}</div>
              <button onClick={handleSave} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] active:bg-indigo-600 lg:hover:bg-indigo-600 shadow-xl tracking-widest transition-all active:scale-95">{editingTx ? 'Actualizar Movimiento' : 'Guardar Movimiento'}</button>
            </div>
          </div>
        </div>
      )}

      {recurrenceModalTx && (
        <div className="fixed inset-0 bg-slate-900/5 flex items-start justify-center pt-4 md:pt-10 z-[200] p-4 animate-in fade-in zoom-in duration-300 cursor-pointer" onClick={() => setRecurrenceModalTx(null)}>
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl p-6 relative border border-slate-200 max-h-[95vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
            <button onClick={() => setRecurrenceModalTx(null)} className="absolute top-6 right-6 p-2 bg-slate-50 text-slate-400 rounded-full active:text-rose-50 lg:hover:text-rose-500 transition-colors"><X size={20} /></button>
            <h3 className="text-xl font-black text-slate-900 uppercase flex items-center gap-2 mb-6"><CalendarClock className="text-indigo-600" size={24} /> Crear Recurrencia</h3>
            {formError && <div className="col-span-12 mb-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-[10px] font-bold">{formError}</div>}
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
                <button onClick={() => setIsRecSelectorOpen(true)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none text-sm focus:border-indigo-500 transition-colors text-left flex items-center justify-between cursor-pointer">
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
                  <ChevronDown size={14} className="opacity-50" />
                </button>
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
                <button onClick={() => setRecurrenceModalTx(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-xl font-black uppercase text-[11px] active:bg-slate-200 lg:hover:bg-slate-200 transition-all">Cancelar</button>
                <button onClick={handleSaveRecurrent} className="flex-[2] py-4 bg-slate-950 text-white rounded-xl font-black uppercase text-[11px] active:bg-indigo-600 lg:hover:bg-indigo-600 shadow-lg transition-all active:scale-[0.98]">Confirmar Recurrencia</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {favoriteModalTx && (
        <div className="fixed inset-0 bg-slate-900/5 flex items-start justify-center pt-4 md:pt-10 z-[200] p-4 animate-in fade-in zoom-in duration-300 cursor-pointer" onClick={() => setFavoriteModalTx(null)}>
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-sm p-8 text-center relative border border-slate-200" onClick={e => e.stopPropagation()}><button onClick={() => setFavoriteModalTx(null)} className="absolute top-6 right-6 p-2 bg-slate-50 text-slate-400 rounded-full active:text-rose-50 lg:hover:text-rose-500 active:bg-rose-50 lg:hover:bg-rose-50 transition-all"><X size={20} /></button><div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-amber-500"><Heart size={32} /></div><h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Guardar Favorito</h3>
            <div className="space-y-4"><div className="space-y-2 text-left"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nombre del Botón</label><input type="text" placeholder="Ej: Café Diario" className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-amber-400 transition-colors touch-action-manipulation" value={favName} onChange={e => setFavName(e.target.value)} /></div><button onClick={handleSaveFavorite} className="w-full py-4 bg-amber-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest active:bg-amber-600 lg:hover:bg-amber-600 shadow-xl touch-action-manipulation">Guardar Plantilla</button></div>
          </div>
        </div>
      )}

      {previewAttachment && (() => {
        const getAttachmentUrl = (url: string) => {
          if (!url) return '';
          if (url.startsWith('data:') || url.startsWith('blob:')) return url;
          const token = localStorage.getItem('auth_token') || '';
          if (!token) return url;
          const sep = url.includes('?') ? '&' : '?';
          return `${url}${sep}key=${encodeURIComponent(token)}`;
        };
        const resolvedUrl = getAttachmentUrl(previewAttachment);
        const isPdf = previewAttachment.toLowerCase().includes('.pdf') || previewAttachment.includes('application/pdf');

        const isIOS = typeof navigator !== 'undefined' && (
          /iPad|iPhone|iPod/.test(navigator.userAgent) || 
          (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
        );

        const handleDownload = async (e: React.MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();

          try {
            const filename = isPdf ? `ticket_${Date.now()}.pdf` : `comprobante_${Date.now()}.jpg`;
            const mime = isPdf ? 'application/pdf' : 'image/jpeg';

            // 1. En iOS (iPhone / iPad / Safari PWA), el API nativo navigator.share
            // abre el Share Sheet oficial de iOS ("Guardar en Archivos", "Imprimir", etc.)
            // ¡sin abandonar jamás la app de ContaMiki ni recargar la pantalla!
            if (isIOS && navigator.share && navigator.canShare) {
              try {
                const res = await fetch(resolvedUrl);
                const blob = await res.blob();
                const file = new File([blob], filename, { type: blob.type || mime });
                if (navigator.canShare({ files: [file] })) {
                  await navigator.share({
                    files: [file],
                    title: isPdf ? 'Ticket PDF' : 'Comprobante',
                  });
                  return;
                }
              } catch (shareErr: any) {
                if (shareErr.name === 'AbortError') return; // Cancelado por el usuario
              }
            }

            // 2. En escritorio o navegadores estándar, descarga limpia mediante Blob URL
            const res = await fetch(resolvedUrl);
            const blob = await res.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = blobUrl;
            a.download = filename;
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
              document.body.removeChild(a);
              window.URL.revokeObjectURL(blobUrl);
            }, 1000);
          } catch (err) {
            console.warn('Error descargando adjunto:', err);
            // Fallback seguro: abrir en pestaña nueva en vez de navegar la ventana actual
            window.open(resolvedUrl, '_blank');
          }
        };

        return (
          <div 
            className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-between z-[300] p-4 sm:p-6 animate-in fade-in zoom-in duration-300" 
            onClick={() => setPreviewAttachment(null)}
          >
            {/* Header del visualizador con botón de cerrar visible y seguro en iOS */}
            <div 
              className="w-full max-w-4xl flex items-center justify-between pb-3 text-white border-b border-white/10 shrink-0" 
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{isPdf ? '📄' : '🖼️'}</span>
                <span className="font-bold text-xs uppercase tracking-wider text-slate-200">
                  {isPdf ? 'Comprobante PDF' : 'Imagen Comprobante'}
                </span>
              </div>
              <button 
                type="button"
                onClick={() => setPreviewAttachment(null)} 
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-full text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer touch-action-manipulation"
              >
                <X size={16} /> <span>Cerrar</span>
              </button>
            </div>

            {/* Contenedor del documento */}
            <div 
              className="relative max-w-4xl w-full flex-1 flex items-center justify-center my-3 overflow-hidden" 
              onClick={e => e.stopPropagation()}
            >
              {isPdf ? (
                <PdfViewer url={resolvedUrl} />
              ) : (
                <img 
                  src={resolvedUrl} 
                  className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border-2 border-white/10" 
                  alt="Comprobante" 
                />
              )}
            </div>

            {/* Barra de acciones inferior */}
            <div 
              className="w-full max-w-4xl flex items-center justify-center gap-3 pt-2 shrink-0" 
              onClick={e => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={handleDownload}
                className="px-6 py-3 bg-white hover:bg-slate-100 active:scale-95 text-slate-900 rounded-full font-black uppercase text-[10px] tracking-widest transition-all shadow-xl flex items-center gap-2 touch-action-manipulation cursor-pointer"
              >
                <Download size={14} /> 
                {isIOS 
                  ? 'Guardar / Compartir Documento' 
                  : (isPdf ? 'Descargar Ticket PDF' : 'Descargar Imagen')}
              </button>
              <button
                type="button"
                onClick={() => setPreviewAttachment(null)}
                className="px-5 py-3 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-full font-bold uppercase text-[10px] tracking-widest transition-all flex items-center gap-1.5 touch-action-manipulation cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        );
      })()}

      {/* Global Selectors moved to top level to fix stacking and positioning issues */}
      {openSelectorId && (
        <div className="fixed inset-0 z-[250] flex items-start justify-center pt-4 md:pt-10 p-4 bg-slate-900/40 backdrop-blur-sm cursor-pointer" onClick={(e) => { e.stopPropagation(); setOpenSelectorId(null); }}>
          {(() => {
            const t = proposedTransactions.find(pt => pt.id === openSelectorId);
            const idxInMaster = proposedTransactions.findIndex(pt => pt.id === openSelectorId);
            if (!t) return null;
            return (
              <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 w-[600px] max-w-[95vw] flex overflow-hidden text-left animate-in fade-in zoom-in-95 duration-200 max-h-[85vh] relative cursor-default" onClick={e => e.stopPropagation()}>
                <button onClick={() => setOpenSelectorId(null)} className="absolute top-4 right-4 p-2 bg-slate-100 text-slate-400 rounded-full active:text-rose-50 lg:hover:text-rose-500 transition-colors z-20 cursor-pointer touch-action-manipulation"><X size={18} /></button>
                <div className="flex-1 border-r border-slate-100 overflow-y-auto custom-scrollbar bg-slate-50/50">
                  <div className="p-3 sticky top-0 bg-slate-50/95 backdrop-blur-sm border-b border-slate-100 z-10 space-y-2">
                    <div className="font-black text-[10px] text-slate-400 uppercase tracking-widest text-center">Categorías Activas</div>
                    <div className="relative">
                      <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar..."
                        className="w-full pl-7 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[16px] sm:text-[10px] font-bold outline-none focus:border-indigo-500 transition-all placeholder-slate-300 touch-action-manipulation"
                        value={selectorSearchTerm}
                        onChange={e => setSelectorSearchTerm(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        inputMode="text"
                        autoComplete="off"
                        autoFocus
                      />
                    </div>
                  </div>
                  {activeGroupedCategories.map(f => {
                    const matchingCats = f.categories.filter(c => !selectorSearchTerm || c.name.toLowerCase().includes(selectorSearchTerm.toLowerCase()) || f.family.name.toLowerCase().includes(selectorSearchTerm.toLowerCase()));
                    if (matchingCats.length === 0) return null;
                    return (<div key={f.family.id}><div className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase bg-slate-100/50 sticky top-0 z-0">{f.family.name}</div>{matchingCats.map(c => (<button key={c.id} onClick={() => { const newArr = [...proposedTransactions]; newArr[idxInMaster].categoryId = c.id; newArr[idxInMaster].transferAccountId = undefined; newArr[idxInMaster].type = newArr[idxInMaster].amount < 0 ? 'EXPENSE' : 'INCOME'; setProposedTransactions(newArr); setOpenSelectorId(null); }} className={`w-full text-left px-4 py-3 active:bg-indigo-50 active:text-indigo-700 lg:hover:bg-indigo-50 lg:hover:text-indigo-700 text-[11px] font-bold text-slate-600 truncate border-b border-slate-50 transition-colors flex items-center gap-3 cursor-pointer touch-action-manipulation ${t.categoryId === c.id ? 'bg-indigo-50 text-indigo-700' : ''}`}>{renderIcon(c.icon, "w-5 h-5")} <span>{c.name}</span></button>))}</div>);
                  })}
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-white"><div className="p-3 sticky top-0 bg-white/95 backdrop-blur-sm border-b border-slate-100 font-black text-[10px] text-slate-400 uppercase tracking-widest z-10 text-center">Traspasos Activos</div>{activeGroupedAccounts.map(g => { const availableAccs = g.accounts.filter(a => a.id !== importAccount); if (availableAccs.length === 0) return null; return (<div key={g.group.id}><div className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase bg-slate-50 sticky top-0 z-0">{g.group.name}</div>{availableAccs.map(a => (<button key={a.id} onClick={() => { const newArr = [...proposedTransactions]; newArr[idxInMaster].type = 'TRANSFER'; newArr[idxInMaster].transferAccountId = a.id; newArr[idxInMaster].categoryId = ''; setProposedTransactions(newArr); setOpenSelectorId(null); }} className={`w-full text-left px-4 py-3 active:bg-emerald-50 active:text-emerald-700 lg:hover:bg-emerald-50 lg:hover:text-emerald-700 text-[11px] font-bold text-slate-600 truncate border-b border-slate-50 transition-colors flex items-center gap-3 cursor-pointer touch-action-manipulation ${t.transferAccountId === a.id ? 'bg-emerald-50 text-emerald-700' : ''}`}>➡ {renderIcon(a.icon, "w-5 h-5")} <span>{a.name}</span></button>))}</div>); })}</div>
              </div>
            );
          })()}
        </div>
      )}

      {selectorTarget && (
        <div className="fixed inset-0 z-[250] flex items-start justify-center pt-4 md:pt-10 p-4 bg-slate-900/40 backdrop-blur-sm cursor-pointer" onClick={(e) => { e.stopPropagation(); setSelectorTarget(null); setModalSearchTerm(''); }}>
          <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 w-[450px] max-w-[95vw] flex flex-col overflow-hidden text-left animate-in fade-in zoom-in-95 duration-200 max-h-[85vh] relative cursor-default" onClick={e => e.stopPropagation()}>
            <button onClick={() => { setSelectorTarget(null); setModalSearchTerm(''); }} className="absolute top-4 right-4 p-2 bg-slate-100 text-slate-400 rounded-full active:text-rose-50 lg:hover:text-rose-500 transition-colors z-20 cursor-pointer touch-action-manipulation"><X size={18} /></button>

            <div className="p-3 sticky top-0 bg-slate-50/95 backdrop-blur-sm border-b border-slate-100 z-10 space-y-2">
              <div className="font-black text-[10px] text-slate-400 uppercase tracking-widest text-center">
                {selectorTarget === 'ACC' ? 'Seleccionar Cuenta' : (fType === 'TRANSFER' ? 'Cuenta Destino' : 'Seleccionar Categoría')}
              </div>
              <div className="relative">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  className="w-full pl-7 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[16px] sm:text-[10px] font-bold outline-none focus:border-indigo-500 transition-all placeholder-slate-300 touch-action-manipulation"
                  value={modalSearchTerm}
                  onChange={e => setModalSearchTerm(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  inputMode="text"
                  autoComplete="off"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
              {((selectorTarget === 'CAT' && fType !== 'TRANSFER') ? activeGroupedCategories : []).map(f => {
                const matchingCats = f.categories.filter(c => !modalSearchTerm || c.name.toLowerCase().includes(modalSearchTerm.toLowerCase()) || f.family.name.toLowerCase().includes(modalSearchTerm.toLowerCase()));
                if (matchingCats.length === 0) return null;
                return (
                  <div key={f.family.id}>
                    <div className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase bg-slate-100/50 sticky top-0 z-0">{f.family.name}</div>
                    {matchingCats.map(c => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setFCat(c.id);
                          setFTransferDest('');
                          setFType(f.family.type);
                          setSelectorTarget(null);
                          setModalSearchTerm('');
                        }}
                        className={`w-full text-left px-4 py-3 active:bg-indigo-50 active:text-indigo-700 lg:hover:bg-indigo-50 lg:hover:text-indigo-700 text-[11px] font-bold text-slate-600 truncate border-b border-slate-50 transition-colors flex items-center gap-3 cursor-pointer touch-action-manipulation ${fCat === c.id ? 'bg-indigo-50 text-indigo-700' : ''}`}
                      >
                        {renderIcon(c.icon, "w-5 h-5")} <span>{c.name}</span>
                      </button>
                    ))}
                  </div>
                );
              })}

              {((selectorTarget === 'ACC' || (selectorTarget === 'CAT' && fType === 'TRANSFER')) ? activeGroupedAccounts : []).map(g => {
                const availableAccs = g.accounts.filter(a => {
                  const isNotSource = selectorTarget === 'ACC' || a.id !== fAcc;
                  const matchesSearch = !modalSearchTerm || a.name.toLowerCase().includes(modalSearchTerm.toLowerCase()) || g.group.name.toLowerCase().includes(modalSearchTerm.toLowerCase());
                  return isNotSource && matchesSearch;
                });
                if (availableAccs.length === 0) return null;
                return (
                  <div key={g.group.id}>
                    <div className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase bg-slate-50 sticky top-0 z-0">{g.group.name}</div>
                    {availableAccs.map(a => (
                      <button
                        key={a.id}
                        onClick={() => {
                          if (selectorTarget === 'ACC') {
                            setFAcc(a.id);
                          } else {
                            setFTransferDest(a.id);
                            setFCat('');
                            setFType('TRANSFER');
                          }
                          setSelectorTarget(null);
                          setModalSearchTerm('');
                        }}
                        className={`w-full text-left px-4 py-3 active:bg-emerald-50 active:text-emerald-700 lg:hover:bg-emerald-50 lg:hover:text-emerald-700 text-[11px] font-bold text-slate-600 truncate border-b border-slate-50 transition-colors flex items-center gap-3 cursor-pointer touch-action-manipulation ${(selectorTarget === 'CAT' ? fTransferDest : fAcc) === a.id ? 'bg-emerald-50 text-emerald-700' : ''}`}
                      >
                        {selectorTarget === 'CAT' ? '➡ ' : ''}{renderIcon(a.icon, "w-5 h-5")} <span>{a.name}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Sincronización Bancaria Rápida (Open Banking) */}
      {isBankSyncModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 space-y-5 shadow-2xl max-h-[85vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shadow-xs">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base uppercase">Sincronización Bancaria</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Descarga movimientos automáticos sin salir del Diario</p>
                </div>
              </div>
              <button
                onClick={() => !isSyncingBanks && setIsBankSyncModalOpen(false)}
                disabled={isSyncingBanks}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Feedback message */}
            {bankSyncFeedback && (
              <div className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 ${bankSyncFeedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                <span>{bankSyncFeedback.message}</span>
              </div>
            )}

            {/* Content */}
            {isLoadingBankAccounts ? (
              <div className="py-12 text-center space-y-3">
                <RefreshCw size={24} className="animate-spin text-sky-600 mx-auto" />
                <p className="text-xs text-slate-500 font-bold">Consultando cuentas vinculadas...</p>
              </div>
            ) : bankAccountsList.length === 0 ? (
              <div className="py-8 text-center space-y-3 bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6">
                <Building2 size={28} className="text-slate-400 mx-auto" />
                <p className="text-xs text-slate-700 font-bold">No hay cuentas bancarias vinculadas todavía.</p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Ve a la pestaña <strong>Ajustes ➔ Bancos & Tickets</strong> para vincular tu banco oficial mediante Enable Banking.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Action bar */}
                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs">
                  <span className="font-bold text-slate-700 text-[11px]">
                    {selectedBankUids.length} de {bankAccountsList.length} cuenta(s) seleccionada(s)
                  </span>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setSelectedBankUids(bankAccountsList.map(a => a.uid))}
                      disabled={isSyncingBanks}
                      className="font-bold text-sky-600 hover:text-sky-800 hover:underline cursor-pointer"
                    >
                      Marcar todas
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={() => setSelectedBankUids([])}
                      disabled={isSyncingBanks}
                      className="font-bold text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
                    >
                      Desmarcar todas
                    </button>
                  </div>
                </div>

                {/* Account list */}
                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                  {bankAccountsList.map(acc => {
                    const isSelected = selectedBankUids.includes(acc.uid);
                    return (
                      <div
                        key={acc.uid}
                        onClick={() => {
                          if (isSyncingBanks) return;
                          setSelectedBankUids(prev =>
                            prev.includes(acc.uid) ? prev.filter(id => id !== acc.uid) : [...prev, acc.uid]
                          );
                        }}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${isSelected
                            ? 'bg-sky-50/60 border-sky-300 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300 opacity-70'
                          }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => { }}
                            disabled={isSyncingBanks}
                            className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300 cursor-pointer shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-900 text-xs truncate">{acc.name}</span>
                              <span className="text-[10px] text-slate-600 font-bold bg-slate-100 px-1.5 py-0.5 rounded">
                                {acc.bankName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5 truncate">
                              {acc.iban && <span className="font-mono">{acc.iban}</span>}
                              <span>➔</span>
                              <span className="text-sky-700 font-bold truncate">💳 {acc.mappedAccountName}</span>
                            </div>
                            {acc.lastSync && (
                              <p className="text-[9px] text-emerald-600 font-medium mt-0.5">
                                Última sinc: {new Date(acc.lastSync).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0">
                          {isSelected ? (
                            <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center">
                              <Check size={12} />
                            </span>
                          ) : (
                            <span className="w-5 h-5 rounded-full border border-slate-300" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Modal footer buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsBankSyncModalOpen(false)}
                    disabled={isSyncingBanks}
                    className="w-1/3 py-3 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-bold uppercase text-[11px] transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteBankSync}
                    disabled={isSyncingBanks || selectedBankUids.length === 0}
                    className="w-2/3 py-3 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-xl font-bold uppercase text-[11px] tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RefreshCw size={14} className={isSyncingBanks ? 'animate-spin' : ''} />
                    <span>
                      {isSyncingBanks
                        ? 'Sincronizando...'
                        : `Sincronizar (${selectedBankUids.length})`}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isRecSelectorOpen && (
        <div className="fixed inset-0 z-[250] flex items-start justify-center pt-4 md:pt-10 p-4 bg-slate-900/40 backdrop-blur-sm cursor-pointer" onClick={(e) => { e.stopPropagation(); setIsRecSelectorOpen(false); }}>
          <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 w-[600px] max-w-[95vw] flex overflow-hidden text-left animate-in fade-in zoom-in-95 duration-200 max-h-[85vh] relative cursor-default" onClick={e => e.stopPropagation()}>
            <button onClick={() => setIsRecSelectorOpen(false)} className="absolute top-4 right-4 p-2 bg-slate-100 text-slate-400 rounded-full active:text-rose-50 lg:hover:text-rose-500 transition-colors z-20 cursor-pointer touch-action-manipulation"><X size={18} /></button>
            <div className="flex-1 border-r border-slate-100 overflow-y-auto custom-scrollbar bg-slate-50/50">
              <div className="p-3 sticky top-0 bg-slate-50/95 backdrop-blur-sm border-b border-slate-100 font-black text-[10px] text-slate-400 uppercase tracking-widest z-10 text-center">Categorías Activas</div>
              {activeGroupedCategories.map(f => (
                <div key={f.family.id}>
                  <div className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase bg-slate-100/50 sticky top-0 z-0">{f.family.name}</div>
                  {f.categories.map(c => (
                    <button key={c.id} onClick={() => { setRecCategoryId(c.id); setRecTransferAccountId(null); setRecType(f.family.type); setIsRecSelectorOpen(false); }} className={`w-full text-left px-4 py-3 active:bg-indigo-50 active:text-indigo-700 lg:hover:bg-indigo-50 lg:hover:text-indigo-700 text-[11px] font-bold text-slate-600 truncate border-b border-slate-50 transition-colors flex items-center gap-3 cursor-pointer touch-action-manipulation ${recCategoryId === c.id ? 'bg-indigo-50 text-indigo-700' : ''}`}>
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
                    <div className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase bg-slate-50 sticky top-0 z-0">{g.group.name}</div>
                    {availableAccs.map(a => (
                      <button key={a.id} onClick={() => { setRecTransferAccountId(a.id); setRecCategoryId(''); setRecType('TRANSFER'); setIsRecSelectorOpen(false); }} className={`w-full text-left px-4 py-3 active:bg-emerald-50 active:text-emerald-700 lg:hover:bg-emerald-50 lg:hover:text-emerald-700 text-[11px] font-bold text-slate-600 truncate border-b border-slate-50 transition-colors flex items-center gap-3 cursor-pointer touch-action-manipulation ${recTransferAccountId === a.id ? 'bg-emerald-50 text-emerald-700' : ''}`}>
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
    </>
  );
};