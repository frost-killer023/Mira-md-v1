const dotenv = require('dotenv');
dotenv.config();

// Normalise le numéro de téléphone : retire tout sauf les chiffres
const ownerNumber = (process.env.BOT_OWNER || '25766486303').replace(/[^0-9]/g, '');

module.exports = {
  // WhatsApp Config
  whatsapp: {
    phone: ownerNumber,
    session: process.env.WHATSAPP_SESSION || 'mira_session'
  },

  // Bot Config
  bot: {
    name: process.env.BOT_NAME || 'Mira',
    prefix: '!',
    // Format Baileys : numéro@s.whatsapp.net  (et non @c.us comme dans whatsapp-web.js)
    owner: `${ownerNumber}@s.whatsapp.net`,
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
    groq: process.env.GROQ_API_KEY,
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
    ai: process.env.ENABLE_AI !== 'false',
    weather: process.env.ENABLE_WEATHER !== 'false',
    music: process.env.ENABLE_MUSIC !== 'false',
    admin: process.env.ENABLE_ADMIN !== 'false',
    autoReply: process.env.ENABLE_AUTO_REPLY === 'true'
  },

  // Timeouts (ms)
  timeouts: {
    messageTimeout: 30000,
    apiTimeout: 15000,
    reconnectTimeout: 5000
  },

  // Cooldown entre commandes (ms)
  cooldown: {
    default: 3000,
    premium: 1000,
    ai: 5000
  }
};
