#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { CallToolRequestSchema, ListToolsRequestSchema, McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { renderSpeakingVideo } from './tools/render-speaking-video.js';
import { renderAnimatedVideo } from './tools/render-animated-video.js';

export class IntentionalMaskingServer {
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
        },
        {
          name: 'render_animated_video',
          description: 'Render an avatar speaking with lip sync from audio and body animations',
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
              animations: {
                type: 'array',
                description: 'Body animation timeline',
                items: {
                  type: 'object',
                  properties: {
                    file: {
                      type: 'string',
                      description: 'Path to animation GLB file (from Mixamo or other source)'
                    },
                    clip: {
                      type: 'string',
                      description: 'Clip name within file (default: first clip)'
                    },
                    start: {
                      type: 'number',
                      description: 'Start time in seconds (in output video)'
                    },
                    end: {
                      type: 'number',
                      description: 'End time in seconds (in output video)'
                    },
                    weight: {
                      type: 'number',
                      description: 'Blend weight 0-1 (default: 1.0)'
                    },
                    loop: {
                      type: 'boolean',
                      description: 'Loop within segment (default: false)'
                    }
                  },
                  required: ['file', 'start', 'end']
                }
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
            required: ['avatar_path', 'audio_path', 'animations']
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'render_speaking_video':
            return { content: [{ type: 'text', text: JSON.stringify(await renderSpeakingVideo(args as any)) }] };
          case 'render_animated_video':
            return { content: [{ type: 'text', text: JSON.stringify(await renderAnimatedVideo(args as any)) }] };
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: 'text', text: JSON.stringify({ error: message }) }] };
      }
    });
  }

  async connect(transport: Transport) {
    await this.server.connect(transport);
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.connect(transport);
    console.error('Intentional Masking MCP server running');
  }
}

// Only auto-run when executed directly
const isMain = process.argv[1]?.endsWith('index.js') || process.argv[1]?.endsWith('index.ts');
if (isMain) {
  new IntentionalMaskingServer().run().catch(console.error);
}
