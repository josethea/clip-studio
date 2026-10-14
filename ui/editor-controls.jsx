import React, {memo,useEffect,useState} from 'react';
import {useSelector} from 'react-redux';
import {transitions, transitionLabels, videoEffects} from '../studio-core.mjs';

const effectLabels={warm:'Cálido',cool:'Frío',mono:'Monocromo',vivid:'Vibrante',vintage:'Vintage',contrast:'Alto contraste',soft:'Suave',fade:'Deslavado',green:'Verde cine',purple:'Violeta'};
const imageFits=[['fill','Llenar pantalla · recortar'],['contain','Foto completa · fondo negro'],['blur','Foto completa · fondo desenfocado'],['frame','Foto enmarcada']];
const videoFits=[['fill','Llenar pantalla · recortar'],['contain','Video completo · fondo negro'],['blur','Video completo · fondo desenfocado']];
const motions=[['static','Estático'],['zoom-in','Zoom in'],['zoom-out','Zoom out'],['pan-left','Recorrido a izquierda'],['pan-right','Recorrido a derecha'],['pan-up','Recorrido arriba'],['pan-down','Recorrido abajo'],['pulse','Pulso suave']];
const formatTime=value=>{const n=Number(value)||0;return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}.${String(Math.round(n%1*1000)).padStart(3,'0')}`;};

function Select({label,value,options,onChange}){return <label>{label}<select value={value} onChange={event=>onChange(event.target.value)}>{options.map(([id,text])=><option key={id} value={id}>{text}</option>)}</select></label>;}
function NumberField({label,value,min,max,step=1,onChange}){const [draft,setDraft]=useState(String(value));useEffect(()=>setDraft(String(value)),[value]);return <label>{label}<input type="number" min={min} max={max} step={step} value={draft} onChange={event=>setDraft(event.target.value)} onBlur={()=>{const number=Number(draft);if(draft!==''&&Number.isFinite(number))onChange(number);else setDraft(String(value));}} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur();}}/></label>;}

export const GlobalControls=memo(function GlobalControls({actions}){
  const view=useSelector(state=>state.studioUi.globalControls);
  if(!view)return null;
  const {transitionSequence=[],effectSequence=[]}=view;
  return <>
    <p className="studio-help">El orden elegido se repite entre escenas.</p>
    <strong className="control-title">Transiciones</strong>
    <div className="choice-grid">{transitions.map(id=><button key={id} type="button" className={`choice-chip ${transitionSequence.includes(id)?'active':''}`} aria-pressed={transitionSequence.includes(id)} onClick={()=>actions.toggleTransition(id)}>{transitionLabels[id]||id}</button>)}</div>
    <small className="studio-help">Orden: {transitionSequence.length?transitionSequence.map(id=>transitionLabels[id]||id).join(' → '):'Sin transición'}</small>
    <NumberField label="Duración de transición (s)" value={view.transitionDuration} min="0.1" max="2" step="0.05" onChange={value=>actions.change('transitionDuration',value)}/>
    <strong className="control-title">Efectos visuales</strong>
    <div className="choice-grid">{videoEffects.map(id=><button key={id} type="button" className={`choice-chip ${effectSequence.includes(id)?'active':''}`} aria-pressed={effectSequence.includes(id)} onClick={()=>actions.toggleEffect(id)}>{effectLabels[id]||id}</button>)}</div>
    <small className="studio-help">Orden: {effectSequence.length?effectSequence.map(id=>effectLabels[id]||id).join(' → '):'Sin efecto'}</small>
    <Select label="Encuadre global de imágenes" value={view.imageFit} options={imageFits} onChange={value=>actions.change('imageFit',value)}/>
    <Select label="Encuadre global de videos" value={view.videoFit} options={videoFits} onChange={value=>actions.change('videoFit',value)}/>
    <p className="studio-help">El encuadre depende del tipo de medio. La resolución se evalúa por separado para advertir si habrá ampliación.</p>
    <NumberField label="Blur del fondo" value={view.blur} min="2" max="70" onChange={value=>actions.change('blur',value)}/>
    <NumberField label="Opacidad oscura (%)" value={view.blurOpacity} min="0" max="80" onChange={value=>actions.change('blurOpacity',value)}/>
    <Select label="Movimiento de imagen" value={view.motion} options={motions} onChange={value=>actions.change('motion',value)}/>
    <NumberField label="Intensidad del movimiento (%)" value={view.zoomPercent} min="2" max="40" onChange={value=>actions.change('zoomPercent',value)}/>
    <button className="secondary" onClick={actions.save}>Guardar estilo global</button>
  </>;
});

export const FormatControls=memo(function FormatControls({actions}){
  const view=useSelector(state=>state.studioUi.formatControls);
  if(!view)return null;
  return <>
    <Select label="Relación de aspecto" value={view.ratio} options={[["9:16","9:16 · vertical"],["16:9","16:9 · horizontal"]]} onChange={value=>actions.change('ratio',value)}/>
    <Select label="Resolución de salida" value={view.quality} options={[["720p","720p"],["1080p","1080p"]]} onChange={value=>actions.change('quality',value)}/>
    <Select label="Calidad del MP4" value={view.exportQuality} options={[["balanced","Equilibrada · exporta más rápido"],["high","Alta · recomendada"],["maximum","Máxima · archivo grande"]]} onChange={value=>actions.change('exportQuality',value)}/>
    <p className="studio-help">1080p define el tamaño del video; la nitidez también depende de la resolución de las imágenes originales.</p>
    <Select label="Subtítulos" value={view.captions?'yes':'no'} options={[["yes","Activados"],["no","Desactivados"]]} onChange={value=>actions.change('captions',value==='yes')}/>
  </>;
});

export const PreviewControls=memo(function PreviewControls({actions}){
  const view=useSelector(state=>state.studioUi.previewControls);
  return <>
    <button className="secondary" title="Desde inicio" onClick={actions.fromStart}>⏮</button>
    <button id="preview-play" className="primary" onClick={actions.play}>{view?.playing?'Ⅱ Pausar':'▶ Reproducir'}</button>
    <button className="secondary" title="Detener" onClick={actions.stop}>■</button>
    <input type="range" min="0" max={view?.duration||1} step="0.01" value={view?.time||0} onChange={event=>actions.seek(event.target.value)} aria-label="Posición de reproducción"/>
    <span>{formatTime(view?.time)} / {formatTime(view?.duration)}</span>
  </>;
});
