# Usamos imagen Debian Slim de Node.js 20 (LTS) con soporte nativo completo para glibc
# Esto evita problemas de compatibilidad de binarios nativos (esbuild, etc.) de Alpine/musl
FROM node:20-slim

# Establecemos el directorio de trabajo
WORKDIR /app

# 1. Copiamos archivos de dependencias
COPY package.json package-lock.json* ./

# 2. Instalamos las dependencias del proyecto
RUN npm install

# 3. Copiamos el resto del código fuente de la aplicación
COPY . .

# 4. Construimos el bundle de la aplicación
RUN npm run build

# Exponemos el puerto donde correrá la app
EXPOSE 3000

# Definimos variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000

# Comando para iniciar el servidor
CMD ["npm", "start"]
