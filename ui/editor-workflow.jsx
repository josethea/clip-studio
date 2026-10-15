import React from 'react';
import {useSelector} from 'react-redux';

export function NarrationControls({actions}){
  const view=useSelector(state=>state.studioUi.editorNarration);
  if(!view)return null;
  const result=view.result;
  return <><p className="studio-help">Recorta pausas mayores al objetivo. El WAV, el SRT y el montaje se desplazan juntos.</p>
    <label>Pausa máxima (ms)<input type="number" min="0" max="5000" value={view.pauseMs} onChange={event=>actions.pauseMs(event.target.value)}/></label>
    <div className="studio-help">{view.gapCount?`${view.gapCount} pausas detectadas · ${view.longGaps} superan el objetivo actual.`:'No hay pausas entre bloques todavía.'}</div>
    <button className="secondary" disabled={!view.projectId} onClick={()=>actions.adjust(view.pauseMs)}>Aplicar al audio y timeline</button>
    {result&&<div className="studio-help">{result.cuts} pausas recortadas · {result.removed.toFixed(2)} s eliminados · <a href={`/api/studio/projects/${encodeURIComponent(view.projectId)}/assets/${encodeURIComponent(result.audioId)}`} download>Descargar WAV</a> · <a href={`/api/studio/projects/${encodeURIComponent(view.projectId)}/files/${encodeURIComponent(result.srt)}`} download>Descargar SRT</a></div>}
    <div className="studio-help">Duración: {view.duration} · {view.scenes} tomas · {view.subtitles} subtítulos</div>
  </>;
}

function StoryboardControls({actions,media=false}){
  const view=useSelector(state=>state.studioUi.editorStoryboard);
  if(!view)return null;
  return <><label>{media?'Distribución de assets':'Modo de storyboard'}<select value={view.sceneMode} onChange={event=>actions.sceneMode(event.target.value)}><option value="srt">{media?'Uno por bloque SRT · search terms 1 a 1':'Una escena por bloque SRT'}</option><option value="chapter">Agrupar bloques por capítulo</option></select></label>
    {!media&&<label>Asignación inicial<select value={view.assignMode} onChange={event=>actions.assignMode(event.target.value)}><option value="basic">Por número y orden</option><option value="smart">Por capítulo y término</option></select></label>}
    <div className={media?'studio-actions':undefined}><button className={media?'primary':'secondary'} disabled={!view.projectId} onClick={actions.build}>{media?'Crear storyboard':'Reconstruir storyboard'}</button><button className="secondary" disabled={!view.projectId} onClick={actions.autoAssign}>{media?'Asignar medios por nombre/orden':'Asignar assets por orden'}</button></div>
  </>;
}

export function EditorStoryboardControls({actions}){return <StoryboardControls actions={actions}/>;}
export function MediaStoryboardControls({actions}){return <StoryboardControls actions={actions} media/>;}

export function TimelineToolbar({actions}){
  const view=useSelector(state=>state.studioUi.editorTimeline);
  return <><strong>LÍNEA DE TIEMPO</strong><label>Zoom <input type="range" min="2" max="120" value={view?.scale||8} onChange={event=>actions.zoom(Number(event.target.value))}/></label><span>{(view?.scale||8).toFixed(1)} px/s</span><span>Arrastra el cabezal para buscar. Mueve los textos o arrastra sus bordes para ajustar la duración.</span></>;
}

export function MonitorActions({actions}){
  return <button className="secondary" onClick={actions.refresh}>Actualizar composición</button>;
}

export function EmptyInspector({actions}){
  return <><p className="studio-help">Selecciona una toma o transición para configurar sus propiedades. El cabezal conserva su posición al seleccionar.</p><button className="secondary" onClick={actions.addText}>＋ Añadir texto en el cabezal</button><label className="inspector-upload drop-zone">↥ Añadir música (subir audio)<input type="file" accept="audio/*" onChange={event=>{const files=[...event.target.files];event.target.value='';actions.addMusic(files);}}/></label></>;
}
