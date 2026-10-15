import {effectiveScene,transitionLabels} from './studio-core.mjs';

const fmt=value=>{const n=Number(value)||0;return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}.${String(Math.round(n%1*1000)).padStart(3,'0')}`;};
export const transitionIcons={'remotion:none':'Ⅱ','remotion:fade':'◐','remotion:slide:right':'←','remotion:slide:left':'→','remotion:wipe:left':'◧','remotion:fade-black':'●'};

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
    'timeline':scenes.flatMap((scene,i)=>[item(`scene-${i}`,'video',scene.start,scene.end,`${i+1} · ${assets.get(scene.assetId)?.name||'Sin medio'}`,'scene',i,false,`${fmt(scene.start)}–${fmt(scene.end)} · ${scene.text}`),...(i<scenes.length-1?[
      {key:`boundary-${i}`,boundary:i,start:scene.end},
      {...item(`transition-${i}`,'transition',scene.end,scene.end,transitionIcons[scene.transition]||'◈','transition',i,false,`Tomas ${i+1} → ${i+2} · ${transitionLabels[scene.transition]||scene.transition} · ${Number(scene.transitionDuration||0).toFixed(2)} s`),icon:true}
    ]:[])]),
    'effect-timeline':[],
    'audio-timeline':(p.cues||[]).flatMap((cue,i)=>[item(`voice-${i}`,'voice',cue.start,cue.end,`▥ ${i+1}`,'voice',i,false,cue.text),...(i<p.cues.length-1&&p.cues[i+1].start>cue.end?[item(`gap-${i}`,'gap',cue.end,p.cues[i+1].start,`${Math.round((p.cues[i+1].start-cue.end)*1000)} ms`,null,null,false,'Pausa')]:[])]),
    'music-timeline':[],
    'subtitle-timeline':p.settings?.captions===false?[]:(p.subtitleCues?.length?p.subtitleCues:p.cues||[]).map((cue,i)=>item(`subtitle-${i}`,`subtitle${cue.hidden?' muted':''}`,cue.start,cue.end,cue.text,'subtitle',i,true,cue.text))
  };
  const music=assets.get(p.musicId);
  if(end&&music)lanes['music-timeline']=[item('music','music',0,end,`♫ ${music.name} · ${p.settings?.musicVolume??20}%`,'music',0,false,music.name)];
  return {scale:pixels,width:64+laneWidth,laneWidth,duration:end,showSubtitles:p.settings?.captions!==false,lanes,ticks:Array.from({length:Math.floor(end/tickSeconds)+1},(_,i)=>({time:i*tickSeconds,left:64+i*tickSeconds*pixels}))};
}
