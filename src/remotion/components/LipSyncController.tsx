import { cloneElement, isValidElement, type ReactElement } from 'react';
import { useCurrentFrame } from 'remotion';
import type { MorphTargetValues } from '../../config/viseme-map';
import type { AnimatedAvatarProps } from './AnimatedAvatar';

export interface LipSyncControllerProps {
  morphTargetsPerFrame: Array<{ frameNumber: number; morphTargets: MorphTargetValues }>;
  children: ReactElement<AnimatedAvatarProps>;
}

export const LipSyncController: React.FC<LipSyncControllerProps> = ({
  morphTargetsPerFrame,
  children,
}) => {
  const frame = useCurrentFrame();

  // Look up pre-computed morph targets for current frame
  const frameData = morphTargetsPerFrame[frame] || morphTargetsPerFrame[morphTargetsPerFrame.length - 1];
  const morphTargets = frameData?.morphTargets || {};

  if (!isValidElement(children)) {
    return null;
  }

  return cloneElement(children, {
    ...children.props,
    morphTargets,
  });
};
