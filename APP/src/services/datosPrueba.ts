// Datos de prueba para usar la app sin el back.
// Devuelven lo mismo que el back ({ ok, data }) así el resto del código funciona igual.
// Los mensajes de error son inventados, los de verdad los manda el back.
// MI GENTE, ACA LINK DE API Y SE PONE EN false EL MODO PRUEBA -> en auth.ts (USAR_DATOS_PRUEBA)

// Transportistas de prueba, se pueden agregar los que hagan falta
export const TRANSPORTISTAS_PRUEBA = [
  { id: 1, dni: '12345678', pin: '1234', nombre: 'Juan', apellido: 'Pérez', cbu: '0000000000000000000001', alias: 'juan.perez', estado: true },
  { id: 2, dni: '23456789', pin: '5678', nombre: 'María', apellido: 'López', cbu: '0000000000000000000002', alias: 'maria.lopez', estado: true },
  { id: 3, dni: '87654321', pin: '1234', nombre: 'Ana', apellido: 'Gómez', cbu: '0000000000000000000003', alias: 'ana.gomez', estado: false },
];

export async function loginPrueba(dni: string, pin: string) {
  // Esperamos un poco para que parezca que va al back
  await new Promise((resolve) => setTimeout(resolve, 800));

  const transportista = TRANSPORTISTAS_PRUEBA.find((t) => t.dni === dni);

  if (!transportista || transportista.pin !== pin) {
    return { ok: false, data: { error: '[Prueba] DNI o PIN incorrectos.' } };
  }
  if (!transportista.estado) {
    return { ok: false, data: { error: '[Prueba] La cuenta está desactivada.' } };
  }

  return {
    ok: true,
    data: {
      exito: true,
      mensaje: 'Inicio de sesión correcto',
      usuario: {
        id: transportista.id,
        dni: transportista.dni,
        nombre: transportista.nombre,
        apellido: transportista.apellido,
        cbu: transportista.cbu,
        alias: transportista.alias,
      },
    },
  };
}

// Pedidos de prueba para la hoja de ruta, con los mismos campos que manda el back
const PEDIDOS_PRUEBA = [
  { id: 1, razon_social: 'Kiosco El Rápido', domicilio: 'Mitre 5022', estado: 'asignado', remito: null, monto_total: '300000.00' },
  { id: 2, razon_social: 'Almacén Don Jose', domicilio: 'Av. 7 1234', estado: 'entregado', remito: null, monto_total: '15500.00' },
  // Tiene remito: con "Mostrar remito" se ve el PDF de prueba (services/remitoPrueba.ts)
  { id: 3, razon_social: 'Supermercado Los Amigos', domicilio: 'Calle 12 550', estado: 'asignado', remito: '/media/remitos/remito-prueba.pdf', monto_total: '4500.00' },
  { id: 7, razon_social: 'Kiosco El Rápido', domicilio: 'Mitre 5022', estado: 'no_entregado', remito: null, monto_total: '300000.00' },
  { id: 8, razon_social: 'Kiosco El Rápido', domicilio: 'Mitre 5022', estado: 'asignado', remito: null, monto_total: '300000.00' },
  { id: 9, razon_social: 'Kiosco El Rápido', domicilio: 'Mitre 5022', estado: 'asignado', remito: null, monto_total: '300000.00' },
  // Dirección inventada a propósito: el buscador no la encuentra, sirve para probar el aviso
  // "No se pudo encontrar en el mapa"
  { id: 10, razon_social: 'Despensa Fantasma', domicilio: 'Qwzxkj Vbnmpl 00000', estado: 'asignado', remito: null, monto_total: '8000.00' },
];

// Entregas de prueba: igual que el back, se recuerda qué pedidos tiene cada entrega y,
// al confirmarla, esos pedidos se devuelven como 'entregado' en la hoja de ruta.
// Se guarda solo en memoria: al cerrar la app los pedidos vuelven a como estaban
const entregasPrueba = new Map<number, number[]>();
const pedidosEntregadosPrueba = new Set<number>();

export function crearEntregaPrueba(ids: number[]) {
  const entregaId = Date.now(); // id inventado
  entregasPrueba.set(entregaId, ids);
  return entregaId;
}

export function confirmarEntregaPrueba(entregaId: number) {
  (entregasPrueba.get(entregaId) ?? []).forEach((id) => pedidosEntregadosPrueba.add(id));
}

export async function hojaRutaPrueba() {
  await new Promise((resolve) => setTimeout(resolve, 800));
  return {
    ok: true,
    data: PEDIDOS_PRUEBA.map((p) => (pedidosEntregadosPrueba.has(p.id) ? { ...p, estado: 'entregado' } : p)),
  };
}

// Pagos de prueba: no se guardan en ningún lado, solo hacen como que el back respondió.
// Los controles del monto son los que tiene que hacer el back de verdad (los mensajes son de ejemplo)
let ultimoIdPago = 0;

export async function registrarPagoPrueba(monto: string, pendiente: number) {
  await new Promise((resolve) => setTimeout(resolve, 500));

  const valor = Number(monto);
  if (monto === '' || isNaN(valor)) {
    return { ok: false, data: { error: '[Prueba] Ingresá un monto válido.' } };
  }
  if (valor <= 0) {
    return { ok: false, data: { error: '[Prueba] El monto del pago debe ser mayor a 0.' } };
  }
  // En centavos porque con decimales JS a veces redondea mal
  if (Math.round(valor * 100) > Math.round(pendiente * 100)) {
    return { ok: false, data: { error: `[Prueba] El monto no puede superar lo pendiente de pago ($ ${pendiente.toFixed(2)}).` } };
  }

  ultimoIdPago += 1;
  return { ok: true, data: { id: ultimoIdPago } };
}

export async function eliminarPagoPrueba() {
  await new Promise((resolve) => setTimeout(resolve, 500));
}