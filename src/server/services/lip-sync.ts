import { RHUBARB_TO_RPM, type VisemeFrame, type MorphTargetValues } from '../../config/viseme-map.js';
import { promises as fs } from 'fs';
import { Rhubarb } from 'rhubarb-lip-sync-wasm';

export interface VisemeData {
  frames: VisemeFrame[];
  duration: number;
}

export interface FrameMorphTargets {
  frameNumber: number;
  morphTargets: MorphTargetValues;
}

export interface LipSyncData {
  morphTargetsPerFrame: FrameMorphTargets[];
  duration: number;
  fps: number;
}

/**
 * Generate viseme timing data from an audio file using rhubarb-lip-sync-wasm.
 *
 * Expects 16kHz 16-bit mono PCM WAV file (as produced by info-dump).
 */
export async function generateVisemesFromAudio(audioPath: string, dialogText?: string): Promise<VisemeData> {
  // Read WAV file and extract PCM data (skip 44-byte WAV header)
  const wavBuffer = await fs.readFile(audioPath);
  const pcmData = Buffer.from(wavBuffer.buffer, wavBuffer.byteOffset + 44, wavBuffer.length - 44);

  // Run rhubarb lip-sync analysis
  const result = await Rhubarb.getLipSync(pcmData, dialogText ? { dialogText } : undefined);

  if (result.mouthCues.length === 0) {
    throw new Error('Rhubarb returned no mouth cues - audio may be silent or invalid');
  }

  // Convert to our VisemeFrame format
  const frames = parseRhubarbOutput(result);

  // Calculate duration from last cue
  const lastCue = result.mouthCues[result.mouthCues.length - 1];
  const duration = lastCue.end;

  return { frames, duration };
}

/**
 * Parse Rhubarb JSON output into our VisemeFrame format.
 */
export function parseRhubarbOutput(rhubarbJson: {
  mouthCues: Array<{ start: number; end: number; value: string }>;
}): VisemeFrame[] {
  return rhubarbJson.mouthCues.map((cue) => ({
    time: cue.start,
    viseme: cue.value,
    duration: cue.end - cue.start,
  }));
}

/**
 * Pre-compute morph targets for every frame of the video.
 * This moves interpolation from render-time to build-time.
 */
export function computeMorphTargetsForFrames(
  visemeData: VisemeData,
  fps: number = 30,
  blendDuration: number = 0.05
): LipSyncData {
  const totalFrames = Math.ceil((visemeData.duration + 0.5) * fps);
  const morphTargetsPerFrame: FrameMorphTargets[] = [];

  for (let frame = 0; frame < totalFrames; frame++) {
    const currentTime = frame / fps;
    const morphTargets = interpolateVisemes(visemeData.frames, currentTime, blendDuration);
    morphTargetsPerFrame.push({ frameNumber: frame, morphTargets });
  }

  return {
    morphTargetsPerFrame,
    duration: visemeData.duration,
    fps,
  };
}

/**
 * Interpolate between viseme frames for smooth transitions.
 * Pure function: viseme frames + time → morph target values.
 */
export function interpolateVisemes(
  frames: VisemeFrame[],
  currentTime: number,
  blendDuration: number = 0.05
): MorphTargetValues {
  let currentFrame: VisemeFrame | undefined;
  let nextFrame: VisemeFrame | undefined;

  for (let i = 0; i < frames.length; i++) {
    if (frames[i].time <= currentTime) {
      currentFrame = frames[i];
      nextFrame = frames[i + 1];
    } else {
      break;
    }
  }

  if (!currentFrame) {
    return RHUBARB_TO_RPM['X'];
  }

  const currentMorphs = RHUBARB_TO_RPM[currentFrame.viseme] || RHUBARB_TO_RPM['X'];

  if (!nextFrame) {
    return currentMorphs;
  }

  const frameEnd = currentFrame.time + currentFrame.duration;
  const transitionStart = frameEnd - blendDuration;

  if (currentTime >= transitionStart && currentTime < frameEnd) {
    const blendFactor = (currentTime - transitionStart) / blendDuration;
    const nextMorphs = RHUBARB_TO_RPM[nextFrame.viseme] || RHUBARB_TO_RPM['X'];

    const result: MorphTargetValues = {};
    const allKeys = new Set([...Object.keys(currentMorphs), ...Object.keys(nextMorphs)]);

    for (const key of allKeys) {
      const currentVal = currentMorphs[key] || 0;
      const nextVal = nextMorphs[key] || 0;
      result[key] = currentVal + (nextVal - currentVal) * blendFactor;
    }

    return result;
  }

  return currentMorphs;
}
