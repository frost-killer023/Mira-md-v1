module.exports = {
  name: 'ping',
  description: 'Vérifie la latence du bot',
  usage: '!ping',
  category: 'utility',
  prefix: true,

  async execute(message, args, socket) {
    const start = Date.now();
    await message.reply('🏓 Calcul de la latence...');
    const latency = Date.now() - start;

    await message.reply(
      '🏓 *PONG !*\n\n' +
      `⚡ *Latence :* ${latency}ms\n` +
      '📊 *Statut :* ✅ En ligne\n' +
      '🤖 *Bot :* Prêt'
    );
  }
};
