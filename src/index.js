'use strict';
require('dotenv').config();

const Bot    = require('./core/Bot');
const Logger = require('./utils/Logger');

const logger = new Logger();

// ─────────────────────────────────────────────────────────────────────────────
// Gestionnaires globaux d'erreurs — JAMAIS de process.exit ici.
// Le bot gère ses propres erreurs et se reconnecte seul.
// ─────────────────────────────────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  logger.error('uncaughtException : ' + err.message);
  // On ne quitte PAS — le bot continue de tourner
});

process.on('unhandledRejection', (reason) => {
  logger.error('unhandledRejection : ' + String(reason));
  // On ne quitte PAS
});

async function main() {
  const bot = new Bot();

  process.on('SIGINT',  () => bot.shutdown());
  process.on('SIGTERM', () => bot.shutdown());

  // initialize() ne throw jamais — toutes les erreurs sont attrapées en interne
  await bot.initialize();
}

main();
