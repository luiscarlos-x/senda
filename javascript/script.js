// Senda - Script Principal

// Handlers para os botões de ação
function handleSendFile() {
    console.log('Enviar arquivo clicado');
    // Detectar se já está dentro de paginas/ ou na raiz
    const currentPath = window.location.pathname;
    const isInPaginas = currentPath.includes('/paginas/');

    if (isInPaginas) {
        window.location.href = 'enviar-arquivo.html';
    } else {
        window.location.href = 'paginas/enviar-arquivo.html';
    }
}

function handleReceiveFile() {
    console.log('Receber arquivo clicado');
    // Detectar se já está dentro de paginas/ ou na raiz
    const currentPath = window.location.pathname;
    const isInPaginas = currentPath.includes('/paginas/');

    if (isInPaginas) {
        window.location.href = 'receber-arquivo.html';
    } else {
        window.location.href = 'paginas/receber-arquivo.html';
    }
}

// Animação de entrada suave
function animateOnScroll() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, {
        threshold: 0.1
    });

    document.querySelectorAll('.feature').forEach(feature => {
        feature.style.opacity = '0';
        feature.style.transform = 'translateY(20px)';
        feature.style.transition = 'all 0.6s ease-out';
        observer.observe(feature);
    });
}

// Efeito de hover nos cards com movimento do mouse
function initCardHoverEffect() {
    const cards = document.querySelectorAll('.card');

    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateX = (y - centerY) / 20;
            const rotateY = (centerX - x) / 20;

            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
        });
    });
}

// Adicionar CSS para animação de partículas
const style = document.createElement('style');
style.textContent = `
    @keyframes particleFloat {
        0%, 100% {
            transform: translate(0, 0);
        }
        25% {
            transform: translate(20px, -20px);
        }
        50% {
            transform: translate(-20px, -40px);
        }
        75% {
            transform: translate(-40px, -20px);
        }
    }
`;
document.head.appendChild(style);

// Inicialização quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    console.log('Senda carregado com sucesso! 🚀');
    animateOnScroll();
    initCardHoverEffect();

    // Adicionar listener de teclado para acessibilidade
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const dropdown = document.getElementById('homeDropdownMenu');
            if (dropdown && dropdown.classList.contains('show')) {
                dropdown.classList.remove('show');
            }
        }
    });
});

// Toggle para o menu drop-down da Home (Sandwich)
function toggleHomeMenu(event) {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById('homeDropdownMenu');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

// Fechar menu se clicar fora
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('homeDropdownMenu');
    const btn = document.getElementById('homeSandwichBtn');
    if (dropdown && dropdown.classList.contains('show')) {
        if (!dropdown.contains(e.target) && (!btn || !btn.contains(e.target))) {
            dropdown.classList.remove('show');
        }
    }
});

// Log de informações úteis para desenvolvimento
console.log('%c🌌 Senda - Envio Instantâneo de Arquivos', 'color: #00B4D8; font-size: 20px; font-weight: bold;');
console.log('%cVersão: 2.0.0 (Design Minimalista Dark)', 'color: #90E0EF; font-size: 14px;');
