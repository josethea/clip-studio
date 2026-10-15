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

test('global and preview controls reflect project settings and playback state',async()=>{
  const projectRoot=resolve(import.meta.dirname,'..'),temp=await mkdtemp(join(projectRoot,'node_modules','.controls-test-'));
  try{
    await build({entryPoints:[join(projectRoot,'ui','editor-controls.jsx')],bundle:true,packages:'external',platform:'node',format:'esm',jsx:'automatic',outfile:join(temp,'controls.mjs')});
    const {GlobalControls,FormatControls,PreviewControls}=await import(pathToFileURL(join(temp,'controls.mjs')).href);
    const store=configureStore({reducer:()=>({studioUi:{globalControls:{transitionSequence:['remotion:slide:right'],effectSequence:['warm'],transitionDuration:0.5,imageFit:'frame',videoFit:'fill',blur:20,blurOpacity:5,motion:'pan-left',zoomPercent:10},formatControls:{ratio:'16:9',quality:'1080p',exportQuality:'maximum',captions:false},previewControls:{time:3.5,duration:10,playing:true}}})});
    const render=Component=>renderToStaticMarkup(React.createElement(Provider,{store},React.createElement(Component,{actions:{}})));
    const global=render(GlobalControls),format=render(FormatControls),preview=render(PreviewControls);
    assert.match(global,/Deslizar a la izquierda/);
    assert.match(global,/aria-pressed="true"/);
    assert.match(global,/value="frame" selected=""/);
    assert.match(global,/value="pan-left" selected=""/);
    assert.match(format,/value="1080p" selected=""/);
    assert.match(format,/value="maximum" selected=""/);
    assert.match(format,/value="no" selected=""/);
    assert.match(preview,/aria-label="Pausar">Ⅱ/);
    assert.match(preview,/＋ Texto/);
    assert.match(preview,/00:03.500 \/ 00:10.000/);
  }finally{await rm(temp,{recursive:true,force:true});}
});
