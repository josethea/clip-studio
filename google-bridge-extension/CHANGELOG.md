# Cambios

## 0.10.0

- Corrige falsos positivos de CAPTCHA provocados por palabras presentes en resultados normales de Google.
- Limita la detección a la página `/sorry`, controles reales de reCAPTCHA o mensajes explícitos de tráfico automatizado sin resultados visibles.
- Añade el botón `No veo CAPTCHA · Reintentar` durante una espera de verificación.
- El reintento vuelve a cargar el mismo término y continúa sin reiniciar la operación.
- Oculta temporalmente Pausar durante la verificación para evitar confundirlo con el control de reanudación.
- Mantiene intactos el checkpoint, las imágenes guardadas y el JSON de fallos.

## 0.9.0

- Reduce a 10 el objetivo y la respuesta máxima de candidatos en el modo de términos individuales.
- Reduce a una ronda mínima el desplazamiento del escáner cuando solo se solicitan 10 candidatos.
- Añade una espera aleatoria de 2 a 5 segundos entre búsquedas.
- Añade una pausa preventiva de 2 minutos después de cada 50 búsquedas.
- Muestra la cuenta regresiva de las esperas en la vista de ejecución.
- Conserva el contador de búsquedas dentro del checkpoint para mantener el ritmo después de una interrupción.

## 0.8.0

- Añade un timeout de 12 segundos para descargar cada candidato y aborta solicitudes bloqueadas.
- Limita a 8 segundos la decodificación y el cálculo de hash, y a 6 segundos la detección nativa de texto.
- Registra los bloqueos como `timeout de descarga`, `timeout de decodificación`, `timeout de lectura` o `timeout de hash` y continúa automáticamente.
- En el modo de términos individuales, deja de programar candidatos nuevos tan pronto como obtiene una imagen válida.
- Guarda un checkpoint después de cada ID o capítulo procesado.
- Recupera automáticamente una ejecución interrumpida y conserva las imágenes ya almacenadas.
- Puede inferir un checkpoint desde imágenes creadas por la versión 0.7.0.
- Genera `failed-items.json` con IDs o capítulos incompletos, términos de búsqueda y motivos de fallo.
- Incluye el reporte en el ZIP y permite descargarlo por separado.

## 0.7.0

- Renombra la segunda pestaña a Capítulos / términos de búsqueda.
- Reconoce automáticamente JSON de capítulos (`chapter` + `searchTerm[]`) y JSON de términos (`id` + `searchTerm`).
- Mantiene el flujo y las cantidades configurables para capítulos.
- Fija automáticamente una imagen por elemento en el modo de términos de búsqueda.
- Nombra cada archivo del ZIP con el `id` correspondiente y conserva la extensión real de la imagen.
- Genera los archivos del modo términos en la raíz del ZIP, por ejemplo `1.jpg`, `2.png` y `3.webp`.

## 0.6.0

- Añade una opción para ignorar imágenes con demasiado texto o aspecto de infografía.
- Permite imágenes con pocos rótulos y rechaza las que contienen numerosos bloques de texto, leyendas o anotaciones.
- Ejecuta el análisis localmente mediante detección de texto del navegador y una heurística visual de respaldo.
- Añade `demasiado texto/infografía` a los motivos de rechazo del registro.

## 0.5.0

- Pausa la operación cuando Google solicita un CAPTCHA, sin borrar el progreso acumulado.
- Activa automáticamente la pestaña de Google para que el usuario complete la verificación.
- Detecta cuándo finaliza la verificación y reanuda automáticamente el mismo término de búsqueda.
- Conserva las imágenes y los capítulos completados antes de la interrupción.

## 0.4.0

- Divide el panel en las pestañas Ejecución, Capítulos y Configuración.
- Mantiene Ejecución como vista principal para el escáner, las miniaturas y el progreso.
- Convierte la vista de importación en la lista de capítulos al guardar el JSON, sin cambiar automáticamente de pestaña.
- Permite regresar a la importación mediante Cambiar JSON.
- Mantiene todos los filtros globales agrupados en Configuración.
- Evita procesar automáticamente un archivo al seleccionarlo: el usuario confirma con Guardar JSON.

## 0.3.0

- Añade un visualizador de escaneo inspirado en el flujo observado de Imageye.
- Muestra fases de descubrimiento, apertura de vistas previas y validación.
- Puebla una galería de imágenes mientras se procesan los candidatos.
- Muestra formato, resolución, dominio y peso de cada resultado válido.
- Ordena visualmente la galería usando el criterio configurado.
- Selecciona automáticamente las imágenes requeridas con borde y check visibles.
- Actualiza en vivo los contadores `found` y `selected / required`.

## 0.2.0

- Reutiliza la pestaña activa de Google Imágenes.
- Solo crea una pestaña cuando no existe una búsqueda de imágenes activa.
- Corrige la acumulación incorrecta de objetivos `1, 2, 3…` tras búsquedas sin resultados.
- Mantiene cuotas equitativas durante la primera ronda.
- Redistribuye el déficit equitativamente en una segunda ronda.
- Prioriza URLs originales y resultados visuales relevantes frente a iconos de la interfaz de Google.
- Recorre más resultados y abre vistas previas cuando no encuentra suficientes originales.
- Añade al log los motivos concretos de rechazo durante la validación.
