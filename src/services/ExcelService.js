const XLSX = require('xlsx');

class ExcelService {
    async readFile(filePath) {
        try {
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            return {
                success: true,
                data: data,
                sheetName: sheetName,
                sheets: workbook.SheetNames
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async saveFile(filePath, data, sheetName = 'Sheet1') {
        try {
            const workbook = XLSX.utils.book_new();
            const worksheet = XLSX.utils.aoa_to_sheet(data);
            XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
            XLSX.writeFile(workbook, filePath);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    findColumnIndex(data, columnName) {
        if (data.length > 0) {
            const headers = data[0];
            for (let i = 0; i < headers.length; i++) {
                if (headers[i] && headers[i].toString().toLowerCase().includes(columnName.toLowerCase())) {
                    return i;
                }
            }
        }
        return -1;
    }

    validateExcelData(data) {
        if (!Array.isArray(data)) {
            return { valid: false, error: 'Data must be an array' };
        }
        
        if (data.length === 0) {
            return { valid: false, error: 'Data cannot be empty' };
        }
        
        return { valid: true };
    }
}

module.exports = ExcelService;
