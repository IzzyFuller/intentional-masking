import { useGLTF } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { staticFile } from 'remotion';

export interface AvatarProps {
  avatarPath: string;  // filename in public/ folder
  expression: 'neutral' | 'happy' | 'thinking' | 'surprised';
  pose: 'default' | 'greeting' | 'listening';
  morphTargets?: Record<string, number>;
}

const EXPRESSIONS: Record<string, Record<string, number>> = {
  neutral: {},
  happy: {
    'mouthSmile': 0.7,
    'eyeSquintLeft': 0.3,
    'eyeSquintRight': 0.3,
  },
  thinking: {
    'browInnerUp': 0.5,
    'eyeLookUpLeft': 0.3,
    'eyeLookUpRight': 0.3,
  },
  surprised: {
    'browOuterUpLeft': 0.8,
    'browOuterUpRight': 0.8,
    'jawOpen': 0.3,
    'eyeWideLeft': 0.5,
    'eyeWideRight': 0.5,
  },
};

export const Avatar: React.FC<AvatarProps> = ({
  avatarPath,
  expression,
  pose,
  morphTargets = {},
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const avatarUrl = staticFile(avatarPath);
  const { scene } = useGLTF(avatarUrl);

  // Clone scene and apply morph targets SYNCHRONOUSLY (required for Remotion)
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);

    const expressionMorphs = EXPRESSIONS[expression] || {};
    const combinedMorphs = { ...expressionMorphs, ...morphTargets };

    clone.traverse((child: THREE.Object3D) => {
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

    // Apply pose
    switch (pose) {
      case 'greeting':
        clone.rotation.z = 0.05;
        break;
      case 'listening':
        clone.rotation.x = 0.02;
        break;
      default:
        clone.rotation.set(0, 0, 0);
    }

    return clone;
  }, [scene, expression, pose, morphTargets]);

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} scale={1} position={[0, 0, 0]} />
    </group>
  );
};
