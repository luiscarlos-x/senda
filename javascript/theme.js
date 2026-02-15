// Senda - Theme Toggle (Dark Mode)
(function () {
    const saved = localStorage.getItem('senda-theme');
    if (saved) {
        document.documentElement.setAttribute('data-theme', saved);
    }
})();

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('senda-theme', next);
}
