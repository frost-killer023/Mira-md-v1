FROM node:18-slim

# Installation de Chromium et des dépendances Linux nécessaires pour whatsapp-web.js
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-freefont-ttf \
    libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Définir le dossier de travail dans le conteneur
WORKDIR /app

# Copier les fichiers de configuration des dépendances
COPY package*.json ./
RUN npm install

# Copier tout le reste du code du bot
COPY . .

# Variables d'environnement pour indiquer à whatsapp-web.js d'utiliser le Chromium installé
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Commande pour lancer le bot (pointe bien vers ton dossier src/)
CMD ["node", "src/index.js"]

