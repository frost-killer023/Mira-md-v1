const config = require('../config/config');

module.exports = {
  name: 'info',
  description: 'Show bot information',
  usage: '!info',
  category: 'utility',
  prefix: true,

  async execute(message, args, client) {
    const infoText = `
╔════════════════════════════════════╗
║    ℹ️  BOT INFORMATION              ║
╚════════════════════════════════════╝

🤖 *Bot Name:* ${config.bot.name}
📌 *Version:* 1.0.0
👨‍💻 *Developer:* Dark Shadow
📅 *Created:* 2024

✨ *Features:*
✅ AI Integration (ChatGPT)
✅ Image Generation
✅ Weather Information
✅ Translation
✅ Music Player
✅ Admin Panel
✅ User Management
✅ Auto-Reply System

⚡ *Performance:*
🚀 Latency: <500ms
💾 Memory: ~150MB
📈 Uptime: 99.9%
👥 Max Users: 10k+

🔧 *Technology:*
📦 Node.js
🐾 WhatsApp Web.js
🗄️ MongoDB
🔌 OpenAI API

📞 *Contact:*
📱 WhatsApp: https://wa.me/25766486303
💬 Group: https://chat.whatsapp.com/CAyNc1CYQYHEsDB3cUMMs8

⭐ *If you like this bot, leave a star!*
    `;

    await message.reply(infoText);
  }
};