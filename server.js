
import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

// Configs
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_master_key_conta_miki';

// DEFINICIÓN DE DIRECTORIO DE DATOS ROBUSTA
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

console.log(`ContaMiki Server: Storage path set to: ${DATA_DIR}`);

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
    console.error("CRITICAL: Error initializing storage:", err);
  }
};

initSystem();

const getUserDataFile = (username) => {
    const safeUsername = username.replace(/[^a-zA-Z0-9_-]/g, '');
    return path.join(DATA_DIR, `data_${safeUsername}.json`);
};

const readUsers = async () => {
    try {
        const content = await fs.readFile(USERS_FILE, 'utf-8');
        return JSON.parse(content);
    } catch {
        return [];
    }
};

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: "No autorizado" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Token inválido" });
    req.user = user;
    next();
  });
};

// --- Routes ---

app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Datos incompletos" });
    try {
        const users = await readUsers();
        if (users.find(u => u.username === username)) return res.status(400).json({ error: "Usuario duplicado" });
        const hashedPassword = await bcrypt.hash(password, 10);
        users.push({ username, password: hashedPassword });
        await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Error server" }); }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const users = await readUsers();
        const user = users.find(u => u.username === username);
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: "Credenciales inválidas" });
        const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ token, username: user.username });
    } catch (err) { res.status(500).json({ error: "Error server" }); }
});

app.get('/api/data', authenticateToken, async (req, res) => {
    try {
        const userFile = getUserDataFile(req.user.username);
        const data = await fs.readFile(userFile, 'utf-8');
        res.json(JSON.parse(data));
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.log(`New user data file initialized for: ${req.user.username}`);
            res.json({}); 
        } else {
            console.error(`ERROR READING DATA for ${req.user.username}:`, err);
            res.status(500).json({ error: "Storage access error. Please contact admin." });
        }
    }
});

app.post('/api/data', authenticateToken, async (req, res) => {
    try {
        const userFile = getUserDataFile(req.user.username);
        // ESCRITURA ATÓMICA: Escribir en .tmp y luego renombrar.
        // Esto evita archivos corruptos si el contenedor muere durante la escritura.
        const tempFile = `${userFile}.tmp`;
        
        await fs.writeFile(tempFile, JSON.stringify(req.body, null, 2));
        await fs.rename(tempFile, userFile);
        
        res.json({ success: true });
    } catch (err) { 
        console.error(`ERROR SAVING DATA for ${req.user.username}:`, err);
        res.status(500).json({ error: "Error save" }); 
    }
});

app.get('/api/config', authenticateToken, (req, res) => {
    res.json({ apiKey: process.env.API_KEY || '' });
});

app.get('*', (req, res) => {
    if (req.path.includes('.')) {
        return res.status(404).send('Not found');
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ContaMiki Server: http://0.0.0.0:${PORT}`);
});
