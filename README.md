# Inge-Software
========================================================================
LOGÍSTICA ENVÍOS - BACKEND WEB (DJANGO & DRF)
========================================================================

Instrucciones para clonar, configurar y ejecutar el proyecto localmente.

------------------------------------------------------------------------
REQUISITOS PREVIOS
------------------------------------------------------------------------
- Python 3.10 o superior instalado.
- Git instalado.

------------------------------------------------------------------------
GUÍA DE INSTALACIÓN PASO A PASO
------------------------------------------------------------------------

1. CLONAR EL REPOSITORIO
   Abre una terminal y clona el proyecto en tu máquina:
   
   git clone https://github.com/tu-usuario/tu-repositorio.git
   cd tu-repositorio


2. NAVEGAR HASTA LA CARPETA QUE UTILIZARA PYTHON
   cd BACK-WEB


3. CREAR Y ACTIVAR UN ENTORNO VIRTUAL
   ejecuten linea por linea

   - En Windows (PowerShell / CMD):
       python -m venv venv
       venv\Scripts\activate

   - En Linux / macOS:
       python3 -m venv venv
       source venv/bin/activate

   (Comprueba que aparezca '(venv)' al inicio de la línea de comandos).


4. INSTALAR DEPENDENCIAS
   Con el entorno virtual activo, instala los paquetes requeridos:
   
   pip install -r requirements.txt


5. CONFIGURAR LAS VARIABLES DE ENTORNO (.env)
   Entrar a la carpeta del proyecto que se creo con el manage.py
      cd logistica_envios
   
   Copia la plantilla de ejemplo para crear tu archivo local:

   - En Windows:
       copy .env.example .env

   - En Linux / macOS:
       cp .env.example .env

   Luego genera una clave secreta aleatoria ejecutando:
   
   python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"

   Abre el archivo .env con un editor de texto y asigna la clave generada
   a la variable SECRET_KEY:
   
   SECRET_KEY=pega_aqui_el_valor_generado
   DEBUG=True

   (guardar antes de continuar)

6. CREAR LA BASE DE DATOS Y APLICAR MIGRACIONES
   python manage.py migrate


7. INICIAR EL SERVIDOR DE DESARROLLO
   python manage.py runserver

   El servicio estará disponible en: http://127.0.0.1:8000/

========================================================================
NOTAS DE SEGURIDAD
========================================================================
- Los archivos .env y db.sqlite3 están excluidos por .gitignore y nunca 
  deben subirse al repositorio de Git.
========================================================================





========================================================================
FRONTEND MOBILE (EXPO REACT NATIVE - CARPETA 'APP')
========================================================================

------------------------------------------------------------------------
REQUISITOS PREVIOS
------------------------------------------------------------------------
- Node.js (versión LTS recomendada, v18 o superior).
- Aplicación móvil 'Expo Go' instalada en tu teléfono celular (disponible 
  en Google Play Store para Android o App Store para iOS).

------------------------------------------------------------------------
GUÍA DE INSTALACIÓN Y EJECUCIÓN
------------------------------------------------------------------------

1. NAVEGAR A LA CARPETA MOBILE
   Desde la raíz del repositorio (en la terminal deberia de aparecer asi ...\Inge-Software>)
   ingresa al directorio de la app:

   cd APP


2. INSTALAR DEPENDENCIAS DE NODE
   Instala todos los paquetes requeridos definidos en package.json:

   npm install


3. INICIAR EL SERVIDOR DE DESARROLLO (METRO BUNDLER)
   Ejecuta:

   npx expo start

   (Si experimentas problemas de caché, puedes ejecutar: npx expo start -c)


4. VISUALIZAR LA APLICACIÓN
   Una vez que Metro Bundler termine de compilar, verás un código QR 
   en la terminal:

   - En celular físico (Android / iOS):
     * Conecta tu celular a la MISMA RED WI-FI que tu computadora.
     * En Android: Abre la app 'Expo Go' y selecciona 'Scan QR code'.
     * En iOS: Abre la app de la Cámara nativa y escanea el código QR.

   - En el navegador web:
     * Presiona la tecla 'w' en la terminal.

   - En emulador:
     * Presiona 'a' para abrir en emulador de Android (requiere Android Studio).
     * Presiona 'i' para abrir en simulador de iOS (solo en macOS con Xcode).

========================================================================
NOTAS DE SEGURIDAD Y CONFIGURACIÓN
========================================================================
- La carpeta 'APP/node_modules' y los archivos temporales de compilación 
  (.expo, dist, logs) están excluidos por el archivo .gitignore y nunca 
  deben subirse al repositorio.
========================================================================