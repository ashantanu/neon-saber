import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import { Vector2, Vector3, Quaternion } from 'three';
import { HandData, GameState, Song, ExplosionEvent, SlashDirection } from '../types';
import { GAME_CONFIG, COLORS, DIRECTION_ROTATIONS } from '../constants';
import { getAudio8Bit } from '../utils/audio8bit';

// --- Moving Grid ---
const MovingGrid = () => {
  const gridRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (gridRef.current) {
      gridRef.current.position.z += delta * GAME_CONFIG.CUBE_SPEED * 0.5;
      if (gridRef.current.position.z > 10) gridRef.current.position.z = 0;
    }
  });

  return (
    <group ref={gridRef}>
      <gridHelper args={[100, 50, COLORS.CYAN, COLORS.GRID]} position={[0, -1, 0]} />
      <gridHelper args={[100, 50, COLORS.ORANGE, COLORS.GRID]} position={[0, 10, 0]} rotation={[Math.PI, 0, 0]} />
    </group>
  );
};

// --- Simple Saber ---
const Saber = ({ hands, side, color }: { hands: React.MutableRefObject<HandData>; side: 'left' | 'right'; color: string }) => {
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const currentPos = useRef(new Vector3(side === 'left' ? -0.8 : 0.8, 1, 0));
  const currentQuat = useRef(new Quaternion());
  const defaultPos = useMemo(() => new Vector3(side === 'left' ? -0.8 : 0.8, 1, 0), [side]);
  const upVec = useMemo(() => new Vector3(0, 1, 0), []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const targetPos = side === 'left' ? hands.current.left : hands.current.right;
    const targetDir = side === 'left' ? hands.current.leftDirection : hands.current.rightDirection;

    if (targetPos) {
      currentPos.current.lerp(targetPos, 25 * delta);
    } else {
      currentPos.current.lerp(defaultPos, 5 * delta);
    }
    groupRef.current.position.copy(currentPos.current);

    if (targetDir) {
      const q = new Quaternion().setFromUnitVectors(upVec, targetDir);
      currentQuat.current.slerp(q, 20 * delta);
      groupRef.current.quaternion.copy(currentQuat.current);
    }

    if (lightRef.current) lightRef.current.intensity = 1.5 + Math.random() * 0.5;
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.2, 16]} />
        <meshStandardMaterial color="#333" roughness={0.4} metalness={0.8} />
      </mesh>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.02, 0.04, GAME_CONFIG.SABER_LENGTH, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} toneMapped={false} />
      </mesh>
      <pointLight ref={lightRef} color={color} distance={4} decay={2} position={[0, 0.5, 0]} />
    </group>
  );
};

// --- Simple Cube Data ---
interface SimpleCube {
  id: number;
  x: number;
  y: number;
  z: number;
  color: 'cyan' | 'orange';
  direction: SlashDirection;
  hit: boolean;
}

// --- All Cubes Manager (single component, no individual cube components) ---
const CubesManager = ({
  gameState,
  song,
  hands,
  difficulty,
  onScore,
  onMiss
}: {
  gameState: GameState;
  song: Song | null;
  hands: React.MutableRefObject<HandData>;
  difficulty: number;
  onScore: (points: number) => void;
  onMiss: () => void;
}) => {
  const cubesRef = useRef<SimpleCube[]>([]);
  const meshRefs = useRef<Map<number, THREE.Mesh>>(new Map());
  const lastSpawnTime = useRef(0);
  const idCounter = useRef(0);
  const [, forceUpdate] = useState(0);

  // Arrow geometry (shared)
  const arrowGeo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.15);
    shape.lineTo(0.1, 0);
    shape.lineTo(0.03, 0);
    shape.lineTo(0.03, -0.15);
    shape.lineTo(-0.03, -0.15);
    shape.lineTo(-0.03, 0);
    shape.lineTo(-0.1, 0);
    shape.lineTo(0, 0.15);
    return new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false });
  }, []);

  // Materials (shared)
  const matCyan = useMemo(() => new THREE.MeshStandardMaterial({ color: COLORS.CYAN, emissive: COLORS.CYAN_GLOW, emissiveIntensity: 1 }), []);
  const matOrange = useMemo(() => new THREE.MeshStandardMaterial({ color: COLORS.ORANGE, emissive: COLORS.ORANGE_GLOW, emissiveIntensity: 1 }), []);
  const matWhite = useMemo(() => new THREE.MeshBasicMaterial({ color: 'white' }), []);

  // Reset on game start
  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      cubesRef.current = [];
      meshRefs.current.clear();
      lastSpawnTime.current = 0;
      idCounter.current = 0;
    }
  }, [gameState]);

  useFrame((state, delta) => {
    if (gameState !== GameState.PLAYING || !song) return;

    const now = state.clock.getElapsedTime();
    const cubes = cubesRef.current;

    // Spawn new cubes
    const beatInterval = (60 / song.bpm) / difficulty;
    if (now - lastSpawnTime.current > beatInterval) {
      lastSpawnTime.current = now;

      const spawnLeft = Math.random() > 0.5;
      const directions: SlashDirection[] = [SlashDirection.DOWN, SlashDirection.DOWN, SlashDirection.UP, SlashDirection.LEFT, SlashDirection.RIGHT];

      cubes.push({
        id: idCounter.current++,
        x: spawnLeft ? -0.5 - Math.random() * 1.5 : 0.5 + Math.random() * 1.5,
        y: 0.3 + Math.random() * 1.5,
        z: GAME_CONFIG.SPAWN_Z,
        color: spawnLeft ? 'orange' : 'cyan',
        direction: directions[Math.floor(Math.random() * directions.length)],
        hit: false
      });

      // Limit max cubes to prevent overload
      if (cubes.length > 20) {
        const removed = cubes.shift();
        if (removed) meshRefs.current.delete(removed.id);
      }

      forceUpdate(n => n + 1);
    }

    // Update cube positions and check collisions
    const h = hands.current;
    const toRemove: number[] = [];

    for (const cube of cubes) {
      if (cube.hit) continue;

      // Move cube forward
      cube.z += GAME_CONFIG.CUBE_SPEED * delta;

      // Update mesh position
      const mesh = meshRefs.current.get(cube.id);
      if (mesh) {
        mesh.position.z = cube.z;
      }

      // Check collision
      if (cube.z > -2 && cube.z < 3) {
        const isCyan = cube.color === 'cyan';
        const handPos = isCyan ? h.left : h.right;
        const handDir = isCyan ? h.leftDirection : h.rightDirection;

        if (handPos && handDir) {
          const cubePos = new Vector3(cube.x, cube.y, cube.z);
          const saberTip = handPos.clone().addScaledVector(handDir, 0.6);

          if (cubePos.distanceTo(saberTip) < 1.2 || cubePos.distanceTo(handPos) < 1.2) {
            cube.hit = true;
            toRemove.push(cube.id);
            onScore(100);
            getAudio8Bit().playExplosion();
          }
        }
      }

      // Remove if past player
      if (cube.z > GAME_CONFIG.DESPAWN_Z) {
        toRemove.push(cube.id);
        onMiss();
      }
    }

    // Remove hit/missed cubes
    if (toRemove.length > 0) {
      cubesRef.current = cubes.filter(c => !toRemove.includes(c.id));
      toRemove.forEach(id => meshRefs.current.delete(id));
      forceUpdate(n => n + 1);
    }
  });

  return (
    <group>
      {cubesRef.current.filter(c => !c.hit).map(cube => (
        <mesh
          key={cube.id}
          ref={(mesh) => { if (mesh) meshRefs.current.set(cube.id, mesh); }}
          position={[cube.x, cube.y, cube.z]}
        >
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <primitive object={cube.color === 'cyan' ? matCyan : matOrange} attach="material" />
          <mesh geometry={arrowGeo} material={matWhite} rotation={[0, 0, DIRECTION_ROTATIONS[cube.direction] || 0]} position={[0, 0, 0.26]} />
          <pointLight color={cube.color === 'cyan' ? COLORS.CYAN : COLORS.ORANGE} distance={2} intensity={1} />
        </mesh>
      ))}
    </group>
  );
};

// --- Main Scene ---
interface GameSceneProps {
  gameState: GameState;
  hands: React.MutableRefObject<HandData>;
  song: Song | null;
  difficulty: number;
  onScore: (points: number) => void;
  onMiss: () => void;
}

const GameScene: React.FC<GameSceneProps> = ({ gameState, hands, song, difficulty, onScore, onMiss }) => {
  return (
    <Canvas camera={{ position: [0, 1.0, 4], fov: 60 }} dpr={[1, 2]} gl={{ toneMapping: THREE.ReinhardToneMapping }}>
      <color attach="background" args={[COLORS.BG]} />
      <fog attach="fog" args={[COLORS.BG, 10, 40]} />
      <ambientLight intensity={0.2} />
      <MovingGrid />
      <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />
      <Saber hands={hands} side="left" color={COLORS.CYAN} />
      <Saber hands={hands} side="right" color={COLORS.ORANGE} />
      <CubesManager gameState={gameState} song={song} hands={hands} difficulty={difficulty} onScore={onScore} onMiss={onMiss} />
      <EffectComposer enableNormalPass={false}>
        <Bloom luminanceThreshold={0.5} mipmapBlur intensity={1.2} radius={0.5} />
        <ChromaticAberration offset={new Vector2(0.001, 0.001)} />
      </EffectComposer>
    </Canvas>
  );
};

export default GameScene;
