from decimal import Decimal
from django.db import models
from django.core.validators import MinValueValidator

# Create your models here.

class Pago(models.Model):
    METODOS_PAGO = [
        ('efectivo', 'Efectivo'),
        ('cuenta_corriente', 'Cuenta Corriente'),
    ]

    ESTADOS_PAGO = [
        ('pendiente', 'Pendiente'),
        ('validado', 'Validado'),
        ('rechazado', 'Rechazado'),
    ]

    monto = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal('0.01'), message='El monto del pago debe ser mayor a 0.')
        ]
    )
    metodo_pago = models.CharField(
        max_length=20,
        choices=METODOS_PAGO
    )
    fecha_hora = models.DateTimeField(auto_now_add=True)
    estado = models.CharField(
        max_length=20,
        choices=ESTADOS_PAGO,
        default='pendiente'
    )

    # Conexión con Entrega (ManyToOne: una Entrega, varios Pagos)
    entrega = models.ForeignKey(
        'entregas.Entrega',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='pagos'
    )

    def __str__(self):
        return f"Pago #{self.pk} - {self.get_metodo_pago_display()} (${self.monto}) - {self.get_estado_display()}"
