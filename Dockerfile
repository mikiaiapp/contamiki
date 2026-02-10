# Usamos una imagen ligera de Node.js basada en Alpine Linux
FROM node:18-alpine

# --- SOLUCIÓN DEL ERROR ---
# Instalamos la librería de compatibilidad libc6.
# Esto es OBLIGATORIO para que 'esbuild' funcione dentro de Alpine Linux.
RUN apk add --no-cache libc6-compat

# Establecemos el directorio de trabajo
WORKDIR /app

# 1. Copiamos primero los archivos de definición de dependencias
# Esto permite a Docker cachear la instalación de módulos si estos archivos no cambian
COPY package.json ./
# Si tuvieras un package-lock.json, deberías descomentar la siguiente línea:
# COPY package-lock.json ./

# 2. Instalamos las dependencias del proyecto
RUN npm install

# 3. Copiamos el resto del código fuente de la aplicación
COPY . .

# 4. Construimos el bundle de la aplicación
# Esto ejecutará "esbuild index.tsx ..." definido en tu package.json
RUN npm run build

# Exponemos el puerto donde correrá la app
EXPOSE 4000

# Definimos variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=4000

# Comando para iniciar el servidor
CMD ["npm", "start"]