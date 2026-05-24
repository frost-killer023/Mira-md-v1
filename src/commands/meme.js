module.exports = {
  name: 'meme',
  description: 'Get a random meme',
  usage: '!meme',
  category: 'entertainment',
  prefix: true,

  async execute(message, args, client) {
    try {
      await message.react('⏳');

      const memeText = `
😂 *RANDOM MEME*

[Meme Image]

*Connect to a meme API in .env to get real memes!*

Popular APIs:
📌 imgflip
📌 jikan
📌 reddit meme subreddits
      `;

      await message.reply(memeText);
      await message.react('😂');
    } catch (error) {
      console.error(error);
      await message.reply('❌ Error fetching meme!');
    }
  }
};