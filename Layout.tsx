
import React, { useMemo, useState, useEffect } from 'react';
import { LayoutDashboard, Receipt, Settings, BrainCircuit, Wallet, LogOut, ChevronDown, Plus, Check, Edit3, ArrowLeft } from 'lucide-react';
import { View, AppState } from './types';
import { logout, getUsername } from './services/authService';

interface LayoutProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  children: React.ReactNode;
  data: AppState;
  onSwitchLedger: (ledgerId: string) => void;
  onCreateLedger: (name: string, color: string) => void;
  onUpdateLedger: (id: string, name: string, color: string) => void;
}

// Nueva paleta: Primarios en tonalidades pastel saturadas + Negro/Blanco
const LEDGER_COLORS = [
    { bg: '#0f172a', name: 'Graphite', class: 'bg-slate-950' },   // Negro/Gris muy oscuro
    { bg: '#4f46e5', name: 'Blueberry', class: 'bg-indigo-600' }, // Azul Primario Suave
    { bg: '#059669', name: 'Mint', class: 'bg-emerald-600' },     // Verde Pastel Oscuro
    { bg: '#e11d48', name: 'Raspberry', class: 'bg-rose-600' },   // Rojo/Rosa Primario
    { bg: '#d97706', name: 'Honey', class: 'bg-amber-600' },      // Amarillo/Naranja
    { bg: '#7c3aed', name: 'Grape', class: 'bg-violet-600' },     // Violeta
];

type MenuMode = 'LIST' | 'CREATE' | 'EDIT';

export const Layout: React.FC<LayoutProps> = ({ currentView, setCurrentView, children, data, onSwitchLedger, onCreateLedger, onUpdateLedger }) => {
  const username = getUsername() || 'Invitado';
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Menu State
  const [menuMode, setMenuMode] = useState<MenuMode>('LIST');
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState(LEDGER_COLORS[0].bg);
  const [editingId, setEditingId] = useState<string | null>(null);

  const activeLedger = useMemo(() => 
    data.ledgers?.find(l => l.id === data.activeLedgerId) || { name: 'Contabilidad', color: '#0f172a' }
  , [data.ledgers, data.activeLedgerId]);

  // Estilo dinámico para el sidebar basado en el ledger seleccionado
  const sidebarStyle = { backgroundColor: activeLedger.color };

  const pendingRecurrentsCount = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return data.recurrents?.filter(r => r.active && r.nextDueDate <= today).length || 0;
  }, [data.recurrents]);

  const mainNavItems: { id: View; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'RESUMEN', label: 'Resumen', icon: <LayoutDashboard size={22} />, badge: pendingRecurrentsCount },
    { id: 'TRANSACTIONS', label: 'Movimientos', icon: <Receipt size={22} /> },
    { id: 'SETTINGS', label: 'Ajustes', icon: <Settings size={22} /> },
  ];

  const aiNavItem = { id: 'AI_INSIGHTS' as View, label: 'Asesor IA', icon: <BrainCircuit size={22} /> };

  const renderNavItem = (item: { id: View; label: string; icon: React.ReactNode; badge?: number }, isMobile = false) => (
    <button
      key={item.id}
      onClick={() => setCurrentView(item.id)}
      className={`w-full flex items-center gap-4 px-6 py-4 rounded-[1.25rem] transition-all duration-300 group relative ${
        currentView === item.id
          ? 'bg-white/10 text-white shadow-xl translate-x-1'
          : 'text-white/60 hover:bg-white/5 hover:text-white'
      } ${isMobile ? 'flex-col gap-1 p-3' : ''}`}
    >
      <div className={currentView === item.id ? 'scale-110' : 'group-hover:scale-110 transition-transform'}>
        {item.icon}
      </div>
      <span className={`font-bold uppercase tracking-[0.2em] ${isMobile ? 'text-[8px]' : 'text-[11px]'}`}>{item.label}</span>
      
      {item.badge !== undefined && item.badge > 0 && (
        <span className="absolute top-3 right-5 bg-rose-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-lg border-2 border-slate-950 animate-bounce">
          {item.badge}
        </span>
      )}
    </button>
  );

  const resetMenu = () => {
      setMenuMode('LIST');
      setFormName('');
      setFormColor(LEDGER_COLORS[0].bg);
      setEditingId(null);
  };

  const handleOpenCreate = () => {
      setFormName('');
      setFormColor(LEDGER_COLORS[0].bg);
      setMenuMode('CREATE');
  };

  const handleOpenEdit = (e: React.MouseEvent, ledger: any) => {
      e.stopPropagation();
      setFormName(ledger.name);
      setFormColor(ledger.color);
      setEditingId(ledger.id);
      setMenuMode('EDIT');
  };

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!formName) return;

      if (menuMode === 'CREATE') {
          onCreateLedger(formName, formColor);
      } else if (menuMode === 'EDIT' && editingId) {
          onUpdateLedger(editingId, formName, formColor);
      }
      
      resetMenu();
      setIsMenuOpen(false);
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 flex-col lg:flex-row overflow-hidden font-sans">
      {/* SIDEBAR DESKTOP */}
      <aside 
        className="hidden lg:flex w-72 xl:w-80 text-white flex-col shadow-2xl z-50 transition-colors duration-500"
        style={sidebarStyle}
      >
        <div className="p-10 flex items-center gap-4 relative">
            <div className="bg-white/20 p-2.5 rounded-2xl shadow-lg backdrop-blur-sm">
                <Wallet className="text-white" size={28} />
            </div>
            
            <div className="flex-1 relative">
                <button 
                    onClick={() => { setIsMenuOpen(!isMenuOpen); resetMenu(); }}
                    className="text-left w-full group outline-none"
                >
                    <h1 className="text-xl font-black tracking-tighter leading-none truncate flex items-center gap-2">
                        {activeLedger.name} <ChevronDown size={14} className={`opacity-50 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`}/>
                    </h1>
                    <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mt-1.5 truncate max-w-[120px]">
                        {username}
                    </p>
                </button>

                {/* DROPDOWN MENU */}
                {isMenuOpen && (
                    <div className="absolute top-full left-0 w-72 bg-white rounded-2xl shadow-2xl p-2 mt-4 text-slate-900 z-[100] animate-in slide-in-from-top-2 border border-slate-100">
                        {menuMode === 'LIST' ? (
                            <>
                                <p className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Mis Contabilidades</p>
                                <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1 mb-2">
                                    {data.ledgers?.map(l => (
                                        <div key={l.id} className="group flex items-center gap-1 pr-1">
                                            <button 
                                                onClick={() => { onSwitchLedger(l.id); setIsMenuOpen(false); }}
                                                className={`flex-1 flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors ${data.activeLedgerId === l.id ? 'bg-slate-100 text-indigo-600' : 'hover:bg-slate-50'}`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className="w-3 h-3 rounded-full shadow-sm" style={{backgroundColor: l.color}}></div>
                                                    <span className="font-bold text-xs truncate">{l.name}</span>
                                                </div>
                                                {data.activeLedgerId === l.id && <Check size={14}/>}
                                            </button>
                                            <button 
                                                onClick={(e) => handleOpenEdit(e, l)}
                                                className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                title="Editar apariencia"
                                            >
                                                <Edit3 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <div className="border-t border-slate-100 pt-2">
                                    <button 
                                        onClick={handleOpenCreate}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-indigo-600 hover:bg-indigo-50 rounded-xl text-xs font-black uppercase tracking-wide"
                                    >
                                        <Plus size={16}/> Nueva Contabilidad
                                    </button>
                                </div>
                            </>
                        ) : (
                            <form onSubmit={handleSubmit} className="p-2 space-y-3">
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-2">
                                        <button type="button" onClick={resetMenu} className="text-slate-400 hover:text-slate-600"><ArrowLeft size={14}/></button>
                                        <span className="text-xs font-black uppercase">{menuMode === 'CREATE' ? 'Nueva' : 'Editar'}</span>
                                    </div>
                                </div>
                                <input 
                                    type="text" 
                                    autoFocus
                                    placeholder="Nombre (ej: Negocio)" 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500"
                                    value={formName}
                                    onChange={e => setFormName(e.target.value)}
                                />
                                <div>
                                    <p className="text-[9px] font-black uppercase text-slate-400 mb-2">Color Tema</p>
                                    <div className="flex flex-wrap gap-2">
                                        {LEDGER_COLORS.map(c => (
                                            <button 
                                                key={c.bg}
                                                type="button"
                                                onClick={() => setFormColor(c.bg)}
                                                className={`w-6 h-6 rounded-full border-2 shadow-sm transition-transform ${formColor === c.bg ? 'border-indigo-500 scale-110 ring-2 ring-indigo-100' : 'border-white hover:scale-110'}`}
                                                style={{backgroundColor: c.bg}}
                                                title={c.name}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <button type="submit" disabled={!formName} className="w-full bg-slate-900 text-white py-2 rounded-lg text-[10px] font-black uppercase disabled:opacity-50 hover:bg-black transition-colors">
                                    {menuMode === 'CREATE' ? 'Crear' : 'Guardar Cambios'}
                                </button>
                            </form>
                        )}
                    </div>
                )}
            </div>
        </div>
        
        <nav className="flex-1 px-6 space-y-2">
          {mainNavItems.map((item) => renderNavItem(item))}
        </nav>

        <div className="px-6 pb-4 space-y-2">
          <div className="h-px bg-white/10 mx-4 mb-4" />
          {renderNavItem(aiNavItem)}
          
          <button 
              onClick={logout}
              className="w-full flex items-center gap-4 px-6 py-4 rounded-[1.25rem] text-white/50 hover:bg-rose-500/20 hover:text-white transition-all font-black text-[10px] uppercase tracking-widest group"
          >
              <div className="group-hover:rotate-12 transition-transform">
                <LogOut size={20} />
              </div>
              <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* HEADER MOBILE */}
      <header 
        className="lg:hidden text-white px-6 py-4 flex justify-between items-center shadow-xl z-50 transition-colors duration-500"
        style={sidebarStyle}
      >
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
            <Wallet size={20} />
          </div>
          <div onClick={() => { setIsMenuOpen(!isMenuOpen); resetMenu(); }} className="cursor-pointer">
            <span className="font-black text-lg tracking-tighter uppercase leading-none flex items-center gap-2">
                {activeLedger.name} <ChevronDown size={12}/>
            </span>
            <span className="text-[8px] font-bold text-white/50 uppercase tracking-widest block mt-0.5 truncate max-w-[100px]">{username}</span>
          </div>
        </div>
        
        {/* MOBILE DROPDOWN */}
        {isMenuOpen && (
            <div className="absolute top-16 left-4 right-4 bg-white text-slate-900 rounded-2xl shadow-2xl p-4 z-[100] border border-slate-100 animate-in slide-in-from-top-2">
                 {menuMode === 'LIST' ? (
                    <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Mis Contabilidades</p>
                         {data.ledgers?.map(l => (
                            <div key={l.id} className="flex gap-2">
                                <button 
                                    onClick={() => { onSwitchLedger(l.id); setIsMenuOpen(false); }}
                                    className={`flex-1 flex items-center justify-between px-3 py-3 rounded-xl text-left ${data.activeLedgerId === l.id ? 'bg-slate-100 text-indigo-600' : 'bg-slate-50'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full shadow-sm" style={{backgroundColor: l.color}}></div>
                                        <span className="font-bold text-sm">{l.name}</span>
                                    </div>
                                    {data.activeLedgerId === l.id && <Check size={16}/>}
                                </button>
                                <button 
                                    onClick={(e) => handleOpenEdit(e, l)}
                                    className="bg-slate-50 text-slate-400 px-3 rounded-xl hover:bg-indigo-50 hover:text-indigo-600"
                                >
                                    <Edit3 size={16} />
                                </button>
                            </div>
                        ))}
                         <button 
                            onClick={handleOpenCreate}
                            className="w-full flex items-center justify-center gap-2 px-3 py-3 mt-2 border-2 border-dashed border-slate-200 text-indigo-600 rounded-xl text-xs font-black uppercase"
                        >
                            <Plus size={16}/> Nueva Contabilidad
                        </button>
                    </div>
                 ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                         <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={resetMenu} className="text-slate-400"><ArrowLeft size={16}/></button>
                                <span className="text-xs font-black uppercase">{menuMode === 'CREATE' ? 'Nueva' : 'Editar'}</span>
                            </div>
                            <button type="button" onClick={() => setIsMenuOpen(false)} className="text-rose-500 text-[10px] font-bold uppercase">Cerrar</button>
                        </div>
                        <input 
                            type="text" 
                            placeholder="Nombre" 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none"
                            value={formName}
                            onChange={e => setFormName(e.target.value)}
                        />
                         <div className="flex gap-3 justify-center flex-wrap">
                            {LEDGER_COLORS.map(c => (
                                <button 
                                    key={c.bg}
                                    type="button"
                                    onClick={() => setFormColor(c.bg)}
                                    className={`w-8 h-8 rounded-full border-2 transition-transform ${formColor === c.bg ? 'border-indigo-500 scale-110 ring-2 ring-indigo-100' : 'border-white'}`}
                                    style={{backgroundColor: c.bg}}
                                />
                            ))}
                        </div>
                        <button type="submit" disabled={!formName} className="w-full bg-slate-900 text-white py-3 rounded-xl text-xs font-black uppercase">
                            {menuMode === 'CREATE' ? 'Crear' : 'Guardar'}
                        </button>
                    </form>
                 )}
            </div>
        )}

        <button onClick={logout} className="bg-white/10 text-white/70 p-2 rounded-xl hover:bg-white/20">
          <LogOut size={18} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto relative bg-slate-50 custom-scrollbar">
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-8 md:px-12 py-8 md:py-12 lg:py-16 pb-36 lg:pb-16">
          {children}
        </div>
      </main>

      <nav className="lg:hidden fixed bottom-6 left-4 right-4 bg-slate-900/95 backdrop-blur-xl border border-white/10 flex justify-around items-center p-2 z-50 rounded-[2.5rem] shadow-2xl">
        {mainNavItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.id)}
            className={`flex flex-col items-center gap-1 p-3 transition-all relative ${
              currentView === item.id ? 'text-white scale-110' : 'text-slate-500 hover:text-slate-300'
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
        <button
            onClick={() => setCurrentView(aiNavItem.id)}
            className={`flex flex-col items-center gap-1 p-3 transition-all ${
              currentView === aiNavItem.id ? 'text-white scale-110' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {aiNavItem.icon}
            <span className="text-[8px] font-black uppercase tracking-[0.1em]">{aiNavItem.label}</span>
          </button>
      </nav>
    </div>
  );
};
