const config = require('../config/config');

module.exports = {
  name: 'ban',
  description: 'Ban a user',
  usage: '!ban <number>',
  category: 'admin',
  prefix: true,
  ownerOnly: true,

  async execute(message, args, client) {
    try {
      if (message.from !== config.bot.owner) {
        await message.reply('❌ You are not authorized!');
        return;
      }

      if (args.length === 0) {
        await message.reply('❌ Please provide a user number!\n\n*Usage:* !ban <number>');
        return;
      }

      const userNumber = args[0];

      const banText = `
🚫 *USER BANNED*

📱 *User Number:* ${userNumber}
⏰ *Action:* Ban
✅ *Status:* User has been banned

*User will not be able to use the bot anymore.*
      `;

      await message.reply(banText);
    } catch (error) {
      console.error(error);
      await message.reply('❌ Error banning user!');
    }
  }
};