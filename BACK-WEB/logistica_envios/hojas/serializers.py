from rest_framework import serializers
from .models import HojaDeRuta

# Importamos Pedido para poder mostrar sus datos adentro de la hoja
from pedidos.models import Pedido 

# 1. Serializador para los pedidos que van adentro de la hoja
class PedidoParaHojaSerializer(serializers.ModelSerializer):
    # Renombramos las variables para que encajen perfecto con la interfaz de React Native
    domicilio = serializers.CharField(source='domicilio_comercio')
    razon_social = serializers.CharField(source='razon_social_comercio')

    class Meta:
        model = Pedido
        # Incorporamos los campos renombrados y agregamos el 'monto' obligatorio
        fields = ['id', 'estado', 'domicilio', 'razon_social', 'remito', 'monto_total']

# 2. Serializador principal de la Hoja
class HojaDeRutaSerializer(serializers.ModelSerializer):
    # Usamos el related_name 'pedidos'
    pedidos = PedidoParaHojaSerializer(many=True, read_only=True)

    class Meta:
        model = HojaDeRuta
        fields = ['id', 'fecha', 'transportista', 'pedidos']