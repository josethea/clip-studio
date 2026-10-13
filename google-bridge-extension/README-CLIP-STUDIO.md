# Google Images en Clip Studio

Esta carpeta conserva el recolector de imágenes original y añade un puente para el storyboard de Clip Studio. La búsqueda se hace en una pestaña visible de Google Images. Si Google solicita una verificación, resuélvela manualmente en esa pestaña.

1. Abre `chrome://extensions`, activa **Modo de desarrollador** y elige **Cargar descomprimida**. Selecciona esta carpeta `google-bridge-extension`.
2. Abre la extensión y pulsa **Conectar con Clip Studio**. Para el VPS usa `https://studio.jthea.tech`; para la instalación local usa `http://127.0.0.1:4173`. Si Caddy solicita autenticación, escribe el mismo usuario y contraseña en el puente. La contraseña no se guarda en Chrome Storage y tendrás que introducirla otra vez al abrir una nueva pestaña del puente. Mantén esa pestaña abierta mientras buscas.
3. En **Medios**, elige **Google Images** en un bloque o selecciona Google Images para completar medios faltantes. No necesitas la clave de Gemini para buscar o filtrar imágenes.
4. La app usa el término de búsqueda ya asociado al bloque y revisa un máximo de diez candidatas. En la búsqueda manual muestra hasta cinco imágenes aptas; al completar medios automáticamente usa la primera apta y pasa al siguiente bloque. El texto puede ocupar como máximo el 10% de la imagen y se descartan marcas de agua o logos con letras reconocibles. Al asignar una imagen crea una copia horizontalmente invertida dentro del proyecto; el archivo de origen permanece intacto.

El detector visual puede equivocarse. Revisa las imágenes elegidas y sus derechos de uso antes de publicar. Google Images es un buscador, no una licencia de contenido. El análisis de texto se hace localmente mediante Tesseract.js. Los logos gráficos sin letras y algunas marcas de agua sutiles pueden pasar el filtro; revísalos antes de asignar o publicar.

## VPS con Caddy y contraseña

Chrome puede enviar una solicitud CORS `OPTIONS` antes del `POST` que lleva la autenticación. Permite únicamente ese preflight del puente y conserva la autenticación en todas las demás solicitudes:

```caddyfile
studio.jthea.tech {
    @authRequired {
        not {
            method OPTIONS
            path /api/studio/google-bridge/*
        }
    }

    basic_auth @authRequired {
        jthea HASH_ACTUAL_DEL_CADDYFILE
    }

    reverse_proxy 127.0.0.1:4173
}
```

Reutiliza el hash actual; no pegues la contraseña en claro. Comprueba con `caddy validate --config /etc/caddy/Caddyfile` y después `systemctl reload caddy`. El servidor de Clip Studio responde al preflight para orígenes `chrome-extension://...` y exige la autenticación de Caddy para `GET` y `POST`.
