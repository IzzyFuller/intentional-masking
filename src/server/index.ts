#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { renderFrame } from './tools/render-frame.js';
import { renderSpeakingVideo } from './tools/render-speaking-video.js';

class IntentionalMaskingServer {
  private server: Server;

  constructor() {
    this.server = new Server({
      name: 'intentional-masking',
      version: '0.1.0'
    }, {
      capabilities: { tools: {} }
    });

    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, () => ({
      tools: [
        {
          name: 'render_frame',
          description: 'Render a single still frame of an avatar',
          inputSchema: {
            type: 'object',
            properties: {
              avatar_path: {
                type: 'string',
                description: 'Path to the avatar .glb file'
              },
              expression: {
                type: 'string',
                enum: ['neutral', 'happy', 'thinking', 'surprised'],
                default: 'neutral',
                description: 'Facial expression'
              },
              pose: {
                type: 'string',
                enum: ['default', 'greeting', 'listening'],
                default: 'default',
                description: 'Body pose'
              },
              camera_preset: {
                type: 'string',
                enum: ['closeup', 'medium', 'full'],
                default: 'medium',
                description: 'Camera angle preset'
              },
              lighting_preset: {
                type: 'string',
                enum: ['soft', 'dramatic', 'natural'],
                default: 'soft',
                description: 'Lighting style'
              },
              background: {
                type: 'string',
                default: '#1a1a2e',
                description: 'Background color (hex)'
              },
              output_path: {
                type: 'string',
                description: 'Optional output path (default: auto-generated in output/)'
              }
            },
            required: ['avatar_path']
          }
        },
        {
          name: 'render_speaking_video',
          description: 'Render an avatar speaking with lip sync from audio',
          inputSchema: {
            type: 'object',
            properties: {
              avatar_path: {
                type: 'string',
                description: 'Path to the avatar .glb file'
              },
              audio_path: {
                type: 'string',
                description: 'Path to audio file (from TTS like info-dump)'
              },
              camera_preset: {
                type: 'string',
                enum: ['closeup', 'medium', 'full'],
                default: 'medium',
                description: 'Camera angle preset'
              },
              lighting_preset: {
                type: 'string',
                enum: ['soft', 'dramatic', 'natural'],
                default: 'soft',
                description: 'Lighting style'
              },
              background: {
                type: 'string',
                default: '#1a1a2e',
                description: 'Background color (hex)'
              },
              output_path: {
                type: 'string',
                description: 'Optional output path (default: auto-generated in output/)'
              }
            },
            required: ['avatar_path', 'audio_path']
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'render_frame':
            return { content: [{ type: 'text', text: JSON.stringify(await renderFrame(args as any)) }] };
          case 'render_speaking_video':
            return { content: [{ type: 'text', text: JSON.stringify(await renderSpeakingVideo(args as any)) }] };
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: 'text', text: JSON.stringify({ error: message }) }] };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Intentional Masking MCP server running');
  }
}

new IntentionalMaskingServer().run().catch(console.error);
