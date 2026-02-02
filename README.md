# intentional-masking

MCP server for rendering Ready Player Me avatars with lip-sync using Remotion and React Three Fiber.

## Features

- **render_frame** - Render a single still image of an avatar with expression, pose, camera, and lighting options
- **render_speaking_video** - Render a video of an avatar speaking with real phoneme-based lip-sync from audio

## Requirements

- Node.js 18+
- macOS, Linux, or Windows

## Installation

```bash
cd intentional-masking
npm install
npm run build
```

## Usage

### As MCP Server

Add to your Claude Code configuration (`~/.claude.json` or project `.claude/settings.local.json`):

```json
{
  "mcpServers": {
    "intentional-masking": {
      "command": "node",
      "args": ["/path/to/intentional-masking/dist/server/index.js"],
      "env": {
        "INTENTIONAL_MASKING_ROOT": "/path/to/intentional-masking"
      }
    }
  }
}
```

### MCP Tools

#### render_frame

Render a single still frame of an avatar.

```json
{
  "avatar_path": "/path/to/avatar.glb",
  "expression": "happy",
  "pose": "greeting",
  "camera_preset": "closeup",
  "lighting_preset": "soft",
  "background": "#1a1a2e"
}
```

**Options:**
- `expression`: `neutral` | `happy` | `thinking` | `surprised`
- `pose`: `default` | `greeting` | `listening`
- `camera_preset`: `closeup` | `medium` | `full`
- `lighting_preset`: `soft` | `dramatic` | `natural`
- `background`: Hex color (default: `#1a1a2e`)

Returns: `{ "success": true, "image_path": "/path/to/output.png" }`

#### render_speaking_video

Render an avatar speaking with lip-sync from audio.

```json
{
  "avatar_path": "/path/to/avatar.glb",
  "audio_path": "/path/to/speech.wav",
  "camera_preset": "closeup",
  "lighting_preset": "soft",
  "background": "#1a1a2e"
}
```

**Audio requirements:**
- 16kHz 16-bit mono PCM WAV (as produced by [info-dump](https://github.com/IzzyFuller/info-dump))

Returns: `{ "success": true, "video_path": "/path/to/output.mp4", "duration_seconds": 5.2 }`

## Architecture

```
src/
├── server/
│   ├── index.ts              # MCP server entry point
│   ├── services/
│   │   └── lip-sync.ts       # Rhubarb lip-sync integration
│   └── tools/
│       ├── render-frame.ts   # Still image rendering
│       └── render-speaking-video.ts  # Video rendering
├── config/
│   └── viseme-map.ts         # Rhubarb → RPM morph target mapping
└── remotion/
    ├── index.ts              # Remotion entry point
    ├── Root.tsx              # Composition registration
    ├── AvatarFrame.tsx       # Still frame composition
    ├── AvatarSpeaking.tsx    # Speaking video composition
    └── components/
        ├── Avatar.tsx        # GLB model loader
        ├── Scene.tsx         # Three.js scene setup
        └── LipSyncController.tsx  # Morph target application
```

### Lip-Sync Pipeline

1. **Audio analysis**: [rhubarb-lip-sync-wasm](https://github.com/danieloquelis/rhubarb-lip-sync-wasm) analyzes 16kHz audio
2. **Phoneme mapping**: Rhubarb shapes (A-H, X) → Ready Player Me viseme morph targets
3. **Frame interpolation**: Smooth blending between viseme shapes
4. **Video rendering**: Remotion captures Three.js scene frame-by-frame

### Rhubarb Shape Mapping

| Shape | Phonemes | RPM Morph Targets |
|-------|----------|-------------------|
| A | P, B, M (closed) | viseme_PP |
| B | K, S, T (teeth) | viseme_kk, viseme_nn |
| C | EH, AE (vowels) | viseme_I, viseme_E |
| D | AA (wide open) | viseme_aa |
| E | AO, ER (rounded) | viseme_O, viseme_aa |
| F | UW, OW, W (puckered) | viseme_U |
| G | F, V (teeth-on-lip) | viseme_FF |
| H | L sound | viseme_TH, viseme_nn |
| X | Silence | viseme_sil |

## Integration with info-dump

This server pairs with [info-dump](https://github.com/IzzyFuller/info-dump) for complete TTS → avatar rendering:

```
info-dump generate_audio("Hello!", voice, output_path)
    ↓
intentional-masking render_speaking_video(avatar_path, audio_path)
    ↓
MP4 video with lip-synced avatar
```

## Avatar Requirements

Avatars must be Ready Player Me GLB files with standard viseme morph targets:
- `viseme_aa`, `viseme_E`, `viseme_I`, `viseme_O`, `viseme_U`
- `viseme_PP`, `viseme_FF`, `viseme_TH`, `viseme_DD`, `viseme_kk`, `viseme_nn`, `viseme_sil`

Create avatars at [readyplayer.me](https://readyplayer.me)

## Development

```bash
# Run tests
npm test

# Watch mode
npm run dev

# Preview Remotion compositions
npm run remotion:preview
```

## Environment Variables

- `INTENTIONAL_MASKING_ROOT` - Project root directory (default: cwd)
- `INTENTIONAL_MASKING_OUTPUT` - Output directory for rendered files (default: `{root}/output`)

## License

MIT
