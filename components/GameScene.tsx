import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import { Vector2, Vector3, Quaternion } from 'three';
import { HandData, GameState, Song, CubeData, ExplosionEvent, SlashDirection, HitResult } from '../types';
import { GAME_CONFIG, COLORS, DIRECTION_ROTATIONS } from '../constants';
import { getAudio8Bit } from '../utils/audio8bit';

// --- Sub-components ---

const MovingGrid = () => {
  const gridRef = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (gridRef.current) {
      gridRef.current.position.z += delta * GAME_CONFIG.CUBE_SPEED * 0.5;
      if (gridRef.current.position.z > 10) {
        gridRef.current.position.z = 0;
      }
    }
  });

  return (
    <group ref={gridRef}>
      <gridHelper args={[100, 50, COLORS.CYAN, COLORS.GRID]} position={[0, -1, 0]} />
      <gridHelper args={[100, 50, COLORS.ORANGE, COLORS.GRID]} position={[0, 10, 0]} rotation={[Math.PI, 0, 0]} />
    </group>
  );
};

// Simple Saber without problematic Trail
const Saber = ({ hands, side, color }: { hands: React.MutableRefObject<HandData>; side: 'left' | 'right'; color: string }) => {
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  const currentPos = useRef(new Vector3(side === 'left' ? -0.8 : 0.8, 1, 0));
  const currentQuat = useRef(new Quaternion());

  const defaultPos = useMemo(() => new Vector3(side === 'left' ? -0.8 : 0.8, 1, 0), [side]);
  const dummyQuat = useMemo(() => new Quaternion(), []);
  const upVec = useMemo(() => new Vector3(0, 1, 0), []);

  useFrame((state, delta) => {
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
      dummyQuat.setFromUnitVectors(upVec, targetDir);
      currentQuat.current.slerp(dummyQuat, 20 * delta);
      groupRef.current.quaternion.copy(currentQuat.current);
    }

    if (lightRef.current) {
      lightRef.current.intensity = 1.5 + Math.random() * 0.5;
    }
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

// --- Particles System ---

const Explosions = ({ explosions }: { explosions: ExplosionEvent[] }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    let instanceIdx = 0;

    explosions.forEach(explosion => {
      const age = state.clock.getElapsedTime() - explosion.startTime;

      explosion.particles.forEach(p => {
        if (instanceIdx < 1000) {
          const lifeRatio = 1 - (age / p.life);
          if (lifeRatio > 0) {
            p.position.addScaledVector(p.velocity, delta);

            dummy.position.copy(p.position);
            dummy.scale.setScalar(p.scale * lifeRatio);
            dummy.rotation.set(Math.random(), Math.random(), Math.random());
            dummy.updateMatrix();

            meshRef.current!.setMatrixAt(instanceIdx, dummy.matrix);
            meshRef.current!.setColorAt(instanceIdx, new THREE.Color(p.color));

            instanceIdx++;
          }
        }
      });
    });

    meshRef.current.count = instanceIdx;
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, 1000]}>
      <boxGeometry args={[0.1, 0.1, 0.1]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
};

// --- Directional Cube ---

interface CubeProps {
  data: CubeData;
  hands: React.MutableRefObject<HandData>;
  onHit: (id: string, pos: Vector3, color: string) => void;
  onMiss: (id: string) => void;
}

const DirectionalCube: React.FC<CubeProps> = ({ data, hands, onHit, onMiss }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const hitRef = useRef(false);

  const matCyan = useMemo(() => new THREE.MeshStandardMaterial({
    color: COLORS.CYAN, emissive: COLORS.CYAN_GLOW, emissiveIntensity: 1
  }), []);

  const matOrange = useMemo(() => new THREE.MeshStandardMaterial({
    color: COLORS.ORANGE, emissive: COLORS.ORANGE_GLOW, emissiveIntensity: 1
  }), []);

  // Arrow geometry
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

  const matWhite = useMemo(() => new THREE.MeshBasicMaterial({ color: 'white' }), []);

  useFrame((state, delta) => {
    if (!meshRef.current || hitRef.current) return;

    meshRef.current.position.z += GAME_CONFIG.CUBE_SPEED * delta;
    const currentZ = meshRef.current.position.z;

    // Collision Window
    if (currentZ > -2 && currentZ < 3) {
      const h = hands.current;
      // FIXED: Cyan cubes hit by LEFT hand (cyan saber), Orange cubes hit by RIGHT hand (orange saber)
      const isCyan = data.color === 'cyan';
      const targetHandPos = isCyan ? h.left : h.right;
      const targetDir = isCyan ? h.leftDirection : h.rightDirection;

      if (targetHandPos && targetDir) {
        const saberTip = targetHandPos.clone().addScaledVector(targetDir, 0.6);
        const dist = meshRef.current.position.distanceTo(saberTip);
        const distHandle = meshRef.current.position.distanceTo(targetHandPos);

        if (dist < GAME_CONFIG.HIT_THRESHOLD || distHandle < GAME_CONFIG.HIT_THRESHOLD) {
          hitRef.current = true;
          meshRef.current.visible = false;
          onHit(data.id, meshRef.current.position.clone(), isCyan ? COLORS.CYAN : COLORS.ORANGE);
        }
      }
    }

    if (currentZ > GAME_CONFIG.DESPAWN_Z) {
      hitRef.current = true;
      onMiss(data.id);
    }
  });

  const arrowRotation = DIRECTION_ROTATIONS[data.direction] || 0;
  const showArrow = data.direction !== SlashDirection.ANY;

  return (
    <mesh ref={meshRef} position={data.position.clone()}>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <primitive object={data.color === 'cyan' ? matCyan : matOrange} attach="material" />
      {showArrow && (
        <mesh geometry={arrowGeo} material={matWhite} rotation={[0, 0, arrowRotation]} position={[0, 0, 0.26]} />
      )}
      <pointLight color={data.color === 'cyan' ? COLORS.CYAN : COLORS.ORANGE} distance={2} intensity={2} />
    </mesh>
  );
};

// --- Cube Manager - Simple BPM-based spawning ---

interface CubeManagerProps {
  gameState: GameState;
  song: Song | null;
  hands: React.MutableRefObject<HandData>;
  difficulty: number;
  onScore: (points: number) => void;
  onMiss: () => void;
}

const CubeManager: React.FC<CubeManagerProps> = ({
  gameState,
  song,
  hands,
  difficulty,
  onScore,
  onMiss
}) => {
  const [cubes, setCubes] = useState<CubeData[]>([]);
  const [explosions, setExplosions] = useState<ExplosionEvent[]>([]);
  const lastSpawnTime = useRef(0);
  const idCounter = useRef(0);
  const clockRef = useRef(new THREE.Clock());

  // Reset when game starts
  React.useEffect(() => {
    if (gameState === GameState.PLAYING) {
      clockRef.current.start();
      lastSpawnTime.current = 0;
      idCounter.current = 0;
      setCubes([]);
      setExplosions([]);
    }
  }, [gameState]);

  useFrame((state) => {
    const now = clockRef.current.getElapsedTime();

    if (gameState !== GameState.PLAYING || !song) {
      if (cubes.length > 0 && gameState === GameState.MENU) setCubes([]);
      return;
    }

    // Simple BPM-based spawning
    const beatInterval = (60 / song.bpm) / difficulty;
    if (now - lastSpawnTime.current > beatInterval) {
      lastSpawnTime.current = now;

      const spawnLeft = Math.random() > 0.5;
      const laneX = spawnLeft
        ? -0.2 - Math.random() * 2.0
        : 0.2 + Math.random() * 2.0;

      // Left lane = orange cubes (hit by right/orange saber)
      // Right lane = cyan cubes (hit by left/cyan saber)
      const colorType = spawnLeft ? 'orange' : 'cyan';
      const heightY = 0.3 + Math.random() * 2.0;

      // Pick a direction
      const directions: SlashDirection[] = [
        SlashDirection.DOWN, SlashDirection.DOWN, SlashDirection.DOWN,
        SlashDirection.UP, SlashDirection.LEFT, SlashDirection.RIGHT,
        SlashDirection.DOWN_LEFT, SlashDirection.DOWN_RIGHT
      ];
      const direction = directions[Math.floor(Math.random() * directions.length)];

      const newCube: CubeData = {
        id: `cube-${idCounter.current++}`,
        position: new Vector3(laneX, heightY, GAME_CONFIG.SPAWN_Z),
        color: colorType,
        active: true,
        spawnTime: now,
        direction,
        row: Math.floor(heightY),
        column: spawnLeft ? 0 : 3
      };
      setCubes(prev => [...prev, newCube]);
    }

    // Clean up explosions
    setExplosions(prev => prev.filter(e => now - e.startTime < 1.5));
  });

  const handleCubeHit = (id: string, pos: Vector3, color: string) => {
    setCubes(prev => prev.filter(c => c.id !== id));
    onScore(100);

    getAudio8Bit().playExplosion();

    const particles = [];
    for (let i = 0; i < 15; i++) {
      particles.push({
        id: i,
        position: pos.clone(),
        velocity: new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
          .normalize().multiplyScalar(5 + Math.random() * 5),
        color,
        life: 0.5 + Math.random() * 0.5,
        scale: 0.2 + Math.random() * 0.2
      });
    }

    setExplosions(prev => [...prev, {
      id: `exp-${id}`,
      particles,
      startTime: clockRef.current.getElapsedTime()
    }]);
  };

  const handleCubeMiss = (id: string) => {
    setCubes(prev => prev.filter(c => c.id !== id));
    onMiss();
  };

  return (
    <group>
      {cubes.map(cube => (
        <DirectionalCube
          key={cube.id}
          data={cube}
          hands={hands}
          onHit={handleCubeHit}
          onMiss={handleCubeMiss}
        />
      ))}
      <Explosions explosions={explosions} />
    </group>
  );
};

// --- Main Game Scene ---

interface GameSceneProps {
  gameState: GameState;
  hands: React.MutableRefObject<HandData>;
  song: Song | null;
  difficulty: number;
  onScore: (points: number) => void;
  onMiss: () => void;
}

const GameScene: React.FC<GameSceneProps> = ({
  gameState,
  hands,
  song,
  difficulty,
  onScore,
  onMiss
}) => {
  return (
    <Canvas
      camera={{ position: [0, 1.0, 4], fov: 60 }}
      dpr={[1, 2]}
      gl={{ toneMapping: THREE.ReinhardToneMapping }}
    >
      <color attach="background" args={[COLORS.BG]} />
      <fog attach="fog" args={[COLORS.BG, 10, 40]} />

      <ambientLight intensity={0.2} />
      <MovingGrid />
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

      <Saber hands={hands} side="left" color={COLORS.CYAN} />
      <Saber hands={hands} side="right" color={COLORS.ORANGE} />

      <CubeManager
        gameState={gameState}
        song={song}
        hands={hands}
        difficulty={difficulty}
        onScore={onScore}
        onMiss={onMiss}
      />

      <EffectComposer enableNormalPass={false}>
        <Bloom luminanceThreshold={0.5} mipmapBlur intensity={1.5} radius={0.6} />
        <ChromaticAberration offset={new Vector2(0.002, 0.002)} />
      </EffectComposer>
    </Canvas>
  );
};

export default GameScene;
