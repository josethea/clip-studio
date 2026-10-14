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

test('editor picker separates used media and scene controls show saved overlay',async()=>{
  const projectRoot=resolve(import.meta.dirname,'..'),temp=await mkdtemp(join(projectRoot,'node_modules','.editor-extras-test-'));
  try{
    await build({entryPoints:[join(projectRoot,'ui','editor-extras.jsx')],bundle:true,packages:'external',platform:'node',format:'esm',jsx:'automatic',outfile:join(temp,'extras.mjs')});
    const {pickerItems,EditorMediaPicker,SceneExtraControls,TemplatePanel}=await import(pathToFileURL(join(temp,'extras.mjs')).href);
    const picker={projectId:'project',sceneIndex:2,selectedAssetId:'used',usedIds:['used'],openToken:1,assets:[{id:'used',type:'image',name:'Imagen elegida'},{id:'other',type:'video',name:'Video adicional'},{id:'sound',type:'audio',name:'Audio'}]};
    assert.deepEqual(pickerItems(picker,'used').map(item=>item.id),['used']);
    assert.deepEqual(pickerItems(picker,'all').map(item=>item.id),['used','other']);
    const store=configureStore({reducer:()=>({studioUi:{editorMediaPicker:picker,editorSceneExtras:{index:2,scene:{overlayId:'used',overlayStart:1.5,overlayPosition:'top-left',effectOverride:'warm'},assets:[{id:'used',name:'Imagen elegida'}],overrideMode:true},editorTemplates:[{id:'headline',name:'Título',custom:false},{id:'custom-1',name:'Mi estilo',custom:true}]}})});
    const render=Component=>renderToStaticMarkup(React.createElement(Provider,{store},React.createElement(Component,{actions:{}})));
    const pickerHtml=render(EditorMediaPicker),sceneHtml=render(SceneExtraControls),templates=render(TemplatePanel);
    assert.match(pickerHtml,/Material para la toma 3/);
    assert.match(pickerHtml,/Imagen elegida/);
    assert.doesNotMatch(pickerHtml,/Video adicional|Audio/);
    assert.match(sceneHtml,/value="used" selected=""/);
    assert.match(sceneHtml,/value="top-left" selected=""/);
    assert.match(sceneHtml,/value="1.5"/);
    assert.match(sceneHtml,/value="warm" selected=""/);
    assert.match(templates,/Mi estilo/);
    assert.match(templates,/Eliminar Mi estilo/);
  }finally{await rm(temp,{recursive:true,force:true});}
});
