const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logsDir = path.join(__dirname, '../../logs');
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  getTimestamp() {
    return new Date().toLocaleString();
  }

  log(level, message, error = null) {
    const timestamp = this.getTimestamp();
    const logMessage = error 
      ? `[${timestamp}] [${level}] ${message} - ${error.message}` 
      : `[${timestamp}] [${level}] ${message}`;

    console.log(logMessage);

    // Write to file
    const logFile = path.join(this.logsDir, `${new Date().toISOString().split('T')[0]}.log`);
    fs.appendFileSync(logFile, logMessage + '\n');
  }

  info(message) {
    this.log('INFO', message);
  }

  success(message) {
    this.log('SUCCESS', message);
  }

  warn(message) {
    this.log('WARN', message);
  }

  error(message, error = null) {
    this.log('ERROR', message, error);
  }

  debug(message) {
    if (process.env.DEBUG_MODE === 'true') {
      this.log('DEBUG', message);
    }
  }
}

module.exports = Logger;