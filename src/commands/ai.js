const config = require('../config/config');

module.exports = {
  name: 'ai',
  description: 'Ask AI a question (ChatGPT)',
  usage: '!ai <your question>',
  category: 'ai',
  prefix: true,

  async execute(message, args, client) {
    try {
      if (args.length === 0) {
        await message.reply('❌ Please provide a question!\n\n*Usage:* !ai <your question>');
        return;
      }

      const prompt = args.join(' ');
      await message.react('⏳');

      // Simulated AI response (replace with actual API call)
      const response = `
🤖 *AI RESPONSE*

📝 *Your Question:*
${prompt}

💬 *Answer:*
This is a simulated response. Connect your OpenAI API key in .env to get real AI responses!

*Note:* Configure OPENAI_API_KEY in .env to enable real AI features.
      `;

      await message.reply(response);
      await message.react('✅');
    } catch (error) {
      console.error(error);
      await message.reply('❌ Error processing AI request!');
    }
  }
};