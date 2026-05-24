const express = require('express');
const cors = require('cors');
const path = require('path');
const PairingManager = require('../pairing/PairingManager');
const Logger = require('../utils/Logger');
const Bot = require('../core/Bot');

class PairingServer {
  constructor(port = 8080) {
    this.port = port;
    this.app = express();
    this.pairingManager = new PairingManager();
    this.logger = new Logger();
    this.activeBots = new Map();
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ limit: '10mb', extended: true }));
    this.app.use(express.static(path.join(__dirname, '../../public')));
  }

  setupRoutes() {
    // Serve frontend
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../../public/index.html'));
    });

    // API Routes
    this.app.post('/api/pairing/generate', this.generatePairingCode.bind(this));
    this.app.post('/api/pairing/verify', this.verifyPairingCode.bind(this));
    this.app.get('/api/pairing/status/:code', this.getPairingStatus.bind(this));
    this.app.get('/api/bots/active', this.getActiveBots.bind(this));
    this.app.get('/api/bots/:phoneNumber', this.getBotStatus.bind(this));
    this.app.post('/api/bots/:phoneNumber/disconnect', this.disconnectBot.bind(this));
    this.app.get('/api/health', this.healthCheck.bind(this));

    // Error handling
    this.app.use((err, req, res, next) => {
      this.logger.error('Server error:', err);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    });
  }

  async generatePairingCode(req, res) {
    try {
      const { phoneNumber } = req.body;

      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          message: 'Phone number is required'
        });
      }

      const result = this.pairingManager.generatePairingCode(phoneNumber);
      
      if (result.success) {
        // Start bot initialization in background
        this.initializeBot(phoneNumber, result.sessionId);
      }

      res.json(result);
    } catch (error) {
      this.logger.error('Error generating pairing code:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate pairing code',
        error: error.message
      });
    }
  }

  async verifyPairingCode(req, res) {
    try {
      const { code } = req.body;

      if (!code) {
        return res.status(400).json({
          success: false,
          message: 'Pairing code is required'
        });
      }

      const result = this.pairingManager.verifyPairingCode(code);
      res.json(result);
    } catch (error) {
      this.logger.error('Error verifying pairing code:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to verify pairing code',
        error: error.message
      });
    }
  }

  async getPairingStatus(req, res) {
    try {
      const { code } = req.params;
      const status = this.pairingManager.getPairingStatus(code);
      res.json(status);
    } catch (error) {
      this.logger.error('Error getting pairing status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get pairing status'
      });
    }
  }

  async getActiveBots(req, res) {
    try {
      const bots = this.pairingManager.getAllActiveBots();
      res.json({
        success: true,
        bots: bots,
        totalBots: bots.length
      });
    } catch (error) {
      this.logger.error('Error getting active bots:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get active bots'
      });
    }
  }

  async getBotStatus(req, res) {
    try {
      const { phoneNumber } = req.params;
      const botData = this.pairingManager.getActiveBot(phoneNumber);

      if (!botData) {
        return res.status(404).json({
          success: false,
          message: 'Bot not found'
        });
      }

      res.json({
        success: true,
        phoneNumber: botData.phoneNumber,
        status: botData.status,
        connectedAt: botData.connectedAt,
        lastActivity: botData.lastActivity,
        stats: botData.stats
      });
    } catch (error) {
      this.logger.error('Error getting bot status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get bot status'
      });
    }
  }

  async disconnectBot(req, res) {
    try {
      const { phoneNumber } = req.params;
      const success = this.pairingManager.disconnectBot(phoneNumber);

      if (success) {
        res.json({
          success: true,
          message: 'Bot disconnected successfully'
        });
      } else {
        res.status(404).json({
          success: false,
          message: 'Bot not found'
        });
      }
    } catch (error) {
      this.logger.error('Error disconnecting bot:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to disconnect bot'
      });
    }
  }

  async healthCheck(req, res) {
    try {
      const bots = this.pairingManager.getAllActiveBots();
      res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date(),
        activeBots: bots.length,
        uptime: process.uptime()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        status: 'unhealthy',
        error: error.message
      });
    }
  }

  async initializeBot(phoneNumber, sessionId) {
    try {
      // Wait a bit for verification
      setTimeout(async () => {
        const pairingData = this.pairingManager.getActiveBot(phoneNumber);
        
        if (!pairingData) {
          this.logger.info(`🤖 Creating bot for ${phoneNumber}...`);
          
          try {
            const bot = new Bot();
            bot.sessionId = sessionId;
            bot.phoneNumber = phoneNumber;
            
            // Store reference
            this.activeBots.set(phoneNumber, bot);
            
            // Initialize with pairing code
            await bot.initializeWithPairing(phoneNumber, sessionId);
            
            this.logger.success(`✅ Bot initialized for ${phoneNumber}`);
          } catch (error) {
            this.logger.error(`❌ Failed to initialize bot for ${phoneNumber}:`, error);
          }
        }
      }, 2000);
    } catch (error) {
      this.logger.error('Error in initializeBot:', error);
    }
  }

  start() {
    this.app.listen(this.port, () => {
      this.logger.success(`🚀 Pairing Server running on http://localhost:${this.port}`);
      console.log(`\n${'='.repeat(50)}`);
      console.log(`  🌐 Open browser: http://localhost:${this.port}`);
      console.log(`${'='.repeat(50)}\n`);
    });

    // Clean expired codes every minute
    setInterval(() => {
      this.pairingManager.cleanExpiredCodes();
    }, 60000);
  }
}

module.exports = PairingServer;