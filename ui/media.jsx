import React, {memo, useEffect, useState} from 'react';
import {useSelector} from 'react-redux';

const mediaUrl=(projectId,assetId)=>`/api/studio/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}`;
const formatTime=value=>{const n=Number(value)||0;return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}.${String(Math.round(n%1*1000)).padStart(3,'0')}`;};

export function AssetLibrary(){
  const view=useSelector(state=>state.studioUi.mediaAssets);
  if(!view?.items.length)return <div className="studio-item">Aún no hay medios. Puedes arrastrarlos arriba.</div>;
  return <>{view.items.map(asset=>{
    const src=mediaUrl(view.projectId,asset.id);
    return <article className="asset-card" key={asset.id}><div className="asset-thumb">{asset.type==='image'?<img src={src} loading="lazy" alt=""/>:asset.type==='video'?<video src={src} muted preload="none"/>:<span className="asset-audio-icon">♫</span>}</div>
      <div className="asset-info"><strong>{asset.name}</strong><small>{asset.chapter||asset.type} · {asset.width?`${asset.width}×${asset.height}`:`${(asset.duration||0).toFixed(1)} s`}</small>
        <div className="studio-actions"><a href={src} target="_blank" rel="noopener noreferrer">Abrir</a>{asset.type!=='audio'&&<button className="secondary" data-assign-asset={asset.id}>Asignar a escena</button>}</div>
      </div></article>;
  })}</>;
}

export function ChapterGrouping(){
  const view=useSelector(state=>state.studioUi.mediaChapters);
  if(!view?.present)return null;
  if(!view.items.length)return <p className="studio-help">{view.error||'Carga guion y SRT para configurar los capítulos.'}</p>;
  return <><p className="studio-help">{view.grouped?'Configura cuántos bloques consecutivos cubre cada asset.':'Los capítulos están ubicados. Activa «Agrupar bloques por capítulo» arriba para usar estos valores.'}</p>
    {view.items.map(ch=><div className="chapter-group-row" key={ch.id}><span><strong>{ch.name}</strong><small> · bloques {ch.cueStart+1}–{ch.cueEnd+1} ({ch.cueCount})</small></span><label>Bloques por asset<input key={`${ch.id}:${ch.size}`} type="number" min="1" max={ch.cueCount} step="1" defaultValue={ch.size} data-chapter-size={ch.id} disabled={!view.grouped}/></label></div>)}
  </>;
}

export function AutofillEntries(){
  const entries=useSelector(state=>state.studioUi.autofillEntries);
  return <>{entries.map((entry,index)=><div className="autofill-entry" key={index}><span className="autofill-entry-number">{index+1}</span><strong>{entry.type==='videos'?'Video':'Imagen'} · {{google:'Google Images',storyblocks:'Storyblocks',pexels:'Pexels'}[entry.provider]||entry.provider}</strong><button type="button" className="secondary" data-autofill-edit={index}>Editar</button><button type="button" className="secondary danger" data-autofill-remove={index}>Eliminar</button></div>)}</>;
}

export function MissingMediaSummary(){
  const view=useSelector(state=>state.studioUi.mediaMissing);
  if(!view?.items.length)return null;
  return <><strong>{view.items.length} {view.items.length===1?'escena sin medio':'escenas sin medio'}</strong><div className="missing-scene-links">{view.items.map(item=><button key={item.index} type="button" className="secondary" data-missing-scene={item.index} title={item.text}>{item.index+1}</button>)}</div></>;
}

function StockResults(){
  const view=useSelector(state=>state.studioUi.mediaStock);
  if(!view?.searched)return null;
  return <><div className="stock-grid">{view.provider==='google'&&<p className="studio-help" role="status">{view.detail||'Buscando imágenes…'}</p>}
    {view.items.map(item=><article className="stock-card" key={`${view.provider}:${item.index}`}><img src={item.preview||''} alt={item.name||''} loading="lazy"/><div className="stock-card-body"><strong>{item.name}</strong><small>{item.info||view.provider}</small>{(item.source||item.previewVideo)&&<a href={item.source||item.previewVideo} target="_blank" rel="noreferrer">Ver fuente</a>}<button className="secondary" data-stock-provider={view.provider} data-stock-index={item.index} disabled={item.assigned}>{item.assigned?'✓ Asignado':item.existing?'Asignar asset existente':`Agregar y asignar a escena ${view.target+1}`}</button></div></article>)}
    {!view.items.length&&!(view.provider==='google'&&['queued','leased','screening'].includes(view.status))&&<p className="studio-help">No se encontraron resultados aptos. Prueba otro término.</p>}
  </div><div className="pagination">{view.provider==='google'&&<span>{view.total} aptas · {view.rejected} descartadas</span>}<button data-stock-page={view.provider} data-stock-direction="prev" disabled={!view.previous}>‹ Anterior</button><span>Página {view.page+1} · hasta 5 resultados</span><button data-stock-page={view.provider} data-stock-direction="next" disabled={!view.next}>Siguiente ›</button></div></>;
}

const MediaScene=memo(function MediaScene({row,view}){
  const asset=row.asset,active=row.index===view.active,src=asset?mediaUrl(view.projectId,asset.id):'';
  return <article className={`media-scene ${asset?'media-scene-complete':''} ${active?'media-scene-active':''}`} data-media-card={row.index}>
    <div className="media-scene-index">{String(row.index+1).padStart(3,'0')}<small>{formatTime(row.start)} – {formatTime(row.end)}</small><small>Bloques {row.cueStart+1}–{row.cueEnd+1}</small></div>
    <div className="media-scene-preview">{asset?.type==='image'?<img src={src} loading="lazy" alt=""/>:asset?.type==='video'?<video src={src} muted preload="none" controls/>:'Sin medio'}</div>
    <div className="media-scene-content"><strong>{row.text}</strong><p className="studio-help">{row.chapter?`${row.chapter} · `:''}{row.searchTerm?`Búsqueda: ${row.searchTerm}`:'Sin término de búsqueda guardado'}</p>
      {active?<label>Asset asignado<select key={`${row.index}:${row.assetId||''}`} data-media-scene={row.index} defaultValue={row.assetId||''}><option value="">Sin medio</option>{view.assets.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>:<div className="media-scene-assignment"><small>Asset asignado: {asset?.name||'Sin medio'}</small><button className="secondary" data-activate-media={row.index}>Cambiar asset</button></div>}
      <div className="studio-actions"><button className={`secondary ${active&&view.provider==='storyblocks'?'selected-source':''}`} data-search-scene={row.index} data-provider="storyblocks">Storyblocks</button><button className={`secondary ${active&&view.provider==='pexels'?'selected-source':''}`} data-search-scene={row.index} data-provider="pexels">Pexels</button><button className={`secondary ${active&&view.provider==='google'?'selected-source':''}`} data-search-scene={row.index} data-provider="google">Google Images</button><button className="secondary" data-jump-editor={row.index}>Editar en timeline</button></div>
      {active&&<StockSearch key={`${row.index}:${view.provider}`} view={view}/>}
    </div>
  </article>;
});

function StockSearch({view}){
  const [query,setQuery]=useState(view.query);
  useEffect(()=>setQuery(view.query),[view.query]);
  return <div className="scene-stock-search"><div className="studio-grid three">
    <label>Fuente<select id="stock-provider" defaultValue={view.provider}><option value="storyblocks">Storyblocks</option><option value="pexels">Pexels</option><option value="google">Google Images</option></select></label>
    <label>Tipo<select id="stock-type" defaultValue={view.type} disabled={view.provider==='google'}><option value="videos">Videos</option><option value="photos">Fotos</option></select></label>
    <label>Término<input id="stock-query" value={query} onChange={event=>setQuery(event.target.value)}/></label>
  </div><button className="secondary" id="stock-run">Buscar en {{storyblocks:'Storyblocks',pexels:'Pexels',google:'Google Images'}[view.provider]}</button>
    {view.provider==='google'&&<p className="studio-help">OCR local: admite hasta 10% de texto y descarta marcas de agua o logos legibles. Revisa visualmente los logos sin texto. La imagen asignada se guarda en espejo. Google Images no otorga licencias de uso.</p>}
    <StockResults/>
  </div>;
}

export function MediaBoard(){
  const view=useSelector(state=>state.studioUi.mediaBoard);
  if(!view?.hasScenes)return <div className="studio-item">Carga un SRT en Entradas y crea el storyboard.</div>;
  return <>{view.rows.map(row=><MediaScene key={row.index} row={row} view={view}/>)}</>;
}
