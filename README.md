# Clip Studio · producción local

Herramienta local para preparar un guion, transcript y voz una sola vez; organizar medios por bloque o capítulo; editar un montaje con timeline; y exportar MP4 o un proyecto editable de CapCut. Conserva el estilo oscuro y rosa de Clip Viral. Gemini, Beats JSON a prompts y el renombrador de assets están en el panel fijo del lado derecho. La creación automática de shorts desde un video largo ya no forma parte del flujo.

## Iniciar

En macOS, abre `Iniciar Clip Studio.command`: busca un puerto local libre desde 4173 y muestra la dirección. En terminal, ejecuta `npm ci` y `npm start` en esta carpeta y visita `http://127.0.0.1:4173` (o define `PORT` si está ocupado).

Requiere Node.js 22+, FFmpeg y ffprobe. Las descargas de YouTube requieren `yt-dlp`. La vista previa y el MP4 usan Remotion; la primera exportación puede descargar su navegador de render. No hay Worker de Cloudflare.

## Flujo de trabajo

1. **Entradas:** crea o abre un proyecto. Arrastra el guion, un SRT o Words JSON y el audio original. El guion también se puede pegar. Los archivos se guardan en `data/studio/`. **Eliminar proyecto** borra definitivamente su carpeta interna completa (medios importados, ajustes y renders), sin pasar por la Papelera. Los originales externos no se borran.
2. **Transcript:** combina el SRT original o genera un SRT desde Words JSON con la lógica de segmentación de Beat Console. El generador corta en comas, puntos, otros signos, silencios largos y duración máxima. Revisa y pulsa **Usar en proyecto**. Los JSON opcionales de capítulos y search terms se cargan aquí, después de comparar el transcript de trabajo. Si combinas un SRT, el texto y los tiempos originales se conservan para los subtítulos; el SRT combinado organiza el storyboard. Si generas desde Words JSON, el SRT generado se usa también para subtítulos.
3. **Medios:** importa archivos o carpetas por arrastrar y soltar; busca en Storyblocks, Pexels o Google Images; o descarga y corta videos de YouTube por capítulos. Los resultados de Storyblocks y Pexels muestran su resolución y se ordenan de mayor a menor dentro de cada lote. Al escoger un video de cualquiera de las dos fuentes, se guarda el extracto necesario para la escena, incluso en el autocompletado. En **Completar medios faltantes** agrega una secuencia editable de imagen/video y fuente; se repite para las escenas pendientes. El botón de inicio requiere las claves de las fuentes elegidas. Google Images requiere la extensión incluida: revisa hasta 10 candidatas con OCR local, admite títulos breves (hasta 10% del área) y descarta imágenes con demasiado texto o marcas de agua reconocibles. En el autocompletado usa la primera imagen apta y pasa al siguiente bloque. No usa Gemini para este filtro. Las imágenes elegidas de Google se guardan espejadas. Los clips de YouTube se guardan espejados y sin audio. Puedes reanudar la descarga desde un número de video. La biblioteca y el storyboard muestran 15 elementos por página. Beats JSON a prompts y el renombrador están en las pestañas del panel lateral.
4. **Editor:** usa el panel izquierdo para transiciones y efectos globales, pausas, formato y plantillas. El monitor central reproduce la composición Remotion; la línea de tiempo muestra textos, tomas, efectos visuales, transiciones, subtítulos, música, SFX y voz. Seleccionar un elemento abre sus propiedades a la derecha. Los divisores entre Ajustes globales y el montaje, entre Vista previa y Propiedades, y encima del timeline se pueden arrastrar; sus tamaños se guardan en este navegador. También admiten flechas del teclado al enfocarlos y doble clic para restablecerlos. Arrastra el corte entre dos tomas para redistribuir su duración sin cambiar la duración del vídeo; arrastra los extremos de textos y subtítulos para ajustar sus tiempos. Puedes reemplazar una toma, editar su movimiento y encuadre, ajustar una transición individual, corregir subtítulos, añadir música y efectos, y crear textos con diez plantillas configurables. Un texto personalizado puede guardarse como plantilla para otros proyectos. Hay 80 pasos para deshacer y rehacer, atajos y guardado automático. El ajuste de pausas mantiene sincronizados WAV, SRT, subtítulos, escenas, capítulos y textos.
5. **Exportar:** genera MP4 H.264/AAC a 720p o 1080p. También descarga el SRT de subtítulos, JSON del proyecto y un paquete CapCut editable.

Para exportar desde macOS, inicia la app con `Iniciar Clip Studio.command` desde Finder. Si se inicia dentro de una sesión restringida de Codex, macOS puede impedir que Remotion abra Chrome para el render; la app mostrará un diagnóstico breve. La vista previa reproduce una composición de Remotion sin generar MP4. Los cambios globales y por segmento se reflejan al momento; pausa, reanudación y búsqueda usan el mismo reloj del timeline. **Exportar MP4** renderiza esa misma composición y muestra el progreso. Los archivos H.264/AAC pueden diferir levemente en decodificación y compresión respecto del navegador. Las claves de Gemini y Pexels se introducen para la sesión; no se guardan en el proyecto.

Para verificar una instalación nueva, deja la app ejecutándose y usa `npm run check:browser` seguido de `npm run smoke:render` en otra terminal de la misma máquina. La segunda orden crea un proyecto temporal con una imagen, un video, subtítulos y una transición Slide; renderiza un MP4 corto, comprueba su resolución, duración y decodificación, y elimina el proyecto temporal. Si el servidor usa otro puerto, antepón `PORT=<puerto>`. En una sesión restringida de macOS Chrome puede perder su conexión aunque la app funcione; ejecuta esta prueba desde Terminal después de abrir la app con el `.command`, o directamente en el VPS. Para conservar el proyecto y revisar el resultado, usa `SMOKE_KEEP_PROJECT=1 npm run smoke:render`.

## Formatos

- SRT estándar con marcas `HH:MM:SS,mmm`.
- Words JSON: objeto con `words: [{text,start,end}]` y, preferiblemente, `text` completo.
- Capítulos JSON: array con `chapter` o `name`, `startText`/`endText` o tiempos `start`/`end`, `searchTerm` o `searchTerms`, y opcionalmente `urls` de YouTube.
- Beats JSON: array o `{beats:[...]}` con `id` y un campo seleccionable, normalmente `prompt`.

## CapCut

El ZIP incluye una timeline editable de medios, transiciones, narración, música y SFX, `transcript.srt` y `SETUP.command` para actualizar rutas tras copiar la carpeta a CapCut. Abrí un paquete de prueba en la versión de CapCut instalada en este equipo y comprobé dos escenas, una transición y tres pistas de audio. Importa `transcript.srt` para crear subtítulos nativos. El encuadre y los efectos visuales exactos del MP4 no se trasladan a controles nativos de CapCut.

## Mejoras siguientes

La exportación prepara extractos temporales de los videos que exceden la resolución de salida, tienen un formato incompatible o incluyen mucho metraje sin usar. Esos extractos se reutilizan si el archivo y la edición no cambian. El MP4 usa lectura por fotograma para evitar saltos de movimiento; el ajuste «Calidad máxima» conserva PNG y codifica H.264 con CRF 14 y preset fast.

El servidor solo escucha en `127.0.0.1`. Los trabajos antiguos de Clip Viral permanecen en `data/`, pero el flujo automático anterior no está disponible en esta app.

## Filtro local de Google Images

El OCR se ejecuta con Tesseract.js y modelos inglés/español incluidos en `models/tessdata/`; no envía las imágenes a Gemini. Se calcula el área cubierta por líneas de texto reconocidas y se admite hasta el 10%. También se descartan marcas de agua y nombres de plataformas reconocidos por el OCR. Logos puramente gráficos y marcas muy tenues pueden escapar al detector: revisa cada imagen antes de usarla. Los modelos provienen de [tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast) y conservan su licencia Apache 2.0.
