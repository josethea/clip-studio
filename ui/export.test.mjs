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
import {exportView} from '../export-view.mjs';

const project=()=>({id:'p1',title:'Prueba',cues:[{start:0,end:4}],scenes:[{start:0,end:4,assetId:'image'}],assets:[{id:'image',name:'Imagen',type:'image',width:1376,height:768}],settings:{ratio:'16:9',quality:'1080p',exportQuality:'high'},exports:[{name:'video.mp4',duration:4,width:1920,height:1080,renderDurationMs:123000}]});

test('export validation reports missing assets, resolution and completed video',()=>{
  const valid=exportView(project());
  assert.deepEqual(valid.problems,[]);
  assert.match(valid.resolutionNote,/1 de 1 medios visuales usados tienen menos de 1920×1080/);
  assert.equal(valid.ready.name,'video.mp4');
  const missing=project();missing.scenes[0].assetId='lost';
  assert.deepEqual(exportView(missing).problems,['1 escenas sin asset']);
  assert.deepEqual(exportView(null).problems,['Crea o abre un proyecto']);
});

test('React export page shows progress, downloads and a disabled invalid render',async()=>{
  const root=resolve(import.meta.dirname,'..'),temp=await mkdtemp(join(root,'node_modules','.export-test-'));
  try{
    await build({entryPoints:[join(root,'ui','export.jsx')],bundle:true,packages:'external',platform:'node',format:'esm',jsx:'automatic',outfile:join(temp,'export.mjs')});
    const {ExportPage}=await import(pathToFileURL(join(temp,'export.mjs')).href);
    const render=(view,progress)=>renderToStaticMarkup(React.createElement(Provider,{store:configureStore({reducer:()=>({studioUi:{exportView:view,exportProgress:progress}})})},React.createElement(ExportPage,{actions:{}})));
    const ready=render(exportView(project()),{mp4:'',running:false,capcut:'',capcutRunning:false,capcutResult:null});
    assert.match(ready,/Tiempo total de exportación: <strong>00:02:03<\/strong>/);
    assert.match(ready,/download="Prueba.mp4"/);
    const running=render(exportView(project()),{mp4:'50% · Renderizando',running:true,capcut:'',capcutRunning:false,capcutResult:null});
    assert.match(running,/50% · Renderizando/);
    assert.doesNotMatch(running,/Video listo · Tiempo total/);
    const invalid=render(exportView(null),{mp4:'',running:false,capcut:'',capcutRunning:false,capcutResult:null});
    assert.match(invalid,/Crea o abre un proyecto/);
    assert.match(invalid,/Exportar MP4<\/button>/);
    assert.match(invalid,/disabled=""[^>]*>Exportar MP4/);
  }finally{await rm(temp,{recursive:true,force:true});}
});
