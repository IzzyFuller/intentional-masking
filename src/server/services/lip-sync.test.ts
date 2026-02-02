import { describe, it, expect } from 'vitest';
import { interpolateVisemes, computeMorphTargetsForFrames } from './lip-sync.js';
import { RHUBARB_TO_RPM, type VisemeFrame } from '../../config/viseme-map.js';

describe('interpolateVisemes', () => {
  it('returns silence for empty frames', () => {
    const result = interpolateVisemes([], 0);
    expect(result).toEqual(RHUBARB_TO_RPM['X']);
  });

  it('returns silence when time is before first frame', () => {
    const frames: VisemeFrame[] = [
      { time: 1.0, viseme: 'D', duration: 0.1 },
    ];
    const result = interpolateVisemes(frames, 0.5);
    expect(result).toEqual(RHUBARB_TO_RPM['X']);
  });

  it('returns correct viseme at frame start', () => {
    const frames: VisemeFrame[] = [
      { time: 0, viseme: 'A', duration: 0.1 },
    ];
    const result = interpolateVisemes(frames, 0);
    expect(result).toEqual(RHUBARB_TO_RPM['A']);
  });

  it('returns current viseme mid-frame', () => {
    const frames: VisemeFrame[] = [
      { time: 0, viseme: 'D', duration: 0.2 },
    ];
    const result = interpolateVisemes(frames, 0.1);
    expect(result).toEqual(RHUBARB_TO_RPM['D']);
  });

  it('blends during transition to next frame', () => {
    const frames: VisemeFrame[] = [
      { time: 0, viseme: 'D', duration: 0.1 },
      { time: 0.1, viseme: 'X', duration: 0.1 },
    ];
    // At 0.075, we're 50% through the 0.05s blend zone
    const result = interpolateVisemes(frames, 0.075, 0.05);

    expect(result['viseme_aa']).toBeCloseTo(0.5, 1);
    expect(result['viseme_sil']).toBeCloseTo(0.5, 1);
  });

  it('returns last viseme after all frames', () => {
    const frames: VisemeFrame[] = [
      { time: 0, viseme: 'A', duration: 0.1 },
      { time: 0.1, viseme: 'F', duration: 0.1 },
    ];
    const result = interpolateVisemes(frames, 0.5);
    expect(result).toEqual(RHUBARB_TO_RPM['F']);
  });

  it('falls back to silence for unknown viseme', () => {
    const frames: VisemeFrame[] = [
      { time: 0, viseme: 'UNKNOWN', duration: 0.1 },
    ];
    const result = interpolateVisemes(frames, 0);
    expect(result).toEqual(RHUBARB_TO_RPM['X']);
  });
});

describe('computeMorphTargetsForFrames', () => {
  it('generates morph targets for each frame', () => {
    const visemeData = {
      frames: [
        { time: 0, viseme: 'D', duration: 0.1 },
        { time: 0.1, viseme: 'X', duration: 0.1 },
      ],
      duration: 0.2,
    };

    const result = computeMorphTargetsForFrames(visemeData, 30);

    // 0.2s + 0.5s padding = 0.7s * 30fps = 21 frames
    expect(result.morphTargetsPerFrame.length).toBe(21);
    expect(result.fps).toBe(30);
    expect(result.duration).toBe(0.2);
  });

  it('first frame has correct morph targets', () => {
    const visemeData = {
      frames: [{ time: 0, viseme: 'D', duration: 0.5 }],
      duration: 0.5,
    };

    const result = computeMorphTargetsForFrames(visemeData, 30);

    expect(result.morphTargetsPerFrame[0].frameNumber).toBe(0);
    expect(result.morphTargetsPerFrame[0].morphTargets).toEqual(RHUBARB_TO_RPM['D']);
  });
});
