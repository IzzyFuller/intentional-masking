import { useGLTF, useAnimations } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import type { AnimationSegmentWithDefaults } from '../../config/animation-types';

export interface AnimatedAvatarProps {
  avatarPath: string;
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

  // Find clip by name, or use first available
  const clip = segment.clip
    ? animations.find(a => a.name === segment.clip)
    : animations[0];

  // Bones match directly (avatar bones renamed to mixamorig: prefix in Blender)
  // No retargeting needed
  const action = mixer.clipAction(clip);
  action.setEffectiveWeight(segment.weight);
  action.setLoop(segment.loop ? THREE.LoopRepeat : THREE.LoopOnce, segment.loop ? Infinity : 1);
  action.clampWhenFinished = true;
  action.play();

  return { mixer, action, clipDuration: clip.duration };
}

export const AnimatedAvatar: React.FC<AnimatedAvatarProps> = ({
  avatarPath,
  segment,
  morphTargets = {},
  expression = 'neutral',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const groupRef = useRef<THREE.Group>(null);

  // Load avatar with embedded animations from single file
  const avatarUrl = staticFile(avatarPath);
  const { scene: avatarScene, animations } = useGLTF(avatarUrl);

  // Clone scene for rendering
  const clonedScene = useMemo(() => {
    return avatarScene.clone(true);
  }, [avatarScene]);

  // Use drei's useAnimations to properly bind mixer to scene
  const { mixer } = useAnimations(animations, clonedScene);

  // Apply morph targets and animation synchronously each frame
  useMemo(() => {
    // Apply morph targets (lip sync + expression)
    const expressionMorphs = EXPRESSIONS[expression] || {};
    applyMorphTargets(clonedScene, morphTargets, expressionMorphs);

    // Apply body animation if clip specified and mixer exists
    if (segment.clip && mixer && animations.length > 0) {
      const clip = animations.find(a => a.name === segment.clip) || animations[0];
      if (clip) {
        const time = calculateAnimationTime(frame, fps, segment.start, clip.duration, segment.loop);
        mixer.setTime(time);
        mixer.update(0);
      }
    }
  }, [clonedScene, morphTargets, expression, segment, mixer, animations, frame, fps]);

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} scale={1} position={[0, 0, 0]} />
    </group>
  );
};
