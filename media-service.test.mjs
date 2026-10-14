import test from 'node:test';
import assert from 'node:assert/strict';
import {createMediaService} from './media-service.mjs';

test('manual searches and imports send provider-specific fields and current credentials',async()=>{
  const calls=[],keys={pexels:'pexels-a',storyblocksPublic:'public-a',storyblocksSecret:'secret-a'};
  const api=async(path,options)=>{calls.push({path,body:options?JSON.parse(options.body):null});return {id:'asset-1'};};
  const media=createMediaService(api,key=>keys[key]);
  await media.searchPexels({query:'rice',type:'videos',page:2});
  await media.searchStoryblocks({projectId:'project-1',query:'rice',type:'photos',page:3});
  await media.importStock({projectId:'project-1',provider:'pexels',item:{id:4,type:'video',source:'pexels:4'},sceneIndex:5});
  keys.storyblocksSecret='secret-b';
  await media.importStock({projectId:'project-1',provider:'storyblocks',item:{id:'stock-3',name:'Rice',type:'video',duration:8},sceneIndex:5});
  assert.deepEqual(calls, [
    {path:'/pexels',body:{apiKey:'pexels-a',query:'rice',type:'videos',page:2}},
    {path:'/storyblocks',body:{publicKey:'public-a',secretKey:'secret-a',query:'rice',type:'photos',projectId:'project-1',page:3}},
    {path:'/projects/project-1/pexels-import',body:{id:4,type:'video',source:'pexels:4',sceneIndex:5}},
    {path:'/projects/project-1/storyblocks-import',body:{stockId:'stock-3',name:'Rice',type:'video',sceneIndex:5,duration:8,publicKey:'public-a',secretKey:'secret-b'}}
  ]);
});

test('Google job and automatic sequence use the scene and project being edited',async()=>{
  const calls=[];
  const api=async(path,options)=>{calls.push({path,body:options?JSON.parse(options.body):null});return {};};
  const media=createMediaService(api,key=>({pexels:'p',storyblocksPublic:'s',storyblocksSecret:'t'})[key]);
  await media.queueGoogleSearch({projectId:'project-2',query:'old rice',sceneIndex:6});
  await media.getGoogleJob('project-2','job-1');
  await media.importGoogle({projectId:'project-2',jobId:'job-1',candidateId:'image-1',sceneIndex:6});
  await media.startAutofill({projectId:'project-2',startIndex:7,sequence:[{type:'photos',provider:'google'}]});
  assert.deepEqual(calls,[
    {path:'/projects/project-2/google-search',body:{query:'old rice',sceneIndex:6}},
    {path:'/projects/project-2/google-jobs/job-1',body:null},
    {path:'/projects/project-2/google-import',body:{jobId:'job-1',candidateId:'image-1',sceneIndex:6}},
    {path:'/projects/project-2/autofill-sequence',body:{startIndex:7,sequence:[{type:'photos',provider:'google'}],pexelsKey:'p',storyblocksPublic:'s',storyblocksSecret:'t'}}
  ]);
});
