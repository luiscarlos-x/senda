// Senda - Send File (Versao Simplificada)

const BACKEND_URL = window.location.origin;
let socket = null;
let selectedFiles = [];
let currentSessionId = null;
let html5QrCode = null; // QR Code scanner instance

let isBusinessSession = false;
let sessionLgpdZeroStorage = false;

window.addEventListener('load', () => {
    try {
        if (typeof io !== 'undefined') {
            socket = io(BACKEND_URL);
            socket.on('connect', () => {
                console.log('Socket OK');
                checkUrlParameters();
            });
            socket.on('joined-as-sender', onJoinedAsSender);
            socket.on('attendant-status', onAttendantStatus);
            socket.on('sender-error', (data) => alert('Erro: ' + data.error));
        }
    } catch (e) {
        console.warn('Socket.io nao disponivel:', e);
    }

    if (document.getElementById('fileInput')) {
        setupFileUpload();
    }
});

function checkUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionParam = urlParams.get('session');
    const businessParam = urlParams.get('business');
    const deskParam = urlParams.get('desk');

    if (businessParam && deskParam) {
        // Conexão business direta
        currentSessionId = `business_${businessParam}_${deskParam}`;
        isBusinessSession = true;
        
        console.log(`📡 Conectando à sessão corporativa: ${currentSessionId}`);
        showLoadingConnectionState();
        
        socket.emit('join-as-sender', {
            businessId: businessParam,
            deskId: deskParam
        });
    } else if (sessionParam) {
        // Conexão grátis por link direto
        currentSessionId = sessionParam;
        isBusinessSession = false;
        
        console.log(`📡 Conectando à sessão grátis: ${currentSessionId}`);
        socket.emit('join-as-sender', sessionParam);
    }
}

function onJoinedAsSender(data) {
    currentSessionId = data.sessionId;
    isBusinessSession = !!data.isBusiness;
    sessionLgpdZeroStorage = !!data.lgpdZeroStorage;
    
    updateConnectionUI();
    goToUploadStep();
}

function onAttendantStatus(data) {
    if (data.online) {
        console.log("Atendente está online!");
    } else {
        showAttendantOfflineState();
    }
}

function showLoadingConnectionState() {
    document.getElementById('freeHero').style.display = 'none';
    document.getElementById('freeMethods').style.display = 'none';
    document.getElementById('corporateStatusArea').style.display = 'block';
    document.getElementById('corporateLoading').style.display = 'block';
    document.getElementById('corporateOffline').style.display = 'none';
}

function showAttendantOfflineState() {
    document.getElementById('freeHero').style.display = 'none';
    document.getElementById('freeMethods').style.display = 'none';
    document.getElementById('corporateStatusArea').style.display = 'block';
    document.getElementById('corporateLoading').style.display = 'none';
    document.getElementById('corporateOffline').style.display = 'block';
}

function updateConnectionUI() {
    // Definir mensagem do badge de conexão
    const badgeText = document.getElementById('connectedBadgeText');
    if (badgeText) {
        badgeText.textContent = isBusinessSession ? 'Conexão Business Ativa' : 'Conectado';
    }

    // Configurar tarja de privacidade LGPD
    const lgpdBanner = document.getElementById('lgpdNoticeBanner');
    if (lgpdBanner) {
        lgpdBanner.style.display = sessionLgpdZeroStorage ? 'flex' : 'none';
    }

    // Ajustar dicas sobre limites de arquivos dependendo da conta
    const uploadHint = document.querySelector('.upload-hint');
    if (uploadHint) {
        if (isBusinessSession) {
            uploadHint.textContent = 'Até 5 arquivos • PDF, JPG, PNG ou DOCX • Máx. 100MB total';
        } else {
            uploadHint.textContent = 'Até 2 arquivos • PDF, JPG, PNG ou DOCX • Máx. 10MB total';
        }
    }
}



function showQRScanner() {
    document.querySelector('.connection-methods').style.display = 'none';
    document.getElementById('qrScannerSection').style.display = 'block';

    // Initialize html5-qrcode scanner
    if (typeof Html5Qrcode === 'undefined') {
        console.error('html5-qrcode library not loaded');
        return;
    }

    html5QrCode = new Html5Qrcode("qr-reader");

    const config = {
        fps: 25,
        qrbox: (width, height) => {
            const min = Math.min(width, height);
            const size = Math.floor(min * 0.7); // 70% da área do vídeo
            return { width: size, height: size };
        },
        aspectRatio: 1.0
    };

    // Start scanning with back camera (environment)
    html5QrCode.start(
        { facingMode: "environment" },
        config,
        onScanSuccess,
        onScanError
    ).catch(err => {
        console.error('Erro ao iniciar scanner:', err);

        // Try with front camera if back camera fails
        html5QrCode.start(
            { facingMode: "user" },
            config,
            onScanSuccess,
            onScanError
        ).catch(err2 => {
            console.error('Erro ao iniciar câmera frontal:', err2);
            alert('Não foi possível acessar a câmera. Verifique as permissões.');
        });
    });
}

function hideQRScanner() {
    // Stop scanner before hiding
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
            html5QrCode.clear();
            html5QrCode = null;
        }).catch(err => {
            console.error('Erro ao parar scanner:', err);
        });
    }

    document.querySelector('.connection-methods').style.display = 'flex';
    document.getElementById('qrScannerSection').style.display = 'none';
}

function onScanSuccess(decodedText, decodedResult) {
    console.log('QR Code detectado:', decodedText);

    // Stop scanner
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            html5QrCode.clear();
            html5QrCode = null;
        }).catch(err => console.error('Erro ao parar scanner:', err));
    }

    // Extract sessionId from URL
    try {
        const url = new URL(decodedText);
        const sessionParam = url.searchParams.get('session');
        const businessParam = url.searchParams.get('business');
        const deskParam = url.searchParams.get('desk');

        if (businessParam && deskParam) {
            // Sessão Business via QR Code
            currentSessionId = `business_${businessParam}_${deskParam}`;
            isBusinessSession = true;

            if (socket && socket.connected) {
                showLoadingConnectionState();
                socket.emit('join-as-sender', {
                    businessId: businessParam,
                    deskId: deskParam
                });
            } else {
                // Redirecionar para a página com os parâmetros na URL
                window.location.href = `${url.pathname}?business=${encodeURIComponent(businessParam)}&desk=${encodeURIComponent(deskParam)}`;
            }
        } else if (sessionParam) {
            // Sessão gratuita via QR Code
            currentSessionId = sessionParam;
            isBusinessSession = false;

            if (socket && socket.connected) {
                socket.emit('join-as-sender', sessionParam);
            }
            setTimeout(() => goToUploadStep(), 500);
        } else {
            alert('QR Code inválido. Não contém sessão.');
            setTimeout(() => hideQRScanner(), 2000);
        }
    } catch (e) {
        console.error('Erro ao processar QR Code:', e);
        alert('QR Code inválido ou formato incorreto.');
        setTimeout(() => hideQRScanner(), 2000);
    }
}

function onScanError(errorMessage) {
    // Ignore scan errors (happens continuously while scanning)
    // Only log critical errors
    if (errorMessage.includes('NotAllowedError') || errorMessage.includes('NotFoundError')) {
        console.error('Erro crítico de scanner:', errorMessage);
    }
}

function updateScannerMessage(message, type = 'info') {
    const msgElement = document.getElementById('scannerMessage');
    if (msgElement) {
        msgElement.textContent = message;
        msgElement.style.color = type === 'success' ? '#10B981' :
            type === 'error' ? '#EF4444' : '#64748b';
    }
}

function showScannerError(message) {
    updateScannerMessage(message, 'error');
    const helpElement = document.getElementById('scannerHelp');
    if (helpElement) {
        helpElement.textContent = '⚠️ ' + message;
        helpElement.style.color = '#EF4444';
    }
}

function goToUploadStep() {
    const step1 = document.getElementById('step1-content');
    const step2 = document.getElementById('step2-content');

    step1.classList.remove('active');
    step1.style.display = 'none';
    document.getElementById('step1-indicator').classList.remove('active');

    step2.classList.add('active');
    step2.style.display = 'block';
    document.getElementById('step2-indicator').classList.add('active');

    window.scrollTo(0, 0);
}

function setupFileUpload() {
    const input = document.getElementById('fileInput');
    const area = document.getElementById('uploadArea');

    input.addEventListener('change', handleFileSelect);
    area.addEventListener('dragover', (e) => {
        e.preventDefault();
        area.classList.add('dragover');
    });
    area.addEventListener('dragleave', () => area.classList.remove('dragover'));
    area.addEventListener('drop', (e) => {
        e.preventDefault();
        area.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            input.files = e.dataTransfer.files;
            handleFileSelect();
        }
    });
}

function handleFileSelect() {
    const input = document.getElementById('fileInput');
    const newFiles = Array.from(input.files);
    if (!newFiles.length) return;

    // Determinar limites dinâmicos
    const maxFiles = isBusinessSession ? 5 : 2;
    const maxFileSize = (isBusinessSession ? 100 : 10) * 1024 * 1024; // 100MB vs 10MB
    const maxFileSizeText = isBusinessSession ? '100MB' : '10MB';

    const valid = ['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

    for (const file of newFiles) {
        if (!valid.includes(file.type)) {
            showErrorPopup('Tipo de arquivo inválido', `O arquivo "${file.name}" não é suportado. Use apenas PDF, JPG, PNG ou DOCX.`);
            input.value = '';
            return;
        }
        if (file.size > maxFileSize) {
            showErrorPopup('Arquivo muito grande', `O arquivo "${file.name}" tem ${formatFileSize(file.size)}. O tamanho máximo permitido por arquivo é ${maxFileSizeText}.`);
            input.value = '';
            return;
        }
    }

    // Check total size (existing + new)
    const existingSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);
    const newSize = newFiles.reduce((sum, f) => sum + f.size, 0);
    const totalSize = existingSize + newSize;

    if (totalSize > maxFileSize) {
        const available = maxFileSize - existingSize;
        showErrorPopup('Limite de tamanho excedido', `O total de todos os arquivos não pode ultrapassar ${maxFileSizeText}. Você ainda tem ${formatFileSize(Math.max(0, available))} disponíveis.`);
        input.value = '';
        return;
    }

    // Limit total count
    const total = selectedFiles.length + newFiles.length;
    if (total > maxFiles) {
        const remaining = maxFiles - selectedFiles.length;
        showErrorPopup('Limite de arquivos', `Você pode enviar no máximo ${maxFiles} arquivos. ${remaining > 0 ? `Ainda pode adicionar ${remaining}.` : 'Remova algum para adicionar outro.'}`);
        input.value = '';
        return;
    }

    selectedFiles = selectedFiles.concat(newFiles);
    renderFilePreviews();
}

function renderFilePreviews() {
    const list = document.getElementById('filesPreviewList');
    const area = document.getElementById('uploadArea');
    const btn = document.getElementById('uploadButton');

    if (selectedFiles.length === 0) {
        list.style.display = 'none';
        list.innerHTML = '';
        area.style.display = 'block';
        btn.disabled = true;
        return;
    }

    list.style.display = 'block';
    area.style.display = selectedFiles.length >= 5 ? 'none' : 'block';
    btn.disabled = false;

    list.innerHTML = selectedFiles.map((file, i) => `
        <div class="file-preview">
            <div class="file-icon">${getFileIcon(file.type)}</div>
            <div class="file-info">
                <div class="file-name">${file.name}</div>
                <div class="file-size">${formatFileSize(file.size)}</div>
            </div>
            <button class="file-remove" onclick="removeFileAt(${i})">
                <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                </svg>
            </button>
        </div>
    `).join('');
}

function removeFileAt(index) {
    selectedFiles.splice(index, 1);
    document.getElementById('fileInput').value = '';
    renderFilePreviews();
}

async function uploadFile() {
    if (!selectedFiles.length || !currentSessionId) return alert('Sessão inválida');

    playSendSound();

    const btn = document.getElementById('uploadButton');
    const prog = document.getElementById('uploadProgress');

    btn.disabled = true;
    btn.style.display = 'none';
    prog.style.display = 'block';

    try {
        const formData = new FormData();
        selectedFiles.forEach(file => formData.append('files', file));

        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const pct = Math.round((e.loaded / e.total) * 100);
                document.getElementById('progressFill').style.width = pct + '%';
                document.getElementById('progressText').textContent = `Enviando ${selectedFiles.length} arquivo(s)... ${pct}%`;
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                showUploadSuccess();
            } else {
                throw new Error('Upload falhou');
            }
        });

        xhr.addEventListener('error', () => { throw new Error('Erro de rede'); });

        xhr.open('POST', `${BACKEND_URL}/api/upload/${currentSessionId}`);
        xhr.send(formData);

    } catch (e) {
        alert('Erro ao enviar arquivos');
        btn.disabled = false;
        btn.style.display = 'inline-flex';
        prog.style.display = 'none';
    }
}

function showUploadSuccess() {
    const count = selectedFiles.length;
    document.getElementById('uploadProgress').innerHTML = `
        <div style="text-align:center; padding:2rem;">
            <svg viewBox="0 0 64 64" fill="none" style="width:80px; height:80px; color:#5F6F52; margin:0 auto 1rem;">
                <circle cx="32" cy="32" r="28" stroke="currentColor" stroke-width="3"/>
                <path d="M20 32L28 40L44 24" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
            </svg>
            <h2 style="color:#5F6F52; margin-bottom:1rem;">${count} arquivo${count > 1 ? 's' : ''} enviado${count > 1 ? 's' : ''}!</h2>
            <p style="color:#6B6B6B; margin-bottom:1.5rem;">O atendente recebeu com sucesso</p>
            <button onclick="window.location.href='/'" style="background:#5F6F52; color:white; border:none; border-radius:12px; padding:1rem 2rem; font-weight:600; cursor:pointer;">Voltar</button>
        </div>
    `;
}

function formatFileSize(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
}

function getFileIcon(t) {
    if (t.includes('pdf')) return '📄';
    if (t.includes('image')) return '🖼️';
    if (t.includes('word')) return '📝';
    return '📎';
}

function playSendSound() {
    try {
        const audio = new Audio('../audios/sound02.mp3');
        audio.volume = 0.9; // Volume moderado
        audio.play().catch(e => console.warn('Não foi possível tocar o som:', e));
    } catch (e) {
        console.warn('Erro ao tocar som:', e);
    }
}

function showErrorPopup(title, message) {
    const existing = document.querySelector('.error-popup-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'error-popup-overlay';
    overlay.innerHTML = `
        <div class="error-popup">
            <div class="error-popup-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
            </div>
            <h3 class="error-popup-title">${title}</h3>
            <p class="error-popup-message">${message}</p>
            <button class="error-popup-button" onclick="closeErrorPopup()">Entendi</button>
        </div>
    `;
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeErrorPopup();
    });
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));
}

function closeErrorPopup() {
    const overlay = document.querySelector('.error-popup-overlay');
    if (overlay) {
        overlay.classList.remove('show');
        setTimeout(() => overlay.remove(), 300);
    }
}
