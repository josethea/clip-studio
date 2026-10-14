import React, {useState} from 'react';
import {useSelector} from 'react-redux';

const fitOptions=[['','Usar encuadre global'],['fill','Llenar pantalla · recortar'],['contain','Foto completa · fondo negro'],['blur','Foto completa · fondo desenfocado'],['frame','Foto enmarcada']];
const motionOptions=[['','Usar ajuste global'],['static','Sin movimiento'],['zoom-in','Acercar'],['zoom-out','Alejar'],['pan-left','Recorrer a izquierda'],['pan-right','Recorrer a derecha'],['pan-up','Recorrer arriba'],['pan-down','Recorrer abajo'],['pulse','Pulso']];
const time=value=>{const n=Number(value)||0;return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}.${String(Math.round(n%1*1000)).padStart(3,'0')}`;};

function SceneDetails({view,actions}){
  const [dragging,setDragging]=useState(false);
  const {scene,asset,assets,index,projectId}=view;
  const src=asset?`/api/studio/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(asset.id)}`:'';
  const change=(field,event)=>actions.change(index,field,event.target.type==='number'?Number(event.target.value):event.target.value||null);
  return <><div className="inspector-media">{asset?.type==='image'?<img src={src} alt={asset.name}/>:asset?.type==='video'?<video src={src} muted preload="metadata" controls/>:'Sin asset asignado'}</div>
    <p className="studio-help">Toma {index+1} · {time(scene.start)}–{time(scene.end)}<br/>{scene.text||''}</p>
    <button type="button" className="secondary" onClick={()=>actions.openPicker(index)}>Biblioteca visual</button>
    <label>Material de la toma<select value={scene.assetId||''} onChange={event=>change('assetId',event)}><option value="">Sin medio</option>{assets.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className="scene-fit-control">Encuadre de esta toma<select value={scene.fitOverride||''} onChange={event=>change('fitOverride',event)}>{fitOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label className={`inspector-upload drop-zone ${dragging?'dragging':''}`} onDragOver={event=>{event.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={event=>{event.preventDefault();setDragging(false);actions.drop(index,event.dataTransfer);}}>↥ Arrastra o sube un medio<input id="inspector-upload" type="file" accept="image/*,video/*" onChange={event=>{const files=[...event.target.files];event.target.value='';actions.upload(index,files);}}/></label>
    <label>Inicio dentro del medio (s)<input key={`${index}:sourceStart:${scene.sourceStart||0}`} type="number" min="0" step=".1" defaultValue={scene.sourceStart||0} onBlur={event=>{if(Number(event.target.value)!==Number(scene.sourceStart||0))change('sourceStart',event);}}/></label>
    <label>Movimiento<select value={scene.motionOverride||''} onChange={event=>change('motionOverride',event)}>{motionOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label>Intensidad de movimiento (%)<input key={`${index}:zoom:${scene.zoomPercentOverride??view.zoomPercent}`} type="number" min="2" max="40" defaultValue={scene.zoomPercentOverride??view.zoomPercent} onBlur={event=>{if(Number(event.target.value)!==Number(scene.zoomPercentOverride??view.zoomPercent))change('zoomPercentOverride',event);}}/></label>
    <p className="studio-help">Arrastra el borde entre dos tomas para alargar una y acortar la vecina. La duración total se conserva.</p>
  </>;
}

export function SceneInspector({actions}){
  const view=useSelector(state=>state.studioUi.editorScene);
  return view?<SceneDetails key={view.index} view={view} actions={actions}/>:null;
}

export function TimelineRuler(){
  const view=useSelector(state=>state.studioUi.editorTimeline);
  if(!view)return null;
  return <>{view.ticks.map(tick=><span key={tick.time} className="timeline-tick" style={{left:tick.left}}>{time(tick.time)}</span>)}</>;
}

function TimelineItem({item,scale}){
  if(item.boundary!=null)return <span className="scene-boundary" data-boundary={item.boundary} style={{left:item.start*scale}} title="Arrastra el corte entre tomas"/>;
  const selected=item.selected?' selected':'';
  return <div className={`timeline-block ${item.kind}${selected}`} style={{left:item.start*scale,width:Math.max(item.selectType?2:1,(item.end-item.start)*scale)}} title={item.title||''} data-select-type={item.selectType} data-select-index={item.selectIndex}>
    {item.handles&&<><span className="trim-handle start" data-trim-edge="start" title="Arrastra para ajustar inicio"/><span className="trim-handle end" data-trim-edge="end" title="Arrastra para ajustar final"/></>}
    {item.selectType?<span className="timeline-label">{item.label}</span>:item.label}
  </div>;
}

export function TimelineLane({lane}){
  const view=useSelector(state=>state.studioUi.editorTimeline);
  if(!view)return null;
  return <>{(view.lanes[lane]||[]).map(item=><TimelineItem key={item.key} item={item} scale={view.scale}/>)}</>;
}
