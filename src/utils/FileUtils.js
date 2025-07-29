const fs = require('fs');
const path = require('path');
const Constants = require('./Constants');
const Log = require('./Logger');

class FileUtils {
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    static isExcelFile(filename) {
        const ext = path.extname(filename).toLowerCase();
        return Constants.SUPPORTED_EXTENSIONS.includes(ext);
    }

    static async fileExists(filePath) {
        try {
            await fs.promises.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    static async getFileStats(filePath) {
        try {
            const stats = await fs.promises.stat(filePath);
            return {
                size: stats.size,
                modified: stats.mtime,
                created: stats.birthtime
            };
        } catch (error) {
            throw new Error(`Cannot get file stats: ${error.message}`);
        }
    }

    static async readDirectory(dirPath) {
        try {
            const files = await fs.promises.readdir(dirPath);
            const fileInfos = [];

            for (const file of files) {
                if (this.isExcelFile(file)) {
                    const filePath = path.join(dirPath, file);
                    const stats = await this.getFileStats(filePath);
                    fileInfos.push({
                        name: file,
                        path: filePath,
                        size: stats.size,
                        modified: stats.modified,
                        created: stats.created
                    });
                }
            }

            return fileInfos;
        } catch (error) {
            throw new Error(`Cannot read directory: ${error.message}`);
        }
    }
}

module.exports = FileUtils;
