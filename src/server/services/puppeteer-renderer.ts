import puppeteer, { Browser } from 'puppeteer';
import { promises as fs } from 'fs';
import { join, dirname, basename } from 'path';
import { spawn, execFile, ChildProcess } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const PROJECT_ROOT = process.env.INTENTIONAL_MASKING_ROOT || process.cwd();
const OUTPUT_DIR = process.env.INTENTIONAL_MASKING_OUTPUT || `${PROJECT_ROOT}/output`;
const PUBLIC_DIR = `${PROJECT_ROOT}/public`;
const BROWSER_APP_PREFERRED_PORT = 5173;

let browser: Browser | null = null;
let viteProcess: ChildProcess | null = null;
let vitePort: number | null = null;

export interface VisemeFrame {
  time: number;
  viseme: string;
  duration: number;
}

export interface RenderConfig {
  avatarPath: string;
  audioPath: string;
  visemes?: VisemeFrame[];
  animations?: Array<{
    clip: string;
    start: number;
    end: number;
    weight?: number;
    loop?: boolean;
  }>;
  cameraPreset?: 'closeup' | 'medium' | 'full';
  background?: string;
  duration: number;
  outputPath?: string;
}

export interface RenderResult {
  success: boolean;
  videoPath?: string;
  durationSeconds?: number;
  error?: string;
}

/**
 * Start Vite dev server for the browser app.
 * Uses --strictPort to fail fast if preferred port is taken,
 * and parses the actual port from Vite's stdout.
 */
async function startViteServer(): Promise<number> {
  if (viteProcess && vitePort) return vitePort;

  return new Promise((resolve, reject) => {
    viteProcess = spawn('npx', ['vite', '--port', String(BROWSER_APP_PREFERRED_PORT)], {
      cwd: PROJECT_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let started = false;

    viteProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      if (!started) {
        // Parse actual port from Vite output like "Local:   http://localhost:5173/"
        const portMatch = output.match(/Local:\s+https?:\/\/localhost:(\d+)/);
        if (portMatch) {
          started = true;
          vitePort = parseInt(portMatch[1], 10);
          resolve(vitePort);
        }
      }
    });

    viteProcess.stderr?.on('data', (data) => {
      console.error('[Vite]', data.toString());
    });

    viteProcess.on('error', reject);

    // Timeout after 30s
    setTimeout(() => {
      if (!started) reject(new Error('Vite server failed to start within 30s'));
    }, 30000);
  });
}

/**
 * Get or create a warm browser instance
 */
async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });
  }
  return browser;
}

/**
 * Mux audio into a silent video using ffmpeg.
 * Writes to a temp file then replaces the original.
 */
async function muxAudio(videoPath: string, audioPath: string): Promise<void> {
  const tempOutput = `${videoPath}.muxed.mp4`;
  await execFileAsync('ffmpeg', [
    '-y',
    '-i', videoPath,
    '-i', audioPath,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-shortest',
    tempOutput,
  ]);
  await fs.rename(tempOutput, videoPath);
}

/**
 * Render avatar video using Puppeteer + r3f-video-recorder
 */
export async function renderVideo(config: RenderConfig): Promise<RenderResult> {
  const {
    avatarPath,
    audioPath,
    visemes = [],
    animations = [],
    cameraPreset = 'medium',
    background = '#1a1a2e',
    duration,
    outputPath,
  } = config;

  const timestamp = Date.now();
  const finalOutputPath = outputPath || join(OUTPUT_DIR, `speaking_${timestamp}.mp4`);
  const tempDir = join(PUBLIC_DIR, `render-${timestamp}`);

  try {
    // Create temp directory in public folder for Vite to serve
    await fs.mkdir(tempDir, { recursive: true });

    // Copy avatar and audio files to temp dir
    const avatarFilename = basename(avatarPath);
    const audioFilename = basename(audioPath);
    await fs.copyFile(avatarPath, join(tempDir, avatarFilename));
    await fs.copyFile(audioPath, join(tempDir, audioFilename));

    // Paths relative to public/ that Vite will serve
    const servedAvatarPath = `/render-${timestamp}/${avatarFilename}`;
    const servedAudioPath = `/render-${timestamp}/${audioFilename}`;

    // Ensure output directory exists
    await fs.mkdir(dirname(finalOutputPath), { recursive: true });

    // Start Vite server if not running (returns actual port)
    const port = await startViteServer();

    // Get warm browser
    const browserInstance = await getBrowser();
    const page = await browserInstance.newPage();

    try {
      // Build URL with params
      const params = new URLSearchParams({
        avatar: servedAvatarPath,
        audio: servedAudioPath,
        visemes: JSON.stringify(visemes),
        animations: JSON.stringify(animations),
        camera: cameraPreset,
        background,
        duration: String(duration),
      });

      const url = `http://localhost:${port}/?${params.toString()}`;

      // Capture all browser console output
      page.on('console', msg => {
        console.error(`[Browser ${msg.type()}]`, msg.text());
      });
      page.on('pageerror', err => console.error('[Browser Error]', String(err)));

      // Navigate to browser app
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

      // Wait for renderer to be ready
      await page.waitForFunction(() => (window as any).__RENDERER_READY__ === true, {
        timeout: 30000,
      });

      // Trigger recording and get blob
      const videoData = await page.evaluate(async (recordDuration: number) => {
        const blob = await (window as any).startRecording(recordDuration);
        // Convert blob to base64
        const buffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
      }, duration);

      // Write silent video file
      const videoBuffer = Buffer.from(videoData, 'base64');
      await fs.writeFile(finalOutputPath, videoBuffer);

      // Mux original audio into the video
      await muxAudio(finalOutputPath, audioPath);

      return {
        success: true,
        videoPath: finalOutputPath,
        durationSeconds: duration,
      };
    } finally {
      await page.close();
      // Clean up temp directory
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  } catch (error) {
    // Clean up temp directory on error too
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Cleanup resources
 */
export async function cleanup(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
  if (viteProcess) {
    viteProcess.kill();
    viteProcess = null;
    vitePort = null;
  }
}
