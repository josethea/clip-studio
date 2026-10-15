import React from 'react';
import {createRoot} from 'react-dom/client';
import {Player} from '@remotion/player';
import {StudioComposition} from './composition.jsx';

const node=document.getElementById('remotion-preview');
const root=createRoot(node);
let ref=null,currentProject=null,lastFrame=-1,attachedRef=null,waitingSince=null;
const diagnostics={waiting:0,resume:0,bufferingMs:0};
const onWaiting=()=>{if(waitingSince!==null)return;waitingSince=performance.now();diagnostics.waiting++;window.dispatchEvent(new CustomEvent('clip-studio-player-buffering',{detail:{buffering:true}}));};
const onResume=()=>{if(waitingSince!==null){diagnostics.bufferingMs+=performance.now()-waitingSince;waitingSince=null;}diagnostics.resume++;window.dispatchEvent(new CustomEvent('clip-studio-player-buffering',{detail:{buffering:false}}));};
function attach(next){
  if(next===attachedRef)return;
  attachedRef?.removeEventListener('waiting',onWaiting);
  attachedRef?.removeEventListener('resume',onResume);
  attachedRef=next;
  next?.addEventListener('waiting',onWaiting);
  next?.addEventListener('resume',onResume);
}
function mount(project,frame=0,playing=false){
  currentProject=project;
  root.render(<Player ref={r=>{attach(r);ref=r;if(r&&lastFrame!==frame){r.seekTo(frame);lastFrame=frame;}if(r&&playing)r.play();}} component={StudioComposition} inputProps={{project}} compositionWidth={project.width} compositionHeight={project.height} fps={30} durationInFrames={Math.max(1,Math.ceil(project.duration*30))} style={{width:'100%',height:'100%'}} autoPlay={false} initiallyMuted={false}/>);
}
window.clipStudioPlayer={
  mount,
  update:project=>{const frame=ref?.getCurrentFrame()||lastFrame||0,playing=ref?.isPlaying()||false;mount(project,frame,playing);},
  play:()=>ref?.play(),pause:()=>ref?.pause(),seek:frame=>{lastFrame=frame;ref?.seekTo(frame);},
  frame:()=>ref?.getCurrentFrame()??null,
  playing:()=>ref?.isPlaying()||false,
  buffering:()=>waitingSince!==null,
  get diagnostics(){return {...diagnostics,buffering:waitingSince!==null};},
  ready:()=>!!ref,
  subscribe:callback=>ref?.addEventListener('frameupdate',callback),
  unsubscribe:callback=>ref?.removeEventListener('frameupdate',callback),
  unmount:()=>{attach(null);root.render(null);ref=null;currentProject=null;lastFrame=-1;waitingSince=null;}
};
