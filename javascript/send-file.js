// Senda - Send File (Versao Simplificada)

const BACKEND_URL = window.location.origin;
let socket = null;
let codeDigits = ['', '', '', ''];
let selectedFiles = [];
let currentSessionId = null;
let html5QrCode = null; // QR Code scanner instance

window.addEventListener('load', () => {
    try {
        if (typeof io !== 'undefined') {
            socket = io(BACKEND_URL);
            socket.on('connect', () => console.log('Socket OK'));
        }
    } catch (e) {
        console.warn('Socket.io nao disponivel:', e);
    }

    if (document.getElementById('fileInput')) {
        setupFileUpload();
    }
});

function showCodeInput() {
    document.querySelector('.connection-methods').style.display = 'none';
    document.getElementById('codeInputSection').style.display = 'block';
    setTimeout(() => document.getElementById('digit1')?.focus(), 100);
    setupCodeInputs();
}

function hideCodeInput() {
    document.querySelector('.connection-methods').style.display = 'grid';
    document.getElementById('codeInputSection').style.display = 'none';
    clearCode();
}

function setupCodeInputs() {
    const digits = document.querySelectorAll('.code-digit');

    digits.forEach((digit, i) => {
        digit.addEventListener('input', (e) => {
            const val = e.target.value;
            if (!/^\d$/.test(val)) {
                e.target.value = '';
                return;
            }
            codeDigits[i] = val;
            e.target.classList.add('filled');
            if (val && i < 3) digits[i + 1].focus();
            updateConnectButton();
        });

        digit.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace') {
                if (!digit.value && i > 0) {
                    digits[i - 1].focus();
                    digits[i - 1].value = '';
                    digits[i - 1].classList.remove('filled');
                    codeDigits[i - 1] = '';
                } else {
                    digit.value = '';
                    digit.classList.remove('filled');
                    codeDigits[i] = '';
                }
                updateConnectButton();
                e.preventDefault();
            }
        });

        digit.addEventListener('paste', (e) => {
            e.preventDefault();
            const nums = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
            nums.split('').forEach((n, idx) => {
                if (idx < 4) {
                    digits[idx].value = n;
                    digits[idx].classList.add('filled');
                    codeDigits[idx] = n;
                }
            });
            updateConnectButton();
        });
    });
}

function updateConnectButton() {
    document.getElementById('connectButton').disabled = !codeDigits.every(d => d !== '');
}

function clearCode() {
    codeDigits = ['', '', '', ''];
    document.querySelectorAll('.code-digit').forEach(d => {
        d.value = '';
        d.classList.remove('filled');
    });
    document.getElementById('codeError').style.display = 'none';
    updateConnectButton();
}

async function validateCode() {
    const code = codeDigits.join('');
    const err = document.getElementById('codeError');
    const errMsg = document.getElementById('codeErrorMessage');

    try {
        const res = await fetch(`${BACKEND_URL}/api/session/${code}`);

        if (res.ok) {
            const data = await res.json();
            currentSessionId = data.sessionId;

            if (socket?.connected) socket.emit('join-as-sender', data.sessionId);

            goToUploadStep();
        } else {
            err.style.display = 'flex';
            errMsg.textContent = 'Codigo invalido ou expirado';

            setTimeout(() => {
                clearCode();
                document.getElementById('digit1')?.focus();
            }, 1500);
        }
    } catch (e) {
        err.style.display = 'flex';
        errMsg.textContent = 'Erro ao conectar. Servidor rodando?';
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
        fps: 10,
        aspectRatio: 1.777778 // 16:9
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

    document.querySelector('.connection-methods').style.display = 'grid';
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

        if (sessionParam) {
            // Validate session and proceed
            currentSessionId = sessionParam;
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

    const valid = ['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

    for (const file of newFiles) {
        if (!valid.includes(file.type)) {
            showErrorPopup('Tipo de arquivo inválido', `O arquivo "${file.name}" não é suportado. Use apenas PDF, JPG, PNG ou DOCX.`);
            input.value = '';
            return;
        }
        if (file.size > 50 * 1024 * 1024) {
            showErrorPopup('Arquivo muito grande', `O arquivo "${file.name}" tem ${formatFileSize(file.size)}. O tamanho máximo permitido é 50MB.`);
            input.value = '';
            return;
        }
    }

    // Check total size (existing + new) <= 50MB
    const existingSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);
    const newSize = newFiles.reduce((sum, f) => sum + f.size, 0);
    const totalSize = existingSize + newSize;

    if (totalSize > 50 * 1024 * 1024) {
        const available = 50 * 1024 * 1024 - existingSize;
        showErrorPopup('Limite de tamanho excedido', `O total de todos os arquivos não pode ultrapassar 50MB. Você ainda tem ${formatFileSize(Math.max(0, available))} disponíveis.`);
        input.value = '';
        return;
    }

    // Limit to 5 total
    const total = selectedFiles.length + newFiles.length;
    if (total > 5) {
        const remaining = 5 - selectedFiles.length;
        showErrorPopup('Limite de arquivos', `Você pode enviar no máximo 5 arquivos. ${remaining > 0 ? `Ainda pode adicionar ${remaining}.` : 'Remova algum para adicionar outro.'}`);
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
