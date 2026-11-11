// Envío de correo por SMTP directo (alternativa al servicio central CENTRAL_EMAIL_URL).
// Variables de entorno (solo SMTP_HOST es imprescindible para activarlo):
//   SMTP_HOST    servidor SMTP (p. ej. smtp.gmail.com)
//   SMTP_PORT    puerto (por defecto 587; 465 usa TLS directo)
//   SMTP_SECURE  "true" fuerza TLS directo; por defecto solo en el puerto 465 (en el 587 se usa STARTTLS)
//   SMTP_USER / SMTP_PASS   credenciales, si el servidor exige autenticación
//   SMTP_FROM    remitente (por defecto SMTP_USER)
import nodemailer from 'nodemailer';

export async function loadSmtpConfig(getSecret) {
    const host = await getSecret('SMTP_HOST');
    if (!host) return null;
    const port = parseInt(await getSecret('SMTP_PORT') || '587', 10);
    const secureEnv = (await getSecret('SMTP_SECURE') || '').toLowerCase();
    const user = await getSecret('SMTP_USER');
    const pass = await getSecret('SMTP_PASS');
    return {
        host,
        port,
        secure: secureEnv ? secureEnv === 'true' : port === 465,
        user,
        pass,
        from: await getSecret('SMTP_FROM') || user || undefined,
    };
}

export async function sendViaSmtp(cfg, { to, subject, text, html, fromName = 'ContaMiki' }) {
    if (!cfg.from) throw new Error('Falta SMTP_FROM (o SMTP_USER) para indicar el remitente');
    const transporter = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
    });
    return transporter.sendMail({
        from: `"${fromName}" <${cfg.from}>`,
        to,
        subject,
        text,
        html,
    });
}
