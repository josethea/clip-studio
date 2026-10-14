import React,{useState} from 'react';
import {useSelector} from 'react-redux';

const effects=[['none','Ninguno'],['warm','Cálido'],['cool','Frío'],['mono','Monocromo'],['vivid','Vibrante'],['vintage','Vintage'],['contrast','Alto contraste'],['soft','Suave'],['fade','Deslavado'],['green','Verde cine'],['purple','Violeta'],['global','Usar secuencia global']];
const positions=[['center','Centro'],['top-left','Arriba izquierda'],['top-right','Arriba derecha'],['bottom-left','Abajo izquierda'],['bottom-right','Abajo derecha']];
const animations=[['fade','Aparecer'],['slide','Deslizar'],['pop','Escala']];

export function SceneExtraControls({actions}){
  const view=useSelector(state=>state.studioUi.editorSceneExtras);
  if(!view)return null;
  const {scene,index,assets,overrideMode}=view;
  const field=(label,key,fallback,options=null,attrs={})=><label key={`${index}:${key}`}>{label}{options?<select value={scene?.[key]??fallback} onChange={event=>actions.overlay(index,key,event.target.value)}>{options.map(([value,name])=><option key={value} value={value}>{name}</option>)}</select>:<input type="number" key={`${index}:${key}:${scene?.[key]??fallback}`} defaultValue={scene?.[key]??fallback} onBlur={event=>{const value=Number(event.target.value);if(Number.isFinite(value)&&value!==Number(scene?.[key]??fallback))actions.overlay(index,key,value);}} {...attrs}/>}</label>;
  return <>
    {!scene&&<p className="studio-help">Selecciona una toma.</p>}
    {scene&&<><h3>Capa gráfica</h3><p className="studio-help">Imagen encima de la toma.</p>
      {field('Imagen superpuesta','overlayId','',[['','Ninguno'],...assets.map(asset=>[asset.id,asset.name])])}
      {field('Inicio en segmento (s)','overlayStart',0,null,{min:0,step:0.1})}
      {field('Duración (s)','overlayDuration',2,null,{min:0.1,step:0.1})}
      {field('Posición','overlayPosition','center',positions)}
      {field('Tamaño (%)','overlaySize',35,null,{min:5,max:90})}
      {field('Opacidad (%)','overlayOpacity',100,null,{min:0,max:100})}
      {field('Entrada','overlayAnimation','fade',animations)}
    </>}
    <label className="override-toggle"><input type="checkbox" checked={overrideMode} onChange={event=>actions.toggleOverride(event.target.checked)}/> Efecto solo para esta toma</label>
    {overrideMode&&(!scene?<p className="studio-help">Selecciona la toma en el timeline.</p>:<EffectOverride key={`${index}:${scene.effectOverride||'global'}`} index={index} value={scene.effectOverride||'global'} actions={actions}/>)}
    <button id="save-segment" className="secondary" disabled={!scene} onClick={actions.saveScene}>Guardar toma</button>
  </>;
}

function EffectOverride({index,value,actions}){
  const [draft,setDraft]=useState(value);
  return <><strong>Toma {index+1}</strong><label>Efecto<select value={draft} onChange={event=>setDraft(event.target.value)}>{effects.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><button className="secondary" onClick={()=>actions.applyEffect(index,draft)}>Aplicar efecto</button></>;
}

export function TemplatePanel({actions}){
  const view=useSelector(state=>state.studioUi.editorTemplates);
  return <><p className="studio-help">Usa una plantilla incluida o guarda tus ajustes para otros proyectos.</p><div className="template-library">{(view||[]).map(item=><div className="template-entry" key={item.id}><button type="button" className="template-card" onClick={()=>actions.create(item.id)}><strong>{item.name}</strong><small>{item.custom?'Personalizada':'Incluida'}</small></button>{item.custom&&<button className="template-remove" title="Eliminar plantilla" aria-label={`Eliminar ${item.name}`} onClick={()=>actions.remove(item.id)}>×</button>}</div>)}</div><button className="secondary" onClick={()=>actions.create()}>Crear texto desde plantilla</button><button className="secondary" onClick={actions.save}>Guardar texto seleccionado como plantilla</button></>;
}

export function pickerItems(view,tab){
  const used=new Set(view.usedIds);
  return view.assets.filter(asset=>(asset.type==='image'||asset.type==='video')&&(tab==='all'||used.has(asset.id)));
}

export function EditorMediaPicker({actions}){
  const view=useSelector(state=>state.studioUi.editorMediaPicker);
  if(!view)return null;
  return <Picker key={view.openToken} view={view} actions={actions}/>;
}

function Picker({view,actions}){
  const [tab,setTab]=useState('used'),[page,setPage]=useState(0),[candidate,setCandidate]=useState(view.selectedAssetId||'');
  const items=pickerItems(view,tab),pages=Math.max(1,Math.ceil(items.length/12)),current=Math.min(page,pages-1);
  return <><div className="media-picker-head"><strong>Material para la toma {view.sceneIndex+1}</strong><button className="secondary" onClick={actions.close} aria-label="Cerrar selector">✕</button></div>
    <div className="media-picker-tabs"><button className={tab==='used'?'active':''} onClick={()=>{setTab('used');setPage(0);}}>De este vídeo</button><button className={tab==='all'?'active':''} onClick={()=>{setTab('all');setPage(0);}}>Toda la biblioteca</button></div>
    <div className="media-picker-grid">{items.slice(current*12,(current+1)*12).map(asset=>{const url=`/api/studio/projects/${encodeURIComponent(view.projectId)}/assets/${encodeURIComponent(asset.id)}`;return <button key={asset.id} className={`media-picker-card ${candidate===asset.id?'active':''}`} onClick={()=>setCandidate(asset.id)} aria-pressed={candidate===asset.id}><span className="media-picker-thumb">{asset.type==='image'?<img src={url} loading="lazy" alt=""/>:<video src={url} muted preload="none"/>}</span><strong>{asset.name}</strong><small>{asset.type}</small></button>;})}{!items.length&&<p className="studio-help">No hay medios aquí. Impórtalos en Medios o usa la pestaña Toda la biblioteca.</p>}</div>
    <div className="media-picker-foot"><button className="secondary" disabled={!current} onClick={()=>setPage(current-1)}>‹</button><span>{current+1} / {pages}</span><button className="secondary" disabled={current>=pages-1} onClick={()=>setPage(current+1)}>›</button><span className="spacer"/><button className="secondary" onClick={actions.close}>Cancelar</button><button className="primary" disabled={!candidate} onClick={()=>actions.use(view.projectId,view.sceneIndex,candidate)}>Usar material</button></div>
  </>;
}
