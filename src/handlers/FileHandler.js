const BaseHandler = require('../../src/handlers/BaseHandler');
const FileUtils = require('../../src/utils/FileUtils');

class FileHandler extends BaseHandler {
    constructor(configService, excelService, lockService) {
        super(configService, excelService, lockService);
    }

    async listFiles() {
        const config = this.configService.getConfig();
        
        if (!config.folderPath) {
            return {
                success: false,
                error: 'No folder path configured'
            };
        }

        try {
            const files = await FileUtils.readDirectory(config.folderPath);
            return {
                success: true,
                files: files
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async readFile(filePath) {
        try {
            const exists = await FileUtils.fileExists(filePath);
            if (!exists) {
                return {
                    success: false,
                    error: 'File not found'
                };
            }

            return await this.excelService.readFile(filePath);
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async saveFile(filePath, data) {
        try {
            // Vérifier si le fichier est verrouillé
            if (this.lockService.isLocked(filePath)) {
                return await this.excelService.saveFile(filePath, data);
            } else {
                return {
                    success: false,
                    error: 'File must be locked before saving'
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async deleteFile(filePath) {
        try {
            if (this.lockService.isLocked(filePath)) {
                return {
                    success: false,
                    error: 'Cannot delete locked file'
                };
            }

            const fs = require('fs').promises;
            await fs.unlink(filePath);
            
            return {
                success: true,
                message: 'File deleted successfully'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async validateConfig() {
        const config = this.configService.getConfig();
        
        if (!config.folderPath) {
            return {
                valid: false,
                error: 'Folder path is required'
            };
        }

        try {
            const exists = await FileUtils.fileExists(config.folderPath);
            if (!exists) {
                return {
                    valid: false,
                    error: 'Folder path does not exist'
                };
            }

            return { valid: true };
        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }
}

module.exports = FileHandler;