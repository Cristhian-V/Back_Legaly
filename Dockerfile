# Usar una imagen ligera de Node.js
FROM node:18-alpine

# Crear directorio de trabajo en el contenedor
WORKDIR /app

# Copiar los archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código del backend
COPY . .

# Exponer el puerto donde corre tu API (ej. 3000)
EXPOSE 3000

# Comando para iniciar la aplicación (ajusta si usas otro archivo principal)
CMD ["node", "server.js"]