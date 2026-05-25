const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');
const CommandHandler = require('./CommandHandler');
const EventHandler = require('./EventHandler');
const Logger = require('../utils/Logger');

class Bot {
  constructor() {
    this.client = null;
    this.commandHandler = null;
    this.eventHandler = null;
    this.logger = new Logger();
    this.isReady = false;
  }

  async initialize() {
    try {
      this.logger.info('🤖 Initializing Mira Bot...');
      
      // Create WhatsApp client
      this.client = new Client({
        authStrategy: new LocalAuth({ clientId: config.whatsapp.session }),
        puppeteer: {
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
      });

      // Initialize handlers
      this.commandHandler = new CommandHandler(this.client);
      this.eventHandler = new EventHandler(this.client);

      // Setup Pairing Code (Modifié pour le déploiement sur mobile/Render)
      this.client.on('qr', async (qr) => {
        this.logger.warn('Demande de code de couplage en cours pour le numéro +25766486303...');
        try {
          // Demande le code texte à WhatsApp pour ton numéro (sans le signe +)
          const pairingCode = await this.client.requestPairingCode('25766486303');
          this.logger.success(`\n═══════════════════════════════════════════\n🔑 TON CODE DE COUPLAGE WHATSAPP : ${pairingCode}\n═══════════════════════════════════════════\n`);
        } catch (err) {
          this.logger.error('Erreur lors de la génération du pairing code :', err);
        }
      });

      // Setup Ready event
      this.client.on('ready', () => {
        this.isReady = true;
        this.logger.success('✅ Bot is ready!');
      });

      // Setup Authenticated event
      this.client.on('authenticated', () => {
        this.logger.success('✅ Client authenticated!');
      });

      // Setup Message event
      this.client.on('message', async (message) => {
        await this.commandHandler.handleMessage(message);
      });

      // Setup Disconnect event
      this.client.on('disconnected', () => {
        this.logger.warn('⚠️ Client disconnected!');
        this.isReady = false;
      });

      // Setup error handling
      this.client.on('error', (error) => {
        this.logger.error('Client Error:', error);
      });

      // Start bot
      await this.client.initialize();
      this.logger.success('🚀 Mira Bot started successfully!');
    } catch (error) {
      this.logger.error('Failed to initialize bot:', error);
      process.exit(1);
    }
  }

  async shutdown() {
    this.logger.warn('🛑 Shutting down bot...');
    if (this.client) {
      await this.client.destroy();
    }
    process.exit(0);
  }

  getClient() {
    return this.client;
  }

  isClientReady() {
    return this.isReady && this.client.info;
  }
}

module.exports = Bot;
