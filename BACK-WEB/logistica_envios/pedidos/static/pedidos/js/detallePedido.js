document.addEventListener('DOMContentLoaded', () => {
    const btnVolverAtras = document.getElementById('btn-volver-atras');
    const btnEliminar = document.getElementById('btn-eliminar');
    
    const inputFecha = document.getElementById('detalle-fecha-entrega');
    const formInputs = document.querySelectorAll('#form-detalle-pedido input:not([type="hidden"])');
    const bloqueBotones = document.getElementById('bloque-botones-edicion');
    const btnEditarRemito = document.getElementById('btn-editar-remito');
    const alertaBloqueo = document.getElementById('alerta-bloqueo');

    let esEditable = true; 

    // --- Bloqueo por Fecha Local ---
    function verificarBloqueoPorFecha() {
        if (!inputFecha || !inputFecha.value) return;

        const partes = inputFecha.value.split('-');
        const fechaEntrega = new Date(partes[0], partes[1] - 1, partes[2]);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0); // Comparamos solo la fecha

        if (hoy >= fechaEntrega) {
            esEditable = false; 

            formInputs.forEach(input => {
                input.readOnly = true;
                input.classList.add('input-readonly');
            });

            if (bloqueBotones) bloqueBotones.classList.add('hidden');
            if (btnEditarRemito) btnEditarRemito.classList.add('hidden');
            if (alertaBloqueo) alertaBloqueo.classList.remove('hidden');
        } else {
            esEditable = true;
            if (alertaBloqueo) alertaBloqueo.classList.add('hidden');
        }
    }

    verificarBloqueoPorFecha();

    // --- Lógica Flecha Atrás ---
    if (btnVolverAtras) {
        const modalCancelar = document.getElementById('modal-confirmar-cancelar');
        const btnVolverEditar = document.getElementById('btn-volver-editar');

        btnVolverAtras.addEventListener('click', (e) => {
            if (esEditable) {
                e.preventDefault();
                modalCancelar.classList.remove('hidden');
            } else {
                window.location.href = '/pedidos/';
            }
        });

        if (btnVolverEditar) {
            btnVolverEditar.addEventListener('click', () => modalCancelar.classList.add('hidden'));
        }
    }

    // --- Modal Eliminar ---
    if (btnEliminar) {
        const modalEliminar = document.getElementById('modal-confirmar-eliminar');
        const btnCancelarEliminar = document.getElementById('btn-cancelar-eliminar');
        const btnConfirmarEliminar = document.getElementById('btn-confirmar-eliminar');

        btnEliminar.addEventListener('click', () => modalEliminar.classList.remove('hidden'));
        btnCancelarEliminar.addEventListener('click', () => modalEliminar.classList.add('hidden'));
        btnConfirmarEliminar.addEventListener('click', () => window.location.href = '/pedidos/');
    }

    // --- Modal PDF Remito ---
    if (btnEditarRemito) {
        const modalPdf = document.getElementById('modal-cargar-pdf');
        const btnCancelarPdf = document.getElementById('btn-cancelar-pdf');
        const btnConfirmarPdf = document.getElementById('btn-confirmar-pdf');
        const dropZonePdf = document.getElementById('pdf-drop-zone');
        const dropTextPdf = document.getElementById('pdf-drop-text');
        const inputPdfDrag = document.getElementById('input-pdf-drag');
        const labelNuevoPdf = document.getElementById('nombre-nuevo-pdf');

        btnEditarRemito.addEventListener('click', () => modalPdf.classList.remove('hidden'));
        const cerrarModalPdf = () => modalPdf.classList.add('hidden');

        btnCancelarPdf.addEventListener('click', () => {
            inputPdfDrag.value = '';
            dropZonePdf.classList.remove('active');
            dropTextPdf.textContent = "Arrastrá tu archivo .pdf acá o hacé clic para buscar";
            btnConfirmarPdf.disabled = true;
            btnConfirmarPdf.classList.add('btn-confirmar-disabled');
            labelNuevoPdf.classList.add('hidden');
            cerrarModalPdf();
        });

        dropZonePdf.addEventListener('click', () => inputPdfDrag.click());

        // Eventos Drag & Drop restaurados con las clases limpias
        dropZonePdf.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZonePdf.classList.add('drop-zone-hover');
        });

        dropZonePdf.addEventListener('dragleave', () => {
            if (!dropZonePdf.classList.contains('active')) {
                dropZonePdf.classList.remove('drop-zone-hover');
            }
        });

        dropZonePdf.addEventListener('drop', (e) => {
            e.preventDefault();
            if (e.dataTransfer.files.length > 0) {
                inputPdfDrag.files = e.dataTransfer.files;
                inputPdfDrag.dispatchEvent(new Event('change'));
            }
        });

        inputPdfDrag.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const archivo = e.target.files[0];
                if (archivo.name.toLowerCase().endsWith('.pdf')) {
                    dropTextPdf.innerHTML = `<strong>${archivo.name}</strong> listo para cargar.`;
                    dropZonePdf.classList.add('active');
                    btnConfirmarPdf.disabled = false;
                    btnConfirmarPdf.classList.remove('btn-confirmar-disabled');
                } else {
                    alert("Por favor, seleccioná exclusivamente un archivo con formato .pdf");
                    inputPdfDrag.value = '';
                    btnConfirmarPdf.disabled = true;
                    btnConfirmarPdf.classList.add('btn-confirmar-disabled');
                }
            }
        });

        btnConfirmarPdf.addEventListener('click', () => {
            if (inputPdfDrag.files.length > 0) {
                labelNuevoPdf.textContent = `Listo para guardar: ${inputPdfDrag.files[0].name}`;
                labelNuevoPdf.classList.remove('hidden');
                labelNuevoPdf.classList.add('d-inline-block');
            }
            cerrarModalPdf();
        });
    }
});