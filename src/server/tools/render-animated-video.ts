import { renderMedia, selectComposition } from '@remotion/renderer';
import { bundle } from '@remotion/bundler';
import { dirname, join, basename } from 'path';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { generateVisemesFromAudio, computeMorphTargetsForFrames } from '../services/lip-sync.js';
import { normalizeAnimationSegment, type AnimationSegment } from '../../config/animation-types.js';

const PROJECT_ROOT = process.env.INTENTIONAL_MASKING_ROOT || process.cwd();
const OUTPUT_DIR = process.env.INTENTIONAL_MASKING_OUTPUT || `${PROJECT_ROOT}/output`;
const REMOTION_ENTRY = `${PROJECT_ROOT}/src/remotion/index.ts`;

export interface RenderAnimatedVideoArgs {
  avatar_path: string;
  audio_path: string;
  animations: AnimationSegment[];
  camera_preset?: 'closeup' | 'medium' | 'full';
  lighting_preset?: 'soft' | 'dramatic' | 'natural';
  background?: string;
  output_path?: string;
}

export interface RenderAnimatedVideoResult {
  success: boolean;
  video_path?: string;
  duration_seconds?: number;
  error?: string;
}

export async function renderAnimatedVideo(args: RenderAnimatedVideoArgs): Promise<RenderAnimatedVideoResult> {
  const {
    avatar_path,
    audio_path,
    animations = [],
    camera_preset = 'medium',
    lighting_preset = 'soft',
    background = '#1a1a2e',
    output_path,
  } = args;

  const timestamp = Date.now();
  const outputPath = output_path || join(OUTPUT_DIR, `animated_${timestamp}.mp4`);

  try {
    // Verify avatar and audio files exist
    await fs.access(avatar_path);
    await fs.access(audio_path);

    // Verify all animation files exist
    for (const segment of animations) {
      await fs.access(segment.file);
    }

    // Create temp directory for Remotion assets
    const tempPublicDir = join(tmpdir(), `remotion-animated-${timestamp}`);
    await fs.mkdir(tempPublicDir, { recursive: true });

    // Copy avatar and audio to temp folder
    const avatarFilename = basename(avatar_path);
    const audioFilename = basename(audio_path);
    await fs.copyFile(avatar_path, join(tempPublicDir, avatarFilename));
    await fs.copyFile(audio_path, join(tempPublicDir, audioFilename));

    // Copy animation files and normalize segments
    const normalizedAnimations = await Promise.all(
      animations.map(async (segment) => {
        const animFilename = basename(segment.file);
        const destPath = join(tempPublicDir, animFilename);

        // Only copy if not already copied (same filename)
        try {
          await fs.access(destPath);
        } catch {
          await fs.copyFile(segment.file, destPath);
        }

        const normalized = normalizeAnimationSegment(segment);
        return {
          ...normalized,
          file: animFilename,  // Use just filename for staticFile()
        };
      })
    );

    // Ensure output directory exists
    await fs.mkdir(dirname(outputPath), { recursive: true });

    // Generate viseme timing from audio (for lip sync)
    const visemeData = await generateVisemesFromAudio(audio_path);

    // Pre-compute morph targets for each frame
    const fps = 30;
    const lipSyncData = computeMorphTargetsForFrames(visemeData, fps);

    // Calculate duration (add 0.5s padding at end)
    const durationSeconds = visemeData.duration + 0.5;
    const durationInFrames = Math.ceil(durationSeconds * fps);

    // Bundle the Remotion project
    const bundleLocation = await bundle({
      entryPoint: REMOTION_ENTRY,
      publicDir: tempPublicDir,
      onProgress: (_progress: number) => {},
    });

    const inputProps = {
      avatarPath: avatarFilename,
      audioPath: audioFilename,
      morphTargetsPerFrame: lipSyncData.morphTargetsPerFrame,
      animations: normalizedAnimations,
      cameraPreset: camera_preset,
      lightingPreset: lighting_preset,
      background,
    };

    // Get the composition (with WebGL support for Three.js)
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'AvatarAnimated',
      inputProps,
      chromiumOptions: { gl: 'angle-egl' },
    });

    // Override duration based on audio
    const finalComposition = {
      ...composition,
      durationInFrames,
    };

    // Render the video
    await renderMedia({
      composition: finalComposition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps,
      chromiumOptions: { gl: 'angle-egl' },
    });

    return {
      success: true,
      video_path: outputPath,
      duration_seconds: durationSeconds,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
