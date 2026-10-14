import {mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';

const root=resolve(import.meta.dirname),temp=await mkdtemp(join(root,'node_modules','.timeline-bench-'));
try{
  await build({entryPoints:[join(root,'ui','editor.jsx')],bundle:true,packages:'external',platform:'node',format:'esm',jsx:'automatic',outfile:join(temp,'editor.mjs')});
  const {TimelineLane,TimelineRuler,TimelineView}=await import(pathToFileURL(join(temp,'editor.mjs')).href);
  const ids=['text-timeline','timeline','effect-timeline','transition-timeline','subtitle-timeline','music-timeline','sfx-timeline','audio-timeline'];
  const sceneCount=666,scale=18,duration=sceneCount*4;
  const items=Array.from({length:sceneCount},(_,index)=>({key:`scene-${index}`,kind:'video',start:index*4,end:(index+1)*4,label:`Escena ${index+1}`,selectType:'scene',selectIndex:index}));
  const lanes=Object.fromEntries(ids.map(id=>[id,id==='music-timeline'?[{key:'music',kind:'music',start:0,end:duration,label:'Música',selectType:'music',selectIndex:0}]:items.map(item=>({...item,key:`${id}-${item.key}`}))]));
  const view={scale,width:64+duration*scale,laneWidth:duration*scale,duration,lanes,ticks:Array.from({length:Math.ceil(duration/5)},(_,index)=>({time:index*5,left:64+index*5*scale}))};
  const store=configureStore({reducer:()=>({studioUi:{editorTimeline:view,previewControls:{time:0}}})});
  const wrap=element=>React.createElement(Provider,{store},element);
  const full=()=>ids.map(lane=>renderToStaticMarkup(wrap(React.createElement(TimelineLane,{lane})))).join('')+renderToStaticMarkup(wrap(React.createElement(TimelineRuler)));
  const windowed=()=>renderToStaticMarkup(wrap(React.createElement(TimelineView,{actions:{}})));
  const measure=render=>{const times=[];let html='';for(let i=0;i<6;i++){const start=performance.now();html=render();if(i)times.push(performance.now()-start);}times.sort((a,b)=>a-b);return {ms:times[2],blocks:(html.match(/class="timeline-block /g)||[]).length,ticks:(html.match(/class="timeline-tick"/g)||[]).length};};
  const all=measure(full),visible=measure(windowed);
  process.stdout.write(`666 escenas × 7 pistas; SSR local, mediana de 5 renders\nCompleto: ${all.blocks} bloques, ${all.ticks} marcas, ${all.ms.toFixed(1)} ms\nVisible: ${visible.blocks} bloques, ${visible.ticks} marcas, ${visible.ms.toFixed(1)} ms\n`);
}finally{await rm(temp,{recursive:true,force:true});}
