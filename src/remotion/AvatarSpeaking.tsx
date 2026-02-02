import { ThreeCanvas } from '@remotion/three';
import { Audio, useVideoConfig, staticFile } from 'remotion';
import { Avatar } from './components/Avatar';
import { Scene } from './components/Scene';
import { LipSyncController } from './components/LipSyncController';
import type { AvatarSpeakingProps } from './Root';

export const AvatarSpeaking: React.FC<AvatarSpeakingProps> = ({
  avatarPath = '',
  audioPath = '',
  morphTargetsPerFrame = [],
  cameraPreset = 'medium',
  lightingPreset = 'soft',
  background = '#1a1a2e',
}) => {
  const { width, height } = useVideoConfig();

  if (!avatarPath) {
    return <div style={{ background, width, height }} />;
  }

  return (
    <>
      {audioPath && <Audio src={staticFile(audioPath)} />}

      <ThreeCanvas
        orthographic={false}
        width={width}
        height={height}
        style={{ backgroundColor: background }}
      >
        <Scene cameraPreset={cameraPreset} lightingPreset={lightingPreset}>
          <LipSyncController morphTargetsPerFrame={morphTargetsPerFrame}>
            <Avatar avatarPath={avatarPath} expression="neutral" pose="default" />
          </LipSyncController>
        </Scene>
      </ThreeCanvas>
    </>
  );
};
