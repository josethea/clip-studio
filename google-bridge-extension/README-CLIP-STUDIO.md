# Google Images en Clip Studio

Esta carpeta conserva el recolector de imágenes original y añade un puente para el storyboard de Clip Studio. La búsqueda se hace en una pestaña visible de Google Images. Si Google solicita una verificación, resuélvela manualmente en esa pestaña.

1. Abre `chrome://extensions`, activa **Modo de desarrollador** y elige **Cargar descomprimida**. Selecciona esta carpeta `google-bridge-extension`.
2. Abre la extensión y pulsa **Conectar con Clip Studio**. Introduce la dirección local que aparece en la pestaña **Claves** de Clip Studio y pulsa **Conectar**. Mantén abierta esa pestaña del puente mientras buscas.
3. En **Medios**, elige **Google Images** en un bloque o selecciona Google Images para completar medios faltantes. No necesitas la clave de Gemini para buscar o filtrar imágenes.
4. La app usa el término de búsqueda ya asociado al bloque y revisa un máximo de diez candidatas. En la búsqueda manual muestra hasta cinco imágenes aptas; al completar medios automáticamente usa la primera apta y pasa al siguiente bloque. El texto puede ocupar como máximo el 10% de la imagen y se descartan marcas de agua o logos con letras reconocibles. Al asignar una imagen crea una copia horizontalmente invertida dentro del proyecto; el archivo de origen permanece intacto.

El detector visual puede equivocarse. Revisa las imágenes elegidas y sus derechos de uso antes de publicar. Google Images es un buscador, no una licencia de contenido. El análisis de texto se hace localmente mediante Tesseract.js. Los logos gráficos sin letras y algunas marcas de agua sutiles pueden pasar el filtro; revísalos antes de asignar o publicar.
