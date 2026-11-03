from django.contrib import admin
from .models import Pedido


'''
@admin.register(Pedido)
class PedidoAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'razon_social_comercio',
        'cuit_comercio',
        'razon_social_proveedor',
        'monto_total',
        'estado',
        'fecha_entrega',
        'fecha_creacion',
    )
    list_filter = ('estado', 'fecha_entrega')
    search_fields = ('id', 'cuit_comercio', 'razon_social_comercio', 'cuit_proveedor', 'razon_social_proveedor')
'''
admin.site.register(Pedido)

