// Copia Leaflet (el que dibuja el mapa) adentro de la app, así el mapa no depende de bajarlo de internet.
// Se corre una sola vez, o cuando se actualiza leaflet:  node scripts/generar-leaflet.js
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'node_modules', 'leaflet', 'dist');
const js = fs.readFileSync(path.join(dist, 'leaflet.js'), 'utf8');
const css = fs.readFileSync(path.join(dist, 'leaflet.css'), 'utf8');

// "<\/" para que nada adentro del código corte la etiqueta <script> del HTML
const comoTexto = (texto) => JSON.stringify(texto).replace(/<\//g, '<\\/');

const salida =
  '// ARCHIVO GENERADO por scripts/generar-leaflet.js, no editar a mano.\n' +
  `// Leaflet ${require(path.join(dist, '..', 'package.json')).version}\n` +
  `export const LEAFLET_JS = ${comoTexto(js)};\n` +
  `export const LEAFLET_CSS = ${comoTexto(css)};\n`;

fs.writeFileSync(path.join(__dirname, '..', 'src', 'constants', 'leaflet.ts'), salida);
console.log('Listo: src/constants/leaflet.ts');
