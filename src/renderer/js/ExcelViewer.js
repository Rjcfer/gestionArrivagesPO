const path = require('path');
const { ipcRenderer } = require('electron');
// Chemin absolu depuis le fichier actuel
const { LabelPrinter } = require(path.join(__dirname, '../../utils/LabelPrinter'));
class ExcelViewer {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.currentFile = null;
        this.currentData = null;
        this.isEditing = false;
        this.hasUnsavedChanges = false;
        this.debounceTimer = null;
        this.isProcessingChange = false; // Flag pour éviter les boucles infinies
    }

    displayFile(fileName, filePath, data) {
        this.currentFile = {
            name: fileName,
            path: filePath
        };
        this.isEditing = true;
        this.hasUnsavedChanges = false;

        // Vérifier et ajouter les colonnes nécessaires si elles n'existent pas
        // Les en-têtes sont maintenant à la ligne 1 (index 1)
        const headers = data[1];
        this.ensureRequiredColumns(headers, data);
        this.currentData = data;

        // Afficher le viewer
        this.uiManager.hideElement('filesList');
        this.uiManager.showElement('excelViewer');

        // Mettre à jour le nom du fichier
        const fileNameElement = document.getElementById('currentFileName');
        if (fileNameElement) {
            fileNameElement.textContent = fileName;
        }

        // Mettre à jour le statut
        this.updateStatus();

        // Afficher les données
        this.renderTable(data);
    }

    ensureRequiredColumns(headers, data) {
        const requiredColumns = [
            'Nom de l\'espèce',
            'Pertes à l\'arrivée',
            'Pertes après arrivée',
            'Total Pertes'
        ];

        requiredColumns.forEach(columnName => {
            const existingIndex = headers.findIndex(h => {
                if (!h) return false;
                const lowerH = h.toLowerCase();
                const lowerColumn = columnName.toLowerCase();
                // Recherche spécifique pour chaque colonne
                if (columnName === 'Nom de l\'espèce') {
                    return lowerH.includes('espèce') || lowerH.includes('espece') || lowerH.includes('nom');
                }
                return lowerH.toLowerCase().includes(lowerColumn.replace('à', 'a').toLowerCase())
                    || lowerH.toLowerCase().includes(lowerColumn.toLowerCase())
                    || lowerH.toLowerCase().includes(lowerColumn.replace('a', 'à').toLowerCase());
            });

            if (existingIndex === -1) {
                headers.push(columnName);
                // Ajouter des valeurs par défaut pour toutes les lignes de données (à partir de la ligne 2)
                for (let i = 2; i < data.length; i++) {
                    while (data[i].length < headers.length - 1) {
                        data[i].push('');
                    }
                    // Valeur par défaut selon le type de colonne
                    if (columnName === 'Nom de l\'espèce') {
                        data[i].push(''); // Nom d'espèce vide par défaut
                    } else {
                        data[i].push('0');
                    }
                }
            }
        });

        // S'assurer que toutes les lignes ont la bonne longueur
        for (let i = 2; i < data.length; i++) {
            while (data[i].length < headers.length) {
                data[i].push('');
            }
        }
    }

    renderTable(data) {
        const table = document.getElementById('excelTable');
        if (!table) {
            console.error('Table element not found');
            return;
        }

        table.innerHTML = '';

        if (!data || data.length === 0) {
            table.innerHTML = '<tr><td>Aucune donnée disponible</td></tr>';
            return;
        }

        // Afficher l'info d'origine (première ligne) avant le tableau
        if (this.debounceTimer === null) {
            this.displayOriginInfo(data[0]);
        }

        const indices = this.getColumnIndices(data[1]);
        const totals = this.calculateTotals(data, indices);
        this.displaySummary(totals);
        this.displayTopBtns();

        // --- En-tête ---
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        // Colonne checkbox générale
        const thSelect = document.createElement('th');
        thSelect.innerHTML = '<input type="checkbox" id="selectAllRows">';
        headerRow.appendChild(thSelect);

        // En-têtes de données
        data[1].forEach((header, index) => {
            const th = document.createElement('th');
            th.textContent = header || `Colonne ${index + 1}`;
            headerRow.appendChild(th);
        });

        // Colonnes pourcentages
        if (indices.qteIdx !== -1) {
            ['% Pertes Arrivée', '% Pertes Après', '% Total Pertes'].forEach(title => {
                const th = document.createElement('th');
                th.textContent = title;
                headerRow.appendChild(th);
            });
        }

        // Colonne Actions
        const thActions = document.createElement('th');
        thActions.textContent = 'Actions';
        thActions.style.width = '130px';
        headerRow.appendChild(thActions);

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // --- Corps ---
        const tbody = document.createElement('tbody');

        for (let i = 2; i < data.length; i++) {
            const row = document.createElement('tr');

            // --- Colonne sélection (checkbox) ---
            const tdSelect = document.createElement('td');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'row-selector';
            checkbox.dataset.row = i;
            tdSelect.appendChild(checkbox);
            row.appendChild(tdSelect);

            // --- Données ---
            let cellIndex = 0;
            for (const cell of data[i]) {
                const td = document.createElement('td');
                const header = data[1][cellIndex] || '';

                if (cellIndex === indices.totalPertesIdx) {
                    const totalPertes = this.calculateRowTotalLosses(data[i], indices);
                    td.textContent = totalPertes.toFixed(2);
                    td.classList.add('pertes-column', 'calculated-column');
                } else {
                    const input = document.createElement('input');
                    indices.dateIdx == cellIndex ? input.type = 'date' : input.type = 'text';
                    input.value = cell || '';
                    input.className = 'form-control form-control-sm';
                    input.dataset.row = i;
                    input.dataset.col = cellIndex;

                    // Événement avec debounce pour éviter les changements trop fréquents
                    input.addEventListener('input', (e) => {
                        if (!this.isProcessingChange) {
                            this.onCellChange(e);
                        }
                    });

                    input.addEventListener('focus', (e) => e.target.select());

                    if (this.isLossColumn(header)) {
                        td.classList.add('pertes-column');
                    }
                    td.appendChild(input);
                }
                row.appendChild(td);
                cellIndex++;
            }

            // --- Colonnes pourcentages ---
            if (indices.qteIdx !== -1) {
                const qte = parseFloat(data[i][indices.qteIdx]) || 0;
                const pertesArrivee = parseFloat(data[i][indices.pertesArriveeIdx]) || 0;
                const pertesApres = parseFloat(data[i][indices.pertesApresIdx]) || 0;
                const totalPertes = pertesArrivee + pertesApres;

                [pertesArrivee, pertesApres, totalPertes].forEach(pertes => {
                    const tdPercent = document.createElement('td');
                    const percent = qte === 0 ? 0 : (pertes / qte) * 100;
                    tdPercent.textContent = percent.toFixed(2) + ' %';
                    tdPercent.classList.add('pertes-column', 'calculated-column');
                    row.appendChild(tdPercent);
                });
            }

            // --- Colonne Actions (Supprimer + Imprimer) ---
            const actionTd = document.createElement('td');
            actionTd.style.textAlign = 'center';

            const delBtn = document.createElement('button');
            delBtn.className = 'btn btn-danger btn-sm me-1';
            delBtn.title = 'Supprimer cette ligne';
            delBtn.innerHTML = '<i class="bi bi-trash"></i>';
            delBtn.addEventListener('click', () => this.deleteRow(i));

            const printBtn = document.createElement('button');
            printBtn.className = 'btn btn-primary btn-sm';
            printBtn.title = 'Imprimer cette étiquette';
            printBtn.innerHTML = '<i class="bi bi-printer"></i>';
            printBtn.addEventListener('click', () => LabelPrinter.print([data[i]], data[1]));

            actionTd.appendChild(delBtn);
            actionTd.appendChild(printBtn);
            row.appendChild(actionTd);

            tbody.appendChild(row);
        }

        table.appendChild(tbody);
        this.renderTableFooter(table, data, indices, totals);
        table.classList.add('excel-table');

        // Gestion du checkbox "Tout sélectionner"
        const selectAll = document.getElementById('selectAllRows');
        if (selectAll) {
            selectAll.addEventListener('change', (e) => {
                const checked = e.target.checked;
                document.querySelectorAll('.row-selector').forEach(cb => cb.checked = checked);
            });
        }
    }

    displayOriginInfo(originData) {
        const summaryDiv = document.getElementById('summaryTotals');

        // Nettoyer les anciennes infos d'origine
        const existingOriginInfo = document.querySelector('.alert.alert-info');
        if (existingOriginInfo) {
            existingOriginInfo.remove();
        }

        if (summaryDiv && originData && originData.length > 0) {
            // Afficher l'info d'origine avant le résumé des totaux
            const originInfo = `<div class="alert alert-info mb-2">
                <strong>Origine/Fournisseur:</strong> ${originData[0] || 'Non spécifié'}
            </div>`;
            summaryDiv.insertAdjacentHTML('beforebegin', originInfo);
        }
    }

    getColumnIndices(headers) {
        return {
            nomEspeceIdx: headers.findIndex(h => {
                if (!h) return false;
                const lowerH = h.toLowerCase();
                return lowerH.includes('espèce') || lowerH.includes('espece') ||
                    (lowerH.includes('nom') && !lowerH.includes('numero'));
            }),
            qteIdx: headers.findIndex(h =>
                h && ['quantité', 'quantite', 'qté', 'qte'].some(key => h.toLowerCase().includes(key))
            ),
            pertesArriveeIdx: headers.findIndex(h =>
                h && (h.toLowerCase().includes('pertes à l\'arrivée') ||
                    h.toLowerCase().includes('pertes a l\'arrivee') ||
                    h.toLowerCase().includes('pertes à l\'arrivee'))
            ),
            pertesApresIdx: headers.findIndex(h =>
                h && (h.toLowerCase().includes('pertes après arrivée') ||
                    h.toLowerCase().includes('pertes apres arrivee') ||
                    h.toLowerCase().includes('pertes après arrivee'))
            ),
            totalPertesIdx: headers.findIndex(h =>
                h && h.toLowerCase().includes('total pertes')
            ),
            dateIdx: headers.findIndex(h =>
                h && h.toLowerCase().includes('date'))
        };
    }

    calculateRowTotalLosses(row, indices) {
        const pertesArrivee = parseFloat(row[indices.pertesArriveeIdx]) || 0;
        const pertesApres = parseFloat(row[indices.pertesApresIdx]) || 0;
        return pertesArrivee + pertesApres;
    }

    printSelectedLabels() {
        const selected = Array.from(document.querySelectorAll('.row-selector:checked'));
        if (selected.length === 0) {
            alert("Veuillez sélectionner au moins une ligne.");
            return;
        }

        const rowsToPrint = selected.map(cb => {
            const rowIndex = parseInt(cb.dataset.row);
            return this.currentData[rowIndex];
        });

        const description = this.currentData[0] || '';
        LabelPrinter.print(rowsToPrint, description);
    }

    calculateTotals(data, indices) {
        let totalQuantite = 0;
        let totalPertesArrivee = 0;
        let totalPertesApres = 0;

        // Commencer à partir de la ligne 2 (données réelles)
        for (let i = 2; i < data.length; i++) {
            const qte = parseFloat(data[i][indices.qteIdx]) || 0;
            const pertesArrivee = parseFloat(data[i][indices.pertesArriveeIdx]) || 0;
            const pertesApres = parseFloat(data[i][indices.pertesApresIdx]) || 0;
            totalQuantite += qte;
            totalPertesArrivee += pertesArrivee;
            totalPertesApres += pertesApres;
        }

        const totalPertes = totalPertesArrivee + totalPertesApres;

        return {
            totalQuantite,
            totalPertesArrivee,
            totalPertesApres,
            totalPertes,
            percentPertesArrivee: totalQuantite === 0 ? 0 : (totalPertesArrivee / totalQuantite) * 100,
            percentPertesApres: totalQuantite === 0 ? 0 : (totalPertesApres / totalQuantite) * 100,
            percentTotalPertes: totalQuantite === 0 ? 0 : (totalPertes / totalQuantite) * 100
        };
    }

    displayTopBtns() {
        const topBtns = document.getElementById('topBtns');
        if (topBtns) {
            topBtns.innerHTML =
                ` <!-- Boutons d'action -->
                    <div class="d-flex justify-content-between mt-3">
                        <div>
                            <button class="btn btn-info btn-sm me-2" onclick="excelViewer.findPertes()">
                                <i class="bi bi-search me-1"></i>
                                Analyser Pertes
                            </button>
                        </div>
                        <div>
                            <button class="btn btn-success btn-sm me-2" onclick="excelViewer.addRow()">
                                <i class="bi bi-plus-lg me-1"></i>
                                Ajouter une ligne
                            </button>
                            <button class="btn btn-outline-primary btn-sm" onclick="excelViewer.addColumn()">
                                <i class="bi bi-plus-square me-1"></i>
                                Ajouter une colonne
                            </button>
                            <button class="btn btn-warning btn-sm" onclick="excelViewer.printSelectedLabels()">
                                <i class="bi bi-printer me-1"></i>
                                Imprimer étiquettes
                            </button>

                        </div>
                    </div>`
                ;
        }

    }

    displaySummary(totals) {
        const summaryDiv = document.getElementById('summaryTotals');
        if (summaryDiv) {
            summaryDiv.innerHTML = `
                <div class="row">
                    <div class="col-md-12">
                        <strong>Total Quantité:</strong> ${totals.totalQuantite.toFixed(2)} &nbsp;&nbsp;
                        <strong>Pertes Arrivée:</strong> ${totals.totalPertesArrivee.toFixed(2)} (${totals.percentPertesArrivee.toFixed(2)}%) &nbsp;&nbsp;
                        <strong>Pertes Après:</strong> ${totals.totalPertesApres.toFixed(2)} (${totals.percentPertesApres.toFixed(2)}%) &nbsp;&nbsp;
                        <strong>Total Pertes:</strong> ${totals.totalPertes.toFixed(2)} (${totals.percentTotalPertes.toFixed(2)}%)
                    </div>
                </div>
            `;
        }
    }

    renderTableFooter(table, data, indices, totals) {
        if (indices.qteIdx === -1) return;

        const tfoot = document.createElement('tfoot');
        const footerRow = document.createElement('tr');

        // Cellule vide pour checkbox
        const thEmpty = document.createElement('td');
        thEmpty.textContent = 'TOTAUX';
        thEmpty.style.fontWeight = 'bold';
        footerRow.appendChild(thEmpty);

        // Parcourir les colonnes originales (en-têtes à l'index 1)
        data[1].forEach((header, index) => {
            const td = document.createElement('td');

            if (index === indices.qteIdx) {
                td.textContent = totals.totalQuantite.toFixed(2);
                td.classList.add('totals-cell');
            } else if (index === indices.pertesArriveeIdx) {
                td.textContent = totals.totalPertesArrivee.toFixed(2);
                td.classList.add('totals-cell', 'pertes-column');
            } else if (index === indices.pertesApresIdx) {
                td.textContent = totals.totalPertesApres.toFixed(2);
                td.classList.add('totals-cell', 'pertes-column');
            } else if (index === indices.totalPertesIdx) {
                td.textContent = totals.totalPertes.toFixed(2);
                td.classList.add('totals-cell', 'pertes-column');
            } else {
                td.textContent = '';
            }

            footerRow.appendChild(td);
        });

        // Ajouter les cellules totaux pourcentages
        [totals.percentPertesArrivee, totals.percentPertesApres, totals.percentTotalPertes].forEach(percent => {
            const tdPercent = document.createElement('td');
            tdPercent.textContent = percent.toFixed(2) + ' %';
            tdPercent.classList.add('totals-cell', 'pertes-column');
            footerRow.appendChild(tdPercent);
        });

        // Cellule vide pour colonne "Actions"
        const tdActions = document.createElement('td');
        tdActions.textContent = '';
        footerRow.appendChild(tdActions);

        tfoot.appendChild(footerRow);
        table.appendChild(tfoot);
    }

    isLossColumn(header) {
        if (!header) return false;
        const lowerHeader = header.toLowerCase();
        return lowerHeader.includes('perte') && !lowerHeader.includes('total');
    }

    onCellChange(event) {
        if (this.isProcessingChange) return;

        this.isProcessingChange = true;

        const row = parseInt(event.target.dataset.row);
        const col = parseInt(event.target.dataset.col);
        const value = event.target.value;

        // Vérifier que les données existent
        if (!this.currentData[row]) {
            this.currentData[row] = [];
        }

        // Mettre à jour la valeur
        this.currentData[row][col] = value;

        // Calculer les totaux des pertes si nécessaire
        const indices = this.getColumnIndices(this.currentData[1]);
        if (indices.totalPertesIdx !== -1) {
            const totalPertes = this.calculateRowTotalLosses(this.currentData[row], indices);
            this.currentData[row][indices.totalPertesIdx] = totalPertes.toString();

            // Mettre à jour uniquement la cellule calculée (pour garder le focus)
            const table = document.getElementById('excelTable');
            if (table && table.tBodies[0]) {
                const rowElement = table.tBodies[0].rows[row - 2];
                if (rowElement) {
                    // +1 pour la colonne checkbox
                    const totalPertesCell = rowElement.cells[indices.totalPertesIdx + 1];
                    if (totalPertesCell) {
                        totalPertesCell.textContent = totalPertes.toFixed(2);
                        totalPertesCell.classList.add('pertes-column', 'calculated-column');
                    }
                }
            }
        }

        // Marquer comme modifié
        this.hasUnsavedChanges = true;
        this.updateStatus();

        // Annuler le timer existant
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Programmer le re-rendu complet après 3 secondes
        this.debounceTimer = setTimeout(() => {
            this.renderTable(this.currentData);
            this.debounceTimer = null;
            this.isProcessingChange = false;
        }, 3000);

        // Permettre immédiatement d'autres changements
        setTimeout(() => {
            this.isProcessingChange = false;
        }, 100);
    }

    async saveFile() {
        if (!this.currentFile || !this.currentData) {
            this.uiManager.showToast('Aucun fichier à sauvegarder', 'warning');
            return;
        }

        try {
            const result = await ipcRenderer.invoke('files:save', this.currentFile.path, this.currentData);

            if (result.success) {
                this.hasUnsavedChanges = false;
                this.updateStatus();
                this.uiManager.showToast('Fichier sauvegardé avec succès', 'success');
            } else {
                this.uiManager.showToast('Erreur lors de la sauvegarde: ' + result.error, 'error');
            }
        } catch (error) {
            this.uiManager.showToast('Erreur lors de la sauvegarde', 'error');
            console.error('Save error:', error);
        }
    }

    async closeViewer() {
        if (this.hasUnsavedChanges) {
            const confirmed = confirm('Vous avez des modifications non sauvegardées. Voulez-vous vraiment fermer ?');
            if (!confirmed) {
                return;
            }
        }

        // Déverrouiller le fichier
        if (this.currentFile) {
            try {
                await ipcRenderer.invoke('files:unlock', this.currentFile.path);
            } catch (error) {
                console.error('Unlock error:', error);
            }
        }

        // Nettoyer les timers
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }

        // Réinitialiser l'état
        this.currentFile = null;
        this.currentData = null;
        this.isEditing = false;
        this.hasUnsavedChanges = false;
        this.isProcessingChange = false;

        // Nettoyer les éléments ajoutés dynamiquement
        const existingOriginInfo = document.querySelector('.alert.alert-info');
        if (existingOriginInfo) {
            existingOriginInfo.remove();
        }

        // Afficher la liste des fichiers
        this.uiManager.hideElement('excelViewer');
        this.uiManager.showElement('filesList');

        // Rafraîchir la liste des fichiers
        if (typeof fileManager !== 'undefined') {
            await fileManager.refreshFiles();
        }
    }

    updateStatus() {
        // Vérifier que uiManager et la méthode existent
        if (!this.uiManager || typeof this.uiManager.updateStatus !== 'function') {
            console.warn('UIManager not available or updateStatus method missing');
            return;
        }

        const lockStatus = this.isEditing ?
            '<i class="bi bi-shield-lock-fill text-success me-1"></i>Statut: Verrouillé' :
            '<i class="bi bi-shield-lock text-secondary me-1"></i>Statut: Non verrouillé';

        const editStatus = this.hasUnsavedChanges ?
            '<i class="bi bi-pencil-fill text-warning me-1"></i>Édition: Modifications non sauvegardées' :
            '<i class="bi bi-pencil text-success me-1"></i>Édition: Sauvegardé';

        this.uiManager.updateStatus(lockStatus, editStatus);
    }

    // Méthodes utilitaires pour la manipulation des données
    addRow() {
        if (!this.currentData) return;

        const newRow = new Array(this.currentData[1].length).fill('');
        // Initialiser les colonnes avec des valeurs par défaut
        const indices = this.getColumnIndices(this.currentData[1]);
        if (indices.nomEspeceIdx !== -1) newRow[indices.nomEspeceIdx] = '';
        if (indices.pertesArriveeIdx !== -1) newRow[indices.pertesArriveeIdx] = '0';
        if (indices.pertesApresIdx !== -1) newRow[indices.pertesApresIdx] = '0';
        if (indices.totalPertesIdx !== -1) newRow[indices.totalPertesIdx] = '0';

        this.currentData.push(newRow);
        this.renderTable(this.currentData);
        this.hasUnsavedChanges = true;
        this.updateStatus();
    }

    deleteRow(rowIndex) {
        if (!this.currentData || rowIndex <= 1 || rowIndex >= this.currentData.length) return;

        this.currentData.splice(rowIndex, 1);
        this.renderTable(this.currentData);
        this.hasUnsavedChanges = true;
        this.updateStatus();
    }

    addColumn() {
        if (!this.currentData) return;

        this.currentData.forEach(row => {
            row.push('');
        });
        this.renderTable(this.currentData);
        this.hasUnsavedChanges = true;
        this.updateStatus();
    }

    findPertes() {
        if (!this.currentData || this.currentData.length === 0) return;

        const indices = this.getColumnIndices(this.currentData[1]);
        const totals = this.calculateTotals(this.currentData, indices);

        this.uiManager.showToast(
            `Pertes trouvées - Arrivée: ${totals.totalPertesArrivee.toFixed(2)}, Après: ${totals.totalPertesApres.toFixed(2)}, Total: ${totals.totalPertes.toFixed(2)}`,
            'info'
        );
    }

    // Gestion des raccourcis clavier
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (!this.isEditing) return;

            // Ctrl+S pour sauvegarder
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.saveFile();
            }

            // Échap pour fermer
            if (e.key === 'Escape') {
                e.preventDefault();
                this.closeViewer();
            }
        });
    }
}

module.exports = ExcelViewer;