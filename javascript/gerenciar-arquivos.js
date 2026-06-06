// Senda - Gerenciar Arquivos (Business File Manager)

const BACKEND_URL = window.location.origin;
let loggedBusinessId = null;
let loggedCompanyName = null;
let sessionsData = [];

// SVG da pasta verde (reutilizado em múltiplos lugares)
const FOLDER_SVG = `<svg viewBox="0 0 80 64" fill="none" xmlns="http://www.w3.org/2000/svg" class="folder-icon-svg">
    <path d="M4 12C4 8.68629 6.68629 6 10 6H28L36 16H70C73.3137 16 76 18.6863 76 22V52C76 55.3137 73.3137 58 70 58H10C6.68629 58 4 55.3137 4 52V12Z" fill="#8FB87A"/>
    <path d="M4 22C4 18.6863 6.68629 16 10 16H70C73.3137 16 76 18.6863 76 22V52C76 55.3137 73.3137 58 70 58H10C6.68629 58 4 55.3137 4 52V22Z" fill="#6B9F5B"/>
    <path d="M4 24C4 20.6863 6.68629 18 10 18H70C73.3137 18 76 20.6863 76 24V52C76 55.3137 73.3137 58 70 58H10C6.68629 58 4 55.3137 4 52V24Z" fill="#5F8F50"/>
</svg>`;

const FOLDER_SVG_SMALL = `<svg viewBox="0 0 80 64" fill="none" xmlns="http://www.w3.org/2000/svg" class="file-browser-folder-icon">
    <path d="M4 12C4 8.68629 6.68629 6 10 6H28L36 16H70C73.3137 16 76 18.6863 76 22V52C76 55.3137 73.3137 58 70 58H10C6.68629 58 4 55.3137 4 52V12Z" fill="#8FB87A"/>
    <path d="M4 22C4 18.6863 6.68629 16 10 16H70C73.3137 16 76 18.6863 76 22V52C76 55.3137 73.3137 58 70 58H10C6.68629 58 4 55.3137 4 52V22Z" fill="#6B9F5B"/>
    <path d="M4 24C4 20.6863 6.68629 18 10 18H70C73.3137 18 76 20.6863 76 24V52C76 55.3137 73.3137 58 70 58H10C6.68629 58 4 55.3137 4 52V24Z" fill="#5F8F50"/>
</svg>`;

window.addEventListener('load', async () => {
    // Verificar autenticação
    loggedBusinessId = localStorage.getItem('senda_business_id');
    loggedCompanyName = localStorage.getItem('senda_company_name');

    if (!loggedBusinessId) {
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('companyBadge').textContent = loggedCompanyName || 'Empresa';

    await loadFiles();
});

async function loadFiles() {
    const grid = document.getElementById('foldersGrid');
    const emptyState = document.getElementById('emptyState');
    const loadingState = document.getElementById('loadingState');

    loadingState.style.display = 'flex';
    grid.style.display = 'none';
    emptyState.style.display = 'none';

    try {
        const res = await fetch(`${BACKEND_URL}/api/business/files/${loggedBusinessId}`);
        if (!res.ok) throw new Error('Erro ao carregar arquivos');
        const data = await res.json();

        loadingState.style.display = 'none';

        if (!data.persistenceEnabled) {
            emptyState.style.display = 'block';
            document.getElementById('emptyStateTitle').textContent = 'Persistência desativada';
            document.getElementById('emptyStateText').textContent = 'Ative o "Modo Persistência de Dados" nas configurações para salvar arquivos.';
            return;
        }

        sessionsData = data.sessions || [];

        if (sessionsData.length === 0) {
            emptyState.style.display = 'block';
            document.getElementById('emptyStateTitle').textContent = 'Nenhum arquivo salvo';
            document.getElementById('emptyStateText').textContent = 'Os arquivos recebidos nas sessões aparecerão aqui organizados por pasta.';
            return;
        }

        renderFolders();

    } catch (e) {
        console.error('Erro ao carregar arquivos:', e);
        loadingState.style.display = 'none';
        emptyState.style.display = 'block';
        document.getElementById('emptyStateTitle').textContent = 'Erro ao carregar';
        document.getElementById('emptyStateText').textContent = 'Não foi possível conectar ao servidor.';
    }
}

function renderFolders() {
    const grid = document.getElementById('foldersGrid');
    const emptyState = document.getElementById('emptyState');

    if (sessionsData.length === 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    grid.style.display = 'grid';
    emptyState.style.display = 'none';

    grid.innerHTML = sessionsData.map((session, index) => {
        const count = session.files.length;
        return `
            <div class="folder-card" onclick="openFolder(${index})" title="${session.deskName}">
                ${FOLDER_SVG}
                <span class="folder-name">${session.deskName}</span>
                <span class="folder-file-count">${count} arquivo${count !== 1 ? 's' : ''}</span>
            </div>
        `;
    }).join('');
}

function openFolder(sessionIndex) {
    const session = sessionsData[sessionIndex];
    if (!session) return;

    // Remover overlay existente se houver
    const existing = document.getElementById('fileBrowserOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'fileBrowserOverlay';
    overlay.className = 'file-browser-overlay';

    overlay.innerHTML = `
        <div class="file-browser-panel">
            <div class="file-browser-header">
                <div class="file-browser-header-left">
                    ${FOLDER_SVG_SMALL}
                    <span class="file-browser-title">${session.deskName}</span>
                </div>
                <button class="file-browser-close" onclick="closeFileBrowser()" aria-label="Fechar">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="file-browser-body" id="fileBrowserBody">
                ${renderFileItems(session)}
            </div>
        </div>
    `;

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeFileBrowser();
    });

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));
}

function renderFileItems(session) {
    if (!session.files || session.files.length === 0) {
        return `<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">Nenhum arquivo nesta sessão</div>`;
    }

    return session.files.map(file => `
        <div class="manage-file-item">
            <div class="manage-file-icon">${getFileIcon(file.mimeType)}</div>
            <div class="manage-file-info">
                <div class="manage-file-name" title="${file.originalName}">${file.originalName}</div>
                <div class="manage-file-meta">${formatFileSize(file.size)}</div>
            </div>
            <div class="manage-file-actions">
                <button class="manage-file-btn manage-file-btn-download" title="Baixar" onclick="downloadManagedFile('${session.deskId}', '${file.filename}')">
                    <svg viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/>
                    </svg>
                </button>
                <button class="manage-file-btn manage-file-btn-delete" title="Deletar" onclick="deleteManagedFile('${session.deskId}', '${file.filename}')">
                    <svg viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

function downloadManagedFile(deskId, filename) {
    window.open(`${BACKEND_URL}/api/business/files/${loggedBusinessId}/${deskId}/${encodeURIComponent(filename)}`, '_blank');
}

async function deleteManagedFile(deskId, filename) {
    if (!confirm('Tem certeza que deseja deletar este arquivo permanentemente?')) return;

    try {
        const res = await fetch(`${BACKEND_URL}/api/business/files/${loggedBusinessId}/${deskId}/${encodeURIComponent(filename)}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            showToast('Arquivo deletado!');
            // Recarregar dados e atualizar a UI
            await loadFiles();
            // Se o painel de arquivos está aberto, atualizar ou fechar
            const sessionData = sessionsData.find(s => s.deskId === deskId);
            if (sessionData) {
                const body = document.getElementById('fileBrowserBody');
                if (body) {
                    body.innerHTML = renderFileItems(sessionData);
                }
            } else {
                closeFileBrowser();
            }
        } else {
            const err = await res.json();
            alert(err.error || 'Erro ao deletar arquivo.');
        }
    } catch (e) {
        console.error('Erro ao deletar:', e);
        alert('Erro ao conectar com o servidor.');
    }
}

function closeFileBrowser() {
    const overlay = document.getElementById('fileBrowserOverlay');
    if (overlay) {
        overlay.classList.remove('show');
        setTimeout(() => overlay.remove(), 250);
    }
}

// Utilitários
function formatFileSize(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
}

function getFileIcon(t) {
    if (t?.includes('pdf')) return '📄';
    if (t?.includes('image')) return '🖼️';
    if (t?.includes('word')) return '📝';
    return '📎';
}

function showToast(message) {
    const existing = document.querySelector('.toast-popup');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-popup';
    toast.innerHTML = `
        <svg viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
        </svg>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}
