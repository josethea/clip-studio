# Migración de Clip Studio a React

La interfaz se migrará por módulos. La composición de Remotion ya usa React y seguirá siendo la fuente visual de la vista previa y el MP4.

## Fase 1: base y transiciones (aplicada)

- Redux Toolkit y React Redux para el estado de los componentes nuevos.
- Componentes React para el selector de transiciones y el historial de exportaciones.
- Solo opciones de transición `remotion:*`; `remotion:none` representa un corte sin efecto.
- Nombres antiguos de proyectos guardados convertidos a `remotion:slide:bottom` o `remotion:none` al abrirlos y también al preparar el render. `Slide desde abajo` fue contrastado con un MP4 exportado sin fotogramas negros en los cortes.
- Eliminada la ruta antigua de render visual con FFmpeg para la vista previa de archivo.

## Fase 2: proyecto, transcript y medios

- Componentes por pestaña y subcomponentes para carga, validación, storyboard y buscadores.
- Una sola fuente de verdad para proyecto, selección, búsqueda y progreso; separar estado persistido del proyecto de estado temporal de la interfaz.
- Cargar medios y páginas a demanda para evitar insertar cientos de tarjetas y miniaturas a la vez.

## Fase 3: editor

- Componentes para timeline, pistas, clips, inspector, controles globales y visor.
- Migrar selección, undo/redo y drag/resize sin cambiar el formato de proyecto.
- Renderizar solo el rango visible de la timeline y medir latencia con proyectos de cientos de escenas.

## Fase 4: exportación y limpieza

- Migrar el resto de Exportación y las herramientas laterales.
- Retirar `public/studio.js` y los selectores DOM directos después de pasar las pruebas de flujo completo.
- Comparar vista previa y MP4 en cortes/transiciones, textos, subtítulos, imagen y video.
- Medir exportaciones de 5 y 30 minutos en el VPS antes de ajustar concurrencia de Remotion.

El render usa dos procesos en paralelo por defecto. `CLIP_STUDIO_RENDER_CONCURRENCY=3` permite probar tres en el VPS; conviene comparar tiempo y memoria con el mismo proyecto antes de fijarlo. Este ajuste acelera el render cuando hay CPU disponible, pero no cambia la fluidez de la interfaz.

Cada fase debe conservar la apertura de proyectos antiguos, la edición y la exportación antes de reemplazar el módulo siguiente.
