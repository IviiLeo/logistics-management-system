import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { obtenerRemitoPDF } from '@/services/hojaRuta';

// Muestra el PDF del remito adentro de la app.
// Android no puede mostrar un PDF en un WebView, así que lo dibujamos con pdf.js (la librería de Mozilla
// que usa Firefox para los PDF), igual que el mapa usa Leaflet. Así anda en Expo Go sin instalar nada.
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174';

function crearHtmlPdf(base64: string) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          html, body { margin: 0; background: #EBEEF5; }
          canvas { display: block; width: 100%; margin-bottom: 8px; background: #FFFFFF; }
        </style>
        <script src="${PDFJS}/pdf.min.js" onerror="window.ReactNativeWebView.postMessage('error')"></script>
      </head>
      <body>
        <div id="paginas"></div>
        <script>
          try {
            pdfjsLib.GlobalWorkerOptions.workerSrc = '${PDFJS}/pdf.worker.min.js';
            const texto = atob('${base64}');
            const bytes = new Uint8Array(texto.length);
            for (let i = 0; i < texto.length; i++) bytes[i] = texto.charCodeAt(i);

            pdfjsLib.getDocument({ data: bytes }).promise.then(async (pdf) => {
              // Cada página se dibuja del ancho de la pantalla (y con la densidad del celular para que se vea nítida)
              const ancho = document.body.clientWidth;
              for (let n = 1; n <= pdf.numPages; n++) {
                const pagina = await pdf.getPage(n);
                const escala = (ancho / pagina.getViewport({ scale: 1 }).width) * (window.devicePixelRatio || 1);
                const vista = pagina.getViewport({ scale: escala });
                const canvas = document.createElement('canvas');
                canvas.width = vista.width;
                canvas.height = vista.height;
                document.getElementById('paginas').appendChild(canvas);
                await pagina.render({ canvasContext: canvas.getContext('2d'), viewport: vista }).promise;
              }
              window.ReactNativeWebView.postMessage('ok');
            }).catch(() => window.ReactNativeWebView.postMessage('error'));
          } catch (e) {
            window.ReactNativeWebView.postMessage('error');
          }
        </script>
      </body>
    </html>
  `;
}

// alto: cuánto lugar ocupa el PDF en la pantalla (adentro se puede deslizar para ver el resto)
export function RemitoPdf({ remito, alto = 360 }: { remito: string | null; alto?: number }) {
  const [base64, setBase64] = useState<string | null>(null);
  const [cargando, setCargando] = useState(!!remito);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!remito) return;
    let cancelado = false;
    obtenerRemitoPDF(remito)
      .then((datos) => {
        if (!cancelado) setBase64(datos);
      })
      .catch((e) => {
        if (cancelado) return;
        setError(e instanceof Error && e.message ? e.message : 'No se pudo cargar el remito.');
        setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [remito]);

  const onMensaje = (evento: WebViewMessageEvent) => {
    if (evento.nativeEvent.data === 'error') setError('No se pudo mostrar el remito.');
    setCargando(false);
  };

  if (!remito) {
    return <Text style={styles.aviso}>Este pedido no tiene un remito cargado.</Text>;
  }

  if (error) {
    return <Text style={styles.aviso}>{error}</Text>;
  }

  return (
    <View style={[styles.contenedor, { height: alto }]}>
      {base64 && (
        <WebView
          // baseUrl en cdnjs para que pdf.js pueda arrancar su "worker" desde el mismo lugar
          source={{ html: crearHtmlPdf(base64), baseUrl: 'https://cdnjs.cloudflare.com/' }}
          originWhitelist={['*']}
          javaScriptEnabled
          nestedScrollEnabled
          onMessage={onMensaje}
          onError={() => setError('No se pudo mostrar el remito.')}
          style={styles.pdf}
        />
      )}
      {cargando && (
        <View style={styles.cargando}>
          <ActivityIndicator size="large" color="#123C6B" />
          <Text style={styles.cargandoTexto}>Cargando remito...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#EBEEF5',
    marginBottom: 16,
  },
  pdf: {
    flex: 1,
    backgroundColor: '#EBEEF5',
  },
  cargando: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EBEEF5',
  },
  cargandoTexto: {
    marginTop: 8,
    fontSize: 13,
    color: '#606266',
  },
  aviso: {
    fontSize: 14,
    color: '#606266',
    marginBottom: 16,
  },
});
