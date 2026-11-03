// Guarda y borra los pagos de un pedido en el back.
// Cada pago se manda al back apenas se agrega y se borra del back cuando se elimina.

import { USAR_DATOS_PRUEBA } from './auth';
import { eliminarPagoPrueba, registrarPagoPrueba } from './datosPrueba';

export type MetodoPago = 'EFECTIVO' | 'CUENTA_CORRIENTE';

export interface Pago {
  id: number; // el id lo pone el back al guardarlo, lo necesitamos para poder borrarlo
  metodo: MetodoPago;
  monto: number;
}

// MI GENTE, ACA LINK DE API Y SE PONE EN false EL MODO PRUEBA
// (el modo prueba se cambia en auth.ts, en USAR_DATOS_PRUEBA)
const API_URL = 'https://distance-skewer-overpass.ngrok-free.dev/pagos/api';

// Así se llaman los métodos en el back (Pago.METODOS_PAGO)
const METODOS_BACK: Record<MetodoPago, string> = {
  EFECTIVO: 'efectivo',
  CUENTA_CORRIENTE: 'cuenta_corriente',
};

// Este mensaje lo ponemos nosotros porque si no hay internet el back no responde nada
const MENSAJE_SIN_CONEXION = 'No se pudo conectar con el servidor. Revisá tu conexión.';

// Si la señal es mala el pedido puede quedar colgado, así que lo cortamos a los 15 segundos
const TIEMPO_LIMITE_MS = 15000;

// El back manda los errores de distintas formas, por ej:
// {"monto": ["El monto del pago debe ser mayor a 0."]} o {"error": "..."}
// Esta función va buscando adentro hasta encontrar el primer texto y ese es el que mostramos.
function primerMensaje(errores: unknown): string | undefined {
  if (typeof errores === 'string') return errores;
  if (Array.isArray(errores)) {
    for (const e of errores) {
      const mensaje = primerMensaje(e);
      if (mensaje) return mensaje;
    }
  } else if (errores && typeof errores === 'object') {
    for (const e of Object.values(errores)) {
      const mensaje = primerMensaje(e);
      if (mensaje) return mensaje;
    }
  }
  return undefined;
}

// Hace el fetch al back y si responde con error tira el mensaje que mandó
async function pedirAlBack(url: string, opciones: RequestInit) {
  // Esto es lo que corta el fetch cuando se pasan los 15 segundos
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIEMPO_LIMITE_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      ...opciones,
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      signal: controller.signal,
    });
  } catch {
    throw new Error(MENSAJE_SIN_CONEXION);
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(primerMensaje(data));
  }
  return data;
}

// Guarda el pago en el back y lo devuelve con el id que le puso.
// El monto se manda tal cual lo escribió el transportista: el back lo valida y si está mal tira el error.
// (pendiente solo lo usa el modo prueba para hacer los mismos controles que el back)
export async function registrarPago(entrega: number, metodo: MetodoPago, monto: string, pendiente: number): Promise<Pago> {
  if (USAR_DATOS_PRUEBA) {
    const respuesta = await registrarPagoPrueba(monto, pendiente);
    if (!respuesta.ok) throw new Error(respuesta.data.error);
    return { id: Number(respuesta.data.id), metodo, monto: Number(monto) };
  }

  const data = await pedirAlBack(`${API_URL}/registrar/`, {
    method: 'POST',
    // El back asocia cada pago a la entrega (ya no a los pedidos)
    body: JSON.stringify({
      entrega,
      metodo_pago: METODOS_BACK[metodo],
      monto,
    }),
  });
  // El monto lo tomamos de lo que guardó el back
  return { id: data.id, metodo, monto: Number(data.monto) };
}

// Borra del back un pago mal cargado (si administración ya lo validó el back no deja)
export async function eliminarPago(pagoId: number) {
  if (USAR_DATOS_PRUEBA) {
    await eliminarPagoPrueba();
    return;
  }

  await pedirAlBack(`${API_URL}/${pagoId}/eliminar/`, { method: 'DELETE' });
}