import {useState, useEffect, useCallback} from 'react';
import {Modal, ActivityIndicator, StyleSheet, Text, View, FlatList, Image, TouchableOpacity, Alert} from 'react-native';
import {Link, router, useFocusEffect, useLocalSearchParams} from 'expo-router';

import { IconoUbicacion } from '@/components/icono-ubicacion';
import { IconoUsuario } from '@/components/icono-usuario';
import { LogoCamion } from '@/components/logo-reparto';
import { RemitoPdf } from '@/components/remito-pdf';
import { obtenerHojaRuta, crearEntregaAPI, /* modificarEntregaAPI, */ borrarEntregaAPI, type Pedido } from '@/services/hojaRuta';
import {
  borrarPagosIniciados,
  guardarEntregaEnCurso,
  /* hayPagosIniciados, */
  obtenerEntregaEnCurso,
  tomarEntregados,
  type EntregaEnCurso,
} from '@/services/entregaEnCurso';

const PEDIDOS_MOCK: Pedido[] = [
  {
    id: 1,
    razon_social: 'Kiosco El Rápido',
    domicilio: 'Mitre 5022',
    estado: 'PENDIENTE',
    remito: 'R-0001-00004512',
    monto: '300.000',
  },
  {
    id: 2,
    razon_social: 'Almacén Don Jose',
    domicilio: 'Av. 7 1234',
    estado: 'ENTREGADO',
    remito: 'R-0001-00004513',
    monto: '15500.00',
  },
  {
    id: 3,
    razon_social: 'Supermercado Los Amigos',
    domicilio: 'Calle 12 550',
    estado: 'PENDIENTE',
    remito: 'R-0001-00004510',
    monto: '4500.00',
  },
  {
  id: 7,
    razon_social: 'Kiosco El Rápido',
    domicilio: 'Mitre 5022',
    estado: 'NO ENTREGADO',
    remito: 'R-0001-00004512',
    monto: '300.000',
  },
  {
  id: 8,
    razon_social: 'Kiosco El Rápido',
    domicilio: 'Mitre 5022',
    estado: 'PENDIENTE',
    remito: 'R-0001-00004512',
    monto: '300.000',
  },
  {
  id: 9,
    razon_social: 'Kiosco El Rápido',
    domicilio: 'Mitre 5022',
    estado: 'PENDIENTE',
    remito: 'R-0001-00004512',
    monto: '300.000',
  },
];

export default function HojaDeRutaScreen(){
 // 1. Atajamos el ID que manda la pantalla de Login 
  const { id }: { id?: string } = useLocalSearchParams();
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true);
  // Mensaje para cuando no hay hoja (ej: "No tenés una hoja de ruta asignada para hoy.") o no hay internet
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pedidoSeleccionadoParaRemito, setPedidoSeleccionadoParaRemito] = useState<Pedido | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);

  const [seleccionados, setSeleccionados] = useState<number[]>([]);
  // Id de la hoja de ruta, hace falta para crear la entrega (null mientras el back no lo mande)
  const [hojaId, setHojaId] = useState<number | null>(null);
  //Entrega en curso: arranca con la que quedó guardada en el celular (por si la app se cerró a mitad de un cobro)
  const [entregaEnCurso, setEntregaEnCursoPantalla] = useState<EntregaEnCurso | null>(() => obtenerEntregaEnCurso());
  // Cada vez que cambia la guardamos, así no se pierde si Android cierra la app
  const setEntregaEnCurso = (entrega: EntregaEnCurso | null) => {
    setEntregaEnCursoPantalla(entrega);
    guardarEntregaEnCurso(entrega);
  };
  // MODIFICAR ENTREGA (comentado por ahora)
  // const [modoModificacion, setModoModificacion] = useState(false);
  // true si ya se cargó algún pago de la entrega en curso (ahí ya no se puede modificar)
  // const [pagoIniciado, setPagoIniciado] = useState(false);
  

  // Datos de cada pedido para armar el resumen (tipo ticket) en Pagos.
  // Se manda como texto porque los parámetros de la pantalla solo pueden ser texto
  const detallePara = (ids: number[]) =>
    JSON.stringify(
      pedidos
        .filter((p) => ids.includes(p.id))
        .map((p) => ({ id: p.id, razon_social: p.razon_social, domicilio: p.domicilio, remito: p.remito, monto: p.monto }))
    );

  const ContinuarEntrega = () => {
    if (!entregaEnCurso) return;
    router.push({
      pathname: '/pagos',
      params: {
        // String y no toString: una entrega guardada antes de este cambio no tiene id y no tiene que romper
        entregaId: String(entregaEnCurso.entregaId),
        ids: entregaEnCurso.ids.join(','),
        montoTotal: entregaEnCurso.montoTotal.toString(),
        detalle: detallePara(entregaEnCurso.ids),
      },
    });
  };

  // MODIFICAR ENTREGA (comentado por ahora)
  /*
  const ModificarEntrega = () => {
    if (!entregaEnCurso) return;
    setSeleccionados(entregaEnCurso.ids);
    setModoModificacion(true);
  };

  const GuardarModificacion = async () => {
    if (seleccionados.length === 0) {
      Alert.alert('Atención', 'Debes seleccionar al menos un pedido.');
      return;
    }
    try {
      await modificarEntregaAPI(seleccionados, montoTotal);
      setEntregaEnCurso({ ids: seleccionados, montoTotal });
      setModoModificacion(false);
      Alert.alert('Éxito', 'La entrega ha sido modificada correctamente.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo modificar la entrega.');
    }
  };
  */

const BorrarEntrega = () => {
    console.log('funciona');
    
    try {
      Alert.alert(
        'Borrar entrega',
        '¿Estás seguro de borrar toda la información de la entrega en curso?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Sí, borrar',
            style: 'destructive',
            onPress: async () => {
              try {
                // Si ya se habían cargado pagos, también se borran del back
                if (entregaEnCurso) {
                  await borrarPagosIniciados(entregaEnCurso.ids);
                  await borrarEntregaAPI(entregaEnCurso.entregaId);
                }
                setEntregaEnCurso(null);
                setSeleccionados([]);
                // setModoModificacion(false); // MODIFICAR ENTREGA (comentado por ahora)
              } catch (error: any) {
                Alert.alert('Error', error.message || 'No se pudo borrar la entrega.');
              }
            },
          },
        ]
      );
      console.log('sss'); // Si llega acá, el alert se lanzó bien
    } catch (error) {
      console.log('❌ ERROR CRÍTICO EN ALERT:', error);
    }
  };

  // POST al crear una nueva entrega al presionar "Proceder a entrega"
  const ProcederAEntrega = async () => {
    // Sin pedidos elegidos no se puede seguir
    if (seleccionados.length === 0) {
      Alert.alert('Atención', 'Debe seleccionar al menos un pedido para registrar la entrega');
      return;
    }
    try {
      // El back devuelve el id de la entrega nueva; los pagos se cargan a esa entrega
      const entregaId = await crearEntregaAPI(hojaId, seleccionados);
      setEntregaEnCurso({ entregaId, ids: seleccionados, montoTotal });
      router.push({
        pathname: '/pagos',
        params: { entregaId: entregaId.toString(), ids: seleccionados.join(','), montoTotal: montoTotal.toString(), detalle: detallePara(seleccionados) },
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo registrar la entrega.');
    }
  };


  // Cada vez que se entra a la pantalla (también al volver de Pagos) se piden los pedidos al back 
  useFocusEffect(
    useCallback(() => {
      // Sin ID no hay a quién pedirle la hoja: cortamos la carga en vez de quedar girando 
      if (!id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setMensaje(null);
      // La lista es nueva, así que se limpia lo que estaba seleccionado 
      setSeleccionados([]);
      obtenerHojaRuta(id)
        .then((data) => {
          setHojaId(data.hojaId);
          setPedidos(data.pedidos);
        })
        .catch((e) => {
          setPedidos([]);
          setMensaje(e instanceof Error && e.message ? e.message : 'Ocurrió un error inesperado.');
        })
        .finally(() => setLoading(false));
    }, [id]) // Se vuelve a crear si cambia el ID
  );

  // Pedidos de prueba sin back (desactivado: ahora los pedidos vienen del back)
  /*useEffect(() => {
    const timer = setTimeout(() => {
      setPedidos(PEDIDOS_MOCK);
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);*/

  // Cada vez que volvés a esta pantalla (por ej. desde Pagos):
  // - los pedidos que se terminaron de pagar pasan a ENTREGADO y la entrega en curso se cierra
  useFocusEffect(
    useCallback(() => {
      const entregados = tomarEntregados();
      if (entregados.length > 0) {
        setPedidos((lista) =>
          lista.map((p) => (entregados.includes(p.id) ? { ...p, estado: 'ENTREGADO' } : p))
        );
        setEntregaEnCurso(null);
        setSeleccionados([]);
        // MODIFICAR ENTREGA (comentado por ahora)
        // setModoModificacion(false);
        // setPagoIniciado(false);
        return;
      }
      // MODIFICAR ENTREGA (comentado por ahora): si quedó un pago a medias se avisa, para sacar el botón de modificar
      // setPagoIniciado(entregaEnCurso ? hayPagosIniciados(entregaEnCurso.ids) : false);
    }, [])
  );

  // Ordenar pedidos por estado (el orden por dirección lo manda el back)
  const ordenarPedidos = (lista: Pedido[]) => {
    const prioridadEstado: Record<string, number> = {
      'PENDIENTE': 1,
      'ENTREGADO': 2,
      'NO ENTREGADO': 3,
    };

    return [...lista].sort((a, b) => {
      if (prioridadEstado[a.estado] !== prioridadEstado[b.estado]) {
        return prioridadEstado[a.estado] - prioridadEstado[b.estado];
      }
      return a.id - b.id;
    });
  };

  const pedidosOrdenados= ordenarPedidos(pedidos);

  // Se puede elegir cualquier pedido pendiente, sea del domicilio que sea
  const puedeSeleccionarse = (pedido: Pedido) => pedido.estado === 'PENDIENTE';

  const seleccionarPedido= (id:number)=>{
    // Con una entrega en curso no se puede elegir nada: primero hay que continuarla o borrarla
    if (entregaEnCurso) return;
    const pedido = pedidos.find((p) => p.id === id);
      if(!pedido || (!seleccionados.includes(id) && !puedeSeleccionarse(pedido))){
      return;
      }

      // Selección individual: si ya estaba elegido se saca, si no se agrega solo ese
      if(seleccionados.includes(id)){
        setSeleccionados(seleccionados.filter((itemId) => itemId !== id));
        return;
      }

      setSeleccionados([...seleccionados, id]);
    };

    // Pendientes de un domicilio (para "Seleccionar todos los pedidos de este destino")
    const pendientesDe = (domicilio: string) =>
      pedidos.filter((p) => p.estado === 'PENDIENTE' && p.domicilio === domicilio).map((p) => p.id);

    // Marca todos los pendientes de ese destino (sin tocar los de otros destinos ya elegidos)
    const seleccionarDestino = (domicilio: string) => {
      const faltan = pendientesDe(domicilio).filter((id) => !seleccionados.includes(id));
      setSeleccionados([...seleccionados, ...faltan]);
    };

    {/* Monto total pedidos */}
    let montoTotal = 0;
    for (let i = 0; i < pedidos.length; i++) {
    const pedido = pedidos[i];
    
    let estaSeleccionado = false;
    for (let j = 0; j < seleccionados.length; j++) {
      if (seleccionados[j] === pedido.id) {
        estaSeleccionado = true;
        break; 
      }
    }

    if (estaSeleccionado) {
      montoTotal += parseFloat(pedido.monto || '0');
    }
  }

 return (
  // Barra de arriba
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <View style={styles.pestaniaPedidos}>
            <LogoCamion ancho={32} variante="repartidor" />
        </View>

            {/* Al mapa le mandamos los pedidos con su dirección para que los ubique */}
            <Link
              href={{
                pathname: '/mapa',
                params: { pedidos: JSON.stringify(pedidos.map((p) => ({ id: p.id, direccion: p.domicilio, estado: p.estado }))) },
              }}
              asChild>
              <TouchableOpacity style={styles.headerIconMapa}>
                <IconoUbicacion tamanio={34} />
              </TouchableOpacity>
            </Link>

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

    {/* Contenido condicional según la carga o los pedidos */}
    {loading ? (
      <View style={styles.center}>
        <ActivityIndicator size="large"/>
      </View>
    ) : pedidos.length === 0 ? (
      <View style={styles.center}>
        <Image source={require('@/assets/images/sin-pedidos.png')}
        style={{width:100, height:100, marginBottom:20}}/>
        <Text style={styles.emptyText}>{mensaje ?? 'No tienes pedidos asignados para la jornada'}</Text>   
      </View>
    ) : (
      <>
        {/* Entrega en curso*/}
        {entregaEnCurso && /* !modoModificacion && */ (
          <View style={styles.avisoBannerContainer}>
            <Text style={styles.avisoTitulo}>⚠️ Tenés una entrega en curso</Text>
            <View style={styles.avisoBotonesRow}>
              <TouchableOpacity style={[styles.avisoBtn, styles.ent]} onPress={ContinuarEntrega}>
                <Text style={styles.avisoBtnText}>Continuar entrega</Text>
              </TouchableOpacity>
            {/* MODIFICAR ENTREGA (comentado por ahora). Si ya se empezó a pagar no se podía modificar
            {!pagoIniciado && (
              <TouchableOpacity style={[styles.avisoBtn, styles.pend]} onPress={ModificarEntrega}>
                <Text style={styles.avisoBtnText}>Modificar entrega</Text>
              </TouchableOpacity>
            )}
            */}
              <TouchableOpacity style={[styles.avisoBtn, styles.noEnt]} onPress={BorrarEntrega}>
                <Text style={styles.avisoBtnText}>Borrar entrega</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Modificacion  -  MODIFICAR ENTREGA (comentado por ahora)
         {modoModificacion && (
        <View style={styles.modoModificacionBanner}>
          <Text style={styles.modoModText}>✏️ Modificando entrega. Selecciona o quita pedidos:</Text>
          <TouchableOpacity style={styles.cancelarModBtn} onPress={() => { setModoModificacion(false); setSeleccionados([]); }}>
            <Text style={styles.cancelarModText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
        )}
        */}

        <Text style={styles.subTitle}> </Text>  
        <FlatList
          data={pedidosOrdenados}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => {
            const estaSeleccionado=seleccionados.includes(item.id);
            const deshabilitado = !estaSeleccionado && !puedeSeleccionarse(item);
            // Cuando ya elegiste un pedido, los que no se pueden sumar (ya entregados o no entregados) quedan en gris
            const enGris = seleccionados.length > 0 && deshabilitado;
            // "Seleccionar todos los pedidos de este destino": aparece recién cuando se eligió un pedido
            // de un destino que tiene más de un pendiente, y mientras falte alguno de ahí por elegir.
            // Va arriba del pedido elegido (si ya hay varios elegidos de ese destino, arriba del primero de la lista)
            const pendientesDestino = pendientesDe(item.domicilio);
            const mostrarSeleccionarDestino =
              !entregaEnCurso &&
              pendientesDestino.length > 1 &&
              pendientesDestino.some((id) => !seleccionados.includes(id)) &&
              pedidosOrdenados.find((p) => p.domicilio === item.domicilio && seleccionados.includes(p.id))?.id === item.id;


            return(
              <View>
                {mostrarSeleccionarDestino && (
                  <TouchableOpacity style={styles.seleccionarDestinoBtn} onPress={() => seleccionarDestino(item.domicilio)}>
                    <Text style={styles.seleccionarDestinoTexto}>Seleccionar todos los pedidos de este destino</Text>
                  </TouchableOpacity>
                )}
                {/* Se elige tocando cualquier parte de la tarjeta (no con una entrega en curso) */}
                <TouchableOpacity
                  style={[styles.card, estaSeleccionado && styles.cardSeleccionada, enGris && styles.cardGris]}
                  activeOpacity={0.7}
                  onPress={() => seleccionarPedido(item.id)}
                  disabled={deshabilitado || !!entregaEnCurso}>
                  <View style={styles.cardLeft}>
                    <Text style={[styles.direccion, item.estado === 'ENTREGADO' && styles.textoTachado]}>
                      {item.domicilio} </Text>
                    <Text style={[styles.razon_social, item.estado === 'ENTREGADO' && styles.textoTachado]}> 
                      {item.razon_social}</Text>

                    <TouchableOpacity style={styles.remitoButton} onPress={() => setPedidoSeleccionadoParaRemito(item)}>
                      <Text style={styles.remitoButtonText}>📄 Mostrar remito</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.statusContainer}>
                    <Text style={[styles.estado, styles[item.estado === 'PENDIENTE' ? 'pend' : item.estado === 'ENTREGADO' ? 'ent' : 'noEnt']]}>
                    {item.estado}</Text>
                  </View>
                </TouchableOpacity>
              </View>
            );
          }}
        />

        {/* MODIFICAR ENTREGA (comentado por ahora): antes era (!entregaEnCurso || modoModificacion),
          el onPress era modoModificacion ? GuardarModificacion : ProcederAEntrega
          y el texto modoModificacion ? `Guardar cambios (${seleccionados.length})` : `Proceder a entrega ($${montoTotal})` */}
        {/* Se ve aunque no haya nada elegido: si se toca así, avisa que hay que elegir al menos uno */}

        {!entregaEnCurso && (
          <View style={styles.boton}>
            <TouchableOpacity
              style={styles.entregarBoton}
              onPress={ProcederAEntrega}>
            <Text style={styles.entregarBotonTexto}>
              {`Proceder a entrega ($${montoTotal})`}
            </Text>
           </TouchableOpacity>
          </View>
        )}
      </>
    )}

        <Modal 
        visible={pedidoSeleccionadoParaRemito !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={()=> setPedidoSeleccionadoParaRemito(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>

              <View style={styles.modalHeader}>
                <Text style={styles.modalHeaderText}>📄 Remito de Entrega</Text>
                </View>

              <View style={styles.modalBodyContenido}>
              {/* Se muestra directamente el PDF del remito que manda el back */}
              {pedidoSeleccionadoParaRemito && <RemitoPdf remito={pedidoSeleccionadoParaRemito.remito} alto={480} />}

              {/* Botón Cerrar Remito */}
              <TouchableOpacity 
                style={styles.cerrarButton} 
                onPress={() => setPedidoSeleccionadoParaRemito(null)}>
                <Text style={styles.cerrarButtonText}>Cerrar Remito</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  headerIconMapa: {
    top: 8, fontSize: 22, marginRight: 30,
  },
 pestaniaPedidos:{
    top:10, borderRadius:15, width: 40, height: 40,
    backgroundColor: 'rgba(255, 246, 236, 0.15)',
    alignItems: 'center', justifyContent: 'center', marginRight: 16,
  },
  botonUsuario: {
    top: 10, marginLeft: 'auto',
  },
  avisoBannerContainer: {
    backgroundColor: '#f1c6af', padding: 12, marginHorizontal: 16,
    marginTop: 10, borderRadius: 8, borderWidth: 1, borderColor: '#FFEEBA',
  },
  avisoTitulo: {
    fontSize: 14, fontWeight: 'bold', color: '#856404',
    marginBottom: 8, textAlign: 'center',
  },
  avisoBotonesRow: {
    flexDirection: 'row', justifyContent: 'space-between', gap: 6,
  },
  avisoBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 6,
    alignItems: 'center',
  },
  avisoBtnText: {
    fontSize: 12, fontWeight: '600', paddingHorizontal: 8,
    paddingVertical: 4, borderRadius: 4, overflow: 'hidden',
  },
  // Rectángulo con los colores de la marca: Azul Ruta de fondo y texto Crema Pan
  seleccionarDestinoBtn: {
    backgroundColor: '#123C6B', borderRadius: 8, marginHorizontal: 16, marginTop: 6, marginBottom: 10,
    paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center',
  },
  seleccionarDestinoTexto: {
    fontSize: 14, fontWeight: 'bold', color: '#FFF6EC',
  },
  // MODIFICAR ENTREGA (comentado por ahora)
  /*
  modoModificacionBanner: {
    backgroundColor: '#D1ECF1', padding: 10, marginHorizontal: 16,
    marginTop: 10, borderRadius: 8, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
  },
  modoModText: {
    fontSize: 12, color: '#0C5460', flex: 1,
  },
  cancelarModBtn: {
    backgroundColor: '#6C757D', paddingHorizontal: 8,
    paddingVertical: 4, borderRadius: 4,
  },
  cancelarModText: {
    color: '#FFF', fontSize: 11,
  },
  */
  subTitle: {
    fontSize: 18, fontWeight: 'bold', color: '#1B1B1F', 
    marginHorizontal: 16, marginVertical: 2,
  },
  center: {
    flex: 1, backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
  },
  emptyText: {
    fontSize: 16, color: '#666',
  },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 10, padding: 16,
    marginHorizontal: 16, marginBottom: 12, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 2, elevation: 2,
  },
  cardLeft: {
    flex: 1,
  },
  cardSeleccionada: {
  borderColor: '#123C6B', borderWidth: 2, backgroundColor: '#FFF6EC', 
},
  cardGris: {
    backgroundColor: '#EBEEF5', opacity: 0.5,
  },
  direccion: {
    fontSize: 18, fontWeight: 'bold', color: '#1B1B1F', marginBottom: 4,
  },
  razon_social: {
    fontSize: 16, fontWeight: 'bold', color: '#F4661B', marginBottom: 12,
  },
  remitoButton: {
    borderWidth: 1, borderColor: '#DCDFE6', borderRadius: 6,
    paddingVertical: 6, paddingHorizontal: 10, alignSelf: 'flex-start',
    backgroundColor: '#FAFAFA',
  },
  remitoButtonText: {
    fontSize: 12, color: '#606266', fontWeight: '500',
  },
  estado: {
    fontSize: 12, fontWeight: '600', paddingHorizontal: 8,
    paddingVertical: 4, borderRadius: 4, overflow: 'hidden',
  },
  pend: { backgroundColor: '#fff3cd', color: '#856404' },
  ent:  { backgroundColor: '#d4edda', color: '#155724' },
  noEnt: { backgroundColor: '#f8d7da', color: '#721c24' },
  emptyContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
  },

  textoTachado: {
  textDecorationLine: 'line-through',  color: '#909399', 
},

  //Seleccionar
  statusContainer: {
    alignItems: 'center',
  },
  statusCircle: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1, borderColor: '#DCDFE6', marginBottom: 4,
  },
  greenCircle: {
    backgroundColor: '#F4661B', borderColor: '#F4661B',
  },
  grayCircle: {
    backgroundColor: '#FFFFFF',
  },
  statusLabel: {
    fontSize: 10, color: '#909399', fontWeight: 'bold',
  },

  //Pantalla Remito
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalContainer: {
    width: '85%', maxHeight: '90%', backgroundColor: '#FFFFFF', borderRadius: 12,
    overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4, elevation: 5,
  },
  modalHeader: {
    backgroundColor: '#F4661B', paddingVertical: 16, alignItems: 'center',
  },
  modalHeaderText: {
    fontSize: 18, fontWeight: 'bold', color: '#FFF6EC',
  },
  modalBodyContenido: {
    padding: 20,
  },
  cerrarButton: {
    backgroundColor: '#123C6B', borderRadius: 8, paddingVertical: 14, alignItems: 'center',
  },
  cerrarButtonText: {
    color: '#FFFFFF', fontSize: 15, fontWeight: 'bold',
  },

  //Boton de entregas
  boton: {
    position: 'absolute', bottom: 20, left: 20, right: 20, alignItems: 'center',
  },
  entregarBoton: {
    backgroundColor: '#F4661B', borderRadius: 8, paddingVertical: 16,
    width: '100%', alignItems: 'center', shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25,
    shadowRadius: 4, elevation: 5,
  },
  entregarBotonTexto: {
    color: '#FFFFFF',fontSize: 16, fontWeight: 'bold',
  },

  //Menu
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
});