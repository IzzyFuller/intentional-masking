import { Environment, PerspectiveCamera } from '@react-three/drei';
import type { ReactNode } from 'react';

export interface SceneProps {
  children: ReactNode;
  cameraPreset?: 'closeup' | 'medium' | 'full';
  lightingPreset?: 'soft' | 'dramatic' | 'natural';
}

const CAMERA_PRESETS = {
  closeup: { position: [0, 1.6, 1.2] as [number, number, number], lookAt: [0, 1.45, 0] as [number, number, number], fov: 35 },
  medium: { position: [0, 1.35, 2.2] as [number, number, number], lookAt: [0, 1.2, 0] as [number, number, number], fov: 45 },
  full: { position: [0, 0.9, 4.0] as [number, number, number], lookAt: [0, 0.8, 0] as [number, number, number], fov: 50 },
};

const LIGHTING_PRESETS = {
  soft: {
    ambient: 0.6,
    keyLight: { intensity: 0.8, position: [2, 2, 2] as [number, number, number] },
    fillLight: { intensity: 0.4, position: [-2, 1, 2] as [number, number, number] },
  },
  dramatic: {
    ambient: 0.2,
    keyLight: { intensity: 1.2, position: [3, 2, 1] as [number, number, number] },
    fillLight: { intensity: 0.1, position: [-2, 0, 2] as [number, number, number] },
  },
  natural: {
    ambient: 0.5,
    keyLight: { intensity: 0.6, position: [0, 3, 2] as [number, number, number] },
    fillLight: { intensity: 0.3, position: [-1, 1, 3] as [number, number, number] },
  },
};

export const Scene: React.FC<SceneProps> = ({
  children,
  cameraPreset = 'medium',
  lightingPreset = 'soft',
}) => {
  const camera = CAMERA_PRESETS[cameraPreset];
  const lighting = LIGHTING_PRESETS[lightingPreset];

  return (
    <>
      <PerspectiveCamera makeDefault position={camera.position} fov={camera.fov} onUpdate={(self) => self.lookAt(...camera.lookAt)} />
      <ambientLight intensity={lighting.ambient} />
      <directionalLight
        position={lighting.keyLight.position}
        intensity={lighting.keyLight.intensity}
        castShadow
      />
      <directionalLight
        position={lighting.fillLight.position}
        intensity={lighting.fillLight.intensity}
      />
      <Environment preset="city" />
      {children}
    </>
  );
};
