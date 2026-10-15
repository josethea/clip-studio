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

test('narration, storyboard and timeline controls reflect the current project',async()=>{
  const projectRoot=resolve(import.meta.dirname,'..'),temp=await mkdtemp(join(projectRoot,'node_modules','.editor-workflow-test-'));
  try{
    await build({entryPoints:[join(projectRoot,'ui','editor-workflow.jsx')],bundle:true,packages:'external',platform:'node',format:'esm',jsx:'automatic',outfile:join(temp,'workflow.mjs')});
    const {NarrationControls,EditorStoryboardControls,MediaStoryboardControls,TimelineToolbar}=await import(pathToFileURL(join(temp,'workflow.mjs')).href);
    const store=configureStore({reducer:()=>({studioUi:{editorNarration:{projectId:'project',pauseMs:450,gapCount:8,longGaps:3,duration:'01:35.000',scenes:12,subtitles:16,result:{cuts:3,removed:1.25,audioId:'audio-1',srt:'captions.srt'}},editorStoryboard:{projectId:'project',sceneMode:'chapter',assignMode:'smart'},editorTimeline:{scale:36}}})});
    const render=Component=>renderToStaticMarkup(React.createElement(Provider,{store},React.createElement(Component,{actions:{}})));
    const narration=render(NarrationControls),editor=render(EditorStoryboardControls),media=render(MediaStoryboardControls),timeline=render(TimelineToolbar);
    assert.match(narration,/value="450"/);
    assert.match(narration,/8 pausas detectadas · 3 superan/);
    assert.match(narration,/3 pausas recortadas · 1.25 s/);
    assert.match(narration,/Duración: 01:35.000 · 12 tomas/);
    assert.match(editor,/value="chapter" selected=""/);
    assert.match(editor,/value="smart" selected=""/);
    assert.match(media,/Uno por bloque SRT/);
    assert.match(timeline,/value="36"/);
    assert.doesNotMatch(timeline,/px\/s|Arrastra el cabezal/);
  }finally{await rm(temp,{recursive:true,force:true});}
});
