import {effectiveScene,transitionSeconds,transitionLabels} from './studio-core.mjs';

const fmt=value=>{const n=Number(value)||0;return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}.${String(Math.round(n%1*1000)).padStart(3,'0')}`;};
const effectNames={warm:'Cálido',cool:'Frío',mono:'Monocromo',vivid:'Vibrante',vintage:'Vintage',contrast:'Alto contraste',soft:'Suave',fade:'Deslavado',green:'Verde cine',purple:'Violeta'};

export function buildTimelineView(project,{scale,selection=null,multiSelection=[]}={}){
  const p=project,end=p.scenes.at(-1)?.end||p.cues.at(-1)?.end||0;
  const pixels=scale??Math.max(18,Math.min(100,900/Math.max(1,end)));
  const laneWidth=Math.max(850,Math.ceil(end*pixels)+20);
  const tickSeconds=[1,2,5,10,15,30,60,120,300,600].find(n=>n*pixels>=85)||600;
  const selected=(type,index)=>selection?.type===type&&selection.index===index||multiSelection.some(item=>item.type===type&&item.index===index);
  const item=(key,kind,start,stop,label,type,index,handles=false,title='')=>({key,kind,start,end:stop,label,selectType:type,selectIndex:index,handles,title,selected:type?!!selected(type,index):false});
  const assets=new Map(p.assets.map(asset=>[asset.id,asset]));
  const scenes=p.scenes.map((scene,index)=>effectiveScene(p,scene,index));
  const lanes={
    'text-timeline':(p.textLayers||[]).map((layer,i)=>item(`text-${i}`,'text',layer.start,layer.end,layer.text||'Texto','text',i,true,layer.text)),
    'timeline':scenes.flatMap((scene,i)=>[item(`scene-${i}`,'video',scene.start,scene.end,`${i+1} · ${assets.get(scene.assetId)?.name||'Sin medio'}`,'scene',i,false,`${fmt(scene.start)}–${fmt(scene.end)} · ${scene.text}`),...(i<scenes.length-1?[{key:`boundary-${i}`,boundary:i,start:scene.end}]:[])]),
    'effect-timeline':scenes.map((scene,i)=>{const name=effectNames[scene.effect]||'Sin efecto';return item(`effect-${i}`,`effect${scene.effect==='none'?' muted':''}`,scene.start,scene.end,name,'effect',i,false,`Toma ${i+1} · ${name}${p.scenes[i].effectOverride?' · ajuste individual':' · secuencia global'}`);}),
    'transition-timeline':scenes.slice(0,-1).map((scene,i)=>{const d=transitionSeconds(p,i),pos=Math.max(0,scene.end-(d||.25)/2),name=d?scene.transition:'remotion:none',label=transitionLabels[name]||name;return item(`transition-${i}`,'transition',pos,pos+(d||.25),label,'transition',i,false,`Tomas ${i+1} → ${i+2} · ${label}`);}),
    'audio-timeline':(p.cues||[]).flatMap((cue,i)=>[item(`voice-${i}`,'voice',cue.start,cue.end,`▥ ${i+1}`,'voice',i,false,cue.text),...(i<p.cues.length-1&&p.cues[i+1].start>cue.end?[item(`gap-${i}`,'gap',cue.end,p.cues[i+1].start,`${Math.round((p.cues[i+1].start-cue.end)*1000)} ms`,null,null,false,'Pausa')]:[])]),
    'music-timeline':[],
    'sfx-timeline':scenes.slice(0,-1).map((scene,i)=>{const asset=assets.get(scene.sfxId),d=Math.min(Number(scene.transitionDuration)||.45,asset?.duration||.45),shift=scene.sfxAlign==='start'?0:scene.sfxAlign==='end'?-d:-d/2,start=Math.max(0,scene.end+shift+Number(scene.sfxOffset||0));return item(`sfx-${i}`,`sfx${asset?'':' muted'}`,start,start+d,asset?`♪ ${asset.name}`:'♪ +','sfx',i,false,asset?.name||'Añadir sonido');}),
    'subtitle-timeline':(p.subtitleCues?.length?p.subtitleCues:p.cues||[]).map((cue,i)=>item(`subtitle-${i}`,`subtitle${cue.hidden?' muted':''}`,cue.start,cue.end,cue.text,'subtitle',i,true,cue.text))
  };
  const music=assets.get(p.musicId);
  if(end)lanes['music-timeline']=[item('music',`music${music?'':' muted'}`,0,end,music?`♫ ${music.name} · ${p.settings?.musicVolume??20}%`:'♫ Añadir música','music',0,false,music?.name||'Añadir música')];
  return {scale:pixels,width:64+laneWidth,laneWidth,duration:end,lanes,ticks:Array.from({length:Math.floor(end/tickSeconds)+1},(_,i)=>({time:i*tickSeconds,left:64+i*tickSeconds*pixels}))};
}
