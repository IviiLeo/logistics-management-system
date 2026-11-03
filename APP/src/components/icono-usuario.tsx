import { View } from 'react-native';

// Ícono de usuario (cabeza + hombros) solo con el contorno, armado con formas, sin imágenes.
// Todas las medidas salen de `tamanio`, así se escala sin perder nitidez.

interface Props {
  tamanio?: number;
  color?: string;
}

export function IconoUsuario({ tamanio = 32, color = '#FFFFFF' }: Props) {
  const grosor = Math.max(2, tamanio * 0.07);
  const cabeza = tamanio * 0.42;
  const hombrosAncho = tamanio * 0.8;
  const hombrosAlto = tamanio * 0.4;

  return (
    <View style={{ width: tamanio, height: tamanio, alignItems: 'center', justifyContent: 'flex-end' }}>
      {/* Cabeza: círculo */}
      <View
        style={{
          width: cabeza,
          height: cabeza,
          borderRadius: cabeza / 2,
          borderWidth: grosor,
          borderColor: color,
          marginBottom: tamanio * 0.04,
        }}
      />
      {/* Hombros: medio círculo abierto abajo */}
      <View
        style={{
          width: hombrosAncho,
          height: hombrosAlto,
          borderTopLeftRadius: hombrosAncho / 2,
          borderTopRightRadius: hombrosAncho / 2,
          borderTopWidth: grosor,
          borderLeftWidth: grosor,
          borderRightWidth: grosor,
          borderBottomWidth: 0,
          borderColor: color,
        }}
      />
    </View>
  );
}
