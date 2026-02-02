import { Composition } from 'remotion';
import { AvatarFrame } from './AvatarFrame';
import { AvatarSpeaking } from './AvatarSpeaking';
import type { MorphTargetValues } from '../config/viseme-map';

export interface AvatarFrameProps {
  avatarPath?: string;
  expression?: 'neutral' | 'happy' | 'thinking' | 'surprised';
  pose?: 'default' | 'greeting' | 'listening';
  cameraPreset?: 'closeup' | 'medium' | 'full';
  lightingPreset?: 'soft' | 'dramatic' | 'natural';
  background?: string;
}

export interface AvatarSpeakingProps {
  avatarPath?: string;
  audioPath?: string;
  morphTargetsPerFrame?: Array<{ frameNumber: number; morphTargets: MorphTargetValues }>;
  cameraPreset?: 'closeup' | 'medium' | 'full';
  lightingPreset?: 'soft' | 'dramatic' | 'natural';
  background?: string;
}

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="AvatarFrame"
        component={AvatarFrame}
        durationInFrames={1}
        fps={30}
        width={1080}
        height={1080}
        defaultProps={{
          avatarPath: 'sample_avatar.glb',
          expression: 'neutral' as const,
          pose: 'default' as const,
          cameraPreset: 'full' as const,
          lightingPreset: 'soft' as const,
          background: '#1a1a2e',
        }}
      />
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
    </>
  );
};
