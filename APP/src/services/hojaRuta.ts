// Trae la hoja de ruta de hoy del transportista (GET /hojas/api/ruta-hoy/<id>/).
// El back usa sus propios nombres para los campos, acá los pasamos a los que usa la pantalla.
// Así si el back cambia algo solo hay que tocar este archivo y no hojaRuta.tsx.
// Simulador local para pruebas sin backend
import { USAR_DATOS_PRUEBA } from './auth';
import { confirmarEntregaPrueba, crearEntregaPrueba, hojaRutaPrueba } from './datosPrueba';
import { REMITO_PRUEBA_BASE64 } from './remitoPrueba';

export type EstadoPedido = 'PENDIENTE' | 'ENTREGADO' | 'NO ENTREGADO';

export interface Pedido {
  id: number;
  domicilio: string;
  estado: EstadoPedido;
  remito: string | null;
  monto: string;
  razon_social: string;
}

export interface PedidoBack {
  id: number;
  estado: 'pendiente' | 'asignado' | 'entregado' | 'no_entregado';
  domicilio: string;
  razon_social: string;
  remito: string | null;
  monto_total: string;
}

// Estado del back -> estado que se ve en la app.
// 'asignado' se muestra como PENDIENTE porque para el repartidor todavía falta entregarlo
const ESTADOS: Record<PedidoBack['estado'], EstadoPedido> = {
  pendiente: 'PENDIENTE',
  asignado: 'PENDIENTE',
  entregado: 'ENTREGADO',
  no_entregado: 'NO ENTREGADO',
};

// MI GENTE, ACA LINK DE API Y SE PONE EN false EL MODO PRUEBA
// (el modo prueba se cambia en auth.ts, en USAR_DATOS_PRUEBA)
const API_URL = 'https://distance-skewer-overpass.ngrok-free.dev';
// Este mensaje lo ponemos nosotros porque si no hay internet el back no responde nada
const MENSAJE_SIN_CONEXION = 'No se pudo conectar con el servidor. Revisá tu conexión.';
// Con señal mala el pedido puede quedar colgado; lo cortamos a los 15 segundos
const TIEMPO_LIMITE_MS = 15000;

// FUNCIÓN GENÉRICA CENTRALIZADA:  Maneja el fetch, timeout, headers de ngrok y errores para cualquier método (GET, POST, PUT, DELETE).

async function peticionApi(endpoint: string, metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', bodyData?: any) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIEMPO_LIMITE_MS);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      method: metodo,
      headers: { 
        'Content-Type': 'application/json', 
        'ngrok-skip-browser-warning': 'true' 
      },
      body: bodyData ? JSON.stringify(bodyData) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new Error(MENSAJE_SIN_CONEXION);
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json().catch(() => null);
  return { ok: response.ok, data };
}

// Devuelve los pedidos de la hoja de hoy y el id de la hoja (hace falta para crear la entrega).
// Hoy el back manda solo la lista de pedidos, sin el id de la hoja: en ese caso hojaId queda en null.
// Si el back pasa a mandar la hoja entera ({id, fecha, transportista, pedidos}) el id se toma de ahí.
export async function obtenerHojaRuta(transportistaId: string): Promise<{ hojaId: number | null; pedidos: Pedido[] }> {
  const respuesta = USAR_DATOS_PRUEBA
    ? await hojaRutaPrueba()
    : await peticionApi(`/hojas/api/ruta-hoy/${transportistaId}/`, 'GET');

  const data: any = respuesta.data;
  const pedidosBack = Array.isArray(data) ? data : data?.pedidos;

  if (!respuesta.ok || !Array.isArray(pedidosBack)) {
    throw new Error(data?.mensaje || data?.error || 'Error al obtener la hoja de ruta.');
  }

  return {
    hojaId: Array.isArray(data) ? null : data.id ?? null,
    pedidos: (pedidosBack as PedidoBack[]).map((p) => ({
      id: p.id,
      domicilio: p.domicilio,
      razon_social: p.razon_social,
      remito: p.remito,
      monto: p.monto_total,
      estado: ESTADOS[p.estado],
    })),
  };
}

const MOCK_MODO = false; // Cambia a false cuando enciendas la base de datos

// Crea la entrega en el back (POST /entregas/api/crear/) y devuelve el id que le puso.
// Con ese id después se cargan los pagos y se cierra la entrega
export async function crearEntregaAPI(hojaDeRutaId: number | null, ids: number[]): Promise<number> {
  if (MOCK_MODO) {
    // Simulamos un pequeño retraso como si fuera la red (500ms)
    await new Promise((resolve) => setTimeout(resolve, 500));
    console.log('📦 [MOCK] Entrega creada localmente:', { hojaDeRutaId, ids });
    return crearEntregaPrueba(ids); // id inventado, solo para el modo simulado
  }

  // Si no tenemos el id de la hoja igual se manda: el back contesta con su propio mensaje de error
  const respuesta = await peticionApi('/entregas/api/crear/', 'POST', { hoja_de_ruta: hojaDeRutaId, pedidos: ids });
  if (!respuesta.ok) {
    throw new Error(respuesta.data?.error || respuesta.data?.mensaje || 'Error al registrar la entrega.');
  }
  return respuesta.data.id;
}

// Baja el PDF del remito de un pedido. El back manda en 'remito' la ruta del archivo (ej: /media/remitos/x.pdf),
// así que le sumamos la dirección del servidor. Se devuelve en base64 para poder dibujarlo en la pantalla
export async function obtenerRemitoPDF(remito: string): Promise<string> {
  // En modo prueba no hay servidor: se muestra el PDF de prueba
  if (USAR_DATOS_PRUEBA) return REMITO_PRUEBA_BASE64;

  const url = remito.startsWith('http') ? remito : `${API_URL}${remito}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIEMPO_LIMITE_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { 'ngrok-skip-browser-warning': 'true' },
      signal: controller.signal,
    });
  } catch {
    throw new Error(MENSAJE_SIN_CONEXION);
  } finally {
    clearTimeout(timeout);
  }

  // Si no vino un PDF (por ej. el archivo no está en el servidor) no hay nada para mostrar
  if (!response.ok || !(response.headers.get('content-type') ?? '').includes('pdf')) {
    throw new Error('No se pudo cargar el remito.');
  }

  const archivo = await response.blob();
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    // El resultado viene como "data:application/pdf;base64,XXXX": nos quedamos solo con lo de después de la coma
    lector.onloadend = () => resolve(String(lector.result).split(',')[1] ?? '');
    lector.onerror = () => reject(new Error('No se pudo cargar el remito.'));
    lector.readAsDataURL(archivo);
  });
}

// Cambia el estado de la entrega (PATCH /entregas/api/<id>/estado/).
// Con 'entregada' el back pasa solo todos los pedidos de la entrega a "entregado"
export async function cambiarEstadoEntregaAPI(entregaId: number, estado: 'en_proceso' | 'entregada' | 'no_entregada') {
  if (MOCK_MODO) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    console.log('✅ [MOCK] Estado de la entrega cambiado localmente:', { entregaId, estado });
    // Como hace el back: al quedar entregada, sus pedidos pasan a "entregado"
    if (estado === 'entregada') confirmarEntregaPrueba(entregaId);
    return { success: true };
  }

  const respuesta = await peticionApi(`/entregas/api/${entregaId}/estado/`, 'PATCH', { estado });
  if (!respuesta.ok) {
    throw new Error(respuesta.data?.error || respuesta.data?.mensaje || 'Error al cambiar el estado de la entrega.');
  }
  return respuesta.data;
}

// MODIFICAR ENTREGA (comentado por ahora)
/*
export async function modificarEntregaAPI(ids: number[], montoTotal: number) {
  if (MOCK_MODO) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    console.log('✏️ [MOCK] Entrega modificada localmente:', { ids, montoTotal });
    return { success: true };
  }

  const respuesta = await peticionApi('/entregas/en-curso/', 'PUT', { ids, montoTotal });
  if (!respuesta.ok) {
    throw new Error(respuesta.data?.mensaje || 'Error al modificar la entrega.');
  }
  return respuesta.data;
}
*/

export async function borrarEntregaAPI(entregaId: number) {
  if (MOCK_MODO) {
    console.log('🚀 Entró a borrarEntregaAPI en el servicio');
    await new Promise((resolve) => setTimeout(resolve, 500));
    console.log('🗑️ [MOCK] Entrega borrada localmente');
    return { success: true };
  }

  const respuesta = await peticionApi(`/entregas/api/${entregaId}/borrar/`, 'DELETE');
  if (!respuesta.ok) {
    throw new Error(respuesta.data?.mensaje || 'Error al borrar la entrega.');
  }
  return respuesta.data;
}

 /*
import { USAR_DATOS_PRUEBA } from './auth';
import { hojaRutaPrueba } from './datosPrueba';

export type EstadoPedido = 'PENDIENTE' | 'ENTREGADO' | 'NO ENTREGADO';

export interface Pedido {
  id: number;
  domicilio: string;
  estado: EstadoPedido;
  remito: string | null;
  monto: string;
  razon_social: string;
}

export interface PedidoBack {
  id: number;
  estado: 'pendiente' | 'asignado' | 'entregado' | 'no_entregado';
  domicilio: string;
  razon_social: string;
  remito: string | null;
  monto_total: string;
}

const ESTADOS: Record<PedidoBack['estado'], EstadoPedido> = {
  pendiente: 'PENDIENTE',
  asignado: 'PENDIENTE',
  entregado: 'ENTREGADO',
  no_entregado: 'NO ENTREGADO',
};

const API_URL = 'https://distance-skewer-overpass.ngrok-free.dev';
// Si no hay conexión, el back nunca llega a responder, así que este mensaje es el único nuestro
const MENSAJE_SIN_CONEXION = 'No se pudo conectar con el servidor. Revisá tu conexión.';
// Con señal mala el pedido puede quedar colgado; lo cortamos a los 15 segundos
const TIEMPO_LIMITE_MS = 15000;

// FUNCIÓN GENÉRICA CENTRALIZADA:  Maneja el fetch, timeout, headers de ngrok y errores para cualquier método (GET, POST, PUT, DELETE).

async function peticionApi(endpoint: string, metodo: 'GET' | 'POST' | 'PUT' | 'DELETE', bodyData?: any) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIEMPO_LIMITE_MS);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      method: metodo,
      headers: { 
        'Content-Type': 'application/json', 
        'ngrok-skip-browser-warning': 'true' 
      },
      body: bodyData ? JSON.stringify(bodyData) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new Error(MENSAJE_SIN_CONEXION);
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json().catch(() => null);
  return { ok: response.ok, data };
}

// 1. OBTENER HOJA DE RUTA (GET)
export async function obtenerHojaRuta(transportistaId: string): Promise<Pedido[]> {
  const respuesta = USAR_DATOS_PRUEBA
    ? await hojaRutaPrueba()
    : await peticionApi(`/hojas/api/ruta-hoy/${transportistaId}/`, 'GET');

  if (!respuesta.ok || !Array.isArray(respuesta.data)) {
    throw new Error(respuesta.data?.mensaje || respuesta.data?.error || 'Error al obtener la hoja de ruta.');
  }

  return (respuesta.data as PedidoBack[]).map((p) => ({
    id: p.id,
    domicilio: p.domicilio,
    razon_social: p.razon_social,
    remito: p.remito,
    monto: p.monto_total,
    estado: ESTADOS[p.estado],
  }));
}

// 2. CREAR ENTREGA (POST)
export async function crearEntregaAPI(ids: number[], montoTotal: number) {
  const respuesta = await peticionApi('/entregas/', 'POST', { ids, montoTotal });

  if (!respuesta.ok) {
    throw new Error(respuesta.data?.mensaje || respuesta.data?.error || 'Error al registrar la entrega.');
  }
  return respuesta.data;
}

// 3. MODIFICAR ENTREGA (PUT)
export async function modificarEntregaAPI(ids: number[], montoTotal: number) {
  const respuesta = await peticionApi('/entregas/en-curso/', 'PUT', { ids, montoTotal });

  if (!respuesta.ok) {
    throw new Error(respuesta.data?.mensaje || respuesta.data?.error || 'Error al modificar la entrega.');
  }
  return respuesta.data;
}

// 4. BORRAR ENTREGA (DELETE)
export async function borrarEntregaAPI() {
  const respuesta = await peticionApi('/entregas/en-curso/', 'DELETE');

  if (!respuesta.ok) {
    throw new Error(respuesta.data?.mensaje || respuesta.data?.error || 'Error al borrar la entrega.');
  }
  return respuesta.data;
}*/