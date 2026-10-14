import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';

const root=resolve(import.meta.dirname,'..');

test('media session has one Redux state and the storyboard renders only one asset selector',async()=>{
  const temp=await mkdtemp(join(root,'node_modules','.media-test-'));
  try{
    for(const name of ['studio-ui','media'])await build({entryPoints:[join(root,'ui',`${name}.jsx`)],bundle:true,packages:'external',platform:'node',format:'esm',jsx:'automatic',outfile:join(temp,`${name}.mjs`)});
    const session=await import(pathToFileURL(join(temp,'studio-ui.mjs')).href);
    assert.equal(session.getMediaSession().provider,'storyblocks');
    session.patchMediaSession({provider:'pexels',activeScene:4,query:'rice field'});
    assert.deepEqual([session.getMediaSession().provider,session.getMediaSession().activeScene,session.getMediaSession().query],['pexels',4,'rice field']);

    const {MediaBoard,MediaPagination,AssetTarget,YoutubeSources,AutofillControls,AutofillReviewButton}=await import(pathToFileURL(join(temp,'media.mjs')).href);
    const rows=Array.from({length:15},(_,index)=>({index,start:index,end:index+1,cueStart:index,cueEnd:index,text:`Bloque ${index}`,searchTerm:'',chapter:'',assetId:'',asset:null}));
    const assets=Array.from({length:666},(_,index)=>({id:`asset-${index}`,name:`Asset ${index}`}));
    const store=configureStore({reducer:()=>({studioUi:{mediaBoard:{hasScenes:true,projectId:'test',rows,assets,active:0,provider:'pexels',type:'photos',query:'rice'},mediaStock:{searched:true,provider:'pexels',items:Array.from({length:5},(_,index)=>({index,name:`Resultado ${index}`})),page:0,target:0,previous:false,next:true}}})});
    const html=renderToStaticMarkup(React.createElement(Provider,{store},React.createElement(MediaBoard,{actions:{}})));
    assert.equal((html.match(/class="media-scene /g)||[]).length,15);
    assert.equal((html.match(/<option value="asset-/g)||[]).length,666);
    assert.equal((html.match(/class="stock-card"/g)||[]).length,5);
    const paginationStore=configureStore({reducer:()=>({studioUi:{mediaPagination:{media:{pages:45,current:1,total:666}}}})});
    const pagination=renderToStaticMarkup(React.createElement(Provider,{store:paginationStore},React.createElement(MediaPagination,{kind:'media',actions:{}})));
    assert.match(pagination,/16–30 de 666/);
    assert.equal((pagination.match(/<button/g)||[]).length,7);
    const targetStore=configureStore({reducer:()=>({studioUi:{mediaTarget:{selected:0,scenes:[{index:0,cueStart:0,cueEnd:1},{index:1,cueStart:2,cueEnd:2}]}}})});
    const target=renderToStaticMarkup(React.createElement(Provider,{store:targetStore},React.createElement(AssetTarget,{actions:{}})));
    assert.match(target,/<option value="0" selected="">Asset 1 · bloques 1–2<\/option>/);
    assert.match(target,/<option value="1">Asset 2 · bloques 3–3<\/option>/);
    const youtubeStore=configureStore({reducer:()=>({studioUi:{youtubeSources:{projectId:'project-1',json:'[{"name":"Capítulo 1","urls":["https://youtu.be/example"]}]'}}})});
    const youtube=renderToStaticMarkup(React.createElement(Provider,{store:youtubeStore},React.createElement(YoutubeSources,{actions:{}})));
    assert.match(youtube,/Capítulo 1/);
    assert.match(youtube,/Descargar y segmentar/);
    assert.doesNotMatch(youtube,/class="primary" disabled/);
    const autofillStore=configureStore({reducer:()=>({studioUi:{mediaAutofill:{projectId:'project-1',sceneCount:6,entries:[{type:'photos',provider:'google'},{type:'videos',provider:'pexels'}],start:3,running:false,remaining:2,missingOnly:true,requirements:'Agrega la clave de Pexels',canRun:false},autofillProgress:{visible:true,percent:40,status:'Procesando escena 3'}}})});
    const autofill=renderToStaticMarkup(React.createElement(Provider,{store:autofillStore},React.createElement(AutofillControls,{actions:{}})));
    assert.match(autofill,/value="3"/);
    assert.match(autofill,/Imagen · Google Images/);
    assert.match(autofill,/Video · Pexels/);
    assert.match(autofill,/id="autofill-run" type="button" disabled=""/);
    assert.match(autofill,/width:40%/);
    const review=renderToStaticMarkup(React.createElement(Provider,{store:autofillStore},React.createElement(AutofillReviewButton,{actions:{}})));
    assert.match(review,/Mostrar storyboard completo/);
  }finally{await rm(temp,{recursive:true,force:true});}
});
