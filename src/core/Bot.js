const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const pino    = require('pino');
const http    = require('http');
const path    = require('path');
const Logger  = require('../utils/Logger');
const CommandHandler = require('./CommandHandler');

// Version WA connue et stable — utilisée si fetchLatestBaileysVersion échoue
const FALLBACK_VERSION = [2, 3000, 1015901307];

class Bot {
  constructor() {
    this.socket          = null;
    this.logger          = new Logger();
    this.commandHandler  = null;
    this.isReconnecting  = false;
    this._httpStarted    = false;
    // ─── FLAG CRITIQUE ───────────────────────────────────────────
    // true dès que requestPairingCode a été appelé avec succès.
    // Empêche de demander un nouveau code à chaque reconnexion,
    // ce qui annulait le code précédent et rendait le pairing
    // impossible (c'était le vrai bug).
    this._pairingRequested = false;
    // Timer pour régénérer un code si l'utilisateur n'a pas couplé
    // dans les 3 minutes (ex: code expiré sans connexion)
    this._pairingTimer = null;
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

    // ── 3. VERSION WA ────────────────────────────────────────────
    let version = FALLBACK_VERSION;
    try {
      const result = await fetchLatestBaileysVersion();
      version = result.version;
      this.logger.info('Version WA récupérée : ' + version.join('.'));
    } catch (e) {
      this.logger.warn('fetchLatestBaileysVersion échoué, utilisation fallback : ' + FALLBACK_VERSION.join('.'));
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
    // On ne demande le code QUE si :
    //   a) La session n'est pas encore enregistrée (pas encore couplé)
    //   b) On n'a pas déjà envoyé une demande de pairing dans ce cycle
    //      (évite de régénérer un code et d'annuler le précédent
    //       après chaque reconnexion provoquée par le code 428)
    if (!state.creds.registered && !this._pairingRequested) {
      this._pairingRequested = true;
      const phoneNumber = (process.env.BOT_OWNER || '25766486303').replace(/[^0-9]/g, '');
      this.logger.info('📱 Numéro : +' + phoneNumber);

      try {
        const code = await this.socket.requestPairingCode(phoneNumber);
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

        // Après 3 minutes sans connexion → reset du flag pour nouveau code
        if (this._pairingTimer) clearTimeout(this._pairingTimer);
        this._pairingTimer = setTimeout(() => {
          if (this.socket && !this.socket.authState?.creds?.registered) {
            this.logger.warn('⏰ Code expiré. Génération d\'un nouveau code...');
            this._pairingRequested = false;
            this._restartSocket();
          }
        }, 3 * 60 * 1000);

      } catch (err) {
        this.logger.error('❌ Erreur requestPairingCode : ' + err.message);
        this._pairingRequested = false; // reset pour réessayer
        this.logger.info('🔄 Nouvelle tentative dans 6 secondes...');
        setTimeout(() => this.initialize(), 6000);
        return;
      }
    }

    // ── 6. CONNEXION ─────────────────────────────────────────────
    this.socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'open') {
        this.logger.info('✅ Bot connecté à WhatsApp !');
        this.isReconnecting   = false;
        this._pairingRequested = false; // reset propre pour une future reconnexion
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
            this.logger.error('Erreur envoi owner : ' + e.message);
          }
        }, 4000);
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const loggedOut  = statusCode === DisconnectReason.loggedOut;

        this.logger.warn('⚠️  Connexion fermée — code : ' + statusCode);

        // 428 = normal après une demande de code pair (WA ferme
        // volontairement la connexion, ce n'est PAS une erreur).
        // On reconnecte sans redemander de code (_pairingRequested reste true).
        if (statusCode === 428) {
          this.logger.info('ℹ️  Code 428 normal après pairing. Reconnexion...');
          if (!this.isReconnecting) {
            this.isReconnecting = true;
            setTimeout(() => { this.isReconnecting = false; this._restartSocket(); }, 3000);
          }
          return;
        }

        if (loggedOut) {
          this.logger.error('❌ Session expirée. Redémarrez le service sur Render.');
          return;
        }

        if (!this.isReconnecting) {
          this.isReconnecting = true;
          this.logger.info('🔄 Reconnexion dans 5 secondes...');
          setTimeout(() => { this.isReconnecting = false; this.initialize(); }, 5000);
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

  // Redémarre uniquement le socket sans toucher au serveur HTTP
  async _restartSocket() {
    if (this.socket) {
      try { this.socket.end(); } catch (_) {}
      this.socket = null;
    }
    await this.initialize();
  }

  async shutdown() {
    this.logger.info('🛑 Arrêt du bot...');
    if (this._pairingTimer) clearTimeout(this._pairingTimer);
    if (this.socket) this.socket.end();
    process.exit(0);
  }
}

module.exports = Bot;
