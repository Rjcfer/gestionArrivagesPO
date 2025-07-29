const path = require('path');
const { ipcRenderer } = require('electron');
// Chemin absolu depuis le fichier actuel
const { hasRequiredHeaders } = require(path.join(__dirname, '../../utils/HasRequiredHeaders'));


class FileManager {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.currentConfig = null;
    }

    async initialize() {
        await this.loadConfig();
        if (this.currentConfig && this.currentConfig.folderPath) {
            document.getElementById('folderPath').textContent = this.currentConfig.folderPath;
            await this.loadFiles();
        }
    }

    async loadConfig() {
        this.currentConfig = await ipcRenderer.invoke('config:load');
    }

    async selectFolder() {
        const config = await ipcRenderer.invoke('config:select-folder');
        if (config) {
            this.currentConfig = config;
            document.getElementById('folderPath').textContent = config.folderPath;
            await this.loadFiles();
            this.uiManager.showToast('Dossier sélectionné avec succès', 'success');
        }
    }

    async testFile(filePath) {
        // Récupérer les données Excel via IPC
        const fileResult = await ipcRenderer.invoke('files:read', filePath);

        if (fileResult.success) {
            const data = fileResult.data;

            // Vérifier les entêtes avec ta fonction existante
            const isValid = hasRequiredHeaders(data);

            return { success: isValid };
        } else {
            return { success: false, error: fileResult.error };
        }
    }

    async loadFiles() {
        if (!this.currentConfig || !this.currentConfig.folderPath) return;

        const result = await ipcRenderer.invoke('files:list');
        const tbody = document.getElementById('filesTableBody');
        tbody.innerHTML = '';

        // Variables globales
        let speciesSetGlobal = new Set();
        let totalQuantiteGlobal = 0;
        let totalPertesArriveeGlobal = 0;
        let totalPertesApresGlobal = 0;

        if (result.success) {
            for (const file of result.files) {
                const testResult = await this.testFile(file.path);
                const disabled = !testResult.success;

                // Ligne fichier
                const row = document.createElement('tr');
                row.innerHTML = `
                <td>
                    <i class="bi bi-file-earmark-excel text-success me-2"></i>
                    ${file.name}
                </td>
                <td>${this.uiManager.formatFileSize(file.size)}</td>
                <td>${new Date(file.modified).toLocaleString()}</td>
                <td>
                    <button class="btn btn-primary btn-sm" 
                            onclick="fileManager.openFile('${encodeURIComponent(file.path)}', '${file.name}')"
                            ${disabled ? 'disabled title="Fichier non lisible"' : ''}>
                        <i class="bi bi-eye me-1"></i>
                        ${disabled ? 'Non lisible' : 'Ouvrir'}
                    </button>
                </td>
            `;
                tbody.appendChild(row);

                if (disabled) {
                    // Ligne erreur
                    const errorRow = document.createElement('tr');
                    errorRow.innerHTML = `
                    <td colspan="4" class="text-danger small fst-italic">
                        ⚠️ Fichier non lisible : format ou entêtes incorrects
                    </td>
                `;
                    tbody.appendChild(errorRow);
                } else {
                    // Calcul résumé par fichier
                    const fileResult = await ipcRenderer.invoke('files:read', file.path);
                    if (fileResult.success && fileResult.data.length > 2) {
                        const data = fileResult.data;
                        const headers = data[1];

                        // Trouver indices colonnes (modifie selon tes noms)
                        const especeIdx = headers.findIndex(h => h.toLowerCase().includes('espece') || h.toLowerCase().includes('espèce'));
                        const quantiteIdx = headers.findIndex(h => h.toLowerCase().includes('qté') || h.toLowerCase().includes('qte'));
                        const pertesArriveeIdx = headers.findIndex(h => (h.toLowerCase().includes('pertes') && h.toLowerCase().includes('arrivée')) || h.toLowerCase().includes('Pertes à l\'arrivée'));
                        const pertesApresIdx = headers.findIndex(h => h.toLowerCase().includes('pertes après') || h.toLowerCase().includes('pertes_apres'));

                        let speciesSet = new Set();
                        let totalQuantite = 0;
                        let totalPertesArrivee = 0;
                        let totalPertesApres = 0;
                        let paysArrivage = data[0]?.toString() || '';

                        for (let i = 2; i < data.length; i++) {
                            const row = data[i];
                            if (!row) continue;

                            const espece = (row[especeIdx] || '').toString().trim();
                            if (espece) speciesSet.add(espece);

                            const quantite = parseFloat(row[quantiteIdx]) || 0;
                            totalQuantite += quantite;

                            const pertesArrivee = parseFloat(row[pertesArriveeIdx]) || 0;
                            totalPertesArrivee += pertesArrivee;

                            const pertesApres = parseFloat(row[pertesApresIdx]) || 0;
                            totalPertesApres += pertesApres;
                        }

                        // Ajouter dans global
                        speciesSetGlobal = new Set([...speciesSetGlobal, ...speciesSet]);
                        totalQuantiteGlobal += totalQuantite;
                        totalPertesArriveeGlobal += totalPertesArrivee;
                        totalPertesApresGlobal += totalPertesApres;

                        // Calcul pourcentages par fichier
                        const totalPertes = totalPertesArrivee + totalPertesApres;
                        const percentPertesArrivee = totalQuantite === 0 ? 0 : (totalPertesArrivee / totalQuantite) * 100;
                        const percentPertesApres = totalQuantite === 0 ? 0 : (totalPertesApres / totalQuantite) * 100;
                        const percentTotalPertes = totalQuantite === 0 ? 0 : (totalPertes / totalQuantite) * 100;

                        // Ligne résumé par fichier (sous la ligne principale)
                        const summaryPerFileRow = document.createElement('tr');
                        summaryPerFileRow.innerHTML = `
                        <td colspan="4" style="background:#e2e3e5; font-style: italic; font-size: 0.9em;">
                            📊 <b>${paysArrivage} ,</b><br/>
                            Espèces: ${speciesSet.size}, <br/>
                            Quantité: ${totalQuantite.toFixed(2)},<br/>
                            Pertes arrivée: ${totalPertesArrivee.toFixed(2)} (${percentPertesArrivee.toFixed(2)}%), <br/>
                            Pertes après: ${totalPertesApres.toFixed(2)} (${percentPertesApres.toFixed(2)}%), <br/>
                            Total pertes: ${totalPertes.toFixed(2)} (${percentTotalPertes.toFixed(2)}%)
                        </td>
                    `;
                        tbody.appendChild(summaryPerFileRow);
                    }
                }
            }

            // Résumé global à la fin
            const totalPertesGlobal = totalPertesArriveeGlobal + totalPertesApresGlobal;
            const percentPertesArriveeGlobal = totalQuantiteGlobal === 0 ? 0 : (totalPertesArriveeGlobal / totalQuantiteGlobal) * 100;
            const percentPertesApresGlobal = totalQuantiteGlobal === 0 ? 0 : (totalPertesApresGlobal / totalQuantiteGlobal) * 100;
            const percentTotalPertesGlobal = totalQuantiteGlobal === 0 ? 0 : (totalPertesGlobal / totalQuantiteGlobal) * 100;

            const summaryRow = document.createElement('tr');
            summaryRow.innerHTML = `
            <td colspan="4" style="background:#d1e7dd; font-weight:bold;">
                🏁 Résumé global des fichiers valides : ${speciesSetGlobal.size} espèces distinctes, Quantité totale = ${totalQuantiteGlobal.toFixed(2)}, <br/>
                Pertes arrivée = ${totalPertesArriveeGlobal.toFixed(2)} (${percentPertesArriveeGlobal.toFixed(2)}%), <br/>
                Pertes après = ${totalPertesApresGlobal.toFixed(2)} (${percentPertesApresGlobal.toFixed(2)}%), <br/>
                Total pertes = ${totalPertesGlobal.toFixed(2)} (${percentTotalPertesGlobal.toFixed(2)}%)
            </td>
        `;
            tbody.appendChild(summaryRow);
        }
    }

    async openFile(filePath, fileName) {
        filePath = decodeURIComponent(filePath);
        try {
            // Essayer de verrouiller le fichier
            const lockResult = await ipcRenderer.invoke('files:lock', filePath);

            if (lockResult.success) {
                // Lire le fichier
                const fileResult = await ipcRenderer.invoke('files:read', filePath);

                if (fileResult.success) {
                    // Afficher le fichier dans le viewer
                    excelViewer.displayFile(fileName, filePath, fileResult.data);
                    this.uiManager.showToast('Fichier ouvert et verrouillé', 'success');
                } else {
                    // Déverrouiller en cas d'erreur de lecture
                    await ipcRenderer.invoke('files:unlock', filePath);
                    this.uiManager.showToast('Erreur lors de la lecture: ' + fileResult.error, 'error');
                }
            } else {
                this.uiManager.showToast('Impossible de verrouiller le fichier: ' + lockResult.error, 'warning');
            }
        } catch (error) {
            this.uiManager.showToast('Erreur lors de l\'ouverture du fichier', 'error');
        }
    }

    async refreshFiles() {
        await this.loadFiles();
        this.uiManager.showToast('Liste des fichiers rafraîchie', 'info');
    }
}

// AJOUT DE L'EXPORT MANQUANT
module.exports = FileManager;