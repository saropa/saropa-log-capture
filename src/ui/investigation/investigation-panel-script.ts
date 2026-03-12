/** Client-side script for the investigation panel webview. */
export function getInvestigationPanelScript(): string {
    return /* js */ `
(function() {
    const vscode = acquireVsCodeApi();
    let searchTimeout = null;

    document.addEventListener('click', (e) => {
        const target = e.target;
        
        if (target.closest('.close-btn')) {
            vscode.postMessage({ type: 'close' });
            return;
        }
        
        if (target.closest('.add-source-btn')) {
            vscode.postMessage({ type: 'addSource' });
            return;
        }
        
        if (target.closest('.unpin-btn')) {
            const path = target.closest('.unpin-btn').dataset.path;
            if (path) {
                vscode.postMessage({ type: 'removeSource', path });
            }
            return;
        }
        
        if (target.closest('.source-item') && !target.closest('.unpin-btn')) {
            const path = target.closest('.source-item').dataset.path;
            if (path) {
                vscode.postMessage({ type: 'openSource', path });
            }
            return;
        }
        
        if (target.closest('.result-item')) {
            const item = target.closest('.result-item');
            const path = item.dataset.path;
            const line = parseInt(item.dataset.line, 10);
            if (path) {
                vscode.postMessage({ type: 'openResult', path, line });
            }
            return;
        }
        
        if (target.closest('.export-btn')) {
            vscode.postMessage({ type: 'export' });
            return;
        }
        
        if (target.closest('.report-btn')) {
            vscode.postMessage({ type: 'generateReport' });
            return;
        }
        
        if (target.closest('.create-btn')) {
            vscode.postMessage({ type: 'create' });
            return;
        }
        
        if (target.closest('.search-clear')) {
            const input = document.querySelector('.search-input');
            if (input) {
                input.value = '';
                input.focus();
                vscode.postMessage({ type: 'search', query: '' });
            }
            return;
        }
    });

    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                vscode.postMessage({ type: 'search', query: e.target.value });
            }, 300);
        });
        
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.target.value = '';
                vscode.postMessage({ type: 'search', query: '' });
            }
        });
    }

    const notesTextarea = document.querySelector('.notes-textarea');
    if (notesTextarea) {
        let notesTimeout = null;
        notesTextarea.addEventListener('input', (e) => {
            clearTimeout(notesTimeout);
            notesTimeout = setTimeout(() => {
                vscode.postMessage({ type: 'updateNotes', notes: e.target.value });
            }, 500);
        });
    }

    window.addEventListener('message', (event) => {
        const message = event.data;
        if (message.type === 'searchResults') {
            const container = document.querySelector('.results-content');
            if (container) {
                container.innerHTML = message.html;
            }
        }
    });
})();
`;
}
