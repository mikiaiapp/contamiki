import React, { useMemo, useState, useEffect } from 'react';
import { LayoutDashboard, Receipt, Settings, Wallet, LogOut, ChevronDown, Plus, Edit2, Check, Cloud, CloudOff, RefreshCw, Save, User, Key, Trash2, X, AlertCircle, ShieldCheck, QrCode } from 'lucide-react';
import { View, AppState, BookMetadata } from './types';
import { logout, getUsername, changePassword, deleteAccount, setup2FA, verifySetup2FA, disable2FA, get2FAStatus } from './services/authService';

interface LayoutProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  children: React.ReactNode;
  data: AppState;
  books: BookMetadata[];
  currentBook: BookMetadata;
  onSwitchBook: (bookId: string) => void;
  onCreateBook: () => void;
  onEditBook: () => void;
  syncStatus?: 'SAVED' | 'SAVING' | 'ERROR';
  syncError?: string | null;
  onManualSave?: () => void;
}

const THEME_COLORS: Record<string, string> = {
    BLACK: 'bg-slate-950',
    BLUE: 'bg-blue-600',
    ROSE: 'bg-rose-500',
    EMERALD: 'bg-emerald-500',
    AMBER: 'bg-amber-500',
    VIOLET: 'bg-violet-600',
};

const THEME_ACCENTS: Record<string, string> = {
    BLACK: 'text-slate-400 hover:bg-white/10',
    BLUE: 'text-blue-200 hover:bg-white/10',
    ROSE: 'text-rose-200 hover:bg-white/10',
    EMERALD: 'text-emerald-200 hover:bg-white/10',
    AMBER: 'text-amber-200 hover:bg-white/10',
    VIOLET: 'text-violet-200 hover:bg-white/10',
};

export const Layout: React.FC<LayoutProps> = ({ currentView, setCurrentView, children, data, books, currentBook, onSwitchBook, onCreateBook, onEditBook, syncStatus = 'SAVED', syncError, onManualSave }) => {
  const [isBookMenuOpen, setIsBookMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [customLogo, setCustomLogo] = useState<string | null>(localStorage.getItem('contamiki_custom_logo'));
  
  // Modals States
  const [isChangePassModalOpen, setIsChangePassModalOpen] = useState(false);
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
  
  // 2FA States
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  const [twoFactorStep, setTwoFactorStep] = useState<'INITIAL' | 'SETUP' | 'VERIFY'>('INITIAL');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [setupCode, setSetupCode] = useState('');
  const [setupError, setSetupError] = useState('');

  // Change Pass Inputs
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');

  // Delete Account Inputs
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const username = getUsername() || 'Usuario';

  useEffect(() => {
      const handleLogoChange = () => {
          setCustomLogo(localStorage.getItem('contamiki_custom_logo'));
      };
      window.addEventListener('contamiki_logo_changed', handleLogoChange);
      return () => window.removeEventListener('contamiki_logo_changed', handleLogoChange);
  }, []);

  const pendingRecurrentsCount = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return data.recurrents?.filter(r => r.active && r.nextDueDate <= today).length || 0;
  }, [data.recurrents]);

  const bgClass = THEME_COLORS[currentBook.color] || THEME_COLORS.BLACK;
  const accentClass = THEME_ACCENTS[currentBook.color] || THEME_ACCENTS.BLACK;

  const mainNavItems: { id: View; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'RESUMEN', label: 'Resumen', icon: <LayoutDashboard size={22} />, badge: pendingRecurrentsCount },
    { id: 'TRANSACTIONS', label: 'Movimientos', icon: <Receipt size={22} /> },
    { id: 'SETTINGS', label: 'Ajustes', icon: <Settings size={22} /> },
  ];

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      const target = e.currentTarget;
      const src = target.src;
      // Estrategia de reintentos
      if (src.endsWith('/contamiki.jpg')) {
          target.src = '/ContaMiki.jpg'; // Probar CamelCase
      } else if (src.endsWith('/ContaMiki.jpg')) {
          target.src = '/contamiki.png'; // Probar PNG
      } else if (src.endsWith('/contamiki.png')) {
           target.src = '/logo.jpg'; // Probar genérico
      } else {
          target.src = "https://cdn-icons-png.flaticon.com/512/2910/2910296.png";
      }
  };

  const handleChangePassword = async () => {
      if (!currentPass || !newPass) {
          setPassError("Rellena ambos campos");
          return;
      }
      try {
          await changePassword(currentPass, newPass);
          setPassSuccess("Contraseña cambiada correctamente");
          setPassError("");
          setTimeout(() => {
              setIsChangePassModalOpen(false);
              setCurrentPass('');
              setNewPass('');
              setPassSuccess('');
          }, 1500);
      } catch (err: any) {
          setPassError(err.message);
      }
  };

  const handleDeleteAccount = async () => {
      if (deleteConfirmation !== 'DAR DE BAJA USUARIO') {
          return;
      }
      try {
          await deleteAccount();
          // Logout se maneja dentro del servicio
      } catch (err: any) {
          setDeleteError(err.message);
      }
  };

  // 2FA HANDLERS
  const open2FAModal = async () => {
      setIs2FAModalOpen(true);
      setTwoFactorStep('INITIAL');
      setSetupError('');
      try {
          const status = await get2FAStatus();
          setTwoFactorEnabled(status.enabled);
      } catch (e) {
          console.error(e);
      }
  };

  const start2FASetup = async () => {
      try {
          const { qrCode } = await setup2FA();
          setQrCodeUrl(qrCode);
          setTwoFactorStep('SETUP');
          setSetupCode('');
          setSetupError('');
      } catch (e) {
          setSetupError("Error al iniciar configuración");
      }
  };

  const verify2FASetup = async () => {
      try {
          await verifySetup2FA(setupCode);
          setTwoFactorEnabled(true);
          setTwoFactorStep('INITIAL');
          alert("2FA Activado Correctamente");
      } catch (e: any) {
          setSetupError(e.message);
      }
  };

  const handleDisable2FA = async () => {
      if (!confirm("¿Seguro que quieres desactivar la protección de doble factor?")) return;
      try {
          await disable2FA();
          setTwoFactorEnabled(false);
      } catch (e) {
          alert("Error desactivando 2FA");
      }
  };

  const renderNavItem = (item: { id: View; label: string; icon: React.ReactNode; badge?: number }, isMobile = false) => (
    <button
      key={item.id}
      onClick={() => setCurrentView(item.id)}
      className={`w-full flex items-center gap-4 px-6 py-4 rounded-[1.25rem] transition-all duration-300 group relative ${
        currentView === item.id
          ? 'bg-white text-slate-900 shadow-xl translate-x-1 font-bold'
          : `${accentClass} text-white/70 hover:text-white`
      } ${isMobile ? 'flex-col gap-1 p-3' : ''}`}
    >
      <div className={currentView === item.id ? 'scale-110 text-indigo-600' : 'group-hover:scale-110 transition-transform'}>
        {item.icon}
      </div>
      <span className={`uppercase tracking-[0.2em] ${isMobile ? 'text-[8px]' : 'text-[11px]'} ${currentView === item.id ? 'font-black' : 'font-medium'}`}>{item.label}</span>
      
      {item.badge !== undefined && item.badge > 0 && (
        <span className="absolute top-3 right-5 bg-rose-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-lg border-2 border-white animate-bounce">
          {item.badge}
        </span>
      )}
    </button>
  );

  const BookSelector = () => (
    <div className="relative z-[60]">
        <button 
            onClick={() => setIsBookMenuOpen(!isBookMenuOpen)}
            className="flex items-center gap-3 px-3 py-2 rounded-2xl hover:bg-black/10 transition-all active:scale-95"
        >
            <div className="bg-white/20 p-1.5 rounded-xl backdrop-blur-sm shadow-sm overflow-hidden flex items-center justify-center">
                 <img 
                    src={customLogo || "/contamiki.jpg"} 
                    className="w-6 h-6 object-cover" 
                    alt="Logo" 
                    onError={customLogo ? undefined : handleImageError}
                 />
            </div>
            <div className="text-left">
                <span className="hidden sm:block text-[10px] uppercase tracking-widest text-white/60">Contabilidad</span>
                <span className="block text-xs sm:text-sm font-black text-white leading-none tracking-tight max-w-[140px] sm:max-w-none truncate">{currentBook.name}</span>
            </div>
            <ChevronDown size={16} className={`text-white/60 transition-transform ${isBookMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {isBookMenuOpen && (
            <>
                <div className="fixed inset-0 z-10" onClick={() => setIsBookMenuOpen(false)}></div>
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-20 animate-in fade-in slide-in-from-top-2">
                    <div className="p-2 space-y-1">
                        <div className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Mis Libros</div>
                        {books.map(book => (
                            <button 
                                key={book.id}
                                onClick={() => { onSwitchBook(book.id); setIsBookMenuOpen(false); }}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all ${book.id === currentBook.id ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-3 h-3 rounded-full ${THEME_COLORS[book.color].replace('bg-', 'bg-')}`}></div>
                                    <span className="text-xs font-bold">{book.name}</span>
                                </div>
                                {book.id === currentBook.id && <Check size={14} />}
                            </button>
                        ))}
                    </div>
                    <div className="bg-slate-50 p-2 border-t border-slate-100 flex gap-1">
                        <button 
                            onClick={() => { onCreateBook(); setIsBookMenuOpen(false); }}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-all"
                        >
                            <Plus size={14} /> Crear
                        </button>
                        <button 
                            onClick={() => { onEditBook(); setIsBookMenuOpen(false); }}
                            className="px-3 py-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-all"
                            title="Editar libro actual"
                        >
                            <Edit2 size={14} />
                        </button>
                    </div>
                </div>
            </>
        )}
    </div>
  );

  const SyncIndicator = () => {
      if (syncStatus === 'SAVING') {
          return <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full text-white/80 select-none"><RefreshCw size={14} className="animate-spin"/><span className="text-[9px] font-black uppercase tracking-wider">Guardando...</span></div>;
      }
      if (syncStatus === 'ERROR') {
          return (
             <button 
                onClick={() => { if(syncError) alert(syncError); else onManualSave?.(); }} 
                className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/20 text-white rounded-full border border-rose-500/50 hover:bg-rose-500 hover:text-white transition-all active:scale-95 group relative"
                title={syncError || "Error desconocido. Clic para reintentar."}
             >
                <CloudOff size={14} />
                <span className="text-[9px] font-black uppercase tracking-wider">Error</span>
                {syncError && (
                    <div className="hidden group-hover:block absolute top-full left-0 mt-2 bg-slate-900 text-white text-[10px] p-2 rounded-lg w-48 z-[100] shadow-xl">
                        {syncError}
                    </div>
                )}
             </button>
          );
      }
      return <button onClick={onManualSave} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/20 rounded-full text-white/40 hover:text-white transition-all active:scale-95" title="Forzar guardado"><Cloud size={14} /><span className="text-[9px] font-black uppercase tracking-wider">Guardado</span></button>;
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 flex-col lg:flex-row overflow-hidden font-sans">
      {/* SIDEBAR DESKTOP */}
      <aside className={`hidden lg:flex w-72 xl:w-80 ${bgClass} text-white flex-col shadow-2xl z-50 transition-colors duration-500`}>
        <div className="p-8 pb-4 space-y-4">
            <BookSelector />
            <div className="flex justify-start pl-2">
                <SyncIndicator />
            </div>
        </div>
        
        <div className="h-px bg-white/10 mx-6 mb-6" />

        <nav className="flex-1 px-6 space-y-2">
          {mainNavItems.map((item) => renderNavItem(item))}
        </nav>

        <div className="px-6 pb-6 space-y-2">
          <div className="flex justify-center pb-6 opacity-80 hover:opacity-100 transition-all duration-500">
             <img 
                src={customLogo || "/contamiki.jpg"} 
                className="w-40 h-40 rounded-3xl shadow-2xl object-cover border-4 border-white/10 bg-white" 
                alt="ContaMiki"
                onError={customLogo ? undefined : handleImageError}
             />
          </div>

          <div className="h-px bg-white/10 mx-4 mb-4" />
          
          {/* USER MENU */}
          <div className="relative">
              <button 
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="w-full flex items-center gap-4 px-6 py-4 rounded-[1.25rem] text-white/70 hover:bg-white/10 hover:text-white transition-all font-bold text-[11px] group relative"
              >
                  <div className="bg-white/10 p-2 rounded-full group-hover:scale-110 transition-transform">
                      <User size={18} />
                  </div>
                  <div className="flex flex-col items-start truncate">
                      <span className="uppercase text-[9px] opacity-60">Usuario</span>
                      <span className="truncate max-w-[140px]">{username}</span>
                  </div>
                  <ChevronDown className={`ml-auto transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} size={16}/>
              </button>

              {isUserMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsUserMenuOpen(false)}></div>
                    <div className="absolute bottom-full left-0 mb-2 w-full bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-20 animate-in slide-in-from-bottom-2 fade-in">
                        <div className="p-2 space-y-1">
                             <button onClick={() => { setIsUserMenuOpen(false); open2FAModal(); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-slate-50 transition-all text-slate-600">
                                <ShieldCheck size={16} className="text-emerald-500"/> <span className="text-[10px] font-black uppercase tracking-widest">Seguridad 2FA</span>
                            </button>
                            <button onClick={() => { setIsUserMenuOpen(false); setIsChangePassModalOpen(true); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-slate-50 transition-all text-slate-600">
                                <Key size={16} className="text-amber-500"/> <span className="text-[10px] font-black uppercase tracking-widest">Cambiar Clave</span>
                            </button>
                            <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-slate-50 transition-all text-slate-600">
                                <LogOut size={16} className="text-indigo-500"/> <span className="text-[10px] font-black uppercase tracking-widest">Cerrar Sesión</span>
                            </button>
                            <div className="h-px bg-slate-100 my-1"/>
                            <button onClick={() => { setIsUserMenuOpen(false); setIsDeleteAccountModalOpen(true); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-rose-50 transition-all text-rose-500">
                                <Trash2 size={16}/> <span className="text-[10px] font-black uppercase tracking-widest">Borrar Cuenta</span>
                            </button>
                        </div>
                    </div>
                  </>
              )}
          </div>
        </div>
      </aside>

      {/* HEADER MOBILE */}
      <header className={`lg:hidden ${bgClass} text-white px-6 py-4 flex justify-between items-center shadow-xl z-50 transition-colors duration-500`}>
        <BookSelector />
        <div className="flex items-center gap-3">
            <SyncIndicator />
            <button onClick={logout} className="bg-white/10 text-white/70 p-2 rounded-xl border border-white/10">
              <LogOut size={18} />
            </button>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 overflow-y-auto relative bg-slate-50 custom-scrollbar">
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-8 md:px-12 py-8 md:py-12 lg:py-16 pb-36 lg:pb-16">
          {children}
        </div>
      </main>

      {/* NAVBAR MOBILE BOTTOM */}
      <nav className="lg:hidden fixed bottom-6 left-4 right-4 bg-slate-900/95 backdrop-blur-xl border border-white/10 flex justify-around items-center p-2 z-50 rounded-[2.5rem] shadow-2xl">
        {mainNavItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.id)}
            className={`flex flex-col items-center gap-1 p-3 transition-all relative ${
              currentView === item.id ? 'text-indigo-400 scale-110' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {item.icon}
            <span className="text-[8px] font-black uppercase tracking-[0.1em]">{item.label}</span>
            {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute top-1 right-2 bg-rose-500 text-white text-[7px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-md">
                    {item.badge}
                </span>
            )}
          </button>
        ))}
      </nav>

      {/* MODAL 2FA */}
      {is2FAModalOpen && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[200] p-6 animate-in fade-in duration-300">
              <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-8 text-center relative">
                  <button onClick={() => setIs2FAModalOpen(false)} className="absolute top-4 right-4 p-2 bg-slate-50 text-slate-400 rounded-full hover:bg-slate-100"><X size={20}/></button>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-2 flex items-center justify-center gap-2"><ShieldCheck className="text-emerald-500"/> Seguridad 2FA</h3>
                  
                  {twoFactorStep === 'INITIAL' && (
                      <div className="space-y-6 mt-6">
                           <div className={`p-4 rounded-2xl border ${twoFactorEnabled ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                               <p className="text-xs font-bold">{twoFactorEnabled ? 'Autenticación Activada' : 'Autenticación Desactivada'}</p>
                           </div>
                           
                           {twoFactorEnabled ? (
                               <button onClick={handleDisable2FA} className="w-full py-4 bg-rose-50 text-rose-500 border border-rose-100 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-rose-100 transition-all">Desactivar 2FA</button>
                           ) : (
                               <button onClick={start2FASetup} className="w-full py-4 bg-slate-950 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-600 shadow-xl">Configurar Ahora</button>
                           )}
                           
                           <p className="text-[10px] text-slate-400">Compatible con Google Authenticator, Microsoft Auth y otros.</p>
                      </div>
                  )}

                  {twoFactorStep === 'SETUP' && (
                      <div className="space-y-6 mt-6 animate-in slide-in-from-right">
                          <p className="text-xs text-slate-500 font-medium">1. Escanea este código en tu app de autenticación:</p>
                          <div className="bg-white p-2 rounded-xl border-2 border-slate-100 inline-block">
                              <img src={qrCodeUrl} className="w-40 h-40" alt="QR Code" />
                          </div>
                          
                          <div className="space-y-2">
                              <p className="text-xs text-slate-500 font-medium">2. Introduce el código de 6 dígitos:</p>
                              <input 
                                  type="text" 
                                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-center tracking-[0.5em] text-xl outline-none focus:border-indigo-500" 
                                  placeholder="000000" 
                                  maxLength={6}
                                  value={setupCode}
                                  onChange={e => setSetupCode(e.target.value.replace(/[^0-9]/g, '').slice(0,6))}
                              />
                          </div>

                          {setupError && <p className="text-rose-500 text-xs font-bold">{setupError}</p>}

                          <button onClick={verify2FASetup} className="w-full py-4 bg-emerald-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-600 shadow-xl">Verificar y Activar</button>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* MODAL CAMBIO CONTRASEÑA */}
      {isChangePassModalOpen && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[200] p-6 animate-in fade-in duration-300">
              <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-8 text-center relative">
                  <button onClick={() => setIsChangePassModalOpen(false)} className="absolute top-4 right-4 p-2 bg-slate-50 text-slate-400 rounded-full hover:bg-slate-100"><X size={20}/></button>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-6 flex items-center justify-center gap-2"><Key className="text-amber-500"/> Cambiar Clave</h3>
                  <div className="space-y-4">
                      <input type="password" placeholder="Contraseña Actual" className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-indigo-500" value={currentPass} onChange={e => setCurrentPass(e.target.value)} />
                      <input type="password" placeholder="Nueva Contraseña" className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-indigo-500" value={newPass} onChange={e => setNewPass(e.target.value)} />
                      {passError && <p className="text-rose-500 text-xs font-bold">{passError}</p>}
                      {passSuccess && <p className="text-emerald-500 text-xs font-bold">{passSuccess}</p>}
                      <button onClick={handleChangePassword} className="w-full py-4 bg-slate-950 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-600 shadow-xl">Actualizar</button>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL BORRAR CUENTA */}
      {isDeleteAccountModalOpen && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[200] p-6 animate-in fade-in duration-300">
              <div className="bg-white rounded-[2rem] shadow-2xl w-full max-sm p-8 text-center relative border-4 border-rose-50">
                  <button onClick={() => setIsDeleteAccountModalOpen(false)} className="absolute top-4 right-4 p-2 bg-slate-50 text-slate-400 rounded-full hover:text-rose-500 hover:bg-slate-100"><X size={20}/></button>
                  <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-rose-500"><AlertCircle size={32}/></div>
                  <h3 className="text-xl font-black text-rose-600 uppercase tracking-tighter mb-2">¡Peligro!</h3>
                  <p className="text-slate-500 text-xs font-medium mb-6">Esta acción borrará tu usuario y <strong>TODOS</strong> tus datos financieros. Es irreversible a menos que tengas una copia de seguridad local.</p>
                  
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Escribe: DAR DE BAJA USUARIO</p>
                  <input type="text" className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-center outline-none focus:border-rose-500 uppercase text-rose-900 mb-4" value={deleteConfirmation} onChange={e => setDeleteConfirmation(e.target.value.toUpperCase())} />
                  
                  {deleteError && <p className="text-rose-500 text-xs font-bold mb-4">{deleteError}</p>}

                  <button 
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirmation !== 'DAR DE BAJA USUARIO'}
                    className={`w-full py-4 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all ${deleteConfirmation === 'DAR DE BAJA USUARIO' ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                  >
                      Eliminar mi cuenta para siempre
                  </button>
              </div>
          </div>
      )}

    </div>
  );
};
