import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureSubtitleSources,subtitleSourceOptions,selectSubtitleSource} from './subtitle-sources.mjs';

test('preserves current subtitles and switches between saved SRT variants',()=>{
  const project={sourceCues:[{start:0,end:2,text:'Original'}],subtitleCues:[{start:0,end:2,text:'Editado'}]};
  assert.equal(ensureSubtitleSources(project),true);
  assert.equal(project.subtitleSource,'current');
  project.subtitleSources.generated=[{start:0,end:2,text:'Generado'}];
  assert.deepEqual(subtitleSourceOptions(project).map(option=>option.id),['original','current','generated']);
  assert.equal(selectSubtitleSource(project,'generated'),true);
  assert.equal(project.subtitleCues[0].text,'Generado');
  project.subtitleCues[0].text='Generado corregido';
  selectSubtitleSource(project,'original');
  selectSubtitleSource(project,'generated');
  assert.equal(project.subtitleCues[0].text,'Generado corregido');
  assert.equal(selectSubtitleSource(project,'missing'),false);
});
