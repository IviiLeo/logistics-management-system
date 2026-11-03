import csv
import io
from pathlib import Path
from django.db import transaction
from django.http import FileResponse, JsonResponse
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.core.exceptions import ValidationError
from django.core.paginator import Paginator
from django.utils import timezone
from .models import Pedido
from empleados.decorators import sesion_requerida
from datetime import datetime, timedelta, date

# =========================================================
# --- VISTAS WEB (Devuelven HTML para el navegador) ---
# =========================================================

# Devuelve al Front WEB la lista paginada (30 por página) permitiendo filtrar por estado y/o buscar por ID
@sesion_requerida
def lista_pedidos_web(request):
    # 1. Partimos de todos los pedidos ordenados del más reciente al más antiguo
    pedidos_db = Pedido.objects.all().order_by('-id')

    # 2. Leemos los filtros que el Front-End envía por la URL (request.GET)
    estado_filtro = (request.GET.get('estado') or request.GET.get('estado_pedido') or 'todos').strip()
    id_buscado = (request.GET.get('id_pedido') or request.GET.get('id') or request.GET.get('buscador_pedidos', '')).strip()
    fecha_filtro = (request.GET.get('fecha_entrega') or request.GET.get('fecha') or request.GET.get('fecha_pedido', '')).strip()

    # 3. Filtro por buscador de ID de pedido particular (coincidencia exacta)
    if id_buscado:
        # Limpiamos prefijo 'PD-' o 'ID-' por si el usuario escribe 'PD-12' o 'ID-12' en el buscador
        id_limpio = id_buscado.upper().replace('PD-', '').replace('ID-', '').strip()
        if id_limpio.isdigit():
            pedidos_db = pedidos_db.filter(id__exact=int(id_limpio))
        else:
            messages.error(request, "El ID de pedido buscado debe ser un número.")
            pedidos_db = Pedido.objects.none()

    # 4. Filtro por fecha de entrega
    if fecha_filtro:
        try:
            fecha_valida = datetime.strptime(fecha_filtro, '%Y-%m-%d').date()
            pedidos_db = pedidos_db.filter(fecha_entrega=fecha_valida)
        except ValueError:
            messages.error(request, "La fecha ingresada debe tener el formato AAAA-MM-DD.")
            pedidos_db = Pedido.objects.none()

    # 5. Filtro por desplegable de Estado (si eligió uno distinto de 'todos')
    estado_normalizado = estado_filtro.replace('-', '_')
    estados_validos = [codigo for codigo, _ in Pedido.ESTADOS_PEDIDO]
    if estado_normalizado in estados_validos:
        pedidos_db = pedidos_db.filter(estado=estado_normalizado)

    # 6. Dividimos la lista resultante en páginas de 30 pedidos cada una
    paginador = Paginator(pedidos_db, 30)
    numero_pagina = request.GET.get('pagina')
    pagina_de_pedidos = paginador.get_page(numero_pagina)
    fechamin = timezone.localdate() + timedelta(days=1)

    # Guardamos los filtros actuales (id_pedido, estado, fecha_entrega) sin el número de página
    filtros = request.GET.copy()
    if 'pagina' in filtros:
        del filtros['pagina']
    parametros_url = filtros.urlencode()

    # 7. Enviamos al HTML los pedidos paginados y los filtros actuales para mantenerlos seleccionados en pantalla
    contexto = {
        'lista_de_pedidos': pagina_de_pedidos,
        'estado_actual': estado_filtro,
        'id_buscado': id_buscado,
        'fecha_buscada': fecha_filtro,
        'fecha_filtro': fecha_filtro,
        'estados_disponibles': Pedido.ESTADOS_PEDIDO,
        'fecha_minima': fechamin.strftime('%Y-%m-%d'),
        'parametros_url': parametros_url,
    }

    return render(request, 'pedidos/pedidos.html', contexto)


# Permite cargar un pedido individual desde el modal en pedidos.html (incluyendo el PDF del remito)
@sesion_requerida
def crear_pedido_web(request):
    es_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'

    if request.method == 'POST':
        # Capturamos los textos escritos en el formulario HTML
        cuit_comercio = request.POST.get('cuit_comercio', '').strip()
        razon_social_comercio = request.POST.get('razon_social_comercio', '').strip()
        domicilio_comercio = request.POST.get('domicilio_comercio', '').strip()
        cuit_proveedor = request.POST.get('cuit_proveedor', '').strip()
        razon_social_proveedor = request.POST.get('razon_social_proveedor', '').strip()
        monto_total = request.POST.get('monto_total', '').strip().replace(',', '.')
        fecha_entrega = request.POST.get('fecha_entrega', '').strip()
        # Los archivos adjuntos (como el PDF) vienen en request.FILES, no en request.POST
        archivo_remito = request.FILES.get('remito')

        # Armamos el objeto Pedido en memoria con los datos recibidos
        # (estado='pendiente' y fecha_creacion se asignan automáticamente por el modelo)
        nuevo_pedido = Pedido(
            cuit_comercio=cuit_comercio,
            razon_social_comercio=razon_social_comercio,
            domicilio_comercio=domicilio_comercio,
            cuit_proveedor=cuit_proveedor,
            razon_social_proveedor=razon_social_proveedor,
            monto_total=monto_total,
            remito=archivo_remito,
            fecha_entrega=fecha_entrega
        )

        errores_lista = []
        campos_invalidos = []

        # En la carga individual verificamos que se haya adjuntado el remito en PDF
        if not archivo_remito:
            errores_lista.append("Debes adjuntar el remito en formato PDF.")
            campos_invalidos.append('remito')

        try:
            # Ejecutamos las validaciones del modelo (los 11 dígitos del CUIT, que sea PDF, fecha futura, etc.)
            nuevo_pedido.full_clean()
        except ValidationError as error_validacion:
            cuit_error_mostrado = False
            for campo, lista_errores in error_validacion.message_dict.items():
                campos_invalidos.append(campo)
                if campo in ('cuit_comercio', 'cuit_proveedor'):
                    if not cuit_error_mostrado:
                        errores_lista.append("El CUIT debe tener solamente 11 dígitos.")
                        cuit_error_mostrado = True
                else:
                    for error in lista_errores:
                        errores_lista.append(f"{error}")

        # Si hubo errores de validación, no cerramos el modal ni borramos los datos válidos
        if errores_lista:
            if es_ajax:
                return JsonResponse({
                    'exito': False,
                    'errores': errores_lista,
                    'campos_invalidos': campos_invalidos,
                }, status=400)

            for err in errores_lista:
                messages.error(request, err)

            datos_validos = {
                'razon_social_comercio': razon_social_comercio if 'razon_social_comercio' not in campos_invalidos else '',
                'cuit_comercio': cuit_comercio if 'cuit_comercio' not in campos_invalidos else '',
                'razon_social_proveedor': razon_social_proveedor if 'razon_social_proveedor' not in campos_invalidos else '',
                'cuit_proveedor': cuit_proveedor if 'cuit_proveedor' not in campos_invalidos else '',
                'domicilio_comercio': domicilio_comercio if 'domicilio_comercio' not in campos_invalidos else '',
                'monto_total': monto_total if 'monto_total' not in campos_invalidos else '',
                'fecha_entrega': fecha_entrega if 'fecha_entrega' not in campos_invalidos else '',
            }
            pedidos_db = Pedido.objects.all().order_by('-id')
            paginador = Paginator(pedidos_db, 30)
            fechamin = timezone.localdate() + timedelta(days=1)
            contexto = {
                'lista_de_pedidos': paginador.get_page(1),
                'estado_actual': 'todos',
                'id_buscado': '',
                'estados_disponibles': Pedido.ESTADOS_PEDIDO,
                'abrir_modal_nuevo': True,
                'datos_nuevo_pedido': datos_validos,
                'fecha_minima': fechamin.strftime('%Y-%m-%d'),
            }
            return render(request, 'pedidos/pedidos.html', contexto)

        # Si pasó todas las validaciones, lo guardamos en SQLite y guardamos el PDF en media/remitos/
        nuevo_pedido.save()
        messages.success(request, "El pedido se creó correctamente.")
        if es_ajax:
            return JsonResponse({'exito': True})
        return redirect('lista_pedidos_web')

    return redirect('lista_pedidos_web')


# Muestra la información completa de un único pedido (sin enviar el PDF del remito) y el ID de su entrega
@sesion_requerida
def detalle_pedido_web(request, pedido_id):
    # 1. Buscamos el pedido trayendo también su hoja de ruta y entrega en una sola consulta SQL
    pedido_db = get_object_or_404(
        Pedido.objects.select_related('hoja_de_ruta', 'entrega'),
        id=pedido_id
    )
    # Guardamos un booleano para que el HTML sepa si debe mostrar el botón "Ver Remito" y limpiamos el archivo en memoria
    tiene_remito = bool(pedido_db.remito)
    pedido_db.remito = None

    # Verificamos que la fecha de entrega sea estrictamente mayor a hoy
    se_puede_editar = pedido_db.fecha_entrega > timezone.localdate()

    if pedido_db.entrega:
        fh = pedido_db.entrega.fecha_hora
        if fh and timezone.is_aware(fh):
            fh = timezone.localtime(fh)
        pedido_db.entrega.fecha = fh.date() if fh else (pedido_db.hoja_de_ruta.fecha if pedido_db.hoja_de_ruta else None)

    # 2. Armamos el contexto con el pedido, si tiene remito y el ID de su entrega
    contexto = {
        'pedido': pedido_db,
        'tiene_remito': tiene_remito,
        'entrega': pedido_db.entrega,
        'se_puede_editar': se_puede_editar,
    }

    # 3. Renderizamos la página de detalle con los datos del pedido
    return render(request, 'pedidos/detallePedido.html', contexto)


# Abre el archivo PDF del remito de un pedido directamente en el navegador
@sesion_requerida
def ver_remito_web(request, pedido_id):
    # Solo consultamos las columnas 'id' y 'remito' para hacer la consulta más liviana
    pedido_db = get_object_or_404(Pedido.objects.only('id', 'remito'), id=pedido_id)

    if not pedido_db.remito:
        messages.error(request, f"El pedido #{pedido_db.id} no tiene un remito PDF adjunto.")
        return redirect('detalle_pedido_web', pedido_id=pedido_db.id)

    try:
        # as_attachment=False indica al navegador que abra el PDF en pantalla en lugar de descargarlo
        return FileResponse(
            pedido_db.remito.open('rb'),
            content_type='application/pdf',
            as_attachment=False
        )
    except FileNotFoundError:
        messages.error(request, "El archivo PDF del remito no se encontró en el servidor.")
        return redirect('detalle_pedido_web', pedido_id=pedido_db.id)


# Permite modificar los datos de un pedido existente buscándolo por su ID
@sesion_requerida
def modificar_pedido_web(request, pedido_id):
    # 1. Buscamos el pedido original en la base de datos (si no existe, devuelve error 404)
    pedido_db = get_object_or_404(Pedido, id=pedido_id)

    # Regla de negocio: El día de la entrega (o después) no se permite modificar los datos del pedido
    if pedido_db.fecha_entrega <= timezone.localdate():
        messages.error(request, "No se permite modificar un pedido en el día de su entrega o en una fecha posterior.")
        return redirect('detalle_pedido_web', pedido_id=pedido_db.id)

    # Si el usuario envió los cambios desde el formulario (Método POST)
    if request.method == 'POST':
        nuevo_estado = request.POST.get('estado', '').strip()
        estados_validos = [codigo for codigo, _ in Pedido.ESTADOS_PEDIDO]
        if nuevo_estado in estados_validos:
            pedido_db.estado = nuevo_estado

        # Actualizamos los atributos del objeto con los nuevos valores enviados
        pedido_db.cuit_comercio = request.POST.get('cuit_comercio', '').strip()
        pedido_db.razon_social_comercio = request.POST.get('razon_social_comercio', '').strip()
        pedido_db.domicilio_comercio = request.POST.get('domicilio_comercio', '').strip()
        pedido_db.cuit_proveedor = request.POST.get('cuit_proveedor', '').strip()
        pedido_db.razon_social_proveedor = request.POST.get('razon_social_proveedor', '').strip()
        pedido_db.monto_total = request.POST.get('monto_total', '').strip().replace(',', '.')
        pedido_db.fecha_entrega = request.POST.get('fecha_entrega', '').strip()
        # Solo reemplazamos el PDF del remito si el usuario adjuntó un archivo nuevo
        nuevo_remito = request.FILES.get('remito')
        if nuevo_remito:
            pedido_db.remito = nuevo_remito

        try:
            # Validamos todos los campos con las reglas del modelo antes de guardar
            pedido_db.full_clean()
            pedido_db.save()
            messages.success(request, "El pedido se modificó correctamente.")
            return redirect('lista_pedidos_web')

        except ValidationError as error_validacion:
            cuit_error_mostrado = False
            for campo, lista_errores in error_validacion.message_dict.items():
                if campo in ('cuit_comercio', 'cuit_proveedor'):
                    if not cuit_error_mostrado:
                        messages.error(request, "El CUIT debe tener solamente 11 dígitos.")
                        cuit_error_mostrado = True
                else:
                    for error in lista_errores:
                        messages.error(request, f"{campo}: {error}")

    return redirect('detalle_pedido_web', pedido_id=pedido_db.id)


# Permite eliminar un pedido existente siempre que se encuentre en fecha editable
@sesion_requerida
def eliminar_pedido_web(request, pedido_id):
    pedido_db = get_object_or_404(Pedido, id=pedido_id)

    if pedido_db.fecha_entrega <= timezone.localdate():
        messages.error(request, "No se permite eliminar un pedido en el día de su entrega o en una fecha posterior.")
        return redirect('detalle_pedido_web', pedido_id=pedido_db.id)

    if request.method == 'POST':
        pedido_db.delete()
        messages.success(request, f"El pedido PD-{pedido_id} fue eliminado correctamente.")
        return redirect('lista_pedidos_web')

    return redirect('detalle_pedido_web', pedido_id=pedido_db.id)


# Actualiza únicamente el estado de un pedido (ej: desde un selector rápido en la tabla o en el detalle)
@sesion_requerida
def cambiar_estado_pedido_web(request, pedido_id):
    pedido_db = get_object_or_404(Pedido, id=pedido_id)

    if request.method == 'POST':
        nuevo_estado = request.POST.get('estado')
        estados_validos = [codigo for codigo, _ in Pedido.ESTADOS_PEDIDO]

        if nuevo_estado in estados_validos:
            pedido_db.estado = nuevo_estado
            # update_fields=['estado'] actualiza solo esa columna en SQLite y evita que el validador
            # de fecha_entrega futura bloquee el cambio de estado cuando llega el día de entrega
            pedido_db.save(update_fields=['estado'])
            messages.success(request, f"El estado del pedido #{pedido_db.id} cambió a '{pedido_db.get_estado_display()}'.")
        else:
            messages.error(request, "El estado seleccionado no es válido.")

    return redirect('detalle_pedido_web', pedido_id=pedido_db.id)


# Permite subir un archivo CSV para crear múltiples pedidos a la vez (sin remito PDF)
@sesion_requerida
def cargar_pedidos_csv_web(request):
    if request.method == 'POST':
        archivo_csv = request.FILES.get('archivo_csv')

        if not archivo_csv:
            messages.error(request, "Debes seleccionar un archivo CSV.")
            return redirect('lista_pedidos_web')

        if not archivo_csv.name.lower().endswith('.csv'):
            messages.error(request, "El archivo debe tener extensión .csv.")
            return redirect('lista_pedidos_web')

        try:
            # Leemos el contenido del archivo (utf-8-sig limpia el BOM si fue guardado desde Excel)
            contenido = archivo_csv.read().decode('utf-8-sig')
        except UnicodeDecodeError:
            archivo_csv.seek(0)
            contenido = archivo_csv.read().decode('latin-1')

        # Detectamos automáticamente si el CSV usa coma (,) o punto y coma (;) como separador
        lineas = contenido.splitlines()
        primera_linea = lineas[0] if lineas else ''
        separador = ';' if ';' in primera_linea else ','

        lector = csv.DictReader(io.StringIO(contenido), delimiter=separador)
        if lector.fieldnames:
            # Limpiamos espacios accidentales en los nombres de las columnas del encabezado
            lector.fieldnames = [col.strip() for col in lector.fieldnames]

        # Verificamos que el archivo CSV tenga todos los encabezados requeridos
        columnas_requeridas = {
            'cuit_comercio',
            'razon_social_comercio',
            'domicilio_comercio',
            'cuit_proveedor',
            'razon_social_proveedor',
            'monto_total',
            'fecha_entrega',
        }
        columnas_csv = set(lector.fieldnames or [])
        columnas_faltantes = columnas_requeridas - columnas_csv
        if columnas_faltantes:
            messages.error(
                request,
                f"Al archivo CSV le faltan las siguientes columnas: {', '.join(sorted(columnas_faltantes))}"
            )
            return redirect('lista_pedidos_web')

        pedidos_a_guardar = []
        errores_csv = []

        # Recorremos cada fila del CSV (la fila 1 son los encabezados, así que los datos empiezan en la fila 2)
        for numero_fila, fila in enumerate(lector, start=2):
            # Ignoramos filas que estén completamente vacías (muy común al final de un CSV exportado de Excel)
            if not any((valor or '').strip() for valor in fila.values()):
                continue

            pedido_temp = Pedido(
                cuit_comercio=(fila.get('cuit_comercio') or '').strip(),
                razon_social_comercio=(fila.get('razon_social_comercio') or '').strip(),
                domicilio_comercio=(fila.get('domicilio_comercio') or '').strip(),
                cuit_proveedor=(fila.get('cuit_proveedor') or '').strip(),
                razon_social_proveedor=(fila.get('razon_social_proveedor') or '').strip(),
                monto_total=(fila.get('monto_total') or '').strip().replace(',', '.'),
                fecha_entrega=(fila.get('fecha_entrega') or '').strip(),
            )

            try:
                # Validamos la fila con las mismas reglas del modelo (CUITs de 11 dígitos, monto > 0, fecha futura, etc.)
                pedido_temp.full_clean()
                pedidos_a_guardar.append(pedido_temp)
            except ValidationError as error_validacion:
                for campo, lista_errores in error_validacion.message_dict.items():
                    for error in lista_errores:
                        errores_csv.append(f"Fila {numero_fila} ({campo}): {error}")

        # Si hubo errores en alguna fila, informamos todos los errores y no guardamos el archivo a medias
        if errores_csv:
            for mensaje_error in errores_csv:
                messages.error(request, mensaje_error)
            return redirect('lista_pedidos_web')

        if not pedidos_a_guardar:
            messages.error(request, "El archivo CSV no contiene filas con pedidos para cargar.")
            return redirect('lista_pedidos_web')

        # Insertamos todos los pedidos en una única consulta SQL dentro de una transacción segura
        with transaction.atomic():
            Pedido.objects.bulk_create(pedidos_a_guardar)

        messages.success(request, f"Se cargaron {len(pedidos_a_guardar)} pedidos correctamente desde el CSV.")
        return redirect('lista_pedidos_web')

    return redirect('lista_pedidos_web')


# Descarga el archivo CSV de ejemplo con las columnas y el formato requerido para importar pedidos
@sesion_requerida
def descargar_csv_ejemplo_web(request):
    ruta_csv = Path(__file__).resolve().parent / 'static' / 'pedidos' / 'ejemplo_pedidos.csv'

    if not ruta_csv.exists():
        messages.error(request, "El archivo CSV de ejemplo no se encontró en el servidor.")
        return redirect('lista_pedidos_web')

    # as_attachment=True fuerza al navegador a descargar el archivo con el nombre indicado
    return FileResponse(
        open(ruta_csv, 'rb'),
        content_type='text/csv; charset=utf-8',
        as_attachment=True,
        filename='ejemplo_pedidos.csv'
    )
