function hasRequiredHeaders(data) {
    if (!data || data.length < 2) return false;
    const headers = data[1]; // ligne des en-têtes

    const requiredColumns = [
        'Nom de l\'espèce',
        'Pertes à l\'arrivée',
        'Pertes après arrivée',
        'Total Pertes'
    ];

    return requiredColumns.every(colName =>
        headers.some(h => {
            if (h instanceof String || typeof h === 'string') {
                if (!h) return false;
                const lowerH = h.toLowerCase();
                const lowerCol = colName.toLowerCase();
                if (colName === 'Nom de l\'espèce') {
                    return lowerH.includes('espèce') || lowerH.includes('espece') || lowerH.includes('nom');
                }
                return lowerH.includes(lowerCol.replace('à', 'a')) || lowerH.includes(lowerCol);
            }
        })
    );
}

module.exports = { hasRequiredHeaders };
