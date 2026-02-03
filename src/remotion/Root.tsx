import { Composition } from 'remotion';
import { AvatarSpeaking } from './AvatarSpeaking';
import { AvatarAnimated } from './AvatarAnimated';
import type { MorphTargetValues } from '../config/viseme-map';
import type { AnimationSegmentWithDefaults } from '../config/animation-types';

export interface AvatarSpeakingProps {
  avatarPath?: string;
  audioPath?: string;
  morphTargetsPerFrame?: Array<{ frameNumber: number; morphTargets: MorphTargetValues }>;
  cameraPreset?: 'closeup' | 'medium' | 'full';
  lightingPreset?: 'soft' | 'dramatic' | 'natural';
  background?: string;
}

export interface AvatarAnimatedProps {
  avatarPath?: string;
  audioPath?: string;
  morphTargetsPerFrame?: Array<{ frameNumber: number; morphTargets: MorphTargetValues }>;
  animations?: AnimationSegmentWithDefaults[];
  cameraPreset?: 'closeup' | 'medium' | 'full';
  lightingPreset?: 'soft' | 'dramatic' | 'natural';
  background?: string;
}

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="AvatarSpeaking"
        component={AvatarSpeaking}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          avatarPath: '',
          audioPath: '',
          morphTargetsPerFrame: [],
          cameraPreset: 'medium' as const,
          lightingPreset: 'soft' as const,
          background: '#1a1a2e',
        }}
      />
      <Composition
        id="AvatarAnimated"
        component={AvatarAnimated}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          avatarPath: '',
          audioPath: '',
          morphTargetsPerFrame: [],
          animations: [],
          cameraPreset: 'medium' as const,
          lightingPreset: 'soft' as const,
          background: '#1a1a2e',
        }}
      />
    </>
  );
};
