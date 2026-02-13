
import React, { useState, useRef } from 'react';
import { AppState, BookMetadata, BookColor, SettingsViewProps } from '../types';
import { Trash2, Edit2, Wallet, BoxSelect, FileJson, ArrowRightLeft, Check, X, HardDriveDownload, HardDriveUpload, BookCopy, BookPlus, ChevronDown, AlertTriangle, Loader2, Search, FileCheck, CheckCircle2, XCircle } from 'lucide-react';

const generateId = () => Math.random().toString(36).substring(2, 15);

export const SettingsView: React.FC<SettingsViewProps> = ({ 
  data, 
  books, 
  onUpdateData, 
  onCreateBookFromImport, 
  onExportData,
  onRestoreToBook
}) => {
  const [activeTab, setActiveTab] = useState('ACC_GROUPS');
  
  // Estados para la restauración
  const [parsedData, setParsedData] = useState<AppState | null>(null);
  const [fileName, setFileName] = useState('');
  const [exportTarget, setExportTarget] = useState<string>('ALL');
  
  // Estados de control del proceso (DEBUG VISUAL)
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [processLogs, setProcessLogs] = useState<{msg: string, status: 'loading' | 'success' | 'error' | 'info'}[]>([]);
  const [processError, setProcessError] = useState<string | null>(null);

  // Estado para el modal de restauración (Inputs)
  const [targetBookId, setTargetBookId] = useState<string>('');
  const [newBookName, setNewBookName] = useState('');
  const [newBookColor, setNewBookColor] = useState<BookColor>('BLUE');

  const backupInputRef = useRef<HTMLInputElement>(null);

  const addLog = (msg: string, status: 'loading' | 'success' | 'error' | 'info') => {
      setProcessLogs(prev => [...prev, { msg, status }]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Resetear estados
    setParsedData(null);
    setProcessError(null);
    setIsProcessingFile(true);
    setProcessLogs([]);
    setFileName(file.name);

    addLog(`Archivo seleccionado: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`, 'info');
    addLog("Iniciando lectura del disco...", 'loading');

    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        addLog("Lectura completada. Iniciando análisis JSON...", 'loading');
        
        // Retardo artificial mínimo para permitir que la UI se renderice si el archivo es muy pequeño
        setTimeout(() => {
            try {
                const json = JSON.parse(content);
                addLog("Estructura JSON válida.", 'success');

                let dataToUse: AppState | null = null;

                // 1. Detección de Formato
                if (json.booksData && json.booksMetadata) {
                    addLog("Formato detectado: Copia de Seguridad Completa (Multi-Libro).", 'info');
                    
                    // Intentar obtener el libro actual o el primero disponible
                    const id = json.currentBookId || Object.keys(json.booksData)[0];
                    if (json.booksData[id]) {
                        dataToUse = json.booksData[id];
                        addLog(`Extrayendo datos del libro principal (ID: ${id.substring(0,6)}...)`, 'success');
                    } else {
                        throw new Error(`El archivo indica un libro activo ID ${id} pero no contiene sus datos.`);
                    }
                } else if (json.transactions && Array.isArray(json.transactions)) {
                    addLog("Formato detectado: Libro Individual Simple.", 'info');
                    dataToUse = json as AppState;
                } else {
                    throw new Error("El archivo JSON no tiene la estructura de ContaMiki (faltan 'transactions' o 'booksData').");
                }

                // 2. Validación de Datos Mínimos
                if (dataToUse) {
                    const txCount = dataToUse.transactions?.length || 0;
                    const accCount = dataToUse.accounts?.length || 0;
                    addLog(`Validación: ${txCount} movimientos, ${accCount} cuentas encontradas.`, 'success');
                    
                    setParsedData(dataToUse);
                    setNewBookName(file.name.replace('.json', '').replace('backup_', '').replace('contamiki_', ''));
                    addLog("¡Listo para restaurar!", 'success');
                    setIsProcessingFile(false); // Fin del proceso de carga
                }

            } catch (parseErr: any) {
                console.error(parseErr);
                setProcessError(`Error procesando datos: ${parseErr.message}`);
                addLog("Fallo en el análisis de datos.", 'error');
                setIsProcessingFile(false);
            }
        }, 500);

      } catch (err: any) {
        console.error(err);
        setProcessError(`Error crítico: ${err.message}`);
        addLog("Error desconocido durante la lectura.", 'error');
        setIsProcessingFile(false);
      }
    };

    reader.onerror = () => {
        setProcessError("No se pudo leer el archivo físico. Puede estar corrupto o bloqueado.");
        addLog("Fallo de lectura de FileReader.", 'error');
        setIsProcessingFile(false);
    };

    reader.readAsText(file);
    e.target.value = ''; // Permitir seleccionar el mismo archivo de nuevo
  };

  const handleExecuteAction = (mode: 'CURRENT' | 'OTHER' | 'NEW') => {
    if (!parsedData) return;

    if (mode === 'CURRENT') {
      if (window.confirm("¡ATENCIÓN! Se van a SOBRESCRIBIR TODOS los datos del libro actual con los de la copia. Esta acción no se puede deshacer. ¿Deseas continuar?")) {
        onUpdateData(parsedData);
        setParsedData(null);
        setProcessLogs([]);
      }
    } else if (mode === 'OTHER') {
      if (!targetBookId) return;
      const targetName = books.find(b => b.id === targetBookId)?.name || 'seleccionado';
      if (window.confirm(`¡ATENCIÓN! Vas a sobrescribir todos los datos del libro "${targetName}". ¿Estás totalmente seguro?`)) {
        onRestoreToBook?.(targetBookId, parsedData);
        setParsedData(null);
        setProcessLogs([]);
      }
    } else if (mode === 'NEW') {
      if (!newBookName.trim()) {
          alert("Por favor, indica un nombre para el nuevo libro.");
          return;
      }
      onCreateBookFromImport?.(parsedData, newBookName, newBookColor);
      setParsedData(null);
      setProcessLogs([]);
    }
  };

  const renderIcon = (iconStr: string, className = "w-6 h-6") => {
    if (!iconStr) return <span className="text-xl">📂</span>;
    if (iconStr.startsWith('http') || iconStr.startsWith('data:image')) return <img src={iconStr} className={`${className} object-contain rounded-lg`} referrerPolicy="no-referrer" />;
    return <span className="text-xl">{iconStr}</span>;
  };

  const currentBookName = books.find(b => b.id === (books[0]?.id))?.name || "Actual";

  return (
    <div className="space-y-12 pb-20 animate-in fade-in duration-500">
      <div className="text-center md:text-left">
        <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter">Ajustes.</h2>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em]">Configuración del Sistema</p>
      </div>

      <nav className="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner border border-slate-200 overflow-x-auto">
        {[
            {id: 'ACC_GROUPS', label: 'Grupos', icon: <BoxSelect size={16}/>},
            {id: 'ACCOUNTS', label: 'Cuentas', icon: <Wallet size={16}/>},
            {id: 'DATA', label: 'Copia Seguridad', icon: <HardDriveDownload size={16}/>}
        ].map(t => (
            <button key={t.id} className={`flex-1 min-w-[150px] flex items-center justify-center gap-2 px-6 py-3.5 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all ${activeTab === t.id ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => setActiveTab(t.id)}>
              {t.icon} {t.label}
            </button>
        ))}
      </nav>

      <div className="max-w-5xl mx-auto">
        {activeTab === 'ACC_GROUPS' && (
            <div className="space-y-4">
                {data.accountGroups.map(g => (
                    <div key={g.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 flex items-center justify-between group shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100">{renderIcon(g.icon)}</div>
                            <span className="font-bold text-slate-700 uppercase text-xs tracking-tight">{g.name}</span>
                        </div>
                    </div>
                ))}
            </div>
        )}

        {activeTab === 'ACCOUNTS' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.accounts.map(a => (
                    <div key={a.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100">{renderIcon(a.icon)}</div>
                            <div className="flex flex-col">
                                <span className="font-bold text-slate-700 uppercase text-xs">{a.name}</span>
                                <span className="text-[9px] font-black text-slate-400 uppercase">Saldo: {a.initialBalance}€</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}

        {activeTab === 'DATA' && (
            <div className="space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* SECCIÓN EXPORTAR */}
                    <div className="bg-indigo-50 p-10 rounded-[3rem] border border-indigo-100 space-y-6 text-center shadow-sm">
                        <div className="mx-auto w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm"><HardDriveDownload size={32}/></div>
                        <div className="space-y-1">
                            <h3 className="text-xl font-black text-indigo-900 uppercase">Exportar Datos</h3>
                            <p className="text-xs text-indigo-400">Descarga tus datos en formato JSON</p>
                        </div>
                        
                        <div className="space-y-2 text-left">
                            <label className="text-[9px] font-black text-indigo-400 uppercase ml-1">Origen de la copia</label>
                            <div className="relative">
                                <select 
                                    className="w-full px-4 py-3 bg-white border-2 border-indigo-200 rounded-xl font-bold text-xs text-indigo-900 outline-none appearance-none"
                                    value={exportTarget}
                                    onChange={(e) => setExportTarget(e.target.value)}
                                >
                                    <option value="ALL">Todo (Todos los Libros)</option>
                                    {books.map(b => (
                                        <option key={b.id} value={b.id}>Libro: {b.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-300 pointer-events-none" size={16}/>
                            </div>
                        </div>

                        <button onClick={() => onExportData(exportTarget)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[11px] shadow-lg hover:bg-indigo-700 transition-all tracking-widest">
                            Generar Descarga
                        </button>
                    </div>

                    {/* SECCIÓN RESTAURAR */}
                    <div className="bg-slate-50 p-10 rounded-[3rem] border border-slate-100 space-y-6 text-center shadow-sm">
                        <div className="mx-auto w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-slate-600 shadow-sm"><HardDriveUpload size={32}/></div>
                        <div className="space-y-1">
                            <h3 className="text-xl font-black text-slate-900 uppercase">Restaurar Copia</h3>
                            <p className="text-xs text-slate-400">Sube un archivo exportado anteriormente</p>
                        </div>
                        
                        <button 
                            onClick={() => backupInputRef.current?.click()} 
                            className={`w-full py-10 bg-white text-slate-900 border-2 border-dashed border-slate-200 rounded-[2rem] font-black uppercase text-[11px] tracking-widest hover:border-indigo-500 hover:text-indigo-600 transition-all flex flex-col items-center justify-center gap-3 ${isProcessingFile ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={isProcessingFile}
                        >
                            {isProcessingFile ? (
                                <>
                                    <Loader2 size={28} className="animate-spin text-indigo-600"/>
                                    <span>Analizando...</span>
                                </>
                            ) : (
                                <>
                                    <FileJson size={28} className="text-slate-300"/>
                                    <span>Seleccionar Archivo .json</span>
                                </>
                            )}
                        </button>
                        <input id="restore-file" type="file" ref={backupInputRef} className="hidden" accept=".json,application/json" onChange={handleFileChange} />
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* MODAL UNIFICADO: CONSOLA DE PROGRESO + SELECCIÓN DE ACCIÓN */}
      {(isProcessingFile || processLogs.length > 0) && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center z-[999] p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-5xl p-8 sm:p-12 relative max-h-[95vh] overflow-y-auto custom-scrollbar">
            {!isProcessingFile && (
                <button onClick={() => { setParsedData(null); setProcessLogs([]); setProcessError(null); }} className="absolute top-8 right-8 p-3 bg-slate-50 text-slate-400 rounded-full hover:text-rose-500 transition-all"><X size={24}/></button>
            )}
            
            <div className="text-center mb-8">
                <div className="mx-auto w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center border border-indigo-100 mb-6 shadow-sm text-indigo-500">
                    {isProcessingFile ? <Loader2 size={40} className="animate-spin" /> : <HardDriveUpload size={40}/>}
                </div>
                <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-2">
                    {parsedData ? 'Copia Lista' : 'Analizando Archivo'}
                </h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                    {fileName}
                </p>
            </div>

            {/* CONSOLA DE LOGS (Siempre visible para depuración) */}
            <div className="max-w-2xl mx-auto bg-slate-50 rounded-[2rem] p-6 mb-10 space-y-3 border border-slate-100">
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-200/50">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registro de Actividad</span>
                    {isProcessingFile && <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest animate-pulse">Procesando...</span>}
                </div>
                
                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                    {processLogs.map((log, i) => (
                        <div key={i} className="flex items-start gap-3 animate-in slide-in-from-left-2">
                            {log.status === 'loading' && <Loader2 size={14} className="animate-spin text-indigo-400 mt-0.5 shrink-0" />}
                            {log.status === 'success' && <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />}
                            {log.status === 'error' && <XCircle size={14} className="text-rose-500 mt-0.5 shrink-0" />}
                            {log.status === 'info' && <FileCheck size={14} className="text-blue-400 mt-0.5 shrink-0" />}
                            <span className={`text-xs font-bold leading-tight ${log.status === 'error' ? 'text-rose-600' : 'text-slate-600'}`}>
                                {log.msg}
                            </span>
                        </div>
                    ))}
                </div>

                {processError && (
                    <div className="mt-4 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold flex flex-col gap-2">
                        <div className="flex items-center gap-2"><AlertTriangle size={16}/> ERROR DETECTADO:</div>
                        <p className="font-mono text-[10px] bg-white/50 p-3 rounded-lg border border-rose-100 select-all">{processError}</p>
                        <button onClick={() => { setProcessLogs([]); setProcessError(null); }} className="mt-2 text-rose-500 underline text-[10px] uppercase font-black tracking-widest hover:text-rose-700 text-center">Cerrar y Reintentar</button>
                    </div>
                )}
            </div>

            {/* OPCIONES DE ACCIÓN - SOLO SI HAY DATOS CARGADOS Y NO HAY ERROR */}
            {parsedData && !isProcessingFile && !processError && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* OPCIÓN 1: LIBRO ACTUAL */}
                    <div className="p-8 bg-slate-50 border border-slate-200 rounded-[2.5rem] flex flex-col group hover:border-indigo-300 transition-all">
                        <BookCopy className="text-indigo-600 mb-4" size={32} />
                        <h4 className="font-black text-slate-800 uppercase text-sm tracking-tight">Sobrescribir Actual</h4>
                        <p className="text-[11px] text-slate-500 mt-2 mb-6 leading-relaxed">
                            Reemplaza todos los datos de tu contabilidad activa: <span className="font-bold text-indigo-600">"{currentBookName}"</span>.
                        </p>
                        <div className="mt-auto p-4 bg-rose-50 rounded-2xl border border-rose-100 mb-6 flex items-start gap-3">
                            <AlertTriangle className="text-rose-500 shrink-0" size={16}/>
                            <p className="text-[9px] font-bold text-rose-600 uppercase leading-tight">Aviso: Se perderán los datos actuales de este libro.</p>
                        </div>
                        <button onClick={() => handleExecuteAction('CURRENT')} className="w-full py-4 bg-white border-2 border-slate-200 text-slate-700 rounded-xl font-black uppercase text-[10px] tracking-widest hover:border-indigo-500 hover:text-indigo-600 transition-all shadow-sm">
                            Restaurar Aquí
                        </button>
                    </div>

                    {/* OPCIÓN 2: OTRO LIBRO */}
                    <div className="p-8 bg-slate-50 border border-slate-200 rounded-[2.5rem] flex flex-col group hover:border-indigo-300 transition-all">
                        <ArrowRightLeft className="text-indigo-600 mb-4" size={32} />
                        <h4 className="font-black text-slate-800 uppercase text-sm tracking-tight">Sobrescribir Otro</h4>
                        <p className="text-[11px] text-slate-500 mt-2 mb-4 leading-relaxed">
                            Elige una contabilidad existente para volcar los datos.
                        </p>
                        
                        <div className="space-y-4 mb-6">
                            <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Selecciona destino</label>
                            <select 
                                className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-[11px] font-bold outline-none focus:border-indigo-500" 
                                value={targetBookId} 
                                onChange={e => setTargetBookId(e.target.value)}
                            >
                                <option value="">Seleccionar...</option>
                                {books.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>

                        <button 
                            onClick={() => handleExecuteAction('OTHER')} 
                            disabled={!targetBookId} 
                            className="mt-auto w-full py-4 bg-white border-2 border-slate-200 text-slate-700 rounded-xl font-black uppercase text-[10px] tracking-widest hover:border-indigo-500 disabled:opacity-50 transition-all shadow-sm"
                        >
                            Reemplazar Libro
                        </button>
                    </div>

                    {/* OPCIÓN 3: NUEVO LIBRO */}
                    <div className="p-8 bg-indigo-50 border border-indigo-100 rounded-[2.5rem] flex flex-col group hover:border-indigo-300 transition-all">
                        <BookPlus className="text-indigo-600 mb-4" size={32} />
                        <h4 className="font-black text-indigo-900 uppercase text-sm tracking-tight">Crear Nuevo Libro</h4>
                        <p className="text-[11px] text-indigo-600/70 mt-2 mb-6 leading-relaxed">
                            Crea una nueva contabilidad independiente con los datos de la copia.
                        </p>
                        
                        <div className="space-y-5 mb-8">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-indigo-400 uppercase ml-1">Nombre del Libro</label>
                                <input 
                                    type="text" 
                                    placeholder="Ej: Mi Backup 2023..." 
                                    className="w-full bg-white border-2 border-indigo-100 rounded-xl px-4 py-3 text-[11px] font-bold outline-none shadow-sm focus:border-indigo-500" 
                                    value={newBookName} 
                                    onChange={e => setNewBookName(e.target.value)} 
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-indigo-400 uppercase ml-1">Color</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {(['BLACK', 'BLUE', 'ROSE', 'EMERALD', 'AMBER', 'VIOLET'] as BookColor[]).map(c => (
                                        <button 
                                            key={c} 
                                            onClick={() => setNewBookColor(c)} 
                                            className={`h-8 rounded-lg border-2 transition-all ${newBookColor === c ? 'border-indigo-600 scale-110' : 'border-white opacity-60'}`}
                                            style={{ backgroundColor: c === 'BLACK' ? '#0f172a' : c === 'BLUE' ? '#2563eb' : c === 'ROSE' ? '#f43f5e' : c === 'EMERALD' ? '#10b981' : c === 'AMBER' ? '#f59e0b' : '#7c3aed' }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={() => handleExecuteAction('NEW')} 
                            disabled={!newBookName.trim()} 
                            className="mt-auto w-full py-4 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-xl"
                        >
                            Crear y Restaurar
                        </button>
                    </div>
                </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
