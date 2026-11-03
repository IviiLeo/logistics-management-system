from datetime import datetime
from decimal import Decimal
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import render, get_object_or_404
from django.core.paginator import Paginator
from django.contrib import messages
from django.db import transaction
from django.db.models import Q, Prefetch
from django.utils import timezone
from empleados.decorators import sesion_requerida
from hojas.models import HojaDeRuta
from pagos.models import Pago
from pedidos.models import Pedido
from .models import Entrega


def _obtener_fecha_hora_local(fecha_hora):
    if not fecha_hora:
        return None
    if timezone.is_aware(fecha_hora):
        return timezone.localtime(fecha_hora)
    return fecha_hora


# Muestra la lista de entregas ordenadas de manera descendente por ID
@sesion_requerida
def lista_entregas_web(request):
    # 1. Traemos todas las entregas ordenadas de manera descendente por ID junto a su hoja de ruta y pedidos
    entregas_db = (
        Entrega.objects.all()
        .select_related('hoja_de_ruta__transportista')
        .prefetch_related('pedidos')
        .order_by('-id')
    )

    # 2. Leemos los filtros enviados por la URL (request.GET)
    estado_filtro = (request.GET.get('estado', 'todos') or 'todos').strip()
    id_buscado = request.GET.get('id_entrega', '').strip()
    hoja_filtro = (request.GET.get('hoja') or request.GET.get('hoja_de_ruta') or request.GET.get('id_hoja', '')).strip()
    
    # Filtro por rango de fechas (fecha_desde / fecha_hasta) o fecha puntual
    fecha_filtro = (request.GET.get('fecha') or request.GET.get('fecha_entrega', '')).strip()
    fecha_desde_raw = (
        request.GET.get('fecha_desde') or
        request.GET.get('desde') or
        request.GET.get('fecha_inicio') or
        ''
    ).strip()
    fecha_hasta_raw = (
        request.GET.get('fecha_hasta') or
        request.GET.get('hasta') or
        request.GET.get('fecha_fin') or
        ''
    ).strip()

    # Si se envió fecha puntual pero no rango explícito, asignamos ambos extremos
    if fecha_filtro and not fecha_desde_raw and not fecha_hasta_raw:
        fecha_desde_raw = fecha_filtro
        fecha_hasta_raw = fecha_filtro

    # 3. Primero se filtra por ID de entrega (si se especificó)
    continuar_filtros = True
    if id_buscado:
        id_limpio = id_buscado.upper().replace('ENT-', '').replace('ID-', '').strip()
        if id_limpio.isdigit():
            # Coincidencia exacta por ID (id = número), sin valores semejantes ni parciales
            entregas_db = entregas_db.filter(id__exact=int(id_limpio))
            # Si no encuentra nada por ID, se detiene la búsqueda aquí
            if not entregas_db.exists():
                entregas_db = Entrega.objects.none()
                continuar_filtros = False
        else:
            messages.error(request, "El ID de entrega buscado debe ser un número.")
            entregas_db = Entrega.objects.none()
            continuar_filtros = False

    # 4. Si se encontró la entrega por ID (o no se filtró por ID), se verifican los otros filtros
    if continuar_filtros:
        # Filtro por estado
        estados_validos = [codigo for codigo, _ in Entrega.ESTADOS]
        if estado_filtro in estados_validos:
            entregas_db = entregas_db.filter(estado=estado_filtro)

        # Filtro por Hoja de Ruta
        if hoja_filtro:
            hoja_limpia = hoja_filtro.upper().replace('HR-', '').replace('HOJA-', '').strip()
            if hoja_limpia.isdigit():
                entregas_db = entregas_db.filter(hoja_de_ruta_id=int(hoja_limpia))
            else:
                messages.error(request, "El ID de hoja de ruta debe ser un número.")
                entregas_db = Entrega.objects.none()

        # Filtro por rango de fechas (desde / hasta)
        d_desde = None
        d_hasta = None

        if fecha_desde_raw:
            try:
                d_desde = datetime.strptime(fecha_desde_raw, '%Y-%m-%d').date()
            except ValueError:
                messages.error(request, "La fecha 'desde' debe tener el formato AAAA-MM-DD.")
                entregas_db = Entrega.objects.none()
                continuar_filtros = False

        if continuar_filtros and fecha_hasta_raw:
            try:
                d_hasta = datetime.strptime(fecha_hasta_raw, '%Y-%m-%d').date()
            except ValueError:
                messages.error(request, "La fecha 'hasta' debe tener el formato AAAA-MM-DD.")
                entregas_db = Entrega.objects.none()
                continuar_filtros = False

        if continuar_filtros and d_desde and d_hasta and d_desde > d_hasta:
            messages.error(request, "La fecha 'desde' no puede ser posterior a la fecha 'hasta'.")
            entregas_db = Entrega.objects.none()
            continuar_filtros = False

        if continuar_filtros and (d_desde or d_hasta):
            q_fecha_hora = Q()
            q_hoja = Q()

            if d_desde:
                q_fecha_hora &= Q(fecha_hora__date__gte=d_desde)
                q_hoja &= Q(hoja_de_ruta__fecha__gte=d_desde)

            if d_hasta:
                q_fecha_hora &= Q(fecha_hora__date__lte=d_hasta)
                q_hoja &= Q(hoja_de_ruta__fecha__lte=d_hasta)

            entregas_db = entregas_db.filter(q_fecha_hora | q_hoja)

    # 5. Paginamos la lista resultante de a 30 por página
    paginador = Paginator(entregas_db, 30)
    numero_pagina = request.GET.get('pagina')
    pagina_de_entregas = paginador.get_page(numero_pagina)

    # Enriquecemos cada entrega de la página con los atributos esperados por entregas.html
    for entrega in pagina_de_entregas.object_list:
        fh_local = _obtener_fecha_hora_local(entrega.fecha_hora)
        entrega.fecha = fh_local.date() if fh_local else (entrega.hoja_de_ruta.fecha if entrega.hoja_de_ruta else None)
        entrega.hora = fh_local.time() if (fh_local and entrega.estado != 'en_proceso') else None
        entrega.hoja_id = entrega.hoja_de_ruta_id

        if entrega.hoja_de_ruta and entrega.hoja_de_ruta.transportista:
            t = entrega.hoja_de_ruta.transportista
            entrega.transportista = f"{t.nombre} {t.apellido}"
        else:
            entrega.transportista = ""

        pedidos_lista = list(entrega.pedidos.all())
        primer_pedido = pedidos_lista[0] if pedidos_lista else None
        entrega.comercio = primer_pedido.razon_social_comercio if primer_pedido else "—"
        entrega.domicilio = primer_pedido.domicilio_comercio if primer_pedido else ""
        entrega.cantidad_pedidos = len(pedidos_lista)

    hay_filtros = bool(
        id_buscado
        or hoja_filtro
        or fecha_filtro
        or fecha_desde_raw
        or fecha_hasta_raw
        or (estado_filtro and estado_filtro != 'todos')
    )

    # Guardamos los filtros actuales para la paginación sin el parámetro de página
    filtros = request.GET.copy()
    if 'pagina' in filtros:
        del filtros['pagina']
    parametros_url = filtros.urlencode()

    # 6. Armamos el contexto para el HTML
    contexto = {
        'lista_de_entregas': pagina_de_entregas,
        'estado_actual': estado_filtro,
        'estados_disponibles': Entrega.ESTADOS,
        'id_buscado': id_buscado,
        'hoja_buscada': hoja_filtro,
        'fecha_buscada': fecha_filtro,
        'fecha_desde': fecha_desde_raw,
        'fecha_hasta': fecha_hasta_raw,
        'fecha_desde_buscada': fecha_desde_raw,
        'fecha_hasta_buscada': fecha_hasta_raw,
        'hoja_filtro': hoja_filtro,
        'fecha_filtro': fecha_filtro,
        'hay_filtros': hay_filtros,
        'parametros_url': parametros_url,
    }

    return render(request, 'entregas/entregas.html', contexto)


# Muestra el detalle de una entrega específica junto a sus pedidos y pagos asociados
@sesion_requerida
def ver_detalle_web(request, entrega_id):
    # 1. Buscamos la entrega por ID trayendo también su hoja de ruta vinculada
    entrega_db = get_object_or_404(
        Entrega.objects.select_related('hoja_de_ruta__transportista'),
        id=entrega_id
    )

    # 2. Obtenemos todos los pedidos asociados a esta entrega
    pedidos_asociados = list(entrega_db.pedidos.all().order_by('-id'))

    # 3. Obtenemos todos los pagos asociados a esta entrega
    pagos_asociados = list(entrega_db.pagos.all().order_by('-fecha_hora'))

    # 4. Atributos de presentación para entrega_db en detalle_entrega.html
    fh_local = _obtener_fecha_hora_local(entrega_db.fecha_hora)
    entrega_db.fecha = fh_local.date() if fh_local else (entrega_db.hoja_de_ruta.fecha if entrega_db.hoja_de_ruta else None)
    entrega_db.hora = fh_local.time() if (fh_local and entrega_db.estado != 'en_proceso') else None
    entrega_db.hoja_id = entrega_db.hoja_de_ruta_id
    entrega_db.observaciones = getattr(entrega_db, 'observaciones', '')

    primer_pedido = pedidos_asociados[0] if pedidos_asociados else None
    entrega_db.comercio = primer_pedido.razon_social_comercio if primer_pedido else ""
    entrega_db.domicilio = primer_pedido.domicilio_comercio if primer_pedido else ""

    # 5. Calculamos el resumen de cobros (sin contar pagos rechazados)
    monto_total_pedidos = sum((pedido.monto_total for pedido in pedidos_asociados), Decimal('0.00'))
    pagos_no_rechazados = [pago for pago in pagos_asociados if pago.estado != 'rechazado']
    monto_total_pagos = sum((pago.monto for pago in pagos_no_rechazados), Decimal('0.00'))
    diferencia = monto_total_pedidos - monto_total_pagos

    por_metodo = []
    for codigo, _ in Pago.METODOS_PAGO:
        monto_metodo = sum(
            (pago.monto for pago in pagos_no_rechazados if pago.metodo_pago == codigo),
            Decimal('0.00')
        )
        if monto_metodo > Decimal('0.00'):
            por_metodo.append({
                'codigo': codigo,
                'monto': monto_metodo,
            })

    resumen = {
        'a_cobrar': monto_total_pedidos,
        'registrado': monto_total_pagos,
        'diferencia': diferencia,
        'por_metodo': por_metodo,
    }

    # 6. Preparamos los atributos que detalle_entrega.html espera en cada pedido
    metodos_entrega = [item['codigo'] for item in por_metodo]
    for pedido in pedidos_asociados:
        pedido.proveedor = pedido.razon_social_proveedor
        pedido.estado_texto = pedido.get_estado_display()
        pedido.metodos = metodos_entrega
        pedido.monto = pedido.monto_total

    # 7. Agrupamos los pagos por método de pago para la sección inferior
    ids_pedidos_entrega = [pedido.id for pedido in pedidos_asociados]
    grupos_pago = []
    for codigo, nombre in Pago.METODOS_PAGO:
        pagos_del_grupo = []
        for pago in pagos_asociados:
            if pago.metodo_pago == codigo:
                pago.pedidos = ids_pedidos_entrega
                pagos_del_grupo.append(pago)
        grupos_pago.append({
            'codigo': codigo,
            'nombre': nombre,
            'pagos': pagos_del_grupo,
        })

    # 8. Armamos el contexto con los datos pertinentes
    contexto = {
        'entrega': entrega_db,
        'pedidos': pedidos_asociados,
        'pagos': pagos_asociados,
        'monto_total_pedidos': monto_total_pedidos,
        'monto_total_pagos': monto_total_pagos,
        'resumen': resumen,
        'cantidad_pagos': len(pagos_asociados),
        'grupos_pago': grupos_pago,
    }

    return render(request, 'entregas/detalle_entrega.html', contexto)


# =========================================================
# --- VISTAS API (Devuelven JSON para la app móvil en Expo) ---
# =========================================================

@api_view(['GET'])
def detalle_entrega_api(request, entrega_id):
    """
    Endpoint para la App Móvil:
    Devuelve el detalle de la entrega, sus pagos (id, metodo y monto)
    y pedidos (id, razon social comercio y monto) asociados.
    """
    try:
        entrega_db = Entrega.objects.prefetch_related(
            Prefetch(
                'pagos',
                queryset=Pago.objects.only('id', 'metodo_pago', 'monto', 'entrega_id').order_by('-id')
            ),
            Prefetch(
                'pedidos',
                queryset=Pedido.objects.only('id', 'razon_social_comercio', 'monto_total', 'entrega_id').order_by('-id')
            )
        ).get(id=entrega_id)
    except Entrega.DoesNotExist:
        return Response(
            {"mensaje": f"No existe ninguna entrega con el ID #{entrega_id}."},
            status=status.HTTP_404_NOT_FOUND
        )

    return Response(entrega_db.detalle_api(), status=status.HTTP_200_OK)


@api_view(['POST', 'PATCH', 'PUT'])
def cambiar_estado_entrega_api(request, entrega_id):
    """
    Endpoint para la App Móvil:
    Recibe el ID de una entrega por URL y un estado posible ('en_proceso', 'entregada', 'no_entregada')
    en el cuerpo JSON: {"estado": "entregada"}.
    Si la entrega pasa a 'entregada', sus pedidos pasan a 'entregado'.
    Si la entrega pasa a 'no_entregada', sus pedidos pasan a 'no_entregado'.
    """
    try:
        entrega_db = Entrega.objects.get(id=entrega_id)
    except Entrega.DoesNotExist:
        return Response(
            {"error": f"No existe ninguna entrega con el ID #{entrega_id}."},
            status=status.HTTP_404_NOT_FOUND
        )

    if not isinstance(request.data, dict):
        return Response(
            {"error": "El cuerpo de la petición debe ser un objeto JSON con el campo 'estado'."},
            status=status.HTTP_400_BAD_REQUEST
        )

    estado_destino = request.data.get('estado') or request.data.get('nuevo_estado', '')
    if not estado_destino:
        return Response(
            {"error": "Debes especificar el nuevo estado para la entrega en el JSON ('estado')."},
            status=status.HTTP_400_BAD_REQUEST
        )

    estado_destino = str(estado_destino).strip().lower()
    estados_validos = [codigo for codigo, _ in Entrega.ESTADOS]

    if estado_destino not in estados_validos:
        return Response(
            {
                "error": f"El estado '{estado_destino}' no es válido.",
                "estados_permitidos": estados_validos
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    with transaction.atomic():
        entrega_db.cambiar_estado(estado_destino)

    return Response({
        "mensaje": f"El estado de la entrega #{entrega_db.id} fue actualizado a '{entrega_db.get_estado_display()}'.",
        "entrega_id": entrega_db.id,
        "estado": entrega_db.estado,
        "estado_display": entrega_db.get_estado_display()
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
def crear_entrega_api(request):
    """
    Endpoint para la App Móvil:
    Crea una nueva entrega asociada a una hoja de ruta y a los pedidos especificados mediante JSON.
    - El estado se crea por default en 'en_proceso'.
    - La fecha/hora se toma automáticamente la del momento de creación.
    Formato esperado:
    {
        "hoja_de_ruta": 1,
        "pedidos": [1, 2, 3]
    }
    """
    if not isinstance(request.data, dict):
        return Response(
            {"error": "El cuerpo de la petición debe ser un objeto JSON con 'hoja_de_ruta' y 'pedidos'."},
            status=status.HTTP_400_BAD_REQUEST
        )

    # 1. Obtenemos y validamos el ID de la hoja de ruta desde el JSON
    hoja_input = (
        request.data.get('hoja_de_ruta')
        or request.data.get('hoja_de_ruta_id')
        or request.data.get('id_hoja')
    )

    if hoja_input is None:
        return Response(
            {"error": "Debes especificar el ID de la hoja de ruta en el JSON ('hoja_de_ruta')."},
            status=status.HTTP_400_BAD_REQUEST
        )

    hoja_str = str(hoja_input).upper().replace('HR-', '').strip()
    if not hoja_str.isdigit():
        return Response(
            {"error": f"El ID de hoja de ruta '{hoja_input}' no es válido. Debe ser un número."},
            status=status.HTTP_400_BAD_REQUEST
        )

    hoja_id_int = int(hoja_str)
    if not HojaDeRuta.objects.filter(id=hoja_id_int).exists():
        return Response(
            {"error": f"No existe ninguna hoja de ruta con el ID #{hoja_id_int}."},
            status=status.HTTP_404_NOT_FOUND
        )

    # 2. Obtenemos y validamos los IDs de pedidos desde el JSON
    pedidos_ids = (
        request.data.get('pedidos')
        or request.data.get('pedidos_ids')
        or request.data.get('id_pedidos')
        or request.data.get('pedidos_id')
    )

    if isinstance(pedidos_ids, (int, str)) and str(pedidos_ids).isdigit():
        pedidos_ids = [int(pedidos_ids)]

    if not pedidos_ids or not isinstance(pedidos_ids, list):
        return Response(
            {"error": "Debes proporcionar una lista con al menos un ID de pedido en el campo 'pedidos'."},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Limpiamos y validamos que todos los IDs sean numéricos
    ids_limpios = []
    for item in pedidos_ids:
        if isinstance(item, int):
            ids_limpios.append(item)
        elif isinstance(item, str) and item.strip().isdigit():
            ids_limpios.append(int(item.strip()))
        elif isinstance(item, dict) and 'id' in item and str(item['id']).isdigit():
            ids_limpios.append(int(item['id']))
        else:
            return Response(
                {"error": f"El ID de pedido '{item}' no es válido. Debe ser un número entero."},
                status=status.HTTP_400_BAD_REQUEST
            )

    if not ids_limpios:
        return Response(
            {"error": "La lista de IDs de pedidos no contiene ningún elemento válido."},
            status=status.HTTP_400_BAD_REQUEST
        )

    ids_unicos = list(set(ids_limpios))
    pedidos_lista = list(
        Pedido.objects.filter(id__in=ids_unicos)
        .only('id', 'razon_social_comercio', 'monto_total')
        .order_by('-id')
    )

    if len(pedidos_lista) != len(ids_unicos):
        ids_encontrados = {p.id for p in pedidos_lista}
        ids_faltantes = list(set(ids_unicos) - ids_encontrados)
        return Response(
            {"error": f"Los siguientes pedidos no existen en la base de datos: {ids_faltantes}."},
            status=status.HTTP_404_NOT_FOUND
        )

    # 3. Creamos la entrega en la base de datos
    with transaction.atomic():
        nueva_entrega = Entrega.objects.create(
            hoja_de_ruta_id=hoja_id_int,
            estado='en_proceso'  # Por default en proceso; fecha_hora auto_now_add toma el momento de creación
        )
        Pedido.objects.filter(id__in=ids_unicos).update(entrega=nueva_entrega)

    return Response(
        nueva_entrega.detalle_api(pagos=[], pedidos=pedidos_lista),
        status=status.HTTP_201_CREATED
    )


@api_view(['DELETE'])
def borrar_entrega_api(request, entrega_id):
    """
    Endpoint para la App Móvil:
    Elimina una entrega en curso si el transportista decide cancelarla.
    """
    try:
        entrega_db = Entrega.objects.get(id=entrega_id)
        entrega_db.delete()
        
        return Response(
            {"mensaje": f"La entrega #{entrega_id} fue eliminada correctamente."},
            status=status.HTTP_200_OK
        )
    except Entrega.DoesNotExist:
        return Response(
            {"error": f"No se encontró la entrega #{entrega_id}."},
            status=status.HTTP_404_NOT_FOUND
        )