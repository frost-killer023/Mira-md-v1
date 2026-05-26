require('dotenv').config();
const Bot    = require('./core/Bot');
const Logger = require('./utils/Logger');

const logger = new Logger();

async function main() {
  const bot = new Bot();

  // Ne JAMAIS exit sur une erreur non gérée — on log et on continue
  process.on('uncaughtException', (err) => {
    logger.error('uncaughtException : ' + err.message);
    // Le bot se reconnecte tout seul via ses propres mécanismes
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('unhandledRejection : ' + String(reason));
    // Idem — pas de process.exit ici
  });

  process.on('SIGINT',  async () => { await bot.shutdown(); });
  process.on('SIGTERM', async () => { await bot.shutdown(); });

  // initialize() ne throw jamais — il gère ses propres erreurs en interne
  await bot.initialize();
}

main();
