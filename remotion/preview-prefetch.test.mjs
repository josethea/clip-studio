import test from 'node:test';
import assert from 'node:assert/strict';
import {createPreviewPrefetch} from './preview-prefetch.mjs';

const project={preview:true,scenes:[0,2,4,6,8].map((start,i)=>({start,assetId:`asset-${i}`})),assets:[0,1,2,3,4].map(i=>({id:`asset-${i}`,type:'video',url:`/asset-${i}?editorPreview=1`}))};
const tick=()=>new Promise(resolve=>setTimeout(resolve,12));

test('only nearby optimized clips are prefetched and released when seeking away',async()=>{
  const requested=[],cached=[],freed=[];
  const manager=createPreviewPrefetch({delay:0,
    request:async url=>{requested.push(url);return {ok:true,headers:{get:()=>url.includes('asset-1')?'original-optimizing':'optimized'}};},
    prefetch:url=>{cached.push(url);return {free:()=>freed.push(url),waitUntilDone:()=>Promise.resolve()};}
  });
  manager.warm(project,0);await tick();
  assert.deepEqual(requested,['/asset-0?editorPreview=1','/asset-1?editorPreview=1']);
  assert.deepEqual(cached,['/asset-0?editorPreview=1']);
  manager.warm(project,8*30);await tick();
  assert.deepEqual(cached.slice(1),['/asset-3?editorPreview=1','/asset-4?editorPreview=1']);
  assert.deepEqual(freed,['/asset-0?editorPreview=1']);
  manager.clear();
  assert.equal(manager.size,0);
  assert.deepEqual(freed.sort(),cached.sort());
});

test('clearing a project prevents pending requests from caching its clips',async()=>{
  let resolveRequest;
  const cached=[];
  const manager=createPreviewPrefetch({delay:0,request:()=>new Promise(resolve=>{resolveRequest=resolve;}),prefetch:url=>{cached.push(url);return {free(){},waitUntilDone:()=>Promise.resolve()};}});
  manager.warm({...project,scenes:project.scenes.slice(0,1)},0);await tick();
  manager.clear();
  resolveRequest({ok:true,headers:{get:()=> 'optimized'}});await tick();
  assert.deepEqual(cached,[]);
});
