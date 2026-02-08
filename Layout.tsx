
import React, { useMemo } from 'react';
import { LayoutDashboard, Receipt, Settings, BrainCircuit, Wallet, LogOut } from 'lucide-react';
import { View, AppState } from './types';
import { logout } from './services/authService';

interface LayoutProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  children: React.ReactNode;
  data: AppState;
}

export const Layout: React.FC<LayoutProps> = ({ currentView, setCurrentView, children, data }) => {
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
          ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20 translate-x-1'
          : 'text-slate-400 hover:bg-white/5 hover:text-white'
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

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 flex-col lg:flex-row overflow-hidden font-sans">
      <aside className="hidden lg:flex w-72 xl:w-80 bg-slate-950 text-white flex-col shadow-2xl z-50">
        <div className="p-10 flex items-center gap-4">
          <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-500/20">
            <Wallet className="text-white" size={28} />
          </div>
          <h1 className="text-2xl font-black tracking-tighter">ContaMiki</h1>
        </div>
        
        <nav className="flex-1 px-6 space-y-2">
          {mainNavItems.map((item) => renderNavItem(item))}
        </nav>

        <div className="px-6 pb-4 space-y-2">
          <div className="h-px bg-white/5 mx-4 mb-4" />
          {renderNavItem(aiNavItem)}
          
          <button 
              onClick={logout}
              className="w-full flex items-center gap-4 px-6 py-4 rounded-[1.25rem] text-rose-400 hover:bg-rose-500/10 transition-all font-black text-[10px] uppercase tracking-widest group"
          >
              <div className="group-hover:rotate-12 transition-transform">
                <LogOut size={20} />
              </div>
              <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      <header className="lg:hidden bg-slate-950 text-white px-6 py-4 flex justify-between items-center shadow-xl z-50">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl">
            <Wallet size={20} />
          </div>
          <span className="font-black text-lg tracking-tighter uppercase">ContaMiki</span>
        </div>
        <button onClick={logout} className="bg-rose-500/10 text-rose-400 p-2 rounded-xl border border-rose-500/20">
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
        <button
            onClick={() => setCurrentView(aiNavItem.id)}
            className={`flex flex-col items-center gap-1 p-3 transition-all ${
              currentView === aiNavItem.id ? 'text-indigo-400 scale-110' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {aiNavItem.icon}
            <span className="text-[8px] font-black uppercase tracking-[0.1em]">{aiNavItem.label}</span>
          </button>
      </nav>
    </div>
  );
};
