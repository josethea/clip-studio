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

test('scene inspector renders the selected scene and its saved adjustments',async()=>{
  const root=resolve(import.meta.dirname,'..'),temp=await mkdtemp(join(root,'node_modules','.editor-test-'));
  try{
    await build({entryPoints:[join(root,'ui','editor.jsx')],bundle:true,packages:'external',platform:'node',format:'esm',jsx:'automatic',outfile:join(temp,'editor.mjs')});
    const {SceneInspector,TimelineLane,TimelineRuler}=await import(pathToFileURL(join(temp,'editor.mjs')).href);
    const view={projectId:'project',index:5,scene:{start:12,end:15,text:'Una toma',assetId:'asset-2',fitOverride:'frame',motionOverride:'pan-left',sourceStart:1.5,zoomPercentOverride:14},asset:{id:'asset-2',name:'Foto',type:'image'},assets:[{id:'asset-2',name:'Foto'}],zoomPercent:10};
    const store=configureStore({reducer:()=>({studioUi:{editorScene:view}})});
    const html=renderToStaticMarkup(React.createElement(Provider,{store},React.createElement(SceneInspector,{actions:{}})));
    assert.match(html,/Toma 6 · 00:12.000–00:15.000/);
    assert.match(html,/value="frame" selected=""/);
    assert.match(html,/value="pan-left" selected=""/);
    assert.match(html,/value="1.5"/);
    assert.match(html,/value="14"/);
    assert.equal((html.match(/<option value="asset-/g)||[]).length,1);
    const timelineStore=configureStore({reducer:()=>({studioUi:{editorTimeline:{scale:20,ticks:[{time:0,left:64},{time:5,left:164}],lanes:{timeline:[{key:'scene-0',kind:'video',start:0,end:5,label:'1 · Foto',selectType:'scene',selectIndex:0,selected:true},{key:'boundary-0',boundary:0,start:5}]}}}})});
    const track=renderToStaticMarkup(React.createElement(Provider,{store:timelineStore},React.createElement(TimelineLane,{lane:'timeline'})));
    const ruler=renderToStaticMarkup(React.createElement(Provider,{store:timelineStore},React.createElement(TimelineRuler)));
    assert.match(track,/data-select-type="scene" data-select-index="0"/);
    assert.match(track,/data-boundary="0"/);
    assert.match(track,/left:100px/);
    assert.match(ruler,/left:164px/);
  }finally{await rm(temp,{recursive:true,force:true});}
});
