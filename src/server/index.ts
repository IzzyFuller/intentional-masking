#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { CallToolRequestSchema, ListToolsRequestSchema, McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { renderSpeakingVideo } from './tools/render-speaking-video.js';

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
          name: 'render_video',
          description: 'Render an avatar speaking with lip sync from audio, optionally with body animations',
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
                description: 'Optional body animation timeline',
                items: {
                  type: 'object',
                  properties: {
                    clip: {
                      type: 'string',
                      description: 'Clip name in avatar GLB (e.g., "Talking", "Idle")'
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
                  required: ['clip', 'start', 'end']
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
            required: ['avatar_path', 'audio_path']
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'render_video':
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
