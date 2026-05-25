const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const http = require('http');
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
    this.hasRequestedCode = false; 
  }

  async initialize() {
    try {
      this.logger.info('🤖 Initializing Mira Bot...');
      
      // 1. Serveur HTTP pour stabiliser Render sur le port requis
      const PORT = process.env.PORT || 3000;
      http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Mira Bot is running smoothly!\n');
      }).listen(PORT, '0.0.0.0', () => {
        this.logger.success(`🌐 Ping server listening on port ${PORT}`);
      });

      // 2. Configuration ultra-robuste de Puppeteer pour éviter le blocage WhatsApp et le crash RAM
      this.client = new Client({
        authStrategy: new LocalAuth({ clientId: config.whatsapp.session }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
          ],
          // Permet de contourner le blocage anti-bot de WhatsApp (Règle l'erreur "- t")
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      // Initialize handlers
      this.commandHandler = new CommandHandler(this.client);
      this.eventHandler = new EventHandler(this.client);

      // Setup Pairing Code avec sécurité anti-spam
      this.client.on('qr', async (qr) => {
        if (this.hasRequestedCode) return;
        this.hasRequestedCode = true;
        
        this.logger.warn('Page WhatsApp Web chargée. Préparation du code de couplage dans 10 secondes...');
        
        // On attend que la page soit stable avant de forcer la demande du code
        setTimeout(async () => {
          try {
            const pairingCode = await this.client.requestPairingCode('25766486303');
            this.logger.success(`\n═══════════════════════════════════════════\n🔑 TON CODE DE COUPLAGE WHATSAPP : ${pairingCode}\n═══════════════════════════════════════════\n`);
          } catch (err) {
            this.logger.error('Erreur lors de la génération du pairing code :', err.message || err);
            this.hasRequestedCode = false; // Réinitialise si WhatsApp rejette à cause du délai
          }
        }, 10000);
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
        this.hasRequestedCode = false;
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
