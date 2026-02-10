# Usamos la imagen completa 'bullseye' (Debian 11).
# Esta imagen es la más compatible para Synology NAS porque incluye
# el entorno completo de glibc y herramientas nativas que 'esbuild' necesita
# para compilar sin errores de "exit code 1".
FROM node:18-bullseye

# Establecemos el directorio de trabajo dentro del contenedor
WORKDIR /app

# 1. Copiamos el archivo de dependencias
COPY package.json ./

# 2. Instalamos las dependencias
# Al estar en una imagen completa, npm descargará los binarios
# correctos para la arquitectura de tu NAS.
RUN npm install

# 3. Copiamos el resto del código fuente
COPY . .

# 4. Construimos la aplicación
# Este paso suele fallar en Alpine/Slim en NAS, pero funcionará aquí.
RUN npm run build

# Exponemos el puerto de la aplicación
EXPOSE 4000

# Variables de entorno para producción
ENV NODE_ENV=production
ENV PORT=4000

# Comando de inicio
CMD ["npm", "start"]