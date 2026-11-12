import fs from 'fs';
import path from 'path';

// Descripción de un movimiento bancario (Enable Banking / ASPSP)
function extractBankDescription(bTx) {
    let desc = '';
    if (Array.isArray(bTx.remittance_information) && bTx.remittance_information.length > 0) {
        desc = bTx.remittance_information.filter(Boolean).join(' ').trim();
    } else if (typeof bTx.remittance_information === 'string' && bTx.remittance_information.trim()) {
        desc = bTx.remittance_information.trim();
    } else if (bTx.remittance_information_unstructured) {
        desc = bTx.remittance_information_unstructured.trim();
    }
    if (!desc) {
        desc = bTx.creditor_name || bTx.debtor_name || bTx.additional_information || bTx.details || bTx.description || bTx.entry_reference || 'Movimiento bancario';
    }
    return desc;
}

const cleanText = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Identificador propio del banco para el movimiento, si lo da (permite reconocerlo aunque cambie la fecha, el signo o el texto)
const bankRefOf = (bTx) => bTx.entry_reference || bTx.transaction_id || bTx.internal_transaction_id || null;

export class SyncEngine {
    constructor({ bankService, notificationService, ticketsInboxDir }) {
        this.bankService = bankService;
        this.notificationService = notificationService;
        this.ticketsInboxDir = ticketsInboxDir;
    }

    /**
     * Extracts clean merchant name from bank/POS terminal strings
     * E.g. "PAGO MOVIL EN PEM GUIERA, CERDANYOLA ES, TARJ. :*355035" -> "pem guiera"
     * E.g. "COMPRA EN LIDL ST CUGAT, SANT CUGAT..." -> "lidl st cugat"
     * E.g. "RECIBO C.P. LA BASSA 1..." -> "c.p. la bassa 1"
     */
    extractMerchantClean(desc) {
        if (!desc) return '';
        const d = desc.toLowerCase().trim();
        const posMatch = d.match(/(?:pago\s+m[oó]vil\s+en|compra\s+(?:pago\s+m[oó]vil\s+en\s+)?en|compra\s+|recibo\s+)(.+?)(?:,|\s+tarj|\s+n[ºo]|\s+ref|\s+dees|\s+es\b|$)/i);
        if (posMatch && posMatch[1].trim().length >= 3) {
            return posMatch[1].trim();
        }
        return '';
    }

    /**
     * Attempts to find a matching category based on historical merchant descriptions and category names
     */
    findCategorySuggestion(description, txType, historicalTxs, categories, families = []) {
        if (!description || !categories || categories.length === 0) {
            return { categoryId: '', familyId: '', confidence: 'NONE' };
        }

        const cleanDesc = description.toLowerCase().trim();
        const allowedFamilies = families.filter(f => f.type === txType).map(f => f.id);
        const candidateCats = categories.filter(c => allowedFamilies.length === 0 || allowedFamilies.includes(c.familyId));

        // 1. Direct category name match
        for (const cat of candidateCats) {
          const catNameClean = cat.name.toLowerCase().trim();
          if (catNameClean.length >= 4 && cleanDesc.includes(catNameClean)) {
            return { categoryId: cat.id, familyId: cat.familyId, confidence: 'HIGH' };
          }
        }

        if (!historicalTxs || historicalTxs.length === 0) {
            return { categoryId: '', familyId: '', confidence: 'NONE' };
        }

        // 2. Extracted Merchant Match (e.g. "pem guiera")
        const merchant = this.extractMerchantClean(cleanDesc);
        if (merchant && merchant.length >= 3) {
            const merchantTxs = historicalTxs.filter(t => 
                t.categoryId && (!t.type || t.type === txType) &&
                (t.description || '').toLowerCase().includes(merchant)
            );
            if (merchantTxs.length > 0) {
                // Count category votes among these exact merchant transactions with recency weighting
                const votes = new Map();
                for (const t of merchantTxs) {
                    const weight = (t.date && t.date >= '2025-01-01') ? 3 : 1;
                    votes.set(t.categoryId, (votes.get(t.categoryId) || 0) + weight);
                }
                let bestCatId = null;
                let maxVotes = 0;
                for (const [cid, v] of votes.entries()) {
                    if (v > maxVotes) {
                        maxVotes = v;
                        bestCatId = cid;
                    }
                }
                if (bestCatId && maxVotes >= 2) {
                    const cat = candidateCats.find(c => c.id === bestCatId);
                    if (cat) {
                        return { categoryId: cat.id, familyId: cat.familyId, confidence: 'HIGH' };
                    }
                }
            }
        }

        // 3. Multi-token weighted matching with comprehensive Stop Words (Spanish banking, cities, generic terms)
        const STOP_WORDS = new Set([
            'pago', 'movil', 'en', 'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'por', 'para',
            'tarjeta', 'tarj', 'compra', 'recibo', 'transferencia', 'trans', 'abono', 'cargo',
            'liquidacion', 'periodica', 'ref', 'mandato', 'bizum', 'orden', 'emisor', 'beneficiario',
            'operacion', 'autorizacion', 'dees', 'es', 'esp', 'spain', 'numero', 'cta', 'cuenta', 'favor',
            'concepto', 'barcelona', 'madrid', 'banco', 'santander', 'caixabank', 'bankinter',
            'cerdanyola', 'valles', 'ripollet', 'sabadell', 'terrassa', 'sant', 'cugat', 'badalona',
            'montcada', 'mollet', 'zaragoza', 'andorra', 'cork'
        ]);

        const tokens = cleanDesc.split(/[^a-záéíóúñ0-9]+/).filter(w => w.length >= 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
        if (tokens.length === 0) {
            return { categoryId: '', familyId: '', confidence: 'NONE' };
        }

        const catScores = new Map();
        for (const t of historicalTxs) {
            if (!t.categoryId || (t.type && t.type !== txType)) continue;
            const cat = candidateCats.find(c => c.id === t.categoryId);
            if (!cat) continue;

            const pastClean = (t.description || '').toLowerCase();
            let matchedCount = 0;
            let score = 0;
            for (const token of tokens) {
                if (pastClean.includes(token)) {
                    matchedCount++;
                    score += Math.pow(token.length, 1.5);
                }
            }

            // Must match at least 2 tokens, OR 1 strong distinctive token (length >= 5)
            const hasStrongToken = tokens.some(tk => tk.length >= 5 && pastClean.includes(tk));
            if (matchedCount >= 2 || (matchedCount === 1 && hasStrongToken)) {
                const recencyMultiplier = (t.date && t.date >= '2025-01-01') ? 2 : 1;
                const cooccurrenceMultiplier = Math.pow(matchedCount, 1.5);
                const finalScore = score * recencyMultiplier * cooccurrenceMultiplier;
                catScores.set(cat.id, (catScores.get(cat.id) || 0) + finalScore);
            }
        }

        let bestCatId = null;
        let maxScore = 0;
        for (const [catId, score] of catScores.entries()) {
            if (score > maxScore) {
                maxScore = score;
                bestCatId = catId;
            }
        }

        if (bestCatId && maxScore >= 20) {
            const cat = candidateCats.find(c => c.id === bestCatId);
            if (cat) {
                return { categoryId: cat.id, familyId: cat.familyId, confidence: 'HIGH' };
            }
        }

        return { categoryId: '', familyId: '', confidence: 'NONE' };
    }

    /**
     * Extracts official accounting balance and detects holds (retenciones) from Enable Banking balances payload
     */
    extractBankBalance(balancesResponse) {
        if (!balancesResponse || !Array.isArray(balancesResponse.balances) || balancesResponse.balances.length === 0) {
            return null;
        }
        const balances = balancesResponse.balances;
        const clbd = balances.find(b => b.balance_type === 'CLBD');
        const opbd = balances.find(b => b.balance_type === 'OPBD');

        const clbdAmt = (clbd && clbd.balance_amount && clbd.balance_amount.amount !== undefined)
            ? parseFloat(clbd.balance_amount.amount) : null;
        const opbdAmt = (opbd && opbd.balance_amount && opbd.balance_amount.amount !== undefined)
            ? parseFloat(opbd.balance_amount.amount) : null;

        // Si el banco ofrece OPBD (movimientos consolidados) y CLBD (saldo contable tras retenciones de tarjeta),
        // la diferencia es el importe total de retenciones pendientes
        let holdsAmount = 0;
        if (clbdAmt !== null && opbdAmt !== null && Math.abs(clbdAmt - opbdAmt) > 0.005) {
            holdsAmount = Math.round(Math.abs(opbdAmt - clbdAmt) * 100) / 100;
        }

        const primary = clbd || opbd || balances.find(b => b.balance_amount && b.balance_amount.amount !== undefined);
        if (!primary) return null;

        const primaryAmt = parseFloat(primary.balance_amount.amount);

        return {
            amount: opbdAmt !== null ? opbdAmt : (clbdAmt !== null ? clbdAmt : primaryAmt),
            bookedAmount: opbdAmt !== null ? opbdAmt : (clbdAmt !== null ? clbdAmt : primaryAmt),
            closingAmount: clbdAmt !== null ? clbdAmt : (opbdAmt !== null ? opbdAmt : primaryAmt),
            holdsAmount,
            currency: primary.balance_amount.currency || 'EUR',
            type: primary.balance_type || primary.name || 'Contable',
            referenceDate: primary.reference_date || (clbd ? clbd.reference_date : null)
        };
    }

    /**
     * Computes the current balance of an account in ContaMiki across all book transactions
     */
    calculateAccountBalance(bookData, accountId) {
        if (!bookData) return 0;
        const contaAcc = (bookData.accounts || []).find(a => a.id === accountId);
        let balance = contaAcc ? (Number(contaAcc.initialBalance) || 0) : 0;

        for (const t of (bookData.transactions || [])) {
            let eff = Number(t.amount);
            if (t.type === 'EXPENSE' || t.type === 'TRANSFER') {
                eff = -Math.abs(eff);
            } else {
                eff = Math.abs(eff);
            }

            if (t.accountId === accountId) {
                balance += eff;
            }
            if (t.type === 'TRANSFER' && t.transferAccountId === accountId) {
                balance -= eff;
            }
        }
        return Math.round(balance * 100) / 100;
    }

    /**
     * Parses tickets in inbox and matches against transactions
     */
    async matchTicketsInbox(bookTransactions) {
        if (!fs.existsSync(this.ticketsInboxDir)) return { matched: 0, pending: 0, details: [] };

        const files = fs.readdirSync(this.ticketsInboxDir);
        let matchedCount = 0;
        const details = [];

        for (const file of files) {
            const filePath = path.join(this.ticketsInboxDir, file);
            const ext = path.extname(file).toLowerCase();
            if (!['.pdf', '.jpg', '.jpeg', '.png'].includes(ext)) continue;

            let ticketDate = null;
            let ticketAmount = null;

            // 1. Detección de fecha en el nombre: YYYYMMDD, YYYY-MM-DD o YYYY_MM_DD
            const dateMatch = file.match(/(?:^|[^0-9])(20\d{2})[-_]?(\d{2})[-_]?(\d{2})(?:[^0-9]|$)/);
            if (dateMatch) {
                ticketDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
            }

            // 2. Detección de importe en el nombre: SOLO si tiene formato de moneda/decimales (ej. 41.77, 41_77, 41,77 o ' 41 €')
            const nameWithoutDate = file.replace(/(?:^|[^0-9])(20\d{2})[-_]?(\d{2})[-_]?(\d{2})(?:[^0-9]|$)/, ' ').replace(/\.[^.]+$/, '');
            const amtDecMatch = nameWithoutDate.match(/(?:^|[^0-9])(\d{1,5})[.,_](\d{2})(?:[^0-9]|$)/);
            if (amtDecMatch) {
                ticketAmount = parseFloat(`${amtDecMatch[1]}.${amtDecMatch[2]}`);
            } else {
                // Solo aceptar enteros si están explícitamente etiquetados con símbolo de euro
                const amtEuroMatch = nameWithoutDate.match(/(?:^|[^0-9])(\d{1,4})\s*(?:€|EUR)(?:[^0-9]|$)/i);
                if (amtEuroMatch) {
                    ticketAmount = parseFloat(amtEuroMatch[1]);
                }
            }

            // 3. Si es PDF, analizar el documento con pdf-parse para extraer fecha e importe oficial
            if (ext === '.pdf') {
                try {
                    const buf = fs.readFileSync(filePath);
                    let pdfText = '';
                    try {
                        const { PDFParse } = await import('pdf-parse');
                        const parser = new PDFParse(new Uint8Array(buf));
                        const parsed = await parser.getText();
                        pdfText = parsed.text || parsed || '';
                    } catch (pErr) {
                        pdfText = buf.toString('latin1');
                    }

                    if (pdfText) {
                        // Extraer fecha del documento si no venía en el nombre
                        if (!ticketDate) {
                            const pdfDateMatch = pdfText.match(/(?:Cobrado el|Fecha|FECHA|fecha)[\s:]*(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})/i)
                                              || pdfText.match(/\b(\d{1,2})[\/\.-](\d{1,2})[\/\.-](20\d{2})\b/);
                            if (pdfDateMatch) {
                                let y = pdfDateMatch[3];
                                if (y.length === 2) y = '20' + y;
                                const m = pdfDateMatch[2].padStart(2, '0');
                                const d = pdfDateMatch[1].padStart(2, '0');
                                ticketDate = `${y}-${m}-${d}`;
                            }
                        }

                        // Extraer importe oficial del documento si no venía explícito en el nombre
                        if (!ticketAmount) {
                            const totalMatches = [...pdfText.matchAll(/(?:TOTAL|IMPORTE\s*TOTAL|Total\s*a\s*pagar|Total)[\s:]*([\d.,]+)\s*(?:€|EUR)?/gi)];
                            for (const m of totalMatches) {
                                const val = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
                                if (!isNaN(val) && val > 0) {
                                    ticketAmount = val;
                                    if (m[0].startsWith('TOTAL')) break;
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.warn(`[TICKET PARSER] Error analizando PDF ${file}:`, e.message);
                }
            }

            if (!ticketAmount) continue;

            // Search in book transactions: same amount, date +- 3 days
            const candidates = bookTransactions.filter(t => {
                if (t.attachment) return false; // already has attachment
                const txAmt = Math.abs(Number(t.amount));
                if (Math.abs(txAmt - ticketAmount) >= 0.01) return false;

                if (!ticketDate) return true; // match purely by exact amount if date unavailable
                if (t.date === ticketDate) return true;

                // check +- 3 days
                const tDate = new Date(t.date);
                const tkDate = new Date(ticketDate);
                const diffDays = Math.abs((tDate - tkDate) / (1000 * 60 * 60 * 24));
                return diffDays <= 3;
            });

            if (candidates.length > 0) {
                // Si hay varios candidatos y tenemos fecha, priorizar la transacción más cercana a la fecha del ticket
                if (ticketDate && candidates.length > 1) {
                    const tkDate = new Date(ticketDate);
                    candidates.sort((a, b) => Math.abs(new Date(a.date) - tkDate) - Math.abs(new Date(b.date) - tkDate));
                }
                const candidate = candidates[0];
                // Convert file to base64 Data URI
                const fileBuf = fs.readFileSync(filePath);
                let mime = 'application/pdf';
                if (['.jpg', '.jpeg'].includes(ext)) mime = 'image/jpeg';
                else if (ext === '.png') mime = 'image/png';

                candidate.attachment = `data:${mime};base64,${fileBuf.toString('base64')}`;

                // Remove from inbox
                fs.unlinkSync(filePath);
                matchedCount++;
                details.push({
                    file,
                    txId: candidate.id,
                    date: candidate.date,
                    amount: candidate.amount,
                    desc: candidate.description
                });
            }
        }

        const remainingFiles = fs.readdirSync(this.ticketsInboxDir).filter(f => 
            ['.pdf', '.jpg', '.jpeg', '.png'].includes(path.extname(f).toLowerCase())
        );

        return {
            matched: matchedCount,
            pending: remainingFiles.length,
            details
        };
    }

    /**
     * Executes the daily or manual sync: banks + categorization + tickets + notifications
     * Optionally accepts accountUids to synchronize only a subset of mapped accounts
     */
    async syncUser(username, { readFullUserState, saveFullUserState, accountUids = null, isScheduled = false, psuContext = {} }) {
        const connections = this.bankService.getUserConnections(username);
        let mappedAccounts = [];
        
        for (const conn of connections) {
            for (const acc of (conn.accounts || [])) {
                if (acc.enabled && acc.mappedBookId && acc.mappedAccountId) {
                    mappedAccounts.push({ ...acc, connectionId: conn.id, aspspName: conn.aspsp?.name || 'Banco' });
                }
            }
        }

        // Si se especifican cuentas concretas, filtrar solo por esos UIDs
        if (Array.isArray(accountUids) && accountUids.length > 0) {
            mappedAccounts = mappedAccounts.filter(acc => accountUids.includes(acc.uid));
        }

        if (mappedAccounts.length === 0) {
            return { success: true, message: 'No hay cuentas bancarias seleccionadas o mapeadas para sincronizar.', newTxs: 0, matchedTickets: 0, syncedAccountsCount: 0, balanceReconciliations: [] };
        }

        const userState = await readFullUserState(username);
        let totalNewTxs = 0;
        const categorizedTxsSummary = [];
        const pendingTxsSummary = [];
        const signMismatches = [];   // movimientos ya importados pero con el signo/tipo contrario al que da el banco: no se duplican, se avisan para revisar
        const balanceReconciliations = [];

        // 1. Fetch transactions for each mapped account
        const today = new Date().toISOString().split('T')[0];
        const affectedBookIds = new Set();

        for (const mapped of mappedAccounts) {
            const bookData = userState.booksData[mapped.mappedBookId];
            if (!bookData) continue;
            affectedBookIds.add(mapped.mappedBookId);

            // Rango dinámico: 60 días en la primera sincronización, o últimos 4 días si ya se sincronizó
            const dateFrom = mapped.lastSync 
                ? new Date(new Date(mapped.lastSync).getTime() - 4 * 24 * 3600 * 1000).toISOString().split('T')[0]
                : new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString().split('T')[0];

            let bankTxs = [];
            try {
                console.log(`[SYNC] Descargando movimientos para ${mapped.name || mapped.uid} (${dateFrom} -> ${today})...`);
                bankTxs = await this.bankService.getAccountTransactions(mapped.uid, dateFrom, today, psuContext);
                console.log(`[SYNC] ${bankTxs.length} movimientos recibidos de ${mapped.aspspName}`);
                // Los movimientos aún pendientes (PDNG) pueden cambiar al contabilizarse: se importan cuando estén contabilizados
                const pendientes = bankTxs.filter(t => String(t.status || '').toUpperCase() === 'PDNG').length;
                if (pendientes > 0) {
                    console.log(`[SYNC] ${pendientes} movimiento(s) pendiente(s) (PDNG) ignorados hasta que se contabilicen`);
                    bankTxs = bankTxs.filter(t => String(t.status || '').toUpperCase() !== 'PDNG');
                }
            } catch (err) {
                console.error(`[SYNC ERROR] Error fetching transactions for ${mapped.name}:`, err.message);
                continue;
            }

            const existingTxs = bookData.transactions || [];
            const categories = bookData.categories || [];
            const families = bookData.families || [];

            // Conjunto para evitar que un mismo apunte existente deduplique múltiples movimientos bancarios
            const matchedExistingIds = new Set();

            // PASO 1: Casar primero todas las coincidencias EXACTAS de fecha e importe
            for (const bTx of bankTxs) {
                const bookingDate = bTx.booking_date || bTx.value_date || today;
                const absAmt = Math.abs(parseFloat(bTx.transaction_amount?.amount || bTx.amount || 0));
                const isDebit = bTx.credit_debit_indicator === 'DBIT' || bTx.amount < 0;
                const finalAmount = isDebit ? -absAmt : absAmt;

                // a) Mismo identificador del banco (si lo da): es el mismo movimiento aunque haya cambiado la fecha, el signo o el texto
                const ref = bankRefOf(bTx);
                let match = ref
                    ? existingTxs.find(t => !matchedExistingIds.has(t.id) && t.bankRef === ref && t.accountId === mapped.mappedAccountId)
                    : null;

                // b) Misma fecha, importe y sentido; si hay varios candidatos, primero el que tiene el mismo concepto (así un pago no «consume» el apunte de su anulación)
                const conceptoBanco = cleanText(extractBankDescription(bTx));
                if (!match) {
                    const candidatos = existingTxs.filter(t => {
                    if (matchedExistingIds.has(t.id)) return false;
                    const isDirectAcc = t.accountId === mapped.mappedAccountId;
                    const isTransferAcc = (t.type === 'TRANSFER' && t.transferAccountId === mapped.mappedAccountId);
                    if (!isDirectAcc && !isTransferAcc) return false;

                    const sameAmount = Math.abs(Math.abs(Number(t.amount)) - absAmt) < 0.005;
                    const correctFlow = isDebit
                        ? (t.type === 'EXPENSE' || (t.type === 'TRANSFER' && isDirectAcc))
                        : (t.type === 'INCOME' || (t.type === 'TRANSFER' && isTransferAcc));

                    return sameAmount && correctFlow && t.date === bookingDate;
                    });
                    match = candidatos.find(t => conceptoBanco && cleanText(t.description) === conceptoBanco) || candidatos[0] || null;
                }

                // c) Respaldo: misma fecha, mismo importe y MISMO CONCEPTO, aunque el apunte existente tenga el sentido contrario
                //    (p. ej. una «ANULACION…» importada antes como gasto). No se duplica; se avisa para corregir el signo.
                if (!match) {
                    const dBank = cleanText(extractBankDescription(bTx));
                    if (dBank) {
                        const sameConcept = existingTxs.find(t => {
                            if (matchedExistingIds.has(t.id) || t.accountId !== mapped.mappedAccountId || t.date !== bookingDate) return false;
                            return Math.abs(Math.abs(Number(t.amount)) - absAmt) < 0.005 && cleanText(t.description) === dBank;
                        });
                        if (sameConcept) {
                            match = sameConcept;
                            signMismatches.push({ date: bookingDate, amount: finalAmount, desc: extractBankDescription(bTx), existingAmount: Number(sameConcept.amount), existingType: sameConcept.type });
                        }
                    }
                }

                if (match) {
                    if (ref && !match.bankRef) match.bankRef = ref;
                    matchedExistingIds.add(match.id);
                    bTx._matchedExistingId = match.id;
                }
            }

            for (const bTx of bankTxs) {
                if (bTx._matchedExistingId) continue; // ya casada exactamente por fecha e importe

                const bookingDate = bTx.booking_date || bTx.value_date || today;
                
                // Signo e importe correcto según PSD2 / Enable Banking
                const absAmt = Math.abs(parseFloat(bTx.transaction_amount?.amount || bTx.amount || 0));
                // DBIT = Cargo (Gasto / Salida de dinero), CRDT = Abono (Ingreso / Entrada de dinero)
                const isDebit = bTx.credit_debit_indicator === 'DBIT' || bTx.amount < 0;
                const txType = isDebit ? 'EXPENSE' : 'INCOME';
                const finalAmount = isDebit ? -absAmt : absAmt;
                
                const desc = extractBankDescription(bTx);

                // PASO 2: Para movimientos bancarios no casados exactamente, verificar si existe un apunte manual (+-2 días) que coincida en concepto/comercio
                const manualMatch = existingTxs.find(t => {
                    if (matchedExistingIds.has(t.id)) return false;
                    if (t.isFromBankSync) return false; // dos apuntes de banco nunca son duplicados si tienen fechas distintas

                    const isDirectAcc = t.accountId === mapped.mappedAccountId;
                    const isTransferAcc = (t.type === 'TRANSFER' && t.transferAccountId === mapped.mappedAccountId);
                    if (!isDirectAcc && !isTransferAcc) return false;

                    const sameAmount = Math.abs(Math.abs(Number(t.amount)) - absAmt) < 0.005;
                    const correctFlow = isDebit
                        ? (t.type === 'EXPENSE' || (t.type === 'TRANSFER' && isDirectAcc))
                        : (t.type === 'INCOME' || (t.type === 'TRANSFER' && isTransferAcc));

                    if (!sameAmount || !correctFlow) return false;

                    const tDate = new Date(t.date).getTime();
                    const bDate = new Date(bookingDate).getTime();
                    const diffDays = Math.abs((tDate - bDate) / (1000 * 3600 * 24));
                    if (diffDays > 2) return false;

                    const clean = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                    const c1 = clean(t.description);
                    const c2 = clean(desc);
                    return c1 && c2 && (c1.includes(c2) || c2.includes(c1));
                });

                if (manualMatch) {
                    matchedExistingIds.add(manualMatch.id);
                    continue;
                }

                // Categorización automática por aprendizaje histórico
                    const suggestion = this.findCategorySuggestion(desc, txType, existingTxs, categories, families);
                    const hasCategory = Boolean(suggestion.categoryId);
                    const matchedCat = hasCategory ? categories.find(c => c.id === suggestion.categoryId) : null;

                    const newTx = {
                        id: `tx_${Math.random().toString(36).substring(2, 12)}`,
                        date: bookingDate,
                        amount: finalAmount,
                        description: desc.trim(),
                        accountId: mapped.mappedAccountId,
                        type: txType,
                        categoryId: suggestion.categoryId || '',
                        familyId: suggestion.familyId || '',
                        isValidated: hasCategory,
                        isPendingCategorization: !hasCategory,
                        isReviewed: false,
                        isFromBankSync: true,
                        ...(bankRefOf(bTx) ? { bankRef: bankRefOf(bTx) } : {})
                    };

                    existingTxs.push(newTx);
                    totalNewTxs++;

                    if (hasCategory && matchedCat) {
                        categorizedTxsSummary.push({
                            date: newTx.date,
                            amount: newTx.amount,
                            desc: newTx.description,
                            catName: matchedCat.name
                        });
                    } else {
                        pendingTxsSummary.push({
                            date: newTx.date,
                            amount: newTx.amount,
                            desc: newTx.description
                        });
                    }
                }

            // Obtener saldo bancario en tiempo real para cuadre contable
            let bankBalInfo = null;
            try {
                const balRes = await this.bankService.getAccountBalances(mapped.uid, psuContext);
                bankBalInfo = this.extractBankBalance(balRes);
            } catch (balErr) {
                console.warn(`[SYNC] No se pudo obtener saldo bancario para ${mapped.name || mapped.uid}:`, balErr.message);
            }

            const contaBalance = this.calculateAccountBalance(bookData, mapped.mappedAccountId);
            const contaAcc = (bookData.accounts || []).find(a => a.id === mapped.mappedAccountId);
            const accountDisplayName = contaAcc ? contaAcc.name : (mapped.name || 'Cuenta Bancaria');

            if (bankBalInfo !== null) {
                let isCuadrado = false;
                let diff = 0;
                let targetBankBalance = bankBalInfo.amount;

                // Si el saldo de ContaMiki coincide con los movimientos consolidados (bookedAmount)
                // o con el saldo contable (closingAmount), la cuenta está totalmente cuadrada
                if (bankBalInfo.bookedAmount !== null && Math.abs(contaBalance - bankBalInfo.bookedAmount) < 0.01) {
                    isCuadrado = true;
                    diff = 0;
                    targetBankBalance = bankBalInfo.bookedAmount;
                } else if (bankBalInfo.closingAmount !== null && Math.abs(contaBalance - bankBalInfo.closingAmount) < 0.01) {
                    isCuadrado = true;
                    diff = 0;
                    targetBankBalance = bankBalInfo.closingAmount;
                } else {
                    targetBankBalance = bankBalInfo.bookedAmount !== null ? bankBalInfo.bookedAmount : bankBalInfo.closingAmount;
                    diff = Math.round((contaBalance - targetBankBalance) * 100) / 100;
                    isCuadrado = Math.abs(diff) < 0.01;
                }

                balanceReconciliations.push({
                    uid: mapped.uid,
                    connectionId: mapped.connectionId,
                    aspspName: mapped.aspspName,
                    accountName: accountDisplayName,
                    iban: mapped.iban,
                    bankBalance: targetBankBalance,
                    contaBalance,
                    diff,
                    isCuadrado,
                    holdsAmount: bankBalInfo.holdsAmount || 0,
                    referenceDate: bankBalInfo.referenceDate
                });

                if (this.bankService && typeof this.bankService.updateAccountBalanceInfo === 'function') {
                    this.bankService.updateAccountBalanceInfo(username, mapped.connectionId, mapped.uid, {
                        bankBalance: targetBankBalance,
                        contaBalance,
                        diff,
                        isCuadrado,
                        holdsAmount: bankBalInfo.holdsAmount || 0,
                        checkedAt: new Date().toISOString()
                    });
                }
            } else {
                balanceReconciliations.push({
                    uid: mapped.uid,
                    connectionId: mapped.connectionId,
                    aspspName: mapped.aspspName,
                    accountName: accountDisplayName,
                    iban: mapped.iban,
                    bankBalance: null,
                    contaBalance,
                    diff: null,
                    isCuadrado: false,
                    holdsAmount: 0
                });
            }

            const nowIso = new Date().toISOString();
            mapped.lastSync = nowIso;
            if (this.bankService && typeof this.bankService.updateAccountLastSync === 'function') {
                this.bankService.updateAccountLastSync(username, mapped.connectionId, mapped.uid, nowIso);
            }
        }

        // 2. Emparejamiento de tickets en todas las contabilidades del usuario
        let totalMatched = 0;
        let totalPending = 0;
        const allBookIds = new Set([
            ...affectedBookIds,
            userState.currentBookId,
            ...Object.keys(userState.booksData || {})
        ].filter(Boolean));

        for (const bookId of allBookIds) {
            const bData = userState.booksData[bookId];
            if (bData && bData.transactions) {
                const ticketResult = await this.matchTicketsInbox(bData.transactions);
                totalMatched += ticketResult.matched;
                totalPending = ticketResult.pending;
            }
        }

        // 3. Guardar estado del usuario
        await saveFullUserState(username, userState);

        const formatMoney = (val) => {
            if (val === null || val === undefined || isNaN(val)) return '0,00 €';
            return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) + ' €';
        };

        // 4. Enviar notificación multicanal si hubo actividad o cuadre de saldos
        const hasDifferences = balanceReconciliations.some(r => r.bankBalance !== null && !r.isCuadrado);
        const shouldNotify = totalNewTxs > 0 || totalMatched > 0 || totalPending > 0 || hasDifferences || signMismatches.length > 0 || isScheduled;

        if (shouldNotify) {
            const lines = [];

            if (categorizedTxsSummary.length > 0) {
                lines.push(`<b>✅ Categorizados automáticamente (${categorizedTxsSummary.length}):</b>`);
                for (const item of categorizedTxsSummary) {
                    lines.push(`• ${item.date} | ${item.amount > 0 ? '+' : ''}${item.amount.toFixed(2)} € | ${item.desc} ➔ <b>${item.catName}</b>`);
                }
            }

            if (pendingTxsSummary.length > 0) {
                lines.push(`<b>⚠️ Pendientes de categorizar (${pendingTxsSummary.length}):</b>`);
                for (const item of pendingTxsSummary) {
                    lines.push(`• ${item.date} | ${item.amount > 0 ? '+' : ''}${item.amount.toFixed(2)} € | ${item.desc} ➔ <i>🔴 Pendiente</i>`);
                }
            }

            if (signMismatches.length > 0) {
                lines.push(`<b>🔁 Ya estaban importados, con el signo contrario (revisar) (${signMismatches.length}):</b>`);
                for (const m of signMismatches) {
                    lines.push(`• ${m.date} | banco ${m.amount > 0 ? '+' : ''}${m.amount.toFixed(2)} € | en ContaMiki ${m.existingAmount > 0 ? '+' : ''}${m.existingAmount.toFixed(2)} € (${m.existingType}) | ${m.desc}`);
                }
            }

            if (balanceReconciliations.length > 0) {
                lines.push(`<b>⚖️ Cuadre de saldos:</b>`);
                for (const rec of balanceReconciliations) {
                    if (rec.bankBalance === null) {
                        lines.push(`• <b>${rec.accountName} (${rec.aspspName}):</b> Saldo no disponible en la API`);
                    } else if (rec.isCuadrado) {
                        const holdsNote = (rec.holdsAmount && rec.holdsAmount > 0)
                            ? ` <i>(${formatMoney(rec.holdsAmount)} en retenciones pendientes en el banco)</i>`
                            : '';
                        lines.push(`• <b>${rec.accountName}:</b> El saldo de <b>${formatMoney(rec.bankBalance)}</b> está cuadrado ✅${holdsNote}`);
                    } else {
                        const diffSign = rec.diff > 0 ? '+' : '';
                        const holdsNote = (rec.holdsAmount && rec.holdsAmount > 0)
                            ? ` <i>(Retenciones en el banco: ${formatMoney(rec.holdsAmount)})</i>`
                            : '';
                        lines.push(`• <b>${rec.accountName}:</b> Banco ${formatMoney(rec.bankBalance)} vs ContaMiki ${formatMoney(rec.contaBalance)} (Diferencia: <b>${diffSign}${formatMoney(rec.diff)}</b>) ⚠️${holdsNote}`);
                    }
                }
            }

            if (totalMatched > 0) {
                lines.push(`📎 <b>${totalMatched} factura(s) emparejada(s)</b> automáticamente.`);
            }
            if (totalPending > 0) {
                lines.push(`⏳ <b>${totalPending} ticket(s) en buzón</b> esperando cargo bancario.`);
            }

            const squaredCount = balanceReconciliations.filter(r => r.isCuadrado).length;
            const stats = `Cuentas: ${mappedAccounts.length} | Categorizados: ${categorizedTxsSummary.length} | Saldos cuadrados: ${squaredCount}/${balanceReconciliations.length}`;

            await this.notificationService.notifyUser(username, {
                title: 'Resumen bancario matutino',
                summary: totalNewTxs > 0
                    ? `Se han procesado ${totalNewTxs} nuevo(s) movimiento(s) bancario(s).`
                    : (hasDifferences
                        ? `Se ha revisado la sincronización bancaria y se han detectado diferencias de saldo.`
                        : `Sincronización bancaria completada. Todos los saldos coinciden con los bancos.`),
                stats,
                lines
            });
        }

        return {
            success: true,
            newTxs: totalNewTxs,
            matchedTickets: totalMatched,
            pendingTickets: totalPending,
            categorizedCount: categorizedTxsSummary.length,
            pendingCategorizationCount: pendingTxsSummary.length,
            signMismatches,
            syncedAccountsCount: mappedAccounts.length,
            balanceReconciliations
        };
    }
}

