from django.urls import path
from . import views

urlpatterns = [
    # RUTAS WEB
    path('', views.lista_entregas_web, name='lista_entregas_web'),
    path('<int:entrega_id>/', views.ver_detalle_web, name='detalle_entrega_web'),
    path('<int:entrega_id>/', views.ver_detalle_web, name='detalle_entrega'),
    path('<int:entrega_id>/', views.ver_detalle_web, name='ver_detalle_web'),

    # RUTAS API REST
    path('api/crear/', views.crear_entrega_api, name='crear_entrega_api'),
    path('api/<int:entrega_id>/', views.detalle_entrega_api, name='detalle_entrega_api'),
    path('api/<int:entrega_id>/estado/', views.cambiar_estado_entrega_api, name='cambiar_estado_entrega_api'),
    path('api/<int:entrega_id>/borrar/', views.borrar_entrega_api, name='borrar_entrega_api'),
]

