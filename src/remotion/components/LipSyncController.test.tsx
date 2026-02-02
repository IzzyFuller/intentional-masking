import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { LipSyncController } from './LipSyncController';

// Mock Remotion's useCurrentFrame
vi.mock('remotion', () => ({
  useCurrentFrame: vi.fn(),
}));

import { useCurrentFrame } from 'remotion';

describe('LipSyncController', () => {
  it('passes correct morphTargets for current frame', () => {
    vi.mocked(useCurrentFrame).mockReturnValue(2);

    const morphTargetsPerFrame = [
      { frameNumber: 0, morphTargets: { viseme_aa: 0.5 } },
      { frameNumber: 1, morphTargets: { viseme_O: 0.3 } },
      { frameNumber: 2, morphTargets: { viseme_E: 0.8 } },
      { frameNumber: 3, morphTargets: { viseme_U: 0.4 } },
    ];

    let receivedMorphTargets: Record<string, number> | undefined;

    const MockChild = ({ morphTargets }: { morphTargets?: Record<string, number> }) => {
      receivedMorphTargets = morphTargets;
      return <div data-testid="child" />;
    };

    render(
      <LipSyncController morphTargetsPerFrame={morphTargetsPerFrame}>
        <MockChild />
      </LipSyncController>
    );

    expect(receivedMorphTargets).toEqual({ viseme_E: 0.8 });
  });

  it('uses last frame data when current frame exceeds array length', () => {
    vi.mocked(useCurrentFrame).mockReturnValue(100);

    const morphTargetsPerFrame = [
      { frameNumber: 0, morphTargets: { viseme_aa: 0.5 } },
      { frameNumber: 1, morphTargets: { viseme_O: 0.3 } },
    ];

    let receivedMorphTargets: Record<string, number> | undefined;

    const MockChild = ({ morphTargets }: { morphTargets?: Record<string, number> }) => {
      receivedMorphTargets = morphTargets;
      return <div />;
    };

    render(
      <LipSyncController morphTargetsPerFrame={morphTargetsPerFrame}>
        <MockChild />
      </LipSyncController>
    );

    expect(receivedMorphTargets).toEqual({ viseme_O: 0.3 });
  });

  it('returns empty morphTargets when array is empty', () => {
    vi.mocked(useCurrentFrame).mockReturnValue(0);

    let receivedMorphTargets: Record<string, number> | undefined;

    const MockChild = ({ morphTargets }: { morphTargets?: Record<string, number> }) => {
      receivedMorphTargets = morphTargets;
      return <div />;
    };

    render(
      <LipSyncController morphTargetsPerFrame={[]}>
        <MockChild />
      </LipSyncController>
    );

    expect(receivedMorphTargets).toEqual({});
  });

  it('preserves existing child props while adding morphTargets', () => {
    vi.mocked(useCurrentFrame).mockReturnValue(0);

    const morphTargetsPerFrame = [
      { frameNumber: 0, morphTargets: { viseme_aa: 0.5 } },
    ];

    let receivedProps: Record<string, unknown> | undefined;

    const MockChild = (props: Record<string, unknown>) => {
      receivedProps = props;
      return <div />;
    };

    render(
      <LipSyncController morphTargetsPerFrame={morphTargetsPerFrame}>
        <MockChild existingProp="value" anotherProp={42} />
      </LipSyncController>
    );

    expect(receivedProps).toMatchObject({
      existingProp: 'value',
      anotherProp: 42,
      morphTargets: { viseme_aa: 0.5 },
    });
  });
});
