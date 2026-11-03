// Guarda lo de la entrega que se está cobrando, así se comparte entre la hoja de ruta y Pagos.
// - La entrega en curso (qué pedidos y por cuánto): si la app se cierra, al volver sigue estando.
// - Los pagos ya cargados: si salís de Pagos sin confirmar y volvés, siguen estando.
// - Los pedidos que se terminaron de pagar: la hoja de ruta los pasa a ENTREGADO al volver.
// Todo se guarda en el celular (no solo en memoria) porque en los celulares con poca memoria
// Android cierra la app cuando el transportista abre otra (WhatsApp, cámara...) y se perdía todo.

import Storage from 'expo-sqlite/kv-store';

import { eliminarPago, type Pago } from './pagos';

const CLAVE_ENTREGA = 'entregaEnCurso';
const CLAVE_PAGOS = 'pagosEntregaEnCurso';
const CLAVE_ENTREGADOS = 'pedidosEntregados';

// Lee algo guardado. Si no hay nada o está roto, devuelve el valor por defecto
function leer<T>(clave: string, porDefecto: T): T {
  try {
    const texto = Storage.getItemSync(clave);
    return texto ? (JSON.parse(texto) as T) : porDefecto;
  } catch {
    return porDefecto;
  }
}

function escribir(clave: string, valor: unknown) {
  try {
    if (valor === null) Storage.removeItemSync(clave);
    else Storage.setItemSync(clave, JSON.stringify(valor));
  } catch {
    // Si no se pudo guardar, la app sigue andando igual (solo se perdería al cerrarse)
  }
}

export interface EntregaEnCurso {
  entregaId: number; // id que le puso el back al crearla: los pagos se cargan a esta entrega
  ids: number[];
  montoTotal: number;
}

// Entrega que se armó con "Proceder a entrega" y todavía no se terminó de cobrar
export function obtenerEntregaEnCurso(): EntregaEnCurso | null {
  return leer<EntregaEnCurso | null>(CLAVE_ENTREGA, null);
}

export function guardarEntregaEnCurso(entrega: EntregaEnCurso | null) {
  escribir(CLAVE_ENTREGA, entrega);
}

// Pagos de la entrega en curso. Se guardan junto con los ids de los pedidos
// para no mezclar pagos de una entrega con otra
export function obtenerPagos(ids: number[]): Pago[] {
  const entregaActual = leer<{ ids: string; pagos: Pago[] } | null>(CLAVE_PAGOS, null);
  return entregaActual?.ids === ids.join(',') ? entregaActual.pagos : [];
}

export function guardarPagos(ids: number[], pagos: Pago[]) {
  escribir(CLAVE_PAGOS, { ids: ids.join(','), pagos });
}

// true si ya se cargó algún pago de esta entrega (ahí ya no se puede modificar)
export function hayPagosIniciados(ids: number[]) {
  return obtenerPagos(ids).length > 0;
}

// Al borrar la entrega también se borran del back los pagos que se habían cargado
export async function borrarPagosIniciados(ids: number[]) {
  for (const pago of obtenerPagos(ids)) {
    await eliminarPago(pago.id);
  }
  escribir(CLAVE_PAGOS, null);
}

// Se llama al tocar "Confirmar Pagos" con todo pago
export function marcarEntregados(ids: number[]) {
  escribir(CLAVE_ENTREGADOS, [...leer<number[]>(CLAVE_ENTREGADOS, []), ...ids]);
  escribir(CLAVE_PAGOS, null);
  escribir(CLAVE_ENTREGA, null);
}

// La hoja de ruta lo usa al volver: devuelve los pedidos entregados y los saca de la lista
export function tomarEntregados(): number[] {
  const ids = leer<number[]>(CLAVE_ENTREGADOS, []);
  escribir(CLAVE_ENTREGADOS, null);
  return ids;
}
