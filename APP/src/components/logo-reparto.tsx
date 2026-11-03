import { Image, type ImageSourcePropType, StyleSheet, Text, View } from 'react-native';

import { Paleta } from '@/constants/paleta';

// Isotipo de RepartoYA (camión con "YA") con las imágenes oficiales de la marca (assets/images/logo).

// Qué imagen es cada variante:
// solo     · 01 · caja azul, sin fondo          · fondos claros
// crema    · 02 · sobre rectángulo crema         · fondos de color
// appIcon  · 03 · cuadrado naranja              · ícono de la app
// escalado · 04 · ventana y ruedas en blanco    · tamaños medianos
// favicon  · 05 · sin líneas de velocidad       · tamaños chicos
// azul     · 06 · caja crema                    · fondo azul (login)
// repartidor · 04 de la guía de marca · caja azul, "YA" y cabina crema, sin líneas · fondo naranja (barras de hoja de ruta y mapa)
type Variante = 'solo' | 'crema' | 'appIcon' | 'escalado' | 'favicon' | 'azul' | 'repartidor';

// Cada imagen con la proporción del dibujo original (ancho / alto), para que no se deforme al escalarla
const LOGOS: Record<Variante, { imagen: ImageSourcePropType; ancho: number; alto: number }> = {
  solo: { imagen: require('@/assets/images/logo/01-isotipo-solo.png'), ancho: 390.9, alto: 176.5 },
  crema: { imagen: require('@/assets/images/logo/02-isotipo-crema.png'), ancho: 512, alto: 297.9 },
  appIcon: { imagen: require('@/assets/images/logo/03-app-icon.png'), ancho: 512, alto: 512 },
  escalado: { imagen: require('@/assets/images/logo/04-isotipo-escalado.png'), ancho: 512, alto: 297.9 },
  favicon: { imagen: require('@/assets/images/logo/05-isotipo-favicon.png'), ancho: 451.3, alto: 297.9 },
  azul: { imagen: require('@/assets/images/logo/06-isotipo-azul.png'), ancho: 390.7, alto: 176.5 },
  repartidor: { imagen: require('@/assets/images/logo/04-app-repartidor.png'), ancho: 262, alto: 154 },
};

interface Props {
  ancho?: number;
  variante?: Variante;
}

export function LogoCamion({ ancho = 120, variante = 'solo' }: Props) {
  const logo = LOGOS[variante];
  return (
    <Image
      source={logo.imagen}
      style={{ width: ancho, height: (ancho * logo.alto) / logo.ancho }}
      resizeMode="contain"
    />
  );
}

// Logo completo: camión + "RepartoYA". Sobre fondo azul "Reparto" va en crema; si no, en azul
export function LogoReparto({ ancho = 200, variante = 'solo' }: Props) {
  const colorReparto = variante === 'azul' ? Paleta.crema : Paleta.azul;

  return (
    <View style={styles.logoCompleto}>
      <LogoCamion ancho={ancho * 0.6} variante={variante} />
      <Text style={[styles.marca, { fontSize: ancho * 0.19, marginTop: ancho * 0.06 }]}>
        <Text style={{ color: colorReparto }}>Reparto</Text>
        <Text style={{ color: Paleta.naranja }}>YA</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  logoCompleto: {
    alignItems: 'center',
  },
  marca: {
    fontWeight: '900',
    letterSpacing: -1,
  },
});
