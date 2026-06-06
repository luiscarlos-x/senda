const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CONFIGS_FILE = path.join(DATA_DIR, 'business_configs.json');

// Garantir que a pasta data/ existe
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Inicializar arquivos vazios se não existirem
if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([]));
}
if (!fs.existsSync(CONFIGS_FILE)) {
    fs.writeFileSync(CONFIGS_FILE, JSON.stringify({}));
}

// Funções Auxiliares
function readUsers() {
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data || '[]');
    } catch (e) {
        console.error('Erro ao ler usuários:', e);
        return [];
    }
}

function writeUsers(users) {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        return true;
    } catch (e) {
        console.error('Erro ao gravar usuários:', e);
        return false;
    }
}

function readConfigs() {
    try {
        const data = fs.readFileSync(CONFIGS_FILE, 'utf8');
        return JSON.parse(data || '{}');
    } catch (e) {
        console.error('Erro ao ler configurações corporativas:', e);
        return {};
    }
}

function writeConfigs(configs) {
    try {
        fs.writeFileSync(CONFIGS_FILE, JSON.stringify(configs, null, 2));
        return true;
    } catch (e) {
        console.error('Erro ao gravar configurações corporativas:', e);
        return false;
    }
}

// Criptografia nativa para senhas
function hashPassword(password, salt) {
    if (!salt) {
        salt = crypto.randomBytes(16).toString('hex');
    }
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return { salt, hash };
}

// API de Acesso a Dados
const Database = {
    // Cadastro de Usuário
    registerUser(username, password, companyName) {
        const users = readUsers();
        
        // Normalizar username para minúsculo
        const normalizedUser = username.toLowerCase().trim();
        
        // Verificar se usuário existe
        const exists = users.some(u => u.username === normalizedUser);
        if (exists) {
            throw new Error('Nome de usuário / e-mail já cadastrado.');
        }

        const { salt, hash } = hashPassword(password);
        const newUser = {
            username: normalizedUser,
            passwordHash: hash,
            salt: salt,
            companyName: companyName.trim(),
            createdAt: Date.now()
        };

        users.push(newUser);
        writeUsers(users);

        // Criar configuração inicial de business
        const configs = readConfigs();
        configs[normalizedUser] = {
            businessId: normalizedUser,
            companyName: newUser.companyName,
            lgpdZeroStorage: false, // Por padrão salva os arquivos
            desks: [
                { id: 'guiche-01', name: 'Guichê 01', createdAt: Date.now() } // Guichê padrão inicial
            ]
        };
        writeConfigs(configs);

        return { username: newUser.username, companyName: newUser.companyName };
    },

    // Login de Usuário
    loginUser(username, password) {
        const users = readUsers();
        const normalizedUser = username.toLowerCase().trim();
        const user = users.find(u => u.username === normalizedUser);

        if (!user) {
            throw new Error('Usuário ou senha incorretos.');
        }

        const { hash } = hashPassword(password, user.salt);
        if (hash !== user.passwordHash) {
            throw new Error('Usuário ou senha incorretos.');
        }

        return { username: user.username, companyName: user.companyName };
    },

    // Buscar configurações da empresa
    getBusinessConfig(businessId) {
        const configs = readConfigs();
        const normalizedId = businessId.toLowerCase().trim();
        return configs[normalizedId] || null;
    },

    // Salvar configurações da empresa
    saveBusinessConfig(businessId, lgpdZeroStorage, desks) {
        const configs = readConfigs();
        const normalizedId = businessId.toLowerCase().trim();

        if (!configs[normalizedId]) {
            throw new Error('Empresa não encontrada.');
        }

        configs[normalizedId].lgpdZeroStorage = !!lgpdZeroStorage;
        if (Array.isArray(desks)) {
            configs[normalizedId].desks = desks;
        }

        writeConfigs(configs);
        return configs[normalizedId];
    }
};

module.exports = Database;
