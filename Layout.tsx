
import React from 'react';
import { LayoutDashboard, Receipt, Settings, BrainCircuit, Wallet, LogOut } from 'lucide-react';
import { View } from './types';
import { logout } from './services/authService';

interface LayoutProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ currentView, setCurrentView, children }) => {
  const navItems: { id: View; label: string; icon: React.ReactNode }[] = [
    { id: 'DASHBOARD', label: 'Tablero', icon: <LayoutDashboard size={22} /> },
    { id: 'TRANSACTIONS', label: 'Movimientos', icon: <Receipt size={22} /> },
    { id: 'AI_INSIGHTS', label: 'Asesor IA', icon: <BrainCircuit size={22} /> },
    { id: 'SETTINGS', label: 'Ajustes', icon: <Settings size={22} /> },
  ];

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 flex-col lg:flex-row overflow-hidden font-sans">
      {/* Sidebar Escritorio */}
      <aside className="hidden lg:flex w-72 xl:w-80 bg-slate-950 text-white flex-col shadow-2xl z-50">
        <div className="p-10 flex items-center gap-4">
          <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-500/20">
            <Wallet className="text-white" size={28} />
          </div>
          <h1 className="text-2xl font-black tracking-tighter">ContaMiki</h1>
        </div>
        
        <nav className="flex-1 px-6 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-[1.25rem] transition-all duration-300 group ${
                currentView === item.id
                  ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20 translate-x-1'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className={currentView === item.id ? 'scale-110' : 'group-hover:scale-110 transition-transform'}>
                {item.icon}
              </div>
              <span className="font-bold text-[11px] uppercase tracking-[0.2em]">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-8">
            <button 
                onClick={logout}
                className="w-full flex items-center gap-3 px-6 py-4 rounded-xl text-rose-400 hover:bg-rose-500/10 transition-all font-black text-[10px] uppercase tracking-widest"
            >
                <LogOut size={18} />
                <span>Cerrar Sesión</span>
            </button>
        </div>
      </aside>

      {/* Header Móvil */}
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

      {/* Área Principal con Padding Responsivo */}
      <main className="flex-1 overflow-y-auto relative bg-slate-50 custom-scrollbar">
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-8 md:px-12 py-8 md:py-12 lg:py-16 pb-36 lg:pb-16">
          {children}
        </div>
      </main>

      {/* Navegación Inferior Móvil/Tablet */}
      <nav className="lg:hidden fixed bottom-6 left-4 right-4 bg-slate-900/95 backdrop-blur-xl border border-white/10 flex justify-around items-center p-2 z-50 rounded-[2.5rem] shadow-2xl">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.id)}
            className={`flex flex-col items-center gap-1 p-3 transition-all ${
              currentView === item.id ? 'text-indigo-400 scale-110' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {item.icon}
            <span className="text-[8px] font-black uppercase tracking-[0.1em]">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};
