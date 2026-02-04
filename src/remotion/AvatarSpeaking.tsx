import { ThreeCanvas } from '@remotion/three';
import { Audio, useVideoConfig, staticFile } from 'remotion';
import { AnimatedAvatar } from './components/AnimatedAvatar';
import { Scene } from './components/Scene';
import { LipSyncController } from './components/LipSyncController';
import type { AvatarSpeakingProps } from './Root';
import type { AnimationSegmentWithDefaults } from '../config/animation-types';

const DEFAULT_SEGMENT: AnimationSegmentWithDefaults = {
  clip: '',
  start: 0,
  end: 0,
  weight: 1,
  loop: false,
};

export const AvatarSpeaking: React.FC<AvatarSpeakingProps> = ({
  avatarPath = '',
  audioPath = '',
  morphTargetsPerFrame = [],
  animations = [],
  cameraPreset = 'medium',
  lightingPreset = 'soft',
  background = '#1a1a2e',
}) => {
  const { width, height } = useVideoConfig();

  if (!avatarPath) {
    return <div style={{ background, width, height }} />;
  }

  // Use first animation segment or default (no animation)
  const segment = animations.length > 0 ? animations[0] : DEFAULT_SEGMENT;

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
            <AnimatedAvatar avatarPath={avatarPath} segment={segment} />
          </LipSyncController>
        </Scene>
      </ThreeCanvas>
    </>
  );
};
