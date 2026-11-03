document.addEventListener('DOMContentLoaded', () => {
    const inputFecha = document.getElementById('fecha_calendario');
    const formBuscar = document.getElementById('form-buscar');
    const errorFecha = document.getElementById('error-fecha');

    const formatear = (d) => {
        const dos = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
    };
    const hoy = new Date();
    const manana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);
    const HOY = formatear(hoy);

    inputFecha.min = formatear(manana);

    inputFecha.addEventListener('change', () => {
        if (inputFecha.value !== '' && inputFecha.value > HOY) {
            errorFecha.hidden = true;
            formBuscar.submit();
        } else {
            errorFecha.hidden = false;
        }
    });

    const formCrear = document.getElementById('form-crear');
    if (!formCrear) {
        return;
    }

    const filas = formCrear.querySelectorAll('.fila-transportista');
    const buscador = document.getElementById('buscar-transportista');
    const filaSinResultados = document.getElementById('fila-sin-resultados');
    const avisoInactivo = document.getElementById('aviso-inactivo');
    const botonSiguiente = document.getElementById('btn-siguiente');
    const seleccionActual = document.getElementById('seleccion-actual');

    filas.forEach((fila) => {
        fila.addEventListener('click', () => {
            const radio = fila.querySelector('input[type=radio]');

            if (radio.disabled) {
                avisoInactivo.hidden = false;
                return;
            }

            avisoInactivo.hidden = true;
            radio.checked = true;
            filas.forEach((f) => f.classList.remove('fila-elegida'));
            fila.classList.add('fila-elegida');

            const nombre = fila.querySelectorAll('td')[2].textContent.trim();
            seleccionActual.innerHTML = `Elegiste a <strong>${nombre}</strong> (ID-${fila.dataset.id}).`;
            botonSiguiente.disabled = false;
        });
    });

    if (buscador) {
        buscador.addEventListener('input', () => {
            const termino = buscador.value.trim().toLowerCase().replace(/^id-?/, '');
            let visibles = 0;
            filas.forEach((fila) => {
                const coincide = termino === '' || fila.dataset.id.includes(termino);
                fila.hidden = !coincide;
                if (coincide) visibles++;
            });
            filaSinResultados.hidden = visibles > 0;
        });
    }

    formCrear.addEventListener('submit', (evento) => {
        if (!formCrear.querySelector('input[name=transportista]:checked')) {
            evento.preventDefault();
            seleccionActual.textContent = 'Elegí un transportista para continuar.';
        }
    });
});
