
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
const USERS_DIR = path.join(DATA_DIR, 'users');
const GLOBAL_USERS_FILE = path.join(DATA_DIR, 'users.json');

console.log(`ContaMiki Server: Storage path set to: ${DATA_DIR}`);

// Middleware - AUMENTADO A 500MB PARA SOPORTAR CARGAS EXTREMAS
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));
app.use(express.static(__dirname));

// Initialize System Files
const initSystem = async () => {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(USERS_DIR, { recursive: true });
    try {
      await fs.access(GLOBAL_USERS_FILE);
    } catch {
      await fs.writeFile(GLOBAL_USERS_FILE, JSON.stringify([]));
    }
  } catch (err) {
    console.error("CRITICAL: Error initializing storage:", err);
  }
};

initSystem();

// --- NUEVA LÓGICA DE GESTIÓN DE ARCHIVOS FRAGMENTADOS ---

const getSafeUsername = (username) => username.replace(/[^a-zA-Z0-9_-]/g, '');

const getUserDir = (username) => path.join(USERS_DIR, getSafeUsername(username));

// Lee y reconstruye el estado completo desde la estructura de carpetas
const readFullUserState = async (username) => {
    const userDir = getUserDir(username);
    const legacyFile = path.join(DATA_DIR, `data_${getSafeUsername(username)}.json`);

    // 1. MIGRACIÓN: Si no existe carpeta pero sí archivo legacy
    try {
        await fs.access(userDir);
    } catch {
        try {
            await fs.access(legacyFile);
            console.log(`MIGRATION: Converting legacy file for ${username} to folder structure...`);
            const legacyContent = await fs.readFile(legacyFile, 'utf-8');
            const legacyData = JSON.parse(legacyContent);
            await saveFullUserState(username, legacyData); // Esto creará la estructura
            await fs.rename(legacyFile, `${legacyFile}.bak_migration`); // Backup y ocultar
            return legacyData;
        } catch (e) {
            // Usuario nuevo
            return {};
        }
    }

    // 2. LECTURA ESTRUCTURADA
    try {
        const metadataFile = path.join(userDir, 'metadata.json');
        const metaContent = await fs.readFile(metadataFile, 'utf-8');
        const rootState = JSON.parse(metaContent); // { booksMetadata, currentBookId }

        const fullState = {
            ...rootState,
            booksData: {}
        };

        // Iterar libros y reconstruir
        for (const book of rootState.booksMetadata) {
            const bookId = book.id;
            const bookDir = path.join(userDir, bookId);
            
            try {
                // Leer configuración base (cuentas, categorias, etc)
                const configFile = path.join(bookDir, 'config.json');
                const configData = JSON.parse(await fs.readFile(configFile, 'utf-8'));
                
                // Leer transacciones por año
                const files = await fs.readdir(bookDir);
                let allTransactions = [];
                
                for (const file of files) {
                    if (file.startsWith('transactions_') && file.endsWith('.json')) {
                        const txContent = await fs.readFile(path.join(bookDir, file), 'utf-8');
                        const txs = JSON.parse(txContent);
                        allTransactions = allTransactions.concat(txs);
                    }
                }

                // Unir todo
                fullState.booksData[bookId] = {
                    ...configData,
                    transactions: allTransactions
                };

            } catch (err) {
                console.warn(`Warning: Could not read data for book ${bookId}`, err);
                fullState.booksData[bookId] = { 
                    transactions: [], accounts: [], categories: [], families: [], accountGroups: [] 
                };
            }
        }

        return fullState;

    } catch (err) {
        if (err.code === 'ENOENT') return {};
        throw err;
    }
};

// Guarda el estado fragmentándolo en archivos
const saveFullUserState = async (username, fullState) => {
    const userDir = getUserDir(username);
    await fs.mkdir(userDir, { recursive: true });

    // 1. Guardar Metadatos Raíz (siempre se envían completos)
    const rootState = {
        booksMetadata: fullState.booksMetadata || [],
        currentBookId: fullState.currentBookId || ''
    };
    await fs.writeFile(path.join(userDir, 'metadata.json'), JSON.stringify(rootState, null, 2));

    // 2. Guardar Libros Individualmente (Itera solo sobre los que vienen en el payload)
    if (fullState.booksData) {
        for (const [bookId, bookData] of Object.entries(fullState.booksData)) {
            const bookDir = path.join(userDir, bookId);
            await fs.mkdir(bookDir, { recursive: true });

            // Separar transacciones de configuración
            const { transactions, ...configData } = bookData;

            // Guardar Configuración (Overwrite atomic)
            const configFile = path.join(bookDir, 'config.json');
            await fs.writeFile(`${configFile}.tmp`, JSON.stringify(configData, null, 2));
            await fs.rename(`${configFile}.tmp`, configFile);

            // Identificar archivos existentes para limpieza posterior
            let existingFiles = [];
            try {
                existingFiles = (await fs.readdir(bookDir)).filter(f => f.startsWith('transactions_') && f.endsWith('.json'));
            } catch (e) { /* ignore if dir didn't exist */ }
            const writtenFiles = new Set();

            // Agrupar transacciones por AÑO
            const txByYear = {};
            if (Array.isArray(transactions)) {
                transactions.forEach(tx => {
                    const year = tx.date ? tx.date.substring(0, 4) : 'unknown';
                    if (!txByYear[year]) txByYear[year] = [];
                    txByYear[year].push(tx);
                });
            }

            // Guardar archivos de transacciones por año
            for (const [year, txs] of Object.entries(txByYear)) {
                const filename = `transactions_${year}.json`;
                const yearFile = path.join(bookDir, filename);
                await fs.writeFile(`${yearFile}.tmp`, JSON.stringify(txs, null, 2));
                await fs.rename(`${yearFile}.tmp`, yearFile);
                writtenFiles.add(filename);
            }
            
            // LIMPIEZA DE AÑOS BORRADOS:
            // Si existía un archivo de año (ej: 2022) pero no está en la nueva data, es que se borraron todas sus transacciones.
            // Lo eliminamos para mantener coherencia.
            for (const file of existingFiles) {
                if (!writtenFiles.has(file)) {
                    await fs.unlink(path.join(bookDir, file)).catch(e => console.warn(`Could not delete obsolete file ${file}`, e));
                }
            }
        }
    }
};


// --- Auth Helpers ---
const readUsers = async () => {
    try {
        const content = await fs.readFile(GLOBAL_USERS_FILE, 'utf-8');
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
        await fs.writeFile(GLOBAL_USERS_FILE, JSON.stringify(users, null, 2));
        
        // Crear carpeta de usuario
        await fs.mkdir(getUserDir(username), { recursive: true });
        
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
        const data = await readFullUserState(req.user.username);
        res.json(data);
    } catch (err) {
        console.error(`ERROR READING DATA for ${req.user.username}:`, err);
        res.status(500).json({ error: "Storage access error." });
    }
});

app.post('/api/data', authenticateToken, async (req, res) => {
    try {
        await saveFullUserState(req.user.username, req.body);
        res.json({ success: true });
    } catch (err) { 
        console.error(`ERROR SAVING DATA for ${req.user.username}:`, err);
        // Devolver detalles del error si es posible
        res.status(500).json({ error: err.message || "Error save" }); 
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

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`ContaMiki Server: http://0.0.0.0:${PORT}`);
});

server.timeout = 300000;
server.keepAliveTimeout = 300000;
