# Chapter Image Collector

Extensión Chrome Manifest V3 para procesar un arreglo JSON de capítulos, ejecutar búsquedas ordenadas en Google Imágenes y descargar un ZIP con una carpeta por capítulo.

## Instalar localmente

1. Abre `chrome://extensions` en Chrome.
2. Activa **Developer mode**.
3. Pulsa **Load unpacked**.
4. Selecciona la carpeta `chapter-image-collector` (no selecciones el ZIP).
5. Fija la extensión en la barra de Chrome y pulsa su icono para abrir el panel lateral.

## Formatos de entrada

La extensión detecta automáticamente si el archivo contiene capítulos o términos de búsqueda individuales.

### JSON de capítulos

La raíz debe ser un arreglo. Cada objeto necesita `chapter` y un arreglo no vacío `searchTerm`. `startText`, `endText` e `imageCount` son opcionales.

```json
[
  {
    "chapter": "Cold Open",
    "startText": "Texto inicial opcional",
    "endText": "Texto final opcional",
    "imageCount": 12,
    "searchTerm": [
      "person opening closet door vacuum",
      "corporate merger documents paperwork"
    ]
  }
]
```

Si `imageCount` no está presente, el panel solicita una cantidad distinta para cada capítulo.

### JSON de términos de búsqueda

Cada elemento necesita un `id` único y un `searchTerm` de texto. El campo `text` es opcional y se conserva como contexto. La cantidad es siempre una imagen por elemento y no necesita configurarse.

```json
[
  {
    "id": 1,
    "text": "El ojo humano, una obra maestra de la naturaleza,",
    "searchTerm": "human eye extreme closeup"
  },
  {
    "id": 2,
    "text": "un órgano diseñado para capturar la luz",
    "searchTerm": "eye reflecting colorful lights"
  }
]
```

En este modo, los archivos se guardan directamente en la raíz del ZIP usando el ID y la extensión real: `1.jpg`, `2.png`, etc.

La extensión guarda un checkpoint después de cada elemento. Si el panel se cierra, Chrome reinicia la extensión o una operación se interrumpe, al volver a pulsar **Iniciar operación** se conservan los resultados almacenados y se continúa desde el siguiente ID o capítulo pendiente. Para descartar el checkpoint y comenzar desde cero, utiliza **Cambiar JSON** y luego **Limpiar** antes de volver a importar.

## Flujo

La interfaz está dividida en tres pestañas:

- **Ejecución:** pantalla principal con progreso, estado del escáner, miniaturas, selección automática, registro y descarga final.
- **Capítulos / términos de búsqueda:** permite adjuntar o pegar cualquiera de los dos formatos. Los capítulos muestran cantidades configurables; los términos muestran una cantidad fija de una imagen por ID.
- **Configuración:** contiene los filtros globales Size, Type, Layout, URL, Sort, candidatos por imagen, deduplicación, contenido textual y SafeSearch. Los valores iniciales son `Any`; el orden inicial es `Pixel size`.

1. En **Capítulos / términos de búsqueda**, importa o pega el JSON y pulsa **Guardar JSON**.
2. Si utilizas capítulos, define el total de imágenes de cada uno. En el modo de términos, la cantidad ya está fijada en una imagen por elemento.
3. Revisa los filtros en **Configuración**.
4. Abre una búsqueda de Google Imágenes en la pestaña donde quieres trabajar.
5. Regresa a **Ejecución**, pulsa **Iniciar operación** y concede acceso a los sitios de origen cuando Chrome lo solicite. La extensión reutiliza esa pestaña activa. Solo abre una pestaña de trabajo si no encuentra una búsqueda de Google Imágenes activa.
6. Mantén abierto el panel lateral mientras trabaja. Verás el progreso del escáner, las miniaturas validadas y la selección automática de las imágenes con mayor cantidad de píxeles hasta completar cada cuota.
7. Al finalizar, descarga el ZIP y, si lo necesitas, el JSON de fallos por separado.

Cada descarga de candidato tiene un límite de 12 segundos. La decodificación, el hash y la detección de texto también tienen límites propios; una URL bloqueada se registra como timeout y la operación continúa con el siguiente candidato.

Para reducir verificaciones CAPTCHA, el modo de términos individuales solicita un máximo de 10 candidatos, espera aleatoriamente entre 2 y 5 segundos entre búsquedas y realiza una pausa preventiva de 2 minutos después de cada 50 búsquedas. La espera y su cuenta regresiva aparecen en la vista de ejecución.

Al terminar, la extensión genera `failed-items.json`. El reporte se incluye siempre dentro del ZIP y también puede descargarse por separado. En el modo de términos contiene `id`, `text`, `searchTerm`, cantidades y motivo; en el modo de capítulos contiene el capítulo, sus términos, la cantidad faltante y el motivo.

Si Google muestra un CAPTCHA, la extensión pone la operación en espera y activa la pestaña de búsqueda. Resuelve la verificación sin cerrar el panel lateral: la extensión detectará que terminó y continuará automáticamente desde el término interrumpido, conservando los capítulos y las imágenes ya guardadas.

Si la extensión indica una posible verificación pero no aparece ningún CAPTCHA, utiliza **No veo CAPTCHA · Reintentar**. El botón vuelve a cargar el mismo término y reanuda la operación; no borra el checkpoint ni las imágenes almacenadas.

La opción **Ignorar imágenes con demasiado texto o aspecto de infografía** realiza un análisis local y conservador. Permite fotografías o ilustraciones con pocos rótulos, pero descarta resultados con muchos bloques de texto, anotaciones o leyendas. Como toda clasificación visual automática, puede producir algún falso positivo o falso negativo.

La distribución por términos es equitativa. Para 23 imágenes y 5 términos, las cuotas iniciales son `5, 5, 5, 4, 4`. La primera ronda conserva esas cuotas y, si queda un déficit, lo distribuye equitativamente en una segunda ronda automática.

Los logs distinguen entre URLs candidatas y archivos guardados. Cuando una imagen es rechazada, muestran causas como `red/CORS`, `HTTP 403`, URL repetida, contenido repetido, formato inválido, resolución inferior al filtro o fallo de decodificación.

## Límites conocidos de esta versión

- Google puede cambiar la estructura de su página y requerir ajustes en `google-scanner.js`.
- La extensión pausa el proceso si Google muestra CAPTCHA o una verificación humana; no intenta eludirla. El usuario debe resolverla manualmente para que la operación continúe.
- Algunas URLs firmadas, sitios autenticados o servidores que bloquean solicitudes externas pueden impedir la descarga.
- El ZIP usa el formato clásico sin compresión y admite hasta 4 GB o 65,535 archivos.
- El panel debe permanecer abierto. Chrome puede detener el proceso si el panel se cierra.
- Esta herramienta no concede derechos de uso sobre las imágenes. El usuario debe respetar licencias, derechos de autor y términos del sitio de origen.

## Privacidad

Las configuraciones y las imágenes se procesan localmente. La extensión no contiene analítica, cuentas, anuncios ni un servidor del desarrollador. Consulta `PRIVACY.md`.
