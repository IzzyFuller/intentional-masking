import { describe, it, expect, vi } from 'vitest';
import { join } from 'path';
import { renderAnimatedVideo } from './render-animated-video.js';

const PROJECT_ROOT = process.cwd();
const TEST_AVATAR = join(PROJECT_ROOT, 'assets/sample_avatar.glb');
const TEST_AUDIO = join(PROJECT_ROOT, 'test_audio.wav');
// Use a real file that exists for animation test - we'll use the avatar as a stand-in
const TEST_ANIMATION = join(PROJECT_ROOT, 'assets/sample_avatar.glb');

// Mock only the rendering boundary - the actual Remotion video rendering
vi.mock('@remotion/bundler', () => ({
  bundle: vi.fn().mockResolvedValue('/tmp/mock-bundle'),
}));

vi.mock('@remotion/renderer', () => ({
  selectComposition: vi.fn().mockResolvedValue({
    id: 'AvatarAnimated',
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 150,
    defaultProps: {},
  }),
  renderMedia: vi.fn().mockResolvedValue(undefined),
}));

describe('render_animated_video tool', () => {
  it('returns video path when avatar, audio, and animations exist', async () => {
    const result = await renderAnimatedVideo({
      avatar_path: TEST_AVATAR,
      audio_path: TEST_AUDIO,
      animations: [
        { file: TEST_ANIMATION, start: 0, end: 2 },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.video_path).toMatch(/\.mp4$/);
    expect(result.duration_seconds).toBeGreaterThan(0);
  });

  it('accepts multiple animation segments', async () => {
    const result = await renderAnimatedVideo({
      avatar_path: TEST_AVATAR,
      audio_path: TEST_AUDIO,
      animations: [
        { file: TEST_ANIMATION, start: 0, end: 1, weight: 0.5 },
        { file: TEST_ANIMATION, start: 1, end: 2, loop: true },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('accepts camera and lighting presets', async () => {
    const result = await renderAnimatedVideo({
      avatar_path: TEST_AVATAR,
      audio_path: TEST_AUDIO,
      animations: [
        { file: TEST_ANIMATION, start: 0, end: 2 },
      ],
      camera_preset: 'full',
      lighting_preset: 'dramatic',
    });

    expect(result.success).toBe(true);
  });

  it('uses custom output path when provided', async () => {
    const customPath = '/tmp/test_animated_video.mp4';
    const result = await renderAnimatedVideo({
      avatar_path: TEST_AVATAR,
      audio_path: TEST_AUDIO,
      animations: [
        { file: TEST_ANIMATION, start: 0, end: 2 },
      ],
      output_path: customPath,
    });

    expect(result.success).toBe(true);
    expect(result.video_path).toBe(customPath);
  });

  it('returns error when avatar file not found', async () => {
    const result = await renderAnimatedVideo({
      avatar_path: '/nonexistent/avatar.glb',
      audio_path: TEST_AUDIO,
      animations: [
        { file: TEST_ANIMATION, start: 0, end: 2 },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error when audio file not found', async () => {
    const result = await renderAnimatedVideo({
      avatar_path: TEST_AVATAR,
      audio_path: '/nonexistent/audio.wav',
      animations: [
        { file: TEST_ANIMATION, start: 0, end: 2 },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error when animation file not found', async () => {
    const result = await renderAnimatedVideo({
      avatar_path: TEST_AVATAR,
      audio_path: TEST_AUDIO,
      animations: [
        { file: '/nonexistent/animation.glb', start: 0, end: 2 },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('works with empty animations array', async () => {
    const result = await renderAnimatedVideo({
      avatar_path: TEST_AVATAR,
      audio_path: TEST_AUDIO,
      animations: [],
    });

    expect(result.success).toBe(true);
  });
});
