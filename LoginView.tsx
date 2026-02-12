
import React, { useState, useEffect, useMemo } from 'react';
import { login, register, loginAsGuest, verifyEmail, requestPasswordReset, resetPassword } from './services/authService';
import { Wallet, Lock, User, UserPlus, LogIn, AlertCircle, Sparkles, Check, XCircle, CheckCircle2, Mail, ArrowLeft, KeyRound } from 'lucide-react';

interface LoginViewProps {
    onLoginSuccess: () => void;
}

type AuthMode = 'LOGIN' | 'REGISTER' | 'FORGOT' | 'RESET_PASSWORD';

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
    const [mode, setMode] = useState<AuthMode>('LOGIN');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);
    const [customLogo, setCustomLogo] = useState<string | null>(localStorage.getItem('contamiki_custom_logo'));
    const [resetToken, setResetToken] = useState<string | null>(null);

    // Detección de parámetros URL (Verificación / Reset)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const action = params.get('action');
        const token = params.get('token');

        if (action === 'verify' && token) {
            setLoading(true);
            verifyEmail(token)
                .then(() => setSuccessMsg("¡Cuenta verificada! Ya puedes iniciar sesión."))
                .catch(err => setError("Error verificando cuenta: " + err.message))
                .finally(() => {
                    setLoading(false);
                    // Limpiar URL
                    window.history.replaceState({}, document.title, "/");
                });
        } else if (action === 'reset' && token) {
            setMode('RESET_PASSWORD');
            setResetToken(token);
        }
    }, []);

    useEffect(() => {
        const handleLogoChange = () => {
            setCustomLogo(localStorage.getItem('contamiki_custom_logo'));
        };
        window.addEventListener('contamiki_logo_changed', handleLogoChange);
        return () => window.removeEventListener('contamiki_logo_changed', handleLogoChange);
    }, []);

    const validateEmail = (email: string) => {
        return String(email)
          .toLowerCase()
          .match(
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
          );
    };

    // Password Security Logic
    const passwordRequirements = useMemo(() => [
        { id: 'len', label: '8+ Caracteres', valid: password.length >= 8 },
        { id: 'num', label: '1+ Número', valid: /\d/.test(password) },
        { id: 'up', label: '1+ Mayúscula', valid: /[A-Z]/.test(password) },
    ], [password]);

    const isPasswordStrong = passwordRequirements.every(r => r.valid);
    const doPasswordsMatch = password === confirmPassword;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        
        // Validar formato email siempre
        if (!validateEmail(email)) {
            setError("Por favor introduce un email válido.");
            return;
        }

        if ((mode === 'REGISTER' || mode === 'RESET_PASSWORD')) {
            if (!isPasswordStrong) {
                setError('La contraseña no cumple los requisitos de seguridad.');
                return;
            }
            if (!doPasswordsMatch) {
                setError('Las contraseñas no coinciden.');
                return;
            }
        }

        setLoading(true);

        try {
            if (mode === 'LOGIN') {
                await login(email, password);
                onLoginSuccess();
            } else if (mode === 'REGISTER') {
                await register(email, password);
                setSuccessMsg('Te hemos enviado un correo de verificación. Revisa tu bandeja de entrada (o la consola del servidor si estás en local).');
                setMode('LOGIN');
                setPassword('');
                setConfirmPassword('');
            } else if (mode === 'FORGOT') {
                await requestPasswordReset(email);
                setSuccessMsg('Si el email existe, recibirás instrucciones para resetear la contraseña (mira la consola server si estás en local).');
                setMode('LOGIN');
            } else if (mode === 'RESET_PASSWORD' && resetToken) {
                await resetPassword(resetToken, password);
                setSuccessMsg('Contraseña actualizada. Inicia sesión.');
                setMode('LOGIN');
                setResetToken(null);
                setPassword('');
                window.history.replaceState({}, document.title, "/");
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGuestAccess = () => {
        loginAsGuest();
        onLoginSuccess();
    };

    const resetState = (newMode: AuthMode) => {
        setMode(newMode);
        setError('');
        setSuccessMsg('');
        setPassword('');
        setConfirmPassword('');
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 md:p-10 font-sans">
            <div className="bg-white rounded-[2.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.06)] w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col">
                <div className="bg-slate-950 p-10 sm:p-12 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-indigo-600/10 mix-blend-overlay"></div>
                    <div className="relative z-10">
                        <img 
                            src={customLogo || "/contamiki.jpg"} 
                            className="mx-auto w-32 h-32 mb-6 drop-shadow-2xl animate-in zoom-in duration-700 hover:scale-105 transition-transform rounded-3xl shadow-xl object-cover border-4 border-white/10 bg-white"
                            alt="ContaMiki Logo"
                            onError={(e) => {
                                if (customLogo) return;
                                const target = e.currentTarget;
                                const src = target.src;
                                if (src.endsWith('/contamiki.jpg')) target.src = '/ContaMiki.jpg';
                                else if (src.endsWith('/ContaMiki.jpg')) target.src = '/contamiki.png';
                                else if (src.endsWith('/contamiki.png')) target.src = '/logo.jpg';
                                else target.src = "https://cdn-icons-png.flaticon.com/512/2910/2910296.png";
                            }}
                        />
                        <h1 className="text-3xl font-black text-white tracking-tighter">ContaMiki</h1>
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em] mt-3">Soberanía Financiera</p>
                    </div>
                </div>
                
                {mode !== 'RESET_PASSWORD' && mode !== 'FORGOT' && (
                    <div className="flex bg-slate-50 p-1.5 mx-10 mt-8 rounded-2xl border border-slate-100">
                        <button 
                            className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all rounded-xl ${mode === 'LOGIN' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400'}`}
                            onClick={() => resetState('LOGIN')}
                        >
                            Acceso
                        </button>
                        <button 
                            className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all rounded-xl ${mode === 'REGISTER' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400'}`}
                            onClick={() => resetState('REGISTER')}
                        >
                            Registro
                        </button>
                    </div>
                )}

                <div className="p-10 sm:p-12 space-y-8">
                    {mode === 'FORGOT' && (
                        <div className="text-center mb-4">
                            <h3 className="text-lg font-black text-slate-900 uppercase">Recuperar Acceso</h3>
                            <p className="text-xs text-slate-500 mt-1">Introduce tu email para recibir un enlace de recuperación.</p>
                        </div>
                    )}
                    {mode === 'RESET_PASSWORD' && (
                         <div className="text-center mb-4">
                            <h3 className="text-lg font-black text-slate-900 uppercase">Nueva Contraseña</h3>
                            <p className="text-xs text-slate-500 mt-1">Introduce tu nueva clave segura.</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl text-[10px] font-bold text-center border border-rose-100 flex items-center justify-center gap-2 animate-in slide-in-from-top-2">
                                <AlertCircle size={14} /> {error}
                            </div>
                        )}
                        {successMsg && (
                            <div className="bg-emerald-50 text-emerald-600 p-4 rounded-2xl text-[10px] font-bold text-center border border-emerald-100 flex items-center justify-center gap-2 animate-in slide-in-from-top-2">
                                <CheckCircle2 size={14} /> {successMsg}
                            </div>
                        )}
                        
                        {mode !== 'RESET_PASSWORD' && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                                <div className="relative group">
                                    <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                    <input 
                                        type="email" 
                                        required
                                        autoComplete="email"
                                        className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-transparent rounded-2xl focus:outline-none focus:bg-white focus:border-indigo-500 transition-all font-bold text-slate-800"
                                        placeholder="usuario@email.com"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}

                        {mode !== 'FORGOT' && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex justify-between">
                                    <span>Contraseña</span>
                                    {(mode === 'REGISTER' || mode === 'RESET_PASSWORD') && (
                                        <span className={`transition-colors ${isPasswordStrong ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            {isPasswordStrong ? 'Fuerte' : 'Débil'}
                                        </span>
                                    )}
                                </label>
                                <div className="relative group">
                                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                    <input 
                                        type="password" 
                                        required
                                        autoComplete={mode === 'LOGIN' ? "current-password" : "new-password"}
                                        className={`w-full pl-14 pr-6 py-5 bg-slate-50 border-2 rounded-2xl focus:outline-none focus:bg-white transition-all font-bold text-slate-800 ${(mode === 'REGISTER' || mode === 'RESET_PASSWORD') && !isPasswordStrong && password.length > 0 ? 'border-rose-100 focus:border-rose-300' : 'border-transparent focus:border-indigo-500'}`}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                    />
                                </div>
                                
                                {(mode === 'REGISTER' || mode === 'RESET_PASSWORD') && (
                                    <div className="flex flex-wrap gap-2 pt-2 animate-in slide-in-from-top-1">
                                        {passwordRequirements.map(req => (
                                            <div key={req.id} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase border transition-all ${req.valid ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                                {req.valid ? <Check size={10} strokeWidth={4}/> : <div className="w-2.5 h-2.5 rounded-full bg-slate-200"></div>}
                                                {req.label}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {(mode === 'REGISTER' || mode === 'RESET_PASSWORD') && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirmar Contraseña</label>
                                <div className="relative group">
                                    <Lock className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors ${confirmPassword && !doPasswordsMatch ? 'text-rose-400' : 'text-slate-300 group-focus-within:text-indigo-500'}`} size={20} />
                                    <input 
                                        type="password" 
                                        required
                                        autoComplete="new-password"
                                        className={`w-full pl-14 pr-6 py-5 bg-slate-50 border-2 rounded-2xl focus:outline-none focus:bg-white transition-all font-bold text-slate-800 ${confirmPassword && !doPasswordsMatch ? 'border-rose-200 focus:border-rose-400' : 'border-transparent focus:border-indigo-500'}`}
                                        placeholder="Repite la contraseña"
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                    />
                                    {confirmPassword && (
                                        <div className="absolute right-5 top-1/2 -translate-y-1/2">
                                            {doPasswordsMatch ? <CheckCircle2 className="text-emerald-500" size={20}/> : <XCircle className="text-rose-500" size={20}/>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={loading || ((mode === 'REGISTER' || mode === 'RESET_PASSWORD') && (!isPasswordStrong || !doPasswordsMatch))}
                            className="w-full bg-slate-950 text-white py-6 rounded-2xl font-black uppercase tracking-[0.3em] text-[10px] hover:bg-indigo-600 transition-all shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-3 mt-4"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    {mode === 'LOGIN' && <><LogIn size={18} /> Desbloquear</>}
                                    {mode === 'REGISTER' && <><UserPlus size={18} /> Registrarse</>}
                                    {mode === 'FORGOT' && <><Mail size={18} /> Enviar Enlace</>}
                                    {mode === 'RESET_PASSWORD' && <><KeyRound size={18} /> Cambiar Clave</>}
                                </>
                            )}
                        </button>
                    </form>
                    
                    {/* Botones Auxiliares */}
                    <div className="space-y-4">
                        {mode === 'LOGIN' && (
                             <button onClick={() => resetState('FORGOT')} className="w-full text-center text-[9px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-colors">
                                ¿Olvidaste tu contraseña?
                            </button>
                        )}
                        {(mode === 'FORGOT' || mode === 'RESET_PASSWORD') && (
                            <button onClick={() => resetState('LOGIN')} className="w-full text-center text-[9px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
                                <ArrowLeft size={12}/> Volver al Login
                            </button>
                        )}
                    </div>

                    {mode === 'LOGIN' && (
                        <>
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                                <div className="relative flex justify-center text-[8px] font-black uppercase tracking-[0.4em] text-slate-300">
                                    <span className="bg-white px-4">O bien</span>
                                </div>
                            </div>

                            <button 
                                onClick={handleGuestAccess}
                                className="w-full py-5 bg-indigo-50 text-indigo-600 rounded-2xl font-black uppercase tracking-widest text-[9px] hover:bg-indigo-100 transition-all flex items-center justify-center gap-2 group"
                            >
                                <Sparkles size={16} className="group-hover:animate-pulse" /> 
                                Entrar en Modo Demo (Local)
                            </button>
                        </>
                    )}
                    
                    <p className="text-center text-slate-300 text-[9px] font-bold uppercase tracking-widest mt-4">
                        Sistema Seguro v1.4.0
                    </p>
                </div>
            </div>
        </div>
    );
};
