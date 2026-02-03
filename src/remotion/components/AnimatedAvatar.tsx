import { useGLTF } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import type { AnimationSegmentWithDefaults } from '../../config/animation-types';

export interface AnimatedAvatarProps {
  avatarPath: string;
  animationPath: string;
  segment: AnimationSegmentWithDefaults;
  morphTargets?: Record<string, number>;
  expression?: 'neutral' | 'happy' | 'thinking' | 'surprised';
}

const EXPRESSIONS: Record<string, Record<string, number>> = {
  neutral: {},
  happy: { 'mouthSmile': 0.7, 'eyeSquintLeft': 0.3, 'eyeSquintRight': 0.3 },
  thinking: { 'browInnerUp': 0.5, 'eyeLookUpLeft': 0.3, 'eyeLookUpRight': 0.3 },
  surprised: { 'browOuterUpLeft': 0.8, 'browOuterUpRight': 0.8, 'jawOpen': 0.3, 'eyeWideLeft': 0.5, 'eyeWideRight': 0.5 },
};

function findSkeleton(scene: THREE.Object3D): THREE.Skeleton | null {
  let skeleton: THREE.Skeleton | null = null;
  scene.traverse((child) => {
    if (child instanceof THREE.SkinnedMesh && child.skeleton) {
      skeleton = child.skeleton;
    }
  });
  return skeleton;
}

function createSkeletonFromAnimations(animations: THREE.AnimationClip[]): THREE.Skeleton | null {
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

function calculateAnimationTime(
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

function applyMorphTargets(
  scene: THREE.Object3D,
  morphTargets: Record<string, number>,
  expression: Record<string, number> = {}
): void {
  const combinedMorphs = { ...expression, ...morphTargets };

  scene.traverse((child: THREE.Object3D) => {
    if (child instanceof THREE.SkinnedMesh && child.morphTargetDictionary) {
      const influences = child.morphTargetInfluences;
      if (!influences) return;

      for (let i = 0; i < influences.length; i++) {
        influences[i] = 0;
      }

      for (const [name, value] of Object.entries(combinedMorphs)) {
        const index = child.morphTargetDictionary[name];
        if (index !== undefined) {
          influences[index] = value;
        }
      }
    }
  });
}

interface AnimationMixerResult {
  mixer: THREE.AnimationMixer;
  action: THREE.AnimationAction | null;
  clipDuration: number;
}

function createAnimationMixer(
  scene: THREE.Object3D,
  animations: THREE.AnimationClip[],
  segment: AnimationSegmentWithDefaults
): AnimationMixerResult {
  const mixer = new THREE.AnimationMixer(scene);

  if (animations.length === 0) {
    return { mixer, action: null, clipDuration: 0 };
  }

  let clip = segment.clip
    ? animations.find(a => a.name === segment.clip)
    : animations[0];

  if (!clip) {
    clip = animations[0];
  }

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

export const AnimatedAvatar: React.FC<AnimatedAvatarProps> = ({
  avatarPath,
  animationPath,
  segment,
  morphTargets = {},
  expression = 'neutral',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const groupRef = useRef<THREE.Group>(null);

  const avatarUrl = staticFile(avatarPath);
  const animationUrl = staticFile(animationPath);
  const { scene: avatarScene } = useGLTF(avatarUrl);
  const { animations } = useGLTF(animationUrl);

  const clonedScene = useMemo(() => {
    return SkeletonUtils.clone(avatarScene);
  }, [avatarScene]);

  const { mixer, clipDuration } = useMemo(() => {
    return createAnimationMixer(clonedScene, animations, segment);
  }, [clonedScene, animations, segment]);

  useEffect(() => {
    if (!mixer) return;
    const time = calculateAnimationTime(frame, fps, segment.start, clipDuration, segment.loop);
    mixer.setTime(time);
  }, [mixer, frame, fps, segment.start, segment.loop, clipDuration]);

  useEffect(() => {
    const expressionMorphs = EXPRESSIONS[expression] || {};
    applyMorphTargets(clonedScene, morphTargets, expressionMorphs);
  }, [clonedScene, morphTargets, expression]);

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} scale={1} position={[0, 0, 0]} />
    </group>
  );
};
