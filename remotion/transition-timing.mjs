export function visibleScenesAtTime(scenes, time) {
  let currentIndex = -1;
  for (let i = 0; i < scenes.length; i++) {
    if (scenes[i].start <= time) currentIndex = i;
    else break;
  }

  for (let i = 0; i < scenes.length - 1; i++) {
    const duration = Number(scenes[i].transitionSeconds) || 0;
    if (duration <= 0) continue;
    const start = scenes[i].end - duration / 2;
    const end = scenes[i].end + duration / 2;
    if (time >= start && time < end) {
      return {indexes: [i, i + 1], transitionIndex: i, progress: (time - start) / duration};
    }
  }

  return {indexes: scenes.length ? [Math.max(0, currentIndex)] : [], transitionIndex: -1, progress: 1};
}

export function sceneVisibleBounds(scenes, index) {
  const scene = scenes[index];
  const previousHalf = index > 0 ? (Number(scenes[index - 1].transitionSeconds) || 0) / 2 : 0;
  const nextHalf = index < scenes.length - 1 ? (Number(scene.transitionSeconds) || 0) / 2 : 0;
  return {start: scene.start - previousHalf, end: scene.end + nextHalf};
}

export function sceneTransitionFramePlan(scenes, fps, totalFrames) {
  const cuts = scenes.slice(0, -1).map(scene => Math.round(Number(scene.end) * fps));
  const overlaps = scenes.slice(0, -1).map(scene => Math.max(0, Math.round((Number(scene.transitionSeconds) || 0) * fps)));
  return scenes.map((scene, index) => {
    const before = index ? Math.floor(overlaps[index - 1] / 2) : 0;
    const after = index < overlaps.length ? Math.ceil(overlaps[index] / 2) : 0;
    const startFrame = (index ? cuts[index - 1] : 0) - before;
    const endFrame = (index < cuts.length ? cuts[index] : totalFrames) + after;
    return {startFrame, durationInFrames: endFrame - startFrame, transitionFrames: overlaps[index] || 0};
  });
}
