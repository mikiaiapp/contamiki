import React, { useState } from 'react';
import { login, register } from '../services/authService';
import { Wallet, Lock, User, UserPlus, LogIn } from 'lucide-react';

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
                setSuccessMsg('Registro exitoso. Ahora puedes iniciar sesión.');
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
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="bg-emerald-600 p-8 text-center">
                    <div className="mx-auto bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mb-4 backdrop-blur-sm">
                        <Wallet className="text-white" size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-white">ContaMiki</h1>
                    <p className="text-emerald-100 mt-2">
                        {mode === 'LOGIN' ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}
                    </p>
                </div>
                
                {/* Tabs */}
                <div className="flex border-b border-slate-100">
                    <button 
                        className={`flex-1 py-4 text-sm font-medium transition-colors ${mode === 'LOGIN' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
                        onClick={() => { setMode('LOGIN'); setError(''); setSuccessMsg(''); }}
                    >
                        Iniciar Sesión
                    </button>
                    <button 
                        className={`flex-1 py-4 text-sm font-medium transition-colors ${mode === 'REGISTER' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
                        onClick={() => { setMode('REGISTER'); setError(''); setSuccessMsg(''); }}
                    >
                        Registrarse
                    </button>
                </div>

                <div className="p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center border border-red-100">
                                {error}
                            </div>
                        )}
                        {successMsg && (
                            <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm text-center border border-green-100">
                                {successMsg}
                            </div>
                        )}
                        
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-600 ml-1">Usuario / Email</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input 
                                    type="text" 
                                    required
                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                                    placeholder="ejemplo@correo.com"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-600 ml-1">Contraseña</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input 
                                    type="password" 
                                    required
                                    minLength={4}
                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full bg-slate-900 text-white py-3 rounded-lg font-medium hover:bg-slate-800 transition-colors shadow-lg disabled:opacity-70 flex justify-center items-center gap-2"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    {mode === 'LOGIN' ? <LogIn size={18} /> : <UserPlus size={18} />}
                                    {mode === 'LOGIN' ? 'Entrar' : 'Crear Cuenta'}
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};