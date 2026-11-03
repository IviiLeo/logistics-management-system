// Login del transportista con DNI y PIN.
// La pantalla de login solo llama a iniciarSesionTransportista(), todo lo del back está acá.
// Los datos los valida el back, si algo está mal mostramos el mensaje que manda.

// 1. Actualizamos la interfaz con los datos reales que manda Django
export interface Transportista {
  id: number;
  dni: string;
  nombre: string;
  apellido: string;
  cbu: string;
  alias: string;
}

export interface RespuestaLogin {
  token: string;
  transportista: Transportista;
}

import { loginPrueba } from './datosPrueba';

// MI GENTE, ACA LINK DE API Y SE PONE EN false EL MODO PRUEBA
// true = usa los datos de datosPrueba.ts sin back, false = usa el back de verdad
// (hojaRuta.ts también lo usa, así el login y la hoja de ruta prueban con los mismos datos)
export const USAR_DATOS_PRUEBA = false;

// TODO: acordar la URL real con backend 
const API_URL = 'https://distance-skewer-overpass.ngrok-free.dev';

// Este mensaje lo ponemos nosotros porque si no hay internet el back no responde nada
const MENSAJE_SIN_CONEXION = 'Revise su conexión a internet para iniciar sesión';

// Si la señal es mala el pedido puede quedar colgado, así que lo cortamos a los 15 segundos
const TIEMPO_LIMITE_MS = 15000;

async function respuestaApi(dni: string, pin: string) {
  // Esto es lo que corta el fetch cuando se pasan los 15 segundos
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIEMPO_LIMITE_MS);

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({ dni, pin }),
      signal: controller.signal,
    });
  } catch {
    // Si falla el fetch es porque no hay internet o se pasó el tiempo
    throw new Error(MENSAJE_SIN_CONEXION);
  } finally {
    clearTimeout(timeout);
  }

  // Si el back respondió algo que no es JSON igual hubo conexión, así que no es ese error
  return { ok: response.ok, data: await response.json().catch(() => null) };
}

export async function iniciarSesionTransportista(dni: string, pin: string): Promise<RespuestaLogin> {
  const respuesta: { ok: boolean; data: any } = USAR_DATOS_PRUEBA
    ? await loginPrueba(dni, pin)
    : await respuestaApi(dni, pin);

  // Si el status HTTP fue de error (401, 403, etc) o vino la clave 'error'
  if (!respuesta.ok || respuesta.data?.error) {
    throw new Error(respuesta.data?.error || 'Error al iniciar sesión.');
  }

  // ÉXITO: Mapeamos la respuesta del backend para que el resto de la app funcione sin romperse
  return {
    token: 'token-temporal-hasta-implementar-jwt', // Django aún no manda token, simulamos uno
    transportista: respuesta.data.usuario // Acá enganchamos el 'usuario' de Django al 'transportista' del Front
  };
}
