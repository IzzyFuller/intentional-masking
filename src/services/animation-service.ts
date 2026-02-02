import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { AnimationSegmentWithDefaults } from '../config/animation-types.js';

/**
 * Pure function: Find skeleton in a scene
 */
export function findSkeleton(scene: THREE.Object3D): THREE.Skeleton | null {
  let skeleton: THREE.Skeleton | null = null;
  scene.traverse((child) => {
    if (child instanceof THREE.SkinnedMesh && child.skeleton) {
      skeleton = child.skeleton;
    }
  });
  return skeleton;
}

/**
 * Pure function: Extract bone names from animation clips and create skeleton reference
 */
export function createSkeletonFromAnimations(animations: THREE.AnimationClip[]): THREE.Skeleton | null {
  if (animations.length === 0) return null;

  const boneNames = new Set<string>();
  for (const clip of animations) {
    for (const track of clip.tracks) {
      const boneName = track.name.split('.')[0];
      boneNames.add(boneName);
    }
  }

  const bones: THREE.Bone[] = [];
  for (const name of boneNames) {
    const bone = new THREE.Bone();
    bone.name = name;
    bones.push(bone);
  }

  if (bones.length === 0) return null;
  return new THREE.Skeleton(bones);
}

/**
 * Pure function: Calculate animation time from frame number
 */
export function calculateAnimationTime(
  frame: number,
  fps: number,
  segmentStart: number,
  clipDuration: number,
  loop: boolean
): number {
  const segmentStartFrame = Math.floor(segmentStart * fps);
  const frameInSegment = frame - segmentStartFrame;
  const timeInSegment = frameInSegment / fps;

  if (loop && clipDuration > 0) {
    return timeInSegment % clipDuration;
  }
  return Math.min(timeInSegment, clipDuration);
}

/**
 * Pure function: Apply morph targets to all skinned meshes in scene
 */
export function applyMorphTargets(
  scene: THREE.Object3D,
  morphTargets: Record<string, number>,
  expression: Record<string, number> = {}
): void {
  const combinedMorphs = { ...expression, ...morphTargets };

  scene.traverse((child: THREE.Object3D) => {
    if (child instanceof THREE.SkinnedMesh && child.morphTargetDictionary) {
      const influences = child.morphTargetInfluences;
      if (!influences) return;

      // Reset all morph targets
      for (let i = 0; i < influences.length; i++) {
        influences[i] = 0;
      }

      // Apply combined morph targets
      for (const [name, value] of Object.entries(combinedMorphs)) {
        const index = child.morphTargetDictionary[name];
        if (index !== undefined) {
          influences[index] = value;
        }
      }
    }
  });
}

/**
 * Factory: Create and configure animation mixer for a scene
 */
export interface AnimationMixerResult {
  mixer: THREE.AnimationMixer;
  action: THREE.AnimationAction | null;
  clipDuration: number;
}

export function createAnimationMixer(
  scene: THREE.Object3D,
  animations: THREE.AnimationClip[],
  segment: AnimationSegmentWithDefaults
): AnimationMixerResult {
  const mixer = new THREE.AnimationMixer(scene);

  if (animations.length === 0) {
    return { mixer, action: null, clipDuration: 0 };
  }

  // Select clip by name or use first
  let clip = segment.clip
    ? animations.find(a => a.name === segment.clip)
    : animations[0];

  if (!clip) {
    clip = animations[0];
  }

  // Attempt to retarget animation to scene's skeleton
  const sceneSkeleton = findSkeleton(scene);
  const animationSkeleton = createSkeletonFromAnimations(animations);

  let retargetedClip = clip;
  if (sceneSkeleton && animationSkeleton) {
    try {
      retargetedClip = SkeletonUtils.retargetClip(
        scene,
        animationSkeleton,
        clip,
        { hip: 'Hips' }
      );
    } catch {
      retargetedClip = clip;
    }
  }

  const action = mixer.clipAction(retargetedClip);
  action.setEffectiveWeight(segment.weight);
  action.setLoop(segment.loop ? THREE.LoopRepeat : THREE.LoopOnce, segment.loop ? Infinity : 1);
  action.clampWhenFinished = true;
  action.play();

  return { mixer, action, clipDuration: clip.duration };
}
