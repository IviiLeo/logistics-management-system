import { View } from 'react-native';

// Ícono de ubicación (pin con agujero) armado con formas, sin imágenes.
// El pin es un cuadrado con tres esquinas redondeadas, girado para que la punta quede abajo.
// El agujero se pinta con el color del fondo donde va el ícono.

interface Props {
  tamanio?: number;
  color?: string;
  colorFondo?: string;
}

export function IconoUbicacion({ tamanio = 32, color = '#FFFFFF', colorFondo = '#F4661B' }: Props) {
  const lado = tamanio * 0.62;
  const agujero = lado * 0.42;

  return (
    <View style={{ width: tamanio, height: tamanio, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: lado,
          height: lado,
          backgroundColor: color,
          borderTopLeftRadius: lado / 2,
          borderTopRightRadius: lado / 2,
          borderBottomRightRadius: lado / 2,
          borderBottomLeftRadius: 0,
          alignItems: 'center',
          justifyContent: 'center',
          // Girado así, la esquina sin redondear (la punta) queda abajo; se sube un poco para que quede centrado
          transform: [{ translateY: -tamanio * 0.064 }, { rotate: '-45deg' }],
        }}>
        <View style={{ width: agujero, height: agujero, borderRadius: agujero / 2, backgroundColor: colorFondo }} />
      </View>
    </View>
  );
}
