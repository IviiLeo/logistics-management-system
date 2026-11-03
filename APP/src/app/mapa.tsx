import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, Modal, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as Location from 'expo-location';
import * as Network from 'expo-network';
import Storage from 'expo-sqlite/kv-store';

import { IconoUbicacion } from '@/components/icono-ubicacion';
import { IconoUsuario } from '@/components/icono-usuario';
import { LogoCamion } from '@/components/logo-reparto';
import { obtenerEntregaEnCurso, type EntregaEnCurso,} from '@/services/entregaEnCurso';

// Leaflet viene adentro de la app (lo genera scripts/generar-leaflet.js), así no hay que bajarlo de internet
import { LEAFLET_CSS, LEAFLET_JS } from '@/constants/leaflet';

interface Entrega {
  id: number;
  direccion: string;
  latitud: number;
  longitud: number;
  estado: 'PENDIENTE' | 'NO_ENTREGADO' | 'ENTREGADO';
}

// Así llegan los pedidos desde la hoja de ruta: solo con la dirección en texto, sin coordenadas
interface PedidoMapa {
  id: number;
  direccion: string;
  estado: 'PENDIENTE' | 'ENTREGADO' | 'NO ENTREGADO';
}

type Coordenadas = { latitud: number; longitud: number };

// Las coordenadas de cada dirección se guardan en el celular: una vez que se encontró una dirección
// ya no hace falta internet para ponerla en el mapa
const CLAVE_COORDENADAS = 'coordenadasDirecciones';
// Cuántas direcciones se buscan a la vez (todas juntas de golpe el buscador de iPhone las rechaza)
const BUSQUEDAS_A_LA_VEZ = 4;

function leerCoordenadasGuardadas(): Record<string, Coordenadas> {
  try {
    const texto = Storage.getItemSync(CLAVE_COORDENADAS);
    return texto ? JSON.parse(texto) : {};
  } catch {
    return {};
  }
}

function guardarCoordenadas(coordenadas: Record<string, Coordenadas>) {
  try {
    Storage.setItemSync(CLAVE_COORDENADAS, JSON.stringify(coordenadas));
  } catch {
    // Si no se pudo guardar, la próxima vez se vuelven a buscar
  }
}

// Si la dirección no dice el país, se lo agregamos para que el buscador no la confunda con otra de otro lado
function direccionCompleta(direccion: string) {
  return /argentina/i.test(direccion) ? direccion : `${direccion}, Argentina`;
}

async function buscarDireccion(direccion: string): Promise<Coordenadas | null> {
  try {
    const resultados = await Location.geocodeAsync(direccionCompleta(direccion));
    return resultados.length > 0 ? { latitud: resultados[0].latitude, longitud: resultados[0].longitude } : null;
  } catch {
    return null;
  }
}

// Pasa cada dirección a latitud y longitud. Primero mira las guardadas en el celular,
// y las que faltan las busca con el buscador del celular (expo-location), de a varias a la vez.
// Las que no encuentra no se ponen en el mapa
async function ubicarPedidos(pedidos: PedidoMapa[]) {
  const coordenadas = leerCoordenadasGuardadas();
  const faltan = [...new Set(pedidos.map((p) => p.direccion))].filter((d) => !(d in coordenadas));

  if (faltan.length > 0) {
    // En Android hace falta el permiso de ubicación para poder buscar direcciones
    await Location.requestForegroundPermissionsAsync().catch(() => null);

    for (let i = 0; i < faltan.length; i += BUSQUEDAS_A_LA_VEZ) {
      const tanda = faltan.slice(i, i + BUSQUEDAS_A_LA_VEZ);
      const resultados = await Promise.all(tanda.map(buscarDireccion));
      tanda.forEach((direccion, j) => {
        const lugar = resultados[j];
        if (lugar) coordenadas[direccion] = lugar;
      });
    }
    guardarCoordenadas(coordenadas);
  }

  const ubicadas: Entrega[] = [];
  const sinUbicar: string[] = [];
  for (const pedido of pedidos) {
    const lugar = coordenadas[pedido.direccion];
    if (!lugar) {
      if (!sinUbicar.includes(pedido.direccion)) sinUbicar.push(pedido.direccion);
      continue;
    }
    ubicadas.push({
      id: pedido.id,
      direccion: pedido.direccion,
      ...lugar,
      // En la hoja de ruta se escribe con espacio y acá con guion bajo
      estado: pedido.estado === 'NO ENTREGADO' ? 'NO_ENTREGADO' : pedido.estado,
    });
  }
  return { ubicadas, sinUbicar };
}

const COLORES_ESTADO: Record<Entrega['estado'], string> = {
  PENDIENTE: '#FFA500',
  NO_ENTREGADO: '#FF3B30',
  ENTREGADO: '#34C759',
};

// Sin internet no se puede dibujar el mapa ni buscar las direcciones
async function hayConexion() {
  try {
    const estado = await Network.getNetworkStateAsync();
    return estado.isConnected !== false && estado.isInternetReachable !== false;
  } catch {
    // Si no se pudo averiguar, se intenta igual (si falla, el mapa avisa con 'sinConexion')
    return true;
  }
}

function crearHtmlMapa(entregas: Entrega[]) {
  const datos = JSON.stringify(entregas).replace(/</g, '\\u003c');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
        <style>${LEAFLET_CSS}</style>
        <style>
          html, body, #map { width: 100%; height: 100%; margin: 0; background: #E5E3DF; }
          .leaflet-popup-content { font: 14px Arial, sans-serif; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>${LEAFLET_JS}</script>
        <script>
          const entregas = ${datos};
          const colores = ${JSON.stringify(COLORES_ESTADO)};
          // Sin animaciones: en celulares lentos el zoom animado se traba
          const map = L.map('map', { zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false })
            .setView([-34.6037, -58.3816], 14);

          // El fondo (calles) sí viene de internet. Si no hay señal se avisa y la app muestra el cartel
          let avisoSinConexion = false;
          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          })
            .on('tileerror', () => {
              if (avisoSinConexion) return;
              avisoSinConexion = true;
              window.ReactNativeWebView.postMessage('sinConexion');
            })
            .addTo(map);

          const marcadores = [];
          entregas.forEach((entrega) => {
            const marcador = L.circleMarker([entrega.latitud, entrega.longitud], {
              radius: 9,
              color: '#ffffff',
              weight: 2,
              fillColor: colores[entrega.estado] || '#808080',
              fillOpacity: 1
            }).bindPopup(
              '<strong>' + entrega.direccion + '</strong><br>Estado: ' + entrega.estado
            );
            marcador.addTo(map);
            marcadores.push(marcador);
          });

          if (marcadores.length > 1) {
            map.fitBounds(L.featureGroup(marcadores).getBounds(), { padding: [32, 32], maxZoom: 16 });
          } else if (marcadores.length === 1) {
            map.setView(marcadores[0].getLatLng(), 15);
          }
        </script>
      </body>
    </html>
  `;
}

export default function MapaDestinosScreen() {
  // La hoja de ruta manda sus pedidos como texto (JSON)
  const { pedidos: pedidosTexto }: { pedidos?: string } = useLocalSearchParams();
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [sinUbicar, setSinUbicar] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  // No hay internet: en vez del mapa se muestra un cartel
  const [sinConexion, setSinConexion] = useState(false);
  // El mapa se rompió (por ejemplo, Android lo cerró por falta de memoria)
  const [mapaRoto, setMapaRoto] = useState(false);

  useEffect(() => {
    let pedidos: PedidoMapa[] = [];
    try {
      pedidos = pedidosTexto ? JSON.parse(pedidosTexto) : [];
    } catch {
      pedidos = [];
    }

    setLoading(true);
    setSinConexion(false);
    setMapaRoto(false);

    hayConexion()
      .then(async (conectado) => {
        if (!conectado) {
          setSinConexion(true);
          return;
        }
        // Sin pedidos no hay nada que buscar: queda el mapa vacío
        const resultado = await ubicarPedidos(pedidos);
        setEntregas(resultado.ubicadas);
        setSinUbicar(resultado.sinUbicar);
      })
      .finally(() => setLoading(false));
  }, [pedidosTexto]);

  const html = useMemo(() => crearHtmlMapa(entregas), [entregas]);


  const onMensaje = (evento: WebViewMessageEvent) => {
    if (evento.nativeEvent.data === 'sinConexion') setSinConexion(true);
  };
  
  const [entregaEnCurso, setEntregaEnCursoPantalla] = useState<EntregaEnCurso | null>(() => obtenerEntregaEnCurso());
  const [menuVisible, setMenuVisible] = useState(false);

  return (
    <View style={styles.container}>
          <View style={styles.headerBar}>
              {/* Vuelve a la hoja de ruta que ya estaba abierta (si se abriera una nueva no tendría
                  el id del transportista y mostraría "No tienes pedidos asignados" aunque haya pedidos) */}
              <TouchableOpacity
                style={styles.camionSinPestania}
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/hojaRuta'))}>
                <LogoCamion ancho={32} variante="repartidor" />
              </TouchableOpacity>
            
    
                <View style={styles.pestaniaPedidos}>
                  <IconoUbicacion tamanio={34} />
                </View>
                 
              
    
            {/* Ícono de usuario: va pegado al extremo derecho de la barra */}
            <TouchableOpacity
              style={styles.botonUsuario}
              onPress={() => setMenuVisible(true)}
              hitSlop={10}>
              <IconoUsuario tamanio={34} />
            </TouchableOpacity>
          </View>
    
          <Modal 
            visible={menuVisible}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setMenuVisible(false)}>
            <TouchableOpacity 
              style={styles.modalOverlay} 
              activeOpacity={1} 
              onPress={() => setMenuVisible(false)}>
              <View style={styles.profileMenuContainer}>
                <TouchableOpacity 
                  style={styles.menuItem} 
                  onPress={() => {
                    setMenuVisible(false);
                    // Con una entrega en curso no se deja cerrar sesión
                    // (si no, quedaría guardada en el celular y la vería el próximo que entre)
                    if (entregaEnCurso) {
                      Alert.alert(
                        'Cerrar sesión',
                        'Existen datos pendientes de sincronización. Revise su conexión a internet para sincronizar los datos'
                      );
                      return;
                    }
                    // replace (y no push) para que "atrás" no vuelva a la hoja de ruta
                    router.replace('/login');
                  }}>
                  <Text style={[styles.menuItemText, { color: '#F56C6C' }]}>Cerrar sesión</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>

    {/*<View style={styles.container}>
       Barra de arriba con la opción de volver a la hoja de ruta 
      /*<View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.volverText}>‹ Volver</Text>
        </TouchableOpacity>
        <View style={styles.headerFila}>
          <Text style={styles.headerTitle}>Mapa de destinos</Text>
        </View>
      </View>*/}

      {loading ? (
        <View style={styles.cargando}>
          <ActivityIndicator size="large" />
          <Text style={styles.cargandoTexto}>Buscando las direcciones en el mapa...</Text>
        </View>
      ) : sinConexion ? (
        <View style={styles.cargando}>
          <View style={styles.cartelSinConexion}>
            <Text style={styles.cartelTitulo}>Sin conexión a internet</Text>
            <Text style={styles.cartelTexto}>Revise su conexión a internet para ver el mapa</Text>
          </View>
        </View>
      ) : mapaRoto ? (
        <View style={styles.cargando}>
          <Text style={styles.avisoTexto}>No se pudo mostrar el mapa.</Text>
        </View>
      ) : (
        <WebView
          source={{ html }}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          // Usa las calles que ya se vieron antes aunque no haya internet
          cacheEnabled
          cacheMode="LOAD_CACHE_ELSE_NETWORK"
          onMessage={onMensaje}
          onError={() => setMapaRoto(true)}
          // En Android, si falta memoria el sistema cierra el mapa: en vez de quedar en blanco avisamos
          onRenderProcessGone={() => setMapaRoto(true)}
          onContentProcessDidTerminate={() => setMapaRoto(true)}
          style={styles.map}
        />
      )}

      {!loading && !mapaRoto && !sinConexion && (
        <View style={styles.leyendaContainer}>
          {/* Direcciones que el buscador no encontró (no aparecen en el mapa) */}
          {sinUbicar.length > 0 && (
            <Text style={styles.avisoTexto}>
              No se pudo encontrar en el mapa: {sinUbicar.join(' · ')}
            </Text>
          )}
          <Text style={styles.leyendaTitulo}>Estados de entrega</Text>
          {(Object.entries(COLORES_ESTADO) as [Entrega['estado'], string][]).map(
            ([estado, color]) => (
              <View key={estado} style={styles.leyendaItem}>
                <View style={[styles.dot, { backgroundColor: color }]} />
                <Text style={styles.leyendaTexto}>
                  {estado === 'NO_ENTREGADO' ? 'No entregado' : estado.toLowerCase()}
                </Text>
              </View>
            ),
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#FFF6EC',
  },
  headerBar: {
    backgroundColor: '#F4661B', height: 100, flexDirection: 'row',
    alignItems: 'center', paddingHorizontal: 16, paddingTop: 15,
  },
  camionSinPestania: {
    top: 10, width: 40, height: 40, alignItems: 'center',
    justifyContent: 'center', marginRight: 16,
  },
 pestaniaPedidos:{
    top:10, borderRadius:15, width: 40, height: 40,
    backgroundColor: 'rgba(255, 246, 236, 0.15)',
    alignItems: 'center', justifyContent: 'center', marginRight: 16,
  },
  botonUsuario: {
    top: 10, marginLeft: 'auto',
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  profileMenuContainer: {
    position: 'absolute', top: 60, right: 0, width: 300, 
    backgroundColor: '#FFFFFF', borderRadius: 10, paddingVertical: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4, elevation: 5,
  },
  menuItem: {
    paddingVertical: 12, paddingHorizontal: 16,
  },
  menuItemText: {
    fontSize: 15, color: '#1B1B1F', fontWeight: '500',
  },
  menuDivider: {
    height: 1, backgroundColor: '#EBEEF5', 
  },



  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF6EC',
  },
  map: {
    flex: 1,
  },
  cargando: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cargandoTexto: {
    marginTop: 12,
    fontSize: 14,
    color: '#606266',
  },
  cartelSinConexion: {
    marginHorizontal: 24,
    padding: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  cartelTitulo: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#721c24',
    marginBottom: 8,
  },
  cartelTexto: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
  },
  avisoTexto: {
    fontSize: 12,
    color: '#721c24',
    marginBottom: 8,
  },
  leyendaContainer: {
    position: 'absolute',
    bottom: 25,
    left: 15,
    right: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 10,
    padding: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  leyendaTitulo: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  leyendaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  leyendaTexto: {
    fontSize: 12,
    color: '#555',
  },
});
