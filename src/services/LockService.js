class LockService {
    constructor() {
        this.lockedFiles = new Map();
    }

    async lockFile(filePath, userId = 'default') {
        if (this.lockedFiles.has(filePath)) {
            return {
                success: false,
                error: 'File is already locked',
                lockedBy: this.lockedFiles.get(filePath).userId
            };
        }

        this.lockedFiles.set(filePath, {
            userId,
            timestamp: Date.now()
        });

        return {
            success: true,
            message: 'File locked successfully'
        };
    }

    async unlockFile(filePath, userId = 'default') {
        const lockInfo = this.lockedFiles.get(filePath);
        
        if (!lockInfo) {
            return {
                success: false,
                error: 'File is not locked'
            };
        }

        if (lockInfo.userId !== userId) {
            return {
                success: false,
                error: 'Cannot unlock file locked by another user'
            };
        }

        this.lockedFiles.delete(filePath);
        return {
            success: true,
            message: 'File unlocked successfully'
        };
    }

    isLocked(filePath) {
        return this.lockedFiles.has(filePath);
    }

    getLockedFiles() {
        return Array.from(this.lockedFiles.entries()).map(([path, info]) => ({
            path,
            userId: info.userId,
            timestamp: info.timestamp
        }));
    }

    // Nettoyer les verrous expirés
    cleanupExpiredLocks(timeout = 300000) { // 5 minutes par défaut
        const now = Date.now();
        for (const [path, info] of this.lockedFiles.entries()) {
            if (now - info.timestamp > timeout) {
                this.lockedFiles.delete(path);
            }
        }
    }
}

module.exports = LockService;