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

test('one inspector root shows only the selected panel with its heading and time',async()=>{
  const projectRoot=resolve(import.meta.dirname,'..'),temp=await mkdtemp(join(projectRoot,'node_modules','.editor-inspector-test-'));
  try{
    await build({entryPoints:[join(projectRoot,'ui','editor-inspector-panel.jsx')],bundle:true,packages:'external',platform:'node',format:'esm',jsx:'automatic',outfile:join(temp,'inspector.mjs')});
    const {EditorInspectorPanel}=await import(pathToFileURL(join(temp,'inspector.mjs')).href);
    const render=studioUi=>renderToStaticMarkup(React.createElement(Provider,{store:configureStore({reducer:()=>({studioUi})})},React.createElement(EditorInspectorPanel,{actions:{empty:{},scene:{},sceneExtras:{},inspector:{}}})));
    const empty=render({editorSelection:null});
    assert.match(empty,/id="inspector-empty"/);
    assert.match(empty,/PROPIEDADES/);
    const scene=render({editorSelection:{type:'scene',heading:'TOMA',time:'00:01.000–00:03.000'},editorScene:{projectId:'p',index:0,scene:{start:1,end:3,assetId:null},asset:null,assets:[],zoomPercent:10},editorSceneExtras:{index:0,scene:{},assets:[],overrideMode:false}});
    assert.match(scene,/id="inspector-scene"/);
    assert.match(scene,/00:01.000–00:03.000/);
    assert.match(scene,/Biblioteca visual/);
    assert.match(scene,/Guardar toma/);
    assert.doesNotMatch(scene,/id="inspector-text"/);
    const transition=render({editorSelection:{type:'transition',heading:'TRANSICIÓN',time:'00:03.000'},editorInspector:{type:'transition',index:0,cut:3,transition:'fade',duration:0.5}});
    assert.match(transition,/id="inspector-transition"/);
    assert.match(transition,/TRANSICIÓN/);
    assert.doesNotMatch(transition,/id="inspector-scene"/);
  }finally{await rm(temp,{recursive:true,force:true});}
});
