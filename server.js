const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

// Configurações
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const SESSION_TIMEOUT = 10 * 60 * 1000; // 10 minutos

// Criar diretório de uploads se não existir
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Inicializar Express e Socket.io
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Servir arquivos estáticos

// Redirecionar raiz para paginas/index.html
app.get('/', (req, res) => {
    res.redirect('/paginas/index.html');
});

// Armazenamento em memória
const sessions = new Map(); // sessionId -> { code, createdAt, files[], attendantSocket }
const codeToSession = new Map(); // code -> sessionId

// Configurar Multer para upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const sessionId = req.params.sessionId;
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `${sessionId}-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de arquivo não permitido'));
        }
    }
});

// Função para gerar código de 4 dígitos
function generateCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// Função para limpar sessão expirada
function cleanupSession(sessionId) {
    const session = sessions.get(sessionId);
    if (session) {
        // Deletar todos os arquivos da sessão
        if (session.files && session.files.length > 0) {
            session.files.forEach(fileInfo => {
                const filePath = path.join(UPLOAD_DIR, fileInfo.filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`🗑️  Arquivo deletado: ${fileInfo.originalName}`);
                }
            });
        }

        // Remover do mapeamento de códigos
        codeToSession.delete(session.code);

        // Remover sessão
        sessions.delete(sessionId);
        console.log(`⏱️  Sessão expirada: ${sessionId}`);
    }
}

// Timer de limpeza automática (verifica a cada 1 minuto)
setInterval(() => {
    const now = Date.now();
    sessions.forEach((session, sessionId) => {
        if (now - session.createdAt > SESSION_TIMEOUT) {
            cleanupSession(sessionId);
        }
    });
}, 60 * 1000);

// ===== ROTAS API =====

// Criar nova sessão
app.post('/api/session', (req, res) => {
    const sessionId = uuidv4();
    const code = generateCode();

    const session = {
        code: code,
        createdAt: Date.now(),
        files: [],
        attendantSocket: null
    };

    sessions.set(sessionId, session);
    codeToSession.set(code, sessionId);

    console.log(`✅ Nova sessão criada: ${sessionId} (código: ${code})`);

    // Obter o host da requisição dinamicamente para suportar IPs locais e domínios reais
    const host = req.get('host') || `localhost:${PORT}`;
    const protocol = req.protocol; // http ou https

    res.json({
        sessionId: sessionId,
        code: code,
        url: `${protocol}://${host}/paginas/enviar-arquivo.html?session=${sessionId}`
    });
});

// Validar código e retornar sessionId
app.get('/api/session/:code', (req, res) => {
    const code = req.params.code;
    const sessionId = codeToSession.get(code);

    if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId);

        // Verificar se não expirou
        if (Date.now() - session.createdAt > SESSION_TIMEOUT) {
            cleanupSession(sessionId);
            return res.status(410).json({ error: 'Sessão expirada' });
        }

        res.json({
            sessionId: sessionId,
            valid: true
        });
    } else {
        res.status(404).json({ error: 'Código inválido' });
    }
});

// Upload de arquivos (até 5)
app.post('/api/upload/:sessionId', upload.array('files', 5), (req, res) => {
    const sessionId = req.params.sessionId;
    const session = sessions.get(sessionId);

    if (!session) {
        return res.status(404).json({ error: 'Sessão não encontrada' });
    }

    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    // Armazenar todos os arquivos na sessão
    const uploadedFiles = req.files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype
    }));

    session.files = session.files.concat(uploadedFiles);

    console.log(`📤 ${req.files.length} arquivo(s) recebido(s):`);
    req.files.forEach(f => console.log(`   - ${f.originalname} (${f.size} bytes)`));

    // Emitir evento via Socket.io para o atendente
    if (session.attendantSocket) {
        io.to(session.attendantSocket).emit('files-received', {
            files: uploadedFiles,
            sessionId: sessionId
        });
        console.log(`🔔 Notificação enviada ao atendente`);
    }

    res.json({
        success: true,
        files: uploadedFiles
    });
});

// Download de arquivo por índice
app.get('/api/download/:sessionId/:fileIndex?', (req, res) => {
    const sessionId = req.params.sessionId;
    const fileIndex = parseInt(req.params.fileIndex || '0', 10);
    const session = sessions.get(sessionId);

    if (!session || !session.files || session.files.length === 0) {
        return res.status(404).json({ error: 'Arquivo não encontrado' });
    }

    const fileInfo = session.files[fileIndex];
    if (!fileInfo) {
        return res.status(404).json({ error: 'Índice de arquivo inválido' });
    }

    const filePath = path.join(UPLOAD_DIR, fileInfo.filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Arquivo não encontrado no servidor' });
    }

    console.log(`📥 Download iniciado: ${fileInfo.originalName}`);

    res.download(filePath, fileInfo.originalName, (err) => {
        if (err) {
            console.error('Erro no download:', err);
        } else {
            console.log(`✅ Download concluído: ${fileInfo.originalName}`);
        }
    });
});

// ===== WEBSOCKET =====

io.on('connection', (socket) => {
    console.log(`🔌 Cliente conectado: ${socket.id}`);

    // Atendente entra na sala da sessão
    socket.on('join-session', (sessionId) => {
        const session = sessions.get(sessionId);

        if (session) {
            socket.join(sessionId);
            session.attendantSocket = socket.id;
            console.log(`👤 Atendente entrou na sessão: ${sessionId}`);

            socket.emit('session-joined', { sessionId });
        } else {
            socket.emit('session-error', { error: 'Sessão não encontrada' });
        }
    });

    // Cliente (emissor) entra na sala
    socket.on('join-as-sender', (sessionId) => {
        socket.join(sessionId);
        console.log(`📱 Cliente emissor entrou na sessão: ${sessionId}`);
        socket.emit('joined-as-sender', { sessionId });
    });

    socket.on('disconnect', () => {
        console.log(`🔌 Cliente desconectado: ${socket.id}`);
    });
});

// ===== INICIAR SERVIDOR =====

server.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║     🚀 Senda Backend Running!           ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
    console.log(`📍 Servidor: http://localhost:${PORT}`);
    console.log(`🔌 WebSocket: Ativo`);
    console.log(`📁 Uploads: ${UPLOAD_DIR}`);
    console.log(`⏱️  Timeout: ${SESSION_TIMEOUT / 1000 / 60} minutos`);
    console.log('');
    console.log('Pronto para receber conexões! 🎉');
    console.log('');
});

// Tratamento de erros
process.on('uncaughtException', (error) => {
    console.error('❌ Erro não capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promise rejeitada:', reason);
});
