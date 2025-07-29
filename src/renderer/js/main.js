const { ipcRenderer } = require('electron');

const FileManager = require('../js/FileManager');
const ExcelViewer = require('../js/ExcelViewer');
const UiManager = require('../js/UiManager.js');

// Instances globales
let fileManager;
let excelViewer;
let uiManager;

// Initialisation de l'application
document.addEventListener('DOMContentLoaded', async () => {
    console.log('UiManager:', UiManager);
    uiManager = new UiManager();
    fileManager = new FileManager(uiManager);
    excelViewer = new ExcelViewer(uiManager);
    
    await fileManager.initialize();
    
    // Événements
    document.getElementById('handlerSelect').addEventListener('change', handleHandlerChange);
});

async function handleHandlerChange(event) {
    const handlerType = event.target.value;
    
    if (handlerType === 'api' || handlerType === 'bucket') {
        uiManager.showToast('Handler non disponible pour le moment', 'warning');
        event.target.value = 'file';
        return;
    }
    
    try {
        const result = await ipcRenderer.invoke('handler:switch', handlerType);
        if (result.success) {
            uiManager.showToast(`Handler changé vers: ${handlerType}`, 'success');
            await fileManager.loadFiles();
        }
    } catch (error) {
        uiManager.showToast('Erreur lors du changement de handler', 'error');
    }
}