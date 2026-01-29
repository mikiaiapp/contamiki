FROM node:18-alpine

# Directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package.json .

# Instalar dependencias (incluyendo devDependencies para esbuild)
RUN npm install

# Copiar el resto del código fuente
COPY . .

# Construir el frontend (genera bundle.js)
RUN npm run build

# Exponer el puerto
EXPOSE 3000

# Iniciar el servidor
CMD ["npm", "start"]