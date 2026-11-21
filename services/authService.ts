
const TOKEN_KEY = 'auth_token';
const USERNAME_KEY = 'auth_user';
const MOCK_USERS_KEY = 'contamiki_local_users';

const getLocalUsers = () => JSON.parse(localStorage.getItem(MOCK_USERS_KEY) || '[]');
const saveLocalUser = (username, password) => {
    const users = getLocalUsers();
    if (users.find(u => u.username === username)) throw new Error("Usuario ya existe localmente");
    users.push({ username, password });
    localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
};

export const login = async (username, password) => {
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (response.ok) {
            const data = await response.json();
            
            // Si requiere 2FA, retornamos la info especial pero NO guardamos sesión aún
            if (data.requires2fa) {
                return { requires2fa: true, tempToken: data.tempToken };
            }

            setSession(data.token, data.username);
            return data;
        } else {
            const err = await response.json().catch(() => ({ error: 'Error desconocido' }));
            throw new Error(err.error || 'Error al iniciar sesión');
        }
    } catch (err: any) {
        // Fallback agresivo: Si falla la red o el servidor no existe
        const users = getLocalUsers();
        const user = users.find(u => u.username === username && u.password === password);
        if (user) {
            setSession('local_token_' + username, username);
            return { token: 'local_token_' + username, username };
        }
        throw new Error(err.message || "Credenciales inválidas o servidor no disponible.");
    }
};

export const login2FA = async (tempToken: string, code: string) => {
    const response = await fetch('/api/login/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, code })
    });

    if (response.ok) {
        const data = await response.json();
        setSession(data.token, data.username);
        return data;
    } else {
        const err = await response.json();
        throw new Error(err.error || "Código incorrecto");
    }
};

export const register = async (username, password) => {
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (response.ok) return await response.json();
        const err = await response.json().catch(() => ({ error: 'Error de red' }));
        throw new Error(err.error || 'Error al registrarse');
    } catch (err: any) {
        // Fallback local solo si es error de conexión, no si el servidor rechaza el email
        if (err.message === 'Error de red' || err.message.includes('fetch')) {
             try {
                saveLocalUser(username, password);
                return { success: true, message: "Registrado localmente (Sin verificación)" };
            } catch (localErr: any) {
                throw new Error(localErr.message);
            }
        }
        throw err;
    }
};

export const resendVerification = async (username: string) => {
    const response = await fetch('/api/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error);
    }
    return true;
};

export const verifyEmail = async (token: string) => {
    const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error);
    }
    return await response.json();
};

export const requestPasswordReset = async (email: string) => {
     const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    });
    if (!response.ok) throw new Error("Error al solicitar reset");
    return true;
};

export const resetPassword = async (token: string, newPassword: string) => {
    const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error);
    }
    return true;
};

export const loginAsGuest = () => {
    const guestName = 'Invitado_' + Math.floor(Math.random() * 1000);
    setSession('guest_token_session', guestName);
    return { token: 'guest_token_session', username: guestName };
};

const setSession = (token, username) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USERNAME_KEY, username);
}

export const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
    window.location.reload();
};

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const getUsername = () => localStorage.getItem(USERNAME_KEY);
export const isAuthenticated = () => !!localStorage.getItem(TOKEN_KEY);

export const changePassword = async (currentPassword, newPassword) => {
    const token = getToken();
    try {
        const response = await fetch('/api/change-password', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ currentPassword, newPassword })
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || "Error al cambiar contraseña");
        }
        return { success: true };
    } catch (e) {
        if (token?.startsWith('local_')) {
             const user = getUsername();
             const users = getLocalUsers();
             const updated = users.map(u => u.username === user ? { ...u, password: newPassword } : u);
             localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(updated));
             return { success: true };
        }
        throw e;
    }
};

export const deleteAccount = async () => {
    const token = getToken();
    try {
        const response = await fetch('/api/delete-account', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || "Error al eliminar cuenta");
        }
        
        logout(); // Limpiar localstorage y recargar
        return { success: true };
    } catch (e) {
        if (token?.startsWith('local_')) {
             const user = getUsername();
             const users = getLocalUsers();
             const updated = users.filter(u => u.username !== user);
             localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(updated));
             logout();
             return { success: true };
        }
        throw e;
    }
};

// 2FA METHODS

export const get2FAStatus = async () => {
    const token = getToken();
    if (token?.startsWith('local_') || token?.startsWith('guest_')) return { enabled: false };
    const res = await fetch('/api/2fa/status', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return await res.json();
};

export const setup2FA = async () => {
    const token = getToken();
    const res = await fetch('/api/2fa/setup', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Error iniciando 2FA");
    return await res.json(); // { secret, qrCode }
};

export const verifySetup2FA = async (code: string) => {
    const token = getToken();
    const res = await fetch('/api/2fa/verify-setup', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ token: code })
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Código inválido");
    }
    return true;
};

export const disable2FA = async () => {
    const token = getToken();
    const res = await fetch('/api/2fa/disable', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Error desactivando 2FA");
    return true;
};

export const acceptInvite = async (token: string, password?: string, username?: string) => {
    const response = await fetch('/api/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, username })
    });
    
    if (response.ok) {
        const data = await response.json();
        if (data.token) {
            setSession(data.token, data.username);
        }
        return data;
    } else {
        const err = await response.json();
        throw new Error(err.error || "Error al aceptar invitación");
    }
};

export const testEmail = async () => {
    const token = getToken();
    const res = await fetch('/api/test-email', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error enviando email de prueba");
    }
    return true;
};

export const inviteUser = async (email: string, bookId: string) => {
    const token = getToken();
    const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email, bookId })
    });
    
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error enviando invitación");
    }
    return await res.json();
};

export const getCollaborators = async (bookId: string) => {
    const token = getToken();
    const res = await fetch(`/api/book/${bookId}/collaborators`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Error al obtener colaboradores");
    return await res.json();
};

export const revokeCollaborator = async (bookId: string, userId: string) => {
    const token = getToken();
    const res = await fetch(`/api/book/${bookId}/collaborators/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Error al revocar acceso");
    return await res.json();
};

export const cancelInvitation = async (bookId: string, email: string) => {
    const token = getToken();
    const res = await fetch(`/api/book/${bookId}/invitations/${email}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Error al cancelar invitación");
    return await res.json();
};

export const getAutoBackups = async (bookId: string) => {
    const token = getToken();
    const res = await fetch(`/api/book/${bookId}/backups`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Error al obtener copias automáticas");
    return await res.json();
};

export const restoreAutoBackup = async (bookId: string, filename: string) => {
    const token = getToken();
    const res = await fetch(`/api/book/${bookId}/backups/${filename}/restore`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al restaurar copia automática");
    }
    return await res.json();
};

export const deleteBook = async (bookId: string) => {
    const token = getToken();
    const res = await fetch(`/api/book/${bookId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al eliminar la contabilidad");
    }
    return await res.json();
};

// CLAVES DE ACCESO (PASSKEYS / WEBAUTHN): huella, Face ID o PIN del dispositivo, sin contraseña ni código del autenticador

const b64uABuf = (s: string): ArrayBuffer => {
    const b = atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '='));
    const u = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    return u.buffer;
};
const bufAB64u = (buf: ArrayBuffer): string => {
    let s = '';
    new Uint8Array(buf).forEach(x => { s += String.fromCharCode(x); });
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const passkeysSupported = () =>
    typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials && window.isSecureContext;

// Este dispositivo tiene una clave de acceso de la app: al abrir el acceso se pide Face ID / huella directamente
const PASSKEY_DEVICE_KEY = 'contamiki_passkey_device';
export const deviceHasPasskey = () => { try { return localStorage.getItem(PASSKEY_DEVICE_KEY) === '1'; } catch { return false; } };
const marcarDispositivo = (si: boolean, id?: string) => { try { si ? localStorage.setItem(PASSKEY_DEVICE_KEY, id || '1') : localStorage.removeItem(PASSKEY_DEVICE_KEY); } catch { /* sin almacenamiento */ } };
// Id de la clave de este dispositivo (null si no se conoce: dispositivos activados antes de guardarlo)
export const devicePasskeyId = (): string | null => { try { const v = localStorage.getItem(PASSKEY_DEVICE_KEY); return v && v !== '1' ? v : null; } catch { return null; } };
export const forgetDevicePasskey = () => marcarDispositivo(false);

// Nombre automático del dispositivo para la clave («iPhone · Safari»): el usuario no tiene que escribirlo
export const deviceName = () => {
    const ua = navigator.userAgent || '';
    const tactil = (navigator.maxTouchPoints || 0) > 1;
    const equipo = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) || (/Macintosh/.test(ua) && tactil) ? 'iPad' : /Android/.test(ua) ? 'Android'
        : /Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Dispositivo';
    const nav = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /Chrome|CriOS/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : '';
    return nav ? equipo + ' · ' + nav : equipo;
};

const mensajeWebAuthn = (err: any) => {
    const e: any = new Error(
        err?.name === 'NotAllowedError' ? 'Operación cancelada o sin tiempo.' :
        err?.name === 'InvalidStateError' ? 'Esta clave ya está registrada en este dispositivo.' :
        err?.message || 'No se pudo usar la clave de acceso.');
    e.cancelado = err?.name === 'NotAllowedError';
    e.yaRegistrada = err?.name === 'InvalidStateError';
    e.noReconocida = /no reconocida/i.test(err?.message || '');
    return e;
};

// Pide al servidor el reto de la clave de acceso. Se hace ANTES del toque del usuario para poder lanzar Face ID dentro del propio toque
// (Safari solo se salta su cuadro de confirmación «¿Iniciar sesión…?» si Face ID se pide justo tras un gesto del usuario).
export const prepararPasskey = async () => {
    const r = await fetch('/api/passkeys/login/options', { method: 'POST' });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'No se pudo iniciar el acceso con clave');
    return await r.json() as { options: any; challengeId: string };
};

// prep: reto ya pedido con prepararPasskey(); con él no hay ninguna espera antes de navigator.credentials.get (se conserva el gesto del usuario)
export const loginWithPasskey = async (prep?: { options: any; challengeId: string }) => {
    try {
        const { options, challengeId } = prep || await prepararPasskey();
        const cred: any = await navigator.credentials.get({
            publicKey: {
                challenge: b64uABuf(options.challenge),
                rpId: options.rpId,
                timeout: options.timeout,
                userVerification: 'required',
            },
        });
        if (!cred) throw new Error('Operación cancelada.');
        const response = {
            id: cred.id,
            rawId: bufAB64u(cred.rawId),
            type: cred.type,
            clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {},
            response: {
                clientDataJSON: bufAB64u(cred.response.clientDataJSON),
                authenticatorData: bufAB64u(cred.response.authenticatorData),
                signature: bufAB64u(cred.response.signature),
                userHandle: cred.response.userHandle ? bufAB64u(cred.response.userHandle) : undefined,
            },
        };
        const v = await fetch('/api/passkeys/login/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ challengeId, response }),
        });
        const data = await v.json().catch(() => ({}));
        if (!v.ok) throw new Error(data.error || 'No se pudo verificar la clave');
        setSession(data.token, data.username);
        marcarDispositivo(true, cred.id);
        return data;
    } catch (err: any) {
        const e = mensajeWebAuthn(err);
        if (e.noReconocida) marcarDispositivo(false);   // la clave de este dispositivo ya no existe: se vuelve al acceso normal
        throw e;
    }
};

export const listPasskeys = async (): Promise<{ id: string; name: string; createdAt: string; lastUsed: string | null }[]> => {
    const token = getToken();
    if (token?.startsWith('local_') || token?.startsWith('guest_')) return [];
    const res = await fetch('/api/passkeys', { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) return [];
    return (await res.json()).passkeys || [];
};

export const registerPasskey = async (name: string) => {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
    try {
        const r = await fetch('/api/passkeys/register/options', { method: 'POST', headers });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'No se pudo iniciar el registro');
        const o = await r.json();
        const cred: any = await navigator.credentials.create({
            publicKey: {
                challenge: b64uABuf(o.challenge),
                rp: o.rp,
                user: { id: b64uABuf(o.user.id), name: o.user.name, displayName: o.user.displayName || o.user.name },
                pubKeyCredParams: o.pubKeyCredParams,
                timeout: o.timeout,
                attestation: 'none',
                excludeCredentials: (o.excludeCredentials || []).map((c: any) => ({ id: b64uABuf(c.id), type: 'public-key', transports: c.transports })),
                authenticatorSelection: o.authenticatorSelection,
            },
        });
        if (!cred) throw new Error('Operación cancelada.');
        const response = {
            id: cred.id,
            rawId: bufAB64u(cred.rawId),
            type: cred.type,
            clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {},
            response: {
                clientDataJSON: bufAB64u(cred.response.clientDataJSON),
                attestationObject: bufAB64u(cred.response.attestationObject),
                transports: cred.response.getTransports ? cred.response.getTransports() : [],
            },
        };
        const v = await fetch('/api/passkeys/register/verify', { method: 'POST', headers, body: JSON.stringify({ name, response }) });
        if (!v.ok) throw new Error((await v.json().catch(() => ({}))).error || 'No se pudo registrar la clave');
        marcarDispositivo(true, cred.id);
        return true;
    } catch (err: any) {
        const e = mensajeWebAuthn(err);
        if (e.yaRegistrada) { marcarDispositivo(true); return true; }   // este dispositivo ya tenía la clave (sincronizada): vale como activado
        throw e;
    }
};

export const deletePasskey = async (id: string) => {
    const token = getToken();
    const res = await fetch('/api/passkeys/' + encodeURIComponent(id), { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'No se pudo eliminar la clave');
    return true;
};
