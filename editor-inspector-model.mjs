import {effectiveScene} from './studio-core.mjs';

const names={scene:'TOMA',effect:'EFECTO VISUAL',transition:'TRANSICIÓN',text:'TEXTO EN PANTALLA',subtitle:'SUBTÍTULO',voice:'NARRACIÓN',music:'MÚSICA',sfx:'EFECTO DE SONIDO',multi:'SELECCIÓN MÚLTIPLE'};
const colorNames={yellow:'#ffe36c',cyan:'#73efff',pink:'#ff83bc',green:'#8ef7ae',white:'#ffffff'};
const hexColor=(value,fallback)=>/^#[\da-f]{6}$/i.test(value||'')?value.toLowerCase():colorNames[value]||fallback;
const time=value=>{const n=Number(value)||0;return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}.${String(Math.round(n%1*1000)).padStart(3,'0')}`;};
const range=item=>`${time(item.start)}–${time(item.end)}`;

export function buildInspectorView(project,{selection=null,multiSelection=[],templates=[]}={}){
  const type=selection?.type||'empty',index=selection?.index;
  const selected={type,heading:names[type]||'PROPIEDADES',time:''};
  if(!project)return {selection:{type:'empty',heading:'PROPIEDADES',time:''},panel:null};
  let panel=null;
  if(type==='multi')panel={type,count:multiSelection.length,hasScenes:multiSelection.some(item=>item.type==='scene'),hasSubtitles:multiSelection.some(item=>item.type==='subtitle'),hasText:multiSelection.some(item=>item.type==='text')};
  if(type==='scene'){
    const scene=project.scenes?.[index];if(scene)selected.time=range(scene);
  }
  if(type==='effect'){
    const raw=project.scenes?.[index];if(raw){const scene=effectiveScene(project,raw,index);panel={type,index,start:scene.start,end:scene.end,override:raw.effectOverride||null};selected.time=range(scene);}
  }
  if(type==='transition'){
    const scene=project.scenes?.[index],next=project.scenes?.[index+1];
    if(scene&&next){const resolved=effectiveScene(project,scene,index);panel={type,index,cut:scene.end,transition:resolved.transition,duration:resolved.transitionDuration};selected.time=time(scene.end);}
  }
  if(type==='text'){
    const layer=project.textLayers?.[index];
    if(layer){panel={type,index,layer:{...layer,color:hexColor(layer.color,'#ffffff'),accent:hexColor(layer.accent,'#ff537e')},templates:templates.map(template=>({id:template.id,name:template.name}))};selected.time=range(layer);}
  }
  if(type==='subtitle'){
    const cue=(project.subtitleCues?.length?project.subtitleCues:project.cues)?.[index];
    if(cue){panel={type,index,cue:{...cue},settings:{captionStyle:project.settings?.captionStyle||'cine',captionFont:project.settings?.captionFont||'Inter',captionSize:project.settings?.captionSize||'medium',captionPosition:project.settings?.captionPosition||'bottom',captionColor:hexColor(project.settings?.captionColor,'#ffe36c'),captionAccent:hexColor(project.settings?.captionAccent,'#42f578')},hasWords:!!project.wordsJson?.words?.length};selected.time=range(cue);}
  }
  if(type==='sfx'){
    const scene=project.scenes?.[index];
    if(scene)panel={type,index,sfxId:scene.sfxId||null,volume:scene.sfxVolume??70,align:scene.sfxAlign||'center',offset:scene.sfxOffset||0,assets:(project.assets||[]).filter(asset=>asset.type==='audio').map(asset=>({id:asset.id,name:asset.name}))};
  }
  if(type==='voice'||type==='music')panel={type,narrationId:project.narrationId||null,musicId:project.musicId||null,musicVolume:project.settings?.musicVolume??20,assets:(project.assets||[]).filter(asset=>asset.type==='audio').map(asset=>({id:asset.id,name:asset.name}))};
  return {selection:selected,panel};
}
