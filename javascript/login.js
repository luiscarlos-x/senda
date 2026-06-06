// Senda Business - Login & Register logic

const BACKEND_URL = window.location.origin;
let currentMode = 'login'; // 'login' ou 'register'

function switchTab(mode) {
    currentMode = mode;
    
    // UI elements
    const tabLogin = document.getElementById('tabLogin');
    const tabRegister = document.getElementById('tabRegister');
    const companyGroup = document.getElementById('companyGroup');
    const companyInput = document.getElementById('companyName');
    const pageTitle = document.getElementById('pageTitle');
    const pageSubtitle = document.getElementById('pageSubtitle');
    const btnText = document.getElementById('btnText');
    const authAlert = document.getElementById('authAlert');
    
    // Reset alert
    authAlert.style.display = 'none';

    if (mode === 'login') {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        companyGroup.style.display = 'none';
        companyInput.removeAttribute('required');
        
        pageTitle.textContent = 'Área Business';
        pageSubtitle.textContent = 'Acesse a conta da sua empresa para receber arquivos';
        btnText.textContent = 'Entrar';
    } else {
        tabLogin.classList.remove('active');
        tabRegister.classList.add('active');
        companyGroup.style.display = 'flex';
        companyInput.setAttribute('required', 'true');
        
        pageTitle.textContent = 'Criar Conta Business';
        pageSubtitle.textContent = 'Cadastre sua empresa em segundos e simplifique o recebimento de arquivos';
        btnText.textContent = 'Cadastrar Empresa';
    }
}

async function handleAuthSubmit(event) {
    event.preventDefault();
    
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const companyInput = document.getElementById('companyName');
    const submitBtn = document.getElementById('submitBtn');
    const alertBox = document.getElementById('authAlert');
    const alertText = document.getElementById('authAlertText');
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const companyName = companyInput.value.trim();
    
    // Esconder alertas anteriores
    alertBox.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.7';

    const endpoint = currentMode === 'login' ? '/api/login' : '/api/register';
    const payload = currentMode === 'login' 
        ? { username, password } 
        : { username, password, companyName };

    try {
        const response = await fetch(`${BACKEND_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // Sucesso na autenticação
            localStorage.setItem('senda_business_id', data.user.username);
            localStorage.setItem('senda_company_name', data.user.companyName);
            
            // Redireciona para o painel de recebimento
            window.location.href = 'receber-arquivo.html';
        } else {
            // Erro retornado pela API
            throw new Error(data.error || 'Erro ao realizar autenticação.');
        }
    } catch (err) {
        alertBox.style.display = 'flex';
        alertText.textContent = err.message;
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
    }
}

// Limpar sessão existente se vier para a tela de login
window.addEventListener('load', () => {
    localStorage.removeItem('senda_business_id');
    localStorage.removeItem('senda_company_name');
});
