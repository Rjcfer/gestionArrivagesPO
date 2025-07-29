class LabelPrinter {
    /**
     * Imprime les étiquettes à partir des données fournies.
     * @param {Array[]} rows - Les lignes de données à imprimer (exclut les lignes d'en-tête).
     * @param {string[]} headers - Les titres de colonnes à afficher sur les étiquettes.
     */
    static print(rows, title) {
        if (!Array.isArray(rows) || rows.length === 0) {
            alert('Aucune donnée à imprimer.');
            return;
        }

        const htmlContent = this.buildCompleteHtml(rows, title);

        // Utiliser l'IPC d'Electron pour ouvrir la prévisualisation
        const { ipcRenderer } = require('electron');
        ipcRenderer.send('print-preview', htmlContent);
    }

    /**
     * Construit le HTML complet avec styles pour l'impression.
     * @param {Array[]} rows - Données.
     * @param {string[]} title
     * @returns {string} HTML complet.
     */
    static buildCompleteHtml(rows, title) {
        const labelsHtml = this.buildLabelsHtml(rows, title);

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Prévisualisation des étiquettes</title>
                <style>
                    @page {
                        size: A4;
                        margin: 10mm;
                    }
                    
                    body {
                        font-family: sans-serif;
                        margin: 0;
                        padding: 20px;
                        background-color: #f5f5f5;
                    }
                    
                    .preview-header {
                        background: white;
                        padding: 10px;
                        margin-bottom: 15px;
                        border-radius: 5px;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    
                    .preview-header h2 {
                        margin: 0;
                        color: #333;
                    }
                    
                    .button-group {
                        display: flex;
                        gap: 10px;
                    }
                    
                    button {
                        padding: 10px;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 15px;
                        transition: background-color 0.3s;
                    }
                    
                    .btn-print {
                        background-color: #007bff;
                        color: white;
                    }
                    
                    .btn-print:hover {
                        background-color: #0056b3;
                    }
                    
                    .btn-cancel {
                        background-color: #6c757d;
                        color: white;
                    }
                    
                    .btn-cancel:hover {
                        background-color: #545b62;
                    }
                    
                    .preview-content {
                        background: white;
                        padding: 1px;
                        border-radius: 5px;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                        display: flex;
                        flex-wrap: wrap;
                        justify-content: flex-start;
                        align-items: flex-start;
                    }
                    
                    .label {
                        width: 90mm;
                        height: 36mm;
                        border: 1px solid #000;
                        box-sizing: border-box;
                        margin: 1mm;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        font-size: 13px;
                        page-break-inside: avoid;
                        overflow: hidden;
                        background: white;
                    }
                    
                    .label div {
                        margin-bottom: 1px;
                        word-break: break-word;
                    }
                    
                    .label-count {
                        color: #666;
                        font-size: 10px;
                        margin-left: 1px;
                    }
                    
                    @media print {
                        .preview-header {
                            display: none !important;
                        }
                        
                        body {
                            background-color: white;
                            padding: 0;
                        }
                        
                        .preview-content {
                            box-shadow: none;
                            border-radius: 0;
                            padding: 0;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="preview-header">
                    <div>
                        <h2>Prévisualisation des étiquettes</h2>
                        <span class="label-count">${rows.length} étiquette(s)</span>
                    </div>
                    <div class="button-group">
                        <button class="btn-print" onclick="printLabels()">
                            🖨️ Imprimer
                        </button>
                        <button class="btn-cancel" onclick="closePreview()">
                            ❌ Annuler
                        </button>
                    </div>
                </div>
                
                <div class="preview-content">
                    ${labelsHtml}
                </div>
                
                <script>
                    const { ipcRenderer } = require('electron');
                    
                    function printLabels() {
                        // Déclencher l'impression
                        window.print();
                    }
                    
                    function closePreview() {
                        // Fermer la fenêtre de prévisualisation
                        ipcRenderer.send('close-preview');
                    }
                    
                    // Fermer avec Échap
                    document.addEventListener('keydown', function(event) {
                        if (event.key === 'Escape') {
                            closePreview();
                        }
                    });
                </script>
            </body>
            </html>
        `;
    }

    /**
     * Construit le HTML de toutes les étiquettes à partir des lignes.
     * @param {Array[]} rows - Données.
     * @param {string[]} title 
     * @returns {string} HTML.
     */
    static buildLabelsHtml(rows, title) {
        return rows.map(row => this.formatSingleLabel(row, title)).join('\n');
    }

    /**
     * Formate une seule étiquette en HTML.
     * @param {Array} row - Une ligne de données.
     * @param {string} designation - La ligne qui dit le pays fornisseur etc
     * @returns {string} HTML.
     */
    static formatSingleLabel(row, title) {
        // Indices des colonnes à afficher
        const visibleIndices = [0, 2, 3, 4, 5, 7,6]; // ← change ici si nécessaire

        // Labels fixes à utiliser
        const fixedHeaders = [
            "Produit",
            "Qté",
            "N° cuve",
            "Date arrivage",
            "Pertes arrivée",
                        "Pertes après",
            "Traitement"

        ];
        return `
        <div class="label">
            <div><strong>${title}</strong></div>
            ${visibleIndices.map((i, index) => {
            const label = fixedHeaders[index];
            const cell = row[i] || '';
            return `<div><strong>${label}:</strong> ${cell}</div>`;
        }).join('')}
        </div>
    `;
    }

}

module.exports = { LabelPrinter };