/**
 * Animation segment types for body animation support
 * Animations are embedded in the avatar GLB file, selected by clip name
 */

export interface AnimationSegment {
  clip: string;      // Clip name in avatar GLB (e.g., "Talking", "Idle")
  start: number;     // Start time in seconds (in output video)
  end: number;       // End time in seconds (in output video)
  weight?: number;   // Blend weight 0-1 (default: 1.0)
  loop?: boolean;    // Loop within segment (default: false)
}

export interface AnimationSegmentWithDefaults {
  clip: string;
  start: number;
  end: number;
  weight: number;
  loop: boolean;
}

export function normalizeAnimationSegment(segment: AnimationSegment): AnimationSegmentWithDefaults {
  return {
    clip: segment.clip,
    start: segment.start,
    end: segment.end,
    weight: segment.weight ?? 1.0,
    loop: segment.loop ?? false,
  };
}
