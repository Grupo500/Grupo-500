FROM node:20-alpine

WORKDIR /app

# Instala todas las dependencias (incluye devDeps para tsc y prisma CLI)
COPY package*.json ./
RUN npm install --include=dev

# Copia el resto del proyecto y compila
COPY . .
RUN npm run build

EXPOSE 3001
CMD ["npm", "start"]
