
import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Configs
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_master_key_conta_miki';

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// Initialize System Files
const initSystem = async () => {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      await fs.access(USERS_FILE);
    } catch {
      await fs.writeFile(USERS_FILE, JSON.stringify([]));
    }
  } catch (err) {
    console.error("Error initializing storage:", err);
  }
};

initSystem();

// Helper: Get user-specific data file
const getUserDataFile = (username) => {
    const safeUsername = username.replace(/[^a-zA-Z0-9_-]/g, '');
    return path.join(DATA_DIR, `data_${safeUsername}.json`);
};

// Helper: Read users
const readUsers = async () => {
    try {
        const content = await fs.readFile(USERS_FILE, 'utf-8');
        return JSON.parse(content);
    } catch {
        return [];
    }
};

// --- Auth Middleware (REAL SECURITY) ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: "No autorizado" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Token inválido o expirado" });
    req.user = user;
    next();
  });
};

// --- Routes ---

// 1. Register User
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Usuario y contraseña requeridos" });

    try {
        const users = await readUsers();
        if (users.find(u => u.username === username)) {
            return res.status(400).json({ error: "El usuario ya existe" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        users.push({ username, password: hashedPassword });
        await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));

        res.json({ success: true, message: "Usuario registrado correctamente" });
    } catch (err) {
        res.status(500).json({ error: "Error en el servidor al registrar" });
    }
});

// 2. Login User
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const users = await readUsers();
        const user = users.find(u => u.username === username);

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: "Credenciales inválidas" });
        }

        const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ token, username: user.username });
    } catch (err) {
        res.status(500).json({ error: "Error en el servidor al iniciar sesión" });
    }
});

// 3. Data Routes
app.get('/api/data', authenticateToken, async (req, res) => {
  try {
    const username = req.user.username;
    const userFile = getUserDataFile(username);
    
    try {
        const data = await fs.readFile(userFile, 'utf-8');
        res.json(JSON.parse(data));
    } catch (err) {
        // Si el archivo no existe, enviamos un estado inicial vacío
        res.json({});
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error leyendo datos del usuario" });
  }
});

app.post('/api/data', authenticateToken, async (req, res) => {
  try {
    const username = req.user.username;
    const userFile = getUserDataFile(username);
    await fs.writeFile(userFile, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error guardando datos del usuario" });
  }
});

app.post('/api/change-password', authenticateToken, async (req, res) => {
    const { newPassword } = req.body;
    const username = req.user.username;
    try {
        const users = await readUsers();
        const userIndex = users.findIndex(u => u.username === username);
        if (userIndex === -1) return res.status(404).json({ error: "Usuario no encontrado" });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        users[userIndex].password = hashedPassword;
        await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
        res.json({ success: true, message: "Contraseña actualizada" });
    } catch (err) {
        res.status(500).json({ error: "Error actualizando contraseña" });
    }
});

// Private Config for Gemini
app.get('/api/config', authenticateToken, (req, res) => {
    res.json({ 
        apiKey: process.env.API_KEY || '' 
    });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`ContaMiki Server running on port ${PORT}`);
});
