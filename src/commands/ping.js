module.exports = {
  name: 'ping',
  description: 'Check bot latency',
  usage: '!ping',
  category: 'utility',
  prefix: true,

  async execute(message, args, client) {
    const now = Date.now();
    const msg = await message.reply('🏓 Pong!');
    const latency = Date.now() - now;

    await msg.edit(`
🏓 *PONG!*

⚡ *Latency:* ${latency}ms
📊 *Status:* ✅ Online
🤖 *Bot:* Ready
    `);
  }
};