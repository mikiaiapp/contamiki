
import React, { useState, useRef } from 'react';
import { AppState, Account, Family, Category, Transaction, TransactionType, AccountGroup, ImportReport } from '../types';
import { Trash2, Edit2, Layers, Tag, Wallet, Loader2, Sparkles, XCircle, Download, DatabaseZap, ClipboardPaste, CheckCircle2, BoxSelect, FileJson } from 'lucide-react';
import { searchInternetLogos } from '../services/iconService';

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
  
  // States for icon search
  const [webLogos, setWebLogos] = useState<{url: string, source: string}[]>([]);
  const [isSearchingWeb, setIsSearchingWeb] = useState(false);

  // General Form States
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
    // Soporta dd/mm/aaaa, dd/mm/aa, y aaaa-mm-dd
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        let day = parts[0].padStart(2, '0');
        let month = parts[1].padStart(2, '0');
        let year = parts[2];
        if (year.length === 2) year = '20' + year; // Asumir siglo XXI
        return `${year}-${month}-${day}`;
    }
    return dateStr; // Asumir que ya es ISO
  };

  const handleManualMovementImport = () => {
      if (!pasteMovements.trim()) return;
      const lines = pasteMovements.trim().split('\n');
      const newTransactions: Transaction[] = [];
      const localAccs = [...data.accounts];
      const localCats = [...data.categories];
      const report: ImportReport = { added: 0, newAccounts: [], newCategories: [], errors: [] };

      lines.forEach((line, index) => {
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
              // Transfer Mode: fecha; origen; destino; concepto; importe
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

  const exportBackup = () => {
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `contamiki_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const renderIconInput = (icon: string, setIcon: (s: string) => void, currentName: string) => {
    const isImage = icon?.startsWith('http');
    return (
      <div className="space-y-3 w-full">
          <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center border-2 border-white rounded-2xl bg-white overflow-hidden shadow-sm">
                    {renderIcon(icon, "w-10 h-10")}
                </div>
                <div className="flex-1 space-y-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Avatar Visual</p>
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
        {['ACC_GROUPS', 'ACCOUNTS', 'FAMILIES', 'CATEGORIES', 'TOOLS'].map(t => (
            <button key={t} className={`flex-1 flex items-center justify-center gap-2 px-6 py-3.5 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${activeTab === t ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => setActiveTab(t)}>
              {t === 'ACC_GROUPS' ? <BoxSelect size={16}/> : t === 'ACCOUNTS' ? <Wallet size={16}/> : t === 'FAMILIES' ? <Layers size={16}/> : t === 'CATEGORIES' ? <Tag size={16}/> : <DatabaseZap size={16}/>} 
              <span className="hidden sm:inline">{t.replace('_', ' ')}</span>
            </button>
        ))}
      </div>

      <div className="max-w-4xl mx-auto">
        {activeTab === 'TOOLS' && (
            <div className="space-y-12 pb-10">
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3"><ClipboardPaste className="text-indigo-600" size={28}/> Mega Importador</h3>
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit">
                        <button onClick={() => setImportMode('NORMAL')} className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${importMode === 'NORMAL' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>General</button>
                        <button onClick={() => setImportMode('TRANSFER')} className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${importMode === 'TRANSFER' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>Traspasos</button>
                    </div>
                    <div className="space-y-4">
                        <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100 space-y-2">
                            <p className="text-indigo-900 text-[10px] font-black uppercase tracking-widest">Formato: <span className="font-mono text-[11px] ml-2">{importMode === 'NORMAL' ? "fecha; categoría; cuenta; concepto; importe" : "fecha; origen; destino; concepto; importe"}</span></p>
                            <p className="text-indigo-400 text-[9px] uppercase font-black italic">Autocreación habilitada. Formatos de fecha soportados: dd/mm/aa, dd/mm/aaaa, aaaa-mm-dd.</p>
                        </div>
                        <textarea className="w-full h-56 p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] font-mono text-[11px] text-slate-600 outline-none focus:border-indigo-500 transition-all custom-scrollbar placeholder:text-slate-300 shadow-inner" placeholder={importMode === 'NORMAL' ? "27/10/23; Alimentación; BBVA; Compra cena; -25.50" : "27/10/23; BBVA; Efectivo; Retirada; 50.00"} value={pasteMovements} onChange={e => setPasteMovements(e.target.value)} />
                        <div className="flex gap-3"><button onClick={handleManualMovementImport} className="flex-1 py-5 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-950 transition-all shadow-xl shadow-indigo-200">Procesar Lote</button><button onClick={resetForm} className="px-8 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black text-[11px] uppercase">Limpiar</button></div>
                    </div>
                    {importReport && (
                        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white space-y-6 animate-in zoom-in-95">
                            <div className="flex items-center justify-between border-b border-white/10 pb-4"><h4 className="text-lg font-black uppercase tracking-tight flex items-center gap-3"><CheckCircle2 className="text-emerald-400" /> Resultados</h4><button onClick={() => setImportReport(null)}><XCircle size={20} className="text-slate-500" /></button></div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="p-4 bg-white/5 rounded-2xl text-center"><span className="text-[9px] font-black text-slate-400 uppercase">Añadidos</span><p className="text-2xl font-black text-emerald-400">{importReport.added}</p></div>
                                <div className="p-4 bg-white/5 rounded-2xl text-center"><span className="text-[9px] font-black text-slate-400 uppercase">Nuevas Cuentas</span><p className="text-2xl font-black text-indigo-400">{importReport.newAccounts.length}</p></div>
                                <div className="p-4 bg-white/5 rounded-2xl text-center"><span className="text-[9px] font-black text-slate-400 uppercase">Nuevas Cats</span><p className="text-2xl font-black text-amber-400">{importReport.newCategories.length}</p></div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-slate-900 p-10 rounded-[3rem] shadow-2xl border border-white/5 space-y-8 text-center relative overflow-hidden">
                    <div className="relative z-10 space-y-6">
                        <div className="mx-auto bg-indigo-600 text-white w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl rotate-3"><DatabaseZap size={36} /></div>
                        <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Copia de Seguridad</h3>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button onClick={exportBackup} className="flex-1 flex items-center justify-center gap-3 p-5 bg-white text-slate-900 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-xl active:scale-95"><FileJson size={20} /> Exportar JSON</button>
                        </div>
                    </div>
                </div>
            </div>
        )}
        
        {activeTab === 'ACCOUNTS' && (
            <div className="grid grid-cols-1 gap-10">
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
                    <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-4"><div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-2xl"><Wallet size={24}/></div>{accId ? 'Editar Cuenta' : 'Nueva Cuenta'}</h3>
                    <div className="space-y-6">
                        <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre</label><input type="text" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all text-slate-900" value={accName} onChange={e => setAccName(e.target.value)} /></div>
                        {renderIconInput(accIcon, setAccIcon, accName)}
                        <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Saldo Inicial (€)</label><input type="number" step="0.01" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all text-slate-900" value={accBalance} onChange={e => setAccBalance(e.target.value)} /></div>
                        <button onClick={() => { if(!accName) return; const balanceVal = parseFloat(accBalance) || 0; if (accId) onUpdateData({ accounts: data.accounts.map(a => a.id === accId ? { ...a, name: accName, initialBalance: balanceVal, icon: accIcon } : a) }); else onUpdateData({ accounts: [...data.accounts, { id: generateId(), name: accName, initialBalance: balanceVal, currency: 'EUR', icon: accIcon, groupId: 'g1' }] }); resetForm(); }} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-2xl hover:bg-indigo-600 transition-all">{accId ? 'Guardar Cambios' : 'Crear Cuenta'}</button>
                    </div>
                </div>
                <div className="space-y-3">
                    {data.accounts.map(acc => (
                        <div key={acc.id} className="flex justify-between items-center p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-4"><div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 shadow-sm shrink-0">{renderIcon(acc.icon || '🏦', "w-9 h-9")}</div><div><span className="font-black text-slate-900 block text-xs uppercase">{acc.name}</span><span className="text-[10px] font-bold text-indigo-500">{acc.initialBalance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span></div></div>
                            <div className="flex gap-1"><button onClick={() => { setAccId(acc.id); setAccName(acc.name); setAccBalance(acc.initialBalance.toString()); setAccIcon(acc.icon || '🏦'); }} className="p-3 text-slate-300 hover:text-indigo-600"><Edit2 size={18}/></button></div>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
