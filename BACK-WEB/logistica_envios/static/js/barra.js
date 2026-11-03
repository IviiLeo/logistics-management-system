document.addEventListener('DOMContentLoaded', () => {
    // ========================================================
    // LÓGICA PARA MODAL GLOBAL DE CIERRE DE SESIÓN (BARRA LATERAL)
    // ========================================================
    const btnAbrirLogout = document.getElementById('btn-abrir-logout');

    if (btnAbrirLogout) {
        const modalLogout = document.getElementById('modal-confirmar-logout');
        const btnCancelarLogout = document.getElementById('btn-cancelar-logout');

        btnAbrirLogout.addEventListener('click', () => {
            modalLogout.classList.remove('hidden');
        });

        btnCancelarLogout.addEventListener('click', () => {
            modalLogout.classList.add('hidden');
        });
    }
});
