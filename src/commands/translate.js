const config = require('../config/config');

module.exports = {
  name: 'translate',
  description: 'Translate text to different languages',
  usage: '!translate <language> <text>',
  category: 'info',
  prefix: true,

  async execute(message, args, client) {
    try {
      if (args.length < 2) {
        await message.reply(`
❌ Please provide language and text!

*Usage:* !translate <language> <text>

*Examples:*
!translate en Hello world
!translate fr Bonjour
!translate es Hola
!translate ar السلام عليكم
        `);
        return;
      }

      const language = args[0];
      const text = args.slice(1).join(' ');
      await message.react('⏳');

      const translationText = `
🌐 *TRANSLATION*

📝 *Original Text:* ${text}
🎯 *Target Language:* ${language.toUpperCase()}
💬 *Translated:* [Translation result]

*Note:* Configure TRANSLATE_API_KEY in .env for real translations!
      `;

      await message.reply(translationText);
      await message.react('✅');
    } catch (error) {
      console.error(error);
      await message.reply('❌ Error translating text!');
    }
  }
};