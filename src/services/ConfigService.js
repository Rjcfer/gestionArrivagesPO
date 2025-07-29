const fs = require('fs');
const path = require('path');
const Constants = require('../utils/Constants');

class ConfigService {
    constructor() {
        this.config = {
            folderPath: null,
            handler: Constants.DEFAULT_HANDLER,
            settings: {
                autoSave: true,
                lockTimeout: 300000, // 5 minutes
                backupEnabled: true
            }
        };
        this.configPath = path.join(__dirname, '../../', Constants.CONFIG_FILE);
    }

    async init() {
        await this.loadConfig();
    }

    async loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = fs.readFileSync(this.configPath, 'utf8');
                this.config = { ...this.config, ...JSON.parse(data) };
            }
        } catch (error) {
            console.error('Error loading config:', error);
            // Utiliser la config par défaut
        }
    }

    async saveConfig() {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
            return true;
        } catch (error) {
            console.error('Error saving config:', error);
            return false;
        }
    }

    getConfig() {
        return { ...this.config };
    }

    async setFolderPath(folderPath) {
        this.config.folderPath = folderPath;
        await this.saveConfig();
    }

    async setHandler(handlerType) {
        this.config.handler = handlerType;
        await this.saveConfig();
    }

    async updateSettings(settings) {
        this.config.settings = { ...this.config.settings, ...settings };
        await this.saveConfig();
    }
}

module.exports = ConfigService;