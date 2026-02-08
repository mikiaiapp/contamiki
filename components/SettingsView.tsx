
import React, { useState, useRef } from 'react';
import { AppState, Account, Family, Category, Transaction, TransactionType, AccountGroup, ImportReport } from '../types';
import { Trash2, Edit2, Layers, Tag, Wallet, Loader2, Sparkles, XCircle, Download, DatabaseZap, ClipboardPaste, CheckCircle2, BoxSelect, FileJson, Info, AlertTriangle, Eraser, FileSpreadsheet, Upload } from 'lucide-react';
import { searchInternetLogos } from '../services/iconService';
import * as XLSX from 'xlsx';

interface SettingsViewProps {
  data: AppState;
  onUpdateData: (newData: Partial<AppState>) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

export const SettingsView: React.FC<SettingsViewProps> = ({ data, onUpdateData }) => {
  const [activeTab, setActiveTab] = useState('ACC_GROUPS');
  const [importMode, setImportMode] = useState<'NORMAL' | 'TRANSFER'>('NORMAL');
  const [pasteMovements, setPasteMovements] = useState('');
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [massDeleteYear, setMassDeleteYear] = useState('');
  
  const [webLogos, setWebLogos] = useState<{url: string, source: string}[]>([]);
  const [isSearchingWeb, setIsSearchingWeb] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form States
  const [grpId, setGrpId] = useState<string | null>(null);
  const [grpName, setGrpName] = useState('');
  const [grpIcon, setGrpIcon] = useState('🗂️');

  const [accId, setAccId] = useState<string | null>(null);
  const [accName, setAccName] = useState('');
  const [accBalance, setAccBalance] = useState('');
  const [accIcon, setAccIcon] = useState('🏦');
  const [accGroupId, setAccGroupId] = useState('');

  const [famId, setFamId] = useState<string | null>(null);
  const [famName, setFamName] = useState('');
  const [famType, setFamType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [famIcon, setFamIcon] = useState('📂');

  const [catId, setCatId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');
  const [catParent, setCatParent] = useState('');
  const [catIcon, setCatIcon] = useState('🏷️');

  const renderIcon = (iconStr: string, className = "w-10 h-10") => {
    if (iconStr?.startsWith('http')) return <img src={iconStr} className={`${className} object-contain`} referrerPolicy="no-referrer" />;
    return <span className="text-xl">{iconStr || '📂'}</span>;
  }

  const resetForm = () => {
    setGrpId(null); setGrpName(''); setGrpIcon('🗂️');
    setAccId(null); setAccName(''); setAccBalance(''); setAccIcon('🏦'); setAccGroupId('');
    setFamId(null); setFamName(''); setFamIcon('📂'); setFamType('EXPENSE');
    setCatId(null); setCatName(''); setCatIcon('🏷️'); setCatParent('');
    setImportReport(null); setPasteMovements('');
  };

  const parseDate = (dateStr: string) => {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    const s = dateStr.trim();
    if (s.includes('/')) {
        const parts = s.split('/');
        let day = parts[0].padStart(2, '0');
        let month = parts[1].padStart(2, '0');
        let year = parts[2];
        if (year.length === 2) year = '20' + year;
        return `${year}-${month}-${day}`;
    }
    return s;
  };

  const processImportLines = (lines: string[]) => {
      const newTransactions: Transaction[] = [];
      const localAccs = [...data.accounts];
      const localCats = [...data.categories];
      const report: ImportReport = { added: 0, newAccounts: [], newCategories: [], errors: [] };

      lines.forEach((line, index) => {
          if (!line.trim()) return;
          const parts = line.split(';').map(s => s.trim());
          if (parts.length < 5) { report.errors.push({ fila: index + 1, error: "Formato incompleto" }); return; }
          const [fecRaw, cName, aName, concept, amStr] = parts;

          const fec = parseDate(fecRaw);
          const amountVal = parseFloat(amStr.replace(',', '.'));
          if (isNaN(amountVal)) { report.errors.push({ fila: index + 1, error: "Importe no numérico" }); return; }

          if (importMode === 'NORMAL') {
              let acc = localAccs.find(a => a.name.toLowerCase() === aName.toLowerCase());
              if (!acc) {
                  acc = { id: generateId(), name: aName, initialBalance: 0, currency: 'EUR', icon: '🏦', groupId: data.accountGroups[0]?.id || 'g1' };
                  localAccs.push(acc); report.newAccounts.push(aName);
              }
              let cat = localCats.find(c => c.name.toLowerCase() === cName.toLowerCase());
              if (!cat) {
                  cat = { id: generateId(), name: cName, familyId: data.families[0]?.id || 'f1', icon: '🏷️' };
                  localCats.push(cat); report.newCategories.push(cName);
              }
              newTransactions.push({ id: generateId(), date: fec, description: concept, amount: Math.abs(amountVal), type: amountVal < 0 ? 'EXPENSE' : 'INCOME', accountId: acc.id, categoryId: cat.id, familyId: cat.familyId });
          } else {
              let src = localAccs.find(a => a.name.toLowerCase() === parts[1].toLowerCase());
              if (!src) { src = { id: generateId(), name: parts[1], initialBalance: 0, currency: 'EUR', icon: '🏦', groupId: 'g1' }; localAccs.push(src); report.newAccounts.push(parts[1]); }
              let dst = localAccs.find(a => a.name.toLowerCase() === parts[2].toLowerCase());
              if (!dst) { dst = { id: generateId(), name: parts[2], initialBalance: 0, currency: 'EUR', icon: '🏦', groupId: 'g1' }; localAccs.push(dst); report.newAccounts.push(parts[2]); }
              newTransactions.push({ id: generateId(), date: fec, description: parts[3], amount: Math.abs(amountVal), type: 'TRANSFER', accountId: src.id, transferAccountId: dst.id, familyId: '', categoryId: '' });
          }
      });

      report.added = newTransactions.length;
      onUpdateData({ transactions: [...data.transactions, ...newTransactions], accounts: localAccs, categories: localCats });
      setImportReport(report);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const dataJson = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
          const lines = dataJson.map(row => row.join(';'));
          processImportLines(lines);
      };
      reader.readAsBinaryString(file);
  };

  const handleMassDelete = (mode: 'YEAR' | 'ALL') => {
    const msg = mode === 'ALL' 
        ? "¿Estás seguro de que quieres borrar ABSOLUTAMENTE TODOS los movimientos? Esta acción es irreversible."
        : `¿Estás seguro de que quieres borrar TODOS los movimientos del año ${massDeleteYear}?`;
    
    if (window.confirm(msg)) {
      if (mode === 'ALL') {
        onUpdateData({ transactions: [] });
        alert("Se han borrado todos los movimientos.");
      } else if (massDeleteYear) {
        const filtered = data.transactions.filter(t => !t.date.startsWith(massDeleteYear));
        onUpdateData({ transactions: filtered });
        alert(`Se han borrado los movimientos de ${massDeleteYear}.`);
      }
      setMassDeleteYear('');
    }
  };

  const exportBackup = () => {
    const backupData = JSON.stringify(data, null, 2);
    const blob = new Blob([backupData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `contamiki_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const renderIconInput = (icon: string, setIcon: (s: string) => void, currentName: string) => {
    return (
      <div className="space-y-3 w-full">
          <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center border-2 border-white rounded-2xl bg-white overflow-hidden shadow-sm">
                    {renderIcon(icon, "w-10 h-10")}
                </div>
                <div className="flex-1 space-y-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Avatar Visual</p>
                    <button onClick={async () => {
                         setIsSearchingWeb(true);
                         const results = await searchInternetLogos(currentName);
                         setWebLogos(results);
                         setIsSearchingWeb(false);
                    }} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center gap-2">
                        {isSearchingWeb ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>} Buscar Logo IA
                    </button>
                </div>
          </div>
          {webLogos.length > 0 && (
            <div className="bg-white p-5 rounded-[2.5rem] border border-indigo-100 shadow-xl space-y-4 animate-in slide-in-from-top-4">
                <div className="flex justify-between items-center"><span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Sugerencias IA</span><button onClick={() => setWebLogos([])} className="text-slate-300 hover:text-rose-500"><XCircle size={18}/></button></div>
                <div className="grid grid-cols-5 gap-3 max-h-40 overflow-y-auto p-1 custom-scrollbar">
                    {webLogos.map((l, i) => (
                        <button key={i} onClick={() => { setIcon(l.url); setWebLogos([]); }} className="aspect-square bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-500 p-2 transition-all flex items-center justify-center overflow-hidden"><img src={l.url} className="w-full h-full object-contain" referrerPolicy="no-referrer" /></button>
                    ))}
                </div>
            </div>
          )}
      </div>
    );
  };

  return (
    <div className="space-y-12 max-w-full overflow-hidden pb-20">
      <div className="text-center md:text-left space-y-2">
        <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter">Ajustes.</h2>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em]">Configuración y Herramientas</p>
      </div>

      <div className="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner border border-slate-200/50 overflow-x-auto scrollbar-hide">
        {[
            {id: 'ACC_GROUPS', label: 'Grupos', icon: <BoxSelect size={16}/>},
            {id: 'ACCOUNTS', label: 'Cuentas', icon: <Wallet size={16}/>},
            {id: 'FAMILIES', label: 'Familias', icon: <Layers size={16}/>},
            {id: 'CATEGORIES', label: 'Categorías', icon: <Tag size={16}/>},
            {id: 'TOOLS', label: 'Herramientas', icon: <DatabaseZap size={16}/>}
        ].map(t => (
            <button key={t.id} className={`flex-1 flex items-center justify-center gap-2 px-6 py-3.5 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => { setActiveTab(t.id); resetForm(); }}>
              {t.icon} <span className="hidden sm:inline">{t.label}</span>
            </button>
        ))}
      </div>

      <div className="max-w-4xl mx-auto">
        {activeTab === 'ACC_GROUPS' && (
            <div className="grid grid-cols-1 gap-10">
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
                    <h3 className="text-xl font-black text-slate-800 uppercase flex items-center gap-3"><BoxSelect className="text-indigo-600"/> {grpId ? 'Editar Grupo' : 'Nuevo Grupo'}</h3>
                    <div className="space-y-4">
                        <input type="text" placeholder="Nombre del grupo" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={grpName} onChange={e => setGrpName(e.target.value)} />
                        <div className="flex items-center gap-4">
                            <input type="text" placeholder="Icono" className="w-24 px-4 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-center" value={grpIcon} onChange={e => setGrpIcon(e.target.value)} />
                            <button onClick={() => { if(!grpName) return; if(grpId) onUpdateData({accountGroups: data.accountGroups.map(g=>g.id===grpId?{...g,name:grpName,icon:grpIcon}:g)}); else onUpdateData({accountGroups: [...data.accountGroups, {id:generateId(),name:grpName,icon:grpIcon}]}); resetForm(); }} className="flex-1 py-5 bg-slate-950 text-white rounded-2xl font-black uppercase text-[10px] hover:bg-indigo-600 transition-all">Guardar Grupo</button>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {data.accountGroups.map(g => (
                        <div key={g.id} className="p-6 bg-white rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm hover:border-indigo-200 transition-all">
                            <div className="flex items-center gap-4"><span className="text-2xl">{g.icon}</span><span className="font-black text-slate-900 uppercase text-xs">{g.name}</span></div>
                            <div className="flex gap-2"><button onClick={() => { setGrpId(g.id); setGrpName(g.name); setGrpIcon(g.icon); }} className="p-2 text-indigo-400 hover:bg-indigo-50 rounded-lg"><Edit2 size={16}/></button><button onClick={() => onUpdateData({accountGroups: data.accountGroups.filter(x=>x.id!==g.id)})} className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg"><Trash2 size={16}/></button></div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'ACCOUNTS' && (
            <div className="grid grid-cols-1 gap-10">
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
                    <h3 className="text-xl font-black text-slate-800 uppercase flex items-center gap-3"><Wallet className="text-indigo-600"/> {accId ? 'Editar Cuenta' : 'Nueva Cuenta'}</h3>
                    <div className="space-y-6">
                        <input type="text" placeholder="Nombre de la cuenta" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={accName} onChange={e => setAccName(e.target.value)} />
                        <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={accGroupId} onChange={e => setAccGroupId(e.target.value)}><option value="">Vincular a un Grupo...</option>{data.accountGroups.map(g => <option key={g.id} value={g.id}>{g.icon} {g.name}</option>)}</select>
                        {renderIconInput(accIcon, setAccIcon, accName)}
                        <input type="number" placeholder="Saldo Inicial €" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={accBalance} onChange={e => setAccBalance(e.target.value)} />
                        <button onClick={() => { if(!accName) return; const balanceVal = parseFloat(accBalance) || 0; if (accId) onUpdateData({ accounts: data.accounts.map(a => a.id === accId ? { ...a, name: accName, initialBalance: balanceVal, icon: accIcon, groupId: accGroupId } : a) }); else onUpdateData({ accounts: [...data.accounts, { id: generateId(), name: accName, initialBalance: balanceVal, currency: 'EUR', icon: accIcon, groupId: accGroupId || (data.accountGroups[0]?.id || 'g1') }] }); resetForm(); }} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] hover:bg-indigo-600 transition-all shadow-xl">Confirmar Cuenta</button>
                    </div>
                </div>
                <div className="space-y-3">
                    {data.accounts.map(acc => {
                        const grp = data.accountGroups.find(g => g.id === acc.groupId);
                        return (
                            <div key={acc.id} className="flex justify-between items-center p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100">{renderIcon(acc.icon, "w-8 h-8")}</div>
                                    <div>
                                        <span className="font-black text-slate-900 block text-xs uppercase">{acc.name}</span>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{grp?.name || 'Sin grupo'}</span>
                                        <span className="text-[10px] font-black text-indigo-500 block">{acc.initialBalance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2"><button onClick={() => { setAccId(acc.id); setAccName(acc.name); setAccBalance(acc.initialBalance.toString()); setAccIcon(acc.icon); setAccGroupId(acc.groupId); }} className="p-3 text-indigo-400 hover:bg-indigo-50 rounded-xl"><Edit2 size={18}/></button><button onClick={() => onUpdateData({accounts: data.accounts.filter(a=>a.id!==acc.id)})} className="p-3 text-rose-400 hover:bg-rose-50 rounded-xl"><Trash2 size={18}/></button></div>
                            </div>
                        );
                    })}
                </div>
            </div>
        )}

        {activeTab === 'FAMILIES' && (
            <div className="grid grid-cols-1 gap-10">
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
                    <h3 className="text-xl font-black text-slate-800 uppercase flex items-center gap-3"><Layers className="text-indigo-600"/> {famId ? 'Editar Familia' : 'Nueva Familia'}</h3>
                    <div className="space-y-4">
                        <input type="text" placeholder="Nombre" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={famName} onChange={e => setFamName(e.target.value)} />
                        <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1.5">
                            <button onClick={() => setFamType('EXPENSE')} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${famType === 'EXPENSE' ? 'bg-white text-rose-500 shadow-sm' : 'text-slate-400'}`}>Gasto</button>
                            <button onClick={() => setFamType('INCOME')} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${famType === 'INCOME' ? 'bg-white text-emerald-500 shadow-sm' : 'text-slate-400'}`}>Ingreso</button>
                        </div>
                        {renderIconInput(famIcon, setFamIcon, famName)}
                        <button onClick={() => { if(!famName) return; if(famId) onUpdateData({families: data.families.map(f=>f.id===famId?{...f,name:famName,type:famType,icon:famIcon}:f)}); else onUpdateData({families: [...data.families, {id:generateId(),name:famName,type:famType,icon:famIcon}]}); resetForm(); }} className="w-full py-5 bg-slate-950 text-white rounded-2xl font-black uppercase text-[10px] hover:bg-indigo-600 transition-all">Guardar Familia</button>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {data.families.map(f => (
                        <div key={f.id} className="p-6 bg-white rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-4">{renderIcon(f.icon, "w-8 h-8")}<div><span className="font-black text-slate-900 uppercase text-xs block">{f.name}</span><span className={`text-[8px] font-black uppercase tracking-widest ${f.type === 'EXPENSE' ? 'text-rose-400' : 'text-emerald-400'}`}>{f.type === 'EXPENSE' ? 'Gasto' : 'Ingreso'}</span></div></div>
                            <div className="flex gap-2"><button onClick={() => { setFamId(f.id); setFamName(f.name); setFamType(f.type); setFamIcon(f.icon); }} className="p-2 text-indigo-400 hover:bg-indigo-50 rounded-lg"><Edit2 size={16}/></button><button onClick={() => onUpdateData({families: data.families.filter(x=>x.id!==f.id)})} className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg"><Trash2 size={16}/></button></div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'CATEGORIES' && (
            <div className="grid grid-cols-1 gap-10">
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
                    <h3 className="text-xl font-black text-slate-800 uppercase flex items-center gap-3"><Tag className="text-indigo-600"/> {catId ? 'Editar Categoría' : 'Nueva Categoría'}</h3>
                    <div className="space-y-4">
                        <input type="text" placeholder="Nombre" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" value={catName} onChange={e => setCatName(e.target.value)} />
                        <select className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" value={catParent} onChange={e => setCatParent(e.target.value)}><option value="">Vincular a una Familia...</option>{data.families.map(f => <option key={f.id} value={f.id}>{f.icon} {f.name} ({f.type === 'EXPENSE' ? 'Gasto' : 'Ingreso'})</option>)}</select>
                        {renderIconInput(catIcon, setCatIcon, catName)}
                        <button onClick={() => { if(!catName || !catParent) return; if(catId) onUpdateData({categories: data.categories.map(c=>c.id===catId?{...c,name:catName,familyId:catParent,icon:catIcon}:c)}); else onUpdateData({categories: [...data.categories, {id:generateId(),name:catName,familyId:catParent,icon:catIcon}]}); resetForm(); }} className="w-full py-5 bg-slate-950 text-white rounded-2xl font-black uppercase text-[10px] hover:bg-indigo-600 transition-all">Guardar Categoría</button>
                    </div>
                </div>
                <div className="space-y-3">
                    {data.categories.map(c => {
                        const fam = data.families.find(f => f.id === c.familyId);
                        return (
                            <div key={c.id} className="p-6 bg-white rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm">
                                <div className="flex items-center gap-4">{renderIcon(c.icon, "w-8 h-8")}<div><span className="font-black text-slate-900 uppercase text-xs block">{c.name}</span><span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Familia: {fam?.name || '---'}</span></div></div>
                                <div className="flex gap-2"><button onClick={() => { setCatId(c.id); setCatName(c.name); setCatParent(c.familyId); setCatIcon(c.icon); }} className="p-2 text-indigo-400 hover:bg-indigo-50 rounded-lg"><Edit2 size={16}/></button><button onClick={() => onUpdateData({categories: data.categories.filter(x=>x.id!==c.id)})} className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg"><Trash2 size={16}/></button></div>
                            </div>
                        );
                    })}
                </div>
            </div>
        )}

        {activeTab === 'TOOLS' && (
            <div className="space-y-12">
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3"><ClipboardPaste className="text-indigo-600" size={28}/> Mega Importador Maestro</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Opción 1: Archivo CSV / Excel</label>
                            <div onClick={() => fileInputRef.current?.click()} className="group border-2 border-dashed border-slate-200 rounded-[2rem] p-10 text-center hover:border-indigo-500 hover:bg-indigo-50/30 transition-all cursor-pointer">
                                <FileSpreadsheet className="mx-auto text-slate-300 group-hover:text-indigo-500 mb-4" size={48} />
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Arrastra o haz clic para subir</p>
                                <input type="file" ref={fileInputRef} className="hidden" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Opción 2: Copiar y Pegar Texto</label>
                            <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit mb-2">
                                <button onClick={() => setImportMode('NORMAL')} className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${importMode === 'NORMAL' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>Gasto/Ingreso</button>
                                <button onClick={() => setImportMode('TRANSFER')} className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${importMode === 'TRANSFER' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>Traspaso</button>
                            </div>
                            <textarea className="w-full h-32 p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] font-mono text-[11px] outline-none shadow-inner placeholder:text-slate-300" placeholder={importMode === 'NORMAL' ? "27/10/23; Alimentación; BBVA; Compra cena; -25.50" : "27/10/23; BBVA; Efectivo; Retirada; 50.00"} value={pasteMovements} onChange={e => setPasteMovements(e.target.value)} />
                            <button onClick={() => processImportLines(pasteMovements.split('\n'))} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-indigo-200 hover:bg-slate-900 transition-all">Procesar Texto</button>
                        </div>
                    </div>

                    {importReport && (
                        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white space-y-4 animate-in zoom-in-95">
                            <h4 className="text-sm font-black uppercase flex items-center gap-2 text-indigo-400"><CheckCircle2 size={20} /> Importación Exitosa</h4>
                            <div className="grid grid-cols-3 gap-6">
                                <div className="bg-white/5 p-4 rounded-2xl"><p className="text-[9px] uppercase text-slate-400 mb-1">Movimientos</p><p className="text-2xl font-black text-emerald-400">{importReport.added}</p></div>
                                <div className="bg-white/5 p-4 rounded-2xl"><p className="text-[9px] uppercase text-slate-400 mb-1">Nuevas Cuentas</p><p className="text-2xl font-black text-indigo-400">{importReport.newAccounts.length}</p></div>
                                <div className="bg-white/5 p-4 rounded-2xl"><p className="text-[9px] uppercase text-slate-400 mb-1">Nuevas Cats</p><p className="text-2xl font-black text-amber-400">{importReport.newCategories.length}</p></div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-rose-50 p-10 rounded-[3rem] border border-rose-100 space-y-6">
                    <h3 className="text-2xl font-black text-rose-800 uppercase tracking-tighter flex items-center gap-3"><Eraser className="text-rose-600" size={28}/> Limpieza Profunda</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-white p-6 rounded-3xl border border-rose-200 space-y-4">
                            <p className="text-rose-900 text-[10px] font-black uppercase tracking-widest">Borrar por Año</p>
                            <div className="flex gap-4">
                                <input type="number" placeholder="Ej: 2023" className="flex-1 px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-rose-500" value={massDeleteYear} onChange={e => setMassDeleteYear(e.target.value)} />
                                <button onClick={() => handleMassDelete('YEAR')} className="px-6 py-4 bg-rose-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all">Limpiar Año</button>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-3xl border border-rose-200 flex flex-col justify-center space-y-4">
                            <p className="text-rose-900 text-[10px] font-black uppercase tracking-widest">Reinicio de Fábrica</p>
                            <button onClick={() => handleMassDelete('ALL')} className="w-full py-4 bg-rose-950 text-white rounded-xl font-black text-[10px] uppercase shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3"><AlertTriangle size={16}/> Borrar todo el Historial</button>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 p-10 rounded-[3rem] text-center space-y-6 shadow-2xl overflow-hidden relative group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>
                    <div className="mx-auto bg-indigo-600 text-white w-16 h-16 rounded-3xl flex items-center justify-center shadow-2xl rotate-3 group-hover:rotate-12 transition-transform duration-500"><DatabaseZap size={32} /></div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Soberanía de Datos</h3>
                    <button onClick={exportBackup} className="flex items-center justify-center gap-3 w-full p-5 bg-white text-slate-900 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-xl active:scale-95"><FileJson size={20} /> Exportar Backup JSON</button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
