class BaseHandler {
    constructor(configService, excelService, lockService) {
        this.configService = configService;
        this.excelService = excelService;
        this.lockService = lockService;
    }

    async listFiles() {
        throw new Error('listFiles method must be implemented');
    }

    async readFile(filePath) {
        throw new Error('readFile method must be implemented');
    }

    async saveFile(filePath, data) {
        throw new Error('saveFile method must be implemented');
    }

    async lockFile(filePath) {
        return await this.lockService.lockFile(filePath);
    }

    async unlockFile(filePath) {
        return await this.lockService.unlockFile(filePath);
    }

    async deleteFile(filePath) {
        throw new Error('deleteFile method must be implemented');
    }

    async validateConfig() {
        throw new Error('validateConfig method must be implemented');
    }
}

module.exports = BaseHandler;