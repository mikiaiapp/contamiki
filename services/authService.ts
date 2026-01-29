const TOKEN_KEY = 'auth_token';
const USERNAME_KEY = 'auth_user';

export const login = async (username, password) => {
    const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Error al iniciar sesión');
    }

    const data = await response.json();
    setSession(data.token, data.username);
    return data;
};

export const register = async (username, password) => {
    const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Error al registrarse');
    }
    return await response.json();
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

export const getToken = () => {
    return localStorage.getItem(TOKEN_KEY);
};

export const getUsername = () => {
    return localStorage.getItem(USERNAME_KEY);
};

export const isAuthenticated = () => {
    return !!localStorage.getItem(TOKEN_KEY);
};

export const changePassword = async (newPassword) => {
    const token = getToken();
    const response = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword })
    });
    
    if(!response.ok) throw new Error("Error cambiando contraseña");
    return await response.json();
};