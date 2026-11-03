document.addEventListener('DOMContentLoaded', () => {
    const filasPagos = document.querySelectorAll('.fila-pago');
    const buscadorPagos = document.getElementById('buscador-pagos');
    const filtroEstado = document.getElementById('filtro-estado');
    const filaVacia = document.getElementById('fila-vacia');
    const filaVaciaDjango = document.getElementById('fila-vacia-django');
    const optPendientes = document.getElementById('opt-pendientes');

    // Enlazar links "ENT-XX" y "Ver detalle pago" con el detalle de la entrega correspondiente
    filasPagos.forEach(fila => {
        const colEntregaLink = fila.querySelector('.col-entrega a.link-detail');
        if (colEntregaLink) {
            const idEntregaLimpio = colEntregaLink.textContent.replace(/ENT-/i, '').trim();
            if (/^\d+$/.test(idEntregaLimpio)) {
                const urlDetalleEntrega = `/entregas/${idEntregaLimpio}/`;
                colEntregaLink.href = urlDetalleEntrega;

            }
        }
    });

    // 1. ACTUALIZAR CONTADOR DE PENDIENTES EN EL SELECT
    function actualizarContadorPendientes() {
        let pendientes = 0;
        filasPagos.forEach(fila => {
            if (fila.dataset.estado === 'pendiente') pendientes++;
        });
        if (optPendientes) {
            optPendientes.textContent = `Pendientes (${pendientes})`;
        }
    }

    // 2. FILTRADO DE TABLA (POR ID PAGO EXACTO Y ESTADO)
    function filtrarTabla() {
        const termino = buscadorPagos.value.toLowerCase().trim();
        const terminoLimpio = termino.replace(/^pg-|^id-/i, '').trim();
        const estadoSeleccionado = filtroEstado.value;
        let visibles = 0;

        filasPagos.forEach(fila => {
            const estadoFila = fila.dataset.estado;
            const idPagoTexto = (fila.querySelector('td') ? fila.querySelector('td').textContent : '').toLowerCase().trim();
            const idNumero = idPagoTexto.replace(/^pg-|^id-/i, '').trim();
            
            const coincideEstado = (estadoSeleccionado === 'todos') || (estadoFila === estadoSeleccionado);
            const coincideBusqueda = (termino === '') || (idNumero === terminoLimpio) || (idPagoTexto === termino);

            if (coincideEstado && coincideBusqueda) {
                fila.classList.remove('hidden'); // <-- Usamos la clase
                visibles++;
            } else {
                fila.classList.add('hidden'); // <-- Usamos la clase
            }
        });

        // Ocultamos el mensaje por defecto de Django si existe
        if (filaVaciaDjango) filaVaciaDjango.classList.add('hidden');

        // Mostramos nuestro propio mensaje de "No hay resultados" solo si el filtro dejó todo vacío
        if (visibles === 0 && filasPagos.length > 0) {
            filaVacia.classList.remove('hidden');
        } else {
            filaVacia.classList.add('hidden');
        }
    }

    if (buscadorPagos) buscadorPagos.addEventListener('input', filtrarTabla);
    if (filtroEstado) filtroEstado.addEventListener('change', filtrarTabla);
    
    actualizarContadorPendientes();

    // 3. LÓGICA DEL MODAL (VALIDAR / RECHAZAR) CON FETCH
    const modalAccion = document.getElementById('modal-accion-pago');
    const formAccion = document.getElementById('form-accion-pago');
    const btnCancelarAccion = document.getElementById('btn-cancelar-accion');
    const btnConfirmarAccion = document.getElementById('btn-confirmar-accion');
    
    const tituloModal = document.getElementById('modal-titulo');
    const textoAccion = document.getElementById('modal-accion-texto');
    const spanPagoTxt = document.getElementById('modal-pago-txt');
    const spanMonto = document.getElementById('modal-monto');
    const spanEntrega = document.getElementById('modal-entrega');
    
    const inputPagoId = document.getElementById('input-pago-id');
    const inputAccionTipo = document.getElementById('input-accion-tipo');
    const alertasContainer = document.getElementById('alertas-container');
    
    let filaSeleccionada = null;
    let accionActual = ''; // 'validar' o 'rechazar'

    // Delegación de eventos para los botones en la tabla
    document.getElementById('tabla-pagos').addEventListener('click', (e) => {
        const btnValidar = e.target.closest('.btn-validar');
        const btnRechazar = e.target.closest('.btn-rechazar');
        
        if (btnValidar || btnRechazar) {
            const btnActivo = btnValidar || btnRechazar;
            filaSeleccionada = btnActivo.closest('tr');
            
            // Llenar datos del modal
            inputPagoId.value = btnActivo.dataset.id.replace('PG-', ''); // Manda solo el número al backend
            spanPagoTxt.textContent = btnActivo.dataset.id;
            spanMonto.textContent = btnActivo.dataset.monto;
            spanEntrega.textContent = btnActivo.dataset.entrega;
            
            if (btnValidar) {
                accionActual = 'validar';
                inputAccionTipo.value = 'validar';
                tituloModal.textContent = 'Validar Pago';
                tituloModal.style.color = 'var(--naranja-ya)';
                textoAccion.textContent = 'validar';
                btnConfirmarAccion.className = 'btn btn-primary';
                btnConfirmarAccion.textContent = 'Sí, validar pago';
            } else {
                accionActual = 'rechazar';
                inputAccionTipo.value = 'rechazar';
                tituloModal.textContent = 'Rechazar Pago';
                tituloModal.style.color = '#dc3545';
                textoAccion.textContent = 'rechazar';
                btnConfirmarAccion.className = 'btn btn-danger';
                btnConfirmarAccion.textContent = 'Sí, rechazar pago';
            }
            
            modalAccion.classList.remove('hidden');
        }
    });

    btnCancelarAccion.addEventListener('click', () => {
        modalAccion.classList.add('hidden');
        filaSeleccionada = null;
    });

    if (formAccion) {
        formAccion.addEventListener('submit', async (e) => {
            e.preventDefault();
            alertasContainer.innerHTML = '';
            btnConfirmarAccion.disabled = true;

            try {
                const formData = new FormData(formAccion);
                
                const respuesta = await fetch(urlAccionPago, {
                    method: 'POST',
                    body: formData,
                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                });
                
                const datos = await respuesta.json();

                if (respuesta.ok && datos.exito) {
                    const alertaExito = document.createElement('div');
                    alertaExito.className = 'mensaje exito';
                    alertaExito.textContent = datos.mensaje || `El pago fue ${accionActual === 'validar' ? 'validado' : 'rechazado'} exitosamente.`;
                    alertasContainer.appendChild(alertaExito);
                    
                    if (filaSeleccionada) {
                        // Actualizar DOM sin recargar
                        const nuevoEstado = accionActual === 'validar' ? 'validado' : 'rechazado';
                        filaSeleccionada.dataset.estado = nuevoEstado;
                        const estadoCell = filaSeleccionada.querySelector('.estado-cell');
                        
                        if (nuevoEstado === 'validado') {
                            estadoCell.innerHTML = '<span class="badge badge-entregado">Validado</span>';
                        } else {
                            estadoCell.innerHTML = '<span class="badge badge-rechazado">Rechazado</span>';
                        }
                        
                        // Eliminar los botones de acción pero conservar el enlace "Ver detalle pago"
                        const wrapperAcciones = filaSeleccionada.querySelector('.acciones-wrapper');
                        if (wrapperAcciones) {
                            wrapperAcciones.remove();
                        }
                        
                        actualizarContadorPendientes();
                        filtrarTabla();
                    }
                } else {
                    const alertaError = document.createElement('div');
                    alertaError.className = 'mensaje error';
                    alertaError.textContent = datos.mensaje || "Ocurrió un error al procesar el pago.";
                    alertasContainer.appendChild(alertaError);
                }
            } catch (error) {
                console.error("Error de red:", error);
            } finally {
                modalAccion.classList.add('hidden');
                btnConfirmarAccion.disabled = false;
                setTimeout(() => alertasContainer.innerHTML = '', 5000);
            }
        });
    }
});
