document.addEventListener('DOMContentLoaded', () => {
    const contenedor = document.getElementById('contenedor-listas');
    if (!contenedor || contenedor.dataset.editable !== 'si') {
        return;
    }

    const listaDisponibles = document.getElementById('lista-disponibles');
    const listaAsignados = document.getElementById('lista-asignados');
    const contadorDisponibles = document.getElementById('contador-disponibles');
    const contadorAsignados = document.getElementById('contador-asignados');
    const vacioDisponibles = document.getElementById('vacio-disponibles');
    const vacioAsignados = document.getElementById('vacio-asignados');
    const sinResultados = document.getElementById('sin-resultados');
    const buscador = document.getElementById('buscar-pedido');
    const mensaje = document.getElementById('mensaje-accion');

    const urlBase = contenedor.dataset.urlMover;
    const urlPara = (pedidoId) => urlBase.replace(/\/0\/$/, `/${pedidoId}/`);

    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

    const mostrarMensaje = (texto, tipo) => {
        mensaje.textContent = texto;
        mensaje.className = `mensaje ${tipo}`;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const actualizarContadores = () => {
        const cantDisponibles = listaDisponibles.children.length;
        const cantAsignados = listaAsignados.children.length;
        contadorDisponibles.textContent = cantDisponibles;
        contadorAsignados.textContent = cantAsignados;
        vacioDisponibles.hidden = cantDisponibles > 0;
        vacioAsignados.hidden = cantAsignados > 0;
        filtrar();
    };

    const ajustarBoton = (tarjeta, quedoAsignado) => {
        const boton = tarjeta.querySelector('.btn-mover');
        if (quedoAsignado) {
            boton.className = 'btn btn-outline btn-chico btn-mover';
            boton.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Quitar';
        } else {
            boton.className = 'btn btn-primary btn-chico btn-mover';
            boton.innerHTML = 'Agregar <i class="fa-solid fa-arrow-right"></i>';
        }
    };

    const moverPedido = async (tarjeta) => {
        const pedidoId = tarjeta.dataset.id;
        tarjeta.classList.add('moviendo');

        try {
            const respuesta = await fetch(urlPara(pedidoId), {
                method: 'POST',
                headers: { 'X-CSRFToken': csrfToken },
            });
            const datos = await respuesta.json();

            if (!respuesta.ok) {
                mostrarMensaje(datos.error === 'El pedido no está disponible para esta acción'
                    ? 'Pedido ya asignado a otra hoja de ruta'
                    : (datos.error || 'No se pudo mover el pedido.'), 'error');
                return;
            }

            if (datos.accion === 'asignado') {
                listaAsignados.appendChild(tarjeta);
                ajustarBoton(tarjeta, true);
                mostrarMensaje(`Pedido ID-${pedidoId} asignado con éxito.`, 'exito');
            } else {
                listaDisponibles.appendChild(tarjeta);
                ajustarBoton(tarjeta, false);
                mostrarMensaje(`Pedido ID-${pedidoId} quitado de la hoja de ruta.`, 'exito');
            }
            actualizarContadores();
        } catch (error) {
            mostrarMensaje('No se pudo conectar con el servidor. Intentá de nuevo.', 'error');
        } finally {
            tarjeta.classList.remove('moviendo');
        }
    };

    contenedor.addEventListener('click', (evento) => {
        const boton = evento.target.closest('.btn-mover');
        if (boton) {
            moverPedido(boton.closest('.pedido-tarjeta'));
        }
    });

    const filtrar = () => {
        const termino = buscador.value.trim().toLowerCase().replace(/^id-?/, '');
        let visibles = 0;
        listaDisponibles.querySelectorAll('.pedido-tarjeta').forEach((tarjeta) => {
            const coincide = termino === '' || tarjeta.dataset.id.includes(termino);
            tarjeta.hidden = !coincide;
            if (coincide) visibles++;
        });
        sinResultados.hidden = !(termino !== '' && visibles === 0 && listaDisponibles.children.length > 0);
    };

    buscador.addEventListener('input', filtrar);
});
