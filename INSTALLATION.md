# 📦 Installation Guide - Mira MD Bot

## Prerequisites

✅ Node.js >= 14.x  
✅ npm or yarn  
✅ Git  
✅ WhatsApp Account  

## Local Installation

### Step 1: Clone Repository

```bash
git clone https://github.com/darkshadow-1er/Mira-md-v1.git
cd Mira-md-v1
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Environment

```bash
cp .env.example .env
nano .env  # Edit with your settings
```

### Step 4: Run Bot

```bash
npm start
```

Scan the QR code with your WhatsApp to authenticate.

## Deploy on Cloud Platforms

### Heroku

```bash
heroku login
git push heroku main
```

### Railway

1. Connect GitHub repository
2. Create new project
3. Deploy automatically

### Render

1. Push to GitHub
2. Create new Web Service on Render
3. Set environment variables
4. Deploy

## Troubleshooting

### QR Code Not Showing
- Clear session: `rm -rf .wwebjs_auth/`
- Restart bot: `npm start`

### Port Already in Use
- Change PORT in .env
- Or kill process: `lsof -ti:3000 | xargs kill -9`

### Dependencies Error
- Clear cache: `npm cache clean --force`
- Reinstall: `rm -rf node_modules && npm install`

## Need Help?

📱 WhatsApp: https://wa.me/25766486303  
💬 Group: https://chat.whatsapp.com/CAyNc1CYQYHEsDB3cUMMs8  
🐙 Issues: https://github.com/darkshadow-1er/Mira-md-v1/issues  
