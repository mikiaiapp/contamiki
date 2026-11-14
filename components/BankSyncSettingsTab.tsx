import React, { useState, useEffect, useRef } from 'react';
import { AppState, BookMetadata } from '../types';
import { getToken } from '../services/authService';
import { 
  Building2, RefreshCw, CheckCircle2, AlertCircle, Clock, 
  FolderArchive, ArrowUpRight, Check, Trash2, ShieldCheck, 
  Mail, Bot, Key, Upload, Download, FileText, Smartphone, 
  HelpCircle, Sparkles, X, Info, ExternalLink, Copy, ChevronDown, ChevronUp, BookOpen
} from 'lucide-react';

interface BankSyncSettingsTabProps {
  data: AppState;
  currentBookId: string;
  books: BookMetadata[];
}

export const BankSyncSettingsTab: React.FC<BankSyncSettingsTabProps> = ({
  data,
  currentBookId,
  books
}) => {
  const [status, setStatus] = useState<any>(null);
  const [aspsps, setAspsps] = useState<any[]>([]);
  const [notifSettings, setNotifSettings] = useState<any>({
    email: { enabled: true, address: '' },
    telegram: { enabled: false, botToken: '', chatId: '' },
    syncHour: 6
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [telegramTestStatus, setTelegramTestStatus] = useState<string>('');
  
  // Modals
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [isCredsModalOpen, setIsCredsModalOpen] = useState(false);
  const [isShortcutModalOpen, setIsShortcutModalOpen] = useState(false);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [selectedSyncAccountUids, setSelectedSyncAccountUids] = useState<string[]>([]);
  const [syncingSingleUid, setSyncingSingleUid] = useState<string | null>(null);

  // Credentials form state
  const [appIdInput, setAppIdInput] = useState('a4b70785-ab0e-4c8f-b5da-4688b87f7dcf');
  const [pemTextInput, setPemTextInput] = useState('');
  const [isSavingCreds, setIsSavingCreds] = useState(false);
  const [credsMessage, setCredsMessage] = useState('');
  const [showStepGuide, setShowStepGuide] = useState(true);
  const [copiedRedirect, setCopiedRedirect] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Notifications form state
  const [isSavingNotifs, setIsSavingNotifs] = useState(false);
  const [saveNotifsMessage, setSaveNotifsMessage] = useState('');

  // Ticket upload state
  const [isUploadingTicket, setIsUploadingTicket] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const token = (getToken() || localStorage.getItem('auth_token'));
      const authHeaders = { 'Authorization': `Bearer ${token}` };

      const [statusRes, notifRes, aspspRes] = await Promise.all([
        fetch('/api/bank/status', { headers: authHeaders }),
        fetch('/api/notifications/settings', { headers: authHeaders }),
        fetch('/api/bank/aspsps', { headers: authHeaders }).catch(() => null)
      ]);

      if (statusRes.ok) {
        const s = await statusRes.json();
        setStatus(s);
        if (s.appId) setAppIdInput(s.appId);
      }
      if (notifRes.ok) {
        setNotifSettings(await notifRes.json());
      }
      if (aspspRes && aspspRes.ok) {
        setAspsps(await aspspRes.json());
      }
    } catch (err) {
      console.error('Error loading bank sync settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const mappedAccountsList = React.useMemo(() => {
    const list: Array<{
      uid: string;
      connId: string;
      name: string;
      iban: string;
      bankName: string;
      bookName: string;
      accountName: string;
      lastSync?: string;
      lastBankBalance?: number;
      lastContaBalance?: number;
      lastBalanceDiff?: number;
      lastIsCuadrado?: boolean;
      lastHoldsAmount?: number;
      lastBalanceCheck?: string;
    }> = [];
    if (!status?.connections) return list;
    for (const conn of status.connections) {
      const bankName = conn.aspsp?.name || 'Entidad Bancaria';
      for (const acc of (conn.accounts || [])) {
        if (acc.mappedAccountId && acc.enabled !== false) {
          const book = books.find(b => b.id === acc.mappedBookId);
          const acct = data.accounts.find(a => a.id === acc.mappedAccountId);
          list.push({
            uid: acc.uid,
            connId: conn.id,
            name: acc.name || 'Cuenta Corriente',
            iban: acc.iban || '',
            bankName,
            bookName: book ? book.name : (acc.mappedBookId || 'Contabilidad'),
            accountName: acct ? acct.name : (acc.mappedAccountId || 'Cuenta asociada'),
            lastSync: acc.lastSync,
            lastBankBalance: acc.lastBankBalance,
            lastContaBalance: acc.lastContaBalance,
            lastBalanceDiff: acc.lastBalanceDiff,
            lastIsCuadrado: acc.lastIsCuadrado,
            lastHoldsAmount: acc.lastHoldsAmount,
            lastBalanceCheck: acc.lastBalanceCheck
          });
        }
      }
    }
    return list;
  }, [status, books, data.accounts]);

  const handleOpenSyncModal = () => {
    if (mappedAccountsList.length === 0) {
      setSyncResult({ error: 'No hay cuentas bancarias vinculadas y mapeadas a una contabilidad todavía.' });
      return;
    }
    setSelectedSyncAccountUids(mappedAccountsList.map(a => a.uid));
    setIsSyncModalOpen(true);
  };

  const toggleSelectAccount = (uid: string) => {
    setSelectedSyncAccountUids(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const selectAllAccounts = () => {
    setSelectedSyncAccountUids(mappedAccountsList.map(a => a.uid));
  };

  const deselectAllAccounts = () => {
    setSelectedSyncAccountUids([]);
  };

  const handleManualSync = async (uidsToSync?: string[]) => {
    const targetUids = uidsToSync || (selectedSyncAccountUids.length > 0 ? selectedSyncAccountUids : undefined);
    
    if (uidsToSync && uidsToSync.length === 1) {
      setSyncingSingleUid(uidsToSync[0]);
    }

    setIsSyncing(true);
    setSyncResult(null);
    try {
      const token = (getToken() || localStorage.getItem('auth_token'));
      const res = await fetch('/api/bank/sync', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          accountUids: targetUids
        })
      });
      const result = await res.json();
      setSyncResult(result);
      await loadData();
      setIsSyncModalOpen(false);
    } catch (err: any) {
      setSyncResult({ error: err.message || 'Error en la sincronización' });
    } finally {
      setIsSyncing(false);
      setSyncingSingleUid(null);
    }
  };

  const handleConnectBank = async (aspspName: string) => {
    try {
      const token = (getToken() || localStorage.getItem('auth_token'));
      const res = await fetch('/api/bank/auth-url', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ aspspName })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'No se pudo obtener la URL del banco');
      }
    } catch (err: any) {
      alert(err.message || 'Error conectando con el banco');
    }
  };

  const handleMapAccount = async (connectionId: string, accountUid: string, bookId: string, accountId: string, enabled = true) => {
    try {
      const token = (getToken() || localStorage.getItem('auth_token'));
      await fetch('/api/bank/map-account', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ connectionId, accountUid, bookId, accountId, enabled })
      });
      await loadData();
    } catch (err) {
      console.error('Error mapping account:', err);
    }
  };

  const handleDeleteConnection = async (connectionId: string) => {
    if (!confirm('¿Deseas desvincular esta conexión bancaria?')) return;
    try {
      const token = (getToken() || localStorage.getItem('auth_token'));
      await fetch(`/api/bank/connection/${connectionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      await loadData();
    } catch (err) {
      console.error('Error deleting connection:', err);
    }
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingCreds(true);
    setCredsMessage('');
    try {
      const token = (getToken() || localStorage.getItem('auth_token'));
      const res = await fetch('/api/bank/credentials', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          appId: appIdInput,
          pemContent: pemTextInput || undefined
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCredsMessage('✅ Credenciales guardadas y verificadas con Enable Banking');
        setPemTextInput('');
        await loadData();
        setTimeout(() => {
          setIsCredsModalOpen(false);
          setCredsMessage('');
        }, 1500);
      } else {
        if (res.status === 401 || res.status === 403 || data.error?.toLowerCase().includes('token')) {
          setCredsMessage('❌ Tu sesión en ContaMiki ha caducado. Recarga la página (F5) o vuelve a iniciar sesión para renovarla.');
        } else {
          setCredsMessage(`❌ Error: ${data.error || 'No se pudo validar con Enable Banking'}`);
        }
      }
    } catch (err: any) {
      setCredsMessage(`❌ Error: ${err.message}`);
    } finally {
      setIsSavingCreds(false);
    }
  };

  const handlePemFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setPemTextInput(event.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handleTicketUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingTicket(true);
    setUploadMessage('');
    try {
      const token = (getToken() || localStorage.getItem('auth_token'));
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = event.target?.result as string;
        const res = await fetch('/api/tickets/inbox/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            filename: file.name,
            base64Data
          })
        });
        const d = await res.json();
        if (res.ok && d.success) {
          setUploadMessage(`✅ ${file.name} subido al buzón`);
          await loadData();
          setTimeout(() => setUploadMessage(''), 4000);
        } else {
          setUploadMessage(`❌ Error: ${d.error}`);
        }
        setIsUploadingTicket(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setUploadMessage(`❌ Error: ${err.message}`);
      setIsUploadingTicket(false);
    }
  };

  const handleSaveNotifications = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingNotifs(true);
    setSaveNotifsMessage('');
    try {
      const token = (getToken() || localStorage.getItem('auth_token'));
      const res = await fetch('/api/notifications/settings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(notifSettings)
      });
      if (res.ok) {
        setSaveNotifsMessage('✅ Configuración guardada correctamente');
        setTimeout(() => setSaveNotifsMessage(''), 4000);
      }
    } catch (err) {
      setSaveNotifsMessage('❌ Error al guardar configuración');
    } finally {
      setIsSavingNotifs(false);
    }
  };

  const handleTestTelegram = async () => {
    setTelegramTestStatus('Enviando...');
    try {
      const token = (getToken() || localStorage.getItem('auth_token'));
      const res = await fetch('/api/notifications/test-telegram', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          botToken: notifSettings.telegram?.botToken,
          chatId: notifSettings.telegram?.chatId
        })
      });
      const data = await res.json();
      if (data.success) {
        setTelegramTestStatus('✅ Mensaje de prueba enviado con éxito a Telegram');
      } else {
        setTelegramTestStatus(`❌ Error: ${data.error}`);
      }
    } catch (err: any) {
      setTelegramTestStatus(`❌ Error: ${err.message}`);
    }
  };

  const filteredAspsps = aspsps.filter(b => 
    b.name.toLowerCase().includes(bankSearch.toLowerCase())
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-300">
      {/* Header Info Banner */}
      <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-2xl border border-indigo-800/40">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-500/30 flex items-center gap-1.5">
                <ShieldCheck size={12}/> Open Banking PSD2 Activo
              </span>
              <span className="px-3 py-1 bg-white/10 text-white/80 text-[10px] font-black uppercase tracking-widest rounded-full">
                Enable Banking
              </span>
            </div>
            <h3 className="text-2xl md:text-3xl font-black tracking-tight">Sincronización Bancaria & Buzón</h3>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Descarga automática de movimientos cada mañana a las {String(notifSettings.syncHour ?? 6).padStart(2, '0')}:00 y emparejamiento inteligente de facturas y tickets desde tu buzón.
            </p>
          </div>

          <button
            onClick={handleOpenSyncModal}
            disabled={isSyncing}
            className="w-full md:w-auto px-6 py-4 bg-white text-indigo-950 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-indigo-50 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw size={16} className={isSyncing ? 'animate-spin text-indigo-600' : ''}/>
            {isSyncing ? 'Sincronizando...' : 'Sincronizar Ahora'}
          </button>
        </div>

        {syncResult && (
          <div className="mt-6 p-4 rounded-2xl bg-white/10 border border-white/20 text-xs text-white flex items-center justify-between">
            <div>
              {syncResult.error ? (
                <span className="text-rose-300 font-bold">{syncResult.error}</span>
              ) : (
                <span>
                  ✨ {syncResult.newTxs || 0} movimientos nuevos {syncResult.syncedAccountsCount !== undefined ? `(${syncResult.syncedAccountsCount} cuenta${syncResult.syncedAccountsCount === 1 ? '' : 's'})` : ''} | 📎 {syncResult.matchedTickets || 0} facturas emparejadas | ⏳ {syncResult.pendingTickets || 0} en buzón
                </span>
              )}
            </div>
            <button onClick={() => setSyncResult(null)} className="text-white/60 hover:text-white text-xs font-bold">Cerrar</button>
          </div>
        )}
      </div>

      {/* Grid: Estado Open Banking & Buzón de Tickets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card: Conexión API & Credenciales */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Building2 size={20}/>
              </div>
              <div>
                <h4 className="font-black text-slate-900 uppercase text-xs tracking-wider">Credenciales Open Banking</h4>
                <p className="text-[11px] text-slate-400 font-medium">Clave RSA y Application ID</p>
              </div>
            </div>
            <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-lg border ${
              status?.appActive 
                ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {status?.appActive ? 'Operativo' : 'Configurado'}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
              <span className="text-slate-500 font-bold text-[10px] uppercase">Application ID</span>
              <span className="font-mono text-slate-800 text-[11px] select-all truncate max-w-[200px]">
                {status?.appId || appIdInput}
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
              <span className="text-slate-500 font-bold text-[10px] uppercase">Clave Privada RSA</span>
              <span className={`font-bold text-[11px] flex items-center gap-1 ${
                status?.keyExists ? 'text-emerald-600' : 'text-rose-500'
              }`}>
                {status?.keyExists ? (
                  <>
                    <Check size={12}/> enablebanking.pem cargado ({status.keySize ? `${status.keySize} B` : 'OK'})
                  </>
                ) : (
                  <>
                    <AlertCircle size={12}/> Archivo .pem no cargado
                  </>
                )}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => setIsCredsModalOpen(true)}
              className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
            >
              <Key size={13}/> Ajustar Credenciales
            </button>
            <button
              onClick={() => setIsBankModalOpen(true)}
              className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Building2 size={13}/> Vincular Banco
            </button>
          </div>
        </div>

        {/* Card: Buzón de Tickets */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <FolderArchive size={20}/>
              </div>
              <div>
                <h4 className="font-black text-slate-900 uppercase text-xs tracking-wider">Buzón de Tickets Inbox</h4>
                <p className="text-[11px] text-slate-400 font-medium">Facturas y tickets pendientes de conciliar</p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black rounded-lg">
              {status?.inboxCount || 0} archivo(s)
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs text-slate-600">
            <p className="text-[11px] leading-relaxed">
              Guarda facturas o tickets (PDF o foto) en tu red local o envíalos desde tu iPhone / iPad:
            </p>
            <div className="p-2 bg-white rounded-xl border border-slate-200 font-mono text-[10px] text-slate-800 select-all break-all">
              \\192.168.1.2\docker\contamiki\data\tickets_inbox\
            </div>
            {uploadMessage && (
              <p className="text-[11px] font-bold text-emerald-600">{uploadMessage}</p>
            )}
          </div>

          {/* Action buttons for tickets */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleTicketUpload} 
              accept=".pdf,image/*" 
              className="hidden" 
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingTicket}
              className="py-2.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
            >
              <Upload size={13}/> {isUploadingTicket ? 'Subiendo...' : 'Subir Ticket'}
            </button>
            <button
              onClick={() => setIsShortcutModalOpen(true)}
              className="py-2.5 px-3 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
            >
              <Smartphone size={13}/> Atajo iOS
            </button>
            <button
              onClick={() => handleManualSync()}
              disabled={isSyncing}
              className="col-span-2 py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
              title="Emparejar ahora todos los tickets del buzón con las transacciones existentes"
            >
              <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''}/>
              {isSyncing ? 'Conciliando buzón...' : 'Conciliar tickets del buzón ahora'}
            </button>
          </div>
        </div>
      </div>

      {/* Cuentas Bancarias Conectadas y Mapeo */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Cuentas Bancarias Vinculadas (PSD2)</h4>
            <p className="text-xs text-slate-400">Asigna cada cuenta corriente a tu contabilidad correspondiente. Los extractos de tarjetas de crédito con liquidación diferida se gestionan como siempre a través del <strong>Importador Inteligente</strong>.</p>
          </div>
        </div>

        {status?.connections && status.connections.length > 0 ? (
          <div className="space-y-4">
            {status.connections.map((conn: any) => (
              <div key={conn.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🏦</span>
                    <div>
                      <span className="font-black text-slate-900 text-sm">{conn.aspsp?.name || 'Entidad Bancaria'}</span>
                      <p className="text-[10px] text-slate-400">Sesión iniciada: {new Date(conn.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteConnection(conn.id)}
                    className="p-2 text-slate-400 hover:text-rose-500 rounded-xl hover:bg-rose-50 transition-colors"
                    title="Desvincular"
                  >
                    <Trash2 size={16}/>
                  </button>
                </div>

                <div className="space-y-3">
                  {conn.accounts && conn.accounts.map((acc: any) => (
                    <div key={acc.uid} className="bg-white p-4 rounded-xl border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 text-xs">{acc.name || 'Cuenta'}</span>
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">{acc.iban || acc.uid}</span>
                        </div>
                        {acc.lastSync && (
                          <p className="text-[10px] text-emerald-600 font-medium mt-1">Última sincronización: {new Date(acc.lastSync).toLocaleString()}</p>
                        )}
                        {acc.lastBalanceCheck && acc.lastBankBalance !== undefined && acc.lastBankBalance !== null && (
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            {acc.lastIsCuadrado ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                ⚖️ Saldo cuadrado: {new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(acc.lastBankBalance)} €
                                {Boolean(acc.lastHoldsAmount && acc.lastHoldsAmount > 0) && (
                                  <span className="text-slate-500 font-normal ml-0.5">
                                    ({new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(acc.lastHoldsAmount)} € en retenciones)
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                                ⚠️ Dif: {acc.lastBalanceDiff > 0 ? '+' : ''}{new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(acc.lastBalanceDiff)} € (Banco: {new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(acc.lastBankBalance)} € | ContaMiki: {new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(acc.lastContaBalance)} €)
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
                        {acc.mappedAccountId && (
                          <button
                            type="button"
                            onClick={() => handleManualSync([acc.uid])}
                            disabled={isSyncing}
                            className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer disabled:opacity-50"
                            title="Sincronizar solo esta cuenta ahora"
                          >
                            <RefreshCw size={12} className={syncingSingleUid === acc.uid ? 'animate-spin text-indigo-600' : ''}/>
                            <span>{syncingSingleUid === acc.uid ? 'Sincronizando...' : 'Sincronizar'}</span>
                          </button>
                        )}
                        <select
                          value={acc.mappedAccountId || ''}
                          onChange={(e) => handleMapAccount(conn.id, acc.uid, currentBookId, e.target.value, acc.enabled)}
                          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500"
                        >
                          <option value="">-- Mapear a cuenta de tu contabilidad --</option>
                          {data.accounts.map(a => (
                            <option key={a.id} value={a.id}>
                              {a.name} ({a.currency})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-3">
            <span className="text-3xl">🏦</span>
            <p className="text-xs text-slate-500 font-bold">No hay cuentas bancarias vinculadas todavía.</p>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              Pulsa en el botón «Vincular Banco» superior para autorizar tu entidad oficial mediante la pasarela segura de Enable Banking.
            </p>
          </div>
        )}
      </div>

      {/* Configuración de Notificaciones & Tarea Matutina */}
      <form onSubmit={handleSaveNotifications} className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm space-y-6">
        <div>
          <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Notificaciones & Tarea Matutina</h4>
          <p className="text-xs text-slate-400">Elige por qué canales quieres recibir el resumen diario y a qué hora</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Hora de sincronización */}
          <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase">
              <Clock size={16}/> Hora del barrido matutino
            </div>
            <select
              value={notifSettings.syncHour ?? 6}
              onChange={(e) => setNotifSettings({ ...notifSettings, syncHour: parseInt(e.target.value, 10) })}
              className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
            >
              {Array.from({ length: 24 }).map((_, i) => (
                <option key={i} value={i}>
                  {String(i).padStart(2, '0')}:00 {i < 12 ? 'AM' : 'PM'} {i === 6 ? '(Recomendado: 6:00 AM)' : ''}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400">
              ContaMiki descargará los movimientos a esta hora para tener el informe listo al despertar.
            </p>
          </div>

          {/* Telegram Bot */}
          <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sky-600 font-bold text-xs uppercase">
                <Bot size={16}/> Bot de Telegram
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsTelegramModalOpen(true)}
                  className="text-[10px] text-sky-600 hover:text-sky-700 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  title="¿Cómo crear tu bot de Telegram?"
                >
                  <HelpCircle size={12}/> ¿Cómo crear tu Bot?
                </button>
                <input
                type="checkbox"
                checked={notifSettings.telegram?.enabled ?? false}
                onChange={(e) => setNotifSettings({
                  ...notifSettings,
                  telegram: { ...notifSettings.telegram, enabled: e.target.checked }
                })}
                className="w-4 h-4 rounded text-indigo-600"
                />
              </div>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                placeholder="Bot Token (de @BotFather)"
                value={notifSettings.telegram?.botToken || ''}
                onChange={(e) => setNotifSettings({
                  ...notifSettings,
                  telegram: { ...notifSettings.telegram, botToken: e.target.value }
                })}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono outline-none"
              />
              <input
                type="text"
                placeholder="Chat ID (de @userinfobot)"
                value={notifSettings.telegram?.chatId || ''}
                onChange={(e) => setNotifSettings({
                  ...notifSettings,
                  telegram: { ...notifSettings.telegram, chatId: e.target.value }
                })}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleTestTelegram}
              className="w-full py-2 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-xl text-[10px] font-bold uppercase transition-colors"
            >
              Probar Telegram
            </button>
            {telegramTestStatus && (
              <p className="text-[10px] font-bold text-slate-700 mt-1">{telegramTestStatus}</p>
            )}
          </div>

          {/* Cartero Email */}
          <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase">
                <Mail size={16}/> Cartero Email
              </div>
              <input
                type="checkbox"
                checked={notifSettings.email?.enabled ?? true}
                onChange={(e) => setNotifSettings({
                  ...notifSettings,
                  email: { ...notifSettings.email, enabled: e.target.checked }
                })}
                className="w-4 h-4 rounded text-indigo-600"
              />
            </div>

            <input
              type="email"
              placeholder="Email de destino"
              value={notifSettings.email?.address || ''}
              onChange={(e) => setNotifSettings({
                ...notifSettings,
                email: { ...notifSettings.email, address: e.target.value }
              })}
              className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          {saveNotifsMessage && (
            <p className="text-xs font-bold">{saveNotifsMessage}</p>
          )}
          <button
            type="submit"
            disabled={isSavingNotifs}
            className="ml-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
          >
            {isSavingNotifs ? 'Guardando...' : 'Guardar Preferencias de Notificación'}
          </button>
        </div>
      </form>

      {/* Modal: Configurar Credenciales Enable Banking */}
      {isCredsModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 md:p-8 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Key size={16}/>
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base uppercase">Credenciales Open Banking (PSD2)</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Sincronización bancaria automatizada para ContaMiki</p>
                </div>
              </div>
              <button onClick={() => setIsCredsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18}/>
              </button>
            </div>

            {/* Banner de Registro Enable Banking */}
            <div className="bg-gradient-to-r from-indigo-500/10 via-sky-500/10 to-indigo-500/10 border border-indigo-100 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                  Plataforma Oficial
                </span>
                <p className="text-xs font-bold text-slate-800">
                  ¿Necesitas darte de alta? Enable Banking es gratuito para uso personal.
                </p>
                <p className="text-[10px] text-slate-500">
                  Sustituye la antigua API de GoCardless con acceso directo a bancos españoles (CaixaBank, Santander, BBVA, etc.)
                </p>
              </div>
              <a
                href="https://enablebanking.com/cp/applications"
                target="_blank"
                rel="noreferrer"
                className="shrink-0 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
              >
                <ExternalLink size={13}/> Panel Enable Banking ↗
              </a>
            </div>

            {/* Guía Paso a Paso Desplegable */}
            <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-slate-50/50">
              <button
                type="button"
                onClick={() => setShowStepGuide(!showStepGuide)}
                className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-100/60 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <BookOpen size={15} className="text-indigo-600"/>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Guía Paso a Paso: Cómo darte de alta y activar tu app
                  </span>
                </div>
                {showStepGuide ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
              </button>

              {showStepGuide && (
                <div className="p-4 pt-1 border-t border-slate-200/60 space-y-3.5 text-xs text-slate-600 leading-relaxed">
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                    <div>
                      <strong className="text-slate-900">Regístrate gratis:</strong> Accede a <a href="https://enablebanking.com" target="_blank" rel="noreferrer" className="text-indigo-600 underline font-semibold">enablebanking.com</a> y crea tu cuenta de usuario.
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                    <div>
                      <strong className="text-slate-900">Crear Aplicación:</strong> En el menú superior entra en <strong>API applications</strong> y pulsa <strong>Add a new application</strong>.
                      <ul className="list-disc pl-4 mt-1 space-y-1 text-[11px] text-slate-500">
                        <li>Selecciona entorno <strong>Production</strong>.</li>
                        <li>En el método de clave, elige <em>«Generate in the browser (using SubtleCrypto) and export private key»</em>. Se descargará el archivo <strong>enablebanking.pem</strong> en tu equipo. ¡Guárdalo con cuidado!</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                    <div className="space-y-1.5 w-full">
                      <strong className="text-slate-900">Datos y URLs de Redirección:</strong>
                      <div className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-1 text-[11px]">
                        <div><span className="text-slate-400">Application name:</span> <strong className="text-slate-800">ContaMiki</strong></div>
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-slate-400 font-mono text-[10px]">Allowed redirect URLs:</span>
                          <button
                            type="button"
                            onClick={() => {
                              const urls = `${window.location.origin}/api/bank/callback\n${window.location.origin}/`;
                              navigator.clipboard.writeText(urls);
                              setCopiedRedirect(true);
                              setTimeout(() => setCopiedRedirect(false), 2500);
                            }}
                            className="text-[10px] text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1"
                          >
                            <Copy size={11}/> {copiedRedirect ? '¡Copiadas al portapapeles!' : 'Copiar URLs recomendadas'}
                          </button>
                        </div>
                        <pre className="p-1.5 bg-slate-50 rounded text-[10px] font-mono text-slate-700 select-all">{`${window.location.origin}/api/bank/callback\n${window.location.origin}/`}</pre>
                        <div className="text-[10px] text-slate-400">Privacy & Terms URLs: puedes poner la dirección de tu ContaMiki ({window.location.origin})</div>
                      </div>
                      <p className="text-[11px]">Pulsa en el botón verde <strong>Register</strong> al final de la página.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">4</span>
                    <div>
                      <strong className="text-slate-900">Activar la Aplicación (Paso Clave):</strong>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Al crearla, verás tu <strong>Application ID</strong> (kid) y la etiqueta <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px] font-bold">Inactive</span>. Para activarla en producción, en el cuadro inferior busca tu banco (CaixaBank, Santander, Bankinter...) en el desplegable y pulsa en <strong>«Link»</strong> para autorizar tu primera cuenta personal. La app pasará a estado <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[10px] font-bold">Active</span> de inmediato.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">5</span>
                    <div>
                      <strong className="text-slate-900">Guardar credenciales en ContaMiki:</strong>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Copia el <strong>Application ID</strong> y sube o pega el archivo <strong>enablebanking.pem</strong> en el formulario inferior.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Formulario de Configuración */}
            <form onSubmit={handleSaveCredentials} className="space-y-4 pt-1">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Application ID (kid)</label>
                <input
                  type="text"
                  required
                  placeholder="ej. a4b70785-ab0e-4c8f-b5da-4688b87f7dcf"
                  value={appIdInput}
                  onChange={(e) => setAppIdInput(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-black uppercase text-slate-500">Clave Privada RSA (enablebanking.pem)</label>
                  <label className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer flex items-center gap-1">
                    <Upload size={10}/> Cargar archivo .pem
                    <input type="file" accept=".pem,.key,.txt" onChange={handlePemFileUpload} className="hidden" />
                  </label>
                </div>
                <textarea
                  rows={3}
                  placeholder={status?.keyExists ? "••••• Clave RSA cargada actualmente en el servidor. Pega o sube una nueva solo si deseas reemplazarla •••••" : "-----BEGIN RSA PRIVATE KEY-----\n..."}
                  value={pemTextInput}
                  onChange={(e) => setPemTextInput(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-mono outline-none focus:border-indigo-500 custom-scrollbar"
                />
              </div>

              {credsMessage && (
                <p className="text-xs font-bold text-slate-800">{credsMessage}</p>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCredsModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingCreds}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95"
                >
                  {isSavingCreds ? 'Guardando y Verificando...' : 'Guardar y Verificar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Guía Atajo iOS con IA & Manual */}
      {isShortcutModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 space-y-5 shadow-2xl max-h-[85vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                  <Smartphone size={16}/>
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base uppercase">Atajo para iPhone / iPad</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Compartir tickets directamente al buzón</p>
                </div>
              </div>
              <button onClick={() => setIsShortcutModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18}/>
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
              {/* Opción 1: Crear con IA (Apple Intelligence) */}
              <div className="p-4 bg-gradient-to-br from-indigo-50 to-sky-50 rounded-2xl border border-indigo-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-black text-indigo-950 uppercase text-[11px] tracking-wider">
                    <Sparkles size={14} className="text-indigo-600"/> Crear con IA en Atajos (Recomendado)
                  </div>
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 font-bold text-[9px] uppercase rounded-full">
                    Rápido & 100% Nativo
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  En la app <strong>Atajos</strong> de tu iPhone o iPad, pulsa el botón de crear atajo con IA y pega este prompt exacto:
                </p>

                <div className="relative">
                  <pre className="p-3 bg-white rounded-xl border border-indigo-200 text-[10px] font-mono text-slate-800 leading-relaxed whitespace-pre-wrap select-all max-h-36 overflow-y-auto custom-scrollbar">
{`Crea un atajo que aparezca en la hoja de compartir para recibir archivos, imágenes y documentos PDF. Debe obtener el nombre del archivo recibido, codificar el archivo completo en Base64 sin saltos de línea y enviar una petición HTTP POST a ${window.location.origin}/api/tickets/inbox/upload con cuerpo JSON que contenga dos campos: "filename" con el nombre del archivo y "base64Data" con el texto codificado en Base64. Al terminar, muestra una notificación que diga "Ticket subido a ContaMiki ✅".`}
                  </pre>
                  <button
                    type="button"
                    onClick={() => {
                      const promptText = `Crea un atajo que aparezca en la hoja de compartir para recibir archivos, imágenes y documentos PDF. Debe obtener el nombre del archivo recibido, codificar el archivo completo en Base64 sin saltos de línea y enviar una petición HTTP POST a ${window.location.origin}/api/tickets/inbox/upload con cuerpo JSON que contenga dos campos: "filename" con el nombre del archivo y "base64Data" con el texto codificado en Base64. Al terminar, muestra una notificación que diga "Ticket subido a ContaMiki ✅".`;
                      navigator.clipboard.writeText(promptText);
                      setCopiedPrompt(true);
                      setTimeout(() => setCopiedPrompt(false), 2500);
                    }}
                    className="mt-2.5 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold uppercase text-[11px] flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
                  >
                    <Copy size={13}/> {copiedPrompt ? '¡Prompt Copiado al Portapapeles!' : 'Copiar Prompt para la App Atajos'}
                  </button>
                </div>
              </div>

              {/* Opción 2: Pasos Manuales */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="font-bold text-slate-900 text-[11px] uppercase">
                  O crearlo manualmente en 4 pasos:
                </div>
                <ol className="list-decimal pl-4 space-y-1.5 text-[11px] text-slate-600">
                  <li>En <strong>Atajos</strong> pulsa <strong>+</strong> y en la <strong>(i)</strong> activa <strong>«Mostrar al compartir»</strong> (Archivos e Imágenes).</li>
                  <li>Añade la acción <strong>«Codificar con Base64»</strong> sobre la <em>Entrada del atajo</em>.</li>
                  <li>
                    Añade <strong>«Obtener contenido de URL»</strong>:
                    <div className="p-2 bg-white rounded-lg border border-slate-200 font-mono text-[10px] mt-1 space-y-0.5 text-slate-700">
                      <div>URL: <strong>{window.location.origin}/api/tickets/inbox/upload</strong></div>
                      <div>Método: <strong>POST</strong> | Cuerpo: <strong>JSON</strong></div>
                      <div>Campo 1: <code>filename</code> ➔ Nombre</div>
                      <div>Campo 2: <code>base64Data</code> ➔ Codificado con Base64</div>
                    </div>
                  </li>
                  <li>Añade <strong>«Mostrar notificación»</strong>: <em>Ticket subido a ContaMiki ✅</em></li>
                </ol>
              </div>

              <p className="text-[10px] text-slate-400 italic">
                Nota: Apple bloquea los archivos .shortcut descargados de internet alegando "archivos sin firmar". Creándolo con el prompt de IA o manualmente se sincroniza limpiamente en todos tus dispositivos Apple vía iCloud.
              </p>
            </div>
          </div>
        </div>
      )}

      
      {/* Modal: Selector de Cuentas para Sincronización Manual */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 space-y-5 shadow-2xl max-h-[85vh] overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''}/>
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base uppercase">Sincronización Bancaria Manual</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Selecciona las cuentas a consultar en este barrido</p>
                </div>
              </div>
              <button 
                onClick={() => !isSyncing && setIsSyncModalOpen(false)} 
                disabled={isSyncing}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={18}/>
              </button>
            </div>

            {/* Quick Action Bar & Counter */}
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs">
              <span className="font-bold text-slate-700 text-[11px]">
                {selectedSyncAccountUids.length} de {mappedAccountsList.length} cuenta(s) seleccionada(s)
              </span>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={selectAllAccounts}
                  disabled={isSyncing}
                  className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                >
                  Marcar todas
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={deselectAllAccounts}
                  disabled={isSyncing}
                  className="font-bold text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
                >
                  Desmarcar todas
                </button>
              </div>
            </div>

            {/* Accounts Checklist */}
            <div className="space-y-2.5">
              {mappedAccountsList.map(item => {
                const isSelected = selectedSyncAccountUids.includes(item.uid);
                return (
                  <div
                    key={item.uid}
                    onClick={() => !isSyncing && toggleSelectAccount(item.uid)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-indigo-50/60 border-indigo-300 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 opacity-70'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        disabled={isSyncing}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 text-xs truncate">{item.name}</span>
                          <span className="text-[10px] text-slate-600 font-bold bg-slate-100 px-1.5 py-0.5 rounded">
                            {item.bankName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5 truncate">
                          {item.iban && <span className="font-mono">{item.iban}</span>}
                          <span>➔</span>
                          <span className="text-indigo-700 font-bold truncate">📁 {item.bookName} ({item.accountName})</span>
                        </div>
                        {item.lastSync && (
                          <p className="text-[9px] text-emerald-600 font-medium mt-0.5">
                            Última sinc: {new Date(item.lastSync).toLocaleString()}
                          </p>
                        )}
                        {item.lastBalanceCheck && item.lastBankBalance !== undefined && item.lastBankBalance !== null && (
                          <div className="mt-1">
                            {item.lastIsCuadrado ? (
                              <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-200 px-1.5 py-0.5 rounded">
                                ⚖️ Saldo cuadrado ({new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item.lastBankBalance)} €{Boolean(item.lastHoldsAmount && item.lastHoldsAmount > 0) ? ` · ${new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item.lastHoldsAmount)} € retenidos` : ''})
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold text-amber-700 bg-amber-100/70 border border-amber-200 px-1.5 py-0.5 rounded">
                                ⚠️ Dif: {item.lastBalanceDiff > 0 ? '+' : ''}{new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item.lastBalanceDiff)} € (Banco: {new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item.lastBankBalance)} €)
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isSelected ? (
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                          <Check size={12}/>
                        </span>
                      ) : (
                        <span className="w-5 h-5 rounded-full border border-slate-300"/>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsSyncModalOpen(false)}
                disabled={isSyncing}
                className="w-1/3 py-3 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-bold uppercase text-[11px] transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleManualSync()}
                disabled={isSyncing || selectedSyncAccountUids.length === 0}
                className="w-2/3 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold uppercase text-[11px] tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''}/>
                <span>
                  {isSyncing 
                    ? 'Sincronizando...' 
                    : `Sincronizar (${selectedSyncAccountUids.length})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Instrucciones Telegram Bot */}
      {isTelegramModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 space-y-5 shadow-2xl max-h-[85vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                  <Bot size={16}/>
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base uppercase">Crear tu Bot de Telegram</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Instrucciones paso a paso en 2 minutos</p>
                </div>
              </div>
              <button onClick={() => setIsTelegramModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18}/>
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
              <div className="flex items-start gap-3 p-3.5 bg-sky-50/60 rounded-2xl border border-sky-100">
                <span className="w-5 h-5 rounded-full bg-sky-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                <div className="space-y-1">
                  <strong className="text-slate-900 font-black">Crear el Bot con @BotFather:</strong>
                  <p className="text-[11px]">
                    Abre Telegram y busca al bot oficial <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-sky-600 font-bold underline">@BotFather ↗</a>.
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-[10px] text-slate-500 font-mono">
                    <li>Envía el mensaje: <code>/newbot</code></li>
                    <li>Escribe el nombre visible (ej. <code>ContaMiki Avisos</code>)</li>
                    <li>Escribe un alias terminado en bot (ej. <code>mi_contamiki_bot</code>)</li>
                  </ul>
                  <p className="text-[11px] text-slate-700">
                    BotFather te responderá con tu <strong>HTTP API Token</strong> (ej. <code>8611126291:AAEc11...</code>). Cópialo y pégalo en el campo <strong>Bot Token</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                <div className="space-y-1">
                  <strong className="text-slate-900 font-black">Obtener tu Chat ID con @userinfobot:</strong>
                  <p className="text-[11px]">
                    En Telegram, busca a <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="text-sky-600 font-bold underline">@userinfobot ↗</a> y pulsa en <strong>Iniciar</strong>.
                  </p>
                  <p className="text-[11px] text-slate-700">
                    Te responderá con tu identificador numérico (ej. <code>651388683</code>). Cópialo en el campo <strong>Chat ID</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200/80">
                <span className="w-5 h-5 rounded-full bg-amber-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                <div className="space-y-1">
                  <strong className="text-amber-950 font-black">¡Paso Clave! Iniciar tu propio Bot:</strong>
                  <p className="text-[11px] text-amber-900">
                    Abre el chat de tu nuevo bot en Telegram (el enlace que te dio BotFather) y pulsa en <strong>«INICIAR»</strong> o escribe <code>/start</code>.
                  </p>
                  <p className="text-[10px] text-amber-800 italic">
                    (Telegram prohíbe que los bots envíen mensajes a usuarios que no hayan iniciado conversación con ellos primero).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 bg-emerald-50/80 rounded-2xl border border-emerald-200/80">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">4</span>
                <div className="space-y-1">
                  <strong className="text-emerald-950 font-black">Probar y Guardar:</strong>
                  <p className="text-[11px] text-emerald-900">
                    Pulsa en <strong>«Probar Telegram»</strong> para recibir un mensaje de bienvenida inmediato, y pulsa <strong>«Guardar Preferencias de Notificación»</strong>.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsTelegramModalOpen(false)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold uppercase text-[11px] transition-all"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Selección de Banco */}
      {isBankModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-base uppercase">Selecciona tu Banco</h3>
              <button onClick={() => setIsBankModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <input
              type="text"
              placeholder="Buscar banco (ej. CaixaBank, Santander, Bankinter...)"
              value={bankSearch}
              onChange={(e) => setBankSearch(e.target.value)}
              className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
            />

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {filteredAspsps.map((b: any) => (
                <div
                  key={b.name}
                  onClick={() => handleConnectBank(b.name)}
                  className="p-3.5 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 cursor-pointer transition-all flex items-center justify-between group"
                >
                  <span className="font-bold text-slate-800 text-xs group-hover:text-indigo-600">{b.name}</span>
                  <ArrowUpRight size={14} className="text-slate-300 group-hover:text-indigo-600"/>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
