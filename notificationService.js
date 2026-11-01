import fs from 'fs';
import path from 'path';

export class NotificationService {
    constructor({ dataDir, sendEmailFn }) {
        this.dataDir = dataDir;
        this.sendEmailFn = sendEmailFn;
        this.settingsFile = path.join(dataDir, 'notification_settings.json');
    }

    readAllSettings() {
        try {
            if (!fs.existsSync(this.settingsFile)) return {};
            return JSON.parse(fs.readFileSync(this.settingsFile, 'utf8'));
        } catch {
            return {};
        }
    }

    saveAllSettings(settings) {
        fs.writeFileSync(this.settingsFile, JSON.stringify(settings, null, 2), 'utf8');
    }

    getUserSettings(username) {
        const all = this.readAllSettings();
        return all[username] || {
            email: { enabled: true, address: username },
            telegram: { enabled: false, botToken: '', chatId: '' },
            inApp: { enabled: true },
            syncHour: 6
        };
    }

    saveUserSettings(username, settings) {
        const all = this.readAllSettings();
        all[username] = {
            email: {
                enabled: settings.email?.enabled ?? true,
                address: settings.email?.address || username
            },
            telegram: {
                enabled: settings.telegram?.enabled ?? false,
                botToken: (settings.telegram?.botToken || '').trim(),
                chatId: (settings.telegram?.chatId || '').trim()
            },
            inApp: {
                enabled: settings.inApp?.enabled ?? true
            },
            syncHour: settings.syncHour !== undefined ? parseInt(settings.syncHour, 10) : 6
        };
        this.saveAllSettings(all);
        return all[username];
    }

    /**
     * Sends Telegram notification via Bot API
     */
    async sendTelegram({ botToken, chatId, text }) {
        if (!botToken || !chatId) {
            throw new Error('Telegram bot token and chat ID are required');
        }
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: 'HTML'
            })
        });
        const data = await res.json();
        if (!data.ok) {
            throw new Error(data.description || 'Error al enviar mensaje a Telegram');
        }
        return true;
    }

    /**
     * Dispatches notification across configured channels (Telegram, Email, In-App)
     */
    async notifyUser(username, { title, summary, stats, lines = [] }) {
        const settings = this.getUserSettings(username);
        const results = { email: false, telegram: false, inApp: false };

        // 1. Telegram Notification
        if (settings.telegram?.enabled && settings.telegram?.botToken && settings.telegram?.chatId) {
            try {
                let tgText = `📊 <b>ContaMiki | ${title}</b>\n\n`;
                if (summary) tgText += `${summary}\n\n`;
                if (lines && lines.length > 0) {
                    tgText += lines.map(l => `• ${l}`).join('\n') + '\n\n';
                }
                if (stats) {
                    tgText += `<i>${stats}</i>`;
                }
                await this.sendTelegram({
                    botToken: settings.telegram.botToken,
                    chatId: settings.telegram.chatId,
                    text: tgText
                });
                results.telegram = true;
                console.log(`[NOTIFY] Telegram enviado a ${username}`);
            } catch (err) {
                console.error(`[NOTIFY ERROR Telegram] ${username}:`, err.message);
            }
        }

        // 2. Email Notification (via Cartero proxy)
        if (settings.email?.enabled && this.sendEmailFn) {
            try {
                const targetEmail = settings.email.address || username;
                const htmlLines = lines.map(l => `<li style="margin-bottom:6px;">${l}</li>`).join('');
                const htmlContent = `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
                        <div style="background: linear-gradient(135deg, #4f46e5, #6366f1); padding: 24px; border-radius: 16px; color: white; margin-bottom: 20px;">
                            <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 800;">ContaMiki</h2>
                            <p style="margin: 0; font-size: 14px; opacity: 0.9;">${title}</p>
                        </div>
                        <p style="font-size: 15px; line-height: 1.5; color: #334155;">${summary}</p>
                        ${lines.length > 0 ? `<ul style="font-size: 14px; color: #475569; padding-left: 20px;">${htmlLines}</ul>` : ''}
                        ${stats ? `<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 16px; font-size: 12px; color: #64748b; margin-top: 20px;">${stats}</div>` : ''}
                        <p style="font-size: 11px; color: #94a3b8; margin-top: 24px; text-align: center;">ContaMiki Self-Hosted • Notificación automática matutina</p>
                    </div>
                `;
                const textContent = `${title}\n\n${summary}\n\n${lines.join('\n')}\n\n${stats || ''}`;
                await this.sendEmailFn(targetEmail, `[ContaMiki] ${title}`, textContent, htmlContent);
                results.email = true;
                console.log(`[NOTIFY] Email enviado a ${targetEmail}`);
            } catch (err) {
                console.error(`[NOTIFY ERROR Email] ${username}:`, err.message);
            }
        }

        // 3. In-App Notification
        if (settings.inApp?.enabled) {
            try {
                const notifDir = path.join(this.dataDir, 'notifications');
                if (!fs.existsSync(notifDir)) fs.mkdirSync(notifDir, { recursive: true });
                const userNotifFile = path.join(notifDir, `${username.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
                let userNotifs = [];
                if (fs.existsSync(userNotifFile)) {
                    try { userNotifs = JSON.parse(fs.readFileSync(userNotifFile, 'utf8')); } catch {}
                }
                userNotifs.unshift({
                    id: `notif_${Date.now()}`,
                    title,
                    summary,
                    stats,
                    lines,
                    read: false,
                    date: new Date().toISOString()
                });
                // Keep last 30
                if (userNotifs.length > 30) userNotifs = userNotifs.slice(0, 30);
                fs.writeFileSync(userNotifFile, JSON.stringify(userNotifs, null, 2), 'utf8');
                results.inApp = true;
            } catch (err) {
                console.error(`[NOTIFY ERROR In-App] ${username}:`, err.message);
            }
        }

        return results;
    }
}

