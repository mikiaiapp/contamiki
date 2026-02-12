import React, { useState } from 'react';
import { AppState, Category, Account, AccountGroup, Family } from '../types';
import { Settings, Wallet, Tags, Layers, Bot, Database, AlertCircle, Plus, Trash2, Edit2, Save, X, Check, Archive, Download, Upload } from 'lucide-react';
import { parseMigrationData } from '../services/geminiService';

interface SettingsViewProps {
  data: AppState;
  onUpdateData: (newData: Partial<AppState>) => void;
  onNavigateToTransactions?: (filters: any) => void;
  onCreateBookFromImport?: (data: AppState, name: string) => void;
  onDeleteBook?: () => void;
}

type SettingsTab = 'GENERAL' | 'CATEGORIES' | 'ACCOUNTS' | 'TOOLS' | 'DATA';

export const SettingsView: React.FC<SettingsViewProps> = ({ 
    data, 
    onUpdateData, 
    onNavigateToTransactions,
    onCreateBookFromImport,
    onDeleteBook
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('GENERAL');
  
  // States for Data Import/Migration
  const [migrationText, setMigrationText] = useState('');
  const [isMigrating, setIsMigrating] = useState(false);
  const [newBookName, setNewBookName] = useState('');

  const handleMigration = async () => {
      if (!migrationText || !newBookName) return;
      setIsMigrating(true);
      try {
          const result = await parseMigrationData(migrationText);
          
          // Construct a fresh AppState from parsed data
          const newState: AppState = {
              accountGroups: [
                { id: 'g1', name: 'Bancos', icon: '🏦' },
                { id: 'g2', name: 'Otros', icon: '📦' }
              ],
              accounts: result.accounts.map((a: any, i: number) => ({
                  id: `acc_${i}`,
                  name: a.name,
                  initialBalance: a.balance || 0,
                  currency: a.currency || 'EUR',
                  icon: a.icon || '🏦',
                  groupId: 'g1',
                  active: true
              })),
              families: result.families.map((f: any, i: number) => ({
                  id: `fam_${i}`,
                  name: f.name,
                  type: f.type || 'EXPENSE',
                  icon: f.icon || '🏷️'
              })),
              categories: [], // Needed logic to map categories to families
              transactions: [],
              recurrents: [],
              favorites: []
          };
          
          // Populate categories linking to created families
          let catIndex = 0;
          result.categories.forEach((c: any) => {
              const fam = newState.families.find(f => f.name === c.familyName);
              if (fam) {
                  newState.categories.push({
                      id: `cat_${catIndex++}`,
                      name: c.name,
                      familyId: fam.id,
                      icon: c.icon || '🔹',
                      active: true
                  });
              }
          });

          if (onCreateBookFromImport) {
              onCreateBookFromImport(newState, newBookName);
              setMigrationText('');
              setNewBookName('');
              alert("Nueva contabilidad creada con los datos importados.");
          }
      } catch (e) {
          console.error(e);
          alert("Error en la migración.");
      } finally {
          setIsMigrating(false);
      }
  };

  const tabs: {id: SettingsTab, label: string, icon: React.ReactNode}[] = [
      { id: 'GENERAL', label: 'General', icon: <Settings size={18}/> },
      { id: 'ACCOUNTS', label: 'Cuentas', icon: <Wallet size={18}/> },
      { id: 'CATEGORIES', label: 'Categorías', icon: <Tags size={18}/> },
      { id: 'TOOLS', label: 'Herramientas', icon: <Bot size={18}/> },
      { id: 'DATA', label: 'Datos', icon: <Database size={18}/> },
  ];

  return (
    <div className="space-y-8">
      <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Ajustes</h2>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Configuración del Libro Contable</p>
      </div>

      <div className="flex flex-wrap gap-2 pb-4 border-b border-slate-100">
          {tabs.map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3 rounded-xl flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
              >
                  {tab.icon} {tab.label}
              </button>
          ))}
      </div>

      <div className="bg-white rounded-[2.5rem] p-8 sm:p-10 shadow-sm border border-slate-100 min-h-[400px]">
         {activeTab === 'GENERAL' && (
             <div className="space-y-8 max-w-xl">
                 <div className="bg-rose-50 border border-rose-100 p-6 rounded-3xl space-y-4">
                     <div className="flex items-center gap-3 text-rose-600">
                         <AlertCircle size={24}/>
                         <h3 className="font-black uppercase tracking-tight">Zona de Peligro</h3>
                     </div>
                     <p className="text-xs text-rose-800 font-medium">Estas acciones afectan solo a este libro contable.</p>
                     <button onClick={() => { if(confirm("¿Seguro que quieres borrar este libro?")) onDeleteBook?.(); }} className="px-4 py-3 bg-white border border-rose-200 text-rose-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all">
                         Eliminar Libro Actual
                     </button>
                 </div>
             </div>
         )}
         
         {activeTab === 'TOOLS' && (
            <div className="space-y-12">
                <div className="bg-indigo-600 p-10 rounded-[3rem] text-white space-y-8 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:scale-110 transition-transform"><Bot size={120}/></div>
                    <div className="relative z-10 space-y-4 text-center sm:text-left">
                        <h3 className="text-3xl font-black uppercase tracking-tighter">Importación Inteligente</h3>
                        <p className="text-indigo-100 text-sm font-medium">Carga tus extractos bancarios y deja que el Bot sugiera categorías basándose en tu historial.</p>
                        <button onClick={() => onNavigateToTransactions?.({ action: 'IMPORT' })} className="px-8 py-4 bg-white text-indigo-600 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl flex items-center justify-center gap-3 hover:scale-105 active:scale-95 transition-all">
                           <Bot size={20}/> Lanzar Smart Import
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="bg-white p-3 rounded-xl shadow-sm"><Upload size={20}/></div>
                            <h3 className="text-lg font-black uppercase tracking-tight">Migrar desde otra App</h3>
                        </div>
                        <p className="text-xs text-slate-500">Pega aquí el contenido CSV o texto de tu antigua app y la IA intentará reconstruir la estructura.</p>
                        
                        <input 
                            type="text" 
                            className="w-full p-3 rounded-xl border border-slate-200 text-sm font-bold" 
                            placeholder="Nombre para el nuevo libro..."
                            value={newBookName}
                            onChange={e => setNewBookName(e.target.value)}
                        />
                        <textarea 
                            className="w-full h-32 p-3 rounded-xl border border-slate-200 text-xs font-mono" 
                            placeholder="Pega tus datos crudos aquí..."
                            value={migrationText}
                            onChange={e => setMigrationText(e.target.value)}
                        ></textarea>
                        
                        <button 
                            onClick={handleMigration}
                            disabled={isMigrating || !migrationText || !newBookName}
                            className="w-full py-3 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-600 transition-all disabled:opacity-50"
                        >
                            {isMigrating ? 'Analizando...' : 'Crear Libro desde Datos'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {(activeTab === 'CATEGORIES' || activeTab === 'ACCOUNTS' || activeTab === 'DATA') && (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <Settings className="w-12 h-12 mb-4 opacity-20"/>
                <p className="font-bold text-sm">Configuración avanzada disponible próximamente</p>
            </div>
        )}
      </div>
    </div>
  );
};