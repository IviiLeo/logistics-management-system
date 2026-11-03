from django.urls import path
from . import views

urlpatterns = [
    path('', views.lista_pedidos_web, name='lista_pedidos_web'),
    path('nuevo/', views.crear_pedido_web, name='crear_pedido_web'),
    path('cargar-csv/', views.cargar_pedidos_csv_web, name='cargar_pedidos_csv_web'),
    path('cargar-csv/ejemplo/', views.descargar_csv_ejemplo_web, name='descargar_csv_ejemplo_web'),
    path('<int:pedido_id>/', views.detalle_pedido_web, name='detalle_pedido_web'),
    path('<int:pedido_id>/remito/', views.ver_remito_web, name='ver_remito_web'),
    path('<int:pedido_id>/modificar/', views.modificar_pedido_web, name='modificar_pedido_web'),
    path('<int:pedido_id>/eliminar/', views.eliminar_pedido_web, name='eliminar_pedido_web'),
    path('<int:pedido_id>/estado/', views.cambiar_estado_pedido_web, name='cambiar_estado_pedido_web'),
]
