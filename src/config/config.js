const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  // WhatsApp Config
  whatsapp: {
    token: process.env.WHATSAPP_TOKEN,
    phone: process.env.WHATSAPP_PHONE || '25766486303',
    session: process.env.WHATSAPP_SESSION || 'mira_session'
  },

  // Bot Config
  bot: {
    name: process.env.BOT_NAME || 'Mira',
    prefix: '!', // Fixé sur '!' directement pour être sûr
    owner: '25766486303@c.us', // Ton identifiant WhatsApp officiel pour les commandes Admin/Owner
    debug: true
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
    ai: true, // Activé par défaut
    weather: true,
    music: true,
    admin: true,
    autoReply: true
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
