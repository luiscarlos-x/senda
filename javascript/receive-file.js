// Senda - Receive File (Suporte a Free e Business Mode)

const BACKEND_URL = window.location.origin;
let socket = null;
let currentSession = null;
let isBusinessMode = false;
let loggedBusinessId = null;
let loggedCompanyName = null;
let currentDesks = [];

window.addEventListener('load', async () => {
    // Verificar se há uma conta business conectada
    loggedBusinessId = localStorage.getItem('senda_business_id');
    loggedCompanyName = localStorage.getItem('senda_company_name');
    
    if (loggedBusinessId) {
        isBusinessMode = true;
        await setupBusinessUI();
    } else {
        isBusinessMode = false;
        setupFreeUI();
    }

    if (typeof io !== 'undefined') {
        socket = io(BACKEND_URL);
        socket.on('connect', () => {
            console.log('✅ Socket conectado');
            if (!currentSession) {
                initiateSession();
            }
        });
        socket.on('files-received', onFilesReceived);
        socket.on('session-error', (data) => alert('Erro na sessão: ' + data.error));
    }
});

// Configurar Interface para Usuário Livre
function setupFreeUI() {
    document.getElementById('businessUserInfo').style.display = 'none';
    document.getElementById('businessConfigArea').style.display = 'none';
    document.getElementById('sandwichMenuBtn').style.display = 'none';
    document.getElementById('waitingTitle').textContent = 'Receber Arquivo';
    document.getElementById('waitingSubtitle').textContent = 'Gere um QR Code temporário para receber documentos';
    document.getElementById('startSessionBtnText').textContent = 'Gerar QR Code e Código';
}

// Configurar Interface para Empresas (Business)
async function setupBusinessUI() {
    document.getElementById('businessUserInfo').style.display = 'flex';
    document.getElementById('companyBadge').textContent = loggedCompanyName;
    document.getElementById('businessConfigArea').style.display = 'flex';
    document.getElementById('sandwichMenuBtn').style.display = 'block';
    document.getElementById('waitingTitle').textContent = 'Central de Recebimento';
    document.getElementById('waitingSubtitle').textContent = 'Selecione o guichê de atendimento para conectar';
    document.getElementById('startSessionBtnText').textContent = 'Gerar QR Code';

    // Carregar configurações da empresa (guichês e LGPD)
    try {
        const res = await fetch(`${BACKEND_URL}/api/business/config/${loggedBusinessId}`);
        if (!res.ok) throw new Error('Erro ao carregar dados do guichê.');
        const config = await res.json();
        
        // Configurar toggle LGPD
        const lgpdCheckbox = document.getElementById('lgpdZeroStorage');
        lgpdCheckbox.checked = !!config.lgpdZeroStorage;
        
        currentDesks = config.desks || [];

        // Listener para salvar LGPD ao alternar
        lgpdCheckbox.onchange = async () => {
            await saveBusinessPreferences(lgpdCheckbox.checked, currentDesks);
        };

        // Popular guichês
        populateDesksSelector();

        // Ao alterar o guichê no dropdown, iniciar a sessão automaticamente
        const selector = document.getElementById('deskSelector');
        if (selector) {
            selector.onchange = () => {
                initiateSession();
            };
        }

        // Adicionar keydown listener para o input de guichê
        const nameInput = document.getElementById('newDeskName');
        if (nameInput) {
            nameInput.onkeydown = (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    addNewDesk();
                }
            };
        }

    } catch (e) {
        console.error(e);
        alert('Erro ao sincronizar dados com o servidor.');
    }
}

// Popular seletor de guichês
function populateDesksSelector(selectedId = null) {
    const selector = document.getElementById('deskSelector');
    if (!selector) return;
    
    selector.innerHTML = currentDesks.map(desk => 
        `<option value="${desk.id}">${desk.name}</option>`
    ).join('');

    if (selectedId) {
        selector.value = selectedId;
    }
}

// Adicionar novo guichê
async function addNewDesk() {
    const nameInput = document.getElementById('newDeskName');
    if (!nameInput) return;
    
    const deskName = nameInput.value.trim();
    if (!deskName) {
        showToast('Por favor, insira o nome do guichê.');
        return;
    }

    // Verificar se já existe um guichê com esse nome
    const exists = currentDesks.some(d => d.name.toLowerCase() === deskName.toLowerCase());
    if (exists) {
        showToast('Já existe um guichê com este nome.');
        return;
    }

    // Gerar um ID amigável e único baseado no timestamp
    const deskId = 'guiche-' + Date.now();
    
    const newDesk = {
        id: deskId,
        name: deskName,
        createdAt: Date.now()
    };

    currentDesks.push(newDesk);

    const lgpdCheckbox = document.getElementById('lgpdZeroStorage');
    const lgpdChecked = lgpdCheckbox ? lgpdCheckbox.checked : false;

    // Salvar no servidor
    try {
        const response = await fetch(`${BACKEND_URL}/api/business/config/${loggedBusinessId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lgpdZeroStorage: lgpdChecked, desks: currentDesks })
        });
        
        if (response.ok) {
            showToast('Guichê adicionado!');
            nameInput.value = '';
            populateDesksSelector(deskId); // Atualiza e seleciona o novo guichê
        } else {
            const err = await response.json();
            showToast(err.error || 'Erro ao adicionar guichê.');
            currentDesks.pop(); // Remove em caso de falha
        }
    } catch (e) {
        console.error('Erro ao adicionar guichê:', e);
        showToast('Erro ao conectar com o servidor.');
        currentDesks.pop();
    }
}

// Salvar preferências no servidor
async function saveBusinessPreferences(lgpdZeroStorage, desks) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/business/config/${loggedBusinessId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lgpdZeroStorage, desks })
        });
        if (response.ok) {
            showToast('Preferências salvas!');
        }
    } catch (e) {
        console.error('Erro ao salvar preferências:', e);
    }
}

// Logout
function logoutBusiness() {
    localStorage.removeItem('senda_business_id');
    localStorage.removeItem('senda_company_name');
    window.location.href = 'index.html';
}

// Alternar visibilidade do Menu Sanduíche (Sidebar Drawer)
function toggleSandwichMenu() {
    const sidebar = document.getElementById('settingsSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar && backdrop) {
        sidebar.classList.toggle('open');
        backdrop.classList.toggle('open');
    }
}

// Função de início unificada
async function initiateSession() {
    // Fechar o menu lateral de configurações, se aberto
    const sidebar = document.getElementById('settingsSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        backdrop.classList.remove('open');
    }

    if (isBusinessMode) {
        await startBusinessSession();
    } else {
        await generateFreeSession();
    }
}

// Iniciar Guichê Business
async function startBusinessSession() {
    const selector = document.getElementById('deskSelector');
    const selectedDeskId = selector.value;
    const selectedDeskName = selector.options[selector.selectedIndex].text;
    const lgpdCheckbox = document.getElementById('lgpdZeroStorage');

    const sessionId = `business_${loggedBusinessId}_${selectedDeskId}`;

    currentSession = {
        sessionId: sessionId,
        isBusiness: true,
        businessId: loggedBusinessId,
        deskId: selectedDeskId,
        deskName: selectedDeskName,
        lgpdZeroStorage: lgpdCheckbox.checked
    };

    // Conectar ao WebSocket na sala correspondente
    if (socket && socket.connected) {
        console.log('📡 Conectando ao canal guichê:', sessionId);
        socket.emit('join-session', {
            businessId: loggedBusinessId,
            deskId: selectedDeskId
        });
    } else {
        alert('Erro: Conexão offline. Recarregue a página.');
        return;
    }

    // Configurar o link do cliente e o QR Code
    const host = window.location.host;
    const protocol = window.location.protocol;
    const clientUrl = `${protocol}//${host}/paginas/enviar-arquivo.html?business=${loggedBusinessId}&desk=${selectedDeskId}`;

    // Gerar QR Code
    const qr = document.getElementById('qrcode');
    qr.innerHTML = '';
    new QRCode(qr, {
        text: clientUrl,
        width: 256,
        height: 256,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });

    // Ajustar visual da tela ativa
    document.getElementById('codeDisplayArea').style.display = 'none';
    document.getElementById('qrTitleText').textContent = `Escaneie o QR Code`;
    document.getElementById('sessionInfoBadgeText').textContent = `Ativo - ${selectedDeskName}`;
    document.getElementById('endSessionBtnText').textContent = 'Fechar Guichê';

    showState('activeSessionState');
}

// Iniciar Sessão Gratuita (Antiga)
async function generateFreeSession() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/session`, { method: 'POST' });
        const data = await res.json();

        currentSession = {
            sessionId: data.sessionId,
            isBusiness: false,
            lgpdZeroStorage: true // Gratuito é sempre efêmero (privacidade estrita)
        };
        
        document.getElementById('sessionCode').textContent = data.code;

        // Gerar QR Code
        const qr = document.getElementById('qrcode');
        qr.innerHTML = '';
        new QRCode(qr, {
            text: data.url,
            width: 256,
            height: 256,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });

        // Conectar ao WebSocket
        if (socket && socket.connected) {
            console.log('📡 Conectando à sala grátis:', data.sessionId);
            socket.emit('join-session', data.sessionId);
        } else {
            console.warn('⚠️ Socket offline');
        }

        // Ajustar visual da tela ativa para grátis
        document.getElementById('codeDisplayArea').style.display = 'block';
        document.getElementById('qrTitleText').textContent = 'Cliente pode escanear ou digitar o código';
        document.getElementById('sessionInfoBadgeText').textContent = 'Sessão temporária ativa - Aguardando arquivo';
        document.getElementById('endSessionBtnText').textContent = 'Encerrar sessão';

        showState('activeSessionState');

    } catch (e) {
        alert('Erro ao gerar sessão gratuita: ' + e.message);
    }
}

function onFilesReceived(data) {
    console.log('📥 Arquivos recebidos!', data);

    if (!data.files || data.files.length === 0) {
        document.getElementById('sessionInfoBadgeText').textContent = isBusinessMode 
            ? `Ativo - ${currentSession?.deskName || ''}` 
            : 'Sessão temporária ativa - Aguardando arquivo';
        showState('activeSessionState');
        return;
    }

    const isLgpd = !!data.lgpdZeroStorage;

    const container = document.getElementById('receivedFilesList');
    if (container) {
        container.innerHTML = data.files.map((file, i) => `
            <div class="received-file-item" style="border-color: ${isLgpd ? '#A4B494' : 'var(--warm-gray)'}; cursor: pointer;" onclick="showFileActions(${i}, '${file.originalName.replace(/'/g, "\\'")}')">
                <div class="received-file-icon">${getFileIcon(file.mimeType)}</div>
                <div class="received-file-info">
                    <div class="received-file-name">
                        ${file.originalName}
                        ${isLgpd ? ' <span style="font-size: 0.75rem; background-color: #E8F5E9; color: #2E7D32; padding: 2px 6px; border-radius: 4px; font-weight: 600; margin-left: 6px;">🔒 Efêmero (LGPD)</span>' : ''}
                    </div>
                    <div class="received-file-size">${formatFileSize(file.size)}</div>
                </div>
                <button class="download-file-button" onclick="event.stopPropagation(); downloadFile(${i})">
                    <svg viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/>
                    </svg>
                </button>
            </div>
        `).join('');
    }

    const countEl = document.getElementById('receivedFileCount');
    if (countEl) {
        const count = data.files.length;
        countEl.textContent = `${count} arquivo${count > 1 ? 's' : ''} recebido${count > 1 ? 's' : ''}`;
    }

    showState('fileReceivedState');
    playNotificationSound();
}

function copyCode() {
    const code = document.getElementById('sessionCode').textContent;
    navigator.clipboard.writeText(code);
    showToast('Código copiado!');
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

function endSession() {
    currentSession = null;
    showState('waitingState');
}

function downloadFile(index) {
    window.open(`${BACKEND_URL}/api/download/${currentSession.sessionId}/${index}`, '_blank');
}

function newSession() {
    currentSession = null;
    showState('waitingState');
}

function showState(id) {
    document.querySelectorAll('.session-state').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

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

function playNotificationSound() {
    try {
        const audio = new Audio('../audios/sound01.mp3');
        audio.volume = 0.5;
        audio.play().catch(e => console.warn('Não foi possível tocar o som:', e));
    } catch (e) {
        console.warn('Erro ao tocar som:', e);
    }
}

// Ações de arquivo: Deletar e Baixar
function showFileActions(index, fileName) {
    const existingModal = document.getElementById('fileActionsModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'fileActionsModal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '2000';
    modal.style.opacity = '0';
    modal.style.transition = 'opacity 0.25s ease';

    modal.innerHTML = `
        <div class="file-actions-dialog" style="
            background-color: white;
            border-radius: 16px;
            padding: 24px;
            width: 90%;
            max-width: 400px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
            transform: translateY(20px);
            transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            flex-direction: column;
            gap: 16px;
        ">
            <div style="display: flex; align-items: flex-start; gap: 12px; border-bottom: 1px solid var(--warm-gray, #e0e0e0); padding-bottom: 16px;">
                <div style="font-size: 2rem;">📎</div>
                <div style="flex: 1; min-width: 0;">
                    <h3 style="margin: 0; font-size: 1.15rem; font-weight: 600; color: var(--text-primary);">Ações do Arquivo</h3>
                    <p style="margin: 4px 0 0 0; font-size: 0.9rem; color: var(--text-secondary); word-break: break-all;">${fileName}</p>
                </div>
            </div>
            
            <button onclick="downloadFile(${index}); closeFileActionsModal();" style="
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                background-color: var(--sage-dark, #5F6F52);
                color: white;
                border: none;
                border-radius: 12px;
                padding: 14px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: background-color 0.2s;
            ">
                <svg viewBox="0 0 20 20" fill="currentColor" style="width: 20px; height: 20px;">
                    <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/>
                </svg>
                Baixar Arquivo
            </button>

            <button onclick="deleteFile(${index}); closeFileActionsModal();" style="
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                background-color: #FEE2E2;
                color: #DC2626;
                border: 2px solid #FCA5A5;
                border-radius: 12px;
                padding: 12px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: background-color 0.2s;
            ">
                <svg viewBox="0 0 20 20" fill="currentColor" style="width: 20px; height: 20px;">
                    <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
                </svg>
                Deletar Arquivo
            </button>

            <button onclick="closeFileActionsModal()" style="
                display: flex;
                align-items: center;
                justify-content: center;
                background-color: transparent;
                color: var(--text-secondary, #666);
                border: 1px solid var(--warm-gray, #ccc);
                border-radius: 12px;
                padding: 12px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: background-color 0.2s;
                margin-top: 4px;
            ">
                Cancelar
            </button>
        </div>
    `;

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeFileActionsModal();
    });

    document.body.appendChild(modal);

    const currentTheme = document.documentElement.getAttribute('data-theme');
    if (currentTheme === 'dark') {
        const dialog = modal.querySelector('.file-actions-dialog');
        dialog.style.backgroundColor = 'var(--cream, #1F2421)';
        dialog.style.borderColor = 'var(--warm-gray, #333)';
    }

    requestAnimationFrame(() => {
        modal.style.opacity = '1';
        modal.querySelector('.file-actions-dialog').style.transform = 'translateY(0)';
    });
}

function closeFileActionsModal() {
    const modal = document.getElementById('fileActionsModal');
    if (modal) {
        modal.style.opacity = '0';
        modal.querySelector('.file-actions-dialog').style.transform = 'translateY(20px)';
        setTimeout(() => modal.remove(), 250);
    }
}

async function deleteFile(index) {
    if (!currentSession) return;
    try {
        const response = await fetch(`${BACKEND_URL}/api/file/${currentSession.sessionId}/${index}`, {
            method: 'DELETE'
        });
        if (response.ok) {
            showToast('Arquivo deletado com sucesso!');
            const data = await response.json();
            
            if (data.files && data.files.length === 0) {
                document.getElementById('sessionInfoBadgeText').textContent = isBusinessMode 
                    ? `Ativo - ${currentSession.deskName}` 
                    : 'Sessão temporária ativa - Aguardando arquivo';
                showState('activeSessionState');
            } else {
                onFilesReceived(data);
            }
        } else {
            const err = await response.json();
            alert(err.error || 'Erro ao deletar arquivo.');
        }
    } catch (e) {
        console.error('Erro ao deletar arquivo:', e);
        alert('Erro ao conectar com o servidor.');
    }
}
