module.exports = {
  name: 'close',
  description: 'Ferme le groupe — seuls les admins peuvent écrire',
  usage: '!close',
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
        await message.reply('❌ Je dois être administrateur du groupe pour fermer les messages.');
        return;
      }

      // Fermer le groupe : seuls les admins peuvent envoyer des messages
      await socket.groupSettingUpdate(jid, 'announcement');
      await message.reply('🔒 *Groupe fermé.* Seuls les administrateurs peuvent désormais écrire.');

    } catch (err) {
      await message.reply('❌ Une erreur est survenue lors de la fermeture du groupe.');
    }
  }
};
