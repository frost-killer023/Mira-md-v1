const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const http = require('http');
const path = require('path');
const Logger = require('../utils/Logger');
const CommandHandler = require('./CommandHandler');

class Bot {
  constructor() {
    this.socket = null;
    this.logger = new Logger();
    this.commandHandler = null;
    this.isReconnecting = false;
    this._httpStarted = false;
  }

  async initialize() {
    // ─────────────────────────────────────────────────────────────
    // 1. SERVEUR HTTP — obligatoire pour que Render ne kill pas le service
    // ─────────────────────────────────────────────────────────────
    if (!this._httpStarted) {
      const PORT = process.env.PORT || 3000;
      http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Mira Bot is Online ✅');
      }).listen(PORT, '0.0.0.0', () => {
        this.logger.info(`🌐 Serveur HTTP actif sur le port ${PORT}`);
      });
      this._httpStarted = true;
    }

    // ─────────────────────────────────────────────────────────────
    // 2. CHARGEMENT DE LA SESSION
    // ─────────────────────────────────────────────────────────────
    const sessionsPath = path.join(process.cwd(), 'sessions');
    const { state, saveCreds } = await useMultiFileAuthState(sessionsPath);

    // ─────────────────────────────────────────────────────────────
    // 3. VERSION WHATSAPP
    // ─────────────────────────────────────────────────────────────
    const { version, isLatest } = await fetchLatestBaileysVersion();
    this.logger.info(`Baileys v${version.join('.')} — Latest: ${isLatest}`);

    // ─────────────────────────────────────────────────────────────
    // 4. CRÉATION DU SOCKET BAILEYS
    // ─────────────────────────────────────────────────────────────
    this.socket = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: Browsers.macOS('Desktop'),
      markOnlineOnConnect: true,
    });

    this.commandHandler = new CommandHandler(this.socket);

    // ─────────────────────────────────────────────────────────────
    // 5. GÉNÉRATION DU CODE PAIR (seulement si pas encore connecté)
    // ─────────────────────────────────────────────────────────────
    if (!state.creds.registered) {
      const phoneNumber = (process.env.BOT_OWNER || '25766486303').replace(/[^0-9]/g, '');

      this.logger.info(`📱 Génération du code pair pour +${phoneNumber}...`);

      // Délai requis pour que le socket se stabilise avant la requête
      await new Promise(resolve => setTimeout(resolve, 3000));

      try {
        const code = await this.socket.requestPairingCode(phoneNumber);
        // Formater le code en XXXX-XXXX pour faciliter la lecture
        const formatted = code.match(/.{1,4}/g)?.join('-') || code;

        this.logger.info('');
        this.logger.info('╔══════════════════════════════════════════════╗');
        this.logger.info(`║  🔑  CODE DE COUPLAGE :  ${formatted}          ║`);
        this.logger.info('╠══════════════════════════════════════════════╣');
        this.logger.info('║  📱 Comment l\'utiliser :                     ║');
        this.logger.info('║  1. Ouvrez WhatsApp sur votre téléphone      ║');
        this.logger.info('║  2. Paramètres > Appareils liés              ║');
        this.logger.info('║     > Lier un appareil                       ║');
        this.logger.info('║  3. Appuyez sur "Lier avec numéro de tél."   ║');
        this.logger.info(`║  4. Entrez le code : ${formatted}              ║`);
        this.logger.info('╚══════════════════════════════════════════════╝');
        this.logger.info('');
      } catch (err) {
        this.logger.error(`❌ Erreur code pair : ${err.message}`);
        this.logger.info('🔄 Nouvelle tentative dans 8 secondes...');
        setTimeout(() => this.initialize(), 8000);
        return;
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 6. ÉVÉNEMENTS DE CONNEXION
    // ─────────────────────────────────────────────────────────────
    this.socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'open') {
        this.logger.info('✅ Bot connecté à WhatsApp avec succès !');
        this.isReconnecting = false;

        // Message de confirmation envoyé à l'owner après connexion
        const ownerNumber = (process.env.BOT_OWNER || '25766486303').replace(/[^0-9]/g, '');
        const ownerJid = `${ownerNumber}@s.whatsapp.net`;

        setTimeout(async () => {
          try {
            await this.socket.sendMessage(ownerJid, {
              text:
                '╔════════════════════════════╗\n' +
                '║   🤖 *MIRA BOT — CONNECTÉ*  ║\n' +
                '╚════════════════════════════╝\n\n' +
                '✅ *Le bot est en ligne et opérationnel !*\n\n' +
                '📌 *Préfixe des commandes :* !\n\n' +
                '📚 *Commandes disponibles :*\n' +
                '!ping  — Tester le bot\n' +
                '!help  — Afficher toutes les commandes\n' +
                '!menu  — Menu principal\n' +
                '!info  — Informations du bot\n' +
                '!admin — Panneau administrateur\n\n' +
                '_Tapez !help pour la liste complète._'
            });
            this.logger.info('📨 Message de confirmation envoyé à l\'owner.');
          } catch (e) {
            this.logger.error(`Impossible d'envoyer le message à l'owner : ${e.message}`);
          }
        }, 3000);
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        this.logger.warn(`⚠️ Connexion fermée (code : ${statusCode})`);

        if (loggedOut) {
          this.logger.error('❌ Session expirée. Supprimez le dossier sessions/ et redémarrez.');
        } else if (!this.isReconnecting) {
          this.isReconnecting = true;
          this.logger.info('🔄 Reconnexion dans 5 secondes...');
          setTimeout(() => this.initialize(), 5000);
        }
      }
    });

    // ─────────────────────────────────────────────────────────────
    // 7. SAUVEGARDE DES CREDENTIALS
    // ─────────────────────────────────────────────────────────────
    this.socket.ev.on('creds.update', saveCreds);

    // ─────────────────────────────────────────────────────────────
    // 8. RÉCEPTION DES MESSAGES
    // ─────────────────────────────────────────────────────────────
    this.socket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        // Ignorer les messages envoyés par le bot lui-même
        if (msg.key.fromMe || !msg.message) continue;
        await this.commandHandler.handleMessage(msg);
      }
    });
  }

  async shutdown() {
    this.logger.info('🛑 Arrêt du bot...');
    if (this.socket) {
      this.socket.end();
    }
    process.exit(0);
  }
}

module.exports = Bot;
