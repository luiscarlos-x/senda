// Senda - Receive File

const BACKEND_URL = window.location.origin;
let socket = null;
let currentSession = null;

window.addEventListener('load', () => {
    if (typeof io !== 'undefined') {
        socket = io(BACKEND_URL);
        socket.on('connect', () => console.log('✅ Socket conectado'));
        socket.on('files-received', onFilesReceived);
    }
});

async function generateSession() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/session`, { method: 'POST' });
        const data = await res.json();

        currentSession = data;
        document.getElementById('sessionCode').textContent = data.code;

        const qr = document.getElementById('qrcode');
        qr.innerHTML = '';
        new QRCode(qr, { text: data.url, width: 240, height: 240 });

        // CONECTAR AO WEBSOCKET NA SALA
        if (socket && socket.connected) {
            console.log('📡 Join-session:', data.sessionId);
            socket.emit('join-session', data.sessionId);
        } else {
            console.warn('⚠️  Socket offline - recarregue a página');
        }

        showState('activeSessionState');

    } catch (e) {
        alert('Erro: ' + e.message);
    }
}

function onFilesReceived(data) {
    console.log('📥 ARQUIVOS RECEBIDOS!', data);

    const container = document.getElementById('receivedFilesList');
    if (container) {
        container.innerHTML = data.files.map((file, i) => `
            <div class="received-file-item">
                <div class="received-file-icon">${getFileIcon(file.mimeType)}</div>
                <div class="received-file-info">
                    <div class="received-file-name">${file.originalName}</div>
                    <div class="received-file-size">${formatFileSize(file.size)}</div>
                </div>
                <button class="download-file-button" onclick="downloadFile(${i})">
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
    // Remove existing toast if any
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

    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('show'));

    // Auto remove
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
