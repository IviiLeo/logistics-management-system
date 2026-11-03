from django.urls import path
from . import views

urlpatterns = [

    # EJEMPLO: path('extension/', views.funcion, name=')

    # RUTAS WEB

    path('home/', views.home_web, name='home'),
    
    # URL final será: localhost:8000/empleados/transportistas/
    path('transportistas/', views.lista_transportistas_web, name='transportistas_web'),

    # Cuando entren a /login/, se ejecuta iniciar_sesion_web
    path('login/', views.iniciar_sesion_web, name='login_web'),
    
    # Cuando entren a /logout/, se ejecuta cerrar_sesion_web
    path('logout/', views.cerrar_sesion_web, name='logout_web'),
    
    # Esta es tu ruta del panel principal (el 'home' al que redirigimos)
    #path('panel/', views.panel_principal, name='home'),




    # RUTAS API REST
    path('api/login/', views.iniciar_sesion_movil, name='login_app'),
    path('api/transportistas/', views.lista_transportistas_api, name='transportistas_api'),
]