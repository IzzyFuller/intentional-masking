import { describe, it, expect, vi } from 'vitest';
import { join } from 'path';
import { renderSpeakingVideo } from './tools/render-speaking-video.js';

const PROJECT_ROOT = process.cwd();
const TEST_AVATAR = join(PROJECT_ROOT, 'assets/sample_avatar.glb');
const TEST_AUDIO = join(PROJECT_ROOT, 'test_audio.wav');

// Mock only the rendering boundary - the actual Remotion video rendering
vi.mock('@remotion/bundler', () => ({
  bundle: vi.fn().mockResolvedValue('/tmp/mock-bundle'),
}));

vi.mock('@remotion/renderer', () => ({
  selectComposition: vi.fn().mockResolvedValue({
    id: 'AvatarSpeaking',
    width: 1080,
    height: 1080,
    fps: 30,
    durationInFrames: 1,
    defaultProps: {},
  }),
  renderMedia: vi.fn().mockResolvedValue(undefined),
}));

describe('render_speaking_video tool', () => {
  it('returns video path when avatar and audio exist', async () => {
    const result = await renderSpeakingVideo({
      avatar_path: TEST_AVATAR,
      audio_path: TEST_AUDIO,
    });

    expect(result.success).toBe(true);
    expect(result.video_path).toMatch(/\.mp4$/);
    expect(result.duration_seconds).toBeGreaterThan(0);
  });

  it('accepts camera and lighting presets', async () => {
    const result = await renderSpeakingVideo({
      avatar_path: TEST_AVATAR,
      audio_path: TEST_AUDIO,
      camera_preset: 'medium',
      lighting_preset: 'natural',
    });

    expect(result.success).toBe(true);
  });

  it('uses custom output path when provided', async () => {
    const customPath = '/tmp/test_video.mp4';
    const result = await renderSpeakingVideo({
      avatar_path: TEST_AVATAR,
      audio_path: TEST_AUDIO,
      output_path: customPath,
    });

    expect(result.success).toBe(true);
    expect(result.video_path).toBe(customPath);
  });

  it('returns error when avatar file not found', async () => {
    const result = await renderSpeakingVideo({
      avatar_path: '/nonexistent/avatar.glb',
      audio_path: TEST_AUDIO,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error when audio file not found', async () => {
    const result = await renderSpeakingVideo({
      avatar_path: TEST_AVATAR,
      audio_path: '/nonexistent/audio.wav',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
