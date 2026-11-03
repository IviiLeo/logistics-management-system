from decimal import Decimal
from django.db import models
from django.core.validators import RegexValidator, FileExtensionValidator, MinValueValidator
from django.core.exceptions import ValidationError
from django.utils import timezone

# Validador para asegurar que la fecha de entrega sea posterior al día de hoy
def validar_fecha_futura(fecha):
    if fecha <= timezone.localdate():
        raise ValidationError('La fecha de entrega debe ser una fecha futura.')


class Pedido(models.Model):
    ESTADOS_PEDIDO = [
        ('pendiente', 'Pendiente'),
        ('asignado', 'Asignado'),
        ('entregado', 'Entregado'),
        ('no_entregado', 'No entregado'),
    ]

    validador_cuit = RegexValidator(
        regex=r'^\d{11}$',
        message='El CUIT debe tener exactamente 11 números.'
    )

    # Datos del Comercio
    cuit_comercio = models.CharField(max_length=11, validators=[validador_cuit])
    razon_social_comercio = models.CharField(max_length=150)
    domicilio_comercio = models.CharField(max_length=200)

    # Datos del Proveedor
    cuit_proveedor = models.CharField(max_length=11, validators=[validador_cuit])
    razon_social_proveedor = models.CharField(max_length=150)

    # Datos del Pedido
    monto_total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal('0.01'), message='El monto total debe ser mayor a 0.')
        ]
    )
    remito = models.FileField(
        upload_to='remitos/',
        blank=True,
        null=True,
        validators=[
            FileExtensionValidator(allowed_extensions=['pdf'], message='El remito debe cargarse en formato PDF.')
        ]
    )
    estado = models.CharField(
        max_length=20,
        choices=ESTADOS_PEDIDO,
        default='pendiente'
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_entrega = models.DateField(validators=[validar_fecha_futura])

    # Conexión con Hojas de Ruta
    hoja_de_ruta = models.ForeignKey(
        'hojas.HojaDeRuta',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pedidos'
    )

    # Conexión con Entrega
    entrega = models.ForeignKey(
        'entregas.Entrega',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pedidos'
    )

    def save(self, *args, **kwargs):
        # Si el pedido ya existe en la BD y se está actualizando el campo 'remito',
        # verificamos si hay que reemplazar y borrar el archivo PDF anterior
        remito_anterior = None
        update_fields = kwargs.get('update_fields')

        if self.pk and (update_fields is None or 'remito' in update_fields):
            pedido_original = Pedido.objects.filter(pk=self.pk).only('remito').first()
            if pedido_original and pedido_original.remito and pedido_original.remito != self.remito:
                remito_anterior = pedido_original.remito

        super().save(*args, **kwargs)

        # Una vez guardado con éxito el nuevo PDF, borramos del disco (media/remitos/) el archivo viejo
        if remito_anterior:
            remito_anterior.delete(save=False)

    def delete(self, *args, **kwargs):
        # Si se elimina el pedido, borramos también su archivo PDF del disco para no dejar archivos huérfanos
        remito_a_borrar = self.remito
        super().delete(*args, **kwargs)
        if remito_a_borrar:
            remito_a_borrar.delete(save=False)

    def __str__(self):
        return f"Pedido #{self.pk} ({self.get_estado_display()}) - Comercio: {self.razon_social_comercio}"
