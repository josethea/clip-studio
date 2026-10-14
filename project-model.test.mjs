import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureEditorSettings,migrateLegacySources,sourceCount} from './project-model.mjs';

test('editor settings initialize from saved scenes and preserve explicit choices',()=>{
  const project={settings:{videoFit:'contain',zoomPercent:18},scenes:[{transition:'Flash',effect:'warm',fit:'frame',blur:12,motion:'pulse',transitionDuration:0.7}]};
  ensureEditorSettings(project);
  assert.deepEqual(project.settings.transitionSequence,['remotion:slide:bottom']);
  assert.deepEqual(project.settings.effectSequence,['warm']);
  assert.equal(project.settings.transitionDuration,0.7);
  assert.equal(project.settings.imageFit,'frame');
  assert.equal(project.settings.videoFit,'contain');
  assert.equal(project.settings.zoomPercent,18);
  assert.equal(project.settings.sceneMode,'srt');
  ensureEditorSettings(project);
  assert.deepEqual(project.settings.transitionSequence,['remotion:slide:bottom']);
  const empty={scenes:[]};ensureEditorSettings(empty);
  assert.deepEqual(empty.settings.transitionSequence,['remotion:none']);
});

test('misfiled legacy search terms move to their own source without losing scene terms',()=>{
  const project={settings:{sceneMode:'chapter'},rawChapters:[{id:1,searchTerm:'rice'},{id:2,searchTerm:'fish'}],scenes:[{searchTerm:'',chapterId:1},{searchTerm:'already set',chapterId:1}]};
  assert.equal(migrateLegacySources(project),true);
  assert.equal(project.rawChapters,null);
  assert.equal(project.rawSearchTerms.length,2);
  assert.deepEqual(project.scenes.map(scene=>scene.searchTerm),['rice','already set']);
  assert.deepEqual(project.scenes.map(scene=>scene.chapterId),[null,null]);
  assert.equal(project.settings.sceneMode,'srt');
  assert.equal(migrateLegacySources(project),false);
  assert.equal(migrateLegacySources({rawChapters:[{startText:'alpha',searchTerm:'rice'}]}),false);
  assert.equal(sourceCount(project.rawSearchTerms),2);
  assert.equal(sourceCount({chapters:[1,2,3]}),3);
  assert.equal(sourceCount({items:[1]}),1);
  assert.equal(sourceCount(null),0);
});
