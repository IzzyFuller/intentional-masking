import React from 'react';
import { createRoot } from 'react-dom/client';
import { AvatarRenderer } from './AvatarRenderer';

// Render params passed via URL search params
const params = new URLSearchParams(window.location.search);
const config = {
  avatarPath: params.get('avatar') || '',
  audioPath: params.get('audio') || '',
  visemes: JSON.parse(params.get('visemes') || '[]'),
  animations: JSON.parse(params.get('animations') || '[]'),
  cameraPreset: (params.get('camera') || 'medium') as 'closeup' | 'medium' | 'full',
  background: params.get('background') || '#1a1a2e',
  duration: parseFloat(params.get('duration') || '5'),
};

const root = createRoot(document.getElementById('root')!);
root.render(<AvatarRenderer {...config} />);
