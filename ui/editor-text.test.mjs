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

test('text, subtitle and multi-selection inspectors preserve saved values',async()=>{
  const root=resolve(import.meta.dirname,'..'),temp=await mkdtemp(join(root,'node_modules','.editor-text-test-'));
  try{
    await build({entryPoints:[join(root,'ui','editor-text.jsx')],bundle:true,packages:'external',platform:'node',format:'esm',jsx:'automatic',outfile:join(temp,'editor-text.mjs')});
    const {TextInspector,SubtitleInspector,MultiInspector}=await import(pathToFileURL(join(temp,'editor-text.mjs')).href);
    const render=(view,Component)=>renderToStaticMarkup(React.createElement(Provider,{store:configureStore({reducer:()=>({studioUi:{editorInspector:view}})})},React.createElement(Component,{actions:{}})));
    const text=render({type:'text',index:2,layer:{id:'layer-1',type:'title',templateId:'headline',text:'Texto',highlight:'título',position:'top-left',start:1,end:3,font:'Anton',size:8,color:'#ffffff',accent:'#ff537e',background:25,animation:'fade'},templates:[{id:'headline',name:'Titular'}]},TextInspector);
    assert.match(text,/value="Anton" selected=""/);
    assert.match(text,/value="top-left" selected=""/);
    assert.match(text,/value="1"/);
    assert.match(text,/value="3"/);
    assert.match(text,/aria-label="Elegir color #ff537e"/);
    const subtitle=render({type:'subtitle',index:4,cue:{text:'Subtítulo',start:4,end:6,hidden:true},settings:{captionStyle:'highlight',captionFont:'Anton',captionSize:'large',captionPosition:'center',captionColor:'#ffe36c',captionAccent:'#42f578'},hasWords:false},SubtitleInspector);
    assert.match(subtitle,/value="Anton" selected=""/);
    assert.match(subtitle,/value="center" selected=""/);
    assert.match(subtitle,/Mostrar subtítulo/);
    assert.match(subtitle,/value="dynamic" disabled=""/);
    const multi=render({type:'multi',count:3,hasScenes:true,hasSubtitles:false,hasText:true},MultiInspector);
    assert.match(multi,/3 elementos seleccionados/);
    assert.match(multi,/<button class="secondary" disabled="">Ocultar subtítulos elegidos<\/button>/);
  }finally{await rm(temp,{recursive:true,force:true});}
});
