/** Client-side script for the investigation panel webview. */
export function getInvestigationPanelScript(): string {
    return /* js */ `
(function() {
    const vscode = acquireVsCodeApi();
    let searchTimeout = null;

    function getSearchOptions() {
        const caseSensitive = document.querySelector('.option-case-sensitive');
        const useRegex = document.querySelector('.option-use-regex');
        const contextLines = document.querySelector('.option-context-lines');
        return {
            caseSensitive: caseSensitive?.checked ?? false,
            useRegex: useRegex?.checked ?? false,
            contextLines: parseInt(contextLines?.value ?? '2', 10),
        };
    }

    function doSearch(query) {
        const options = getSearchOptions();
        vscode.postMessage({ type: 'search', query, ...options });
    }

    function hideDropdowns() {
        document.querySelector('.search-history-dropdown')?.classList.add('hidden');
        document.querySelector('.search-options')?.classList.add('hidden');
    }

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
        
        if (target.closest('.result-item') || target.closest('.result-context')) {
            const item = target.closest('.result-item') || target.closest('.result-context');
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
                doSearch('');
            }
            hideDropdowns();
            return;
        }

        if (target.closest('.search-history-btn')) {
            const dropdown = document.querySelector('.search-history-dropdown');
            const options = document.querySelector('.search-options');
            options?.classList.add('hidden');
            if (dropdown) {
                dropdown.classList.toggle('hidden');
                if (!dropdown.classList.contains('hidden')) {
                    vscode.postMessage({ type: 'getSearchHistory' });
                }
            }
            return;
        }

        if (target.closest('.search-options-btn')) {
            const options = document.querySelector('.search-options');
            const dropdown = document.querySelector('.search-history-dropdown');
            dropdown?.classList.add('hidden');
            options?.classList.toggle('hidden');
            return;
        }

        if (target.closest('.history-item')) {
            const query = target.closest('.history-item').dataset.query;
            const input = document.querySelector('.search-input');
            if (input && query) {
                input.value = query;
                doSearch(query);
            }
            hideDropdowns();
            return;
        }

        if (target.closest('.history-clear')) {
            vscode.postMessage({ type: 'clearSearchHistory' });
            hideDropdowns();
            return;
        }

        if (!target.closest('.search-section')) {
            hideDropdowns();
        }
    });

    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                doSearch(e.target.value);
            }, 300);
        });
        
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.target.value = '';
                doSearch('');
                hideDropdowns();
            }
            if (e.key === 'Enter') {
                clearTimeout(searchTimeout);
                doSearch(e.target.value);
            }
        });

        searchInput.addEventListener('focus', () => {
            hideDropdowns();
        });
    }

    const optionInputs = document.querySelectorAll('.search-option input');
    optionInputs.forEach(input => {
        input.addEventListener('change', () => {
            const query = document.querySelector('.search-input')?.value;
            if (query) {
                doSearch(query);
            }
        });
    });

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

        if (message.type === 'searchProgress') {
            const progress = document.querySelector('.search-progress');
            const fill = document.querySelector('.progress-fill');
            const text = document.querySelector('.progress-text');
            if (progress) {
                if (message.searching) {
                    progress.classList.remove('hidden');
                    if (fill && message.current && message.total) {
                        fill.style.width = ((message.current / message.total) * 100) + '%';
                    }
                    if (text) {
                        text.textContent = message.message || '';
                    }
                } else {
                    progress.classList.add('hidden');
                    if (fill) fill.style.width = '0%';
                }
            }
        }

        if (message.type === 'searchHistory') {
            const dropdown = document.querySelector('.search-history-dropdown');
            if (dropdown) {
                dropdown.innerHTML = message.html;
            }
        }
    });
})();
`;
}
