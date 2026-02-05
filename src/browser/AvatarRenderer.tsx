import React, { useEffect, useRef, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { VideoCanvas, useVideoCanvas, VideoCanvasManager } from './r3f-video-recorder';
import { RHUBARB_TO_RPM } from '@/config/viseme-map';

interface VisemeFrame {
  time: number;
  viseme: string;
  duration: number;
}

interface AnimationSegment {
  clip: string;
  start: number;
  end: number;
  weight?: number;
  loop?: boolean;
}

type CameraPreset = 'closeup' | 'medium' | 'full';

// Avatar is at [0, -1, 0], so head is at ~y=0.65
// Camera lookAt is set in CameraController component
const CAMERA_PRESETS: Record<CameraPreset, {
  position: [number, number, number];
  lookAt: [number, number, number];
  fov: number;
}> = {
  closeup: { position: [0, 0.55, 0.9], lookAt: [0, 0.55, 0], fov: 30 },
  medium:  { position: [0, 0.2, 2.2],  lookAt: [0, 0.2, 0],  fov: 30 },
  full:    { position: [0, -0.1, 3.5], lookAt: [0, -0.1, 0], fov: 30 },
};

interface AvatarRendererProps {
  avatarPath: string;
  audioPath: string;
  visemes: VisemeFrame[];
  animations: AnimationSegment[];
  cameraPreset: CameraPreset;
  background: string;
  duration: number;
}

// Expose recording control to Puppeteer via window
declare global {
  interface Window {
    startRecording: (duration: number) => Promise<Blob>;
    recordingComplete: (blob: Blob) => void;
  }
}

/**
 * Sets camera lookAt target (R3F default camera only looks at origin).
 */
function CameraController({ lookAt }: { lookAt: [number, number, number] }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.lookAt(...lookAt);
    camera.updateProjectionMatrix();
  }, [camera, lookAt]);
  return null;
}

export function AvatarRenderer({ avatarPath, audioPath, visemes, animations, cameraPreset, background, duration }: AvatarRendererProps) {
  const [videoCanvas, setVideoCanvas] = useState<VideoCanvasManager | null>(null);
  const [ready, setReady] = useState(false);
  const cam = CAMERA_PRESETS[cameraPreset];

  // Expose recording function to Puppeteer
  useEffect(() => {
    if (!videoCanvas) return;

    window.startRecording = async (recordDuration: number) => {
      return new Promise((resolve) => {
        videoCanvas.record({
          mode: 'frame-accurate',
          duration: recordDuration,
        }).then((blob) => {
          resolve(blob);
        });
      });
    };

    setReady(true);
    // Signal to Puppeteer that we're ready
    (window as any).__RENDERER_READY__ = true;
  }, [videoCanvas]);

  return (
    <VideoCanvas
      fps={30}
      style={{ width: '100vw', height: '100vh', background }}
      camera={{ position: cam.position, fov: cam.fov }}
      onCreated={({ videoCanvas: vc }) => setVideoCanvas(vc)}
    >
      <CameraController lookAt={cam.lookAt} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      {avatarPath && (
        <AvatarScene
          avatarPath={avatarPath}
          visemes={visemes}
          animations={animations}
        />
      )}
    </VideoCanvas>
  );
}

interface AvatarSceneProps {
  avatarPath: string;
  visemes: VisemeFrame[];
  animations: AnimationSegment[];
}

/**
 * Interpolate viseme morph targets for smooth transitions.
 * Same logic as server-side lip-sync.ts interpolateVisemes().
 */
function interpolateVisemes(
  frames: VisemeFrame[],
  currentTime: number,
  blendDuration: number = 0.05
): Record<string, number> {
  let currentFrame: VisemeFrame | undefined;
  let nextFrame: VisemeFrame | undefined;

  for (let i = 0; i < frames.length; i++) {
    if (frames[i].time <= currentTime) {
      currentFrame = frames[i];
      nextFrame = frames[i + 1];
    } else {
      break;
    }
  }

  if (!currentFrame) {
    return RHUBARB_TO_RPM['X'];
  }

  const currentMorphs = RHUBARB_TO_RPM[currentFrame.viseme] || RHUBARB_TO_RPM['X'];

  if (!nextFrame) {
    return currentMorphs;
  }

  const frameEnd = currentFrame.time + currentFrame.duration;
  const transitionStart = frameEnd - blendDuration;

  if (currentTime >= transitionStart && currentTime < frameEnd) {
    const blendFactor = (currentTime - transitionStart) / blendDuration;
    const nextMorphs = RHUBARB_TO_RPM[nextFrame.viseme] || RHUBARB_TO_RPM['X'];

    const result: Record<string, number> = {};
    const allKeys = new Set([...Object.keys(currentMorphs), ...Object.keys(nextMorphs)]);

    for (const key of allKeys) {
      const currentVal = currentMorphs[key] || 0;
      const nextVal = nextMorphs[key] || 0;
      result[key] = currentVal + (nextVal - currentVal) * blendFactor;
    }

    return result;
  }

  return currentMorphs;
}

/**
 * Collect all meshes with morph targets from the scene graph.
 */
function collectMorphMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
        meshes.push(mesh);
      }
    }
  });
  return meshes;
}

function AvatarScene({ avatarPath, visemes, animations }: AvatarSceneProps) {
  const videoCanvas = useVideoCanvas();
  const groupRef = useRef<THREE.Group>(null);
  const morphMeshesRef = useRef<THREE.Mesh[]>([]);

  // Load avatar with embedded animations
  const { scene, animations: clips } = useGLTF(avatarPath);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  // Collect morph target meshes once avatar loads
  useEffect(() => {
    morphMeshesRef.current = collectMorphMeshes(scene);
    console.log(`[LipSync] Found ${morphMeshesRef.current.length} meshes with morph targets`);
    for (const mesh of morphMeshesRef.current) {
      const visemeKeys = Object.keys(mesh.morphTargetDictionary!).filter(k => k.startsWith('viseme_'));
      console.log(`[LipSync] Mesh "${mesh.name}": ${visemeKeys.length} viseme targets:`, visemeKeys);
    }
    console.log(`[LipSync] Received ${visemes.length} viseme frames`);
  }, [scene]);

  // Manual mixer for frame-accurate body animation — no drei auto-update
  useEffect(() => {
    if (animations.length === 0 || clips.length === 0) return;

    const group = groupRef.current;
    if (!group) return;

    const mixer = new THREE.AnimationMixer(group);
    const segment = animations[0];
    const clip = clips.find(c => c.name === segment.clip);

    if (!clip) {
      console.warn(`[Animation] Clip "${segment.clip}" not found in`, clips.map(c => c.name));
      return;
    }

    // Disable frustum culling on SkinnedMeshes — their bounding boxes don't
    // update with bone deformations, so the renderer culls them incorrectly
    scene.traverse((child) => {
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
        child.frustumCulled = false;
      }
    });

    // Strip root bone position track — Mixamo animation data uses a different
    // coordinate space than the avatar's bind pose, which moves the entire
    // skeleton off-screen. Root bone rotation is sufficient for body animation.
    const rootBoneName = clip.tracks[0]?.name.split('.')[0];
    const filteredTracks = clip.tracks.filter(
      (track) => !(track.name === `${rootBoneName}.position`)
    );
    const filteredClip = new THREE.AnimationClip(clip.name, clip.duration, filteredTracks);

    const action = mixer.clipAction(filteredClip);
    action.setEffectiveWeight(segment.weight ?? 1);
    action.setLoop(
      segment.loop ? THREE.LoopRepeat : THREE.LoopOnce,
      segment.loop ? Infinity : 1
    );
    action.clampWhenFinished = true;
    action.play();
    mixerRef.current = mixer;

    console.log(`[Animation] Playing "${segment.clip}" (${clip.duration.toFixed(2)}s, ${clip.tracks.length} tracks)`);

    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(group);
      mixerRef.current = null;
    };
  }, [clips, animations]);

  // Apply viseme morph targets and sync body animation every frame
  useFrame(() => {
    const currentTime = videoCanvas.time;

    // Body animation sync — sole time control, no competing drei auto-update
    if (mixerRef.current && animations.length > 0) {
      const segment = animations[0];
      const clip = clips.find(c => c.name === segment.clip);
      if (clip) {
        const time = currentTime - segment.start;
        if (time >= 0) {
          const animTime = segment.loop
            ? time % clip.duration
            : Math.min(time, clip.duration);
          mixerRef.current.setTime(animTime);
        }
      }
    }

    // Lip-sync: apply viseme morph targets
    if (visemes.length === 0 || morphMeshesRef.current.length === 0) return;

    const morphTargets = interpolateVisemes(visemes, currentTime);

    for (const mesh of morphMeshesRef.current) {
      const dict = mesh.morphTargetDictionary!;
      const influences = mesh.morphTargetInfluences!;

      // Reset all viseme influences to 0
      for (const [name, index] of Object.entries(dict)) {
        if (name.startsWith('viseme_')) {
          influences[index] = 0;
        }
      }

      // Apply current viseme morph targets
      for (const [name, value] of Object.entries(morphTargets)) {
        if (name in dict) {
          influences[dict[name]] = value;
        }
      }
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={scene} scale={1} position={[0, -1, 0]} />
    </group>
  );
}
