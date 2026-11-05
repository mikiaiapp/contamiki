import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import dns from 'dns';

const ENABLE_BANKING_API_URL = 'https://api.enablebanking.com';

export class BankService {
    constructor({ appId, keyPath, appUrl, dataDir }) {
        this.appId = appId || 'a4b70785-ab0e-4c8f-b5da-4688b87f7dcf';
        this.keyPath = keyPath || path.join(dataDir, 'enablebanking.pem');
        this.appUrl = (appUrl || 'https://conta.mafede.i234.me').replace(/\/$/, '');
        this.dataDir = dataDir;
        this.connectionsFile = path.join(dataDir, 'bank_connections.json');
        this.ticketsInboxDir = path.join(dataDir, 'tickets_inbox');
        
        // Ensure directories exist
        if (!fs.existsSync(this.ticketsInboxDir)) {
            fs.mkdirSync(this.ticketsInboxDir, { recursive: true });
        }
    }

    getConfigFile() {
        return path.join(this.dataDir, 'bank_config.json');
    }

    getResolvedKeyPath() {
        const candidates = [
            this.keyPath,
            this.dataDir ? path.join(this.dataDir, 'enablebanking.pem') : null,
            '/app/data/enablebanking.pem',
            path.join(process.cwd(), 'data', 'enablebanking.pem')
        ].filter(Boolean);

        for (const p of candidates) {
            try {
                if (fs.existsSync(p)) {
                    this.keyPath = p;
                    return p;
                }
            } catch {}
        }
        return this.keyPath;
    }

    readConfig() {
        try {
            const cfgPath = this.getConfigFile();
            if (fs.existsSync(cfgPath)) {
                return JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
            }
        } catch {}
        return {
            appId: this.appId || 'a4b70785-ab0e-4c8f-b5da-4688b87f7dcf'
        };
    }

    async saveConfig({ appId, pemContent }) {
        const cfg = this.readConfig();
        if (appId && appId.trim()) {
            cfg.appId = appId.trim();
            this.appId = cfg.appId;
        }
        const resolvedKeyPath = this.getResolvedKeyPath();
        if (pemContent && pemContent.trim()) {
            fs.writeFileSync(resolvedKeyPath, pemContent.trim(), 'utf8');
        }
        cfg.updatedAt = new Date().toISOString();
        fs.writeFileSync(this.getConfigFile(), JSON.stringify(cfg, null, 2), 'utf8');
        return await this.getStatus();
    }

    /**
     * Generates a signed RS256 JWT for Enable Banking API
     */
    getJWT() {
        const cfg = this.readConfig();
        const activeAppId = cfg.appId || this.appId;
        const resolvedKeyPath = this.getResolvedKeyPath();
        if (!fs.existsSync(resolvedKeyPath)) {
            throw new Error(`Enable Banking key file not found at: ${resolvedKeyPath}`);
        }
        const privateKey = fs.readFileSync(resolvedKeyPath, 'utf8');
        const now = Math.floor(Date.now() / 1000);
        const payload = {
            iss: 'enablebanking.com',
            aud: 'api.enablebanking.com',
            iat: now,
            exp: now + 3600 // 1 hour
        };
        return jwt.sign(payload, privateKey, {
            algorithm: 'RS256',
            header: { kid: activeAppId }
        });
    }

    isPrivateIp(ip) {
        if (!ip) return true;
        const clean = ip.replace(/^.*:/, '').trim();
        if (clean === '127.0.0.1' || clean === '::1' || clean === 'localhost') return true;
        if (clean.startsWith('192.168.') || clean.startsWith('10.') || clean.startsWith('169.254.')) return true;
        if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(clean)) return true;
        return false;
    }

    async resolvePsuIp(providedIp) {
        if (providedIp && !this.isPrivateIp(providedIp)) {
            return providedIp;
        }

        const now = Date.now();
        if (this._cachedPublicIp && this._cachedPublicIpExpires && now < this._cachedPublicIpExpires) {
            return this._cachedPublicIp;
        }

        try {
            const hostname = new URL(this.appUrl).hostname;
            const res = await dns.promises.lookup(hostname);
            if (res && res.address && !this.isPrivateIp(res.address)) {
                this._cachedPublicIp = res.address;
                this._cachedPublicIpExpires = now + 2 * 3600 * 1000;
                return res.address;
            }
        } catch {}

        try {
            const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
            const data = await res.json();
            if (data.ip && !this.isPrivateIp(data.ip)) {
                this._cachedPublicIp = data.ip;
                this._cachedPublicIpExpires = now + 2 * 3600 * 1000;
                return data.ip;
            }
        } catch {}

        return '84.76.196.72';
    }

    async apiRequest(endpoint, method = 'GET', body = null, psuContext = {}) {
        const token = this.getJWT();
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
        };
        if (body) {
            headers['Content-Type'] = 'application/json';
        }

        // PSD2 PSU Context (Required for Spanish ASPSPs like CaixaBank, Santander, etc.)
        const psuIp = await this.resolvePsuIp(psuContext?.ip);
        if (psuIp) {
            headers['Psu-Ip-Address'] = psuIp;
        }
        headers['Psu-User-Agent'] = psuContext?.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

        const res = await fetch(`${ENABLE_BANKING_API_URL}${endpoint}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = new Error(data.message || data.detail || `API request failed with status ${res.status}`);
            err.status = res.status;
            err.data = data;
            throw err;
        }
        return data;
    }

    /**
     * Checks if Enable Banking app is active and key exists
     */
    async getStatus() {
        const resolvedKeyPath = this.getResolvedKeyPath();
        const keyExists = fs.existsSync(resolvedKeyPath);
        const cfg = this.readConfig();
        const activeAppId = cfg.appId || this.appId;
        let keySize = 0;
        if (keyExists) {
            try { keySize = fs.statSync(resolvedKeyPath).size; } catch {}
        }

        if (!keyExists) {
            return {
                configured: false,
                appId: activeAppId,
                keyExists: false,
                keySize: 0,
                keyPath: resolvedKeyPath,
                error: 'Archivo enablebanking.pem no encontrado'
            };
        }
        try {
            const appData = await this.apiRequest('/application');
            return {
                configured: true,
                appId: activeAppId,
                keyExists: true,
                keySize,
                keyPath: resolvedKeyPath,
                appActive: !!appData.active,
                appData
            };
        } catch (err) {
            return {
                configured: true,
                appId: activeAppId,
                keyExists: true,
                keySize,
                keyPath: resolvedKeyPath,
                appActive: false,
                error: err.message
            };
        }
    }

    /**
     * Retrieves all supported Spanish banks
     */
    async getSpanishBanks() {
        const data = await this.apiRequest('/aspsps?country=ES');
        return (data.aspsps || []).sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Initiates bank authorization flow
     */
    async startAuthorization({ aspspName, redirectUrl, state, psuContext = {} }) {
        const targetRedirect = redirectUrl || `${this.appUrl}/api/bank/callback`;
        const body = {
            access: {
                balances: true,
                transactions: true,
                valid_until: new Date(Date.now() + 89 * 24 * 3600 * 1000).toISOString()
            },
            aspsp: {
                country: 'ES',
                name: aspspName
            },
            psu_type: 'personal',
            redirect_url: targetRedirect,
            state: state || `auth_${Date.now()}`
        };

        const res = await this.apiRequest('/auth', 'POST', body, psuContext);
        return {
            url: res.url,
            authorizationId: res.authorization_id,
            state: body.state
        };
    }

    /**
     * Exchanges code for session and accounts
     */
    async exchangeCodeForSession(code, psuContext = {}) {
        return await this.apiRequest('/sessions', 'POST', { code }, psuContext);
    }

    /**
     * Retrieves transactions for an account
     */
    async getAccountTransactions(accountId, dateFrom, dateTo, psuContext = {}) {
        let endpoint = `/accounts/${accountId}/transactions?`;
        const params = [];
        if (dateFrom) params.push(`date_from=${encodeURIComponent(dateFrom)}`);
        if (dateTo) params.push(`date_to=${encodeURIComponent(dateTo)}`);
        endpoint += params.join('&');

        let allTransactions = [];
        let nextEndpoint = endpoint;
        const seenContinuationKeys = new Set();
        let pageCount = 0;

        while (nextEndpoint && pageCount < 20) {
            pageCount++;
            const data = await this.apiRequest(nextEndpoint, 'GET', null, psuContext);
            if (data.transactions && Array.isArray(data.transactions)) {
                allTransactions = allTransactions.concat(data.transactions);
            }
            if (data.continuation_key && !seenContinuationKeys.has(data.continuation_key)) {
                seenContinuationKeys.add(data.continuation_key);
                nextEndpoint = `${endpoint}&continuation_key=${encodeURIComponent(data.continuation_key)}`;
            } else {
                nextEndpoint = null;
            }
        }
        return allTransactions;
    }

    /**
     * Retrieves account balances
     */
    async getAccountBalances(accountId, psuContext = {}) {
        return await this.apiRequest(`/accounts/${accountId}/balances`, 'GET', null, psuContext);
    }

    // --- Persistence Helpers for Connections & Mappings ---

    readConnections() {
        try {
            if (!fs.existsSync(this.connectionsFile)) return [];
            return JSON.parse(fs.readFileSync(this.connectionsFile, 'utf8'));
        } catch {
            return [];
        }
    }

    saveConnections(connections) {
        fs.writeFileSync(this.connectionsFile, JSON.stringify(connections, null, 2), 'utf8');
    }

    getUserConnections(username) {
        const all = this.readConnections();
        return all.filter(c => c.username === username);
    }

    saveUserConnection(username, sessionData) {
        const all = this.readConnections();
        const existingIdx = all.findIndex(c => c.sessionId === sessionData.session_id);
        
        const accounts = (sessionData.accounts || []).map(acc => ({
            uid: acc.uid || acc.id || acc.account_id?.iban,
            iban: acc.account_id?.iban || acc.iban || '',
            currency: acc.currency || acc.account_id?.currency || 'EUR',
            name: acc.details || acc.product || acc.account_id?.iban || 'Cuenta Bancaria',
            mappedBookId: null,
            mappedAccountId: null,
            enabled: true,
            lastSync: null
        }));

        const newConn = {
            id: `conn_${Date.now()}`,
            username,
            sessionId: sessionData.session_id,
            aspsp: sessionData.aspsp || { name: 'Banco' },
            accounts,
            createdAt: new Date().toISOString()
        };

        if (existingIdx !== -1) {
            // preserve existing account mappings
            const oldAccounts = all[existingIdx].accounts || [];
            newConn.accounts = newConn.accounts.map(acc => {
                const old = oldAccounts.find(o => o.uid === acc.uid || o.iban === acc.iban);
                if (old) {
                    return {
                        ...acc,
                        mappedBookId: old.mappedBookId,
                        mappedAccountId: old.mappedAccountId,
                        enabled: old.enabled,
                        lastSync: old.lastSync,
                        lastBankBalance: old.lastBankBalance,
                        lastContaBalance: old.lastContaBalance,
                        lastBalanceDiff: old.lastBalanceDiff,
                        lastIsCuadrado: old.lastIsCuadrado,
                        lastBalanceCheck: old.lastBalanceCheck
                    };
                }
                return acc;
            });
            all[existingIdx] = newConn;
        } else {
            all.push(newConn);
        }

        this.saveConnections(all);
        return newConn;
    }

    updateAccountMapping(username, { connectionId, accountUid, bookId, accountId, enabled }) {
        const all = this.readConnections();
        const conn = all.find(c => c.username === username && c.id === connectionId);
        if (!conn) throw new Error('Conexión bancaria no encontrada');

        const acc = (conn.accounts || []).find(a => a.uid === accountUid);
        if (!acc) throw new Error('Cuenta bancaria no encontrada');

        if (bookId !== undefined) acc.mappedBookId = bookId;
        if (accountId !== undefined) acc.mappedAccountId = accountId;
        if (enabled !== undefined) acc.enabled = enabled;

        this.saveConnections(all);
        return acc;
    }

    deleteConnection(username, connectionId) {
        const all = this.readConnections();
        const filtered = all.filter(c => !(c.username === username && c.id === connectionId));
        this.saveConnections(filtered);
    }

    updateAccountLastSync(username, connectionId, accountUid, lastSyncIso) {
        const all = this.readConnections();
        const conn = all.find(c => c.username === username && c.id === connectionId);
        if (conn) {
            const acc = (conn.accounts || []).find(a => a.uid === accountUid);
            if (acc) {
                acc.lastSync = lastSyncIso;
                this.saveConnections(all);
            }
        }
    }

    updateAccountBalanceInfo(username, connectionId, accountUid, balanceInfo) {
        const all = this.readConnections();
        const conn = all.find(c => c.username === username && c.id === connectionId);
        if (conn) {
            const acc = (conn.accounts || []).find(a => a.uid === accountUid);
            if (acc) {
                acc.lastBankBalance = balanceInfo.bankBalance;
                acc.lastContaBalance = balanceInfo.contaBalance;
                acc.lastBalanceDiff = balanceInfo.diff;
                acc.lastIsCuadrado = balanceInfo.isCuadrado;
                acc.lastHoldsAmount = balanceInfo.holdsAmount || 0;
                acc.lastBalanceCheck = balanceInfo.checkedAt;
                this.saveConnections(all);
            }
        }
    }
}

