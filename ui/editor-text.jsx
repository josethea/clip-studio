import React, {useEffect,useState} from 'react';
import {useSelector} from 'react-redux';

const colors=['#ffffff','#ffe36c','#ff83bc','#73efff','#42f578','#ff537e','#111111'];
const fonts=['Inter','Anton','IBM Plex Mono','Courier Prime'];
const positions=[['center','Centro'],['center-left','Centro izquierda'],['center-right','Centro derecha'],['top','Arriba'],['bottom','Abajo'],['top-left','Arriba izquierda'],['bottom-left','Abajo izquierda'],['top-right','Arriba derecha'],['bottom-right','Abajo derecha']];
const effects=[['global','Usar secuencia global'],['none','Ninguno'],['warm','Cálido'],['cool','Frío'],['mono','Monocromo'],['vivid','Vibrante'],['vintage','Vintage'],['contrast','Alto contraste'],['soft','Suave'],['fade','Deslavado'],['green','Verde cine'],['purple','Violeta']];
const options=items=>items.map(([value,label])=><option key={value} value={value}>{label}</option>);

function ColorField({label,value,onChange}){
  return <label>{label}<input type="color" value={value} onChange={event=>onChange(event.target.value)}/><span className="color-presets">{colors.map(color=><button key={color} type="button" className={`color-preset ${value.toLowerCase()===color?'active':''}`} style={{'--swatch':color}} title={color} aria-label={`Elegir color ${color}`} onClick={()=>onChange(color)}/>)}</span></label>;
}

function TextFields({view,actions}){
  const [draft,setDraft]=useState(view.layer);
  useEffect(()=>setDraft(view.layer),[view.layer]);
  const change=(key,value)=>{setDraft(previous=>({...previous,[key]:value}));actions.textField(view.index,key,value);};
  const timeChange=(key,value)=>{const number=Number(value);if(value!==''&&actions.textField(view.index,key,number))setDraft(previous=>({...previous,[key]:number}));else setDraft(previous=>({...previous,[key]:view.layer[key]}));};
  return <><label>Tipo<select value={draft.type||'highlight'} onChange={event=>change('type',event.target.value)}>{options([['highlight','Texto destacado'],['lower-third','Rótulo de persona o lugar'],['title','Título']])}</select></label>
    <label>Plantilla<select value={view.layer.templateId||'headline'} onChange={event=>actions.textTemplate(view.index,event.target.value)}>{view.templates.map(template=><option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
    <label>Texto<textarea rows="3" value={draft.text||''} onChange={event=>change('text',event.target.value)}/></label>
    <label>Palabras resaltadas (separadas por comas)<input value={draft.highlight||''} onChange={event=>change('highlight',event.target.value)}/></label>
    <label>Posición<select value={draft.position||'center'} onChange={event=>change('position',event.target.value)}>{options(positions)}</select></label>
    <div className="inspector-pair"><label>Entra (s)<input type="number" min="0" step="0.033" value={draft.start??0} onChange={event=>setDraft(previous=>({...previous,start:event.target.value}))} onBlur={event=>timeChange('start',event.target.value)}/></label><label>Sale (s)<input type="number" min="0" step="0.033" value={draft.end??0} onChange={event=>setDraft(previous=>({...previous,end:event.target.value}))} onBlur={event=>timeChange('end',event.target.value)}/></label></div>
    <div className="inspector-pair"><label>Fuente<select value={draft.font||'Inter'} onChange={event=>change('font',event.target.value)}>{fonts.map(font=><option key={font} value={font}>{font}</option>)}</select></label><label>Tamaño (%)<input type="number" min="2" max="18" step=".5" value={draft.size??''} onChange={event=>setDraft(previous=>({...previous,size:event.target.value}))} onBlur={event=>timeChange('size',event.target.value)}/></label></div>
    <div className="inspector-pair"><ColorField label="Color" value={draft.color} onChange={value=>change('color',value)}/><ColorField label="Resaltado" value={draft.accent} onChange={value=>change('accent',value)}/></div>
    <label>Fondo (%)<input type="number" min="0" max="100" value={draft.background??0} onChange={event=>setDraft(previous=>({...previous,background:event.target.value}))} onBlur={event=>timeChange('background',event.target.value)}/></label>
    <label>Animación<select value={draft.animation||'fade'} onChange={event=>change('animation',event.target.value)}>{options([['fade','Aparecer'],['slide','Deslizar'],['pop','Escala'],['none','Ninguna']])}</select></label>
    <div className="inspector-actions"><button className="secondary" onClick={()=>actions.saveTextTemplate(view.index)}>Guardar plantilla</button><button className="secondary danger" onClick={()=>actions.deleteText(view.index)}>Eliminar texto</button></div>
  </>;
}

export function TextInspector({actions}){
  const view=useSelector(state=>state.studioUi.editorInspector);
  return view?.type==='text'?<TextFields key={view.layer.id||view.index} view={view} actions={actions}/>:null;
}

function SubtitleFields({view,actions}){
  const [draft,setDraft]=useState(view.cue);
  useEffect(()=>setDraft(view.cue),[view.cue]);
  const cueChange=(key,value)=>{setDraft(previous=>({...previous,[key]:value}));actions.subtitleField(view.index,key,value);};
  const timeChange=(key,value)=>{const number=Number(value);if(value!==''&&actions.subtitleField(view.index,key,number))setDraft(previous=>({...previous,[key]:number}));else setDraft(previous=>({...previous,[key]:view.cue[key]}));};
  const setting=(key,value)=>actions.captionSetting(key,value);
  return <><label>Texto<textarea rows="3" value={draft.text||''} onChange={event=>cueChange('text',event.target.value)}/></label>
    <div className="inspector-pair"><label>Entra (s)<input type="number" min="0" step="0.033" value={draft.start??0} onChange={event=>setDraft(previous=>({...previous,start:event.target.value}))} onBlur={event=>timeChange('start',event.target.value)}/></label><label>Sale (s)<input type="number" min="0" step="0.033" value={draft.end??0} onChange={event=>setDraft(previous=>({...previous,end:event.target.value}))} onBlur={event=>timeChange('end',event.target.value)}/></label></div>
    <p className="studio-help">Corregir el subtítulo no modifica la narración.</p>
    <label>Estilo<select value={view.settings.captionStyle||'cine'} onChange={event=>setting('captionStyle',event.target.value)}>{[['cine','Clásico'],['highlight','Resaltado'],['minimal','Minimalista'],['dynamic','Dinámico palabra a palabra'],['neon','Neón'],['tiktok','Caja']].map(([value,label])=><option key={value} value={value} disabled={value==='dynamic'&&!view.hasWords}>{label}</option>)}</select></label>
    {!view.hasWords&&<p className="studio-help">El resaltado palabra a palabra requiere Words JSON con tiempos de cada palabra.</p>}
    <label>Tipografía<select value={view.settings.captionFont||'Inter'} onChange={event=>setting('captionFont',event.target.value)}>{fonts.map(font=><option key={font} value={font}>{font}</option>)}</select></label>
    <label>Tamaño<select value={view.settings.captionSize||'medium'} onChange={event=>setting('captionSize',event.target.value)}>{options([['small','Pequeño'],['medium','Mediano'],['large','Grande'],['xlarge','Muy grande']])}</select></label>
    <label>Posición<select value={view.settings.captionPosition||'bottom'} onChange={event=>setting('captionPosition',event.target.value)}>{options([['bottom','Abajo'],['center','Centro'],['top','Arriba']])}</select></label>
    <div className="inspector-pair"><ColorField label="Color del texto" value={view.settings.captionColor} onChange={value=>setting('captionColor',value)}/><ColorField label="Resaltado" value={view.settings.captionAccent} onChange={value=>setting('captionAccent',value)}/></div>
    <button className="secondary danger" onClick={()=>actions.toggleSubtitle(view.index)}>{view.cue.hidden?'Mostrar subtítulo':'Quitar este subtítulo'}</button>
  </>;
}

export function SubtitleInspector({actions}){
  const view=useSelector(state=>state.studioUi.editorInspector);
  return view?.type==='subtitle'?<SubtitleFields key={view.index} view={view} actions={actions}/>:null;
}

export function MultiInspector({actions}){
  const view=useSelector(state=>state.studioUi.editorInspector);
  const [effect,setEffect]=useState('global');
  if(view?.type!=='multi')return null;
  return <><p className="studio-help">{view.count} elementos seleccionados. Usa Mayús + clic para agregar o quitar bloques.</p>
    <label>Efecto para tomas seleccionadas<select value={effect} onChange={event=>setEffect(event.target.value)}>{options(effects)}</select></label>
    <button className="secondary" disabled={!view.hasScenes} onClick={()=>actions.multiEffect(effect)}>Aplicar a tomas</button>
    <button className="secondary" disabled={!view.hasSubtitles} onClick={()=>actions.multiHideSubtitles()}>Ocultar subtítulos elegidos</button>
    <button className="secondary danger" disabled={!view.hasText} onClick={()=>actions.multiDeleteText()}>Eliminar textos elegidos</button>
    <button className="secondary" onClick={()=>actions.multiClear()}>Quitar selección</button>
  </>;
}
