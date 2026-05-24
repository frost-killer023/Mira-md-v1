const Logger = require('../utils/Logger');

class EventHandler {
  constructor(client) {
    this.client = client;
    this.logger = new Logger();
  }

  registerEvent(eventName, callback) {
    this.client.on(eventName, callback);
    this.logger.info(`✅ Registered event: ${eventName}`);
  }

  on(eventName, callback) {
    return this.registerEvent(eventName, callback);
  }

  once(eventName, callback) {
    this.client.once(eventName, callback);
  }
}

module.exports = EventHandler;