const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const Database = require('./database');

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
// Servir apenas as pastas públicas necessárias de forma explícita
// Protege arquivos sensíveis da raiz (server.js, database.js, package.json) e pastas confidenciais (data/, uploads/)
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/javascript', express.static(path.join(__dirname, 'javascript')));
app.use('/paginas', express.static(path.join(__dirname, 'paginas')));
app.use('/audios', express.static(path.join(__dirname, 'audios')));

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
        const sessionId = req.params.sessionId;
        let dest = UPLOAD_DIR;

        if (sessionId && sessionId.startsWith('business_')) {
            const raw = sessionId.substring("business_".length);
            const lastUnderscoreIndex = raw.lastIndexOf('_');
            if (lastUnderscoreIndex !== -1) {
                const businessId = raw.substring(0, lastUnderscoreIndex);
                const deskId = raw.substring(lastUnderscoreIndex + 1);
                
                // Buscar da sessão ativa primeiro
                let lgpdZeroStorage = false;
                const session = sessions.get(sessionId);
                if (session) {
                    lgpdZeroStorage = !!session.lgpdZeroStorage;
                } else {
                    const config = Database.getBusinessConfig(businessId);
                    if (config) {
                        lgpdZeroStorage = !!config.lgpdZeroStorage;
                    }
                }

                // Se a opção de salvar dados está ATIVADA (lgpdZeroStorage é false)
                if (!lgpdZeroStorage) {
                    dest = path.join(UPLOAD_DIR, businessId, deskId);
                }
            }
        }

        // Garantir que a pasta de destino exista
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        cb(null, dest);
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

                    // Limpar pastas vazias se o arquivo estiver em um subdiretório
                    const dirPath = path.dirname(filePath);
                    if (dirPath !== UPLOAD_DIR) {
                        try {
                            if (fs.existsSync(dirPath) && fs.readdirSync(dirPath).length === 0) {
                                fs.rmdirSync(dirPath);
                                console.log(`🗑️  Diretório da sessão vazio removido: ${dirPath}`);
                                
                                const parentDirPath = path.dirname(dirPath);
                                if (parentDirPath !== UPLOAD_DIR && fs.existsSync(parentDirPath) && fs.readdirSync(parentDirPath).length === 0) {
                                    fs.rmdirSync(parentDirPath);
                                    console.log(`🗑️  Diretório da empresa vazio removido: ${parentDirPath}`);
                                }
                            }
                        } catch (e) {
                            console.error('Erro ao limpar diretórios vazios:', e);
                        }
                    }
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
        // Apenas expira sessões gratuitas (sessões Business não expiram por tempo)
        if (!session.isBusiness) {
            // Sessões gratuitas expiram após 5 minutos para otimizar recursos
            const FREE_TIMEOUT = 5 * 60 * 1000;
            if (now - session.createdAt > FREE_TIMEOUT) {
                cleanupSession(sessionId);
            }
        }
    });
}, 60 * 1000);

// ===== ROTAS API AUTENTICAÇÃO CORPORATIVA =====

// Cadastro de Empresa
app.post('/api/register', (req, res) => {
    const { username, password, companyName } = req.body;
    if (!username || !password || !companyName) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }
    try {
        const user = Database.registerUser(username, password, companyName);
        res.json({ success: true, user });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// Login de Empresa
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }
    try {
        const user = Database.loginUser(username, password);
        res.json({ success: true, user });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// Buscar configurações da empresa
app.get('/api/business/config/:businessId', (req, res) => {
    try {
        const config = Database.getBusinessConfig(req.params.businessId);
        if (!config) {
            return res.status(404).json({ error: 'Empresa não encontrada' });
        }
        res.json(config);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Salvar configurações da empresa
app.post('/api/business/config/:businessId', (req, res) => {
    const { lgpdZeroStorage, desks } = req.body;
    try {
        const config = Database.saveBusinessConfig(req.params.businessId, lgpdZeroStorage, desks);
        res.json({ success: true, config });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// ===== ROTAS API =====

// Criar nova sessão (Modo Grátis)
app.post('/api/session', (req, res) => {
    const sessionId = uuidv4();
    const code = generateCode();

    const session = {
        isBusiness: false,
        code: code,
        createdAt: Date.now(),
        files: [],
        attendantSocket: null
    };

    sessions.set(sessionId, session);
    codeToSession.set(code, sessionId);

    console.log(`✅ Nova sessão grátis criada: ${sessionId} (código: ${code})`);

    const host = req.get('host') || `localhost:${PORT}`;
    const protocol = req.protocol; // http ou https

    res.json({
        sessionId: sessionId,
        code: code,
        url: `${protocol}://${host}/paginas/enviar-arquivo.html?session=${sessionId}`
    });
});

// Validar código e retornar sessionId (Modo Grátis)
app.get('/api/session/:code', (req, res) => {
    const code = req.params.code;
    const sessionId = codeToSession.get(code);

    if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId);

        // Verificar se não expirou (5 minutos para grátis)
        const FREE_TIMEOUT = 5 * 60 * 1000;
        if (Date.now() - session.createdAt > FREE_TIMEOUT) {
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

// Upload de arquivos (até 5 para Business, até 2 para Grátis)
app.post('/api/upload/:sessionId', upload.array('files', 5), (req, res) => {
    const sessionId = req.params.sessionId;
    let session = sessions.get(sessionId);

    // Se for modo Business e a sessão ainda não está no mapa de sessões ativas (atendente conectando sessão)
    if (!session && sessionId.startsWith('business_')) {
        const raw = sessionId.substring("business_".length);
        const lastUnderscoreIndex = raw.lastIndexOf('_');
        if (lastUnderscoreIndex !== -1) {
            const businessId = raw.substring(0, lastUnderscoreIndex);
            const deskId = raw.substring(lastUnderscoreIndex + 1);
            const config = Database.getBusinessConfig(businessId);
            if (config && config.desks.some(d => d.id === deskId)) {
                session = {
                    isBusiness: true,
                    businessId: businessId,
                    deskId: deskId,
                    lgpdZeroStorage: config.lgpdZeroStorage,
                    createdAt: Date.now(),
                    files: [],
                    attendantSocket: null
                };
                sessions.set(sessionId, session);
            }
        }
    }

    if (!session) {
        // Limpar arquivos enviados
        if (req.files) {
            req.files.forEach(f => {
                if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
            });
        }
        return res.status(404).json({ error: 'Sessão não encontrada ou atendente offline' });
    }

    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    // Validar limites dinâmicos (Business vs Grátis)
    const isBusiness = !!session.isBusiness;
    const maxFiles = isBusiness ? 5 : 2;
    const maxFileSize = (isBusiness ? 100 : 10) * 1024 * 1024; // 100MB vs 10MB

    const currentFilesCount = session.files ? session.files.length : 0;
    const totalFilesCount = currentFilesCount + req.files.length;

    if (totalFilesCount > maxFiles) {
        // Limpar arquivos novos
        req.files.forEach(f => {
            if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
        });
        return res.status(400).json({
            error: `Limite de arquivos excedido. O limite máximo é de ${maxFiles} arquivos.`
        });
    }

    // Verificar tamanho individual
    for (const file of req.files) {
        if (file.size > maxFileSize) {
            // Limpar arquivos novos
            req.files.forEach(f => {
                if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
            });
            return res.status(400).json({
                error: `O arquivo "${file.originalname}" excede o tamanho máximo permitido de ${isBusiness ? '100MB' : '10MB'}.`
            });
        }
    }

    // Armazenar todos os arquivos na sessão (salvando o caminho relativo a UPLOAD_DIR para suportar subpastas)
    const uploadedFiles = req.files.map(file => {
        const relativePath = path.relative(UPLOAD_DIR, file.path);
        return {
            filename: relativePath.replace(/\\/g, '/'),
            originalName: file.originalname,
            size: file.size,
            mimeType: file.mimetype
        };
    });

    session.files = session.files.concat(uploadedFiles);

    console.log(`📤 [${isBusiness ? 'BUSINESS' : 'GRÁTIS'}] ${req.files.length} arquivo(s) recebido(s):`);
    req.files.forEach(f => console.log(`   - ${f.originalname} (${f.size} bytes)`));

    // Emitir evento via Socket.io para o atendente
    if (session.attendantSocket) {
        io.to(session.attendantSocket).emit('files-received', {
            files: uploadedFiles,
            sessionId: sessionId,
            lgpdZeroStorage: !!session.lgpdZeroStorage
        });
        console.log(`🔔 Notificação enviada ao atendente`);
    }

    res.json({
        success: true,
        files: uploadedFiles,
        lgpdZeroStorage: !!session.lgpdZeroStorage
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
            
            // Se for modo LGPD / Zero-Storage, deletar o arquivo do disco imediatamente após o download concluído
            if (session.lgpdZeroStorage) {
                try {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        console.log(`🔒 [LGPD] Arquivo deletado permanentemente do disco pós-download: ${fileInfo.originalName}`);
                        
                        // Limpar pastas vazias se o arquivo estiver em um subdiretório
                        const dirPath = path.dirname(filePath);
                        if (dirPath !== UPLOAD_DIR) {
                            if (fs.existsSync(dirPath) && fs.readdirSync(dirPath).length === 0) {
                                fs.rmdirSync(dirPath);
                                console.log(`🗑️  Diretório da sessão vazio removido (LGPD): ${dirPath}`);
                                
                                const parentDirPath = path.dirname(dirPath);
                                if (parentDirPath !== UPLOAD_DIR && fs.existsSync(parentDirPath) && fs.readdirSync(parentDirPath).length === 0) {
                                    fs.rmdirSync(parentDirPath);
                                    console.log(`🗑️  Diretório da empresa vazio removido (LGPD): ${parentDirPath}`);
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error('Erro ao deletar arquivo no modo LGPD:', e);
                }
            }
        }
    });
});

// Deletar arquivo por índice
app.delete('/api/file/:sessionId/:fileIndex', (req, res) => {
    const sessionId = req.params.sessionId;
    const fileIndex = parseInt(req.params.fileIndex, 10);
    const session = sessions.get(sessionId);

    if (!session || !session.files || session.files.length === 0) {
        return res.status(404).json({ error: 'Sessão ou arquivos não encontrados' });
    }

    const fileInfo = session.files[fileIndex];
    if (!fileInfo) {
        return res.status(404).json({ error: 'Índice de arquivo inválido' });
    }

    const filePath = path.join(UPLOAD_DIR, fileInfo.filename);

    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`🗑️  Arquivo deletado manualmente: ${fileInfo.originalName}`);
            
            // Limpar pastas vazias se o arquivo estiver em um subdiretório
            const dirPath = path.dirname(filePath);
            if (dirPath !== UPLOAD_DIR) {
                if (fs.existsSync(dirPath) && fs.readdirSync(dirPath).length === 0) {
                    fs.rmdirSync(dirPath);
                    console.log(`🗑️  Diretório da sessão vazio removido após exclusão: ${dirPath}`);
                    
                    const parentDirPath = path.dirname(dirPath);
                    if (parentDirPath !== UPLOAD_DIR && fs.existsSync(parentDirPath) && fs.readdirSync(parentDirPath).length === 0) {
                        fs.rmdirSync(parentDirPath);
                        console.log(`🗑️  Diretório da empresa vazio removido após exclusão: ${parentDirPath}`);
                    }
                }
            }
        }
    } catch (e) {
        console.error('Erro ao deletar arquivo físico:', e);
    }

    // Remover da lista de arquivos da sessão
    session.files.splice(fileIndex, 1);

    // Emitir evento via Socket.io para o atendente
    if (session.attendantSocket) {
        io.to(session.attendantSocket).emit('files-received', {
            files: session.files,
            sessionId: sessionId,
            lgpdZeroStorage: !!session.lgpdZeroStorage
        });
        console.log(`🔔 Notificação de deleção enviada ao atendente`);
    }

    res.json({
        success: true,
        files: session.files,
        lgpdZeroStorage: !!session.lgpdZeroStorage
    });
});

// ===== WEBSOCKET =====

io.on('connection', (socket) => {
    console.log(`🔌 Cliente conectado: ${socket.id}`);

    // Atendente entra na sala da sessão
    socket.on('join-session', (data) => {
        let sessionId;
        let isBusiness = false;
        let businessId = null;
        let deskId = null;

        if (typeof data === 'string') {
            sessionId = data;
        } else if (data && data.sessionId) {
            sessionId = data.sessionId;
        } else if (data && data.businessId && data.deskId) {
            businessId = data.businessId;
            deskId = data.deskId;
            sessionId = `business_${businessId}_${deskId}`;
            isBusiness = true;
        }

        if (!sessionId) {
            return socket.emit('session-error', { error: 'Identificador de sessão ausente' });
        }

        let session = sessions.get(sessionId);

        if (isBusiness) {
            const config = Database.getBusinessConfig(businessId);
            if (!config || !config.desks.some(d => d.id === deskId)) {
                return socket.emit('session-error', { error: 'Empresa ou Sessão inválidos' });
            }

            // Inicializar ou re-atribuir sessão business
            if (!session) {
                session = {
                    isBusiness: true,
                    businessId: businessId,
                    deskId: deskId,
                    lgpdZeroStorage: config.lgpdZeroStorage,
                    createdAt: Date.now(),
                    files: [],
                    attendantSocket: socket.id
                };
                sessions.set(sessionId, session);
            } else {
                session.attendantSocket = socket.id;
                session.lgpdZeroStorage = config.lgpdZeroStorage; // Atualizar preferência de LGPD
            }
            console.log(`👤 Atendente corporativo conectado na sessão [${deskId}] da empresa [${businessId}]`);
        } else {
            // Sessão normal grátis
            if (session) {
                session.attendantSocket = socket.id;
                console.log(`👤 Atendente entrou na sessão grátis: ${sessionId}`);
            } else {
                return socket.emit('session-error', { error: 'Sessão não encontrada' });
            }
        }

        socket.join(sessionId);
        socket.emit('session-joined', { 
            sessionId, 
            isBusiness, 
            lgpdZeroStorage: session.lgpdZeroStorage 
        });

        // Se já existirem arquivos recebidos na sessão, notifica o atendente imediatamente
        if (session.files && session.files.length > 0) {
            socket.emit('files-received', {
                files: session.files,
                sessionId: sessionId,
                lgpdZeroStorage: !!session.lgpdZeroStorage
            });
        }
    });

    // Cliente (emissor) entra na sala
    socket.on('join-as-sender', (data) => {
        let sessionId;
        let isBusiness = false;

        if (typeof data === 'string') {
            sessionId = data;
        } else if (data && data.sessionId) {
            sessionId = data.sessionId;
        } else if (data && data.businessId && data.deskId) {
            sessionId = `business_${data.businessId}_${data.deskId}`;
            isBusiness = true;
        }

        if (!sessionId) {
            return socket.emit('sender-error', { error: 'Dados da sessão ausentes' });
        }

        const session = sessions.get(sessionId);

        if (isBusiness) {
            if (!session || !session.attendantSocket) {
                // Notificar que atendente está offline
                socket.emit('attendant-status', { online: false });
                console.log(`📱 Cliente tentou conectar à sessão [${data.deskId}] de [${data.businessId}], mas o atendente está offline`);
            } else {
                socket.join(sessionId);
                socket.emit('joined-as-sender', { 
                    sessionId, 
                    isBusiness: true, 
                    lgpdZeroStorage: session.lgpdZeroStorage 
                });
                socket.emit('attendant-status', { online: true });
                // Notificar o atendente
                io.to(session.attendantSocket).emit('client-connected', { socketId: socket.id });
                console.log(`📱 Cliente conectou à sessão [${data.deskId}] da empresa [${data.businessId}] (Online)`);
            }
        } else {
            // Sessão gratuita
            if (!session) {
                socket.emit('sender-error', { error: 'Sessão grátis expirada ou inexistente' });
            } else {
                socket.join(sessionId);
                socket.emit('joined-as-sender', { sessionId, isBusiness: false });
                console.log(`📱 Cliente emissor entrou na sessão grátis: ${sessionId}`);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`🔌 Cliente desconectado: ${socket.id}`);
        // Limpar sessões / arquivos se o atendente se desconectar
        sessions.forEach((session, sessionId) => {
            if (session.attendantSocket === socket.id) {
                console.log(`👤 Atendente desconectou da sessão: ${sessionId}`);
                if (session.isBusiness) {
                    if (session.lgpdZeroStorage) {
                        cleanupSession(sessionId);
                    } else {
                        session.attendantSocket = null; // Apenas deixa sem socket ativo
                    }
                } else {
                    cleanupSession(sessionId); // Grátis limpa imediatamente
                }
            }
        });
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
    console.log(`⏱️  Timeout Grátis: 5 minutos`);
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
