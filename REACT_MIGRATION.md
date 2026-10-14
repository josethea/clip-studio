# Migración de Clip Studio a React

La interfaz se migrará por módulos. La composición de Remotion ya usa React y seguirá siendo la fuente visual de la vista previa y el MP4.

## Fase 1: base y transiciones (aplicada)

- Redux Toolkit y React Redux para el estado de los componentes nuevos.
- Componentes React para el selector de transiciones y el historial de exportaciones.
- Solo opciones de transición `remotion:*`; `remotion:none` representa un corte sin efecto.
- Nombres antiguos de proyectos guardados convertidos a `remotion:slide:bottom` o `remotion:none` al abrirlos y también al preparar el render. `Slide desde abajo` fue contrastado con un MP4 exportado sin fotogramas negros en los cortes.
- Eliminada la ruta antigua de render visual con FFmpeg para la vista previa de archivo.

## Fase 2: proyecto, transcript y medios

- Proyecto y Transcript migrados a componentes React. Los formularios y resultados temporales viven en React; listas y resúmenes se sincronizan con Redux Toolkit. La conversión SRT y el guardado siguen usando las funciones existentes para conservar el formato de los proyectos.
- La estructura de Medios se monta desde componentes React para Biblioteca, Storyboard, búsqueda automática y fuentes de YouTube. Biblioteca, tarjetas, resultados, capítulos, secuencia automática y bloques sin medio se dibujan en React. El selector de assets se monta solo en la tarjeta activa para evitar miles de opciones DOM en proyectos grandes.
- Las tarjetas de Biblioteca y Storyboard conservan la paginación de 15 elementos; los resultados de búsqueda muestran hasta cinco por página.
- La interacción de las tarjetas (selección, búsqueda, paginación, asignación, capítulos y bloques faltantes) sale de callbacks React. Redux Toolkit guarda el bloque activo, proveedor, tipo, término y páginas de resultados; un puente conserva temporalmente las operaciones de API del controlador anterior.
- Pendiente: extraer las llamadas de API de Medios a un servicio y retirar el puente con el controlador al migrar el editor.

## Fase 3: editor

- El inspector de cada toma ya es un componente React: material, encuadre, movimiento y carga de archivos usan callbacks. La biblioteca visual sigue usando el diálogo existente.
- Las pistas, bloques, cortes y regla de la línea de tiempo se dibujan con componentes React. Conservan los atributos que utiliza el controlador actual para selección, arrastre y ajuste de duración. La búsqueda de nombres de assets ahora usa un índice por ID en cada render de la timeline.
- Los paneles de efecto visual, transición, sonido, narración y música ya se dibujan en React y envían sus cambios mediante callbacks. Sus raíces se montan una vez y reciben las actualizaciones posteriores desde Redux.
- Los paneles de texto, subtítulos y selección múltiple también usan React. Los campos de escritura mantienen un borrador local; las plantillas aplican únicamente sus propiedades de estilo y los colores tienen selectores y presets propios de los componentes.
- El montaje global, los efectos, el encuadre, el formato de salida y la barra de reproducción del visor son componentes React conectados a Redux. El montaje de Remotion permanece fuera de la raíz de los controles para que una actualización de React no reinicie el video.
- La línea de tiempo completa usa una raíz React. El componente gestiona selección simple y múltiple, arrastre del cabezal, movimiento de textos y ajuste de los bordes de tomas, textos y subtítulos. El cabezal conserva prioridad sobre los clips y seleccionar un elemento no cambia el tiempo de reproducción.
- Deshacer, rehacer y guardar edición son controles React; la historia se sigue limitando a 80 estados y cada arrastre registra un solo estado al comenzar a moverse.
- Pendiente: medir latencia con cientos de escenas y renderizar solo el rango visible de la línea de tiempo. Después, extraer el estado editable y las llamadas de guardado del controlador restante.

## Fase 4: exportación y limpieza

- Migrar el resto de Exportación y las herramientas laterales.
- Retirar `public/studio.js` y los selectores DOM directos después de pasar las pruebas de flujo completo.
- Comparar vista previa y MP4 en cortes/transiciones, textos, subtítulos, imagen y video.
- Medir exportaciones de 5 y 30 minutos en el VPS antes de ajustar concurrencia de Remotion.

El render usa dos procesos en paralelo por defecto. `CLIP_STUDIO_RENDER_CONCURRENCY=3` permite probar tres en el VPS; conviene comparar tiempo y memoria con el mismo proyecto antes de fijarlo. Este ajuste acelera el render cuando hay CPU disponible, pero no cambia la fluidez de la interfaz.

La prueba de aceptación se hará con un proyecto nuevo, tanto localmente como en producción. La edición y exportación deben seguir funcionando antes de reemplazar el módulo siguiente.
