/**
 * Animation segment types for body animation support
 */

export interface AnimationSegment {
  file: string;      // Path to animation GLB file (from Mixamo or other source)
  clip?: string;     // Clip name within file (default: first clip)
  start: number;     // Start time in seconds (in output video)
  end: number;       // End time in seconds (in output video)
  weight?: number;   // Blend weight 0-1 (default: 1.0)
  loop?: boolean;    // Loop within segment (default: false)
}

export interface AnimationSegmentWithDefaults {
  file: string;
  clip: string;
  start: number;
  end: number;
  weight: number;
  loop: boolean;
}

export function normalizeAnimationSegment(segment: AnimationSegment): AnimationSegmentWithDefaults {
  return {
    file: segment.file,
    clip: segment.clip || '',  // Empty string means first clip
    start: segment.start,
    end: segment.end,
    weight: segment.weight ?? 1.0,
    loop: segment.loop ?? false,
  };
}
