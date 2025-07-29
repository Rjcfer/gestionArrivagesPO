class UIManager {
    constructor() {
        this.toastContainer = null;
    }

    showToast(message, type = 'info') {
        const container = this.getToastContainer();

        const toastId = 'toast-' + Date.now();
        const iconClass = this.getToastIcon(type);
        const toastHtml = `
            <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header">
                    <i class="${iconClass} text-${type} me-2"></i>
                    <strong class="me-auto">Notification</strong>
                    <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">${message}</div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', toastHtml);

        const toastElement = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastElement);
        toast.show();

        setTimeout(() => {
            if (toastElement) {
                toastElement.remove();
            }
        }, 5000);
    }

    getToastContainer() {
        if (!this.toastContainer) {
            this.toastContainer = document.createElement('div');
            this.toastContainer.id = 'toastContainer';
            this.toastContainer.className = 'position-fixed top-0 end-0 p-3';
            this.toastContainer.style.zIndex = '1055';
            document.body.appendChild(this.toastContainer);
        }
        return this.toastContainer;
    }

    getToastIcon(type) {
        const icons = {
            'success': 'bi-check-circle-fill',
            'error': 'bi-x-circle-fill',
            'warning': 'bi-exclamation-triangle-fill',
            'info': 'bi-info-circle-fill'
        };
        return icons[type] || icons['info'];
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showElement(elementId) {
        document.getElementById(elementId).classList.remove('d-none');
    }

    hideElement(elementId) {
        document.getElementById(elementId).classList.add('d-none');
    }

    updateStatus(lockStatus, editStatus) {
        if (document.getElementById('lockStatus'))
            document.getElementById('lockStatus').innerHTML = lockStatus;
        if (document.getElementById('editStatus'))
            document.getElementById('editStatus').innerHTML = editStatus;
    }
}

module.exports = UIManager;
