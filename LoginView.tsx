
import React, { useState } from 'react';
import { login, register } from './services/authService';
import { Wallet, Lock, User, UserPlus, LogIn, AlertCircle } from 'lucide-react';

interface LoginViewProps {
    onLoginSuccess: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
    const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);

        try {
            if (mode === 'LOGIN') {
                await login(username, password);
                onLoginSuccess();
            } else {
                await register(username, password);
                setSuccessMsg('Registro completado. Ya puedes entrar.');
                setMode('LOGIN');
                setPassword('');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 md:p-10 font-sans">
            <div className="bg-white rounded-[2.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.06)] w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col">
                <div className="bg-slate-950 p-10 sm:p-12 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-indigo-600/10 mix-blend-overlay"></div>
                    <div className="relative z-10">
                        <div className="mx-auto bg-indigo-600 w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-indigo-600/30 rotate-3">
                            <Wallet className="text-white" size={36} />
                        </div>
                        <h1 className="text-3xl font-black text-white tracking-tighter">ContaMiki</h1>
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em] mt-3">Soberanía Financiera</p>
                    </div>
                </div>
                
                <div className="flex bg-slate-50 p-1.5 mx-10 mt-8 rounded-2xl border border-slate-100">
                    <button 
                        className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all rounded-xl ${mode === 'LOGIN' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400'}`}
                        onClick={() => { setMode('LOGIN'); setError(''); setSuccessMsg(''); }}
                    >
                        Acceso
                    </button>
                    <button 
                        className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all rounded-xl ${mode === 'REGISTER' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400'}`}
                        onClick={() => { setMode('REGISTER'); setError(''); setSuccessMsg(''); }}
                    >
                        Registro
                    </button>
                </div>

                <div className="p-10 sm:p-12">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl text-[10px] font-bold text-center border border-rose-100 flex items-center justify-center gap-2 animate-in slide-in-from-top-2">
                                <AlertCircle size={14} /> {error}
                            </div>
                        )}
                        {successMsg && (
                            <div className="bg-emerald-50 text-emerald-600 p-4 rounded-2xl text-[10px] font-bold text-center border border-emerald-100 flex items-center justify-center gap-2 animate-in slide-in-from-top-2">
                                {successMsg}
                            </div>
                        )}
                        
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Identificador</label>
                            <div className="relative group">
                                <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                <input 
                                    type="text" 
                                    required
                                    autoComplete="username"
                                    className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-transparent rounded-2xl focus:outline-none focus:bg-white focus:border-indigo-500 transition-all font-bold text-slate-800"
                                    placeholder="Nombre de usuario"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Clave Privada</label>
                            <div className="relative group">
                                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                <input 
                                    type="password" 
                                    required
                                    autoComplete="current-password"
                                    minLength={4}
                                    className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-transparent rounded-2xl focus:outline-none focus:bg-white focus:border-indigo-500 transition-all font-bold text-slate-800"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full bg-slate-950 text-white py-6 rounded-2xl font-black uppercase tracking-[0.3em] text-[10px] hover:bg-indigo-600 transition-all shadow-xl active:scale-95 disabled:opacity-50 flex justify-center items-center gap-3 mt-4"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    {mode === 'LOGIN' ? <LogIn size={18} /> : <UserPlus size={18} />}
                                    {mode === 'LOGIN' ? 'Desbloquear Panel' : 'Crear Identidad'}
                                </>
                            )}
                        </button>
                    </form>
                    
                    <p className="text-center text-slate-300 text-[9px] font-bold uppercase tracking-widest mt-12">
                        Sistema Seguro v1.3.0
                    </p>
                </div>
            </div>
        </div>
    );
};
