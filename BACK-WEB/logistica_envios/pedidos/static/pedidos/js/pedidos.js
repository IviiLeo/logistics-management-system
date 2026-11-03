document.addEventListener('DOMContentLoaded', () => {
    const btnNuevoPedido = document.getElementById('btn-nuevo-pedido');
    const buscadorId = document.getElementById('buscador-pedidos') || document.getElementById('buscador-id');
    const filtroEstado = document.getElementById('filtro-estado-pedido') || document.getElementById('filtro-estado');
    const filtroFecha = document.getElementById('filtro-fecha-pedido') || document.getElementById('filtro-fecha');
    const formFiltros = document.getElementById('form-filtros-pedidos');
    const tablaBody = document.getElementById('tabla-pedidos');

    // --- LÓGICA DE BÚSQUEDA EN VIVO (CONECTADA AL BACKEND) ---
    let temporizadorBuscador;

    function realizarBusquedaEnVivo() {
        if (!tablaBody) return;

        // 1. Limpiamos el temporizador para no enviar peticiones si el usuario sigue tipeando
        clearTimeout(temporizadorBuscador);
        
        // 2. Esperamos 300 milisegundos después de la última tecla
        temporizadorBuscador = setTimeout(() => {
            // Construimos la URL agregando los valores actuales del input y del select
            const endpoint = (formFiltros && formFiltros.getAttribute('action')) || '/pedidos/';
            const url = new URL(window.location.origin + endpoint);
            url.searchParams.set('id_pedido', buscadorId.value.trim());
            url.searchParams.set('estado', filtroEstado.value);
            
            // Sumamos la fecha elegida a la petición del servidor
            if (filtroFecha && filtroFecha.value) {
                url.searchParams.set('fecha_entrega', filtroFecha.value);
            }

            // 3. Le pedimos a Django la página completa con los nuevos filtros de forma invisible
            fetch(url)
                .then(respuesta => respuesta.text())
                .then(html => {
                    // Convertimos la respuesta en un documento HTML manipulable
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');

                    // 4. Reemplazamos la tabla actual por la tabla perfecta que nos mandó Django
                    const nuevoTbody = doc.getElementById('tabla-pedidos');
                    if (nuevoTbody) {
                        tablaBody.innerHTML = nuevoTbody.innerHTML;
                    }

                    // 5. Reemplazamos también la botonera de paginación
                    const contenedorTabla = document.querySelector('.table-container');
                    const paginacionActual = document.querySelector('.paginacion-container');
                    const paginacionNueva = doc.querySelector('.paginacion-container');
                    
                    if (paginacionActual && paginacionNueva) {
                        paginacionActual.innerHTML = paginacionNueva.innerHTML;
                    } else if (!paginacionActual && paginacionNueva && contenedorTabla) {
                        contenedorTabla.after(paginacionNueva);
                    } else if (paginacionActual && !paginacionNueva) {
                        paginacionActual.remove();
                    }

                    // 6. Actualizamos la URL del navegador sin recargar la página
                    window.history.replaceState({}, '', url);
                });
        }, 300);
    }

    if (buscadorId) {
        buscadorId.addEventListener('input', realizarBusquedaEnVivo);
    }
    if (filtroEstado) {
        filtroEstado.addEventListener('change', realizarBusquedaEnVivo);
    }
    if (filtroFecha) {
        filtroFecha.addEventListener('input', realizarBusquedaEnVivo);
        filtroFecha.addEventListener('change', realizarBusquedaEnVivo);
    }

    // --- LÓGICA DE MODAL DE CARGA MANUAL ---
    if (btnNuevoPedido) {
        const modalCarga = document.getElementById('modal-nuevo-pedido');
        const btnCancelar = document.getElementById('btn-cancelar');
        const formNuevo = document.getElementById('form-nuevo-pedido');
        const divMensaje = document.getElementById('modal-mensaje');
        const inputFechaModal = document.getElementById('input-fecha-nuevo-pedido');
        
        btnNuevoPedido.addEventListener('click', () => {
            modalCarga.classList.remove('hidden');
            if (divMensaje) {
                divMensaje.classList.add('hidden');
                divMensaje.innerHTML = '';
            }
            formNuevo.reset();
        });

        btnCancelar.addEventListener('click', () => {
            modalCarga.classList.add('hidden');
        });

        formNuevo.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(formNuevo);

            try {
                const respuesta = await fetch(formNuevo.action, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });

                const datos = await respuesta.json();

                if (respuesta.ok && datos.exito) {
                    window.location.href = '/pedidos/';
                } else if (datos.errores) {
                    // Mostramos la notificación de error adentro del modal sin cerrarlo
                    divMensaje.innerHTML = datos.errores.join('<br>');
                    divMensaje.className = 'mensaje error';
                    divMensaje.classList.remove('hidden');

                    // Solo limpiamos los campos que tuvieron error, conservando intactos todos los datos válidos
                    if (Array.isArray(datos.campos_invalidos)) {
                        datos.campos_invalidos.forEach(nombreCampo => {
                            const inputInvalido = formNuevo.querySelector(`[name="${nombreCampo}"]`);
                            if (inputInvalido) {
                                inputInvalido.value = '';
                            }
                        });
                    }
                }
            } catch (error) {
                formNuevo.submit();
            }
        });

        if (inputFechaModal) {
            const fechaLocal = new Date();
            fechaLocal.setDate(fechaLocal.getDate() + 1); // Forzamos a que sea "mañana" localmente
            
            const anio = fechaLocal.getFullYear();
            const mes = String(fechaLocal.getMonth() + 1).padStart(2, '0');
            const dia = String(fechaLocal.getDate()).padStart(2, '0');
            
            // Seteamos el mínimo calculando tu hora local real
            inputFechaModal.setAttribute('min', `${anio}-${mes}-${dia}`);
        }
    }

    // --- LÓGICA PARA CARGAR CSV ---
    const btnAbrirCsv = document.getElementById('btn-abrir-csv');

    if (btnAbrirCsv) {
        const modalCsv = document.getElementById('modal-cargar-csv');
        const btnCancelarCsv = document.getElementById('btn-cancelar-csv');
        const btnConfirmarCsv = document.getElementById('btn-confirmar-csv');

        const dropZone = document.getElementById('csv-drop-zone');
        const dropText = document.getElementById('csv-drop-text');
        const inputCsv = document.getElementById('input-csv');

        // 1. Abrir modal
        btnAbrirCsv.addEventListener('click', () => {
            modalCsv.classList.remove('hidden');
        });

        // 2. Función para resetear el modal al cancelar
        const resetearModalCsv = () => {
            modalCsv.classList.add('hidden');
            inputCsv.value = '';
            dropZone.classList.remove('active');
            dropText.textContent = "Arrastrá tu archivo .csv acá o hacé clic para buscar";
            btnConfirmarCsv.disabled = true;
            btnConfirmarCsv.classList.add('btn-deshabilitado');
        };

        btnCancelarCsv.addEventListener('click', resetearModalCsv);

        // 3. Hacer clic en la zona abre el explorador
        dropZone.addEventListener('click', () => {
            inputCsv.click();
        });

        // 4. Lógica de Drag & Drop (Arrastrar por encima y soltar)
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drop-zone-hover');
        });

        dropZone.addEventListener('dragleave', () => {
            if (!dropZone.classList.contains('active')) {
                dropZone.classList.remove('drop-zone-hover');
            }
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            if (e.dataTransfer.files.length > 0) {
                inputCsv.files = e.dataTransfer.files;
                inputCsv.dispatchEvent(new Event('change'));
            }
        });

        // 5. Cuando el archivo finalmente se carga (por clic o soltado)
        inputCsv.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const archivo = e.target.files[0];

                if (archivo.name.toLowerCase().endsWith('.csv')) {
                    dropText.innerHTML = `✅ <strong>${archivo.name}</strong> listo para cargar.`;
                    dropZone.classList.add('active');
                    btnConfirmarCsv.disabled = false;
                    btnConfirmarCsv.classList.remove('btn-deshabilitado');
                } else {
                    alert("Por favor, seleccioná exclusivamente un archivo con formato .csv");
                    inputCsv.value = '';
                }
            }
        });
    }
});