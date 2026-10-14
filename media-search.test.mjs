import test from 'node:test';
import assert from 'node:assert/strict';
import {createStockSearch} from './media-search.mjs';

function setup(service,session={}){
  const state={provider:'pexels',type:'photos',query:'rice',searched:false,pexelsPage:0,storyblocksPage:0,googlePage:0,...session},notices=[],timers=[];
  const search=createStockSearch({service,getSession:()=>state,patchSession:patch=>Object.assign(state,patch),onChange(){},notice:(message,bad)=>notices.push([message,bad]),isCurrentProject:id=>id==='project-1',schedule:fn=>timers.push(fn)});
  return {search,state,notices,timers};
}
const photos=(from,count)=>Array.from({length:count},(_,index)=>({id:from+index,name:`Foto ${from+index}`,type:'photo',source:`pexels:${from+index}`}));

test('Pexels pages fetch the next batch only after the loaded results run out',async()=>{
  const batches=[];
  const {search,state}=setup({async searchPexels({page}){batches.push(page);return {items:photos((page-1)*8,8),hasNext:page<3};}});
  await search.run('project-1',0);
  const project={assets:[{id:'asset-3',source:'pexels:3'}],scenes:[{assetId:'asset-3'}]};
  let view=search.view(project,0);
  assert.deepEqual([view.items.length,view.previous,view.next,view.items[3].assigned],[5,false,true,true]);
  await search.page('project-1',1);
  assert.deepEqual([state.pexelsPage,batches],[1,[1]]);
  await search.page('project-1',1);
  assert.deepEqual([state.pexelsPage,batches],[2,[1,2]]);
  view=search.view(project,0);
  assert.deepEqual(view.items.map(item=>item.index),[10,11,12,13,14]);
});

test('page clicks during a batch download do not overwrite the page being loaded',async()=>{
  let release;
  const {search,state}=setup({searchPexels:({page})=>page===1?{items:photos(0,8),hasNext:true}:new Promise(resolve=>{release=()=>resolve({items:photos(8,8),hasNext:false});})});
  await search.run('project-1',0);
  await search.page('project-1',1);
  const loading=search.page('project-1',1);
  await search.page('project-1',-1);
  assert.equal(state.pexelsPage,1);
  release();await loading;
  assert.equal(state.pexelsPage,2);
});

test('a previous page download does not block paging after a new search',async()=>{
  let release;
  let oldBatch=false;
  const {search,state}=setup({searchPexels:({query,page})=>{
    if(query==='old'&&page===2)return new Promise(resolve=>{release=()=>resolve({items:photos(8,8),hasNext:false});});
    return {items:photos(query==='old'?0:20,8),hasNext:true};
  }});
  state.query='old';await search.run('project-1',0);await search.page('project-1',1);
  const stale=search.page('project-1',1).then(()=>{oldBatch=true;});
  state.query='new';await search.run('project-1',0);
  await search.page('project-1',1);
  assert.equal(state.pexelsPage,1);
  release();await stale;
  assert.equal(oldBatch,true);
  assert.equal(search.item('pexels',0).id,20);
});

test('a reset drops responses from searches started for the previous scene',async()=>{
  let release;
  const {search,state}=setup({searchPexels:()=>new Promise(resolve=>{release=resolve;})});
  const pending=search.run('project-1',0);
  search.reset();
  release({items:photos(0,5),hasNext:false});
  await pending;
  assert.equal(state.searched,false);
  assert.equal(search.item('pexels',0),undefined);
});

test('a second search ignores a slower response from the first query',async()=>{
  let release;
  const {search,state}=setup({searchPexels:({query})=>query==='old'?new Promise(resolve=>{release=()=>resolve({items:photos(0,5),hasNext:false});}):{items:photos(10,5),hasNext:false}});
  state.query='old';const first=search.run('project-1',0);
  state.query='new';await search.run('project-1',0);
  release();await first;
  assert.equal(search.item('pexels',0).id,10);
  assert.equal(state.searched,true);
});

test('Google jobs stop polling once the job is done and report empty results',async()=>{
  const {search,state,notices,timers}=setup({
    async queueGoogleSearch(body){assert.deepEqual(body,{projectId:'project-1',query:'rice',sceneIndex:4});return {id:'job-1'};},
    getGoogleJob:async()=>({status:'done',items:[],rejected:['Texto 40%'],detail:'Listo'})
  },{provider:'google'});
  await search.run('project-1',4);
  assert.equal(search.view({assets:[],scenes:[]},4).status,'queued');
  assert.equal(timers.length,1);
  await timers.shift()();
  assert.deepEqual([timers.length,search.view({assets:[],scenes:[]},4).status,state.searched],[0,'done',true]);
  assert.deepEqual(notices,[['No hubo imágenes aptas. Texto 40%',true]]);
});

test('an empty search term is rejected before calling the provider',async()=>{
  const {search}=setup({searchPexels(){throw Error('should not be called');}},{query:'  '});
  await assert.rejects(search.run('project-1',0),/Escribe un término/);
});
