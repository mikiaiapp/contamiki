
import React, { useMemo, useState } from 'react';
import { LayoutDashboard, Receipt, Settings, Wallet, LogOut, ChevronDown, Plus, Edit2, Check, Cloud, CloudOff, RefreshCw, Save } from 'lucide-react';
import { View, AppState, BookMetadata } from './types';
import { logout } from './services/authService';

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
            <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                <Wallet className="text-white" size={20} />
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
          <div className="h-px bg-white/10 mx-4 mb-4" />
          
          <button 
              onClick={logout}
              className="w-full flex items-center gap-4 px-6 py-4 rounded-[1.25rem] text-white/50 hover:bg-white/10 hover:text-white transition-all font-black text-[10px] uppercase tracking-widest group"
          >
              <div className="group-hover:rotate-12 transition-transform">
                <LogOut size={20} />
              </div>
              <span>Cerrar Sesión</span>
          </button>
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
    </div>
  );
};
