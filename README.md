# ContaMiki 📊

<div align="center">
  <img width="1200" height="475" alt="ContaMiki Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

  <p><strong>Gestor financiero personal y familiar auto-alojado (Self-Hosted), multi-libro y con sincronización bancaria Open Banking (PSD2).</strong></p>

  <p>
    <img src="https://img.shields.io/badge/Node.js-18+-green.svg" alt="Node.js" />
    <img src="https://img.shields.io/badge/Docker-Ready-blue.svg" alt="Docker" />
    <img src="https://img.shields.io/badge/Open_Banking-PSD2-orange.svg" alt="Open Banking" />
    <img src="https://img.shields.io/badge/License-MIT-purple.svg" alt="License" />
  </p>
</div>

---

## 🚀 Características principales

- **🏠 Multi-Libro independiente:** Gestiona varias contabilidades separadas (ej. *CASA*, *NEGOCIO*, *AHORROS*) dentro de la misma cuenta.
- **👥 Multi-Usuario y Colaboración:** Invita a otros usuarios con roles de edición o solo lectura sobre libros específicos.
- **🔐 Seguridad y Privacidad:**
  - Autenticación segura mediante **JWT**.
  - **Doble Factor de Autenticación (2FA / TOTP)** compatible con Google Authenticator, Authy, etc.
  - Almacenamiento 100% privado en volúmenes persistentes locales.
- **🏦 Sincronización Bancaria Automática (Open Banking / PSD2):**
  - Conexión oficial y certificada con más de 100 bancos españoles (CaixaBank, Banco Santander, Bankinter, BBVA, etc.) y europeos vía API Open Banking.
  - Sincronización programada y descarga automática de movimientos diarios.
- **📎 Gestión de Tickets y Adjuntos:**
  - Adjunta fotos y comprobantes en JPG o PDF.
  - Visor interactivo nativo integrado en la propia aplicación.
- **🧠 Motor de Auto-Categorización:**
  - Reglas inteligentes basadas en historial bancario.
  - Bandeja de entrada para transacciones pendientes de clasificar o validar.
- **📈 Gráficos e Informes Visuales:**
  - Desglose por familias, categorías y evolución temporal con Recharts.
  - Filtros avanzados por mes, año o rango de fechas personalizado.
- **💾 Copias de Seguridad Automáticas:**
  - Backups diarios automáticos rotativos por libro contable.

---

## 🐳 Despliegue con Docker (Recomendado)

La forma más sencilla y rápida de desplegar ContaMiki en un NAS (Synology, QNAP), servidor doméstico o VPS es mediante `docker-compose`.

### 1. `docker-compose.yml`

Crea un archivo `docker-compose.yml` con la siguiente configuración:

```yaml
version: '3.8'

services:
  contamiki:
    container_name: contamiki
    image: ghcr.io/mikiaiapp/contamiki:latest  # o build: . si compilas localmente
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - NODE_ENV=production
      - JWT_SECRET=cambia_esta_clave_por_una_cadena_larga_y_aleatoria
      - APP_URL=https://conta.tudominio.com  # URL pública o IP con protocolo
    volumes:
      - ./data:/app/data
```

### 2. Iniciar el contenedor

```bash
docker compose up -d
```

La aplicación estará accesible de inmediato en el puerto `3000` (o a través de tu proxy inverso HTTPS habitual como Nginx Proxy Manager, Traefik o Caddy).

---

## 🏦 Configuración de Sincronización Bancaria (Open Banking)

ContaMiki permite conectarse de forma oficial a tus bancos bajo la normativa europea **PSD2**, sin almacenar tus contraseñas bancarias y mediante autorización segura en tu propia app del banco.

### Paso 1: Obtener credenciales de desarrollador

1. Regístrate en el portal de Open Banking europeo de [Enable Banking](https://enablebanking.com/sign-in/) (o GoCardless Bank Account Data).
2. Accede a la pestaña **`API applications`** y pulsa en **`Add a new application`**:
   - **Environment:** `Production` (para bancos reales).
   - **Allowed redirect URLs:**
     ```text
     https://conta.tudominio.com/api/bank/callback
     https://conta.tudominio.com
     ```
   - **Private Key:** Selecciona generar clave en el navegador.
3. Al registrarse, el navegador descargará automáticamente un archivo de clave privada (ej. `xxxxxxxx.pem`). Guarda también el **`Application ID`** (UUID).

### Paso 2: Configurar las claves en ContaMiki

1. Copia tu archivo de clave privada dentro de la carpeta persistente de datos de Docker:
   ```text
   /ruta_a_tu_volumen/data/enablebanking.pem
   ```
2. Añade las siguientes variables de entorno a tu `docker-compose.yml` o archivo `.env`:
   ```env
   ENABLE_BANKING_APP_ID=tu_application_id_aqui
   ENABLE_BANKING_KEY_PATH=/app/data/enablebanking.pem
   ```

### Paso 3: Vincular tus cuentas bancarias

1. En el panel de Enable Banking, en tu aplicación, utiliza los desplegables de vinculación de cuentas:
   - **Country:** `Spain` (ES)
   - **ASPSP / Banco:** Selecciona tu entidad (*CaixaBank*, *Banco Santander*, *Bankinter*, etc.)
   - **PSU Type:** `Personal`
   - Pulsa **`Link`**.
2. Te redirigirá a la pasarela oficial de tu banco para autorizar el acceso de lectura con tu app bancaria.
3. Una vez autorizado, la aplicación se activará automáticamente y ContaMiki comenzará a sincronizar tus movimientos.

> [!NOTE]
> Por exigencia de la directiva europea PSD2, la autorización de acceso tiene una validez máxima de 90 a 180 días. Cumplido ese plazo, basta con volver a autorizar el acceso en la app del banco.

---

## 💻 Desarrollo local

Si prefieres ejecutar o modificar ContaMiki localmente:

### Requisitos previos
- [Node.js](https://nodejs.org/) v18 o superior
- npm

### Pasos

1. Clona el repositorio:
   ```bash
   git clone https://github.com/mikiaiapp/contamiki.git
   cd contamiki
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Crea un archivo `.env` en la raíz (puedes basarte en `.env.example`):
   ```env
   JWT_SECRET=secreto_de_desarrollo
   APP_URL=http://localhost:3000
   ```

4. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

5. Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## 📁 Estructura del Almacenamiento

Todos los datos se guardan de forma aislada y estructurada dentro de la carpeta `/app/data` montada en el host:

```text
data/
├── users.json                 # Registro de usuarios y hash de contraseñas
├── shared_access.json         # Permisos de libros compartidos
├── invitations.json           # Invitaciones de colaboración pendientes
├── enablebanking.pem          # Clave RSA para Open Banking
└── users/
    └── usuario_email_com/
        ├── metadata.json      # Configuración de libros del usuario
        ├── backups/           # Copias de seguridad automáticas
        └── default_book_1/
            ├── config.json    # Cuentas, familias y categorías del libro
            ├── transactions_2024.json
            ├── transactions_2025.json
            └── transactions_2026.json
```

---

## 📄 Licencia

Este proyecto está bajo la licencia [MIT](LICENSE).
