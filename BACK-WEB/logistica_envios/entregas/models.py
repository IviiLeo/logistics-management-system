from django.db import models

class Entrega(models.Model):
    ESTADOS = [
        ('en_proceso', 'En proceso'),
        ('entregada', 'Entregada'),
        ('no_entregada', 'No entregada'),
    ]

    fecha_hora = models.DateTimeField(auto_now_add=True)
    estado = models.CharField(max_length=20, choices=ESTADOS, default='en_proceso')

    hoja_de_ruta = models.ForeignKey(
        'hojas.HojaDeRuta', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='entregas'
    )

    def __str__(self):
        fecha_str = self.fecha_hora.strftime('%d/%m/%Y %H:%M') if self.fecha_hora else 'Sin fecha'
        return f"Entrega #{self.id} ({self.get_estado_display()}) - {fecha_str}"

    def detalle_api(self, pagos=None, pedidos=None):
        """
        Devuelve el detalle de la entrega junto a sus pagos (id, metodo y monto)
        y pedidos (id, razon social comercio y monto) asociados.
        """
        cache = getattr(self, '_prefetched_objects_cache', {})

        if pagos is not None:
            lista_pagos = pagos
        elif 'pagos' in cache:
            lista_pagos = self.pagos.all()
        else:
            lista_pagos = self.pagos.all().order_by('-id')

        if pedidos is not None:
            lista_pedidos = pedidos
        elif 'pedidos' in cache:
            lista_pedidos = self.pedidos.all()
        else:
            lista_pedidos = self.pedidos.all().order_by('-id')

        return {
            'id': self.id,
            'fecha_hora': self.fecha_hora.isoformat() if self.fecha_hora else None,
            'estado': self.estado,
            'estado_display': self.get_estado_display(),
            'hoja_de_ruta_id': self.hoja_de_ruta_id,
            'pagos': [
                {
                    'id': pago.id,
                    'metodo': pago.metodo_pago,
                    'monto': str(pago.monto),
                }
                for pago in lista_pagos
            ],
            'pedidos': [
                {
                    'id': pedido.id,
                    'razon_social_comercio': pedido.razon_social_comercio,
                    'monto': str(pedido.monto_total),
                }
                for pedido in lista_pedidos
            ]
        }

    def cambiar_estado(self, nuevo_estado):
        """
        Valida y actualiza el estado de la entrega en la base de datos,
        y actualiza los pedidos asignados según corresponda.
        """
        estados_validos = [codigo for codigo, _ in self.ESTADOS]
        estado_normalizado = str(nuevo_estado).strip().lower()
        if estado_normalizado not in estados_validos:
            raise ValueError(f"Estado '{nuevo_estado}' no válido. Opciones: {', '.join(estados_validos)}")
        self.estado = estado_normalizado
        self.save(update_fields=['estado'])

        if estado_normalizado == 'entregada':
            self.pedidos.update(estado='entregado')
        elif estado_normalizado == 'no_entregada':
            self.pedidos.update(estado='no_entregado')

        return self



