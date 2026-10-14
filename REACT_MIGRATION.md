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
- Las peticiones de búsqueda, importación y autocompletado de Pexels, Storyblocks y Google Images pasan por `media-service.mjs`. El servicio lee las claves de la sesión justo antes de cada petición y el controlador sigue coordinando el estado de la pantalla.
- Retirado el puente `Object.defineProperty` entre el controlador y Redux: el controlador lee la sesión de Medios con `getMediaSession()` y la cambia con `patchMediaSession()`. Las listas de resultados, los lotes de Pexels y Storyblocks y el seguimiento de trabajos de Google viven en `media-search.mjs`, que también arma la vista de las tarjetas de resultados. Al cambiar de escena o de página se descartan las respuestas de búsquedas anteriores, y mientras se descarga el siguiente lote se ignoran los clics de paginación.
- La escena de destino de Biblioteca se elige con un componente React y queda en la sesión de Medios de Redux. Al iniciar otra búsqueda o cambiar término, fuente o tipo, se invalidan los resultados anteriores aunque la respuesta llegue tarde.
- El formulario de fuentes de YouTube y su progreso son componentes React. Su borrador se conserva mientras se edita el mismo proyecto y se reinicia al abrir otro; el controlador mantiene la descarga y la espera de la tarea del servidor.
- La secuencia automática, sus requisitos de claves, el progreso y el acceso a bloques sin medio ya se muestran y editan con React. El controlador conserva la ejecución de la tarea y sincroniza la escena activa conforme se completa.
- El selector de material del editor usa ahora React: pestañas, paginación de 12 medios, selección y confirmación. Solo monta las tarjetas de la página visible. Las operaciones restantes de Medios siguen coordinadas por el controlador.

## Fase 3: editor

- El inspector de cada toma ya es un componente React: material, encuadre, movimiento y carga de archivos usan callbacks. La biblioteca visual sigue usando el diálogo existente.
- Las pistas, bloques, cortes y regla de la línea de tiempo se dibujan con componentes React. Conservan los atributos que utiliza el controlador actual para selección, arrastre y ajuste de duración. La búsqueda de nombres de assets ahora usa un índice por ID en cada render de la timeline.
- Los paneles de efecto visual, transición, sonido, narración y música ya se dibujan en React y envían sus cambios mediante callbacks. Sus raíces se montan una vez y reciben las actualizaciones posteriores desde Redux.
- Los paneles de texto, subtítulos y selección múltiple también usan React. Los campos de escritura mantienen un borrador local; las plantillas aplican únicamente sus propiedades de estilo y los colores tienen selectores y presets propios de los componentes.
- El montaje global, los efectos, el encuadre, el formato de salida y la barra de reproducción del visor son componentes React conectados a Redux. El montaje de Remotion permanece fuera de la raíz de los controles para que una actualización de React no reinicie el video.
- La línea de tiempo completa usa una raíz React. El componente gestiona selección simple y múltiple, arrastre del cabezal, movimiento de textos y ajuste de los bordes de tomas, textos y subtítulos. El cabezal conserva prioridad sobre los clips y seleccionar un elemento no cambia el tiempo de reproducción.
- Deshacer, rehacer y guardar edición son controles React; la historia se sigue limitando a 80 estados y cada arrastre registra un solo estado al comenzar a moverse.
- La línea de tiempo conserva el ancho y la posición de todos los elementos, pero React monta solo los bloques y marcas cercanos al área visible. El rango se actualiza al desplazar o redimensionar el panel; el margen adicional mantiene accesibles los bordes próximos para arrastrar y ajustar.
- `node benchmark-timeline.mjs` compara el costo de generar el marcado completo con el de la ventana visible para 666 escenas y siete pistas. Es una medición sintética local de React, no una medida de fluidez del navegador ni del tiempo de exportación.
- El historial de edición y los guardados del proyecto ahora pasan por `editor-session.mjs`. Los guardados manuales esperan a los automáticos en curso; una edición hecha durante un guardado conserva su revisión pendiente y se envía después. Al cambiar de proyecto se guarda la edición pendiente, se reinicia el historial y las respuestas anteriores no cambian el indicador del proyecto nuevo.
- Las plantillas de texto y los controles de la toma para capa gráfica y efecto individual también usan React. El efecto individual ahora registra una edición en el historial y activa el guardado automático, igual que los demás ajustes de la toma.
- Narración y duración, configuración del storyboard en Editor y Medios, y zoom de la línea de tiempo usan controles React conectados a Redux. El controlador conserva las operaciones de recorte de audio, creación del storyboard y asignación para mantener el formato de proyecto actual.
- El modelo de pistas, marcas, selección y transiciones salió del controlador a `timeline-model.mjs`, con pruebas para cortes y transiciones centradas. Los botones del visor y el mensaje de inspector vacío también son componentes React.
- Pendiente: trasladar el resto del estado editable y las acciones de guardado del controlador a módulos de dominio. El modelo de pistas aún se calcula completo antes de filtrar el render de React.

## Fase 4: exportación y limpieza

- La pantalla de Exportación usa componentes React para validación, resolución de salida, progreso, enlaces de descarga, historial y paquete CapCut. La validación está separada en `export-view.mjs`; las tareas de render y CapCut conservan las llamadas de API existentes.
- El panel lateral de Renombrar usa React para mostrar el conteo y habilitar la acción. La selección de carpeta y el progreso de archivos siguen usando la API del navegador y el diálogo de progreso existente.
- Gemini, Claves y Prompts de la barra lateral usan componentes React. Las claves viven solo en memoria de la sesión, compartidas con las búsquedas manuales y automáticas mediante `credential-session.mjs`; el JSON de beats, el campo elegido y el resultado formateado son estado local del componente.
- Pendiente: migrar otras operaciones del editor y Medios que todavía dependen del controlador.
- Retirar `public/studio.js` y los selectores DOM directos después de pasar las pruebas de flujo completo.
- Comparar vista previa y MP4 en cortes/transiciones, textos, subtítulos, imagen y video.
- Medir exportaciones de 5 y 30 minutos en el VPS antes de ajustar concurrencia de Remotion.

El render usa dos procesos en paralelo por defecto. `CLIP_STUDIO_RENDER_CONCURRENCY=3` permite probar tres en el VPS; conviene comparar tiempo y memoria con el mismo proyecto antes de fijarlo. Este ajuste acelera el render cuando hay CPU disponible, pero no cambia la fluidez de la interfaz.

La prueba de aceptación se hará con un proyecto nuevo, tanto localmente como en producción. La edición y exportación deben seguir funcionando antes de reemplazar el módulo siguiente.
