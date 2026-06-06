// Senda - Theme Toggle (Dark Mode)
(function () {
    const saved = localStorage.getItem('senda-theme');
    if (saved) {
        document.documentElement.setAttribute('data-theme', saved);
    }
    
    // Sincronizar checkbox ao carregar a página
    window.addEventListener('DOMContentLoaded', () => {
        const themeVal = document.documentElement.getAttribute('data-theme') || 'light';
        const checkbox = document.getElementById('darkModeCheckbox');
        if (checkbox) {
            checkbox.checked = (themeVal === 'dark');
        }
    });
})();

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('senda-theme', next);
    
    // Sincronizar checkbox
    const checkbox = document.getElementById('darkModeCheckbox');
    if (checkbox) {
        checkbox.checked = (next === 'dark');
    }
}

function toggleThemeFromCheckbox(isDark) {
    const next = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('senda-theme', next);
}
