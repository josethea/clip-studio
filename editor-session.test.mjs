import test from 'node:test';
import assert from 'node:assert/strict';
import {createEditorSession} from './editor-session.mjs';

const project=(id='one')=>({id,scenes:[{start:0,end:2}],textLayers:[],subtitleCues:[],settings:{ratio:'16:9'},narrationId:null,musicId:null});

test('undo and redo restore editable data and clear redo after another edit',()=>{
  let current=project();const history=[];
  const session=createEditorSession({getProject:()=>current,write:async()=>{},onHistory:value=>history.push(value),delay:60000});
  session.remember();current.scenes[0].end=3;
  assert.equal(session.undo(),true);assert.equal(current.scenes[0].end,2);
  assert.equal(session.redo(),true);assert.equal(current.scenes[0].end,3);
  session.undo();session.remember();current.scenes[0].end=4;
  assert.equal(session.redo(),false);
  assert.deepEqual(history.at(-1),{canUndo:true,canRedo:false});
  session.reset();assert.deepEqual(session.history(),{canUndo:false,canRedo:false});
});

test('a save completed after another edit keeps the newer revision pending',async()=>{
  let current=project(),resolveFirst;const writes=[],statuses=[];
  const session=createEditorSession({getProject:()=>current,write:(id,payload)=>{writes.push({id,payload});return writes.length===1?new Promise(resolve=>{resolveFirst=resolve;}):Promise.resolve(payload);},onStatus:value=>statuses.push(value),delay:60000});
  current.scenes[0].end=3;session.markDirty();const first=session.flush();
  current.scenes[0].end=4;session.markDirty();resolveFirst(writes[0].payload);await first;
  assert.equal(session.pending,true);
  assert.notEqual(statuses.at(-1),'Cambios guardados');
  await session.flush();
  assert.equal(writes[1].payload.scenes[0].end,4);
  assert.equal(session.pending,false);
  session.reset();
});

test('switching projects clears history and ignores a previous save result',async()=>{
  let current=project(),resolveOld;const statuses=[];
  const session=createEditorSession({getProject:()=>current,write:()=>new Promise(resolve=>{resolveOld=resolve;}),onStatus:value=>statuses.push(value),delay:60000});
  session.remember();const saving=session.flush();
  current=project('two');session.reset();resolveOld({id:'one'});await saving;
  assert.deepEqual(session.history(),{canUndo:false,canRedo:false});
  assert.notEqual(statuses.at(-1),'Cambios guardados');
});

test('manual saves wait for an automatic save and send the latest project',async()=>{
  let current=project(),resolveFirst;const writes=[];
  const session=createEditorSession({getProject:()=>current,write:(id,payload)=>{writes.push(payload);return writes.length===1?new Promise(resolve=>{resolveFirst=resolve;}):Promise.resolve(payload);},delay:60000});
  current.scenes[0].end=3;session.markDirty();const automatic=session.flush();
  current.scenes[0].end=4;session.markDirty();const manual=session.flush(true);
  assert.equal(writes.length,1);
  resolveFirst(writes[0]);await automatic;await manual;
  assert.equal(writes.length,2);
  assert.equal(writes[1].scenes[0].end,4);
  session.reset();
});
