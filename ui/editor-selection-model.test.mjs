import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {emptyEditorInteraction,selectEditorItem,restoreEditorInteraction} from './editor-selection-model.mjs';

test('editor selection and shift selection keep scene focus separate from playback',()=>{
  const empty=emptyEditorInteraction(),scene=selectEditorItem(empty,'scene',2);
  assert.deepEqual(scene,{selection:{type:'scene',index:2},multiSelection:[],selectedScene:2});
  const multi=selectEditorItem(scene,'text',4,true);
  assert.deepEqual(multi.multiSelection,[{type:'scene',index:2},{type:'text',index:4}]);
  assert.deepEqual(multi.selection,{type:'multi',index:-1});
  assert.equal(multi.selectedScene,null);
  const one=selectEditorItem(multi,'text',4,true);
  assert.deepEqual(one.selection,{type:'scene',index:2});
  assert.deepEqual(one.multiSelection,[]);
  assert.equal(one.selectedScene,2);
  assert.deepEqual(empty,emptyEditorInteraction());
  assert.deepEqual(restoreEditorInteraction({sceneCount:0,textCount:0},one),emptyEditorInteraction());
});

test('Redux is the source of the editor interaction selection',async()=>{
  const projectRoot=resolve(import.meta.dirname,'..'),temp=await mkdtemp(join(projectRoot,'node_modules','.editor-selection-test-'));
  try{
    await build({entryPoints:[join(projectRoot,'ui','studio-ui.jsx')],bundle:true,packages:'external',platform:'node',format:'esm',jsx:'automatic',outfile:join(temp,'studio-ui.mjs')});
    const ui=await import(pathToFileURL(join(temp,'studio-ui.mjs')).href);
    assert.deepEqual(ui.getEditorInteraction(),emptyEditorInteraction());
    ui.selectEditorInteraction('scene',1);
    assert.equal(ui.getEditorInteraction().selectedScene,1);
    ui.selectEditorInteraction('subtitle',3,true);
    assert.equal(ui.getEditorInteraction().selection.type,'multi');
    ui.restoreEditorSelection(2,0);
    assert.equal(ui.getEditorInteraction().selection.type,'multi');
    ui.patchEditorInteraction(emptyEditorInteraction());
    assert.deepEqual(ui.getEditorInteraction(),emptyEditorInteraction());
  }finally{await rm(temp,{recursive:true,force:true});}
});
