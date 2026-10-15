import React, {useEffect,useRef,useState} from 'react';
import {useSelector} from 'react-redux';
import {transitions,transitionLabels} from '../studio-core.mjs';
import {pointerTime,shiftTextRange,boundaryTime} from './timeline-geometry.mjs';
import {visibleTimelineItems,visibleTimelineTicks} from './timeline-window.mjs';

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

function RulerContent({view,viewport}){const ticks=viewport?visibleTimelineTicks(view.ticks,viewport.left,viewport.width):view.ticks;return <>{ticks.map(tick=><span key={tick.time} className="timeline-tick" style={{left:tick.left}}>{time(tick.time)}</span>)}</>;}
export function TimelineRuler(){const view=useSelector(state=>state.studioUi.editorTimeline);return view?<RulerContent view={view}/>:null;}

function TimelineItem({item,scale}){
  if(item.boundary!=null)return <span className="scene-boundary" data-boundary={item.boundary} style={{left:item.start*scale}} title="Arrastra el corte entre tomas"/>;
  const selected=item.selected?' selected':'';
  return <div className={`timeline-block ${item.kind}${selected}`} style={{left:item.start*scale,width:item.icon?28:Math.max(item.selectType?2:1,(item.end-item.start)*scale)}} title={item.title||''} aria-label={item.icon?item.title:undefined} role={item.icon?'button':undefined} tabIndex={item.icon?0:undefined} data-select-type={item.selectType} data-select-index={item.selectIndex}>
    {item.handles&&<><span className="trim-handle start" data-trim-edge="start" title="Arrastra para ajustar inicio"/><span className="trim-handle end" data-trim-edge="end" title="Arrastra para ajustar final"/></>}
    {item.selectType?<span className="timeline-label">{item.label}</span>:item.label}
  </div>;
}

function LaneContent({view,lane,viewport}){const items=view.lanes[lane]||[],visible=viewport?visibleTimelineItems(items,view.scale,viewport.left,viewport.width):items;return <>{visible.map(item=><TimelineItem key={item.key} item={item} scale={view.scale}/>)}</>;}
export function TimelineLane({lane}){const view=useSelector(state=>state.studioUi.editorTimeline);return view?<LaneContent view={view} lane={lane}/>:null;}

const laneRows=[['text-timeline','TEXTOS'],['timeline','VIDEO'],['subtitle-timeline','SUBS'],['music-timeline','MÚSICA'],['effect-timeline','EFECTOS'],['audio-timeline','VOZ']];
function TimelinePlayhead(){
  const scale=useSelector(state=>state.studioUi.editorTimeline?.scale||1);
  const previewTime=useSelector(state=>state.studioUi.previewControls?.time||0);
  return <div id="timeline-playhead" className="timeline-playhead" style={{left:64+previewTime*scale}}/>;
}

export function TimelineView({actions}){
  const view=useSelector(state=>state.studioUi.editorTimeline);
  const drag=useRef(null);
  const contentRef=useRef(null);
  const [viewport,setViewport]=useState({left:0,width:1200});
  useEffect(()=>{
    const scroll=contentRef.current?.closest('.timeline-scroll');if(!scroll)return;
    let frame=0;
    const measure=()=>{frame=0;const left=scroll.scrollLeft,width=scroll.clientWidth;setViewport(previous=>previous.left===left&&previous.width===width?previous:{left,width});};
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(measure);};
    scroll.addEventListener('scroll',schedule,{passive:true});
    const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(schedule);observer?.observe(scroll);
    measure();
    return ()=>{scroll.removeEventListener('scroll',schedule);observer?.disconnect();if(frame)cancelAnimationFrame(frame);};
  },[!!view]);
  if(!view)return null;
  const atTime=event=>pointerTime(event.clientX,event.currentTarget.getBoundingClientRect().left,view.scale);
  const finish=event=>{
    const current=drag.current;if(!current)return;
    drag.current=null;
    if(current.kind==='playhead'){
      if(event.type==='pointerup')actions.seek(atTime(event));
      if(current.resume)actions.resumeDrag();
    }else if(current.started)actions.finishEdit();
  };
  const down=event=>{
    if(event.button!==0)return;
    event.preventDefault();window.getSelection()?.removeAllRanges();
    const target=event.target,playhead=event.currentTarget.querySelector('#timeline-playhead')?.getBoundingClientRect();
    const nearPlayhead=playhead&&Math.abs(event.clientX-(playhead.left+5))<=7;
    const boundary=target.closest('[data-boundary]'),item=target.closest('[data-select-type]'),handle=target.closest('[data-trim-edge]');
    if(nearPlayhead||target.closest('#timeline-playhead')){
      drag.current={kind:'playhead',resume:actions.pauseForDrag()};actions.seek(atTime(event));
    }else if(boundary){
      const index=Number(boundary.dataset.boundary),range=actions.boundaryRange(index);
      if(!range)return;
      drag.current={kind:'boundary',index,...range,started:false,clientX:event.clientX};
    }else if(handle&&item){
      const type=item.dataset.selectType,index=Number(item.dataset.selectIndex);
      if(!['text','subtitle'].includes(type))return;
      actions.select(type,index,false);
      drag.current={kind:'trim',type,index,edge:handle.dataset.trimEdge,started:false,clientX:event.clientX};
    }else if(item){
      const type=item.dataset.selectType,index=Number(item.dataset.selectIndex);
      actions.select(type,index,event.shiftKey);
      if(type==='text'&&!event.shiftKey){
        const layer=view.lanes['text-timeline']?.[index];
        if(layer)drag.current={kind:'text',index,start:layer.start,end:layer.end,clientX:event.clientX,started:false};
      }
    }else actions.select('empty',0,false);
    if(drag.current)event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move=event=>{
    const current=drag.current;if(!current)return;
    if(current.kind==='playhead'){actions.seek(atTime(event));return;}
    if(!current.started&&Math.abs(event.clientX-current.clientX)<3)return;
    if(!current.started){actions.beginEdit();current.started=true;}
    if(current.kind==='text'){
      const range=shiftTextRange(current.start,current.end,(event.clientX-current.clientX)/view.scale,view.duration);
      actions.moveText(current.index,range);
    }else if(current.kind==='boundary')actions.trimBoundary(current.index,boundaryTime(atTime(event),current.min,current.max));
    else actions.trimCue(current.type,current.index,current.edge,atTime(event));
  };
  return <div ref={contentRef} className="timeline-content" style={{width:view.width}} onPointerDown={down} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onKeyDown={event=>{if(event.key!=='Enter'&&event.key!==' ')return;const item=event.target.closest('[data-select-type="transition"]');if(!item)return;event.preventDefault();actions.select('transition',Number(item.dataset.selectIndex),false);}}>
    <div className="timeline-ruler"><RulerContent view={view} viewport={viewport}/><span className="timeline-ruler-gutter" aria-hidden="true"/></div>
    {laneRows.map(([id,label])=><div className="timeline-track" key={id}><b>{label}</b><div className="timeline-lane" style={{width:view.laneWidth}}><LaneContent view={view} lane={id} viewport={viewport}/></div></div>)}
    <TimelinePlayhead/>
  </div>;
}

export function HistoryControls({actions}){
  const history=useSelector(state=>state.studioUi.editorHistory);
  return <><button className="secondary" title="Deshacer · ⌘Z" disabled={!history?.canUndo} onClick={actions.undo}>↶</button><button className="secondary" title="Rehacer · ⌘⇧Z" disabled={!history?.canRedo} onClick={actions.redo}>↷</button><button className="primary" onClick={actions.save}>Guardar edición</button></>;
}

const effects=[['global','Usar secuencia global'],['none','Sin efecto'],['warm','Cálido'],['cool','Frío'],['mono','Monocromo'],['vivid','Vibrante'],['vintage','Vintage'],['contrast','Alto contraste'],['soft','Suave'],['fade','Deslavado'],['green','Verde cine'],['purple','Violeta']];

export function EffectInspector({actions}){
  const view=useSelector(state=>state.studioUi.editorInspector);
  if(view?.type!=='effect')return null;
  return <><p className="studio-help">Toma {view.index+1} · {time(view.start)}–{time(view.end)} · {view.override?'Ajuste individual':'Secuencia global'}</p>
    <label>Efecto visual de esta toma<select value={view.override||'global'} onChange={event=>actions.effect(view.index,event.target.value)}>{effects.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <p className="studio-help">La pista muestra el efecto aplicado a cada toma. Puedes reemplazarlo aquí sin cambiar la secuencia global.</p>
    <button className="secondary" onClick={()=>actions.effect(view.index,'global')}>Restaurar efecto global</button>
  </>;
}

export function TransitionInspector({actions}){
  const view=useSelector(state=>state.studioUi.editorInspector);
  if(view?.type!=='transition')return null;
  const changeSound=(key,event)=>actions.sfx(view.index,key,event.target.type==='number'?Number(event.target.value):event.target.value||null);
  return <><p className="studio-help">Tomas {view.index+1} → {view.index+2} · {time(view.cut)}</p>
    <label>Tipo de transición<select value={view.transition} onChange={event=>actions.transition(view.index,event.target.value)}>{!transitions.includes(view.transition)&&<option value={view.transition}>{transitionLabels[view.transition]||view.transition} · anterior</option>}{transitions.map(value=><option key={value} value={value}>{transitionLabels[value]||value}</option>)}</select></label>
    <label>Duración de esta transición (s)<input key={`${view.index}:${view.duration}`} type="number" min="0" max="2" step="0.05" defaultValue={view.duration} onBlur={event=>{if(Number(event.target.value)!==Number(view.duration))actions.transitionDuration(view.index,Number(event.target.value));}}/></label>
    <p className="studio-help">Se omite si cualquiera de las tomas dura menos. Esta elección reemplaza la secuencia global solo en este corte.</p>
    <button className="secondary" onClick={()=>actions.transitionInherit(view.index)}>Usar secuencia global</button><button className="secondary" onClick={()=>actions.transitionPreview(view.index)}>▶ Ver transición</button>
    <strong className="control-title">Sonido de esta transición</strong>
    <label>Audio<select value={view.sfxId||''} onChange={event=>changeSound('sfxId',event)}><option value="">Sin sonido</option>{view.assets?.map(asset=><option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
    <label>Volumen (%)<input key={`${view.index}:volume:${view.volume}`} type="number" min="0" max="100" defaultValue={view.volume} onBlur={event=>{if(Number(event.target.value)!==Number(view.volume))changeSound('sfxVolume',event);}}/></label>
    <label>Alineación<select value={view.align} onChange={event=>changeSound('sfxAlign',event)}><option value="start">Inicio</option><option value="center">Centro</option><option value="end">Final</option></select></label>
    <label>Desfase (s)<input key={`${view.index}:offset:${view.offset}`} type="number" step=".05" defaultValue={view.offset} onBlur={event=>{if(Number(event.target.value)!==Number(view.offset))changeSound('sfxOffset',event);}}/></label>
  </>;
}

export function SfxInspector({actions}){
  const view=useSelector(state=>state.studioUi.editorInspector);
  if(view?.type!=='sfx')return null;
  const change=(key,event)=>actions.sfx(view.index,key,event.target.type==='number'?Number(event.target.value):event.target.value||null);
  return <><p className="studio-help">Corte después de la toma {view.index+1}</p>
    <label>Sonido<select value={view.sfxId||''} onChange={event=>change('sfxId',event)}><option value="">Ninguno</option>{view.assets.map(asset=><option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
    <label>Volumen (%)<input key={`${view.index}:volume:${view.volume}`} type="number" min="0" max="100" defaultValue={view.volume} onBlur={event=>{if(Number(event.target.value)!==Number(view.volume))change('sfxVolume',event);}}/></label>
    <label>Alineación<select value={view.align} onChange={event=>change('sfxAlign',event)}><option value="start">Inicio</option><option value="center">Centro</option><option value="end">Final</option></select></label>
    <label>Desfase (s)<input key={`${view.index}:offset:${view.offset}`} type="number" step=".05" defaultValue={view.offset} onBlur={event=>{if(Number(event.target.value)!==Number(view.offset))change('sfxOffset',event);}}/></label>
  </>;
}

export function AudioInspector({kind,actions}){
  const view=useSelector(state=>state.studioUi.editorInspector);
  const [dragging,setDragging]=useState(false);
  if(view?.type!==kind)return null;
  const voice=kind==='voice',inputId=voice?'inspector-voice-upload':'inspector-music-upload';
  return <><label>{voice?'Narración':'Música'}<select value={voice?view.narrationId||'':view.musicId||''} onChange={event=>actions.audioSelect(voice?'narrationId':'musicId',event.target.value)}><option value="">Ninguno</option>{view.assets.map(asset=><option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
    <label className={`inspector-upload drop-zone ${dragging?'dragging':''}`} onDragOver={event=>{event.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={event=>{event.preventDefault();setDragging(false);actions.audioDrop(inputId,event.dataTransfer);}}>↥ Arrastra o sube {voice?'narración':'música'}<input id={inputId} type="file" accept="audio/*" onChange={event=>{const files=[...event.target.files];event.target.value='';actions.audioUpload(inputId,files);}}/></label>
    {voice?<p className="studio-help">La duración de la voz guía el montaje. Ajusta las pausas de todos los bloques en el panel izquierdo.</p>:<><label>Volumen de música (%)<input key={view.musicVolume} type="number" min="0" max="100" defaultValue={view.musicVolume} onBlur={event=>{if(Number(event.target.value)!==Number(view.musicVolume))actions.musicVolume(Number(event.target.value));}}/></label><p className="studio-help">La música se repite durante el montaje.</p></>}
  </>;
}
