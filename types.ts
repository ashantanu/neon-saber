import { Vector3 } from 'three';

export enum GameState {
  MENU = 'MENU',
  LOADING = 'LOADING',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
}

// Slash directions for directional blocks
export enum SlashDirection {
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
  UP_LEFT = 'UP_LEFT',
  UP_RIGHT = 'UP_RIGHT',
  DOWN_LEFT = 'DOWN_LEFT',
  DOWN_RIGHT = 'DOWN_RIGHT',
  ANY = 'ANY', // No direction requirement
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  url: string;
  duration: number;
  color: string;
  // Optional beat map for pre-analyzed songs
  beatMap?: BeatMap;
}

export interface BeatEvent {
  time: number; // Time in seconds
  type: 'kick' | 'snare' | 'hihat' | 'vocal' | 'melody' | 'beat';
  intensity: number; // 0-1
}

export interface BeatMap {
  bpm: number;
  beats: number[]; // Array of beat times in seconds
  onsets: number[]; // Array of onset times (more granular)
  events?: BeatEvent[];
}

export interface HandData {
  left: Vector3 | null;
  right: Vector3 | null;
  leftDirection: Vector3;
  rightDirection: Vector3;
  leftVelocity: Vector3;
  rightVelocity: Vector3;
  // Enhanced: velocity history for slash detection
  leftVelocityHistory: Vector3[];
  rightVelocityHistory: Vector3[];
}

export interface CubeData {
  id: string;
  position: Vector3;
  color: 'cyan' | 'orange';
  active: boolean;
  spawnTime: number;
  // New: directional slashing
  direction: SlashDirection;
  // For pattern generation
  row: number; // 0 = bottom, 1 = middle, 2 = top
  column: number; // 0 = far left, 3 = far right
}

export interface HitResult {
  hit: boolean;
  score: number;
  angleAccuracy: number; // 0-1
  speedBonus: number; // 0-1
  positionAccuracy: number; // 0-1
  perfectHit: boolean;
}

export interface ExplosionParticle {
  id: number;
  position: Vector3;
  velocity: Vector3;
  color: string;
  life: number;
  scale: number;
}

export interface ExplosionEvent {
  id: string;
  particles: ExplosionParticle[];
  startTime: number;
}

// Slice debris for cut cubes
export interface SliceDebris {
  id: string;
  position: Vector3;
  velocity: Vector3;
  rotation: Vector3;
  rotationSpeed: Vector3;
  color: string;
  startTime: number;
  half: 'left' | 'right'; // Which half of the sliced cube
}

// Obstacle types
export enum ObstacleType {
  BOMB = 'BOMB',
  WALL = 'WALL',
}

export interface Obstacle {
  id: string;
  type: ObstacleType;
  position: Vector3;
  size: Vector3;
  spawnTime: number;
}

// YouTube/Custom song input
export interface CustomSongInput {
  url: string;
  type: 'youtube' | 'audio_file' | 'url';
}

export interface AnalyzedSong extends Song {
  beatMap: BeatMap;
  waveformData?: Float32Array;
}
