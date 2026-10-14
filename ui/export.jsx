import React from 'react';
import {useSelector} from 'react-redux';

const formatTime=value=>{const n=Number(value)||0;return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}.${String(Math.round(n%1*1000)).padStart(3,'0')}`;};
const formatElapsed=value=>{const n=Math.max(0,Math.round(Number(value)/1000)||0);return `${String(Math.floor(n/3600)).padStart(2,'0')}:${String(Math.floor(n/60)%60).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;};
const fileUrl=(projectId,name)=>`/api/studio/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(name)}`;

function ExportHistory({view}){
  if(!view.exports.length)return <div className="studio-item">Aún no hay exportaciones.</div>;
  return view.exports.map(item=><div className="studio-item" key={item.name}>
    <div><strong>{item.name}</strong><small>{formatTime(item.duration)} · {item.width}×{item.height}{Number.isFinite(item.renderDurationMs)?` · Tiempo de exportación ${formatElapsed(item.renderDurationMs)}`:''}</small></div>
    <div className="studio-actions"><a href={fileUrl(view.projectId,item.name)} target="_blank" rel="noopener noreferrer">Ver</a><a href={fileUrl(view.projectId,item.name)} download={`${view.title}.mp4`}>Descargar MP4</a></div>
  </div>);
}

export function ExportPage({actions}){
  const view=useSelector(state=>state.studioUi.exportView);
  const progress=useSelector(state=>state.studioUi.exportProgress);
  const ready=!progress.running&&!progress.mp4&&view.ready;
  return <>
    <div className="section-heading"><span className="eyebrow">MÓDULO 04</span><h1>Exportación</h1><p>El MP4 se genera desde la misma composición Remotion que ves en el editor, con sus pistas de video, efectos, textos, subtítulos y audio.</p></div>
    <article className="panel"><h2>VALIDACIÓN DEL PROYECTO</h2>
      <div className="studio-list"><div className={`studio-item ${view.problems.length?'warn':'ok'}`}><strong>{view.problems.length?view.problems.join(' · '):'Listo para exportar MP4'}</strong><small>{view.summary}</small></div></div>
      <p className="studio-help">{view.resolutionNote}</p>
      <div className="studio-actions"><button className="primary" onClick={actions.startMp4} disabled={!view.projectId||view.problems.length>0||progress.running}>Exportar MP4</button><button className="secondary" onClick={actions.downloadJson} disabled={!view.projectId}>Descargar proyecto JSON</button><button className="secondary" onClick={actions.downloadSrt} disabled={!view.projectId}>Descargar SRT</button></div>
      <div className="studio-help" role="status">{progress.mp4||null}{ready&&<>Video listo · Tiempo total de exportación: <strong>{formatElapsed(view.ready.renderDurationMs)}</strong> · <a href={fileUrl(view.projectId,view.ready.name)} download={`${view.title}.mp4`}>Descargar MP4</a></>}</div>
    </article>
    <article className="panel"><h2>VIDEOS EXPORTADOS</h2><div className="studio-list"><ExportHistory view={view}/></div></article>
    <article className="panel"><h2>PROYECTO CAPCUT EDITABLE</h2><p className="studio-help">Exporta escenas, medios, seis transiciones, narración, música y SFX en una timeline CapCut. El SRT va incluido para importarlo como subtítulos nativos. El encuadre y los efectos visuales finales se conservan en el MP4 de Clip Studio.</p>
      <button className="secondary" onClick={actions.prepareCapcut} disabled={!view.projectId||progress.capcutRunning}>Preparar proyecto CapCut</button>
      <div className="studio-help" role="status">{progress.capcut||null}{progress.capcutResult&&<>Proyecto preparado: <a href={fileUrl(view.projectId,progress.capcutResult.name)} download>Descargar ZIP CapCut</a> · {progress.capcutResult.scenes} escenas.</>}</div>
    </article>
  </>;
}
