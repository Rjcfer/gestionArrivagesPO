const { app, BrowserWindow, ipcMain, dialog,nativeImage,Tray } = require('electron');
const path = require('path');
const ConfigService = require('./src/services/ConfigService');
const ExcelService = require('./src/services/ExcelService');
const LockService = require('./src/services/LockService');
const FileHandler = require('./src/handlers/FileHandler');

let mainWindow;
let configService;
let excelService;
let lockService;
let currentHandler;

async function createWindow() {
    const config = await configService.getConfig();
    const trayIcon = nativeImage.createFromPath(path.join(__dirname, 'src', 'assets', 'icons', 'favicon-1.ico'))
    const appIcon = nativeImage.createFromPath(path.join(__dirname, 'src', 'assets', 'icons', 'images.jpg'))
    const tray = new Tray(trayIcon)
    mainWindow = new BrowserWindow({
        width: config.window?.width || 1200,
        height: config.window?.height || 800,
        autoHideMenuBar: config.window?.autoHideMenuBar ?? true,
        icon: appIcon,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
        }
    });
    mainWindow.loadFile('src/renderer/views/index.html');

    if (config.window?.openDevTools) {
        mainWindow.webContents.openDevTools();
    }
}

// Ajoutez ces handlers à votre main.js

let previewWindow = null;

// Handler pour ouvrir la fenêtre de prévisualisation
ipcMain.on('print-preview', (event, htmlContent) => {
    // Fermer la fenêtre de prévisualisation existante si elle existe
    if (previewWindow && !previewWindow.isDestroyed()) {
        previewWindow.close();
    }

    previewWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        show: true,
        title: 'Prévisualisation des étiquettes',
        icon: null, // Ajoutez votre icône si nécessaire
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
        modal: false, // Peut être mis à true si vous voulez une fenêtre modale
        parent: mainWindow // Lie la fenêtre à la fenêtre principale
    });

    previewWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));

    // Optionnel : ouvrir les DevTools pour debug
    // previewWindow.webContents.openDevTools();

    previewWindow.on('closed', () => {
        previewWindow = null;
    });
});

// Handler pour fermer la fenêtre de prévisualisation
ipcMain.on('close-preview', () => {
    if (previewWindow && !previewWindow.isDestroyed()) {
        previewWindow.close();
    }
});

// Optionnel : Handler pour impression directe depuis la prévisualisation
ipcMain.on('print-from-preview', (event, htmlContent) => {
    const printWindow = new BrowserWindow({
        width: 800,
        height: 600,
        show: false,
        webPreferences: {
            contextIsolation: true,
            sandbox: true
        }
    });

    printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));

    printWindow.webContents.on('did-finish-load', () => {
        printWindow.webContents.print({
            silent: false,
            printBackground: true,
            deviceName: '',
            margins: {
                marginType: 'printableArea'
            },
            pageSize: 'A4',
            scaleFactor: 100
        }, (success, failureReason) => {
            if (!success) {
                console.error('Échec impression:', failureReason);
            }
            printWindow.close();
        });
    });
});

// Gérer la fermeture de l'application
app.on('before-quit', () => {
    if (previewWindow && !previewWindow.isDestroyed()) {
        previewWindow.close();
    }
});

ipcMain.handle('files:test', async (event, filePath) => {
    try {
        const buffer = fs.readFileSync(filePath);
        if (!buffer || buffer.length === 0) throw new Error("Fichier vide");
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

async function initializeServices() {
    configService = new ConfigService();
    excelService = new ExcelService();
    lockService = new LockService();

    // Initialiser avec FileHandler par défaut
    currentHandler = new FileHandler(configService, excelService, lockService);

    await configService.init();
}

app.whenReady().then(async () => {
    await initializeServices();
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// IPC Handlers - délégués aux services
ipcMain.handle('config:load', () => {
    return configService.getConfig();
});

ipcMain.handle('config:select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });

    if (!result.canceled && result.filePaths.length > 0) {
        const folderPath = result.filePaths[0];
        await configService.setFolderPath(folderPath);
        return configService.getConfig();
    }

    return null;
});

ipcMain.handle('files:list', async () => {
    return await currentHandler.listFiles();
});

ipcMain.handle('files:read', async (event, filePath) => {
    return await currentHandler.readFile(filePath);
});

ipcMain.handle('files:save', async (event, filePath, data) => {
    return await currentHandler.saveFile(filePath, data);
});

ipcMain.handle('files:lock', async (event, filePath) => {
    return await currentHandler.lockFile(filePath);
});

ipcMain.handle('files:unlock', async (event, filePath) => {
    return await currentHandler.unlockFile(filePath);
});

ipcMain.handle('handler:switch', async (event, handlerType) => {
    // Futur: permettre de changer de handler (file, api, bucket)
    switch (handlerType) {
        case 'file':
            currentHandler = new FileHandler(configService, excelService, lockService);
            break;
        case 'api':
            // const ApiHandler = require('./src/handlers/ApiHandler');
            // currentHandler = new ApiHandler(configService, excelService, lockService);
            break;
        case 'bucket':
            // const BucketHandler = require('./src/handlers/BucketHandler');
            // currentHandler = new BucketHandler(configService, excelService, lockService);
            break;
        default:
            throw new Error('Handler type not supported');
    }
    return { success: true, handler: handlerType };
});