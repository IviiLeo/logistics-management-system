from datetime import datetime
from django.http import JsonResponse
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.core.paginator import Paginator
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .models import Pago
from .serializers import PagoSerializer
from entregas.models import Entrega
from empleados.decorators import sesion_requerida

# =========================================================
# --- VISTAS WEB (Devuelven HTML para el navegador) ---
# =========================================================

# Devuelve al Front WEB la lista de pagos permitiendo filtrar por estado, método de pago, ID de pago, ID de entrega o fecha
@sesion_requerida
def lista_pagos_web(request):
    # 1. Traemos todos los pagos ordenados del más reciente al más antiguo con su entrega y pedidos asociados
    pagos_db = (
        Pago.objects.all()
        .select_related('entrega')
        .prefetch_related('entrega__pedidos')
        .order_by('-id')
    )

    # 2. Leemos los filtros que el Front-End envía por la URL (request.GET)
    estado_filtro = request.GET.get('estado', 'todos').strip()
    metodo_filtro = request.GET.get('metodo_pago', 'todos').strip()
    id_buscado = (request.GET.get('id_pago') or request.GET.get('id', '')).strip()
    entrega_filtro = (request.GET.get('id_entrega') or request.GET.get('entrega', '')).strip()
    fecha_filtro = (request.GET.get('fecha_pago') or request.GET.get('fecha', '')).strip()

    # 3. Primero se filtra por ID de pago (coincidencia exacta, sin valores semejantes)
    continuar_filtros = True
    if id_buscado:
        id_limpio = id_buscado.upper().replace('PG-', '').replace('ID-', '').strip()
        if id_limpio.isdigit():
            # Coincidencia exacta por ID (id = número), no valores semejantes ni parciales
            pagos_db = pagos_db.filter(id__exact=int(id_limpio))
            # Si no encuentra nada por ID, se detiene la búsqueda aquí
            if not pagos_db.exists():
                pagos_db = Pago.objects.none()
                continuar_filtros = False
        else:
            messages.error(request, "El ID de pago buscado debe ser un número.")
            pagos_db = Pago.objects.none()
            continuar_filtros = False

    # 4. Si se encontró el pago por ID (o no se filtró por ID), se verifican los otros filtros
    if continuar_filtros:
        # Filtro por estado del pago ('pendiente', 'validado', 'rechazado')
        estados_validos = [codigo for codigo, _ in Pago.ESTADOS_PAGO]
        if estado_filtro in estados_validos:
            pagos_db = pagos_db.filter(estado=estado_filtro)

        # Filtro por método de pago ('efectivo' o 'cuenta_corriente')
        metodos_validos = [codigo for codigo, _ in Pago.METODOS_PAGO]
        if metodo_filtro in metodos_validos:
            pagos_db = pagos_db.filter(metodo_pago=metodo_filtro)

        # Filtro por ID de entrega asociada
        if entrega_filtro:
            entrega_limpia = entrega_filtro.upper().replace('ENT-', '').replace('ID-', '').strip()
            if entrega_limpia.isdigit():
                pagos_db = pagos_db.filter(entrega_id=int(entrega_limpia))
            else:
                messages.error(request, "El ID de entrega buscado debe ser un número.")
                pagos_db = Pago.objects.none()

        # Filtro por fecha del pago
        if fecha_filtro:
            try:
                fecha_valida = datetime.strptime(fecha_filtro, '%Y-%m-%d').date()
                pagos_db = pagos_db.filter(fecha_hora__date=fecha_valida)
            except ValueError:
                messages.error(request, "La fecha ingresada debe tener el formato AAAA-MM-DD.")
                pagos_db = Pago.objects.none()

    # 5. Enriquecemos cada pago con los atributos que espera pagos.html
    pagos_list = list(pagos_db)
    qty_pendientes = 0
    for pago in pagos_list:
        if pago.estado == 'pendiente':
            qty_pendientes += 1
        pago.metodo = pago.get_metodo_pago_display()
        pago.fecha_pago = pago.fecha_hora
        if pago.entrega:
            pedidos_entrega = list(pago.entrega.pedidos.all())
            primer_pedido = pedidos_entrega[0] if pedidos_entrega else None
            pago.entrega.razon_social_comercio = (
                primer_pedido.razon_social_comercio if primer_pedido else "—"
            )

    paginador = Paginator(pagos_list, 30)
    numero_pagina = request.GET.get('pagina')
    pagina_de_pagos = paginador.get_page(numero_pagina)

    # 6. Armamos el contexto para el HTML
    contexto = {
        'pagos_list': pagos_list,
        'qty_pendientes': qty_pendientes,
        'lista_de_pagos': pagina_de_pagos,
        'estado_actual': estado_filtro,
        'estados_disponibles': Pago.ESTADOS_PAGO,
        'metodo_actual': metodo_filtro,
        'metodos_disponibles': Pago.METODOS_PAGO,
        'id_buscado': id_buscado,
        'entrega_filtro': entrega_filtro,
        'fecha_filtro': fecha_filtro,
    }

    return render(request, 'pagos/pagos.html', contexto)


# Alias por compatibilidad
listar_pagos_web = lista_pagos_web


# Muestra la información completa de un único pago redirigiendo al detalle de su entrega asociada
@sesion_requerida
def detalle_pago_web(request, pago_id):
    pago_db = get_object_or_404(Pago.objects.select_related('entrega'), id=pago_id)
    if pago_db.entrega_id:
        return redirect('detalle_entrega_web', entrega_id=pago_db.entrega_id)
    return redirect('lista_pagos_web')


# Endpoint AJAX llamado desde el modal de pagos.html para validar o rechazar un pago pendiente
@sesion_requerida
def procesar_pago_endpoint(request):
    if request.method != 'POST':
        return JsonResponse({'exito': False, 'mensaje': 'Método no permitido.'}, status=405)

    pago_id_raw = (request.POST.get('pago_id') or '').upper().replace('PG-', '').strip()
    accion_tipo = (request.POST.get('accion_tipo') or '').strip().lower()

    if not pago_id_raw.isdigit():
        return JsonResponse({'exito': False, 'mensaje': 'El ID del pago no es válido.'}, status=400)

    mapa_estados = {
        'validar': 'validado',
        'validado': 'validado',
        'rechazar': 'rechazado',
        'rechazado': 'rechazado',
    }
    estado_destino = mapa_estados.get(accion_tipo)
    if not estado_destino:
        return JsonResponse({'exito': False, 'mensaje': 'La acción solicitada no es válida.'}, status=400)

    pago_db = get_object_or_404(Pago, id=int(pago_id_raw))
    if pago_db.estado != 'pendiente':
        return JsonResponse({
            'exito': False,
            'mensaje': f"El pago PG-{pago_db.id} no puede modificarse porque ya está en estado '{pago_db.get_estado_display()}'."
        }, status=400)

    pago_db.estado = estado_destino
    pago_db.save(update_fields=['estado'])

    verbo = 'validado' if estado_destino == 'validado' else 'rechazado'
    return JsonResponse({
        'exito': True,
        'mensaje': f"El pago PG-{pago_db.id} fue {verbo} exitosamente.",
        'estado': pago_db.estado,
    })


# Actualiza el estado de un pago ('validado' o 'rechazado'), únicamente si se encontraba en 'pendiente'
@sesion_requerida
def cambiar_estado_pago_web(request, pago_id, nuevo_estado=None):
    pago_db = get_object_or_404(Pago, id=pago_id)

    if request.method == 'POST':
        estado_destino = (nuevo_estado or request.POST.get('estado') or request.POST.get('nuevo_estado', '')).strip().lower()

        if estado_destino not in ('validado', 'rechazado'):
            messages.error(request, "El nuevo estado solo puede ser 'validado' o 'rechazado'.")
        elif pago_db.estado != 'pendiente':
            messages.warning(
                request,
                f"El pago #{pago_db.id} no puede modificarse porque se encuentra en estado '{pago_db.get_estado_display()}'. Solo se pueden procesar pagos pendientes."
            )
        else:
            pago_db.estado = estado_destino
            pago_db.save(update_fields=['estado'])
            messages.success(request, f"El pago #{pago_db.id} fue marcado como '{pago_db.get_estado_display()}'.")

    return redirect('detalle_pago_web', pago_id=pago_db.id)


# =========================================================
# --- VISTAS API (Devuelven JSON para la app móvil en Expo) ---
# =========================================================

@api_view(['POST'])
def registrar_pago_api(request):
    """
    Endpoint para la App Móvil:
    Registra un pago asociado a una entrega.
    Formato esperado:
    {"monto": "15000.00", "metodo_pago": "efectivo", "entrega": 2}
    """
    serializer = PagoSerializer(data=request.data)

    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['DELETE'])
def eliminar_pago_api(request, pago_id):
    """
    Endpoint para la App Móvil:
    Elimina un pago existente de la base de datos,
    siempre que aún no haya sido validado por administración.
    """
    try:
        pago_db = Pago.objects.only('id', 'estado').get(id=pago_id)
    except Pago.DoesNotExist:
        return Response(
            {"error": f"No existe ningún pago con el ID #{pago_id}."},
            status=status.HTTP_404_NOT_FOUND
        )

    if pago_db.estado == 'validado':
        return Response(
            {"error": f"El pago #{pago_id} ya fue validado por administración y no puede eliminarse."},
            status=status.HTTP_400_BAD_REQUEST
        )

    pago_db.delete()
    return Response(
        {"mensaje": f"El pago #{pago_id} fue eliminado correctamente."},
        status=status.HTTP_200_OK
    )


@api_view(['GET'])
def consultar_pagos_entrega_api(request, entrega_id):
    """
    Endpoint para la App Móvil:
    Devuelve la lista de todos los pagos asociados a una entrega específica.
    """
    if not Entrega.objects.filter(id=entrega_id).exists():
        return Response(
            {"mensaje": f"No existe ninguna entrega con el ID #{entrega_id}."},
            status=status.HTTP_404_NOT_FOUND
        )

    pagos_db = Pago.objects.filter(entrega_id=entrega_id).order_by('-fecha_hora')
    serializer = PagoSerializer(pagos_db, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)
