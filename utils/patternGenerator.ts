import { Vector3 } from 'three';
import { CubeData, SlashDirection, BeatMap, BeatEvent } from '../types';
import { GAME_CONFIG, PATTERN_CONFIG, DIRECTION_VECTORS } from '../constants';

export interface SpawnEvent {
  time: number;
  cubes: CubeData[];
}

/**
 * Pattern Generator - Creates Beat Saber-style patterns from beat maps
 * Focuses on creating "flow" - natural, satisfying movement patterns
 */
export class PatternGenerator {
  private lastLeftDirection: SlashDirection = SlashDirection.DOWN;
  private lastRightDirection: SlashDirection = SlashDirection.DOWN;
  private lastLeftColumn = 0;
  private lastRightColumn = 3;
  private lastLeftRow = 1;
  private lastRightRow = 1;
  private spawnId = 0;

  /**
   * Generate spawn events from a beat map
   */
  generateFromBeatMap(beatMap: BeatMap, difficulty: number = 1): SpawnEvent[] {
    const events: SpawnEvent[] = [];
    const beats = beatMap.beats;

    // Filter beats based on difficulty
    const filteredBeats = this.filterBeatsByDifficulty(beats, difficulty);

    for (let i = 0; i < filteredBeats.length; i++) {
      const beat = filteredBeats[i];
      const intensity = this.getIntensityForBeat(beatMap, beat);

      // Decide if this should be a double block, single left, or single right
      const isDoubleBlock = intensity > 0.7 && Math.random() < PATTERN_CONFIG.DOUBLE_BLOCK_CHANCE * difficulty;
      const isLeftBeat = !isDoubleBlock && Math.random() < 0.5;

      const cubes: CubeData[] = [];

      if (isDoubleBlock) {
        // Generate a pair of blocks
        const [leftCube, rightCube] = this.generateDoubleCubes(beat);
        cubes.push(leftCube, rightCube);
      } else if (isLeftBeat) {
        cubes.push(this.generateSingleCube(beat, 'orange', 'left'));
      } else {
        cubes.push(this.generateSingleCube(beat, 'cyan', 'right'));
      }

      events.push({ time: beat, cubes });
    }

    return events;
  }

  /**
   * Generate a single cube with flow-aware direction
   */
  private generateSingleCube(time: number, color: 'cyan' | 'orange', side: 'left' | 'right'): CubeData {
    const isLeft = side === 'left';

    // Get position based on side
    const column = isLeft
      ? this.getNextColumn(this.lastLeftColumn, 0, 1)
      : this.getNextColumn(this.lastRightColumn, 2, 3);

    const row = this.getNextRow(isLeft ? this.lastLeftRow : this.lastRightRow);

    // Get flow-aware direction
    const direction = this.getFlowDirection(
      isLeft ? this.lastLeftDirection : this.lastRightDirection,
      row,
      isLeft
    );

    // Update state
    if (isLeft) {
      this.lastLeftColumn = column;
      this.lastLeftRow = row;
      this.lastLeftDirection = direction;
    } else {
      this.lastRightColumn = column;
      this.lastRightRow = row;
      this.lastRightDirection = direction;
    }

    return {
      id: `cube-${this.spawnId++}`,
      position: this.gridToPosition(column, row),
      color,
      active: true,
      spawnTime: time,
      direction,
      row,
      column
    };
  }

  /**
   * Generate a pair of cubes for both hands
   */
  private generateDoubleCubes(time: number): [CubeData, CubeData] {
    // Pick mirrored or parallel pattern
    const isMirrored = Math.random() < 0.6;

    // Left cube (orange)
    const leftColumn = Math.random() < 0.5 ? 0 : 1;
    const leftRow = this.getNextRow(this.lastLeftRow);
    const leftDirection = this.getFlowDirection(this.lastLeftDirection, leftRow, true);

    // Right cube (cyan)
    const rightColumn = Math.random() < 0.5 ? 2 : 3;
    const rightRow = isMirrored ? leftRow : this.getNextRow(this.lastRightRow);
    const rightDirection = isMirrored
      ? this.getMirroredDirection(leftDirection)
      : this.getFlowDirection(this.lastRightDirection, rightRow, false);

    // Update state
    this.lastLeftColumn = leftColumn;
    this.lastLeftRow = leftRow;
    this.lastLeftDirection = leftDirection;
    this.lastRightColumn = rightColumn;
    this.lastRightRow = rightRow;
    this.lastRightDirection = rightDirection;

    const leftCube: CubeData = {
      id: `cube-${this.spawnId++}`,
      position: this.gridToPosition(leftColumn, leftRow),
      color: 'orange',
      active: true,
      spawnTime: time,
      direction: leftDirection,
      row: leftRow,
      column: leftColumn
    };

    const rightCube: CubeData = {
      id: `cube-${this.spawnId++}`,
      position: this.gridToPosition(rightColumn, rightRow),
      color: 'cyan',
      active: true,
      spawnTime: time,
      direction: rightDirection,
      row: rightRow,
      column: rightColumn
    };

    return [leftCube, rightCube];
  }

  /**
   * Get a direction that flows naturally from the previous direction
   */
  private getFlowDirection(lastDir: SlashDirection, row: number, isLeft: boolean): SlashDirection {
    // Bias based on row position
    // Bottom row: prefer down/diagonal-down
    // Top row: prefer up/diagonal-up
    // Middle: any direction

    const directionPool: SlashDirection[] = [];

    if (row === 0) {
      // Bottom - mostly down directions
      directionPool.push(
        SlashDirection.DOWN, SlashDirection.DOWN, SlashDirection.DOWN,
        SlashDirection.DOWN_LEFT, SlashDirection.DOWN_RIGHT,
        isLeft ? SlashDirection.LEFT : SlashDirection.RIGHT
      );
    } else if (row === 2) {
      // Top - mostly up directions
      directionPool.push(
        SlashDirection.UP, SlashDirection.UP, SlashDirection.UP,
        SlashDirection.UP_LEFT, SlashDirection.UP_RIGHT,
        isLeft ? SlashDirection.LEFT : SlashDirection.RIGHT
      );
    } else {
      // Middle - balanced
      directionPool.push(
        SlashDirection.DOWN, SlashDirection.DOWN,
        SlashDirection.UP,
        isLeft ? SlashDirection.LEFT : SlashDirection.RIGHT,
        SlashDirection.DOWN_LEFT, SlashDirection.DOWN_RIGHT
      );
    }

    // Apply flow rules - prefer directions that continue motion
    if (lastDir === SlashDirection.DOWN) {
      directionPool.push(SlashDirection.UP, SlashDirection.UP); // Encourage reversal
    } else if (lastDir === SlashDirection.UP) {
      directionPool.push(SlashDirection.DOWN, SlashDirection.DOWN);
    }

    return directionPool[Math.floor(Math.random() * directionPool.length)];
  }

  /**
   * Get mirrored direction for double blocks
   */
  private getMirroredDirection(dir: SlashDirection): SlashDirection {
    const mirrorMap: Record<SlashDirection, SlashDirection> = {
      [SlashDirection.UP]: SlashDirection.UP,
      [SlashDirection.DOWN]: SlashDirection.DOWN,
      [SlashDirection.LEFT]: SlashDirection.RIGHT,
      [SlashDirection.RIGHT]: SlashDirection.LEFT,
      [SlashDirection.UP_LEFT]: SlashDirection.UP_RIGHT,
      [SlashDirection.UP_RIGHT]: SlashDirection.UP_LEFT,
      [SlashDirection.DOWN_LEFT]: SlashDirection.DOWN_RIGHT,
      [SlashDirection.DOWN_RIGHT]: SlashDirection.DOWN_LEFT,
      [SlashDirection.ANY]: SlashDirection.ANY,
    };
    return mirrorMap[dir];
  }

  /**
   * Get next column with some randomness but staying in bounds
   */
  private getNextColumn(lastColumn: number, minCol: number, maxCol: number): number {
    const delta = Math.random() < 0.7 ? 0 : (Math.random() < 0.5 ? -1 : 1);
    return Math.max(minCol, Math.min(maxCol, lastColumn + delta));
  }

  /**
   * Get next row with preference for middle
   */
  private getNextRow(lastRow: number): number {
    const rand = Math.random();
    if (rand < 0.5) return 1; // 50% middle
    if (rand < 0.75) return lastRow; // 25% same
    return Math.floor(Math.random() * 3); // 25% random
  }

  /**
   * Convert grid position to 3D world position
   */
  private gridToPosition(column: number, row: number): Vector3 {
    const x = GAME_CONFIG.GRID_OFFSET_X + column * GAME_CONFIG.COLUMN_SPACING;
    const y = GAME_CONFIG.GRID_OFFSET_Y + row * GAME_CONFIG.ROW_SPACING;
    return new Vector3(x, y, GAME_CONFIG.SPAWN_Z);
  }

  /**
   * Filter beats based on difficulty level
   */
  private filterBeatsByDifficulty(beats: number[], difficulty: number): number[] {
    if (difficulty >= 3) return beats; // Expert: all beats

    // Calculate minimum interval based on difficulty
    const minInterval = difficulty === 1 ? 0.5 : 0.3; // Normal: 0.5s, Hard: 0.3s

    const filtered: number[] = [];
    let lastBeat = -minInterval;

    for (const beat of beats) {
      if (beat - lastBeat >= minInterval) {
        filtered.push(beat);
        lastBeat = beat;
      }
    }

    return filtered;
  }

  /**
   * Get intensity for a beat from the beat map
   */
  private getIntensityForBeat(beatMap: BeatMap, time: number): number {
    if (!beatMap.events) return 0.5;

    // Find closest event
    const event = beatMap.events.find(e => Math.abs(e.time - time) < 0.05);
    return event?.intensity ?? 0.5;
  }

  /**
   * Reset state for new song
   */
  reset(): void {
    this.lastLeftDirection = SlashDirection.DOWN;
    this.lastRightDirection = SlashDirection.DOWN;
    this.lastLeftColumn = 0;
    this.lastRightColumn = 3;
    this.lastLeftRow = 1;
    this.lastRightRow = 1;
    this.spawnId = 0;
  }
}

/**
 * Generate a simple beat map from BPM (fallback when no analysis available)
 */
export function generateSimpleBeatMap(bpm: number, duration: number): BeatMap {
  const beatInterval = 60 / bpm;
  const beats: number[] = [];
  const onsets: number[] = [];

  let time = 0;
  while (time < duration) {
    beats.push(time);
    onsets.push(time);
    time += beatInterval;
  }

  return {
    bpm,
    beats,
    onsets
  };
}

// Singleton instance
let patternGeneratorInstance: PatternGenerator | null = null;

export function getPatternGenerator(): PatternGenerator {
  if (!patternGeneratorInstance) {
    patternGeneratorInstance = new PatternGenerator();
  }
  return patternGeneratorInstance;
}
