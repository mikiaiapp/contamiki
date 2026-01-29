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
    { id: 'DASHBOARD', label: 'Tablero', icon: <LayoutDashboard size={20} /> },
    { id: 'TRANSACTIONS', label: 'Movimientos', icon: <Receipt size={20} /> },
    { id: 'AI_INSIGHTS', label: 'Asesor IA', icon: <BrainCircuit size={20} /> },
    { id: 'SETTINGS', label: 'Ajustes', icon: <Settings size={20} /> },
  ];

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-slate-900 text-white flex-col shadow-xl">
        <div className="p-6 border-b border-slate-700 flex items-center gap-3">
          <Wallet className="text-emerald-400" size={28} />
          <h1 className="text-xl font-bold tracking-tight">ContaMiki</h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                currentView === item.id
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {item.icon}
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700">
            <button 
                onClick={logout}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-rose-400 hover:bg-rose-900/20 hover:text-rose-300 transition-colors"
            >
                <LogOut size={20} />
                <span className="font-medium">Cerrar Sesión</span>
            </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden bg-slate-900 text-white p-4 flex justify-between items-center shadow-md z-30">
        <div className="flex items-center gap-2">
          <Wallet className="text-emerald-400" size={24} />
          <span className="font-bold text-lg">ContaMiki</span>
        </div>
        <button onClick={logout} className="text-rose-400 p-1">
          <LogOut size={20} />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-20 lg:pb-0">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center p-2 z-40 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.id)}
            className={`flex flex-col items-center gap-1 p-2 min-w-[64px] transition-colors ${
              currentView === item.id ? 'text-emerald-600' : 'text-slate-400'
            }`}
          >
            <div className={`p-1 rounded-md ${currentView === item.id ? 'bg-emerald-50' : ''}`}>
              {item.icon}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};