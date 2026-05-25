const { Client, LocalAuth } = require('whatsapp-web.js');
const http = require('http');
const Logger = require('../utils/Logger');
const CommandHandler = require('./CommandHandler');

class Bot {
  constructor() {
    this.client = null;
    this.logger = new Logger();
    this.hasRequestedCode = false;
  }

  async initialize() {
    // 1. Lancement du serveur ping pour Render (Obligatoire pour éviter le redémarrage)
    const PORT = process.env.PORT || 3000;
    http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Mira Bot is Online');
    }).listen(PORT, '0.0.0.0');
    
    this.logger.info(`🌐 Serveur HTTP actif sur le port ${PORT}`);

    // 2. Configuration du client
    this.client = new Client({
      authStrategy: new LocalAuth({ clientId: 'mira-session' }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox', 
          '--disable-dev-shm-usage',
          '--no-first-run',
          '--disable-extensions'
        ]
      }
    });

    this.commandHandler = new CommandHandler(this.client);

    // 3. Gestion du code de couplage
    this.client.on('qr', async (qr) => {
      if (this.hasRequestedCode) return;
      this.hasRequestedCode = true;

      this.logger.info('Tentative de connexion en cours...');
      
      try {
        // Attente de sécurité pour laisser le navigateur se stabiliser
        await new Promise(resolve => setTimeout(resolve, 8000));
        
        const pairingCode = await this.client.requestPairingCode('25766486303');
        this.logger.success(`\n═══════════════════════════════════════════\n🔑 CODE DE COUPLAGE : ${pairingCode}\n═══════════════════════════════════════════\n`);
      } catch (err) {
        this.logger.error('Erreur PairingCode:', err.message);
        this.hasRequestedCode = false; // Permet de relancer après une erreur
      }
    });

    this.client.on('ready', () => this.logger.success('✅ Bot prêt et connecté !'));
    this.client.on('message', async (msg) => await this.commandHandler.handleMessage(msg));
    this.client.on('disconnected', () => {
        this.logger.warn('⚠️ Déconnecté');
        this.hasRequestedCode = false;
    });

    await this.client.initialize();
  }
}

module.exports = Bot;
