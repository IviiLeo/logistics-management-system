from rest_framework import serializers
from .models import Pago
from entregas.models import Entrega


class PagoSerializer(serializers.ModelSerializer):
    entrega = serializers.PrimaryKeyRelatedField(
        queryset=Entrega.objects.all(),
        required=True,
        error_messages={
            'required': 'Debes asociar una entrega al pago.',
            'null': 'La entrega no puede ser nula.',
            'does_not_exist': 'La entrega con ID {pk_value} no existe.',
            'incorrect_type': 'Formato inválido. Se esperaba un ID numérico de entrega.'
        }
    )

    class Meta:
        model = Pago
        fields = ['id', 'monto', 'metodo_pago', 'fecha_hora', 'estado', 'entrega']
        # Bloqueamos fecha_hora y estado para que la app móvil no pueda alterarlos al crear el pago
        read_only_fields = ['id', 'fecha_hora', 'estado']
