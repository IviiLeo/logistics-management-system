from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [

    # Pone la pantalla de inicio de sesión como la predeterminada
    path('', RedirectView.as_view(pattern_name='login_web', permanent=False), name='raiz'),

    # Esta es la ruta al panel azul de administrador (ya viene de fábrica)
    path('admin/', admin.site.urls),
    
    # rutas de la app empleados
    path('', include('empleados.urls')),
    #rutas de la app pedidos
    path('pedidos/', include('pedidos.urls')),
    #rutas de la app hojas
    path('hojas/', include('hojas.urls')),
    # rutas de la app pagos
    path('pagos/', include('pagos.urls')),
    # rutas de la app entregas
    path('entregas/', include('entregas.urls')),
]

# Permite abrir y ver los PDFs subidos (remitos) desde el navegador en entorno de desarrollo
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)