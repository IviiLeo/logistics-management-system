from django.urls import path
from . import views

urlpatterns = [
    # RUTAS WEB
    path('', views.lista_pagos_web, name='lista_pagos_web'),
    path('procesar/', views.procesar_pago_endpoint, name='procesar_pago_endpoint'),
    path('<int:pago_id>/', views.detalle_pago_web, name='detalle_pago_web'),
    path('<int:pago_id>/estado/', views.cambiar_estado_pago_web, name='cambiar_estado_pago_web'),
    path('<int:pago_id>/estado/<str:nuevo_estado>/', views.cambiar_estado_pago_web, name='cambiar_estado_pago_web_directo'),

    # RUTAS API REST
    path('api/registrar/', views.registrar_pago_api, name='registrar_pago_api'),
    path('api/<int:pago_id>/eliminar/', views.eliminar_pago_api, name='eliminar_pago_api'),
    path('api/entrega/<int:entrega_id>/', views.consultar_pagos_entrega_api, name='consultar_pagos_entrega_api'),
]
