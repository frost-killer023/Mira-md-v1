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
    this._pairingDone = false;
  }

  async initialize() {

    // 1. SERVEUR HTTP
    if (!this._httpStarted) {
      const PORT = process.env.PORT || 3000;
      http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Mira Bot is Online');
      }).listen(PORT, '0.0.0.0', () => {
        this.logger.info('🌐 Serveur HTTP actif sur le port ' + PORT);
      });
      this._httpStarted = true;
    }

    // 2. SESSION
    const sessionsPath = path.join(process.cwd(), 'sessions');
    const { state, saveCreds } = await useMultiFileAuthState(sessionsPath);

    // 3. VERSION BAILEYS
    const { version, isLatest } = await fetchLatestBaileysVersion();
    this.logger.info('Baileys v' + version.join('.') + ' — Latest: ' + isLatest);

    // 4. SOCKET
    this.socket = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: Browsers.macOS('Desktop'),
      markOnlineOnConnect: true,
    });

    this.commandHandler = new CommandHandler(this.socket);

    // 5. CODE PAIR
    // Timer fixe de 5 secondes — aucun .once() ni .on() utilisé ici
    if (!state.creds.registered && !this._pairingDone) {
      this._pairingDone = true;
      const phoneNumber = (process.env.BOT_OWNER || '25766486303').replace(/[^0-9]/g, '');
      this.logger.info('📱 Démarrage dans 5 secondes puis génération du code pair...');

      setTimeout(async () => {
        try {
          const code = await this.socket.requestPairingCode(phoneNumber);
          const formatted = code.match(/.{1,4}/g).join('-');

          this.logger.info('');
          this.logger.info('╔══════════════════════════════════════════╗');
          this.logger.info('║  🔑  CODE : ' + formatted + '                    ║');
          this.logger.info('╠══════════════════════════════════════════╣');
          this.logger.info('║  ⚠️  EXPIRE DANS 2 MINUTES — URGENT      ║');
          this.logger.info('╠══════════════════════════════════════════╣');
          this.logger.info('║  1. WhatsApp → Paramètres                ║');
          this.logger.info('║  2. Appareils liés → Lier un appareil    ║');
          this.logger.info('║  3. Lier avec numéro de téléphone        ║');
          this.logger.info('║  4. Entrez le code ci-dessus             ║');
          this.logger.info('╚══════════════════════════════════════════╝');
          this.logger.info('');

        } catch (err) {
          this.logger.error('❌ Erreur code pair : ' + err.message);
          this.logger.info('🔄 Redémarrage dans 8 secondes...');
          setTimeout(() => {
            this._pairingDone = false;
            this.initialize();
          }, 8000);
        }
      }, 5000);
    }

    // 6. CONNEXION
    this.socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'open') {
        this.logger.info('✅ Bot connecté à WhatsApp !');
        this.isReconnecting = false;

        const ownerNumber = (process.env.BOT_OWNER || '25766486303').replace(/[^0-9]/g, '');
        const ownerJid = ownerNumber + '@s.whatsapp.net';

        setTimeout(async () => {
          try {
            await this.socket.sendMessage(ownerJid, {
              text:
                '╔════════════════════════════╗\n' +
                '║   🤖 *MIRA BOT — CONNECTÉ*  ║\n' +
                '╚════════════════════════════╝\n\n' +
                '✅ *Le bot est en ligne !*\n\n' +
                '📌 *Préfixe :* !\n\n' +
                '📚 *Commandes :*\n' +
                '!ping — Tester le bot\n' +
                '!help — Toutes les commandes\n' +
                '!menu — Menu principal\n' +
                '!info — Infos du bot\n\n' +
                '_Tapez !help pour la liste complète._'
            });
            this.logger.info('📨 Message de confirmation envoyé.');
          } catch (e) {
            this.logger.error('Erreur envoi message owner : ' + e.message);
          }
        }, 3000);
      }

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = code === DisconnectReason.loggedOut;
        this.logger.warn('⚠️ Connexion fermée (code : ' + code + ')');

        if (loggedOut) {
          this.logger.error('❌ Session expirée — redémarrez le service sur Render.');
        } else if (!this.isReconnecting) {
          this.isReconnecting = true;
          this.logger.info('🔄 Reconnexion dans 5 secondes...');
          setTimeout(() => {
            this.isReconnecting = false;
            this.initialize();
          }, 5000);
        }
      }
    });

    // 7. CREDENTIALS
    this.socket.ev.on('creds.update', saveCreds);

    // 8. MESSAGES
    this.socket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        if (msg.key.fromMe || !msg.message) continue;
        await this.commandHandler.handleMessage(msg);
      }
    });
  }

  async shutdown() {
    this.logger.info('🛑 Arrêt du bot...');
    if (this.socket) this.socket.end();
    process.exit(0);
  }
}

module.exports = Bot;
