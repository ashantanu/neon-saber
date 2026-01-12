import { Vector3 } from 'three';

export enum GameState {
  MENU = 'MENU',
  LOADING = 'LOADING',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  url: string; // URL to audio file
  duration: number; // in seconds
  color: string;
}

export interface HandData {
  left: Vector3 | null;
  right: Vector3 | null;
  leftDirection: Vector3; // Normalized direction vector
  rightDirection: Vector3; // Normalized direction vector
  leftVelocity: Vector3;
  rightVelocity: Vector3;
  leftVelocityHistory: Vector3[]; // History of velocity samples for smoothing
  rightVelocityHistory: Vector3[]; // History of velocity samples for smoothing
}

export interface CubeData {
  id: string;
  position: Vector3;
  color: 'cyan' | 'orange';
  active: boolean;
  spawnTime: number;
  emoji: string;
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