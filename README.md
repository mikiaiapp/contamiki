# ContaMiki 📊

<div align="center">
  <img width="500" alt="ContaMiki - Contabilidad Personal en la Nube" src="contamiki.png" />

  <h3>Tu centro de mando financiero personal y familiar: potente, 100% privado y auto-alojado.</h3>

  <p>
    <strong>ContaMiki</strong> es una plataforma financiera moderna y completa diseñada para recuperar el control total de tu dinero. Olvídate de hojas de cálculo tediosas, suscripciones mensuales abusivas o apps comerciales que monetizan tus datos. Con ContaMiki dispones de <strong>Open Banking oficial europeo (PSD2)</strong>, <strong>categorización automática</strong>, <strong>buzón inteligente de facturas y tickets</strong>, <strong>importador masivo</strong> y <strong>análisis visual en tiempo real</strong>, todo corriendo bajo tu propio techo.
  </p>

  <p>
    <a href="#-características-y-operativa-completa"><img src="https://img.shields.io/badge/Operativa-Completa-indigo?style=for-the-badge&logo=cashapp" alt="Operativa" /></a>
    <a href="#-despliegue-con-docker-en-2-minutos"><img src="https://img.shields.io/badge/Docker-Listo_en_2_min-blue?style=for-the-badge&logo=docker" alt="Docker" /></a>
    <a href="#-sincronización-bancaria-open-banking-psd2"><img src="https://img.shields.io/badge/PSD2-Open_Banking_Activo-emerald?style=for-the-badge&logo=bank" alt="Open Banking" /></a>
    <a href="#-licencia"><img src="https://img.shields.io/badge/Licencia-MIT-purple?style=for-the-badge" alt="Licencia" /></a>
  </p>
</div>

---

## ✨ ¿Por qué ContaMiki?

| Característica | Aplicaciones bancarias típicas | Hojas de cálculo tradicionales | ContaMiki 📊 |
| :--- | :---: | :---: | :---: |
| **Privacidad de tus datos** | ❌ En servidores de terceros | ✅ Local | ✅ **100% tuyo (Self-Hosted en Docker)** |
| **Sincronización bancaria** | ⚠️ Solo su propio banco | ❌ Manual | ✅ **Automática multientidad (PSD2)** |
| **Buzón y archivo de tickets** | ❌ Rara vez disponible | ❌ Complejo de enlazar | ✅ **Adjunto PDF/Foto con visor nativo** |
| **Apuntes recurrentes** | ⚠️ Básico o limitado | ❌ Fórmulas manuales | ✅ **Automatización de cobros y pagos periódicos** |
| **Apuntes favoritos** | ❌ No disponible | ❌ Duplicación manual | ✅ **Plantillas rápidas con 1 solo toque** |
| **Multi-Contabilidad (Hogar, Negocio...)** | ❌ No disponible | ⚠️ Archivos separados | ✅ **Cambio de contabilidad con un solo clic** |
| **Colaboración familiar** | ❌ Un solo usuario | ⚠️ Conflictos de edición | ✅ **Multi-usuario con roles y 2FA** |
| **Sin cuotas ni suscripciones** | ❌ Suscripciones mensuales | ✅ Gratuito | ✅ **Gratis, libre y 100% tuyo** |

---

## 🎯 Operativa y Funcionalidades en Detalle

```mermaid
flowchart LR
    A["🏦 Bancos Españoles / PSD2"] -->|Sincronización 06:00 AM| D["🧠 Motor ContaMiki"]
    B["📲 Atajo iOS / Buzón de Tickets"] -->|Subida PDF & Foto| D
    C["📑 Extractos Excel / CSV"] -->|Importador Inteligente| D
    E["✍️ Apuntes Manuales, Favoritos & Recurrentes"] --> D
    
    D --> F["🏷️ Auto-Categorización por IA"]
    D --> G["📎 Emparejamiento de Tickets"]
    D --> H["📊 Gráficos y Flujo de Caja"]
    D --> I["🔔 Notificaciones (Telegram, Email, App)"]
```

### 1. 🏛️ Estructura Financiera Profesional: Cuentas, Familias y Categorías
ContaMiki no se limita a anotar gastos sueltos: te ofrece un modelo contable de tres niveles intuitivo y flexible:
- **Cuentas Bancarias y Monederos:**  
  Configura todas tus cuentas corrientes, cuentas de ahorro remuneradas, efectivo en cartera, depósitos o tarjetas. Cada cuenta cuenta con su divisa, icono personalizado y saldo consolidado en tiempo real.
- **Familias (Nivel Macro):**  
  Grandes bloques presupuestarios para entender tu estructura de gastos e ingresos de un vistazo (ej. *Hogar*, *Alimentación*, *Transporte*, *Ocio & Viajes*, *Salud*, *Nóminas*, *Inversiones*).
- **Categorías (Nivel Quirúrgico):**  
  Dentro de cada familia, define categorías precisas (ej. dentro de *Alimentación*: *Mercadona*, *Carnicería*, *Restaurantes*, *Cafeterías*). Así sabrás con exactitud matemática a dónde va cada euro.

---

### 2. ✍️ Entrada de Apuntes Manual y Accesos Rápidos
Registrar un movimiento en el día a día es una experiencia inmediata y agradable:
- **Entrada Ultra-Rápida:** Formularios optimizados para móvil y ordenador con selector rápido de fecha, cuenta de cargo/abono, importe e imputación de categoría.
- **Reembolsos:** un cobro (devolución de una tienda, anulación de un pago, Bizum de un amigo que te paga su parte) que categorizas en una familia de gasto se mantiene como **ingreso** dentro de esa familia y resta del gasto neto; no cambia de signo.
- **En el móvil:** zoom con la pinza, deslizar hacia abajo desde arriba para actualizar y menú de usuario en la cabecera.
- **⭐ Apuntes Favoritos:**  
  ¿Compras el pan a diario o tomas café en el mismo bar? Guarda tus gastos e ingresos más repetitivos como apuntes favoritos para generarlos con **un solo toque** en pantalla desde el diario o el resumen, sin volver a rellenar nada.
- **🔁 Apuntes Recurrentes y Periódicos:**  
  Automatiza tus cobros y pagos fijos: alquiler, hipoteca, nóminas, suscripciones (Netflix, Spotify), recibos de luz, seguros o cuotas de comunidad. Define la periodicidad (mensual, quincenal, trimestral, anual) con avisos de pendientes y validación en un clic.
- **Transferencias entre cuentas:**  
  Registra traspasos de fondos entre tus propias cuentas con trazabilidad perfecta de origen y destino.
- **Conciliación y Validación:**  
  Los movimientos cuentan con un indicador de estado (*«Pendiente de revisar»* vs *«Validado con check verde»*). Así siempre sabrás qué movimientos has comprobado y cuáles acaban de entrar.

---

### 3. 📎 Buzón de Tickets Inteligente y Visor Nativo de Facturas
Nunca más perderás una garantía ni un justificante de compra:
- **Adjunta cualquier comprobante:**  
  Soporta facturas en **PDF**, fotos de tickets en **JPG** o **PNG**.
- **🧠 Motor de Análisis y Extracción de PDFs Integrado:**  
  Incorpora un motor nativo de parsing de documentos PDF (basado en `pdf-parse` / Mozilla PDF.js) que descomprime y analiza internamente los flujos de factura digital, extrayendo con total precisión la fecha y el importe total real, incluso en tickets digitales de Mercadona, Amazon, recibos de suministros o facturas complejas sin fecha ni importe en el nombre del archivo. Si el nombre del archivo trae otro importe (p. ej. el bruto de la factura) o el cargo llega días después de la emisión, la conciliación también prueba el «Total a pagar» y las fechas del propio documento (el cargo puede llegar hasta 15 días después de la factura).
- **Visor Interactivo Integrado:**  
  Abre cualquier transacción y previsualiza el PDF o la foto directamente en un visor nativo integrado en la aplicación, con opciones de pantalla completa, zoom y descarga. Al abrir un PDF se **ajusta al ancho de la pantalla** (también en el móvil); el botón «Ajustar» vuelve a ese tamaño.
- **📥 Buzón de Tickets Inbox (`tickets_inbox`):**  
  Deja tus PDFs o fotos en la carpeta compartida de red de tu NAS o envíalos desde tu teléfono móvil. En el barrido diario (o pulsando el botón **«Conciliar tickets del buzón ahora»**), ContaMiki analiza el documento y lo **empareja automáticamente con el movimiento bancario correspondiente**, archivándolo en el apunte y eliminándolo del buzón una vez conciliado.

---

### 4. 📲 Integración con iPhone, iPad y Atajos de Apple (iOS)
Envía tickets a tu buzón en segundos sin abrir la web:
- **Atajo oficial con Apple Intelligence:**  
  Configura en menos de 1 minuto un atajo que aparece en el menú nativo **Compartir** de iOS.
- **Un toque desde cualquier app:**  
  Estés viendo un recibo en Mail, una foto en la galería o un PDF en WhatsApp, pulsas *Compartir* ➔ *«Subir a ContaMiki»* y viajará directo a tu buzón para ser conciliado.

---

### 5. 🧠 Motor de Auto-Categorización Inteligente
- Cuando sincronizas con el banco o importas extractos, ContaMiki analiza los nombres de comercios y conceptos bancarios.
- Aprende de tus categorizaciones históricas: si siempre asignas *"MERCADONA"* a *Alimentación ➔ Supermercado*, el sistema le asignará esa categoría de forma automática en cuanto detecte el cargo.

---

### 6. 📑 Importador Inteligente de Extractos (Excel y CSV)
¿Tienes meses de histórico o extractos de tarjetas de crédito con liquidación diferida?
- Arrastra directamente el archivo Excel (`.xlsx`, `.xls`) o `.csv` descargado de la banca online.
- El asistente inteligente detecta las columnas, formatea los importes y signos, y te muestra una vista previa interactiva antes de confirmar la importación.

---

### 7. 🏦 Sincronización Bancaria Automática (Open Banking PSD2)
- **Conexión Directa y Homologada:**  
  Conexión nativa con la infraestructura europea de **Enable Banking** bajo la estricta normativa bancaria **PSD2**.
- **Bancos Españoles y Europeos:**  
  Compatible con *CaixaBank, Banco Santander, BBVA, Bankinter, Banco Sabadell, ING, Openbank, Abanca, Kutxabank, Unicaja* y más de 100 entidades.
- **Sincronización Matutina Silenciosa:**  
  El servidor ejecuta un barrido automático programable (por defecto a las **06:00 AM**) para que cuando te despiertes a las 07:00 AM tengas tus saldos actualizados y las facturas emparejadas.
- **Protección Anti-Duplicados:**  
  Un movimiento del banco no se importa dos veces aunque solapen las fechas de consulta: se reconoce por el identificador del propio banco (si lo da) o por cuenta, fecha, importe y sentido, dando preferencia al mismo concepto para que un pago no «consuma» el apunte de su anulación. Si ya existe un apunte con el mismo concepto, fecha e importe pero con el signo contrario, no se duplica y se avisa para que lo revises.
- **Sincronización Manual Selectiva:**  
  Posibilidad de sincronizar todas las cuentas vinculadas a la vez o abrir el selector interactivo para centrarse únicamente en una o dos cuentas específicas, además de contar con un botón de sincronización directa en cada cuenta individual.

---

### 8. 🔔 Notificaciones Multicanal (Telegram, Envío de Email y App)
Elige cómo quieres recibir tu resumen financiero matutino:
- **🤖 Bot de Telegram:** Recibe un mensaje diario formateado con el número de movimientos nuevos descargados, facturas emparejadas y tickets pendientes.
  > **¿Cómo configurarlo en 2 minutos?**
  > 1. Abre Telegram y escribe a [@BotFather](https://t.me/BotFather) el comando `/newbot`. Te dará tu **Bot Token** (ej. `123456789:AA...`).
  > 2. Escribe a [@userinfobot](https://t.me/userinfobot) y pulsa *Iniciar* para obtener tu **Chat ID** (ej. `987654321`).
  > 3. ¡Importante! Abre el chat de tu nuevo bot y pulsa **«Iniciar»** (`/start`). Pega ambos datos en ContaMiki y pulsa *Probar Telegram*.
- **✉️ Envío de Email:** Envío automático del resumen matutino a tu correo electrónico personal.

---

### 9. 🏠 Multi-Contabilidad y Colaboración Multi-Usuario Segura
- **Separación total de entornos:**  
  Crea varias contabilidades independientes (ej. *CASA*, *NEGOCIO*, *SEGUNDA RESIDENCIA*, *AHORROS*). Cambia entre ellas al instante sin mezclar presupuestos ni movimientos.
- **Colaboración Familiar:**  
  Invita a tu pareja, familiares o socios. Puedes asignar permisos de edición completa o acceso de solo lectura sobre contabilidades específicas.
- **Máxima Seguridad:**  
  Autenticación con tokens JWT, contraseñas hasheadas con bcrypt y soporte nativo de **Doble Factor de Autenticación (2FA / TOTP)** compatible con Google Authenticator, Authy o 1Password.
- **Copias de Seguridad Automáticas Diarias:**  
  Sistema de backups rotativos automáticos locales por cada contabilidad para que nunca pierdas un solo dato.

---

## 🐳 Despliegue con Docker en 2 minutos

La forma recomendada de desplegar ContaMiki en un NAS (Synology, QNAP, Unraid), servidor doméstico o VPS es mediante **Docker Compose**.

### 1. `docker-compose.yml`

```yaml
version: '3.8'

services:
  contamiki:
    container_name: contamiki
    image: ghcr.io/mikiaiapp/contamiki:latest  # o build: . si compilas el código fuente
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET:?define JWT_SECRET}   # obligatoria: ver «Variables de entorno»
      - APP_URL=https://conta.tudominio.com  # URL pública o IP con protocolo
      # Necesarias para enviar correos (alta de usuarios, recuperar contraseña…):
      # - CENTRAL_EMAIL_URL=${CENTRAL_EMAIL_URL:-}
      # - CENTRAL_EMAIL_KEY=${CENTRAL_EMAIL_KEY:-}
    volumes:
      - /ruta/a/tu/almacenamiento/data:/app/data
```

### 2. Variables de entorno

ContaMiki lee su configuración de variables de entorno. **Ninguna clave va escrita en el código ni en el repositorio**: defínelas en tu stack (por ejemplo en Portainer, *Environment variables*) o en un fichero `.env` **local que no subas nunca a Git**.

| Variable | ¿Obligatoria? | Descripción |
|---|---|---|
| `JWT_SECRET` | **Sí** | Clave con la que se firman las sesiones. Debe ser larga y aleatoria (64 caracteres o más); por ejemplo, `openssl rand -hex 48`. **Sin ella la aplicación no arranca.** Si la cambias, todos los usuarios tendrán que volver a iniciar sesión. |
| `APP_URL` | Recomendada | URL pública (o IP) con protocolo, por ejemplo `https://conta.tudominio.com`. Se usa en los enlaces de los correos. |
| `PORT` | No | Puerto interno (por defecto `3000`). |
| `NODE_ENV` | No | `production` en producción. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Para el correo (opción A) | Datos de tu servidor de correo saliente. Ver «Envío de correo» más abajo. |
| `CENTRAL_EMAIL_URL`, `CENTRAL_EMAIL_KEY` | Para el correo (opción B) | Servicio de correo central que ya tengas montado. Ver «Envío de correo» más abajo. |
| `ENABLE_BANKING_APP_ID` / `ENABLE_BANKING_KEY_PATH` | No | Credenciales de Open Banking. Lo habitual es configurarlas desde la propia aplicación (ver más abajo). |

#### ✉️ Envío de correo (alta de usuarios, recuperar contraseña, avisos…)

ContaMiki envía correos al **darse de alta un usuario** (verificación de la cuenta), al **recuperar la contraseña** y en los avisos y el resumen diario. Sin configurar el correo, **no se envía nada** (los mensajes se escriben en el registro del contenedor) y los usuarios nuevos no podrán verificar su cuenta. Hay **dos formas** de configurarlo; elige una:

**Opción A · No tengo un gestor de correo propio → usa un servidor SMTP.** Es la más sencilla: pon los datos de tu proveedor (Gmail, el correo de tu dominio, Brevo, etc.).

| Variable | Descripción |
|---|---|
| `SMTP_HOST` | Servidor SMTP, por ejemplo `smtp.gmail.com`. **Con ella se activa el envío.** |
| `SMTP_PORT` | Puerto (por defecto `587`; el `465` usa TLS directo). |
| `SMTP_SECURE` | `true` fuerza TLS directo; por defecto solo en el puerto `465` (en el `587` se usa STARTTLS). |
| `SMTP_USER` / `SMTP_PASS` | Usuario y contraseña, si el servidor exige autenticación. En Gmail hay que usar una **contraseña de aplicación** (requiere tener activada la verificación en dos pasos), no la contraseña normal de la cuenta. |
| `SMTP_FROM` | Dirección del remitente (por defecto, `SMTP_USER`). |

```yaml
    environment:
      - SMTP_HOST=smtp.gmail.com
      - SMTP_PORT=587
      - SMTP_USER=tu_cuenta@gmail.com
      - SMTP_PASS=${SMTP_PASS}          # contraseña de aplicación, desde las variables del stack
      - SMTP_FROM=tu_cuenta@gmail.com
```

**Opción B · Ya tengo un gestor de correo → ContaMiki le delega el envío.** Si ya dispones de un servicio propio que centraliza el correo de tus aplicaciones, indica su dirección y su clave. Debe aceptar `POST <URL>/send` con un JSON `{ "to", "subject", "text", "html", "key", "fromName" }` y responder `{ "success": true }`.

| Variable | Descripción |
|---|---|
| `CENTRAL_EMAIL_URL` | Dirección del servicio de correo (por ejemplo, `http://mi-servicio:3001`). |
| `CENTRAL_EMAIL_KEY` | Clave que se envía en el campo `key` para autorizar el envío. Trátala como una contraseña: larga, aleatoria y distinta en cada instalación. |

Si defines **las dos**, tiene prioridad la opción B. Para probar la configuración, usa el botón de correo de prueba de la propia aplicación.

> [!IMPORTANT]
> **Seguridad.** Si despliegas con Docker Compose, el `docker-compose.yml` toma `JWT_SECRET` de las variables del stack y **el despliegue falla si falta**, en lugar de arrancar con una clave por defecto. Nunca subas un `.env` con valores reales al repositorio (ya está en el `.gitignore`); usa `.env.example` como plantilla. Si alguna vez publicaste una clave por error, **cámbiala**: borrarla del repositorio no basta, porque queda en el historial.

### 3. Levantar el servicio

```bash
docker compose up -d
```

Accede desde tu navegador a `http://tu-ip:3000` (o a través de tu proxy inverso con HTTPS como Nginx Proxy Manager, Cloudflare Tunnels o Traefik).

---

## 🔑 Configuración de Open Banking (Enable Banking)

Todo el proceso de credenciales se gestiona **directamente desde la interfaz web de ContaMiki** (en **Ajustes ➔ Bancos & Tickets ➔ Ajustar Credenciales**):

1. **Alta gratuita:** Regístrate como desarrollador en [enablebanking.com](https://enablebanking.com) (el servicio es gratuito para uso personal y sustituye la antigua API de GoCardless).
2. **Crear aplicación:**
   - En el panel de Enable Banking ve a **API applications** ➔ **Add a new application**.
   - Entorno: **Production**.
   - Generar clave en el navegador: se descargará automáticamente tu archivo **`enablebanking.pem`**.
   - Allowed redirect URLs (puedes copiarlas desde el botón de la app):
     ```text
     https://tu-dominio.com/api/bank/callback
     https://tu-dominio.com/
     ```
3. **Activar en producción:**
   - En el panel de Enable Banking, selecciona tu banco en el cuadro desplegable y pulsa **Link** para autorizar tu primera cuenta personal (la app pasará de `Inactive` a `Active`).
4. **Guardar en ContaMiki:**
   - Entra en ContaMiki en **Ajustes ➔ Bancos & Tickets ➔ Ajustar Credenciales**.
   - Pega tu **Application ID**, carga o pega tu clave **`enablebanking.pem`** y pulsa **Guardar y Verificar**.
   - Pulsa el botón negro **«Vincular Banco»**, autoriza tu entidad y asigna cada cuenta a tu contabilidad correspondiente.

---

## 📁 Estructura del Almacenamiento Persistente

Todos tus datos se almacenan de forma ordenada dentro del volumen `/app/data`:

```text
data/
├── users.json                 # Registro de usuarios y credenciales seguras
├── bank_config.json           # Configuración activa de Open Banking
├── bank_connections.json      # Conexiones bancarias autorizadas y mapeos
├── enablebanking.pem          # Clave RSA privada para Open Banking
├── tickets_inbox/             # Buzón temporal de facturas y tickets pendientes
│   └── factura_mercadona.pdf
└── users/
    └── usuario_email_com/
        ├── metadata.json      # Contabilidades y permisos del usuario
        ├── backups/           # Copias de seguridad automáticas diarias
        └── default_book_1/
            ├── config.json    # Cuentas, familias, categorías, favoritos y periódicos
            ├── transactions_2024.json
            ├── transactions_2025.json
            └── transactions_2026.json
```

Al guardar, **solo se reescriben los ficheros que han cambiado** (por ejemplo, solo el año con movimientos nuevos o modificados); la app guarda 1 segundo después de tu último cambio y, además, al instante si la pasas a segundo plano o la cierras.

---

## 💻 Desarrollo Local

Para ejecutar o contribuir al código fuente:

```bash
# 1. Clonar el repositorio
git clone https://github.com/mikiaiapp/contamiki.git
cd contamiki

# 2. Instalar dependencias
npm install

# 3. Iniciar entorno de desarrollo
npm run dev
```

---

## 📄 Licencia

Este proyecto está publicado bajo la licencia de código abierto [MIT](LICENSE). Siéntete libre de utilizarlo, modificarlo y compartirlo.
