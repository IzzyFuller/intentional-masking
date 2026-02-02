import { useGLTF } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import type { AnimationSegmentWithDefaults } from '../../config/animation-types';
import {
  createAnimationMixer,
  calculateAnimationTime,
  applyMorphTargets,
} from '../../services/animation-service';

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

  // Load GLTFs (adapter layer - talks to external system)
  const avatarUrl = staticFile(avatarPath);
  const animationUrl = staticFile(animationPath);
  const { scene: avatarScene } = useGLTF(avatarUrl);
  const { animations } = useGLTF(animationUrl);

  // Clone scene (using Three.js utility)
  const clonedScene = useMemo(() => {
    return SkeletonUtils.clone(avatarScene);
  }, [avatarScene]);

  // Set up animation mixer (service handles the logic)
  const { mixer, clipDuration } = useMemo(() => {
    return createAnimationMixer(clonedScene, animations, segment);
  }, [clonedScene, animations, segment]);

  // Sync animation to frame (service calculates time)
  useEffect(() => {
    if (!mixer) return;
    const time = calculateAnimationTime(frame, fps, segment.start, clipDuration, segment.loop);
    mixer.setTime(time);
  }, [mixer, frame, fps, segment.start, segment.loop, clipDuration]);

  // Apply morph targets (service handles traversal)
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
