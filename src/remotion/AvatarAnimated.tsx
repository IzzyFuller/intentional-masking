import { ThreeCanvas } from '@remotion/three';
import { Audio, Sequence, useVideoConfig, staticFile } from 'remotion';
import { AnimatedAvatar } from './components/AnimatedAvatar';
import { Scene } from './components/Scene';
import { LipSyncController } from './components/LipSyncController';
import type { MorphTargetValues } from '../config/viseme-map';
import type { AnimationSegmentWithDefaults } from '../config/animation-types';

export interface AvatarAnimatedProps {
  avatarPath?: string;
  audioPath?: string;
  morphTargetsPerFrame?: Array<{ frameNumber: number; morphTargets: MorphTargetValues }>;
  animations?: AnimationSegmentWithDefaults[];
  cameraPreset?: 'closeup' | 'medium' | 'full';
  lightingPreset?: 'soft' | 'dramatic' | 'natural';
  background?: string;
}

export const AvatarAnimated: React.FC<AvatarAnimatedProps> = ({
  avatarPath = '',
  audioPath = '',
  morphTargetsPerFrame = [],
  animations = [],
  cameraPreset = 'medium',
  lightingPreset = 'soft',
  background = '#1a1a2e',
}) => {
  const { width, height, fps } = useVideoConfig();

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
            {/* Layer animations using Sequence - each renders AnimatedAvatar for its time range */}
            {animations.length > 0 ? (
              animations.map((segment, index) => {
                const startFrame = Math.floor(segment.start * fps);
                const durationFrames = Math.ceil((segment.end - segment.start) * fps);

                return (
                  <Sequence
                    key={`${segment.clip}-${index}`}
                    from={startFrame}
                    durationInFrames={durationFrames}
                    layout="none"
                  >
                    <AnimatedAvatar
                      avatarPath={avatarPath}
                      segment={segment}
                    />
                  </Sequence>
                );
              })
            ) : (
              // No animations - render static avatar (fallback)
              <AnimatedAvatar
                avatarPath={avatarPath}
                segment={{
                  clip: '',
                  start: 0,
                  end: 0,
                  weight: 1,
                  loop: false,
                }}
              />
            )}
          </LipSyncController>
        </Scene>
      </ThreeCanvas>
    </>
  );
};
