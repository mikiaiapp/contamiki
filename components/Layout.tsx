import React from 'react';
import { LayoutDashboard, Receipt, Settings, BrainCircuit, Wallet, LogOut } from 'lucide-react';
import { View } from '../types';
import { logout } from '../services/authService';

interface LayoutProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ currentView, setCurrentView, children }) => {
  const navItems: { id: View; label: string; icon: React.ReactNode }[] = [
    { id: 'DASHBOARD', label: 'Tablero', icon: <LayoutDashboard size={20} /> },
    { id: 'TRANSACTIONS', label: 'Movimientos', icon: <Receipt size={20} /> },
    { id: 'SETTINGS', label: 'Configuración', icon: <Settings size={20} /> },
    { id: 'AI_INSIGHTS', label: 'Asesor IA', icon: <BrainCircuit size={20} /> },
  ];

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-xl">
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

        {/* Logout Section */}
        <div className="p-4 border-t border-slate-700">
            <button 
                onClick={logout}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-rose-400 hover:bg-rose-900/20 hover:text-rose-300 transition-colors"
            >
                <LogOut size={20} />
                <span className="font-medium">Cerrar Sesión</span>
            </button>
            <div className="mt-4 text-xs text-slate-500 text-center">
             &copy; 2025 Finance App
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};