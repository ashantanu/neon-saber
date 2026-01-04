import { Song } from './types';

export const COLORS = {
  CYAN: '#00FFFF',
  CYAN_GLOW: '#00AAAA',
  ORANGE: '#FFA500',
  ORANGE_GLOW: '#FF4500',
  GRID: '#1a1a1a',
  BG: '#050505'
};

export const SONGS: Song[] = [
  {
    id: '1',
    title: 'Neon Runner',
    artist: 'SoundHelix',
    bpm: 100, 
    // Reliable test URL
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', 
    duration: 60,
    color: COLORS.CYAN
  },
  {
    id: '2',
    title: 'Digital Pulse',
    artist: 'SoundHelix',
    bpm: 128,
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', 
    duration: 60,
    color: COLORS.ORANGE
  },
  {
    id: '3',
    title: 'Cyber Chase',
    artist: 'SoundHelix',
    bpm: 150,
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3', 
    duration: 60,
    color: COLORS.CYAN
  }
];

// Game physics
export const GAME_CONFIG = {
  CUBE_SPEED: 12, // Faster cubes for better rhythm feel
  SPAWN_Z: -30, // Start further back
  HIT_Z: 0, 
  DESPAWN_Z: 5, 
  SABER_LENGTH: 1.2,
  LANE_WIDTH: 0.8,
  HIT_THRESHOLD: 1.2, // Increased from 0.8 to 1.2 for easier hits
  SLASH_THRESHOLD: 0.5, // Lowered significantly: practically any movement counts as a slash
};