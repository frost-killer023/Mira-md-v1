const fs = require('fs');
const path = require('path');
const config = require('../config/config');
const Logger = require('../utils/Logger');

class CommandHandler {
  constructor(client) {
    this.client = client;
    this.commands = new Map();
    this.cooldowns = new Map();
    this.logger = new Logger();
    this.loadCommands();
  }

  loadCommands() {
    const commandsPath = path.join(__dirname, '../commands');
    
    if (!fs.existsSync(commandsPath)) {
      fs.mkdirSync(commandsPath, { recursive: true });
      return;
    }

    const files = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of files) {
      try {
        const filePath = path.join(commandsPath, file);
        delete require.cache[require.resolve(filePath)];
        const command = require(filePath);
        
        if (command.name) {
          this.commands.set(command.name.toLowerCase(), command);
          this.logger.info(`✅ Loaded command: ${command.name}`);
        }
      } catch (error) {
        this.logger.error(`Failed to load command ${file}:`, error);
      }
    }
  }

  async handleMessage(message) {
    try {
      // Ignore messages from bot
      if (message.fromMe) return;

      const content = message.body.trim();
      const prefix = config.bot.prefix;

      // Check if message starts with prefix
      if (!content.startsWith(prefix)) return;

      // Parse command
      const args = content.slice(prefix.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();

      const command = this.commands.get(commandName);
      if (!command) return;

      // Check cooldown
      if (this.isOnCooldown(message.from, commandName)) {
        await message.reply('⏳ Command on cooldown. Please wait...');
        return;
      }

      // Set cooldown
      this.setCooldown(message.from, commandName);

      // Execute command
      await command.execute(message, args, this.client);
    } catch (error) {
      this.logger.error('Error handling message:', error);
    }
  }

  isOnCooldown(userId, commandName) {
    const key = `${userId}-${commandName}`;
    return this.cooldowns.has(key);
  }

  setCooldown(userId, commandName) {
    const key = `${userId}-${commandName}`;
    const cooldownTime = config.cooldown.default;
    
    this.cooldowns.set(key, true);
    setTimeout(() => this.cooldowns.delete(key), cooldownTime);
  }

  getCommand(name) {
    return this.commands.get(name.toLowerCase());
  }

  getAllCommands() {
    return Array.from(this.commands.values());
  }
}

module.exports = CommandHandler;