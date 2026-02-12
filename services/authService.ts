
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

export const changePassword = async (newPassword) => {
    const token = getToken();
    try {
        const response = await fetch('/api/change-password', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ newPassword })
        });
        if(!response.ok) throw new Error("Error servidor");
        return await response.json();
    } catch (e) {
        const user = getUsername();
        const users = getLocalUsers();
        const updated = users.map(u => u.username === user ? { ...u, password: newPassword } : u);
        localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(updated));
        return { success: true };
    }
};
