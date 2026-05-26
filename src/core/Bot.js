const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const pino   = require('pino');
const http   = require('http');
const path   = require('path');
const Logger = require('../utils/Logger');
const CommandHandler = require('./CommandHandler');

const FALLBACK_VERSION = [2, 3000, 1015901307];

class Bot {
  constructor() {
    this.socket           = null;
    this.logger           = new Logger();
    this.commandHandler   = null;
    this.isReconnecting   = false;
    this._httpStarted     = false;
    this._pairingRequested = false;
    this._pairingTimer    = null;
  }

  async initialize() {
    try {
      await this._boot();
    } catch (err) {
      // On rattrape TOUT pour ne jamais laisser planter le process
      this.logger.error('Erreur initialize() : ' + err.message);
      this.logger.info('🔄 Redémarrage dans 8 secondes...');
      setTimeout(() => this.initialize(), 8000);
    }
  }

  async _boot() {

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

    // ── 3. VERSION WA ────────────────────────────────────────────
    let version = FALLBACK_VERSION;
    try {
      const result = await fetchLatestBaileysVersion();
      version = result.version;
      this.logger.info('Version WA : ' + version.join('.'));
    } catch (_) {
      this.logger.warn('Fallback version WA : ' + FALLBACK_VERSION.join('.'));
    }

    // ── 4. SOCKET ────────────────────────────────────────────────
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
    if (!state.creds.registered && !this._pairingRequested) {
      this._pairingRequested = true;
      const phone = (process.env.BOT_OWNER || '25766486303').replace(/[^0-9]/g, '');
      this.logger.info('📱 Numéro : +' + phone);

      try {
        const code = await this.socket.requestPairingCode(phone);
        const fmt  = (code || '').replace(/(.{4})(?=.)/g, '$1-');

        this.logger.info('');
        this.logger.info('╔══════════════════════════════════════════╗');
        this.logger.info('║  🔑  CODE PAIR : ' + fmt + '             ║');
        this.logger.info('╠══════════════════════════════════════════╣');
        this.logger.info('║  ⏳  EXPIRE DANS 160 SECONDES            ║');
        this.logger.info('║  Entrez-le MAINTENANT dans WhatsApp !    ║');
        this.logger.info('╠══════════════════════════════════════════╣');
        this.logger.info('║  1. WhatsApp → Paramètres                ║');
        this.logger.info('║  2. Appareils liés → Lier un appareil    ║');
        this.logger.info('║  3. Lier avec numéro de téléphone        ║');
        this.logger.info('║  4. Tapez le code ci-dessus              ║');
        this.logger.info('╚══════════════════════════════════════════╝');
        this.logger.info('');

        // Reset après 3 min si toujours pas connecté → nouveau code
        if (this._pairingTimer) clearTimeout(this._pairingTimer);
        this._pairingTimer = setTimeout(() => {
          if (!this.socket?.authState?.creds?.registered) {
            this.logger.warn('⏰ Code expiré — nouveau code dans 3 secondes...');
            this._pairingRequested = false;
            if (this.socket) { try { this.socket.end(); } catch (_) {} }
            setTimeout(() => this.initialize(), 3000);
          }
        }, 3 * 60 * 1000);

      } catch (err) {
        this._pairingRequested = false;
        throw new Error('requestPairingCode : ' + err.message);
      }
    }

    // ── 6. CONNEXION ─────────────────────────────────────────────
    this.socket.ev.on('connection.update', (update) => {
      // On enveloppe dans un try/catch pour ne jamais laisser
      // une exception non gérée remonter jusqu'à process
      this._handleConnectionUpdate(update, saveCreds).catch(err => {
        this.logger.error('connection.update non géré : ' + err.message);
      });
    });

    // ── 7. CREDENTIALS ───────────────────────────────────────────
    this.socket.ev.on('creds.update', saveCreds);

    // ── 8. MESSAGES ──────────────────────────────────────────────
    this.socket.ev.on('messages.upsert', ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        if (msg.key.fromMe || !msg.message) continue;
        this.commandHandler.handleMessage(msg).catch(err => {
          this.logger.error('handleMessage : ' + err.message);
        });
      }
    });
  }

  async _handleConnectionUpdate(update) {
    const { connection, lastDisconnect } = update;

    if (connection === 'open') {
      this.logger.info('✅ Bot connecté à WhatsApp !');
      this.isReconnecting    = false;
      this._pairingRequested = false;
      if (this._pairingTimer) { clearTimeout(this._pairingTimer); this._pairingTimer = null; }

      const owner = (process.env.BOT_OWNER || '25766486303').replace(/[^0-9]/g, '');
      const jid   = owner + '@s.whatsapp.net';

      setTimeout(async () => {
        try {
          await this.socket.sendMessage(jid, {
            text:
              '╔════════════════════════════╗\n' +
              '║   🤖 *MIRA BOT — CONNECTÉ*  ║\n' +
              '╚════════════════════════════╝\n\n' +
              '✅ *Le bot est en ligne !*\n\n' +
              '📌 *Préfixe :* `!`\n\n' +
              '📚 *Commandes :*\n' +
              '• !ping  — Tester le bot\n' +
              '• !help  — Toutes les commandes\n' +
              '• !menu  — Menu principal\n' +
              '• !info  — Infos du bot\n' +
              '• !admin — Panneau admin\n\n' +
              '_Tapez_ !help _pour tout voir._'
          });
          this.logger.info('📨 Message envoyé à +' + owner);
        } catch (e) {
          this.logger.error('Envoi message owner : ' + e.message);
        }
      }, 4000);
      return;
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      this.logger.warn('⚠️  Connexion fermée — code : ' + statusCode);

      // 428 = WA ferme normalement après la demande de code pair
      // On reconnecte le socket SANS redemander de code
      if (statusCode === 428) {
        this.logger.info('ℹ️  428 normal — reconnexion sans nouveau code...');
        if (!this.isReconnecting) {
          this.isReconnecting = true;
          setTimeout(() => {
            this.isReconnecting = false;
            // On ferme proprement l'ancien socket puis on reboot
            if (this.socket) { try { this.socket.end(); } catch (_) {} this.socket = null; }
            this.initialize();
          }, 3000);
        }
        return;
      }

      if (statusCode === DisconnectReason.loggedOut) {
        this.logger.error('❌ Session expirée. Redémarrez le service sur Render.');
        return;
      }

      // Toute autre déconnexion → reconnexion normale
      if (!this.isReconnecting) {
        this.isReconnecting = true;
        this.logger.info('🔄 Reconnexion dans 5 secondes...');
        setTimeout(() => {
          this.isReconnecting = false;
          if (this.socket) { try { this.socket.end(); } catch (_) {} this.socket = null; }
          this.initialize();
        }, 5000);
      }
    }
  }

  async shutdown() {
    this.logger.info('🛑 Arrêt...');
    if (this._pairingTimer) clearTimeout(this._pairingTimer);
    if (this.socket) { try { this.socket.end(); } catch (_) {} }
    process.exit(0);
  }
}

module.exports = Bot;
