import { Song, SlashDirection } from './types';

export const COLORS = {
  CYAN: '#00FFFF',
  CYAN_GLOW: '#00AAAA',
  ORANGE: '#FFA500',
  ORANGE_GLOW: '#FF4500',
  GRID: '#1a1a1a',
  BG: '#050505',
  // New colors for effects
  PERFECT: '#FFD700', // Gold for perfect hits
  GOOD: '#00FF00', // Green for good hits
  MISS: '#FF0000', // Red for misses
};

export const SONGS: Song[] = [
  {
    id: '1',
    title: 'Neon Runner',
    artist: 'SoundHelix',
    bpm: 100,
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

// Game physics and mechanics
export const GAME_CONFIG = {
  // Movement
  CUBE_SPEED: 12,
  SPAWN_Z: -30,
  HIT_Z: 0,
  DESPAWN_Z: 5,
  SABER_LENGTH: 1.2,

  // Grid layout (4 columns x 3 rows like Beat Saber)
  LANE_WIDTH: 0.8,
  GRID_COLUMNS: 4,
  GRID_ROWS: 3,
  COLUMN_SPACING: 0.9, // Space between columns
  ROW_SPACING: 0.7, // Space between rows
  GRID_OFFSET_X: -1.35, // Center the grid
  GRID_OFFSET_Y: 0.4, // Base height

  // Hit detection
  HIT_THRESHOLD: 1.0, // Distance for hit detection

  // Slash detection
  MIN_SLASH_VELOCITY: 3.0, // Minimum velocity to count as slash (units/sec)
  DIRECTION_TOLERANCE: 45, // Degrees tolerance for direction matching
  VELOCITY_HISTORY_SIZE: 8, // Number of frames to track velocity

  // Scoring
  MAX_ANGLE_SCORE: 70, // Points from angle accuracy
  MAX_SPEED_SCORE: 15, // Points from swing speed
  MAX_POSITION_SCORE: 15, // Points from position accuracy
  PERFECT_THRESHOLD: 0.9, // Accuracy needed for "perfect"
  GOOD_THRESHOLD: 0.7, // Accuracy needed for "good"

  // Combo
  COMBO_MULTIPLIER_STEP: 10, // Hits needed for each 10% bonus
  MAX_COMBO_MULTIPLIER: 8, // Max 8x multiplier (at 80 streak)

  // Beat detection
  BEAT_LOOK_AHEAD: 2.5, // Seconds to look ahead for spawning
  MIN_BEAT_INTERVAL: 0.15, // Minimum time between spawns
};

// Direction vectors for slash validation
export const DIRECTION_VECTORS: Record<SlashDirection, { x: number; y: number }> = {
  [SlashDirection.UP]: { x: 0, y: 1 },
  [SlashDirection.DOWN]: { x: 0, y: -1 },
  [SlashDirection.LEFT]: { x: -1, y: 0 },
  [SlashDirection.RIGHT]: { x: 1, y: 0 },
  [SlashDirection.UP_LEFT]: { x: -0.707, y: 0.707 },
  [SlashDirection.UP_RIGHT]: { x: 0.707, y: 0.707 },
  [SlashDirection.DOWN_LEFT]: { x: -0.707, y: -0.707 },
  [SlashDirection.DOWN_RIGHT]: { x: 0.707, y: -0.707 },
  [SlashDirection.ANY]: { x: 0, y: 0 },
};

// Arrow rotations for visual display (in radians)
export const DIRECTION_ROTATIONS: Record<SlashDirection, number> = {
  [SlashDirection.UP]: 0,
  [SlashDirection.DOWN]: Math.PI,
  [SlashDirection.LEFT]: Math.PI / 2,
  [SlashDirection.RIGHT]: -Math.PI / 2,
  [SlashDirection.UP_LEFT]: Math.PI / 4,
  [SlashDirection.UP_RIGHT]: -Math.PI / 4,
  [SlashDirection.DOWN_LEFT]: Math.PI * 3 / 4,
  [SlashDirection.DOWN_RIGHT]: -Math.PI * 3 / 4,
  [SlashDirection.ANY]: 0,
};

// Pattern generation weights (for procedural beat mapping)
export const PATTERN_CONFIG = {
  // How often to use each direction (weights)
  DIRECTION_WEIGHTS: {
    [SlashDirection.DOWN]: 25,
    [SlashDirection.UP]: 20,
    [SlashDirection.LEFT]: 15,
    [SlashDirection.RIGHT]: 15,
    [SlashDirection.DOWN_LEFT]: 8,
    [SlashDirection.DOWN_RIGHT]: 8,
    [SlashDirection.UP_LEFT]: 4,
    [SlashDirection.UP_RIGHT]: 4,
    [SlashDirection.ANY]: 1,
  },
  // Probability of double blocks (both hands)
  DOUBLE_BLOCK_CHANCE: 0.2,
  // Flow patterns - preferred direction sequences
  FLOW_PATTERNS: [
    [SlashDirection.DOWN, SlashDirection.DOWN],
    [SlashDirection.DOWN, SlashDirection.UP],
    [SlashDirection.LEFT, SlashDirection.RIGHT],
    [SlashDirection.DOWN_LEFT, SlashDirection.DOWN_RIGHT],
    [SlashDirection.UP, SlashDirection.DOWN],
  ],
};
