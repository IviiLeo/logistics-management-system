import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { eliminarPago as eliminarPagoBack, registrarPago, type MetodoPago, type Pago } from '@/services/pagos';
import { guardarPagos, marcarEntregados, obtenerPagos } from '@/services/entregaEnCurso';
import { cambiarEstadoEntregaAPI } from '@/services/hojaRuta';

// Cobro de la entrega: en efectivo y/o por cuenta corriente, y después se confirman los pagos

type Metodo = MetodoPago;

// Métodos de pago que se pueden elegir
const METODOS: { valor: Metodo; nombre: string }[] = [
  { valor: 'EFECTIVO', nombre: 'Efectivo' },
  { valor: 'CUENTA_CORRIENTE', nombre: 'Cuenta corriente' },
];

// Lo que manda la hoja de ruta de cada pedido para el resumen
interface DetallePedido {
  id: number;
  razon_social: string;
  domicilio: string;
  remito: string | null;
  monto: string;
}

// Una fila de "Pagos agregados" (la de efectivo puede juntar varios pagos)
interface FilaPago {
  clave: string;
  metodo: Metodo;
  monto: number;
  ids: number[]; // ids de los pagos en el back que forman esta fila
}

// Letra de ancho fijo, como la de los tickets
const LETRA_TICKET = Platform.select({ ios: 'Menlo', default: 'monospace' });

// Línea punteada del ticket
const SEPARADOR = '- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -';

export default function Pagos() {
  // Lo que manda la hoja de ruta llega siempre como texto, por eso lo pasamos a número
  // (ids viene así: "1,2,3")
  const { entregaId, ids, montoTotal, detalle }: { entregaId?: string; ids?: string; montoTotal?: string; detalle?: string } = useLocalSearchParams();
  const entrega = Number(entregaId);
  const pedidos = ids ? ids.split(',').map(Number) : [];
  const total = Number(montoTotal);

  // Datos de cada pedido para el resumen. Si llega algo raro, el resumen queda vacío y no se rompe la pantalla
  let detallePedidos: DetallePedido[] = [];
  try {
    detallePedidos = detalle ? JSON.parse(detalle) : [];
  } catch {
    detallePedidos = [];
  }

  // Pagos que ya se agregaron. Si es una entrega que ya se había empezado a cobrar, arrancan los que estaban
  const [pagos, setPagosPantalla] = useState<Pago[]>(() => obtenerPagos(pedidos));
  // true después de tocar "Confirmar Pagos": ahí aparece "Confirmar Entrega"
  const [pagosConfirmados, setPagosConfirmados] = useState(false);
  // Cada vez que cambia la lista la guardamos, así si salís sin confirmar no se pierde.
  // Si los pagos cambian hay que volver a confirmarlos antes de confirmar la entrega
  const setPagos = (nuevos: Pago[]) => {
    setPagosPantalla(nuevos);
    guardarPagos(pedidos, nuevos);
    setPagosConfirmados(false);
    // Si cambian los pagos, el aviso de la suma ya no corresponde
    setErrorSuma(null);
  };
  // Suma todos los montos de la lista
  const sumaPagos = pagos.reduce((suma, p) => suma + p.monto, 0);
  const pendiente = total - sumaPagos;

  // Método de pago elegido
  const [metodo, setMetodo] = useState<Metodo | null>(null);
  const metodoElegido = METODOS.find((m) => m.valor === metodo);
  // El monto lo escribe el transportista, no viene cargado
  const [monto, setMonto] = useState('');
  const [errorPago, setErrorPago] = useState<string | null>(null);

  // Mientras esperamos al back (agregando o borrando un pago) los botones quedan bloqueados
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [errorLista, setErrorLista] = useState<string | null>(null);

  // Mientras el back confirma la entrega, y el error que mande si no deja
  const [confirmandoEntrega, setConfirmandoEntrega] = useState(false);
  const [errorEntrega, setErrorEntrega] = useState<string | null>(null);

  const ocupado = guardando || eliminandoId !== null || confirmandoEntrega;

  // Si lo escrito es más que lo que falta pagar, no se deja agregar (en centavos porque JS a veces redondea mal)
  const montoNumero = Number(monto.replace(',', '.').trim());
  const superaPendiente = !Number.isNaN(montoNumero) && Math.round(montoNumero * 100) > Math.round(pendiente * 100);

  // Si cambia de método se borra lo que había escrito
  const elegirMetodo = (nuevo: Metodo) => {
    setMetodo(nuevo);
    setMonto('');
    setErrorPago(null);
  };

  // Al tocar "Confirmar" el pago se manda al back y recién ahí aparece en la lista.
  // Acá solo se revisa que no supere lo adeudado: el resto lo valida el back y si está mal mostramos el error que manda
  const agregarPago = async () => {
    if (!metodoElegido || superaPendiente) return;
    setErrorLista(null);
    setErrorPago(null);
    setGuardando(true);
    try {
      // Se puede escribir con coma o con punto
      const pago = await registrarPago(entrega, metodoElegido.valor, monto.replace(',', '.').trim(), pendiente);
      setPagos([...pagos, pago]);
      setMonto('');
    } catch (e) {
      setErrorPago(e instanceof Error && e.message ? e.message : 'Ocurrió un error inesperado.');
    } finally {
      setGuardando(false);
    }
  };

  // Pagos que se pueden borrar si se cargaron mal
  const METODOS_ELIMINABLES: Metodo[] = ['EFECTIVO', 'CUENTA_CORRIENTE'];

  // Borra los pagos de una fila del back y, si sale bien, también de la lista (pendiente se actualiza solo).
  // La fila de efectivo puede tener varios pagos juntos, así que se borran uno por uno
  const eliminarPago = async (fila: FilaPago) => {
    setErrorPago(null);
    setErrorLista(null);
    setEliminandoId(fila.clave);
    let quedan = pagos;
    try {
      for (const id of fila.ids) {
        await eliminarPagoBack(id);
        quedan = quedan.filter((p) => p.id !== id);
        setPagos(quedan);
      }
    } catch (e) {
      setErrorLista(e instanceof Error && e.message ? e.message : 'Ocurrió un error inesperado.');
    } finally {
      setEliminandoId(null);
    }
  };

  // Filas de "Pagos agregados": todos los pagos en efectivo van juntos en una sola fila con la suma,
  // los de cuenta corriente van cada uno en su fila
  const pagosEfectivo = pagos.filter((p) => p.metodo === 'EFECTIVO');
  const filas: FilaPago[] = [
    ...(pagosEfectivo.length > 0
      ? [{
          clave: 'EFECTIVO',
          metodo: 'EFECTIVO' as Metodo,
          monto: pagosEfectivo.reduce((suma, p) => suma + p.monto, 0),
          ids: pagosEfectivo.map((p) => p.id),
        }]
      : []),
    ...pagos
      .filter((p) => p.metodo !== 'EFECTIVO')
      .map((p) => ({ clave: String(p.id), metodo: p.metodo, monto: p.monto, ids: [p.id] })),
  ];

  // La suma de los pagos tiene que ser igual al total (en centavos porque JS a veces redondea mal)
  const todoPago = pagos.length > 0 && Math.round(pendiente * 100) === 0;
  const [errorSuma, setErrorSuma] = useState<string | null>(null);

  // Los pagos ya se mandaron al back con cada "Confirmar" y "Eliminar", así que acá no se va al back.
  // Si la suma coincide con el total aparece abajo la pregunta y el botón "Confirmar Entrega";
  // si no, se avisa y los pagos no se confirman
  const confirmar = () => {
    if (!todoPago) {
      setErrorSuma('La suma de los pagos no coincide con el monto total del pedido');
      return;
    }
    setErrorSuma(null);
    setPagosConfirmados(true);
  };

  // "Confirmar Entrega": se le avisa al back que la entrega quedó entregada (él pasa los pedidos a "entregado")
  // y se vuelve a la hoja de ruta, que muestra los pedidos como ENTREGADO.
  // Si el back no deja, se muestra su mensaje tal cual y no se sale de la pantalla
  const confirmarEntrega = async () => {
    setErrorEntrega(null);
    setConfirmandoEntrega(true);
    try {
      await cambiarEstadoEntregaAPI(entrega, 'entregada');
      marcarEntregados(pedidos);
      router.back();
    } catch (e) {
      setErrorEntrega(e instanceof Error && e.message ? e.message : 'Ocurrió un error inesperado.');
    } finally {
      setConfirmandoEntrega(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} disabled={ocupado}>
          <Text style={styles.volverText}>‹ Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pagos del pedido</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Resumen tipo ticket del super: cada pedido con su monto y al final el total */}
        <View style={styles.card}>
          <Text style={styles.ticketTitulo}>RESUMEN DE LA ENTREGA</Text>
          {detallePedidos.length > 0 && (
            <Text style={styles.ticketDomicilio}>{detallePedidos[0].domicilio}</Text>
          )}

          <Text style={styles.ticketSeparador} numberOfLines={1} ellipsizeMode="clip">{SEPARADOR}</Text>

          {detallePedidos.map((p) => (
            <View key={p.id} style={styles.ticketFila}>
              <View style={styles.ticketItem}>
                <Text style={styles.ticketTexto}>{p.razon_social}</Text>
                {/* El campo remito trae la ruta del PDF, así que se muestra el número de pedido */}
                <Text style={styles.ticketSubtexto}>{`Pedido #${p.id}`}</Text>
              </View>
              <Text style={styles.ticketTexto}>$ {Number(p.monto).toFixed(2)}</Text>
            </View>
          ))}

          <Text style={styles.ticketSeparador} numberOfLines={1} ellipsizeMode="clip">{SEPARADOR}</Text>

          <View style={styles.ticketFila}>
            <Text style={styles.ticketTotalLabel}>
              TOTAL ({pedidos.length} {pedidos.length === 1 ? 'pedido' : 'pedidos'})
            </Text>
            <Text style={styles.ticketTotal}>$ {total.toFixed(2)}</Text>
          </View>

          <Text style={styles.ticketSeparador} numberOfLines={1} ellipsizeMode="clip">{SEPARADOR}</Text>

          <View style={styles.ticketFila}>
            <Text style={styles.label}>PENDIENTE DE PAGO</Text>
            <Text style={styles.valor}>$ {pendiente.toFixed(2)}</Text>
          </View>
        </View>

        {/* Selección del método de pago */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Método de pago</Text>
          {METODOS.map((m) => (
            <TouchableOpacity
              key={m.valor}
              style={[styles.metodoOpcion, metodo === m.valor && styles.metodoOpcionSeleccionada]}
              onPress={() => elegirMetodo(m.valor)}
              disabled={ocupado}
            >
              <View style={[styles.radio, metodo === m.valor && styles.radioSeleccionado]} />
              <Text style={styles.metodoOpcionText}>{m.nombre}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Esto aparece cuando elegís un método */}
        {metodoElegido && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pago en {metodoElegido.nombre.toLowerCase()}</Text>

          <Text style={styles.label}>MONTO RECIBIDO</Text>
          <View style={styles.montoRow}>
            <Text style={styles.signoPeso}>$</Text>
            <TextInput
              style={styles.input}
              value={monto}
              onChangeText={(t) => {
                setMonto(t);
                setErrorPago(null);
              }}
              placeholder="0"
              placeholderTextColor="#C0C4CC"
              keyboardType="decimal-pad"
              editable={!ocupado}
            />
          </View>

          {superaPendiente ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ El monto ingresado es mayor al total adeudado</Text>
            </View>
          ) : errorPago && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {errorPago}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.agregarButton, (!monto || ocupado || superaPendiente) && styles.botonDeshabilitado]}
            onPress={agregarPago}
            disabled={!monto || ocupado || superaPendiente}
          >
            {guardando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.botonText}>Confirmar</Text>
            )}
          </TouchableOpacity>
        </View>
        )}

        {/* Pagos agregados */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pagos agregados</Text>
          {pagos.length === 0 ? (
            <Text style={styles.sinPagos}>Todavía no se agregaron pagos.</Text>
          ) : (
            filas.map((f) => (
              <View key={f.clave} style={styles.pagoFila}>
                <Text style={styles.pagoMetodo}>{METODOS.find((m) => m.valor === f.metodo)?.nombre}</Text>
                <View style={styles.pagoDerecha}>
                  <Text style={styles.pagoMonto}>$ {f.monto.toFixed(2)}</Text>
                  {METODOS_ELIMINABLES.includes(f.metodo) && (
                    <TouchableOpacity style={styles.eliminarButton} onPress={() => eliminarPago(f)} disabled={ocupado}>
                      {eliminandoId === f.clave ? (
                        <ActivityIndicator size="small" color="#F56C6C" />
                      ) : (
                        <Text style={styles.eliminarText}>Eliminar</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}
          <View style={styles.sumaFila}>
            <Text style={styles.sumaLabel}>Suma de pagos</Text>
            <Text style={styles.sumaMonto}>$ {sumaPagos.toFixed(2)}</Text>
          </View>

          {/* Si el back no deja borrar un pago (ej: ya está validado) mostramos lo que dice */}
          {errorLista && (
            <View style={[styles.errorBox, styles.errorLista]}>
              <Text style={styles.errorText}>⚠️ {errorLista}</Text>
            </View>
          )}
        </View>

        {/* Confirmar pagos: si la suma no coincide con el total, se muestra el aviso */}
        {errorSuma && (
          <View style={[styles.errorBox, styles.errorSuma]}>
            <Text style={styles.errorText}>⚠️ {errorSuma}</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.confirmarButton, ocupado && styles.botonDeshabilitado]}
          onPress={confirmar}
          disabled={ocupado}
        >
          <Text style={styles.botonText}>Confirmar Pagos</Text>
        </TouchableOpacity>

        {/* Después de confirmar los pagos: pregunta y botón para confirmar la entrega */}
        {pagosConfirmados && (
          <View style={styles.confirmarEntregaCaja}>
            <Text style={styles.confirmarEntregaPregunta}>¿Desea confirmar la entrega?</Text>

            {errorEntrega && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {errorEntrega}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.confirmarEntregaButton, ocupado && styles.botonDeshabilitado]}
              onPress={confirmarEntrega}
              disabled={ocupado}
            >
              {confirmandoEntrega ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.botonText}>Confirmar Entrega</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF6EC',
  },
  headerBar: {
    backgroundColor: '#F4661B',
    height: 100,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  volverText: {
    fontSize: 15,
    color: '#FFF6EC',
    fontWeight: '600',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF6EC',
  },
  scroll: {
    paddingVertical: 16,
    paddingBottom: 40,
  },

  // Tarjetas
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1B1B1F',
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    color: '#909399',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  // Resumen tipo ticket
  ticketTitulo: {
    fontFamily: LETRA_TICKET,
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1B1B1F',
    textAlign: 'center',
  },
  ticketDomicilio: {
    fontFamily: LETRA_TICKET,
    fontSize: 13,
    color: '#606266',
    textAlign: 'center',
    marginTop: 4,
  },
  ticketSeparador: {
    fontFamily: LETRA_TICKET,
    color: '#C0C4CC',
    marginVertical: 8,
  },
  ticketFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ticketItem: {
    flex: 1,
    marginRight: 12,
  },
  ticketTexto: {
    fontFamily: LETRA_TICKET,
    fontSize: 14,
    color: '#1B1B1F',
  },
  ticketSubtexto: {
    fontFamily: LETRA_TICKET,
    fontSize: 11,
    color: '#909399',
  },
  ticketTotalLabel: {
    fontFamily: LETRA_TICKET,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1B1B1F',
  },
  ticketTotal: {
    fontFamily: LETRA_TICKET,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F4661B',
  },
  valor: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F4661B',
  },

  // Método de pago
  metodoOpcion: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DCDFE6',
    borderRadius: 8,
    backgroundColor: '#FAFAFA',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  metodoOpcionSeleccionada: {
    borderColor: '#123C6B',
    borderWidth: 2,
    backgroundColor: '#FFF6EC',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#DCDFE6',
    backgroundColor: '#FFFFFF',
    marginRight: 12,
  },
  radioSeleccionado: {
    borderColor: '#123C6B',
    borderWidth: 6,
  },
  metodoOpcionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1B1B1F',
  },

  // Pago en efectivo
  montoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  signoPeso: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1B1B1F',
    marginRight: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DCDFE6',
    borderRadius: 8,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    color: '#1B1B1F',
  },

  // Pagos agregados
  sinPagos: {
    fontSize: 14,
    color: '#909399',
    marginBottom: 12,
  },
  pagoFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEEF5',
  },
  pagoMetodo: {
    fontSize: 15,
    color: '#606266',
  },
  pagoMonto: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1B1B1F',
  },
  pagoDerecha: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eliminarButton: {
    marginLeft: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F56C6C',
  },
  eliminarText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F56C6C',
  },
  sumaFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  sumaLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1B1B1F',
  },
  sumaMonto: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#F4661B',
  },

  // Error
  errorBox: {
    backgroundColor: '#f8d7da',
    borderRadius: 6,
    padding: 10,
    marginBottom: 16,
  },
  errorLista: {
    marginTop: 12,
    marginBottom: 0,
  },
  errorSuma: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  errorText: {
    color: '#721c24',
    fontSize: 14,
  },

  // Botones
  agregarButton: {
    backgroundColor: '#123C6B',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmarButton: {
    backgroundColor: '#F4661B',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 4,
  },
  confirmarEntregaCaja: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  confirmarEntregaPregunta: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#123C6B',
    textAlign: 'center',
    marginBottom: 12,
  },
  confirmarEntregaButton: {
    backgroundColor: '#123C6B',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  botonDeshabilitado: {
    backgroundColor: '#909399',
  },
  botonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
