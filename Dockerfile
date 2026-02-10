# Usamos la imagen base completa de Node.js 18 (basada en Debian Bullseye)
# Esta imagen es más pesada que Alpine, pero garantiza máxima compatibilidad
# con binarios del sistema (glibc) en arquitecturas como Synology NAS.
FROM node:18-bullseye

# Establecemos el directorio de trabajo dentro del contenedor
WORKDIR /app

# 1. Copiamos los archivos de definición de dependencias
COPY package.json ./
# Si tienes package-lock.json, descomenta la siguiente línea:
# COPY package-lock.json ./

# 2. Instalamos las dependencias
RUN npm install

# 3. Copiamos el resto del código fuente
COPY . .

# 4. Construimos la aplicación
RUN npm run build

# Exponemos el puerto
EXPOSE 4000

# Variables de entorno
ENV NODE_ENV=production
ENV PORT=4000

# Comando de inicio
CMD ["npm", "start"]