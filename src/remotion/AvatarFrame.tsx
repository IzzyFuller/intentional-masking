import { ThreeCanvas } from '@remotion/three';
import { useVideoConfig } from 'remotion';
import { Suspense } from 'react';
import { Avatar } from './components/Avatar';
import { Scene } from './components/Scene';
import type { AvatarFrameProps } from './Root';

export const AvatarFrame: React.FC<AvatarFrameProps> = ({
  avatarPath = '',
  expression = 'neutral',
  pose = 'default',
  cameraPreset = 'medium',
  lightingPreset = 'soft',
  background = '#1a1a2e',
}) => {
  const { width, height } = useVideoConfig();

  if (!avatarPath) {
    return <div style={{ background, width, height }} />;
  }

  return (
    <ThreeCanvas
      orthographic={false}
      width={width}
      height={height}
      style={{ backgroundColor: background }}
    >
      <Scene cameraPreset={cameraPreset} lightingPreset={lightingPreset}>
        <Suspense fallback={null}>
          <Avatar avatarPath={avatarPath} expression={expression} pose={pose} />
        </Suspense>
      </Scene>
    </ThreeCanvas>
  );
};
