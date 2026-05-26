const fs = require('fs');
const path = require('path');
const config = require('../config/config');
const Logger = require('../utils/Logger');

/**
 * Extrait le texte brut d'un message Baileys,
 * quelle que soit la forme du message (texte, citation, légende d'image…)
 */
function getMessageText(msg) {
  return (
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    msg.message?.buttonsResponseMessage?.selectedButtonId ||
    msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
    ''
  ).trim();
}

class CommandHandler {
  constructor(socket) {
    this.socket = socket;
    this.commands = new Map();
    this.cooldowns = new Map();
    this.logger = new Logger();
    this.loadCommands();
  }

  // ─────────────────────────────────────────────────────────────
  // Chargement automatique de tous les fichiers dans src/commands/
  // ─────────────────────────────────────────────────────────────
  loadCommands() {
    const commandsPath = path.join(__dirname, '../commands');

    if (!fs.existsSync(commandsPath)) {
      fs.mkdirSync(commandsPath, { recursive: true });
      return;
    }

    const files = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

    for (const file of files) {
      try {
        const filePath = path.join(commandsPath, file);
        delete require.cache[require.resolve(filePath)];
        const command = require(filePath);

        if (command.name) {
          this.commands.set(command.name.toLowerCase(), command);
          this.logger.info(`✅ Commande chargée : ${command.name}`);
        }
      } catch (error) {
        this.logger.error(`Erreur chargement commande "${file}" : ${error.message}`);
      }
    }

    this.logger.info(`📦 ${this.commands.size} commande(s) chargée(s) au total.`);
  }

  // ─────────────────────────────────────────────────────────────
  // Traitement de chaque message entrant
  // ─────────────────────────────────────────────────────────────
  async handleMessage(msg) {
    try {
      const content = getMessageText(msg);
      if (!content) return;

      const prefix = config.bot.prefix;
      if (!content.startsWith(prefix)) return;

      const jid = msg.key.remoteJid;
      const senderNumber = jid.replace(/[^0-9]/g, '');
      const ownerNumber = (process.env.BOT_OWNER || '25766486303').replace(/[^0-9]/g, '');

      const args = content.slice(prefix.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();

      const command = this.commands.get(commandName);
      if (!command) return;

      // Cooldown
      if (this.isOnCooldown(jid, commandName)) {
        await this.socket.sendMessage(
          jid,
          { text: '⏳ Patientez quelques secondes avant de réutiliser cette commande.' },
          { quoted: msg }
        );
        return;
      }
      this.setCooldown(jid, commandName);

      // ─────────────────────────────────────────────────────────
      // Objet "message" passé aux commandes.
      // Il reproduit l'interface de whatsapp-web.js pour que
      // les commandes existantes fonctionnent sans modification.
      // ─────────────────────────────────────────────────────────
      const ctx = {
        from: jid,
        body: content,
        key: msg.key,
        isOwner: senderNumber === ownerNumber,

        /** Envoyer un message texte en réponse */
        reply: async (text) => {
          await this.socket.sendMessage(
            jid,
            { text: String(text) },
            { quoted: msg }
          );
        },

        /** Réagir avec un emoji */
        react: async (emoji) => {
          await this.socket.sendMessage(jid, {
            react: { text: emoji, key: msg.key }
          });
        },

        /** Envoyer une image avec légende optionnelle */
        replyImage: async (buffer, caption = '') => {
          await this.socket.sendMessage(
            jid,
            { image: buffer, caption },
            { quoted: msg }
          );
        }
      };

      await command.execute(ctx, args, this.socket);

    } catch (error) {
      this.logger.error(`Erreur handleMessage : ${error.message}`);
    }
  }

  isOnCooldown(jid, commandName) {
    return this.cooldowns.has(`${jid}-${commandName}`);
  }

  setCooldown(jid, commandName) {
    const key = `${jid}-${commandName}`;
    this.cooldowns.set(key, true);
    setTimeout(() => this.cooldowns.delete(key), config.cooldown?.default || 3000);
  }
}

module.exports = CommandHandler;
