import React, {memo, useEffect, useState} from 'react';
import {useSelector} from 'react-redux';

const mediaUrl=(projectId,assetId)=>`/api/studio/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}`;
const formatTime=value=>{const n=Number(value)||0;return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}.${String(Math.round(n%1*1000)).padStart(3,'0')}`;};

export function AssetLibrary({actions}){
  const view=useSelector(state=>state.studioUi.mediaAssets);
  if(!view?.items.length)return <div className="studio-item">Aún no hay medios. Puedes arrastrarlos arriba.</div>;
  return <>{view.items.map(asset=>{
    const src=mediaUrl(view.projectId,asset.id);
    return <article className="asset-card" key={asset.id}><div className="asset-thumb">{asset.type==='image'?<img src={src} loading="lazy" alt=""/>:asset.type==='video'?<video src={src} muted preload="none"/>:<span className="asset-audio-icon">♫</span>}</div>
      <div className="asset-info"><strong>{asset.name}</strong><small>{asset.chapter||asset.type} · {asset.width?`${asset.width}×${asset.height}`:`${(asset.duration||0).toFixed(1)} s`}</small>
        <div className="studio-actions"><a href={src} target="_blank" rel="noopener noreferrer">Abrir</a>{asset.type!=='audio'&&<button className="secondary" onClick={()=>actions.assignAsset(asset.id)}>Asignar a escena</button>}</div>
      </div></article>;
  })}</>;
}

export function AssetTarget({actions}){
  const view=useSelector(state=>state.studioUi.mediaTarget);
  return <label>Escena de destino<select value={view?.selected==null?'':String(view.selected)} onChange={event=>actions.targetScene(event.target.value===''?null:Number(event.target.value))}>
    <option value="">Solo guardar en biblioteca</option>
    {(view?.scenes||[]).map(scene=><option key={scene.index} value={scene.index}>Asset {scene.index+1} · bloques {scene.cueStart+1}–{scene.cueEnd+1}</option>)}
  </select></label>;
}

export function ChapterGrouping({actions}){
  const view=useSelector(state=>state.studioUi.mediaChapters);
  if(!view?.present)return null;
  if(!view.items.length)return <p className="studio-help">{view.error||'Carga guion y SRT para configurar los capítulos.'}</p>;
  return <><p className="studio-help">{view.grouped?'Configura cuántos bloques consecutivos cubre cada asset.':'Los capítulos están ubicados. Activa «Agrupar bloques por capítulo» arriba para usar estos valores.'}</p>
    {view.items.map(ch=><div className="chapter-group-row" key={ch.id}><span><strong>{ch.name}</strong><small> · bloques {ch.cueStart+1}–{ch.cueEnd+1} ({ch.cueCount})</small></span><label>Bloques por asset<input key={`${ch.id}:${ch.size}`} type="number" min="1" max={ch.cueCount} step="1" defaultValue={ch.size} disabled={!view.grouped} onChange={event=>actions.chapterSize(ch.id,event.target.value)}/></label></div>)}
  </>;
}

export function AutofillReviewButton({actions}){
  const view=useSelector(state=>state.studioUi.mediaAutofill);
  if(!view?.sceneCount||!view.remaining)return null;
  return <button className="secondary" type="button" onClick={()=>actions.toggleMissing()}>{view.missingOnly?'Mostrar storyboard completo':`Ver bloques sin medio (${view.remaining})`}</button>;
}

export function AutofillControls({actions}){
  const view=useSelector(state=>state.studioUi.mediaAutofill);
  const progress=useSelector(state=>state.studioUi.autofillProgress);
  const [draft,setDraft]=useState(null);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const entries=view?.entries||[];
  const names={google:'Google Images',storyblocks:'Storyblocks',pexels:'Pexels'};
  const begin=(index)=>{const entry=entries[index];setDraft(index===-1?{index,type:'photos',provider:'google'}:{index,type:entry.type,provider:entry.provider});setError('');};
  const save=async()=>{
    if(!draft||saving)return;
    setSaving(true);setError('');
    try{await actions.saveAutofill(draft);setDraft(null);}
    catch(cause){setError(cause.message);}
    finally{setSaving(false);}
  };
  return <div className="autofill-inline"><h3>COMPLETAR MEDIOS FALTANTES</h3><p className="studio-help">Configura una secuencia de imágenes y videos. Se repite hasta cubrir los bloques pendientes. Google Images usa la primera imagen apta de un máximo de 10 candidatas.</p>
    <div className="autofill-head"><label>Desde escena #<input type="number" min="1" max={Math.max(1,(view?.sceneCount||0)+1)} value={view?.start??1} onChange={event=>actions.autofillStart(event.target.value)} disabled={view?.running}/></label><button className="secondary" type="button" disabled={!view?.projectId||view?.running||entries.length>=40} onClick={()=>begin(-1)}>+ Agregar fuente</button></div>
    <div className="autofill-sequence">{entries.map((entry,index)=><div className="autofill-entry" key={index}><span className="autofill-entry-number">{index+1}</span><strong>{entry.type==='videos'?'Video':'Imagen'} · {names[entry.provider]||entry.provider}</strong><button type="button" className="secondary" disabled={view?.running||saving} onClick={()=>begin(index)}>Editar</button><button type="button" className="secondary danger" disabled={view?.running||saving} onClick={()=>{setDraft(null);actions.removeAutofill(index);}}>Eliminar</button></div>)}</div>
    {draft&&<div className="autofill-editor"><div className="studio-grid two"><label>Tipo<select value={draft.type} onChange={event=>setDraft({...draft,type:event.target.value,provider:event.target.value==='videos'&&draft.provider==='google'?'storyblocks':draft.provider})}><option value="photos">Imagen</option><option value="videos">Video</option></select></label><label>Fuente<select value={draft.provider} onChange={event=>setDraft({...draft,provider:event.target.value})}><option value="google" disabled={draft.type==='videos'}>Google Images</option><option value="storyblocks">Storyblocks</option><option value="pexels">Pexels</option></select></label></div><div className="studio-actions"><button className="primary" type="button" disabled={saving||view?.running} onClick={save}>Guardar fuente</button><button className="secondary" type="button" disabled={saving} onClick={()=>{setDraft(null);setError('');}}>Cancelar</button></div>{error&&<p className="studio-help" role="alert">{error}</p>}</div>}
    {!!entries.length&&<button className="secondary" id="autofill-run" type="button" disabled={!view?.canRun} onClick={()=>actions.runAutofill()}>Buscar medios faltantes</button>}
    <p className="studio-help">{view?.requirements||''}</p><p className="studio-help" role="status">{progress?.status||''}</p>{progress?.visible&&<div className="autofill-progress"><div style={{width:`${Math.max(0,Math.min(100,progress.percent||0))}%`}}/></div>}
  </div>;
}

export function MissingMediaSummary({actions}){
  const view=useSelector(state=>state.studioUi.mediaMissing);
  if(!view?.items.length)return null;
  return <><strong>{view.items.length} {view.items.length===1?'escena sin medio':'escenas sin medio'}</strong><div className="missing-scene-links">{view.items.map(item=><button key={item.index} type="button" className="secondary" title={item.text} onClick={()=>actions.missing(item.index)}>{item.index+1}</button>)}</div></>;
}

function StockResults({actions}){
  const view=useSelector(state=>state.studioUi.mediaStock);
  const [pending,setPending]=useState(null);
  if(!view?.searched)return null;
  return <><div className="stock-grid">{view.provider==='google'&&<p className="studio-help" role="status">{view.detail||'Buscando imágenes…'}</p>}
    {view.items.map(item=><article className="stock-card" key={`${view.provider}:${item.index}`}>{item.preview&&<img src={item.preview} alt={item.name||''} loading="lazy"/>}<div className="stock-card-body"><strong>{item.name}</strong><small>{item.info||view.provider}</small>{(item.source||item.previewVideo)&&<a href={item.source||item.previewVideo} target="_blank" rel="noreferrer">Ver fuente</a>}<button className="secondary" disabled={item.assigned||pending!==null} onClick={async()=>{setPending(item.index);try{await actions.addStock(view.provider,item.index);}finally{setPending(null);}}}>{pending===item.index?'Descargando…':item.assigned?'✓ Asignado':item.existing?'Asignar asset existente':`Agregar y asignar a escena ${view.target+1}`}</button></div></article>)}
    {!view.items.length&&!(view.provider==='google'&&['queued','leased','screening'].includes(view.status))&&<p className="studio-help">No se encontraron resultados aptos. Prueba otro término.</p>}
  </div><div className="pagination">{view.provider==='google'&&<span>{view.total} aptas · {view.rejected} descartadas</span>}<button disabled={!view.previous} onClick={()=>actions.stockPage(-1)}>‹ Anterior</button><span>Página {view.page+1} · hasta 5 resultados</span><button disabled={!view.next} onClick={()=>actions.stockPage(1)}>Siguiente ›</button></div></>;
}

const MediaScene=memo(function MediaScene({row,view,actions}){
  const asset=row.asset,active=row.index===view.active,src=asset?mediaUrl(view.projectId,asset.id):'';
  return <article className={`media-scene ${asset?'media-scene-complete':''} ${active?'media-scene-active':''}`} data-media-card={row.index}>
    <div className="media-scene-index">{String(row.index+1).padStart(3,'0')}<small>{formatTime(row.start)} – {formatTime(row.end)}</small><small>Bloques {row.cueStart+1}–{row.cueEnd+1}</small></div>
    <div className="media-scene-preview">{asset?.type==='image'?<img src={src} loading="lazy" alt=""/>:asset?.type==='video'?<video src={src} muted preload="none" controls/>:'Sin medio'}</div>
    <div className="media-scene-content"><strong>{row.text}</strong><p className="studio-help">{row.chapter?`${row.chapter} · `:''}{row.searchTerm?`Búsqueda: ${row.searchTerm}`:'Sin término de búsqueda guardado'}</p>
      {active?<label>Asset asignado<select key={`${row.index}:${row.assetId||''}`} defaultValue={row.assetId||''} onChange={event=>actions.selectAsset(row.index,event.target.value)}><option value="">Sin medio</option>{view.assets.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>:<div className="media-scene-assignment"><small>Asset asignado: {asset?.name||'Sin medio'}</small><button className="secondary" onClick={()=>actions.activate(row.index,view.provider,false)}>Cambiar asset</button></div>}
      <div className="studio-actions"><button className={`secondary ${active&&view.provider==='storyblocks'?'selected-source':''}`} onClick={()=>actions.activate(row.index,'storyblocks',true)}>Storyblocks</button><button className={`secondary ${active&&view.provider==='pexels'?'selected-source':''}`} onClick={()=>actions.activate(row.index,'pexels',true)}>Pexels</button><button className={`secondary ${active&&view.provider==='google'?'selected-source':''}`} onClick={()=>actions.activate(row.index,'google',true)}>Google Images</button><button className="secondary" onClick={()=>actions.jumpEditor(row.index)}>Editar en timeline</button></div>
      {active&&<StockSearch key={`${row.index}:${view.provider}`} view={view} actions={actions}/>}
    </div>
  </article>;
});

function StockSearch({view,actions}){
  const [query,setQuery]=useState(view.query);
  useEffect(()=>setQuery(view.query),[view.query]);
  return <div className="scene-stock-search"><div className="studio-grid three">
    <label>Fuente<select defaultValue={view.provider} onChange={event=>actions.provider(event.target.value)}><option value="storyblocks">Storyblocks</option><option value="pexels">Pexels</option><option value="google">Google Images</option></select></label>
    <label>Tipo<select defaultValue={view.type} disabled={view.provider==='google'} onChange={event=>actions.type(event.target.value)}><option value="videos">Videos</option><option value="photos">Fotos</option></select></label>
    <label>Término<input value={query} onChange={event=>{setQuery(event.target.value);actions.query(event.target.value);}}/></label>
  </div><button className="secondary" onClick={()=>actions.search(query)}>Buscar en {{storyblocks:'Storyblocks',pexels:'Pexels',google:'Google Images'}[view.provider]}</button>
    {view.provider==='google'&&<p className="studio-help">OCR local: admite hasta 10% de texto y descarta marcas de agua o logos legibles. Revisa visualmente los logos sin texto. La imagen asignada se guarda en espejo. Google Images no otorga licencias de uso.</p>}
    <StockResults actions={actions}/>
  </div>;
}

export function MediaBoard({actions}){
  const view=useSelector(state=>state.studioUi.mediaBoard);
  if(!view?.hasScenes)return <div className="studio-item">Carga un SRT en Entradas y crea el storyboard.</div>;
  return <>{view.rows.map(row=><MediaScene key={row.index} row={row} view={view} actions={actions}/>)}</>;
}

export function MediaPagination({kind,actions}){
  const view=useSelector(state=>state.studioUi.mediaPagination[kind]);
  if(!view||view.pages<=1)return null;
  const indexes=[0,view.current-2,view.current-1,view.current,view.current+1,view.current+2,view.pages-1].filter((page,index,all)=>page>=0&&page<view.pages&&all.indexOf(page)===index).sort((a,b)=>a-b);
  let previous=-1;
  return <><button disabled={view.current===0} onClick={()=>actions.page(kind,view.current-1)}>‹</button>
    {indexes.map(page=>{const gap=page-previous>1;previous=page;return <React.Fragment key={page}>{gap&&<span>…</span>}<button className={page===view.current?'active':''} onClick={()=>actions.page(kind,page)}>{page+1}</button></React.Fragment>;})}
    <button disabled={view.current===view.pages-1} onClick={()=>actions.page(kind,view.current+1)}>›</button><span>{view.current*15+1}–{Math.min(view.total,(view.current+1)*15)} de {view.total}</span>
  </>;
}

export function YoutubeSources({actions}){
  const view=useSelector(state=>state.studioUi.youtubeSources);
  const [json,setJson]=useState(view?.json||'');
  const [duration,setDuration]=useState('5');
  const [delay,setDelay]=useState('12');
  const [start,setStart]=useState('1');
  const [cookieBrowser,setCookieBrowser]=useState('none');
  const [running,setRunning]=useState(false);
  const [status,setStatus]=useState('');
  return <article className="panel"><h2>VIDEOS DE YOUTUBE POR CAPÍTULO</h2><p className="studio-help">Este JSON es independiente de los capítulos del guion. Usa <code>name</code> y <code>urls</code> para descargar, cortar, aplicar espejo y eliminar el audio. Puedes reanudar desde un número de video.</p>
    <label>Capítulos y enlaces de YouTube<textarea rows="7" value={json} onChange={event=>setJson(event.target.value)} placeholder='[{"name":"Capítulo 1","urls":["https://www.youtube.com/watch?v=..."]}]'/></label>
    <div className="studio-grid four"><label>Clip (s)<input type="number" value={duration} onChange={event=>setDuration(event.target.value)} min="0.5" step="0.1"/></label><label>Pausa entre descargas (s)<input type="number" value={delay} onChange={event=>setDelay(event.target.value)} min="0"/></label><label>Reanudar desde video #<input type="number" value={start} onChange={event=>setStart(event.target.value)} min="1"/></label><label>Cookies del navegador<select value={cookieBrowser} onChange={event=>setCookieBrowser(event.target.value)}><option value="none">Sin cookies</option><option value="chrome">Chrome</option><option value="safari">Safari</option><option value="firefox">Firefox</option></select></label></div>
    <button className="primary" disabled={!view?.projectId||running} onClick={async()=>{setRunning(true);setStatus('Preparando descarga…');try{await actions.runYoutube({json,clipDuration:Number(duration),delay:Number(delay),startIndex:Number(start),cookieBrowser},setStatus);}finally{setRunning(false);}}}>Descargar y segmentar</button><div className="studio-help" role="status">{status}</div>
  </article>;
}
