import { Vector3 } from 'three';
import { SlashDirection, HitResult } from '../types';
import { GAME_CONFIG, DIRECTION_VECTORS } from '../constants';

/**
 * Convert velocity vector to a SlashDirection
 * Uses the dominant direction of movement
 */
export function velocityToDirection(velocity: Vector3): SlashDirection {
  const x = velocity.x;
  const y = velocity.y;

  // Threshold for diagonal detection
  const diagonalThreshold = 0.4;

  // Determine primary direction
  const absX = Math.abs(x);
  const absY = Math.abs(y);

  // Check if it's a diagonal
  if (absX > diagonalThreshold && absY > diagonalThreshold) {
    if (y > 0 && x > 0) return SlashDirection.UP_RIGHT;
    if (y > 0 && x < 0) return SlashDirection.UP_LEFT;
    if (y < 0 && x > 0) return SlashDirection.DOWN_RIGHT;
    if (y < 0 && x < 0) return SlashDirection.DOWN_LEFT;
  }

  // Cardinal directions
  if (absY > absX) {
    return y > 0 ? SlashDirection.UP : SlashDirection.DOWN;
  } else {
    return x > 0 ? SlashDirection.RIGHT : SlashDirection.LEFT;
  }
}

/**
 * Calculate the angle between slash velocity and required direction
 * Returns angle in degrees (0 = perfect, 180 = opposite)
 */
export function calculateSlashAngle(velocity: Vector3, requiredDirection: SlashDirection): number {
  if (requiredDirection === SlashDirection.ANY) {
    return 0; // Any direction is perfect
  }

  const dirVec = DIRECTION_VECTORS[requiredDirection];
  const requiredVec = new Vector3(dirVec.x, dirVec.y, 0).normalize();

  // Project velocity onto XY plane and normalize
  const slashVec = new Vector3(velocity.x, velocity.y, 0);
  if (slashVec.length() < 0.001) return 180; // No movement
  slashVec.normalize();

  // Calculate angle using dot product
  const dot = requiredVec.dot(slashVec);
  const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);

  return angle;
}

/**
 * Validate a slash against the required direction
 * Returns true if the slash is within tolerance
 */
export function validateSlashDirection(
  velocity: Vector3,
  requiredDirection: SlashDirection,
  tolerance: number = GAME_CONFIG.DIRECTION_TOLERANCE
): boolean {
  if (requiredDirection === SlashDirection.ANY) {
    return true;
  }

  const angle = calculateSlashAngle(velocity, requiredDirection);
  return angle <= tolerance;
}

/**
 * Calculate comprehensive hit score
 * Returns detailed scoring breakdown
 */
export function calculateHitScore(
  slashVelocity: Vector3,
  requiredDirection: SlashDirection,
  hitDistance: number,
  streak: number
): HitResult {
  // Check minimum velocity
  const speed = slashVelocity.length();
  if (speed < GAME_CONFIG.MIN_SLASH_VELOCITY) {
    return {
      hit: false,
      score: 0,
      angleAccuracy: 0,
      speedBonus: 0,
      positionAccuracy: 0,
      perfectHit: false
    };
  }

  // Check direction
  const angle = calculateSlashAngle(slashVelocity, requiredDirection);
  const directionValid = angle <= GAME_CONFIG.DIRECTION_TOLERANCE;

  if (!directionValid && requiredDirection !== SlashDirection.ANY) {
    return {
      hit: false,
      score: 0,
      angleAccuracy: 0,
      speedBonus: 0,
      positionAccuracy: 0,
      perfectHit: false
    };
  }

  // Calculate angle score (0-70 points)
  // Perfect = 0°, acceptable up to DIRECTION_TOLERANCE
  const angleAccuracy = Math.max(0, 1 - angle / GAME_CONFIG.DIRECTION_TOLERANCE);
  const angleScore = angleAccuracy * GAME_CONFIG.MAX_ANGLE_SCORE;

  // Calculate speed bonus (0-15 points)
  // Faster slashes = more points
  const speedAccuracy = Math.min(speed / (GAME_CONFIG.MIN_SLASH_VELOCITY * 3), 1);
  const speedScore = speedAccuracy * GAME_CONFIG.MAX_SPEED_SCORE;

  // Calculate position accuracy (0-15 points)
  // Hitting center of cube = more points
  const maxDistance = GAME_CONFIG.HIT_THRESHOLD;
  const positionAccuracy = Math.max(0, 1 - hitDistance / maxDistance);
  const positionScore = positionAccuracy * GAME_CONFIG.MAX_POSITION_SCORE;

  // Total base score
  const baseScore = angleScore + speedScore + positionScore;

  // Apply combo multiplier
  const multiplier = 1 + Math.min(
    Math.floor(streak / GAME_CONFIG.COMBO_MULTIPLIER_STEP) * 0.1,
    GAME_CONFIG.MAX_COMBO_MULTIPLIER - 1
  );

  const finalScore = Math.round(baseScore * multiplier);

  // Determine if it's a perfect hit
  const isPerfect = angleAccuracy >= GAME_CONFIG.PERFECT_THRESHOLD &&
    positionAccuracy >= GAME_CONFIG.PERFECT_THRESHOLD;

  return {
    hit: true,
    score: finalScore,
    angleAccuracy,
    speedBonus: speedAccuracy,
    positionAccuracy,
    perfectHit: isPerfect
  };
}

/**
 * Get average velocity from velocity history
 * Smooths out jitter and gives more accurate slash direction
 */
export function getAverageVelocity(velocityHistory: Vector3[]): Vector3 {
  if (velocityHistory.length === 0) {
    return new Vector3();
  }

  const avg = new Vector3();
  for (const v of velocityHistory) {
    avg.add(v);
  }
  avg.divideScalar(velocityHistory.length);

  return avg;
}

/**
 * Get dominant slash direction from velocity history
 * More accurate than single-frame detection
 */
export function getDominantSlashDirection(velocityHistory: Vector3[]): SlashDirection {
  const avgVelocity = getAverageVelocity(velocityHistory);
  return velocityToDirection(avgVelocity);
}
