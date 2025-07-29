const Constants = {
    CONFIG_FILE: 'config.json',
    SUPPORTED_EXTENSIONS: ['.xlsx', '.xls','.csv'],
    DEFAULT_HANDLER: 'file',
    HANDLERS: {
        FILE: 'file',
        API: 'api',
        BUCKET: 'bucket'
    },
    EVENTS: {
        CONFIG_LOADED: 'config:loaded',
        FILES_UPDATED: 'files:updated',
        FILE_LOCKED: 'file:locked',
        FILE_UNLOCKED: 'file:unlocked'
    }
};

module.exports = Constants;