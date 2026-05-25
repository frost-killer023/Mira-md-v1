module.exports = {
  name: 'open',
  description: 'Ouvre le groupe pour tous',
  usage: '!open',
  category: 'admin',
  async execute(message, args, client) {
    const chat = await message.getChat();
    if (!chat.isGroup) return message.reply('❌ Cette commande est réservée aux groupes.');

    const me = await chat.getMe();
    if (!me.isAdmin) return message.reply('❌ Je ne suis pas administrateur du groupe.');

    await chat.setMessagesAdminsOnly(false);
    await message.reply('🔓 Groupe ouvert à tous.');
  }
};
