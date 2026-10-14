import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshChapterMapping,buildStoryboard,assignInitialAssets} from './storyboard-model.mjs';

const cues=[
  {id:1,start:0,end:2,text:'alpha one'},
  {id:2,start:2,end:4,text:'beta two'},
  {id:3,start:4,end:6,text:'gamma three'},
  {id:4,start:6,end:8,text:'delta four'}
];
const chapters=[
  {chapter:'Inicio',startText:'alpha one',endText:'beta two'},
  {chapter:'Final',startText:'gamma three',endText:'delta four'}
];
const project=()=>({script:cues.map(cue=>cue.text).join(' '),cues:cues.map(cue=>({...cue})),rawChapters:chapters,chapterGrouping:{1:2,2:2},settings:{sceneMode:'chapter'},scenes:[],assets:[]});

test('chapter grouping covers every SRT block and keeps chapter boundaries',()=>{
  const p=project(),result=buildStoryboard(p);
  assert.deepEqual(result,{sceneCount:2,cueCount:4,warningCount:0});
  assert.equal(p.chapterValidationError,'');
  assert.deepEqual(p.chapters.map(chapter=>[chapter.cueStart,chapter.cueEnd]),[[0,1],[2,3]]);
  assert.deepEqual(p.scenes.map(scene=>[scene.cueStart,scene.cueEnd,scene.start,scene.end]),[[0,1,0,4],[2,3,4,8]]);
  assert.deepEqual(p.scenes.map(scene=>scene.chapterId),[1,2]);
});

test('search terms require one scene per block and retain their order',()=>{
  const p=project();
  p.rawSearchTerms=cues.map((cue,index)=>({id:cue.id,text:cue.text,searchTerm:`term ${index+1}`}));
  assert.throws(()=>buildStoryboard(p),/Search terms es 1 a 1/);
  p.settings.sceneMode='srt';
  const result=buildStoryboard(p);
  assert.equal(result.sceneCount,4);
  assert.deepEqual(p.scenes.map(scene=>scene.searchTerm),['term 1','term 2','term 3','term 4']);
  p.rawSearchTerms[1].text='texto distinto';
  assert.equal(buildStoryboard(p).warningCount,1);
});

test('invalid chapters show a useful error before building and do not leave old mapping',()=>{
  const p=project();buildStoryboard(p);
  p.script='texto que no coincide';
  refreshChapterMapping(p);
  assert.equal(p.chapters.length,0);
  assert.match(p.chapterValidationError,/No se encontró en el guion/);
  assert.throws(()=>buildStoryboard(p),/No se encontró en el guion/);
  assert.throws(()=>buildStoryboard({...project(),chapterGrouping:{1:3,2:2}}),/admite entre 1 y 2 bloques/);
});

test('initial assignment prefers numbered names, then chapter in smart mode, then unused media',()=>{
  const p=project();buildStoryboard(p);
  p.settings.sceneMode='srt';buildStoryboard(p);
  p.assets=[
    {id:'misc',name:'sin número.jpg',type:'image'},
    {id:'second',name:'02.jpg',type:'image'},
    {id:'chapter',name:'paisaje.jpg',chapter:'Final',type:'video'},
    {id:'audio',name:'01.mp3',type:'audio'},
    {id:'fourth',name:'4.jpg',type:'image'}
  ];
  assert.equal(assignInitialAssets(p,'smart'),4);
  assert.deepEqual(p.scenes.map(scene=>scene.assetId),['misc','second','chapter','fourth']);
  assert.equal(p.scenes.some(scene=>scene.assetId==='audio'),false);
});
