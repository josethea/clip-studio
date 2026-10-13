import test from 'node:test';
import assert from 'node:assert/strict';
import {sceneTransitionFramePlan} from './transition-timing.mjs';

test('transitions straddle each cut without changing the video duration', () => {
  const scenes = [
    {start: 0, end: 3, transitionSeconds: 1},
    {start: 3, end: 7, transitionSeconds: .5},
    {start: 7, end: 10, transitionSeconds: 0},
  ];
  const plan = sceneTransitionFramePlan(scenes, 30, 300);
  assert.deepEqual(plan.map(({startFrame, durationInFrames, transitionFrames}) => [startFrame, durationInFrames, transitionFrames]), [
    [0, 105, 30],
    [75, 143, 15],
    [203, 97, 0],
  ]);
  assert.equal(plan.reduce((total, scene) => total + scene.durationInFrames - scene.transitionFrames, 0), 300);
});
