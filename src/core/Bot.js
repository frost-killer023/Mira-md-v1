'use strict';

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

// Version WA de secours — utilisée si fetchLatestBaileysVersion() échoue
const FALLBACK_WA_VERSION = [2, 3000, 1015901307];

class Bot {
  constructor() {
    this.socket             = null;
    this.saveCreds          = null;   // référence stable à saveCreds entre reconnexions
    this.logger             = new Logger();
    this.commandHandler     = null;
    this._httpStarted       = false;

    // ── FLAGS DE CONTRÔLE ────────────────────────────────────────
    // _pairingCodeSent : true dès que requestPairingCode() a réussi.
    //   Empêche de générer un nouveau code après chaque reconnexion
    //   (le 428 post-pairing reconnecte sans demander de nouveau code).
    this._pairingCodeSent   = false;

    // _reconnecting : verrou anti-boucle — une seule reconnexion à la fois
    this._reconnecting      = false;

    // _reconnectCount : compteur pour espacer les tentatives
    this._reconnectCount    = 0;
  }

  // ═══════════════════════════════════════════════════════════════
  // POINT D'ENTRÉE PUBLIC — ne throw jamais
  // ═══════════════════════════════════════════════════════════════
  async initialize() {
    try {
      await this._startHTTP();
      await this._connect();
    } catch (err) {
      this.logger.error('initialize() erreur : ' + err.message);
      this._scheduleReconnect();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SERVEUR HTTP — un seul démarrage, gardé en vie par UptimeRobot
  // ═══════════════════════════════════════════════════════════════
  async _startHTTP() {
    if (this._httpStarted) return;
    const PORT = process.env.PORT || 3000;
    await new Promise((resolve) => {
      http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Mira Bot is Online');
      }).listen(PORT, '0.0.0.0', () => {
        this.logger.info('🌐 HTTP actif sur le port ' + PORT);
        resolve();
      });
    });
    this._httpStarted = true;
  }

  // ═══════════════════════════════════════════════════════════════
  // CONNEXION PRINCIPALE
  // ═══════════════════════════════════════════════════════════════
  async _connect() {

    // ── 1. SESSION ───────────────────────────────────────────────
    const sessionsPath = path.join(process.cwd(), 'sessions');
    const { state, saveCreds } = await useMultiFileAuthState(sessionsPath);

    // On garde saveCreds sur l'instance pour pouvoir l'appeler
    // dans creds.update même après une reconnexion
    this.saveCreds = saveCreds;

    // ── 2. VERSION WA ────────────────────────────────────────────
    let version = FALLBACK_WA_VERSION;
    try {
      const result = await fetchLatestBaileysVersion();
      version = result.version;
      this.logger.info('Version WA : ' + version.join('.'));
    } catch (_) {
      this.logger.warn('fetchLatestBaileysVersion échoué — fallback : ' + version.join('.'));
    }

    // ── 3. SOCKET ────────────────────────────────────────────────
    // Pas de "browser" personnalisé → Baileys choisit le bon fingerprint
    // pour les pairing codes. Pas de makeCacheableSignalKeyStore qui
    // corrompait la session dans les tests précédents.
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

    // ── 4. CODE PAIR ─────────────────────────────────────────────
    // Règle absolue :
    //   requestPairingCode() est appelé UNE SEULE FOIS par session.
    //   Après le 428, on reconnecte le socket SANS redemander de code.
    //   Le flag _pairingCodeSent garantit cela.
    if (!state.creds.registered && !this._pairingCodeSent) {
      const phone = (process.env.BOT_OWNER || '25766486303').replace(/[^0-9]/g, '');
      this.logger.info('📱 Demande de code pair pour +' + phone);

      try {
        const code = await this.socket.requestPairingCode(phone);
        const fmt  = (String(code)).replace(/(.{4})(?=.)/g, '$1-');

        this._pairingCodeSent = true; // ← verrou posé ICI, après succès

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

        // Sécurité : si l'utilisateur n'entre pas le code dans 3 minutes,
        // on reset le flag pour permettre un nouveau code au prochain
        // redémarrage manuel du service.
        setTimeout(() => {
          if (!this.socket?.authState?.creds?.registered) {
            this.logger.warn('⏰ Code expiré (3 min). Redémarrez le service sur Render pour un nouveau code.');
            // On ne reset PAS automatiquement pour éviter la boucle infinie.
            // L'utilisateur doit redémarrer manuellement.
          }
        }, 3 * 60 * 1000);

      } catch (err) {
        this.logger.error('requestPairingCode() échoué : ' + err.message);
        // On ne pose PAS _pairingCodeSent → on pourra réessayer
        throw err; // remonté à initialize() qui planifie une reconnexion
      }
    }

    // ── 5. ÉVÉNEMENTS ────────────────────────────────────────────
    this.socket.ev.on('connection.update', (update) => {
      this._onConnectionUpdate(update).catch((err) => {
        this.logger.error('_onConnectionUpdate : ' + err.message);
      });
    });

    this.socket.ev.on('creds.update', () => {
      if (this.saveCreds) this.saveCreds();
    });

    this.socket.ev.on('messages.upsert', ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        if (msg.key.fromMe || !msg.message) continue;
        this.commandHandler.handleMessage(msg).catch((err) => {
          this.logger.error('handleMessage : ' + err.message);
        });
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // GESTION DES ÉVÉNEMENTS DE CONNEXION
  // ═══════════════════════════════════════════════════════════════
  async _onConnectionUpdate(update) {
    const { connection, lastDisconnect } = update;

    // ── CONNECTÉ ─────────────────────────────────────────────────
    if (connection === 'open') {
      this.logger.info('✅ Bot connecté à WhatsApp !');
      this._reconnecting    = false;
      this._reconnectCount  = 0;
      this._pairingCodeSent = false; // reset propre pour la prochaine session

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
          this.logger.error('Envoi owner : ' + e.message);
        }
      }, 4000);

      return;
    }

    // ── DÉCONNECTÉ ───────────────────────────────────────────────
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      this.logger.warn('⚠️  Déconnexion — code : ' + statusCode);

      // Code 428 — comportement NORMAL de WhatsApp après une demande
      // de pairing code. WA ferme la connexion et attend que l'utilisateur
      // entre le code sur son téléphone.
      // → On reconnecte le socket SANS appeler requestPairingCode à nouveau.
      // → _pairingCodeSent reste true → pas de nouveau code généré.
      if (statusCode === 428) {
        this.logger.info('ℹ️  428 = attente confirmation pairing — reconnexion dans 3s...');
        this._scheduleReconnect(3000);
        return;
      }

      // Session révoquée (l'utilisateur a retiré l'appareil dans WhatsApp)
      if (statusCode === DisconnectReason.loggedOut) {
        this.logger.error('❌ Session révoquée. Supprimez sessions/ et redémarrez Render.');
        this._pairingCodeSent = false;
        return; // pas de reconnexion automatique — action manuelle requise
      }

      // Toute autre déconnexion → reconnexion automatique
      this._scheduleReconnect();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // RECONNEXION AVEC ANTI-BOUCLE
  // ─ Un seul timeout actif à la fois
  // ─ Délai progressif pour éviter le flood
  // ═══════════════════════════════════════════════════════════════
  _scheduleReconnect(forceDelayMs = null) {
    if (this._reconnecting) return; // verrou
    this._reconnecting = true;

    this._reconnectCount++;
    // Délai progressif : 5s, 10s, 15s… max 30s
    const delay = forceDelayMs !== null
      ? forceDelayMs
      : Math.min(5000 * this._reconnectCount, 30000);

    this.logger.info('🔄 Reconnexion dans ' + (delay / 1000) + 's... (tentative ' + this._reconnectCount + ')');

    setTimeout(async () => {
      this._reconnecting = false;
      // Fermer proprement l'ancien socket avant de recréer
      if (this.socket) {
        try { this.socket.end(); } catch (_) {}
        this.socket = null;
      }
      await this.initialize();
    }, delay);
  }

  // ═══════════════════════════════════════════════════════════════
  // ARRÊT PROPRE
  // ═══════════════════════════════════════════════════════════════
  async shutdown() {
    this.logger.info('🛑 Arrêt du bot...');
    if (this.socket) {
      try { this.socket.end(); } catch (_) {}
    }
    process.exit(0);
  }
}

module.exports = Bot;
