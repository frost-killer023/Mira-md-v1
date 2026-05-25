module.exports = {
  name: 'close',
  description: 'Ferme le groupe pour les membres',
  usage: '!close',
  category: 'admin',
  async execute(message, args, client) {
    const chat = await message.getChat();
    if (!chat.isGroup) return message.reply('❌ Cette commande est réservée aux groupes.');
    
    // Vérification si le bot est admin
    const me = await chat.getMe();
    if (!me.isAdmin) return message.reply('❌ Je ne suis pas administrateur du groupe.');

    await chat.setMessagesAdminsOnly(true);
    await message.reply('🔒 Groupe fermé. Seuls les admins peuvent écrire.');
  }
};
