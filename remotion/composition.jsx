import React from 'react';
import {AbsoluteFill, Html5Audio, Html5Video, Img, OffthreadVideo, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {sceneTransitionFramePlan} from './transition-timing.mjs';
import {TransitionSeries, linearTiming} from '@remotion/transitions';
import {transitionPresentation} from './transition-presentations.jsx';
import {FontFaces} from './fonts.jsx';

const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,n));
const titleWeight=font=>font==='Anton'?400:font==='IBM Plex Mono'||font==='Courier Prime'?700:900;
const effects={
  warm:'saturate(1.15) sepia(.12)',cool:'saturate(1.08) hue-rotate(8deg)',mono:'grayscale(1)',
  vivid:'saturate(1.45) contrast(1.1)',vintage:'sepia(.34) saturate(.72)',contrast:'contrast(1.3)',
  soft:'blur(1.4px) contrast(.94)',fade:'saturate(.78) contrast(.88) brightness(1.05)',
  green:'hue-rotate(12deg) saturate(1.08)',purple:'hue-rotate(320deg) saturate(1.12)'
};
function motionStyle(scene,progress){
  const p=clamp(progress),zoom=1+clamp(Number(scene.zoomPercent)||10,2,40)/100;
  switch(scene.motion){
    case 'zoom-in':return {transform:`scale(${1+(zoom-1)*p})`};
    case 'zoom-out':return {transform:`scale(${zoom-(zoom-1)*p})`};
    case 'pan-left':return {transform:`scale(${zoom}) translateX(${(1-2*p)*4}%)`};
    case 'pan-right':return {transform:`scale(${zoom}) translateX(${(2*p-1)*4}%)`};
    case 'pan-up':return {transform:`scale(${zoom}) translateY(${(1-2*p)*4}%)`};
    case 'pan-down':return {transform:`scale(${zoom}) translateY(${(2*p-1)*4}%)`};
    case 'pulse':return {transform:`scale(${1+(zoom-1)*(1-Math.cos(2*Math.PI*p))/2})`};
    default:return {};
  }
}
function Media({asset,scene,style}){
  if(!asset)return null;
  if(asset.type==='image')return <Img src={asset.url} style={style} delayRenderTimeoutInMilliseconds={90000} delayRenderRetries={2}/>;
  const props={src:asset.url,muted:true,trimBefore:Math.max(0,Math.round((Number(scene.sourceStart)||0)*30)),style,delayRenderTimeoutInMilliseconds:90000,delayRenderRetries:2};
  return asset.offthread?<OffthreadVideo {...props}/>:<Html5Video {...props} loop/>;
}
function SceneLayer({scene,assets,time}){
  const asset=assets[scene.assetId],length=Math.max(.05,scene.end-scene.start),p=clamp((time-scene.start)/length);
  const common={position:'absolute',width:'100%',height:'100%',objectFit:scene.fit==='fill'?'cover':'contain',...motionStyle(scene,p)};
  const blurredBackground=scene.fit==='blur'||scene.fit==='frame';
  const dim=clamp(Number(scene.blurOpacity||0)/100,0,.8);
  const overlay=assets[scene.overlayId],overlayStart=scene.start+(Number(scene.overlayStart)||0),overlayEnd=overlayStart+(Number(scene.overlayDuration)||length);
  const positions={center:{left:'50%',top:'50%',transform:'translate(-50%,-50%)'},'top-left':{left:'4%',top:'4%'},'top-right':{right:'4%',top:'4%'},'bottom-left':{left:'4%',bottom:'4%'},'bottom-right':{right:'4%',bottom:'4%'}};
  const entrance=clamp((time-overlayStart)/.3);
  return <AbsoluteFill style={{overflow:'hidden',background:'#08080a'}}>
    <AbsoluteFill style={{filter:effects[scene.effect]||'none'}}>
      {blurredBackground&&asset&&<><Media asset={asset} scene={scene} style={{...common,objectFit:'cover',filter:`blur(${Math.max(2,Number(scene.blur)||20)}px) brightness(${1-dim/2})`,transform:`scale(1.08) ${common.transform||''}`}}/><AbsoluteFill style={{background:`rgba(0,0,0,${dim/2})`}}/></>}
      {scene.fit==='frame'?<AbsoluteFill style={{padding:'5%',display:'grid',placeItems:'center'}}><div style={{position:'relative',width:'100%',height:'100%',overflow:'hidden'}}><Media asset={asset} scene={scene} style={{...common,objectFit:'contain'}}/></div></AbsoluteFill>:<Media asset={asset} scene={scene} style={common}/>}
    </AbsoluteFill>
    {overlay?.type==='image'&&time>=overlayStart&&time<overlayEnd&&<Img src={overlay.url} delayRenderTimeoutInMilliseconds={90000} delayRenderRetries={2} style={{position:'absolute',width:`${clamp(Number(scene.overlaySize)||35,5,90)}%`,height:'auto',maxHeight:'70%',objectFit:'contain',opacity:clamp(Number(scene.overlayOpacity??100)/100)*entrance,...(positions[scene.overlayPosition]||positions.center),filter:'drop-shadow(0 8px 14px #0008)',translate:scene.overlayAnimation==='slide'?`${(1-entrance)*-12}% 0`:undefined,scale:scene.overlayAnimation==='pop'?String(.7+.3*entrance):undefined}}/>}
  </AbsoluteFill>;
}
function Caption({cue,settings,time,words}){
  if(!cue)return null;
  const colors={yellow:'#ffe36c',cyan:'#73efff',pink:'#ff83bc',green:'#8ef7ae',white:'#ffffff'},sizes={small:.026,medium:.034,large:.044,xlarge:.056};
  const color=colors[settings.captionColor]||settings.captionColor||colors.yellow;
  const accent=settings.captionAccent||'#42f578',position=settings.captionPosition||'bottom';
  const style={position:'absolute',left:'8%',right:'8%',bottom:position==='bottom'?'8%':'auto',top:position==='top'?'8%':position==='center'?'50%':'auto',transform:position==='center'?'translateY(-50%)':undefined,textAlign:'center',color,fontFamily:`"${settings.captionFont||'Inter'}", Arial, Helvetica, sans-serif`,fontSize:Math.max(28,Math.round((settings.ratio==='16:9'?1080:1920)*(sizes[settings.captionSize]||sizes.medium))),fontWeight:titleWeight(settings.captionFont||'Inter'),lineHeight:1.13,textShadow:'2px 2px 5px #000, -2px -2px 5px #000',whiteSpace:'pre-wrap',overflowWrap:'anywhere',zIndex:10};
  if(settings.captionStyle==='neon')style.textShadow=`0 0 12px ${style.color}, 0 0 25px ${style.color}, 2px 2px 4px #000`;
  if(settings.captionStyle==='tiktok'){style.background='#120c18dd';style.padding='12px 18px';style.borderRadius=12;}
  if(settings.captionStyle==='minimal'){style.fontWeight=600;style.textShadow='0 2px 6px #000';}
  const timed=(words||[]).filter(w=>w.type!=='spacing'&&Number(w.start)>=cue.start-.05&&Number(w.end)<=cue.end+.05&&String(w.text||'').trim());
  if((settings.captionStyle==='dynamic'||settings.captionStyle==='highlight')&&timed.length){return <div style={style}>{timed.map((word,i)=><span key={i} style={{color:time>=word.start&&time<word.end?accent:style.color}}>{word.text}{i<timed.length-1?' ':''}</span>)}</div>;}
  if(settings.captionStyle==='highlight'){const parts=String(cue.text||'').split(/(\s+)/);const first=parts.findIndex(part=>part.trim());return <div style={style}>{parts.map((piece,i)=><span key={i} style={{color:i===first?accent:style.color}}>{piece}</span>)}</div>;}
  return <div style={style}>{cue.text}</div>;
}
const textPositions={center:{top:'50%',left:'50%'},'center-left':{top:'50%',left:'26%'},'center-right':{top:'50%',left:'74%'},top:{top:'15%',left:'50%'},bottom:{top:'82%',left:'50%'},'top-left':{top:'16%',left:'22%'},'top-right':{top:'16%',left:'78%'},'bottom-left':{top:'82%',left:'22%'},'bottom-right':{top:'82%',left:'78%'}};
function TextLayer({layer,time,height}){
  const elapsed=time-Number(layer.start),entrance=clamp(elapsed/.3),exit=clamp((Number(layer.end)-time)/.25),phase=Math.min(entrance,exit),animation=layer.animation||'fade';
  const pos=textPositions[layer.position]||textPositions.center,highlight=String(layer.highlight||'').split(',').map(s=>s.trim()).filter(Boolean);
  const pieces=highlight.length?String(layer.text||'').split(new RegExp(`(${highlight.map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')})`,'gi')):[String(layer.text||'')];
  const color=layer.color||'#ffffff',accent=layer.accent||'#ff537e',background=clamp(Number(layer.background||0)/100);
  const style={position:'absolute',...pos,transform:`translate(-50%,-50%) ${animation==='pop'?`scale(${.78+.22*phase})`:''} ${animation==='slide'?`translateY(${(1-phase)*28}px)`:''}`,opacity:animation==='none'?1:phase,maxWidth:'78%',minWidth:layer.type==='lower-third'?'35%':undefined,textAlign:'center',whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontFamily:`"${layer.font||'Inter'}", Arial, sans-serif`,fontWeight:layer.type==='lower-third'&&layer.font!=='Anton'?700:titleWeight(layer.font||'Inter'),fontSize:Math.max(24,Math.round(height*clamp(Number(layer.size||6)/100,.02,.18))),lineHeight:1.08,color,padding:'12px 22px',background:`rgba(8,8,12,${background})`,borderRadius:layer.type==='lower-third'?8:14,textShadow:'0 3px 10px #000b',boxShadow:background?'0 12px 30px #0006':undefined,zIndex:12};
  const styled=pieces.map((piece,i)=><span key={i} style={{color:highlight.some(h=>h.toLocaleLowerCase()===piece.toLocaleLowerCase())?accent:color}}>{piece}</span>);
  const lines=String(layer.text||'').split(/\n|\|/).map(s=>s.trim()).filter(Boolean);
  let content=styled;
  if(layer.templateId==='comparison')content=<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,textAlign:'center'}}>{[lines[0]||'A',lines[1]||'B'].map((line,i)=><div key={i} style={{padding:20,border:`2px solid ${i?color:accent}`,borderRadius:12}}>{line}</div>)}</div>;
  if(layer.templateId==='list')content=<div style={{textAlign:'left'}}>{lines.map((line,i)=><div key={i} style={{margin:'10px 0'}}><span style={{color:accent,marginRight:14}}>{String(i+1).padStart(2,'0')}</span>{line}</div>)}</div>;
  if(layer.templateId==='quote')content=<div><span style={{color:accent,fontSize:'1.7em',verticalAlign:'middle'}}>“</span>{styled}<span style={{color:accent,fontSize:'1.7em',verticalAlign:'middle'}}>”</span></div>;
  if(layer.templateId==='number')content=<div><div style={{color:accent,fontSize:'1.6em'}}>{lines[0]||layer.text}</div>{lines[1]&&<div style={{fontSize:'.45em',fontWeight:600}}>{lines[1]}</div>}</div>;
  if(layer.templateId==='timeline')content=<div><div style={{height:4,background:accent,marginBottom:15,borderRadius:4}}/>{styled}</div>;
  if(layer.templateId==='location'||layer.templateId==='date'||layer.templateId==='person')content=<div style={{textAlign:'left',borderLeft:`6px solid ${accent}`,paddingLeft:18}}>{styled}</div>;
  return <div style={style}>{content}</div>;
}
export function StudioComposition({project}){
  const frame=useCurrentFrame(),{fps,width,height,durationInFrames}=useVideoConfig(),time=frame/fps,scenes=project.scenes||[],assets=Object.fromEntries((project.assets||[]).map(a=>[a.id,a])),settings=project.settings||{};
  const sceneFrames=sceneTransitionFramePlan(scenes,fps,durationInFrames);
  const cues=project.subtitleCues?.length?project.subtitleCues:project.cues||[];
  const caption=settings.captions===false?null:cues.find(c=>!c.hidden&&time>=c.start&&time<c.end);
  const narration=assets[project.narrationId],music=assets[project.musicId];
  return <AbsoluteFill style={{background:'#08080a'}}>
    {!project.audioOnly&&<><FontFaces base={project.fontBase} fonts={[settings.captionFont||'Inter',...(project.textLayers||[]).map(layer=>layer.font||'Inter')]}/>
    <TransitionSeries>{scenes.flatMap((scene,i)=>{
      const previous=i>0?sceneFrames[i-1]:null;
      const presentation=previous?.transitionFrames?transitionPresentation(scenes[i-1].transition,width,height):null;
      return [
        ...(presentation?[<TransitionSeries.Transition key={`transition-${i}`} timing={linearTiming({durationInFrames:previous.transitionFrames})} presentation={presentation}/>]:[]),
        <TransitionSeries.Sequence key={`scene-${i}`} durationInFrames={sceneFrames[i].durationInFrames}>
          <SceneLayer scene={scene} assets={assets} time={time}/>
        </TransitionSeries.Sequence>
      ];
    })}</TransitionSeries>
    <Caption cue={caption} settings={settings} time={time} words={project.words}/>
    {(project.textLayers||[]).filter(layer=>time>=layer.start&&time<layer.end).map(layer=><TextLayer key={layer.id} layer={layer} time={time} height={height}/>)}</>}
    {!project.videoOnly&&<>{narration&&<Html5Audio src={narration.url} volume={1}/>}
    {music&&<Html5Audio src={music.url} loop volume={clamp(Number(settings.musicVolume??20)/100)}/>}
    {scenes.map((scene,i)=>{const sfx=assets[scene.sfxId];if(!sfx||i===scenes.length-1)return null;const d=Math.max(.05,Number(scene.transitionDuration)||.4),shift=scene.sfxAlign==='start'?0:scene.sfxAlign==='end'?-d:-d/2,start=Math.max(0,scene.end+shift+(Number(scene.sfxOffset)||0));return <Sequence key={i} from={Math.round(start*fps)} durationInFrames={Math.max(1,Math.round(d*fps))}><Html5Audio src={sfx.url} volume={clamp(Number(scene.sfxVolume??70)/100)}/></Sequence>;})}</>}
  </AbsoluteFill>;
}
