from rest_framework import serializers
from .models import Transportista, Administrativo

# --- OPCIONES COMPLETAS (PERO SEGURAS) ---
# Usar cuando el front pida el perfil de un empleado específico

class TransportistaFullSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transportista
        exclude = ['pin']  # Manda todo, pero bloquea el envío del PIN

class AdministrativoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Administrativo
        exclude = ['contrasena'] # Manda todo, pero bloquea el envío de la contraseña


# --- OPCIONES REDUCIDAS (LIVIANAS) ---
# Usar cuando el front pida listas largas para llenar tablas o menús

class TransportistaParcialSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transportista
        fields = ['id', 'dni', 'nombre', 'apellido', 'estado']

class AdministrativoParcialSerializer(serializers.ModelSerializer):
    class Meta:
        model = Administrativo
        fields = ['id', 'dni', 'nombre', 'apellido', 'estado']