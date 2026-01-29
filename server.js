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
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_fallback_key_change_me';

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// Initialize
const initSystem = async () => {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    // Init Users file if needed (skipped logic for brevity in preview)
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

// --- Auth Middleware (PREVIEW MODE: DISABLED/BYPASSED) ---
const authenticateToken = (req, res, next) => {
  // En modo preview, asignamos siempre un usuario "demo"
  // Si quieres reactivar la seguridad, descomenta el bloque de abajo y borra la línea de req.user
  req.user = { username: 'preview_user' };
  next();

  /* 
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
  */
};

// --- Routes ---

// 1. Register (Mock for preview)
app.post('/api/register', async (req, res) => {
    res.json({ success: true, message: "Registro simulado en modo preview" });
});

// 2. Login Standard (Mock for preview)
app.post('/api/login', async (req, res) => {
    // Retornamos un token falso que el cliente guardará, pero el servidor ignorará (usando req.user forzado)
    const token = jwt.sign({ username: 'preview_user' }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, username: 'preview_user' });
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
        res.json({});
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error reading user data" });
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
    res.status(500).json({ error: "Error saving user data" });
  }
});

app.post('/api/change-password', authenticateToken, async (req, res) => {
    res.json({success: true, message: "Simulado en preview"});
});

// Private Config
app.get('/api/config', authenticateToken, (req, res) => {
    res.json({ 
        apiKey: process.env.API_KEY || '' 
    });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});