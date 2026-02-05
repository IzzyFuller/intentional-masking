import { promises as fs } from 'fs';
import { join } from 'path';
import { generateVisemesFromAudio } from '../services/lip-sync.js';
import { normalizeAnimationSegment, type AnimationSegment } from '../../config/animation-types.js';
import { renderVideo } from '../services/puppeteer-renderer.js';

const PROJECT_ROOT = process.env.INTENTIONAL_MASKING_ROOT || process.cwd();
const OUTPUT_DIR = process.env.INTENTIONAL_MASKING_OUTPUT || `${PROJECT_ROOT}/output`;

export interface RenderSpeakingVideoArgs {
  avatar_path: string;
  audio_path: string;
  animations?: AnimationSegment[];
  camera_preset?: 'closeup' | 'medium' | 'full';
  lighting_preset?: 'soft' | 'dramatic' | 'natural';
  background?: string;
  output_path?: string;
}

export interface RenderSpeakingVideoResult {
  success: boolean;
  video_path?: string;
  duration_seconds?: number;
  error?: string;
}

export async function renderSpeakingVideo(args: RenderSpeakingVideoArgs): Promise<RenderSpeakingVideoResult> {
  // Validate: empty animations array is an error (check before destructuring)
  if (args.animations !== undefined && args.animations.length === 0) {
    return {
      success: false,
      error: 'animations array cannot be empty. Omit the parameter for lip-sync only, or provide animation segments.',
    };
  }

  const {
    avatar_path,
    audio_path,
    animations = [],
    background = '#1a1a2e',
    output_path,
  } = args;

  const timestamp = Date.now();
  const outputPath = output_path || join(OUTPUT_DIR, `speaking_${timestamp}.mp4`);

  try {
    // Verify files exist
    await fs.access(avatar_path);
    await fs.access(audio_path);

    // Get audio duration from viseme analysis
    const visemeData = await generateVisemesFromAudio(audio_path);
    const durationSeconds = visemeData.duration + 0.5; // Add padding

    // Normalize animation segments
    const normalizedAnimations = animations.map(normalizeAnimationSegment);

    // Render using Puppeteer + r3f-video-recorder
    const result = await renderVideo({
      avatarPath: avatar_path,
      audioPath: audio_path,
      visemes: visemeData.frames,
      animations: normalizedAnimations,
      cameraPreset: args.camera_preset || 'medium',
      background,
      duration: durationSeconds,
      outputPath,
    });

    if (result.success) {
      return {
        success: true,
        video_path: result.videoPath,
        duration_seconds: result.durationSeconds,
      };
    } else {
      return {
        success: false,
        error: result.error,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
