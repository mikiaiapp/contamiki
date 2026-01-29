
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
    <div className="flex h-screen bg-[#f8fafc] text-slate-900 flex-col lg:flex-row overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-80 bg-slate-950 text-white flex-col shadow-[10px_0_30px_rgba(0,0,0,0.05)] z-50">
        <div className="p-10 flex items-center gap-4">
          <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-500/20">
            <Wallet className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-black tracking-tighter">ContaMiki</h1>
        </div>
        
        <nav className="flex-1 px-6 space-y-3">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`w-full flex items-center gap-4 px-6 py-5 rounded-[1.5rem] transition-all duration-300 group ${
                currentView === item.id
                  ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-600/30 translate-x-2'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className={currentView === item.id ? 'scale-110 transition-transform' : 'group-hover:scale-110 transition-transform'}>
                {item.icon}
              </div>
              <span className="font-bold text-sm uppercase tracking-widest">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-8 px-10">
            <button 
                onClick={logout}
                className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all font-bold text-xs uppercase tracking-widest"
            >
                <LogOut size={20} />
                <span>Finalizar Sesión</span>
            </button>
        </div>
      </aside>

      {/* Mobile/Tablet Header */}
      <header className="lg:hidden bg-slate-950 text-white px-6 py-5 flex justify-between items-center shadow-xl z-50">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl">
            <Wallet size={24} />
          </div>
          <span className="font-black text-xl tracking-tighter uppercase">ContaMiki</span>
        </div>
        <button onClick={logout} className="bg-rose-500/20 text-rose-400 p-2.5 rounded-xl border border-rose-500/20">
          <LogOut size={20} />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative custom-scrollbar bg-[#f8fafc]">
        <div className="p-6 md:p-10 lg:p-16 max-w-[1600px] mx-auto min-h-full pb-32 lg:pb-16">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation - Glassmorphism */}
      <nav className="lg:hidden fixed bottom-6 left-6 right-6 bg-slate-900/90 backdrop-blur-xl border border-white/10 flex justify-around items-center p-3 z-50 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.id)}
            className={`flex flex-col items-center gap-1.5 p-3 min-w-[70px] transition-all ${
              currentView === item.id ? 'text-indigo-400 scale-110' : 'text-slate-500'
            }`}
          >
            <div className={`p-1 transition-transform`}>
              {item.icon}
            </div>
            <span className="text-[9px] font-black uppercase tracking-[0.15em]">{item.label}</span>
            {currentView === item.id && <div className="w-1 h-1 bg-indigo-400 rounded-full mt-0.5 shadow-[0_0_10px_#818cf8]"></div>}
          </button>
        ))}
      </nav>
    </div>
  );
};
