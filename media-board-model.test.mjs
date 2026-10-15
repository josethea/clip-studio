import test from 'node:test';
import assert from 'node:assert/strict';
import {missingMediaIndices,mediaBoardView,nextMissingScene,pagination,sceneSearchTerm,saveAutofillSource,removeAutofillSource} from './media-board-model.mjs';

test('storyboard missing view paginates only unresolved scenes and retains their chapter and cue range',()=>{
  const project={id:'p',assets:[{id:'a',name:'Foto',type:'image'}],chapters:[{id:7,name:'Capítulo 7'}],scenes:Array.from({length:36},(_,index)=>({start:index,end:index+1,text:`Bloque ${index+1}`,searchTerm:`Término ${index+1}`,cueStart:index*2,cueEnd:index*2+1,chapterId:7,assetId:index%3===0?'a':null}))};
  const missing=missingMediaIndices(project);
  assert.equal(missing.length,24);
  assert.equal(nextMissingScene(project,0),1);
  assert.equal(nextMissingScene(project,36),36);
  const view=mediaBoardView(project,{missingOnly:true,activeScene:0,assetTargetScene:999,query:'',provider:'pexels',type:'photos'},1);
  assert.deepEqual(view.page,{pages:2,current:1,total:24});
  assert.equal(view.active,1);
  assert.equal(view.target,null);
  assert.equal(view.rows.length,9);
  assert.equal(view.rows[0].index,23);
  assert.equal(view.rows[0].cueStart,46);
  assert.equal(view.rows[0].chapter,'Capítulo 7');
  assert.equal(view.query,'Término 2');
  assert.equal(view.visualAssets.length,1);
});

test('a completed storyboard exits missing-only mode and clamps its page',()=>{
  const project={scenes:[{start:0,end:1,assetId:'a'}],assets:[{id:'a',name:'Image',type:'image'}],chapters:[]};
  const view=mediaBoardView(project,{missingOnly:true,activeScene:7,assetTargetScene:0,query:''},20);
  assert.equal(view.missingOnly,false);
  assert.equal(view.active,0);
  assert.deepEqual(view.page,{pages:1,current:0,total:1});
  assert.deepEqual(view.missingItems,[]);
  assert.equal(view.rows[0].asset.name,'Image');
  assert.deepEqual(pagination(0,100),{pages:0,current:0,total:0});
  assert.equal(sceneSearchTerm({text:'  '.padEnd(170,'a')}).length,160);
});

test('autofill sources can be added, edited and removed when Redux froze the previous list',()=>{
  const first=Object.freeze({type:'photos',provider:'google'});
  const previous=Object.freeze([first]);
  const added=saveAutofillSource(previous,{index:-1,type:'videos',provider:'pexels'});
  assert.deepEqual(added,[first,{type:'videos',provider:'pexels'}]);
  assert.notEqual(added,previous);
  assert.notEqual(added[0],first);
  const edited=saveAutofillSource(Object.freeze(added),{index:0,type:'photos',provider:'storyblocks'});
  assert.deepEqual(edited,[{type:'photos',provider:'storyblocks'},{type:'videos',provider:'pexels'}]);
  const removed=removeAutofillSource(Object.freeze(edited),1);
  assert.deepEqual(removed,[{type:'photos',provider:'storyblocks'}]);
  assert.deepEqual(previous,[first]);
});
