const Bot = require('./core/Bot');
const config = require('./config/config');
const Logger = require('./utils/Logger');

const logger = new Logger();

async function main() {
  try {
    const bot = new Bot();
    await bot.initialize();

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      await bot.shutdown();
    });

    process.on('SIGTERM', async () => {
      await bot.shutdown();
    });
  } catch (error) {
    logger.error('Failed to start bot:', error);
    process.exit(1);
  }
}

main();