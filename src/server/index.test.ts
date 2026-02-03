import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'path';
import { promises as fs } from 'fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { IntentionalMaskingServer } from './index.js';

const PROJECT_ROOT = process.cwd();
const TEST_AVATAR = join(PROJECT_ROOT, 'assets/sample_avatar.glb');
const TEST_AUDIO = join(PROJECT_ROOT, 'test_audio.wav');
const TEST_AVATAR_ANIMATED = join(PROJECT_ROOT, 'assets/sample_avatar_animated.glb');

describe('IntentionalMaskingServer', () => {
  let server: IntentionalMaskingServer;
  let client: Client;
  let clientTransport: InMemoryTransport;
  let serverTransport: InMemoryTransport;

  beforeAll(async () => {
    // Create linked in-memory transports
    [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    // Start server
    server = new IntentionalMaskingServer();
    await server.connect(serverTransport);

    // Start client
    client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });
    await client.connect(clientTransport);
  });

  afterAll(async () => {
    await clientTransport.close();
    await serverTransport.close();
  });

  describe('tools/list', () => {
    it('lists available tools', async () => {
      const result = await client.listTools();

      expect(result.tools).toHaveLength(2);
      expect(result.tools.map(t => t.name)).toContain('render_speaking_video');
      expect(result.tools.map(t => t.name)).toContain('render_animated_video');
    });
  });

  describe('render_speaking_video', () => {
    it('renders video and returns result', async () => {
      const result = await client.callTool({
        name: 'render_speaking_video',
        arguments: {
          avatar_path: TEST_AVATAR,
          audio_path: TEST_AUDIO,
        },
      });

      const content = result.content as Array<{ type: string; text: string }>;
      expect(content).toHaveLength(1);
      const parsed = JSON.parse(content[0].text);

      expect(parsed.success).toBe(true);
      expect(parsed.video_path).toMatch(/\.mp4$/);
      expect(parsed.duration_seconds).toBeGreaterThan(0);

      // Verify actual file exists
      const stats = await fs.stat(parsed.video_path);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('returns error when avatar not found', async () => {
      const result = await client.callTool({
        name: 'render_speaking_video',
        arguments: {
          avatar_path: '/nonexistent/avatar.glb',
          audio_path: TEST_AUDIO,
        },
      });

      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBeDefined();
    });
  });

  describe('render_animated_video', () => {
    it('renders video with embedded animations', async () => {
      const result = await client.callTool({
        name: 'render_animated_video',
        arguments: {
          avatar_path: TEST_AVATAR_ANIMATED,
          audio_path: TEST_AUDIO,
          animations: [{ clip: 'Talking', start: 0, end: 2 }],
        },
      });

      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);

      expect(parsed.success).toBe(true);
      expect(parsed.video_path).toMatch(/\.mp4$/);

      // Verify actual file exists
      const stats = await fs.stat(parsed.video_path);
      expect(stats.size).toBeGreaterThan(0);
    });

  });
});
