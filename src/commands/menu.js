const config = require('../config/config');

module.exports = {
  name: 'menu',
  description: 'Show main menu',
  usage: '!menu',
  category: 'utility',
  prefix: true,

  async execute(message, args, client) {
    const prefix = config.bot.prefix;

    const menuText = `
╔════════════════════════════════════╗
║        🤖 MIRA BOT MENU             ║
╚════════════════════════════════════╝

*1️⃣  UTILITY*
${prefix}help - Help menu
${prefix}ping - Bot status
${prefix}info - Bot info

*2️⃣  AI & INTELLIGENCE*
${prefix}ai - Ask AI
${prefix}imagine - Generate images

*3️⃣  INFORMATION*
${prefix}weather - Weather info
${prefix}translate - Translate
${prefix}wiki - Wikipedia

*4️⃣  ENTERTAINMENT*
${prefix}play - Play music
${prefix}lyrics - Get lyrics
${prefix}meme - Random meme

*5️⃣  ADMIN*
${prefix}admin - Admin panel

🔗 *Reply with number to navigate*

💬 Questions? Type ${prefix}help
    `;

    await message.reply(menuText);
  }
};