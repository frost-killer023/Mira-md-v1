const config = require('../config/config');

module.exports = {
  name: 'weather',
  description: 'Get weather information',
  usage: '!weather <city>',
  category: 'info',
  prefix: true,

  async execute(message, args, client) {
    try {
      if (args.length === 0) {
        await message.reply('❌ Please provide a city name!\n\n*Usage:* !weather <city>');
        return;
      }

      const city = args.join(' ');
      await message.react('⏳');

      // Simulated weather response
      const weatherText = `
🌍 *WEATHER INFORMATION*

🏙️ *City:* ${city}
🌡️ *Temperature:* 25°C
☁️ *Condition:* Partly Cloudy
💨 *Wind Speed:* 12 km/h
💧 *Humidity:* 65%
🎯 *Feels Like:* 24°C

*Note:* Configure WEATHER_API_KEY in .env for real data!
      `;

      await message.reply(weatherText);
      await message.react('✅');
    } catch (error) {
      console.error(error);
      await message.reply('❌ Error fetching weather!');
    }
  }
};