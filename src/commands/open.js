module.exports = {
  name: 'open',
  description: 'Ouvre le groupe — tout le monde peut écrire',
  usage: '!open',
  category: 'admin',

  async execute(message, args, socket) {
    const jid = message.from;

    // Vérifier que la commande est utilisée dans un groupe
    if (!jid.endsWith('@g.us')) {
      await message.reply('❌ Cette commande fonctionne uniquement dans un groupe.');
      return;
    }

    try {
      // Récupérer les informations du groupe
      const metadata = await socket.groupMetadata(jid);

      // Identifier l'identifiant du bot
      const botId = socket.user?.id?.split(':')[0] + '@s.whatsapp.net';
      const botInGroup = metadata.participants.find(p => p.id === botId);

      // Vérifier que le bot est administrateur
      if (!botInGroup || !['admin', 'superadmin'].includes(botInGroup.admin)) {
        await message.reply('❌ Je dois être administrateur du groupe pour ouvrir les messages.');
        return;
      }

      // Ouvrir le groupe : tout le monde peut envoyer des messages
      await socket.groupSettingUpdate(jid, 'not_announcement');
      await message.reply('🔓 *Groupe ouvert.* Tous les membres peuvent désormais écrire.');

    } catch (err) {
      await message.reply('❌ Une erreur est survenue lors de l\'ouverture du groupe.');
    }
  }
};
