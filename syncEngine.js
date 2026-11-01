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
     * Executes the full daily sync: banks + categorization + tickets + notifications
     */
    async syncUser(username, { readFullUserState, saveFullUserState }) {
        const connections = this.bankService.getUserConnections(username);
        const mappedAccounts = [];
        
        for (const conn of connections) {
            for (const acc of (conn.accounts || [])) {
                if (acc.enabled && acc.mappedBookId && acc.mappedAccountId) {
                    mappedAccounts.push({ ...acc, connectionId: conn.id, aspspName: conn.aspsp?.name || 'Banco' });
                }
            }
        }

        if (mappedAccounts.length === 0) {
            return { success: true, message: 'No hay cuentas bancarias mapeadas para sincronizar.', newTxs: 0, matchedTickets: 0 };
        }

        const userState = await readFullUserState(username);
        let totalNewTxs = 0;
        const newTxsSummary = [];

        // 1. Fetch transactions for each mapped account
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0];
        const today = new Date().toISOString().split('T')[0];

        for (const mapped of mappedAccounts) {
            const bookData = userState.booksData[mapped.mappedBookId];
            if (!bookData) continue;

            let bankTxs = [];
            try {
                bankTxs = await this.bankService.getAccountTransactions(mapped.uid, thirtyDaysAgo, today);
            } catch (err) {
                console.error(`[SYNC ERROR] Error fetching transactions for ${mapped.name}:`, err.message);
                continue;
            }

            const existingTxs = bookData.transactions || [];
            const categories = bookData.categories || [];

            for (const bTx of bankTxs) {
                const bookingDate = bTx.booking_date || bTx.value_date || today;
                const rawAmt = parseFloat(bTx.transaction_amount?.amount || bTx.amount || 0);
                const desc = bTx.remittance_information_unstructured || bTx.creditor_name || bTx.debtor_name || bTx.details || 'Movimiento bancario';

                // Check for duplicates
                const isDuplicate = existingTxs.some(t => {
                    const sameAcc = t.accountId === mapped.mappedAccountId;
                    const sameDate = t.date === bookingDate;
                    const sameAmt = Math.abs(Number(t.amount) - rawAmt) < 0.005;
                    return sameAcc && sameDate && sameAmt;
                });

                if (!isDuplicate) {
                    // Auto-categorize
                    const suggestion = this.findCategorySuggestion(desc, existingTxs, categories);
                    const newTx = {
                        id: `tx_${Math.random().toString(36).substring(2, 12)}`,
                        date: bookingDate,
                        amount: rawAmt,
                        description: desc.trim(),
                        accountId: mapped.mappedAccountId,
                        type: rawAmt < 0 ? 'EXPENSE' : 'INCOME',
                        categoryId: suggestion.categoryId || '',
                        familyId: suggestion.familyId || '',
                        isValidated: false, // "Pendiente de revisar"
                        isFromBankSync: true
                    };

                    existingTxs.push(newTx);
                    totalNewTxs++;
                    newTxsSummary.push(`${newTx.date} | ${newTx.amount > 0 ? '+' : ''}${newTx.amount.toFixed(2)} € | ${newTx.description}`);
                }
            }

            // 2. Run Ticket Matching on this book's transactions
            const ticketResult = await this.matchTicketsInbox(existingTxs);
            mapped.lastSync = new Date().toISOString();

            // 3. Save State
            await saveFullUserState(username, userState);

            // 4. Dispatch Notification if there is activity
            if (totalNewTxs > 0 || ticketResult.matched > 0 || ticketResult.pending > 0) {
                const lines = [...newTxsSummary];
                if (ticketResult.matched > 0) {
                    lines.push(`📎 ${ticketResult.matched} factura(s) emparejada(s) automáticamente.`);
                }
                if (ticketResult.pending > 0) {
                    lines.push(`⏳ ${ticketResult.pending} ticket(s) en buzón esperando cargo bancario.`);
                }

                await this.notificationService.notifyUser(username, {
                    title: 'Resumen matutino bancario',
                    summary: `Se han sincronizado ${totalNewTxs} nuevo(s) movimiento(s) bancario(s).`,
                    stats: `Cuentas sincronizadas: ${mappedAccounts.length}`,
                    lines
                });
            }

            return {
                success: true,
                newTxs: totalNewTxs,
                matchedTickets: ticketResult?.matched || 0,
                pendingTickets: ticketResult?.pending || 0
            };
        }
    }
}
