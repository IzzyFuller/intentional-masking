import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  findSkeleton,
  createSkeletonFromAnimations,
  calculateAnimationTime,
  applyMorphTargets,
  createAnimationMixer,
} from './animation-service.js';

describe('findSkeleton', () => {
  it('finds skeleton in scene with SkinnedMesh', () => {
    const skeleton = new THREE.Skeleton([new THREE.Bone()]);
    const mesh = new THREE.SkinnedMesh();
    mesh.bind(skeleton);

    const scene = new THREE.Group();
    scene.add(mesh);

    expect(findSkeleton(scene)).toBe(skeleton);
  });

  it('returns null for scene without SkinnedMesh', () => {
    const scene = new THREE.Group();
    scene.add(new THREE.Mesh());

    expect(findSkeleton(scene)).toBeNull();
  });

  it('finds nested skeleton', () => {
    const skeleton = new THREE.Skeleton([new THREE.Bone()]);
    const mesh = new THREE.SkinnedMesh();
    mesh.bind(skeleton);

    const parent = new THREE.Group();
    const child = new THREE.Group();
    child.add(mesh);
    parent.add(child);

    expect(findSkeleton(parent)).toBe(skeleton);
  });
});

describe('createSkeletonFromAnimations', () => {
  it('extracts bone names from animation tracks', () => {
    const clip = new THREE.AnimationClip('test', 1, [
      new THREE.NumberKeyframeTrack('Hips.position', [0], [0, 0, 0]),
      new THREE.NumberKeyframeTrack('Spine.rotation', [0], [0, 0, 0, 1]),
      new THREE.NumberKeyframeTrack('Head.scale', [0], [1, 1, 1]),
    ]);

    const skeleton = createSkeletonFromAnimations([clip]);

    expect(skeleton).not.toBeNull();
    const boneNames = skeleton!.bones.map((b: THREE.Bone) => b.name);
    expect(boneNames).toContain('Hips');
    expect(boneNames).toContain('Spine');
    expect(boneNames).toContain('Head');
  });

  it('returns null for empty animations array', () => {
    expect(createSkeletonFromAnimations([])).toBeNull();
  });

  it('deduplicates bone names across tracks', () => {
    const clip = new THREE.AnimationClip('test', 1, [
      new THREE.NumberKeyframeTrack('Hips.position', [0], [0, 0, 0]),
      new THREE.NumberKeyframeTrack('Hips.rotation', [0], [0, 0, 0, 1]),
    ]);

    const skeleton = createSkeletonFromAnimations([clip]);

    const hipsBones = skeleton!.bones.filter((b: THREE.Bone) => b.name === 'Hips');
    expect(hipsBones).toHaveLength(1);
  });
});

describe('calculateAnimationTime', () => {
  const fps = 30;

  it('calculates time for frame within segment', () => {
    // Frame 60 = 2s, segment starts at 1s = 1s into animation
    expect(calculateAnimationTime(60, fps, 1, 3, false)).toBeCloseTo(1.0);
  });

  it('clamps to clip duration when not looping', () => {
    // Frame 150 = 5s, clip is 2s = clamped to 2s
    expect(calculateAnimationTime(150, fps, 0, 2, false)).toBe(2);
  });

  it('wraps when looping', () => {
    // Frame 150 = 5s, clip is 2s, looping = 5 % 2 = 1s
    expect(calculateAnimationTime(150, fps, 0, 2, true)).toBeCloseTo(1.0);
  });

  it('handles segment offset', () => {
    // Frame 90 = 3s, segment starts at 2s = 1s into animation
    expect(calculateAnimationTime(90, fps, 2, 5, false)).toBeCloseTo(1.0);
  });

  it('handles zero clip duration', () => {
    expect(calculateAnimationTime(30, fps, 0, 0, false)).toBe(0);
  });

  it('wraps to 0 at exact loop boundary', () => {
    // Frame 60 = 2s, clip is 2s = wraps to 0
    expect(calculateAnimationTime(60, fps, 0, 2, true)).toBeCloseTo(0);
  });

  it('handles negative frame offset gracefully', () => {
    // Frame 0, segment starts at 1s = -1s, clamped to 0
    const time = calculateAnimationTime(0, fps, 1, 2, false);
    expect(time).toBeLessThanOrEqual(0);
  });
});

describe('applyMorphTargets', () => {
  it('sets morph target influences on SkinnedMesh', () => {
    const mesh = new THREE.SkinnedMesh();
    mesh.morphTargetDictionary = { 'viseme_aa': 0, 'viseme_O': 1 };
    mesh.morphTargetInfluences = [0, 0];

    const scene = new THREE.Group();
    scene.add(mesh);

    applyMorphTargets(scene, { 'viseme_aa': 0.8, 'viseme_O': 0.3 });

    expect(mesh.morphTargetInfluences[0]).toBe(0.8);
    expect(mesh.morphTargetInfluences[1]).toBe(0.3);
  });

  it('resets all influences before applying', () => {
    const mesh = new THREE.SkinnedMesh();
    mesh.morphTargetDictionary = { 'a': 0, 'b': 1 };
    mesh.morphTargetInfluences = [0.5, 0.5];

    const scene = new THREE.Group();
    scene.add(mesh);

    applyMorphTargets(scene, { 'a': 0.2 });

    expect(mesh.morphTargetInfluences[0]).toBe(0.2);
    expect(mesh.morphTargetInfluences[1]).toBe(0); // Reset
  });

  it('merges expression with morphTargets', () => {
    const mesh = new THREE.SkinnedMesh();
    mesh.morphTargetDictionary = { 'smile': 0, 'viseme': 1 };
    mesh.morphTargetInfluences = [0, 0];

    const scene = new THREE.Group();
    scene.add(mesh);

    applyMorphTargets(scene, { 'viseme': 0.5 }, { 'smile': 0.7 });

    expect(mesh.morphTargetInfluences[0]).toBe(0.7); // expression
    expect(mesh.morphTargetInfluences[1]).toBe(0.5); // morphTargets
  });

  it('morphTargets override expression for same key', () => {
    const mesh = new THREE.SkinnedMesh();
    mesh.morphTargetDictionary = { 'smile': 0 };
    mesh.morphTargetInfluences = [0];

    const scene = new THREE.Group();
    scene.add(mesh);

    applyMorphTargets(scene, { 'smile': 0.3 }, { 'smile': 0.7 });

    expect(mesh.morphTargetInfluences[0]).toBe(0.3); // morphTargets wins
  });

  it('ignores unknown morph target names', () => {
    const mesh = new THREE.SkinnedMesh();
    mesh.morphTargetDictionary = { 'known': 0 };
    mesh.morphTargetInfluences = [0];

    const scene = new THREE.Group();
    scene.add(mesh);

    // Should not throw
    applyMorphTargets(scene, { 'unknown': 0.5, 'known': 0.3 });

    expect(mesh.morphTargetInfluences[0]).toBe(0.3);
  });

  it('handles scene without SkinnedMesh', () => {
    const scene = new THREE.Group();
    scene.add(new THREE.Mesh());

    // Should not throw
    expect(() => applyMorphTargets(scene, { 'anything': 0.5 })).not.toThrow();
  });
});

describe('createAnimationMixer', () => {
  const defaultSegment = {
    file: 'test.glb',
    clip: '',
    start: 0,
    end: 2,
    weight: 1,
    loop: false,
  };

  it('creates mixer for scene', () => {
    const scene = new THREE.Group();
    const { mixer } = createAnimationMixer(scene, [], defaultSegment);

    expect(mixer).toBeInstanceOf(THREE.AnimationMixer);
  });

  it('returns null action for empty animations', () => {
    const scene = new THREE.Group();
    const { action, clipDuration } = createAnimationMixer(scene, [], defaultSegment);

    expect(action).toBeNull();
    expect(clipDuration).toBe(0);
  });

  it('creates action for animation clip', () => {
    const scene = new THREE.Group();
    const clip = new THREE.AnimationClip('idle', 2.5, []);

    const { action, clipDuration } = createAnimationMixer(scene, [clip], defaultSegment);

    expect(action).not.toBeNull();
    expect(clipDuration).toBe(2.5);
  });

  it('selects clip by name when specified', () => {
    const scene = new THREE.Group();
    const clip1 = new THREE.AnimationClip('walk', 1, []);
    const clip2 = new THREE.AnimationClip('run', 0.5, []);

    const segment = { ...defaultSegment, clip: 'run' };
    const { clipDuration } = createAnimationMixer(scene, [clip1, clip2], segment);

    expect(clipDuration).toBe(0.5);
  });

  it('falls back to first clip if named clip not found', () => {
    const scene = new THREE.Group();
    const clip = new THREE.AnimationClip('idle', 2, []);

    const segment = { ...defaultSegment, clip: 'nonexistent' };
    const { clipDuration } = createAnimationMixer(scene, [clip], segment);

    expect(clipDuration).toBe(2);
  });

  it('applies weight from segment', () => {
    const scene = new THREE.Group();
    const clip = new THREE.AnimationClip('idle', 1, []);

    const segment = { ...defaultSegment, weight: 0.5 };
    const { action } = createAnimationMixer(scene, [clip], segment);

    expect(action!.getEffectiveWeight()).toBe(0.5);
  });

  it('sets loop mode from segment', () => {
    const scene = new THREE.Group();
    const clip = new THREE.AnimationClip('idle', 1, []);

    const segment = { ...defaultSegment, loop: true };
    const { action } = createAnimationMixer(scene, [clip], segment);

    expect(action!.loop).toBe(THREE.LoopRepeat);
  });
});
