document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-filtros');
    if (!form) {
        return;
    }

    const CLAVE_FOCO = 'filtro-con-foco';
    let temporizador = null;

    const guardarFoco = (campo) => {
        try {
            const posicion = campo.type === 'text' ? campo.selectionStart : null;
            sessionStorage.setItem(CLAVE_FOCO, JSON.stringify({ id: campo.id, posicion }));
        } catch (error) { }
    };

    const buscar = (campo) => {
        guardarFoco(campo);
        form.requestSubmit();
    };

    form.querySelectorAll('select, input[type=date]').forEach((campo) => {
        campo.addEventListener('change', () => buscar(campo));
    });

    form.querySelectorAll('input[type=text]').forEach((campo) => {
        const valorInicial = campo.value;

        campo.addEventListener('input', () => {
            if (campo.hasAttribute('data-solo-numeros')) {
                campo.value = campo.value.replace(/\D/g, '');
            }
            clearTimeout(temporizador);
            if (campo.value === valorInicial) {
                return;
            }
            temporizador = setTimeout(() => buscar(campo), 600);
        });

        campo.addEventListener('keydown', (evento) => {
            if (evento.key === 'Enter') {
                evento.preventDefault();
                clearTimeout(temporizador);
                buscar(campo);
            }
        });
    });

    form.addEventListener('submit', () => {
        form.querySelectorAll('input, select').forEach((campo) => {
            if (campo.value === '' || campo.value === 'todos') {
                campo.disabled = true;
            }
        });
    });

    try {
        const guardado = JSON.parse(sessionStorage.getItem(CLAVE_FOCO));
        sessionStorage.removeItem(CLAVE_FOCO);
        const campo = guardado && document.getElementById(guardado.id);
        if (campo) {
            campo.focus();
            if (guardado.posicion !== null && campo.type === 'text') {
                const fin = campo.value.length;
                campo.setSelectionRange(fin, fin);
            }
        }
    } catch (error) { }
});
