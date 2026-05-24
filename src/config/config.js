const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  // WhatsApp Config
  whatsapp: {
    token: process.env.WHATSAPP_TOKEN,
    phone: process.env.WHATSAPP_PHONE,
    session: process.env.WHATSAPP_SESSION || 'mira_session'
  },

  // Bot Config
  bot: {
    name: process.env.BOT_NAME || 'Mira',
    prefix: process.env.BOT_PREFIX || '!',
    owner: process.env.BOT_OWNER,
    debug: process.env.DEBUG_MODE === 'true'
  },

  // Database Config
  database: {
    url: process.env.DB_URL || 'mongodb://localhost:27017',
    name: process.env.DB_NAME || 'mira_db',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  },

  // API Keys
  api: {
    openai: process.env.OPENAI_API_KEY,
    weather: process.env.WEATHER_API_KEY,
    translate: process.env.TRANSLATE_API_KEY,
    spotify: process.env.SPOTIFY_API_KEY
  },

  // Server Config
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development'
  },

  // Features
  features: {
    ai: process.env.ENABLE_AI === 'true',
    weather: process.env.ENABLE_WEATHER === 'true',
    music: process.env.ENABLE_MUSIC === 'true',
    admin: process.env.ENABLE_ADMIN === 'true',
    autoReply: process.env.ENABLE_AUTO_REPLY === 'true'
  },

  // Timeouts
  timeouts: {
    messageTimeout: 30000,
    apiTimeout: 15000,
    reconnectTimeout: 5000
  },

  // Commands Cooldown (ms)
  cooldown: {
    default: 3000,
    premium: 1000,
    ai: 5000
  }
};