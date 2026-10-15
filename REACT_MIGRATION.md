# Migración de Clip Studio a React

La interfaz se migró por módulos. La composición de Remotion usa React y sigue siendo la fuente visual de la vista previa y el MP4.

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
- `media-board-model.mjs` calcula bloques sin asset, páginas y filas del storyboard sin consultar el DOM. Usa índices de assets y capítulos por ID para preparar cada página de 15 escenas y mantiene el filtro de bloques faltantes al reabrir un proyecto.
- El formulario de fuentes de YouTube y su progreso son componentes React. Su borrador se conserva mientras se edita el mismo proyecto y se reinicia al abrir otro; el controlador mantiene la descarga y la espera de la tarea del servidor.
- La secuencia automática, sus requisitos de claves, el progreso y el acceso a bloques sin medio ya se muestran y editan con React. El controlador conserva la ejecución de la tarea y sincroniza la escena activa conforme se completa.
- El selector de material del editor usa ahora React: pestañas, paginación de 12 medios, selección y confirmación. Solo monta las tarjetas de la página visible. Las operaciones restantes de Medios siguen coordinadas por el controlador.
- La validación de capítulos y search terms, la agrupación de bloques en escenas y la asignación inicial por nombre o capítulo están en `storyboard-model.mjs`. `project-model.mjs` inicializa los ajustes editoriales y recupera search terms guardados en el campo antiguo. El controlador conserva las llamadas de guardado y la navegación de pestañas.

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
- El inspector completo se monta ahora en una sola raíz React: título, tiempo y panel seleccionado cambian juntos mediante Redux. Se eliminaron los diez contenedores HTML y las órdenes DOM que los mostraban u ocultaban. Sus controles siguen usando los mismos callbacks de edición.
- El modelo del inspector salió de `public/studio.js` a `editor-inspector-model.mjs`: calcula propiedades, títulos y tiempos de cada selección sin depender del DOM. La creación de textos, aplicación de plantillas y validación de cambios de texto y subtítulos se calculan en `editor-text-model.mjs`; el controlador conserva el historial, guardado y actualización de la vista. Los textos nuevos reciben un ID único distinto del ID de su plantilla.
- La selección simple y múltiple del timeline, junto con la toma enfocada, reside en Redux. `editor-selection-model.mjs` calcula la selección y la reconcilia tras deshacer o rehacer; el controlador ya no conserva una segunda copia de esos datos.
- Las reglas de edición de escenas, efectos, transiciones, audio, subtítulos, ajustes globales y recortes del timeline se validan en `editor-edit-model.mjs`. El controlador registra el estado previo para deshacer y luego aplica el cambio; el arrastre registra el estado previo una sola vez al comenzar.
- La sesión de vista previa (`editor-preview-session.mjs`) mantiene el tiempo, la reproducción y la composición Remotion montada. Al cambiar de proyecto cancela una reproducción que estuviera esperando al Player; el controlador solo conecta el visor, la barra de transporte y el scroll del timeline.
- El estado de selección y los controles visibles viven en React y Redux. El controlador conserva la coordinación de guardado, API y operaciones de medios; el modelo de pistas aún se calcula completo antes de filtrar el render de React.

## Fase 4: exportación y limpieza

- La pantalla de Exportación usa componentes React para validación, resolución de salida, progreso, enlaces de descarga, historial y paquete CapCut. La validación está separada en `export-view.mjs`; las tareas de render y CapCut conservan las llamadas de API existentes.
- El panel lateral de Renombrar usa React para mostrar el conteo y habilitar la acción. La selección de carpeta y el progreso de archivos siguen usando la API del navegador y el diálogo de progreso existente.
- Gemini, Claves y Prompts de la barra lateral usan componentes React. Las claves viven solo en memoria de la sesión, compartidas con las búsquedas manuales y automáticas mediante `credential-session.mjs`; el JSON de beats, el campo elegido y el resultado formateado son estado local del componente.
- La navegación, el contenedor del editor, la barra lateral, los avisos y el progreso global se montan ahora desde `ui/studio-shell.jsx`. `studio.html` solo conserva la raíz de React. La carga de archivos y carpetas de Medios usa `FileDrop`, y los divisores ajustables del editor reciben sus eventos desde el componente React. El controlador no registra manejadores generales para pestañas, barra lateral, zonas de carga ni divisores.
- `public/studio.js` sigue siendo el coordinador de API, guardado, búsquedas, vista previa y exportación. Retirarlo por completo exige migrar esas operaciones de dominio; no es requisito para que la interfaz funcione en React. Las mediciones de tamaño del visor, el diálogo nativo de selección de medios y algunos scrolls siguen usando APIs DOM del navegador.
- Comparar vista previa y MP4 en cortes/transiciones, textos, subtítulos, imagen y video.
- Medir exportaciones de 5 y 30 minutos en el VPS antes de ajustar concurrencia de Remotion.

El render solicita cuatro procesos en paralelo por defecto (limitados por los procesadores disponibles). `CLIP_STUDIO_RENDER_CONCURRENCY=2` permite volver a dos para comparar tiempo y memoria con el mismo proyecto. Este ajuste puede acelerar el render cuando hay CPU disponible, pero no cambia la fluidez de la interfaz. El JSON de tiempos de exportación registra la concurrencia efectiva.

La interfaz React/Redux, la navegación, los divisores, la importación real de una imagen, un video y un SRT, la creación del storyboard y la asignación de medios se verificaron localmente con un proyecto temporal. El render corto llegó a Remotion, pero Chrome perdió su conexión en la sesión restringida de Codex para macOS; `npm run check:browser` reproduce esa restricción incluso sin proyecto. El progreso del empaquetado se limita ahora al 25% y el error indica cómo reintentar desde Finder o diagnosticarlo en Linux.

`npm run smoke:render` crea un proyecto temporal con imagen, video, subtítulos y transición Slide desde abajo; renderiza un MP4 y comprueba H.264, 1280×720, duración, fotogramas, decodificación y ausencia de fotogramas completamente negros. Elimina el proyecto al terminar o fallar. Para conservarlo y comparar visualmente el MP4 con la vista previa, usa `SMOKE_KEEP_PROJECT=1 npm run smoke:render`.

La migración de la interfaz y sus estados de presentación está completa. La aceptación de producción sigue pendiente de ejecutar el smoke render en el VPS y, con un proyecto nuevo real, comparar la vista previa y el MP4 en transiciones, textos, subtítulos, imágenes y video, además de medir exportaciones de 5 y 30 minutos. Esas comprobaciones dependen del navegador de render y de los medios disponibles en el servidor.
