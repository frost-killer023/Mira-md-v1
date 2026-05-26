'use strict';
const fs   = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logsDir = path.join(process.cwd(), 'logs');
    // Création du dossier logs sans throw si le disque est en lecture seule
    try {
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
      }
    } catch (_) {
      // Sur Render free tier, le disque peut être restreint — on continue quand même
      this.logsDir = null;
    }
  }

  _getTimestamp() {
    return new Date().toLocaleString('fr-FR', { timeZone: 'UTC' });
  }

  _write(level, message, error = null) {
    const ts  = this._getTimestamp();
    const txt = error
      ? `[${ts}] [${level}] ${message} — ${error.message}`
      : `[${ts}] [${level}] ${message}`;

    // Toujours afficher dans la console (visible dans les logs Render)
    console.log(txt);

    // Écriture sur disque en best-effort — une erreur ici ne doit PAS
    // faire planter le bot
    if (this.logsDir) {
      try {
        const day  = new Date().toISOString().split('T')[0];
        const file = path.join(this.logsDir, day + '.log');
        fs.appendFileSync(file, txt + '\n');
      } catch (_) {
        // Silencieux — le console.log ci-dessus suffit
      }
    }
  }

  info(message)            { this._write('INFO',    message); }
  success(message)         { this._write('SUCCESS', message); }
  warn(message)            { this._write('WARN',    message); }
  error(message, err=null) { this._write('ERROR',   message, err); }
  debug(message) {
    if (process.env.DEBUG_MODE === 'true') this._write('DEBUG', message);
  }
}

module.exports = Logger;
