const config = require('../config/config');

module.exports = {
  name: 'help',
  description: 'Show help menu',
  usage: `${config.bot.prefix}help [command]`,
  category: 'utility',
  prefix: true,

  async execute(message, args, client) {
    const prefix = config.bot.prefix;

    if (args.length > 0) {
      // Show specific command help
      const commandName = args[0].toLowerCase();
      const helpText = `
*❓ Command Help*

📌 *Command:* ${commandName}
📝 *Description:* Show detailed command info
💡 *Usage:* ${prefix}${commandName} [options]
      `;
      await message.reply(helpText);
    } else {
      // Show general help
      const helpText = `
╔════════════════════════════════════╗
║      🤖 *MIRA BOT - HELP MENU*      ║
╚════════════════════════════════════╝

*📚 UTILITY COMMANDS:*
${prefix}help - Show this menu
${prefix}ping - Check bot status
${prefix}info - Bot information
${prefix}menu - Main menu

*🤖 AI COMMANDS:*
${prefix}ai <prompt> - Ask AI (ChatGPT)
${prefix}imagine <prompt> - Generate image

*🌍 INFO COMMANDS:*
${prefix}weather <city> - Get weather
${prefix}translate <text> - Translate text
${prefix}wiki <query> - Wikipedia search

*🎵 MEDIA COMMANDS:*
${prefix}play <song> - Play music
${prefix}lyrics <song> - Get lyrics

*👨‍💼 ADMIN COMMANDS:*
${prefix}admin - Admin panel
${prefix}ban <number> - Ban user
${prefix}unban <number> - Unban user

*📞 Support:*
WhatsApp: https://wa.me/25766486303

_Type ${prefix}help <command> for detailed info_
      `;
      await message.reply(helpText);
    }
  }
};