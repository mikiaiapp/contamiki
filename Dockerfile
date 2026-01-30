
# Directorio de trabajo
WORKDIR /aplicación

# Copiar archivos de dependencias
COPIA paquete.json .

# Instalar dependencias (incluyendo devDependencies para esbuild)
EJECUTAR npm install

# Copiar el resto del código fuente
COPIAR . .

# Construir el frontend (genera bundle.js)
EJECUTAR npm run build

# Exponer el puerto
EXPONER 4000

# Iniciar el servidor
CMD ["npm", "inicio"]

