from django.contrib import admin
from .models import Pago

@admin.register(Pago)
class PagoAdmin(admin.ModelAdmin):
    list_display = ('id', 'monto', 'metodo_pago', 'estado', 'fecha_hora')
    list_filter = ('estado', 'metodo_pago', 'fecha_hora')
    search_fields = ('id',)
