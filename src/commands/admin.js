const config = require('../config/config');

module.exports = {
  name: 'admin',
  description: 'Admin panel (owner only)',
  usage: '!admin',
  category: 'admin',
  prefix: true,
  ownerOnly: true,

  async execute(message, args, client) {
    try {
      // Check if user is bot owner
      if (message.from !== config.bot.owner) {
        await message.reply('❌ This command is only for bot owner!');
        return;
      }

      const adminText = `
╔════════════════════════════════════╗
║        👨‍💼 ADMIN PANEL              ║
╚════════════════════════════════════╝

🔧 *ADMIN COMMANDS:*

1️⃣  !ban <number> - Ban user
2️⃣  !unban <number> - Unban user
3️⃣  !kick <@user> - Kick from group
4️⃣  !announce <message> - Broadcast message
5️⃣  !restart - Restart bot
6️⃣  !status - System status
7️⃣  !logs - View logs
8️⃣  !backup - Backup database

📊 *SYSTEM INFO:*
✅ Status: Online
📈 Uptime: 24h
💾 Memory: 150MB
👥 Users: 500+
      `;

      await message.reply(adminText);
    } catch (error) {
      console.error(error);
      await message.reply('❌ Error accessing admin panel!');
    }
  }
};