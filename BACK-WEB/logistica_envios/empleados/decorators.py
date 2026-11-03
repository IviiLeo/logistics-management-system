from functools import wraps
from django.shortcuts import redirect
from django.contrib import messages
from .models import Administrativo
from django.views.decorators.cache import never_cache

# GUARDIA ESTRICTO: Verifica sesión, existencia en BD y que el usuario esté activo
def sesion_requerida(view_func):
    @wraps(view_func)
    @never_cache
    def _wrapped_view(request, *args, **kwargs):
        # 1. Chequeo de cookie (sesión básica)
        admin_id = request.session.get('admin_id')
        if not admin_id:
            return redirect('login_web')
            
        # 2. Chequeo de seguridad profunda (Existencia y Estado)
        try:
            admin = Administrativo.objects.get(id=admin_id)
            
            # Validamos que no haya sido dado de baja
            if not admin.estado:
                request.session.flush()   # Destruye la sesión zombi del navegador
                return redirect('login_web')

            request.admin_actual = admin
                
        except Administrativo.DoesNotExist:
            # Si el registro fue borrado directamente de la tabla
            request.session.flush()
            return redirect('login_web')
        
        # 3. Ejecutamos la vista original y guardamos el resultado
        return (view_func(request, *args, **kwargs))
    return _wrapped_view

# 2. GUARDIA EJECUTIVO: Verifica sesión y además busca el rol en la Base de Datos
def ejecutivo_requerido(view_func):
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        # Primero chequeamos que al menos haya iniciado sesión
        if 'admin_id' not in request.session:
            messages.error(request, "Debes iniciar sesión.")
            return redirect('login_web')
        
        # Si tiene sesión, buscamos su registro en la base de datos
        admin_id = request.session['admin_id']
        try:
            admin_actual = Administrativo.objects.get(id=admin_id)
            
            # Revisamos su nivel de acceso (el campo booleano)
            if not admin_actual.ejecutivo:
                return redirect('home') # Asegurate de que 'home' sea el alias de tu panel principal

            request.admin_actual = admin_actual
                
        except Administrativo.DoesNotExist:
            # Si el usuario fue borrado de la BD mientras tenía la sesión abierta, lo deslogueamos
            request.session.flush()
            return redirect('login_web')
        
        # Si pasó todos los filtros, le abrimos la puerta
        return view_func(request, *args, **kwargs)
    
    return _wrapped_view
