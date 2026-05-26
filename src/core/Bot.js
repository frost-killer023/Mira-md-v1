const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const http = require('http');
const path = require('path');
const Logger = require('../utils/Logger');
const CommandHandler = require('./CommandHandler');

class Bot {
  constructor() {
    this.socket        = null;
    this.logger        = new Logger();
    this.commandHandler = null;
    this.isReconnecting = false;
    this._httpStarted  = false;
  }

  async initialize() {

    // ── 1. SERVEUR HTTP ──────────────────────────────────────────
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

    // ── 2. SESSION ───────────────────────────────────────────────
    const sessionsPath = path.join(process.cwd(), 'sessions');
    const { state, saveCreds } = await useMultiFileAuthState(sessionsPath);

    // ── 3. VERSION BAILEYS ───────────────────────────────────────
    const { version, isLatest } = await fetchLatestBaileysVersion();
    this.logger.info('Baileys v' + version.join('.') + ' — Latest: ' + isLatest);

    // ── 4. SOCKET ────────────────────────────────────────────────
    // Aucun "browser" personnalisé, aucun makeCacheableSignalKeyStore
    // On passe l'auth state directement tel que retourné par useMultiFileAuthState
    this.socket = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      markOnlineOnConnect: true,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
    });

    this.commandHandler = new CommandHandler(this.socket);

    // ── 5. CODE PAIR ─────────────────────────────────────────────
    // Le code est demandé immédiatement après la création du socket.
    // Le numéro BOT_OWNER doit être exactement : 25766486303
    if (!state.creds.registered) {
      const phoneNumber = (process.env.BOT_OWNER || '25766486303').replace(/[^0-9]/g, '');
      this.logger.info('📱 Numéro utilisé pour le code pair : +' + phoneNumber);

      try {
        const code = await this.socket.requestPairingCode(phoneNumber);
        const formatted = (code || '').replace(/(.{4})/g, '$1-').replace(/-$/, '');

        this.logger.info('');
        this.logger.info('╔══════════════════════════════════════════╗');
        this.logger.info('║  🔑  CODE PAIR : ' + formatted + '              ║');
        this.logger.info('╠══════════════════════════════════════════╣');
        this.logger.info('║  ⚠️  EXPIRE DANS 160 SECONDES            ║');
        this.logger.info('╠══════════════════════════════════════════╣');
        this.logger.info('║  Sur WhatsApp :                          ║');
        this.logger.info('║  Paramètres › Appareils liés             ║');
        this.logger.info('║  › Lier un appareil                      ║');
        this.logger.info('║  › Lier avec numéro de téléphone         ║');
        this.logger.info('║  › Entrer le code ci-dessus              ║');
        this.logger.info('╚══════════════════════════════════════════╝');
        this.logger.info('');

      } catch (err) {
        this.logger.error('❌ Erreur requestPairingCode : ' + err.message);
        this.logger.info('🔄 Nouvelle tentative dans 6 secondes...');
        await new Promise(r => setTimeout(r, 6000));
        return this.initialize();
      }
    }

    // ── 6. ÉVÉNEMENTS DE CONNEXION ───────────────────────────────
    this.socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'open') {
        this.logger.info('✅ Bot connecté à WhatsApp !');
        this.isReconnecting = false;

        const ownerNumber = (process.env.BOT_OWNER || '25766486303').replace(/[^0-9]/g, '');
        const ownerJid    = ownerNumber + '@s.whatsapp.net';

        setTimeout(async () => {
          try {
            await this.socket.sendMessage(ownerJid, {
              text:
                '╔════════════════════════════╗\n' +
                '║   🤖 *MIRA BOT — CONNECTÉ*  ║\n' +
                '╚════════════════════════════╝\n\n' +
                '✅ *Le bot est en ligne !*\n\n' +
                '📌 *Préfixe :* `!`\n\n' +
                '📚 *Commandes disponibles :*\n' +
                '• !ping  — Tester le bot\n' +
                '• !help  — Toutes les commandes\n' +
                '• !menu  — Menu principal\n' +
                '• !info  — Infos du bot\n' +
                '• !admin — Panneau admin\n\n' +
                '_Tapez_ !help _pour tout voir._'
            });
            this.logger.info('📨 Message de confirmation envoyé à +' + ownerNumber);
          } catch (e) {
            this.logger.error('Erreur envoi message owner : ' + e.message);
          }
        }, 4000);
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const loggedOut  = statusCode === DisconnectReason.loggedOut;

        this.logger.warn('⚠️  Connexion fermée — code : ' + statusCode);

        if (loggedOut) {
          this.logger.error('❌ Session expirée (loggedOut). Redémarrez sur Render.');
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

    // ── 7. CREDENTIALS ───────────────────────────────────────────
    this.socket.ev.on('creds.update', saveCreds);

    // ── 8. MESSAGES ──────────────────────────────────────────────
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
