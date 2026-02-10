# Usamos una imagen basada en Debian (slim) en lugar de Alpine.
# Esto asegura compatibilidad con glibc, necesario para que binarios como
# 'esbuild' funcionen correctamente en arquitecturas de NAS (Synology).
FROM node:18-slim

# Establecemos el directorio de trabajo dentro del contenedor
WORKDIR /app

# 1. Copiamos los archivos de definición de dependencias
COPY package.json ./

# 2. Instalamos las dependencias del proyecto
RUN npm install

# 3. Copiamos el resto del código fuente de la aplicación
COPY . .

# 4. Construimos el bundle de la aplicación (frontend)
# Esto ejecuta el script "build" definido en package.json
RUN npm run build

# Exponemos el puerto donde correrá la app
EXPOSE 4000

# Definimos variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=4000

# Comando para iniciar el servidor
CMD ["npm", "start"]