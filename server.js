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

    // Init Users file
    try {
      await fs.access(USERS_FILE);
    } catch {
      // Create default admin user if not exists
      const hashedPassword = await bcrypt.hash('admin', 10);
      const defaultUser = {
        username: 'admin',
        password: hashedPassword,
        created: new Date().toISOString()
      };
      await fs.writeFile(USERS_FILE, JSON.stringify([defaultUser], null, 2));
      console.log('Sistema inicializado. Usuario admin creado.');
    }
  } catch (err) {
    console.error("Error initializing storage:", err);
  }
};

initSystem();

// Helper: Get user-specific data file
const getUserDataFile = (username) => {
    // Sanitize username to prevent directory traversal
    const safeUsername = username.replace(/[^a-zA-Z0-9_-]/g, '');
    return path.join(DATA_DIR, `data_${safeUsername}.json`);
};

// --- Auth Middleware ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- Routes ---

// 1. Register
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    
    if(!username || !password || password.length < 4) {
        return res.status(400).json({ error: "Datos inválidos. La contraseña debe tener al menos 4 caracteres." });
    }

    try {
        const usersData = await fs.readFile(USERS_FILE, 'utf-8');
        const users = JSON.parse(usersData);

        if (users.find(u => u.username === username)) {
            return res.status(400).json({ error: "El nombre de usuario ya existe" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            username,
            password: hashedPassword,
            created: new Date().toISOString()
        };

        users.push(newUser);
        await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));

        // Initialize empty data file for new user
        const userDataFile = getUserDataFile(username);
        await fs.writeFile(userDataFile, JSON.stringify({}, null, 2));

        res.json({ success: true, message: "Usuario registrado correctamente" });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Error en el servidor al registrar" });
    }
});

// 2. Login Standard
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const usersData = await fs.readFile(USERS_FILE, 'utf-8');
    const users = JSON.parse(usersData);
    const user = users.find(u => u.username === username);

    if (!user || !user.password) {
      return res.status(400).json({ error: "Credenciales inválidas" });
    }

    if (await bcrypt.compare(password, user.password)) {
      const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '30d' });
      res.json({ token, username: user.username });
    } else {
      res.status(401).json({ error: "Credenciales inválidas" });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// 3. Data Routes (Multi-tenant)
app.get('/api/data', authenticateToken, async (req, res) => {
  try {
    const username = req.user.username;
    const userFile = getUserDataFile(username);
    
    try {
        const data = await fs.readFile(userFile, 'utf-8');
        res.json(JSON.parse(data));
    } catch (err) {
        // If file doesn't exist yet for some reason, return empty object
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

// Change Password
app.post('/api/change-password', authenticateToken, async (req, res) => {
    const { newPassword } = req.body;
    const username = req.user.username;

    if(!newPassword || newPassword.length < 4) {
        return res.status(400).json({error: "La contraseña debe tener al menos 4 caracteres"});
    }

    try {
        const usersData = await fs.readFile(USERS_FILE, 'utf-8');
        let users = JSON.parse(usersData);
        
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        users = users.map(u => u.username === username ? {...u, password: hashedPassword} : u);

        await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
        res.json({success: true, message: "Contraseña actualizada"});
    } catch (e) {
        res.status(500).json({error: "Error actualizando contraseña"});
    }
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