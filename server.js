
import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import dotenv from 'dotenv';

const envConfig = dotenv.config();
if (envConfig.error) {
    console.log("ℹ️ [ENV] No se encontró archivo .env o no se pudo leer (esto es normal si usas variables de entorno de Docker)");
} else {
    console.log("✅ [ENV] Archivo .env cargado correctamente desde el volumen.");
}

import { createServer as createViteServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
    const app = express();
    const PORT = 3000;

    // Helper to read secrets from environment or file
    const getSecret = async (key) => {
        let source = 'NONE';
        let value = undefined;

        // 1. Check process.env
        if (process.env[key] !== undefined && process.env[key] !== null && process.env[key].trim() !== '') {
            value = process.env[key].trim();
            source = 'ENV_VAR';
        } 
        // 2. Check Docker Secrets
        else {
            try {
                const secretPath = `/run/secrets/${key}`;
                await fs.access(secretPath);
                value = (await fs.readFile(secretPath, 'utf-8')).trim();
                source = 'DOCKER_SECRET';
            } catch (e) {
                // Not in secrets
            }
        }

        if (value) {
            console.log(`🔑 [SECRET] ${key} loaded from ${source}`);
        }
        return value;
    };

    const JWT_SECRET = await getSecret('JWT_SECRET') || 'super_secret_master_key_conta_miki';
    const APP_URL = await getSecret('APP_URL') || `http://localhost:${PORT}`;
    
    console.log(`🚀 [CONFIG] APP_URL: ${APP_URL}`);
    console.log(`🔐 [CONFIG] JWT_SECRET: ${JWT_SECRET === 'super_secret_master_key_conta_miki' ? 'DEFAULT (INSECURE)' : 'CUSTOM'}`);
    
    // EMAIL CONFIGURATION
    const smtpHost = await getSecret('SMTP_HOST');
    const smtpPort = await getSecret('SMTP_PORT');
    const smtpSecure = await getSecret('SMTP_SECURE');
    const smtpUser = await getSecret('SMTP_USER');
    const smtpPass = await getSecret('SMTP_PASS');

    const SMTP_CONFIG = {
        host: smtpHost,
        port: smtpPort || 587,
        secure: smtpSecure === 'true',
        auth: {
            user: smtpUser,
            pass: smtpPass,
        },
    };

    // Transporter (o Mock si no hay config)
    const hasSmtp = smtpHost && smtpHost.trim() !== '';

const mailer = hasSmtp 
    ? nodemailer.createTransport(SMTP_CONFIG)
    : null;

// VERIFICACIÓN DE CONEXIÓN SMTP AL INICIO
if (mailer) {
    console.log(`📧 [SMTP INIT] Intentando conectar a ${SMTP_CONFIG.host}:${SMTP_CONFIG.port} con usuario ${SMTP_CONFIG.auth.user}...`);
    mailer.verify((error, success) => {
        if (error) {
            console.error("❌ [SMTP ERROR] No se pudo conectar al servidor de correo:");
            console.error(error);
            console.error("SUGERENCIA: Si usas Gmail, asegúrate de usar una 'Contraseña de Aplicación' y no tu clave normal.");
        } else {
            console.log("✅ [SMTP SUCCESS] Servidor de correo conectado y listo.");
        }
    });
} else {
    console.log("⚠️ [SMTP DISABLED] No se detectó configuración SMTP válida. Los correos se imprimirán en la consola del servidor.");
}

const sendEmail = async (to, subject, text, html) => {
    // 1. INTENTAR USAR EL CARTERO CENTRAL (SI ESTÁ CONFIGURADO)
    const centralUrl = await getSecret('CENTRAL_EMAIL_URL');
    const centralKey = await getSecret('CENTRAL_EMAIL_KEY');

    if (centralUrl && centralKey) {
        try {
            const response = await fetch(`${centralUrl}/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    to, 
                    subject, 
                    text, 
                    html, 
                    key: centralKey,
                    fromName: 'ContaMiki'
                })
            });
            const result = await response.json();
            if (result.success) {
                console.log(`[CENTRAL EMAIL] Enviado a ${to} vía Proxy`);
                return true;
            }
        } catch (error) {
            console.error("[CENTRAL EMAIL ERROR]", error);
            // Si falla el central, intentamos el local si existe
        }
    }

    // 2. SI NO HAY CENTRAL O FALLA, USAR EL LOCAL (SI ESTÁ CONFIGURADO)
    if (mailer) {
        try {
            await mailer.sendMail({ from: `"ContaMiki Security" <${smtpUser || 'noreply@contamiki.local'}>`, to, subject, text, html });
            console.log(`[LOCAL EMAIL SENT] To: ${to} | Subject: ${subject}`);
            return true;
        } catch (error) {
            console.error("[LOCAL EMAIL ERROR]", error);
            return false;
        }
    } else {
        // MODO DESARROLLO / LOCAL: Imprimir en consola
        console.log("==================================================");
        console.log(`[MOCK EMAIL] To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Content: ${text}`);
        console.log("==================================================");
        return true;
    }
};

// DEFINICIÓN DE DIRECTORIO DE DATOS ROBUSTA
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const USERS_DIR = path.join(DATA_DIR, 'users');
const GLOBAL_USERS_FILE = path.join(DATA_DIR, 'users.json');
const SYSTEM_LOGO_FILE = path.join(DATA_DIR, 'system_logo.png');

console.log(`ContaMiki Server: Storage path set to: ${DATA_DIR}`);

// DATOS POR DEFECTO (Para inicializar nuevos usuarios con Logo)
const DEFAULT_APP_STATE = {
    accountGroups: [
        { id: 'g1', name: 'Bancos', icon: '🏦' },
        { id: 'g2', name: 'Efectivo', icon: '💶' },
        { id: 'g3', name: 'Tarjetas', icon: '💳' },
        { id: 'g4', name: 'Inversión', icon: '📈' },
    ],
    accounts: [
        { id: 'a1', groupId: 'g1', name: 'Banco Principal', initialBalance: 1000, currency: 'EUR', icon: '🏦', active: true },
        { id: 'a2', groupId: 'g2', name: 'Cartera / Efectivo', initialBalance: 150, currency: 'EUR', icon: '👛', active: true },
    ],
    families: [
        { id: 'f1', name: 'Vivienda', type: 'EXPENSE', icon: '🏠' },
        { id: 'f2', name: 'Alimentación', type: 'EXPENSE', icon: '🍎' },
        { id: 'f3', name: 'Vehículo', type: 'EXPENSE', icon: '🚗' },
        { id: 'f4', name: 'Ingresos Laborales', type: 'INCOME', icon: '💼' },
        { id: 'f5', name: 'Inversiones', type: 'INCOME', icon: '📈' },
    ],
    categories: [
        { id: 'c1', familyId: 'f1', name: 'Alquiler/Hipoteca', icon: '🔑', active: true },
        { id: 'c2', familyId: 'f1', name: 'Luz y Gas', icon: '💡', active: true },
        { id: 'c3', familyId: 'f2', name: 'Supermercado', icon: '🛒', active: true },
        { id: 'c4', familyId: 'f2', name: 'Restaurantes', icon: '🍽️', active: true },
        { id: 'c5', familyId: 'f3', name: 'Gasolina', icon: '⛽', active: true },
        { id: 'c6', familyId: 'f3', name: 'Mantenimiento', icon: '🔧', active: true },
        { id: 'c7', familyId: 'f4', name: 'Nómina Mensual', icon: '💵', active: true },
        { id: 'c8', familyId: 'f5', name: 'Dividendos', icon: '💰', active: true },
    ],
    transactions: [],
    recurrents: [],
    favorites: []
};

// Middleware - AUMENTADO A 500MB PARA SOPORTAR CARGAS EXTREMAS
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// Servir bundle.js explícitamente
app.get('/bundle.js', (req, res) => {
    console.log(`[SERVER] Serving bundle.js to ${req.ip}`);
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(__dirname, 'bundle.js'));
});

// Fallback para index.tsx en producción (redirección a bundle.js)
if (process.env.NODE_ENV === 'production') {
    app.get('/index.tsx', (req, res) => {
        res.redirect('/bundle.js');
    });
}

if (process.env.NODE_ENV === 'production') {
    app.use(express.static(__dirname));
}

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

const SHARED_ACCESS_FILE = path.join(DATA_DIR, 'shared_access.json');
const INVITATIONS_FILE = path.join(DATA_DIR, 'invitations.json');

// --- Shared Access Helpers ---
const readSharedAccess = async () => {
    try {
        const content = await fs.readFile(SHARED_ACCESS_FILE, 'utf-8');
        return JSON.parse(content);
    } catch {
        return [];
    }
};

const saveSharedAccess = async (access) => {
    await fs.writeFile(SHARED_ACCESS_FILE, JSON.stringify(access, null, 2));
};

const readInvitations = async () => {
    try {
        const content = await fs.readFile(INVITATIONS_FILE, 'utf-8');
        return JSON.parse(content);
    } catch {
        return [];
    }
};

const saveInvitations = async (invitations) => {
    await fs.writeFile(INVITATIONS_FILE, JSON.stringify(invitations, null, 2));
};

// --- Helper Functions ---
const getSafeUsername = (username) => {
    return username.replace(/[^a-zA-Z0-9]/g, '_');
};

const getUserDir = (username) => {
    return path.join(USERS_DIR, getSafeUsername(username));
};

// Función auxiliar para leer estado estructurado de un directorio dado
const readStructuredState = async (targetDir) => {
    let fullState = {
        booksMetadata: [],
        currentBookId: '',
        booksData: {}
    };

    try {
        const metadataFile = path.join(targetDir, 'metadata.json');
        const metaContent = await fs.readFile(metadataFile, 'utf-8');
        const rootState = JSON.parse(metaContent); // { booksMetadata, currentBookId }
        
        fullState.booksMetadata = rootState.booksMetadata || [];
        fullState.currentBookId = rootState.currentBookId || '';

        // Iterar libros PROPIOS y reconstruir
        for (const book of fullState.booksMetadata) {
            const bookId = book.id;
            const bookDir = path.join(targetDir, bookId);
            
            try {
                // Leer configuración base (cuentas, categorias, etc)
                const configFile = path.join(bookDir, 'config.json');
                const configData = JSON.parse(await fs.readFile(configFile, 'utf-8'));
                
                // Leer transacciones por año
                const files = await fs.readdir(bookDir);
                let allTransactions = [];
                
                for (const file of files) {
                    if (file.startsWith('transactions_') && file.endsWith('.json')) {
                        const content = await fs.readFile(path.join(bookDir, file), 'utf-8');
                        const yearTx = JSON.parse(content);
                        if (Array.isArray(yearTx)) {
                            allTransactions = [...allTransactions, ...yearTx];
                        }
                    }
                }

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
    } catch (err) {
        if (err.code !== 'ENOENT') console.error(`Error reading metadata in ${targetDir}:`, err);
    }
    return fullState;
};

// Lee y reconstruye el estado completo desde la estructura de carpetas
const readFullUserState = async (username) => {
    const safeUsername = getSafeUsername(username); // e.g. mailmafernandez_gmail_com
    const strippedUsername = username.replace(/[^a-zA-Z0-9]/g, ''); // e.g. mailmafernandezgmailcom
    
    const userDir = getUserDir(username); // DATA_DIR/users/safe_username
    const strippedUserDir = path.join(USERS_DIR, strippedUsername); // DATA_DIR/users/stripped_username
    
    const legacyFile = path.join(DATA_DIR, `data_${safeUsername}.json`);
    const fallbackUserDir = path.join(DATA_DIR, safeUsername);

    console.log(`[READ STATE] Checking for user ${username}...`);
    console.log(`[READ STATE] 1. Standard Dir: ${userDir}`);
    console.log(`[READ STATE] 2. Stripped Dir: ${strippedUserDir}`);
    console.log(`[READ STATE] 3. Legacy File: ${legacyFile}`);

    let targetDir = userDir;

    // 1. DETERMINAR DIRECTORIO DE DATOS
    try {
        await fs.access(userDir);
    } catch {
        // Si no existe el estándar, probamos el "stripped" (sin guiones bajos)
        try {
            await fs.access(strippedUserDir);
            console.log(`[READ STATE] Found user dir in stripped location: ${strippedUserDir}. Using it.`);
            targetDir = strippedUserDir;
        } catch {
            // Si no, probamos en la raíz (fallback)
            try {
                await fs.access(fallbackUserDir);
                console.log(`[READ STATE] Found user dir in fallback location: ${fallbackUserDir}. Using it.`);
                targetDir = fallbackUserDir;
            } catch (e) {
                // No existe fallback, probamos legacy
                 try {
                    await fs.access(legacyFile);
                    console.log(`MIGRATION: Converting legacy file for ${username} to folder structure...`);
                    const legacyContent = await fs.readFile(legacyFile, 'utf-8');
                    const legacyData = JSON.parse(legacyContent);
                    await saveFullUserState(username, legacyData); // Esto creará la estructura en el lugar correcto (estándar)
                    await fs.rename(legacyFile, `${legacyFile}.bak_migration`); // Backup y ocultar
                    return legacyData;
                } catch (e) {
                    // Usuario nuevo (si no tiene libros compartidos)
                    console.log(`[READ STATE] No data found for ${username}. Returning empty state.`);
                }
            }
        }
    }

    // 2. LECTURA ESTRUCTURADA
    const fullState = await readStructuredState(targetDir);

    // 3. CARGAR LIBROS COMPARTIDOS
    try {
        const sharedAccess = await readSharedAccess();
        const mySharedBooks = sharedAccess.filter(access => access.userId === username);

        for (const access of mySharedBooks) {
            const ownerDir = getUserDir(access.ownerUsername);
            const bookDir = path.join(ownerDir, access.bookId);

            try {
                // Leer metadata del dueño para obtener nombre y detalles
                const ownerMetaFile = path.join(ownerDir, 'metadata.json');
                const ownerMeta = JSON.parse(await fs.readFile(ownerMetaFile, 'utf-8'));
                const bookMeta = ownerMeta.booksMetadata.find(b => b.id === access.bookId);

                if (bookMeta) {
                    // Añadir a metadata con flag isShared
                    fullState.booksMetadata.push({
                        ...bookMeta,
                        owner: access.ownerUsername,
                        isShared: true
                    });

                    // Leer datos del libro
                    const configFile = path.join(bookDir, 'config.json');
                    const configData = JSON.parse(await fs.readFile(configFile, 'utf-8'));
                    
                    const files = await fs.readdir(bookDir);
                    let allTransactions = [];
                    
                    for (const file of files) {
                        if (file.startsWith('transactions_') && file.endsWith('.json')) {
                            const txContent = await fs.readFile(path.join(bookDir, file), 'utf-8');
                            const txs = JSON.parse(txContent);
                            allTransactions = allTransactions.concat(txs);
                        }
                    }

                    fullState.booksData[access.bookId] = {
                        ...configData,
                        transactions: allTransactions
                    };
                }
            } catch (err) {
                console.warn(`Warning: Could not read shared book ${access.bookId} from ${access.ownerUsername}`, err);
            }
        }
    } catch (err) {
        console.error("Error loading shared books:", err);
    }

    return fullState;
};

// Guarda el estado fragmentándolo en archivos
const saveFullUserState = async (username, fullState) => {
    const userDir = getUserDir(username);
    await fs.mkdir(userDir, { recursive: true });

    // Separar libros propios de compartidos
    const ownBooksMeta = [];
    const sharedBooksMeta = [];

    if (fullState.booksMetadata && Array.isArray(fullState.booksMetadata)) {
        for (const book of fullState.booksMetadata) {
            if (book.isShared) {
                sharedBooksMeta.push(book);
            } else {
                ownBooksMeta.push(book);
            }
        }
    }

    // 0. EXTRACCIÓN DE LOGOS (Base64 -> Archivo)
    if (fullState.booksMetadata && Array.isArray(fullState.booksMetadata)) {
        for (const book of fullState.booksMetadata) {
            if (book.logo && book.logo.startsWith('data:image')) {
                let bookTargetDir;
                if (book.isShared) {
                    // Verificar permiso antes de guardar logo en libro compartido
                    const sharedAccess = await readSharedAccess();
                    const hasAccess = sharedAccess.find(a => a.userId === username && a.bookId === book.id && a.ownerUsername === book.owner);
                    if (!hasAccess) continue;
                    bookTargetDir = path.join(getUserDir(book.owner), book.id);
                } else {
                    bookTargetDir = path.join(userDir, book.id);
                }

                await fs.mkdir(bookTargetDir, { recursive: true });
                
                const matches = book.logo.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
                if (matches) {
                    const buffer = Buffer.from(matches[2], 'base64');
                    await fs.writeFile(path.join(bookTargetDir, 'logo.png'), buffer);
                    book.logo = `/api/book/${book.id}/logo?v=${Date.now()}`;

                    // Sistema de logo global (solo si es propio)
                    if (!book.isShared) {
                        try {
                            await fs.writeFile(SYSTEM_LOGO_FILE, buffer);
                        } catch (sysErr) {}
                    }
                }
            } else if (book.logo === undefined || book.logo === null) {
                let bookTargetDir;
                if (book.isShared) {
                    bookTargetDir = path.join(getUserDir(book.owner), book.id);
                } else {
                    bookTargetDir = path.join(userDir, book.id);
                }
                try { await fs.unlink(path.join(bookTargetDir, 'logo.png')); } catch (e) {}
            }
        }
    }

    // 1. Guardar Metadatos Raíz (SOLO PROPIOS)
    // Los compartidos no se guardan en metadata.json del usuario, se reconstruyen al leer
    const rootState = {
        booksMetadata: ownBooksMeta,
        currentBookId: fullState.currentBookId || ''
    };
    await fs.writeFile(path.join(userDir, 'metadata.json'), JSON.stringify(rootState, null, 2));

    // 1.5 Actualizar metadatos de libros compartidos (si han cambiado)
    const sharedAccess = await readSharedAccess();
    for (const sharedBook of sharedBooksMeta) {
        try {
            // Verificar permiso de escritura (EDITOR o superior)
            const hasAccess = sharedAccess.find(a => a.userId === username && a.bookId === sharedBook.id && a.ownerUsername === sharedBook.owner);
            if (!hasAccess) continue;

            const ownerDir = getUserDir(sharedBook.owner);
            const ownerMetaFile = path.join(ownerDir, 'metadata.json');
            const ownerMeta = JSON.parse(await fs.readFile(ownerMetaFile, 'utf-8'));
            
            const bookIndex = ownerMeta.booksMetadata.findIndex(b => b.id === sharedBook.id);
            if (bookIndex !== -1) {
                const original = ownerMeta.booksMetadata[bookIndex];
                // Solo actualizar si hay cambios
                if (original.name !== sharedBook.name || original.color !== sharedBook.color || original.logo !== sharedBook.logo) {
                    ownerMeta.booksMetadata[bookIndex] = {
                        ...original,
                        name: sharedBook.name,
                        color: sharedBook.color,
                        logo: sharedBook.logo
                    };
                    await fs.writeFile(ownerMetaFile, JSON.stringify(ownerMeta, null, 2));
                    console.log(`[SHARED META UPDATE] Book ${sharedBook.id} updated by ${username}`);
                }
            }
        } catch (err) {
            console.warn(`Could not update metadata for shared book ${sharedBook.id} of owner ${sharedBook.owner}`, err);
        }
    }

    // 2. Guardar Libros Individualmente
    if (fullState.booksData) {
        const sharedAccess = await readSharedAccess();

        for (const [bookId, bookData] of Object.entries(fullState.booksData)) {
            // Verificar si es compartido
            const sharedInfo = sharedBooksMeta.find(b => b.id === bookId);
            
            let targetDir;
            if (sharedInfo) {
                // Verificar permiso de escritura
                const hasAccess = sharedAccess.find(a => a.userId === username && a.bookId === bookId && a.ownerUsername === sharedInfo.owner);
                if (!hasAccess) {
                    console.warn(`Security: User ${username} tried to write to book ${bookId} without permission.`);
                    continue; 
                }
                targetDir = path.join(getUserDir(sharedInfo.owner), bookId);
            } else {
                // Es propio
                targetDir = path.join(userDir, bookId);
            }

            await fs.mkdir(targetDir, { recursive: true });

            // Separar transacciones de configuración
            const { transactions, ...configData } = bookData;

            // Guardar Configuración (Overwrite atomic)
            const configFile = path.join(targetDir, 'config.json');
            await fs.writeFile(`${configFile}.tmp`, JSON.stringify(configData, null, 2));
            await fs.rename(`${configFile}.tmp`, configFile);

            // Identificar archivos existentes para limpieza posterior
            let existingFiles = [];
            try {
                existingFiles = (await fs.readdir(targetDir)).filter(f => f.startsWith('transactions_') && f.endsWith('.json'));
            } catch (e) { /* ignore */ }
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
                const yearFile = path.join(targetDir, filename);
                await fs.writeFile(`${yearFile}.tmp`, JSON.stringify(txs, null, 2));
                await fs.rename(`${yearFile}.tmp`, yearFile);
                writtenFiles.add(filename);
            }
            
            // LIMPIEZA DE AÑOS BORRADOS:
            for (const file of existingFiles) {
                if (!writtenFiles.has(file)) {
                    await fs.unlink(path.join(targetDir, file)).catch(e => console.warn(`Could not delete obsolete file ${file}`, e));
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

const saveUsers = async (users) => {
    await fs.writeFile(GLOBAL_USERS_FILE, JSON.stringify(users, null, 2));
};

const authenticateToken = (req, res, next) => {
  let token = req.headers['authorization'] && req.headers['authorization'].split(' ')[1];
  
  // Soporte para token por Query Param (para cargar imágenes)
  if (!token && req.query.key) {
      token = req.query.key;
  }
  
  if (!token) return res.status(401).json({ error: "No autorizado" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Token inválido" });
    // Si es un token de pre-autenticación (2FA pendiente), no dar acceso a rutas protegidas
    if (user.isPreAuth) return res.status(403).json({ error: "2FA Requerido" });
    
    req.user = user;
    next();
  });
};

const validateEmail = (email) => {
    return String(email)
      .toLowerCase()
      .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      );
};

// --- Routes ---

app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Datos incompletos" });
    if (!validateEmail(username)) return res.status(400).json({ error: "El usuario debe ser un email válido" });
    
    try {
        const users = await readUsers();
        if (users.find(u => u.username === username)) return res.status(400).json({ error: "Usuario/Email ya registrado" });
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationToken = crypto.randomBytes(32).toString('hex');
        
        users.push({ 
            username, 
            password: hashedPassword,
            isVerified: false,
            verificationToken
        });
        
        await saveUsers(users);
        const userDir = getUserDir(username);
        await fs.mkdir(userDir, { recursive: true });

        // Enviar Email Verificación
        const link = `${APP_URL}?action=verify&token=${verificationToken}`;
        await sendEmail(
            username, 
            "Verifica tu cuenta en ContaMiki", 
            `Haz click en este enlace para activar tu cuenta: ${link}`,
            `<p>Bienvenido a ContaMiki.</p><p>Para activar tu cuenta, haz clic aquí:</p><a href="${link}">${link}</a>`
        );

        res.json({ success: true, message: "Usuario creado. Revisa tu email (o la consola del servidor) para activar la cuenta." });
    } catch (err) { 
        console.error("Register Error:", err);
        res.status(500).json({ error: "Error server" }); 
    }
});

app.post('/api/resend-verification', async (req, res) => {
    const { username } = req.body;
    try {
        const users = await readUsers();
        const user = users.find(u => u.username === username);

        if (!user) return res.status(400).json({ error: "Usuario no encontrado" });
        if (user.isVerified) return res.status(400).json({ error: "El usuario ya está verificado" });

        // Regenerar token por si acaso
        const verificationToken = crypto.randomBytes(32).toString('hex');
        user.verificationToken = verificationToken;
        await saveUsers(users);

        const link = `${APP_URL}?action=verify&token=${verificationToken}`;
        await sendEmail(
            username, 
            "Verifica tu cuenta en ContaMiki (Reenvío)", 
            `Haz click en este enlace para activar tu cuenta: ${link}`,
            `<p>Has solicitado reenviar el correo de validación.</p><p><a href="${link}">Activar cuenta ahora</a></p>`
        );

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error al reenviar email" });
    }
});

app.post('/api/verify', async (req, res) => {
    const { token } = req.body;
    if(!token) return res.status(400).json({ error: "Token requerido" });
    
    try {
        const users = await readUsers();
        const user = users.find(u => u.verificationToken === token);
        
        if (!user) return res.status(400).json({ error: "Token inválido o expirado" });
        
        user.isVerified = true;
        user.verificationToken = null;
        await saveUsers(users);
        
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Error server" }); }
});

// LOGIN MEJORADO CON 2FA
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const users = await readUsers();
        const user = users.find(u => u.username === username);
        
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: "Credenciales inválidas" });
        if (user.isVerified === false) return res.status(403).json({ error: "Cuenta no verificada. Revisa tu email." });

        // VERIFICACIÓN 2FA
        if (user.twoFactorEnabled && user.twoFactorSecret) {
            // Generar token temporal de pre-autorización (solo vale para endpoint /api/login/2fa)
            const tempToken = jwt.sign(
                { username: user.username, isPreAuth: true }, 
                JWT_SECRET, 
                { expiresIn: '5m' } // 5 minutos para poner el código
            );
            return res.json({ 
                requires2fa: true, 
                tempToken: tempToken 
            });
        }

        // Login normal si no hay 2FA
        const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ token, username: user.username });
    } catch (err) { res.status(500).json({ error: "Error server" }); }
});

// SEGUNDO PASO DE LOGIN (VALIDAR CÓDIGO)
app.post('/api/login/2fa', async (req, res) => {
    const { tempToken, code } = req.body;
    
    try {
        // Verificar el token temporal
        const decoded = jwt.verify(tempToken, JWT_SECRET);
        if (!decoded.isPreAuth) return res.status(401).json({ error: "Token inválido para 2FA" });
        
        const users = await readUsers();
        const user = users.find(u => u.username === decoded.username);
        
        if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
        
        // Verificar código TOTP
        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: code
        });
        
        if (!verified) return res.status(401).json({ error: "Código 2FA incorrecto" });
        
        // Todo OK: Generar token final
        const finalToken = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ token: finalToken, username: user.username });
        
    } catch (err) {
        return res.status(401).json({ error: "Sesión 2FA expirada o inválida" });
    }
});

app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    if(!email) return res.status(400).json({ error: "Email requerido" });
    
    try {
        const users = await readUsers();
        const user = users.find(u => u.username === email);
        if (!user) return res.json({ success: true }); // No revelar si existe o no por seguridad

        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetToken = resetToken;
        user.resetExpires = Date.now() + 3600000; // 1 hora
        await saveUsers(users);

        const link = `${APP_URL}?action=reset&token=${resetToken}`;
        await sendEmail(
            email, 
            "Recuperación de Contraseña - ContaMiki", 
            `Usa este enlace para cambiar tu contraseña: ${link}`,
            `<p>Has solicitado recuperar tu contraseña.</p><p><a href="${link}">Haz clic aquí para resetearla</a></p><p>Este enlace expira en 1 hora.</p>`
        );

        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Error server" }); }
});

app.post('/api/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    try {
        const users = await readUsers();
        const user = users.find(u => u.resetToken === token && u.resetExpires > Date.now());
        
        if (!user) return res.status(400).json({ error: "Enlace inválido o expirado" });
        
        user.password = await bcrypt.hash(newPassword, 10);
        user.resetToken = null;
        user.resetExpires = null;
        await saveUsers(users);
        
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Error server" }); }
});

app.post('/api/change-password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    try {
        const users = await readUsers();
        const user = users.find(u => u.username === req.user.username);
        
        if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
        
        // Verificar contraseña actual
        if (!(await bcrypt.compare(currentPassword, user.password))) {
            return res.status(401).json({ error: "La contraseña actual es incorrecta" });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await saveUsers(users);
        
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error al cambiar contraseña" });
    }
});

app.post('/api/delete-account', authenticateToken, async (req, res) => {
    try {
        const users = await readUsers();
        const newUsers = users.filter(u => u.username !== req.user.username);
        
        if (users.length === newUsers.length) return res.status(404).json({ error: "Usuario no encontrado" });

        await saveUsers(newUsers);

        // Borrar datos asociados
        const userDir = getUserDir(req.user.username);
        try {
            await fs.rm(userDir, { recursive: true, force: true });
            // Intentar borrar archivo legacy si existe
            const legacyFile = path.join(DATA_DIR, `data_${getSafeUsername(req.user.username)}.json`);
            await fs.unlink(legacyFile).catch(() => {});
        } catch (e) {
            console.error("Error borrando archivos de usuario:", e);
        }
        
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error al eliminar cuenta" });
    }
});

// --- 2FA SETUP ROUTES ---

// Iniciar configuración 2FA (Generar secreto y QR)
app.post('/api/2fa/setup', authenticateToken, async (req, res) => {
    try {
        const users = await readUsers();
        const user = users.find(u => u.username === req.user.username);
        if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

        const secret = speakeasy.generateSecret({
            name: `ContaMiki (${user.username})`
        });

        // Guardar secreto temporalmente (aún no confirmado)
        user.tempTwoFactorSecret = secret.base32;
        await saveUsers(users);

        // Generar QR
        const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

        res.json({ 
            secret: secret.base32, 
            qrCode: qrCodeDataUrl 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error configurando 2FA" });
    }
});

// Confirmar y Activar 2FA
app.post('/api/2fa/verify-setup', authenticateToken, async (req, res) => {
    const { token } = req.body;
    try {
        const users = await readUsers();
        const user = users.find(u => u.username === req.user.username);
        
        if (!user || !user.tempTwoFactorSecret) return res.status(400).json({ error: "No hay configuración 2FA pendiente" });

        const verified = speakeasy.totp.verify({
            secret: user.tempTwoFactorSecret,
            encoding: 'base32',
            token: token
        });

        if (verified) {
            user.twoFactorSecret = user.tempTwoFactorSecret;
            user.twoFactorEnabled = true;
            user.tempTwoFactorSecret = null;
            await saveUsers(users);
            res.json({ success: true });
        } else {
            res.status(400).json({ error: "Código incorrecto" });
        }
    } catch (err) {
        res.status(500).json({ error: "Error verificando 2FA" });
    }
});

// Desactivar 2FA
app.post('/api/2fa/disable', authenticateToken, async (req, res) => {
    try {
        const users = await readUsers();
        const user = users.find(u => u.username === req.user.username);
        
        if (user) {
            user.twoFactorEnabled = false;
            user.twoFactorSecret = null;
            await saveUsers(users);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Error desactivando 2FA" });
    }
});

app.get('/api/2fa/status', authenticateToken, async (req, res) => {
    try {
        const users = await readUsers();
        const user = users.find(u => u.username === req.user.username);
        res.json({ enabled: !!user?.twoFactorEnabled });
    } catch (err) {
        res.status(500).json({ error: "Error obteniendo estado 2FA" });
    }
});

// Nueva ruta para servir el Logo de forma segura (AUTENTICADO)
app.get('/api/book/:bookId/logo', authenticateToken, async (req, res) => {
    const { bookId } = req.params;
    // Sanitización básica del bookId para evitar path traversal
    const safeBookId = bookId.replace(/[^a-zA-Z0-9_-]/g, '');
    const userDir = getUserDir(req.user.username);
    const logoPath = path.join(userDir, safeBookId, 'logo.png');

    try {
        await fs.access(logoPath);
        res.sendFile(logoPath);
    } catch {
        res.status(404).send('Not found');
    }
});

// RUTA PÚBLICA PARA EL LOGO DEL SISTEMA (LOGIN SCREEN)
app.get('/api/system/logo', async (req, res) => {
    try {
        await fs.access(SYSTEM_LOGO_FILE);
        res.sendFile(SYSTEM_LOGO_FILE);
    } catch {
        // Si no hay logo custom, 404 (el cliente usará default)
        res.status(404).send('No custom system logo');
    }
});

// --- INVITATION ROUTES ---

app.post('/api/invite', authenticateToken, async (req, res) => {
    const { email, bookId } = req.body;
    if (!email || !bookId) return res.status(400).json({ error: "Email y Libro requeridos" });

    try {
        const fullState = await readFullUserState(req.user.username);
        const book = fullState.booksMetadata.find(b => b.id === bookId);

        if (!book) return res.status(404).json({ error: "Libro no encontrado" });
        
        // Solo el propietario puede invitar
        // Si es un libro compartido (isShared=true), no se puede invitar
        if (book.isShared) {
            return res.status(403).json({ error: "No puedes invitar usuarios a un libro compartido contigo." });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const invitations = await readInvitations();
        
        // Verificar si ya existe invitación pendiente
        const existing = invitations.find(i => i.toEmail === email && i.bookId === bookId && i.status === 'PENDING');
        if (existing) {
            // Reenviar
            existing.token = token; // Renovar token
            existing.timestamp = Date.now();
        } else {
            invitations.push({
                id: crypto.randomUUID(),
                fromUser: req.user.username,
                toEmail: email,
                bookId: bookId,
                bookName: book.name,
                token: token,
                status: 'PENDING',
                timestamp: Date.now()
            });
        }
        
        await saveInvitations(invitations);

        const link = `${APP_URL}?action=invite&token=${token}`;
        await sendEmail(
            email,
            `Invitación a colaborar en "${book.name}" - ContaMiki`,
            `Has sido invitado por ${req.user.username} a colaborar en la contabilidad "${book.name}". Acepta la invitación aquí: ${link}`,
            `<p>Hola,</p><p><strong>${req.user.username}</strong> te ha invitado a colaborar en el libro de contabilidad <strong>"${book.name}"</strong>.</p><p><a href="${link}" style="background:#4F46E5;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Aceptar Invitación</a></p><p>Si no tienes cuenta, podrás crear una al aceptar.</p>`
        );

        res.json({ success: true, message: "Invitación enviada" });

    } catch (err) {
        console.error("Invite Error:", err);
        res.status(500).json({ error: "Error al enviar invitación" });
    }
});

app.post('/api/accept-invite', async (req, res) => {
    const { token, password, username } = req.body; // username/password solo si es registro nuevo
    
    try {
        const invitations = await readInvitations();
        const invite = invitations.find(i => i.token === token && i.status === 'PENDING');
        
        if (!invite) return res.status(404).json({ error: "Invitación no válida o expirada" });

        const users = await readUsers();
        let user = users.find(u => u.username === invite.toEmail);
        let isNewUser = false;

        // Si el usuario no existe, DEBE venir password para crearlo
        if (!user) {
            if (!password) {
                return res.json({ requireRegister: true, email: invite.toEmail });
            }
            
            // Crear usuario
            const hashedPassword = await bcrypt.hash(password, 10);
            user = {
                username: invite.toEmail,
                password: hashedPassword,
                isVerified: true, // Auto-verificado por invitación
                verificationToken: null
            };
            users.push(user);
            await saveUsers(users);
            
            // Inicializar directorio
            const userDir = getUserDir(user.username);
            await fs.mkdir(userDir, { recursive: true });
            
            isNewUser = true;
        }

        // Crear acceso compartido
        const sharedAccess = await readSharedAccess();
        
        // Evitar duplicados
        const accessExists = sharedAccess.find(a => a.userId === user.username && a.bookId === invite.bookId && a.ownerUsername === invite.fromUser);
        
        if (!accessExists) {
            sharedAccess.push({
                id: crypto.randomUUID(),
                userId: user.username,
                ownerUsername: invite.fromUser,
                bookId: invite.bookId,
                role: 'EDITOR', // Por defecto editor completo (menos settings)
                timestamp: Date.now()
            });
            await saveSharedAccess(sharedAccess);
        }

        // Marcar invitación como aceptada
        invite.status = 'ACCEPTED';
        await saveInvitations(invitations);

        // Si es usuario nuevo, devolver token de login directo
        if (isNewUser) {
            const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '30d' });
            return res.json({ success: true, token, username: user.username, isNewUser: true });
        }

        res.json({ success: true, message: "Invitación aceptada. Inicia sesión para ver el libro." });

    } catch (err) {
        console.error("Accept Invite Error:", err);
        res.status(500).json({ error: "Error al procesar invitación" });
    }
});

app.get('/api/book/:bookId/collaborators', authenticateToken, async (req, res) => {
    const { bookId } = req.params;
    const username = req.user.username;

    try {
        // Solo el propietario puede ver colaboradores
        const fullState = await readFullUserState(username);
        const book = fullState.booksMetadata.find(b => b.id === bookId && !b.isShared);
        if (!book) return res.status(403).json({ error: "No tienes permiso para ver colaboradores de este libro" });

        const sharedAccess = await readSharedAccess();
        const invitations = await readInvitations();

        const collaborators = sharedAccess
            .filter(a => a.bookId === bookId && a.ownerUsername === username)
            .map(a => ({ userId: a.userId, role: a.role, timestamp: a.timestamp }));

        const pending = invitations
            .filter(i => i.bookId === bookId && i.fromUser === username && i.status === 'PENDING')
            .map(i => ({ email: i.toEmail, timestamp: i.timestamp }));

        res.json({ collaborators, pending });
    } catch (err) {
        res.status(500).json({ error: "Error al obtener colaboradores" });
    }
});

app.delete('/api/book/:bookId/collaborators/:targetUserId', authenticateToken, async (req, res) => {
    const { bookId, targetUserId } = req.params;
    const username = req.user.username;

    try {
        const sharedAccess = await readSharedAccess();
        const index = sharedAccess.findIndex(a => a.bookId === bookId && a.ownerUsername === username && a.userId === targetUserId);
        
        if (index === -1) return res.status(404).json({ error: "Colaborador no encontrado" });

        sharedAccess.splice(index, 1);
        await saveSharedAccess(sharedAccess);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Error al revocar acceso" });
    }
});

app.delete('/api/book/:bookId/invitations/:email', authenticateToken, async (req, res) => {
    const { bookId, email } = req.params;
    const username = req.user.username;

    try {
        const invitations = await readInvitations();
        const index = invitations.findIndex(i => i.bookId === bookId && i.fromUser === username && i.toEmail === email && i.status === 'PENDING');
        
        if (index === -1) return res.status(404).json({ error: "Invitación no encontrada" });

        invitations.splice(index, 1);
        await saveInvitations(invitations);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Error al cancelar invitación" });
    }
});

app.post('/api/test-email', authenticateToken, async (req, res) => {
    try {
        const success = await sendEmail(
            req.user.username,
            "Prueba de Email - ContaMiki",
            "Este es un correo de prueba para verificar la configuración SMTP.",
            "<h1>Correo de Prueba</h1><p>El sistema de correo funciona correctamente.</p>"
        );
        
        if (success) res.json({ success: true });
        else res.status(500).json({ error: "Fallo al enviar el correo (revisa logs del servidor)" });
    } catch (err) {
        res.status(500).json({ error: "Error interno" });
    }
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

app.get('/api/debug/paths', async (req, res) => {
    try {
        const dataDir = DATA_DIR;
        const usersFile = GLOBAL_USERS_FILE;
        
        let files = [];
        try {
            files = await fs.readdir(dataDir);
        } catch (e) {
            files = [`Error reading dir: ${e.message}`];
        }

        let rootFiles = [];
        try {
            rootFiles = await fs.readdir(__dirname);
        } catch (e) {
            rootFiles = [`Error reading root: ${e.message}`];
        }

        res.json({
            DATA_DIR: dataDir,
            GLOBAL_USERS_FILE: usersFile,
            dataDirContents: files,
            rootDirContents: rootFiles,
            env: process.env.DATA_DIR || 'Not set'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
});

app.get('/api/config', authenticateToken, (req, res) => {
    res.json({ apiKey: process.env.API_KEY || '' });
});

    let vite;
    // Vite middleware for development
    if (process.env.NODE_ENV !== 'production') {
        vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'custom', // Use custom to handle index.html ourselves
        });
        app.use(vite.middlewares);
    }

    app.get('*', async (req, res) => {
        try {
            if (req.path.includes('.')) {
                return res.status(404).send('Not found');
            }
            
            let html = await fs.readFile(path.join(__dirname, 'index.html'), 'utf-8');
            
            if (process.env.NODE_ENV !== 'production' && vite) {
                // En desarrollo, Vite ya maneja index.tsx
                html = await vite.transformIndexHtml(req.url, html);
            } else {
                // En producción, cambiamos index.tsx por bundle.js (manejamos ambos casos por seguridad)
                html = html.replace('src="index.tsx"', 'src="bundle.js"');
                html = html.replace('src="/index.tsx"', 'src="/bundle.js"');
            }
            
            res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
        } catch (e) {
            console.error(e);
            res.status(500).end(e.message);
        }
    });

    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`ContaMiki Server: http://0.0.0.0:${PORT}`);
    });

    server.timeout = 300000;
    server.keepAliveTimeout = 300000;
}

startServer();
