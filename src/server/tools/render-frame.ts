import { renderStill, selectComposition } from '@remotion/renderer';
import { bundle } from '@remotion/bundler';
import { dirname, join, basename } from 'path';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';

const PROJECT_ROOT = process.env.INTENTIONAL_MASKING_ROOT || process.cwd();
const OUTPUT_DIR = process.env.INTENTIONAL_MASKING_OUTPUT || `${PROJECT_ROOT}/output`;
const REMOTION_ENTRY = `${PROJECT_ROOT}/src/remotion/index.ts`;

export interface RenderFrameArgs {
  avatar_path: string;
  expression?: 'neutral' | 'happy' | 'thinking' | 'surprised';
  pose?: 'default' | 'greeting' | 'listening';
  camera_preset?: 'closeup' | 'medium' | 'full';
  lighting_preset?: 'soft' | 'dramatic' | 'natural';
  background?: string;
  output_path?: string;
}

export interface RenderFrameResult {
  success: boolean;
  image_path?: string;
  error?: string;
}

export async function renderFrame(args: RenderFrameArgs): Promise<RenderFrameResult> {
  const {
    avatar_path,
    expression = 'neutral',
    pose = 'default',
    camera_preset = 'medium',
    lighting_preset = 'soft',
    background = '#1a1a2e',
    output_path,
  } = args;

  const timestamp = Date.now();
  const outputPath = output_path || join(OUTPUT_DIR, `frame_${timestamp}.png`);

  try {
    // Verify avatar file exists
    await fs.access(avatar_path);

    // Create temp directory for Remotion assets (OS will clean up /tmp)
    const tempPublicDir = join(tmpdir(), `remotion-frame-${timestamp}`);
    await fs.mkdir(tempPublicDir, { recursive: true });

    // Copy avatar to temp folder for Remotion to access
    const avatarFilename = basename(avatar_path);
    await fs.copyFile(avatar_path, join(tempPublicDir, avatarFilename));

    // Ensure output directory exists
    await fs.mkdir(dirname(outputPath), { recursive: true });

    // Bundle the Remotion project
    const bundleLocation = await bundle({
      entryPoint: REMOTION_ENTRY,
      publicDir: tempPublicDir,
      onProgress: (_progress: number) => {},
    });

    const inputProps = {
      avatarPath: avatarFilename,  // Just filename, loaded via staticFile()
      expression,
      pose,
      cameraPreset: camera_preset,
      lightingPreset: lighting_preset,
      background,
    };

    // Get the composition (with WebGL support for Three.js)
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'AvatarFrame',
      inputProps,
      chromiumOptions: { gl: 'angle' },
    });

    // Render a single frame
    await renderStill({
      composition,
      serveUrl: bundleLocation,
      output: outputPath,
      inputProps,
      chromiumOptions: { gl: 'angle' },
    });

    return {
      success: true,
      image_path: outputPath,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
