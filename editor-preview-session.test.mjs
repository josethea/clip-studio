import test from 'node:test';
import assert from 'node:assert/strict';
import {createPreviewSession} from './editor-preview-session.mjs';

const project=()=>({id:'one',scenes:[{start:0,end:10}],assets:[],cues:[],subtitleCues:[],textLayers:[],settings:{ratio:'16:9'}});

test('preview session mounts once, updates changed compositions, and keeps playback time independent',async()=>{
  const p=project(),calls=[],transport=[];
  const player={mount:(...args)=>calls.push(['mount',...args]),update:value=>calls.push(['update',value]),seek:value=>calls.push(['seek',value]),play:()=>calls.push(['play']),pause:()=>calls.push(['pause']),unmount:()=>calls.push(['unmount']),ready:()=>true,frame:()=>60,playing:()=>true};
  const preview=createPreviewSession({getProject:()=>p,isEditorActive:()=>true,player,prepare:value=>({id:value.id,scene:value.scenes[0].end}),origin:()=>'',onTransport:view=>transport.push(view)});
  preview.refresh(true);
  preview.seek(4);
  assert.deepEqual(calls.map(call=>call[0]),['mount','seek']);
  assert.equal(preview.time,4);
  await preview.play(true);
  assert.equal(preview.playing,true);
  preview.tick();
  assert.equal(preview.time,2);
  assert.equal(transport.at(-1).time,2);
  p.scenes[0].end=12;
  preview.refresh(true);
  assert.equal(calls.filter(call=>call[0]==='update').length,1);
  preview.reset();
  assert.equal(preview.time,0);
  assert.equal(preview.playing,false);
  assert.equal(calls.at(-1)[0],'unmount');
});

test('reset cancels a pending play before it reaches the old project',async()=>{
  const p=project(),calls=[];
  let resume;
  const player={mount:()=>calls.push('mount'),update:()=>{},seek:()=>calls.push('seek'),play:()=>calls.push('play'),pause:()=>calls.push('pause'),unmount:()=>calls.push('unmount'),ready:()=>false,frame:()=>0,playing:()=>false};
  const preview=createPreviewSession({getProject:()=>p,isEditorActive:()=>true,player,prepare:()=>({}),origin:()=>'',waitReady:()=>new Promise(resolve=>{resume=resolve;})});
  const pending=preview.play(true);
  preview.reset();
  resume();
  await pending;
  assert.equal(preview.playing,false);
  assert.equal(calls.includes('play'),false);
});
