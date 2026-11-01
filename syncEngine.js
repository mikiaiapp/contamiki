import fs from 'fs';
import path from 'path';

export class SyncEngine {
    constructor({ bankService, notificationService, ticketsInboxDir }) {
        this.bankService = bankService;
        this.notificationService = notificationService;
        this.ticketsInboxDir = ticketsInboxDir;
    }

    /**
     * Attempts to find a matching category based on historical merchant descriptions
     */
    findCategorySuggestion(description, historicalTxs, categories) {
        if (!description || !historicalTxs || historicalTxs.length === 0) {
            return { categoryId: '', familyId: '', matchedKeyword: null };
        }

        const cleanDesc = description.toLowerCase();
        
        // Count category occurrences for matching descriptions
        const categoryScore = {};
        for (const tx of historicalTxs) {
            if (!tx.categoryId || !tx.description) continue;
            const pastDesc = tx.description.toLowerCase();
            
            // Check significant tokens (min 4 chars)
            const words = pastDesc.split(/[\s,.-]+/).filter(w => w.length >= 4);
            for (const word of words) {
                if (cleanDesc.includes(word)) {
                    categoryScore[tx.categoryId] = (categoryScore[tx.categoryId] || 0) + 1;
                }
            }
        }

        let bestCatId = '';
        let highestScore = 0;
        for (const [catId, score] of Object.entries(categoryScore)) {
            if (score > highestScore) {
                highestScore = score;
                bestCatId = catId;
            }
        }

        if (bestCatId && highestScore >= 2) {
            const cat = categories.find(c => c.id === bestCatId);
            if (cat) {
                return { categoryId: cat.id, familyId: cat.familyId, confidence: 'HIGH' };
            }
        }

        return { categoryId: '', familyId: '', confidence: 'NONE' };
    }

    /**
     * Parses tickets in inbox and matches against transactions
     */
    async matchTicketsInbox(bookTransactions) {
        if (!fs.existsSync(this.ticketsInboxDir)) return { matched: 0, pending: 0, details: [] };

        const files = fs.readdirSync(this.ticketsInboxDir);
        let matchedCount = 0;
        const details = [];

        // Match pattern: YYYYMMDD Merchant Amount
        const namePattern = /^(\d{4})(\d{2})(\d{2})\s+.*?\s+([\d.,]+)/i;

        for (const file of files) {
            const filePath = path.join(this.ticketsInboxDir, file);
            const ext = path.extname(file).toLowerCase();
            if (!['.pdf', '.jpg', '.jpeg', '.png'].includes(ext)) continue;

            let ticketDate = null;
            let ticketAmount = null;

            const nameMatch = file.match(namePattern);
            if (nameMatch) {
                const [_, y, m, d, amtRaw] = nameMatch;
                ticketDate = `${y}-${m}-${d}`;
                ticketAmount = Math.abs(parseFloat(amtRaw.replace(',', '.')));
            } else if (ext === '.pdf') {
                // Try reading PDF text streams for date & amount
                try {
                    const buf = fs.readFileSync(filePath);
                    const text = buf.toString('latin1');
                    // Look for date DD/MM/YYYY or YYYY-MM-DD
                    const dateMatch = text.match(/\b(\d{2})[\/\.-](\d{2})[\/\.-](\d{4})\b/) || text.match(/\b(\d{4})[\/\.-](\d{2})[\/\.-](\d{2})\b/);
                    if (dateMatch) {
                        ticketDate = dateMatch[3] ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
                    }
                    const amtMatch = text.match(/(?:TOTAL|Total|Importe|IMPORTE)[\s:]*([\d.,]+)\s*(?:€|EUR)?/i);
                    if (amtMatch) {
                        ticketAmount = Math.abs(parseFloat(amtMatch[1].replace(',', '.')));
                    }
                } catch (e) {
                    // Ignore text parse errors
                }
            }

            if (!ticketAmount) continue;

            // Search in book transactions: same amount, date +- 3 days
            const candidate = bookTransactions.find(t => {
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

            if (candidate) {
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
    async syncUser(username, { readFullUserState, saveFullUserState, accountUids = null }) {
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
            return { success: true, message: 'No hay cuentas bancarias seleccionadas o mapeadas para sincronizar.', newTxs: 0, matchedTickets: 0, syncedAccountsCount: 0 };
        }

        const userState = await readFullUserState(username);
        let totalNewTxs = 0;
        const categorizedTxsSummary = [];
        const pendingTxsSummary = [];

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
                bankTxs = await this.bankService.getAccountTransactions(mapped.uid, dateFrom, today);
                console.log(`[SYNC] ${bankTxs.length} movimientos recibidos de ${mapped.aspspName}`);
            } catch (err) {
                console.error(`[SYNC ERROR] Error fetching transactions for ${mapped.name}:`, err.message);
                continue;
            }

            const existingTxs = bookData.transactions || [];
            const categories = bookData.categories || [];

            for (const bTx of bankTxs) {
                const bookingDate = bTx.booking_date || bTx.value_date || today;
                const rawAmt = parseFloat(bTx.transaction_amount?.amount || bTx.amount || 0);
                
                // Extracción exhaustiva de la descripción bancaria (Enable Banking / ASPSP)
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

                // Deduplicación inteligente: contempla apunte directo O contrapartida de traspaso (TRANSFER)
                const isDuplicate = existingTxs.some(t => {
                    const isDirectAcc = t.accountId === mapped.mappedAccountId;
                    const isTransferAcc = (t.type === 'TRANSFER' && t.transferAccountId === mapped.mappedAccountId);
                    if (!isDirectAcc && !isTransferAcc) return false;

                    const tDate = new Date(t.date).getTime();
                    const bDate = new Date(bookingDate).getTime();
                    const diffDays = Math.abs((tDate - bDate) / (1000 * 3600 * 24));
                    if (diffDays > 1.5) return false;

                    const tAmt = Number(t.amount);
                    if (isDirectAcc) {
                        if (Math.abs(tAmt - rawAmt) < 0.005) return true;
                        if (Math.abs(Math.abs(tAmt) - Math.abs(rawAmt)) < 0.005 && diffDays <= 1) return true;
                    } else if (isTransferAcc) {
                        if (Math.abs(Math.abs(tAmt) - Math.abs(rawAmt)) < 0.005) return true;
                    }
                    return false;
                });

                if (!isDuplicate) {
                    // Categorización automática por aprendizaje histórico
                    const suggestion = this.findCategorySuggestion(desc, existingTxs, categories);
                    const hasCategory = Boolean(suggestion.categoryId);
                    const matchedCat = hasCategory ? categories.find(c => c.id === suggestion.categoryId) : null;

                    const newTx = {
                        id: `tx_${Math.random().toString(36).substring(2, 12)}`,
                        date: bookingDate,
                        amount: rawAmt,
                        description: desc.trim(),
                        accountId: mapped.mappedAccountId,
                        type: rawAmt < 0 ? 'EXPENSE' : 'INCOME',
                        categoryId: suggestion.categoryId || '',
                        familyId: suggestion.familyId || '',
                        isValidated: hasCategory,
                        isPendingCategorization: !hasCategory,
                        isFromBankSync: true
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
            }

            const nowIso = new Date().toISOString();
            mapped.lastSync = nowIso;
            if (this.bankService && typeof this.bankService.updateAccountLastSync === 'function') {
                this.bankService.updateAccountLastSync(username, mapped.connectionId, mapped.uid, nowIso);
            }
        }

        // 2. Emparejamiento de tickets en los libros afectados
        let totalMatched = 0;
        let totalPending = 0;
        for (const bookId of affectedBookIds) {
            const bData = userState.booksData[bookId];
            if (bData && bData.transactions) {
                const ticketResult = await this.matchTicketsInbox(bData.transactions);
                totalMatched += ticketResult.matched;
                totalPending = ticketResult.pending;
            }
        }

        // 3. Guardar estado del usuario
        await saveFullUserState(username, userState);

        // 4. Enviar notificación multicanal si hubo actividad
        if (totalNewTxs > 0 || totalMatched > 0 || totalPending > 0) {
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

            if (totalMatched > 0) {
                lines.push(`📎 <b>${totalMatched} factura(s) emparejada(s)</b> automáticamente.`);
            }
            if (totalPending > 0) {
                lines.push(`⏳ <b>${totalPending} ticket(s) en buzón</b> esperando cargo bancario.`);
            }

            await this.notificationService.notifyUser(username, {
                title: 'Resumen bancario matutino',
                summary: `Se han procesado ${totalNewTxs} nuevo(s) movimiento(s) bancario(s).`,
                stats: `Cuentas sincronizadas: ${mappedAccounts.length} | Categorizados: ${categorizedTxsSummary.length} | Pendientes: ${pendingTxsSummary.length}`,
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
            syncedAccountsCount: mappedAccounts.length
        };
    }
}

