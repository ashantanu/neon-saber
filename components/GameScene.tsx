import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing';
import { Stars, Trail } from '@react-three/drei';
import * as THREE from 'three';
import { Vector2, Vector3, Quaternion } from 'three';
import { HandData, GameState, Song, CubeData, ExplosionEvent, SlashDirection, HitResult, SliceDebris, BeatMap } from '../types';
import { GAME_CONFIG, COLORS, DIRECTION_ROTATIONS } from '../constants';
import { getAudio8Bit } from '../utils/audio8bit';
import { calculateHitScore, getAverageVelocity } from '../utils/slashValidator';
import { getPatternGenerator, generateSimpleBeatMap, SpawnEvent } from '../utils/patternGenerator';

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

// Saber with trail effect
const Saber = ({ hands, side, color }: { hands: React.MutableRefObject<HandData>; side: 'left' | 'right'; color: string }) => {
  const groupRef = useRef<THREE.Group>(null);
  const tipRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  // Smoothing refs
  const currentPos = useRef(new Vector3(side === 'left' ? -0.8 : 0.8, 1, 0));
  const currentQuat = useRef(new Quaternion());

  const defaultPos = useMemo(() => new Vector3(side === 'left' ? -0.8 : 0.8, 1, 0), [side]);
  const dummyQuat = useMemo(() => new Quaternion(), []);
  const upVec = useMemo(() => new Vector3(0, 1, 0), []);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const targetPos = side === 'left' ? hands.current.left : hands.current.right;
    const targetDir = side === 'left' ? hands.current.leftDirection : hands.current.rightDirection;

    // Position Smoothing (Lerp)
    if (targetPos) {
      currentPos.current.lerp(targetPos, 25 * delta);
    } else {
      currentPos.current.lerp(defaultPos, 5 * delta);
    }
    groupRef.current.position.copy(currentPos.current);

    // Rotation Smoothing (Slerp)
    if (targetDir) {
      dummyQuat.setFromUnitVectors(upVec, targetDir);
      currentQuat.current.slerp(dummyQuat, 20 * delta);
      groupRef.current.quaternion.copy(currentQuat.current);
    }

    // Light Flicker
    if (lightRef.current) {
      lightRef.current.intensity = 1.5 + Math.random() * 0.5;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Handle */}
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.2, 16]} />
        <meshStandardMaterial color="#333" roughness={0.4} metalness={0.8} />
      </mesh>

      {/* Blade with Trail */}
      <Trail
        width={0.3}
        length={6}
        color={color}
        attenuation={(t) => t * t}
      >
        <mesh ref={tipRef} position={[0, GAME_CONFIG.SABER_LENGTH, 0]}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </Trail>

      {/* Blade core */}
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

            const color = new THREE.Color(p.color);
            meshRef.current!.setColorAt(instanceIdx, color);

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

// Slice debris effect - cube halves flying apart
const SliceDebrisEffect = ({ debris }: { debris: SliceDebris[] }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    let instanceIdx = 0;

    debris.forEach(d => {
      const age = state.clock.getElapsedTime() - d.startTime;
      const lifeRatio = 1 - age / 1.5; // 1.5 second lifetime

      if (lifeRatio > 0 && instanceIdx < 200) {
        // Update position with velocity and gravity
        d.position.addScaledVector(d.velocity, delta);
        d.position.y -= 9.8 * delta * age; // Gravity

        // Update rotation
        d.rotation.x += d.rotationSpeed.x * delta;
        d.rotation.y += d.rotationSpeed.y * delta;
        d.rotation.z += d.rotationSpeed.z * delta;

        dummy.position.copy(d.position);
        dummy.rotation.set(d.rotation.x, d.rotation.y, d.rotation.z);
        dummy.scale.setScalar(0.25 * lifeRatio);
        dummy.updateMatrix();

        meshRef.current!.setMatrixAt(instanceIdx, dummy.matrix);

        const color = new THREE.Color(d.color);
        meshRef.current!.setColorAt(instanceIdx, color);

        instanceIdx++;
      }
    });

    meshRef.current.count = instanceIdx;
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, 200]}>
      <boxGeometry args={[0.5, 0.5, 0.25]} />
      <meshStandardMaterial toneMapped={false} />
    </instancedMesh>
  );
};

// --- Directional Cube ---

interface CubeProps {
  data: CubeData;
  hands: React.MutableRefObject<HandData>;
  onHit: (id: string, pos: Vector3, color: string, result: HitResult, direction: SlashDirection) => void;
  onMiss: (id: string) => void;
  streak: number;
}

const DirectionalCube: React.FC<CubeProps> = ({ data, hands, onHit, onMiss, streak }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const hitRef = useRef(false);
  const glowRef = useRef(0);

  // Materials
  const matCyan = useMemo(() => new THREE.MeshStandardMaterial({
    color: COLORS.CYAN,
    emissive: COLORS.CYAN_GLOW,
    emissiveIntensity: 1
  }), []);

  const matOrange = useMemo(() => new THREE.MeshStandardMaterial({
    color: COLORS.ORANGE,
    emissive: COLORS.ORANGE_GLOW,
    emissiveIntensity: 1
  }), []);

  // Arrow geometry for direction indicator
  const arrowGeo = useMemo(() => {
    const shape = new THREE.Shape();
    // Arrow pointing up
    shape.moveTo(0, 0.15);
    shape.lineTo(0.1, 0);
    shape.lineTo(0.03, 0);
    shape.lineTo(0.03, -0.15);
    shape.lineTo(-0.03, -0.15);
    shape.lineTo(-0.03, 0);
    shape.lineTo(-0.1, 0);
    shape.lineTo(0, 0.15);

    const extrudeSettings = { depth: 0.02, bevelEnabled: false };
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, []);

  const matWhite = useMemo(() => new THREE.MeshBasicMaterial({ color: 'white' }), []);
  const matDot = useMemo(() => new THREE.MeshBasicMaterial({ color: '#333' }), []);

  useFrame((state, delta) => {
    if (!meshRef.current || hitRef.current) return;

    meshRef.current.position.z += GAME_CONFIG.CUBE_SPEED * delta;
    const currentZ = meshRef.current.position.z;

    // Pulse glow as cube approaches
    glowRef.current = Math.sin(state.clock.getElapsedTime() * 5) * 0.3 + 1;
    const mat = data.color === 'cyan' ? matCyan : matOrange;
    mat.emissiveIntensity = glowRef.current;

    // Collision Window
    if (currentZ > -2 && currentZ < 3) {
      const h = hands.current;
      const isCyan = data.color === 'cyan';
      const targetHandPos = isCyan ? h.left : h.right;
      const targetVelocity = isCyan ? h.leftVelocity : h.rightVelocity;
      const velocityHistory = isCyan ? h.leftVelocityHistory : h.rightVelocityHistory;

      if (targetHandPos) {
        // Get average velocity for more accurate direction detection
        const avgVelocity = velocityHistory.length > 0
          ? getAverageVelocity(velocityHistory)
          : targetVelocity.clone();

        // Calculate hit distance
        const cubePos = meshRef.current.position;
        const dist = cubePos.distanceTo(targetHandPos);

        // Check if within hit range
        if (dist < GAME_CONFIG.HIT_THRESHOLD) {
          // Calculate hit score
          const result = calculateHitScore(avgVelocity, data.direction, dist, streak);

          if (result.hit) {
            hitRef.current = true;
            meshRef.current.visible = false;
            onHit(
              data.id,
              meshRef.current.position.clone(),
              data.color === 'cyan' ? COLORS.CYAN : COLORS.ORANGE,
              result,
              data.direction
            );
          }
        }
      }
    }

    // Miss detection
    if (currentZ > GAME_CONFIG.DESPAWN_Z) {
      hitRef.current = true;
      onMiss(data.id);
    }
  });

  // Calculate arrow rotation based on direction
  const arrowRotation = DIRECTION_ROTATIONS[data.direction] || 0;
  const showArrow = data.direction !== SlashDirection.ANY;

  return (
    <mesh ref={meshRef} position={data.position.clone()}>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <primitive object={data.color === 'cyan' ? matCyan : matOrange} attach="material" />

      {/* Direction arrow on front face */}
      {showArrow ? (
        <mesh
          geometry={arrowGeo}
          material={matWhite}
          rotation={[0, 0, arrowRotation]}
          position={[0, 0, 0.26]}
        />
      ) : (
        // Dot for ANY direction
        <mesh position={[0, 0, 0.26]}>
          <circleGeometry args={[0.08, 16]} />
          <primitive object={matDot} attach="material" />
        </mesh>
      )}

      {/* Glow light */}
      <pointLight
        color={data.color === 'cyan' ? COLORS.CYAN : COLORS.ORANGE}
        distance={2}
        intensity={2}
      />
    </mesh>
  );
};

// --- Cube Manager with Beat-Sync Spawning ---

interface CubeManagerProps {
  gameState: GameState;
  song: Song | null;
  hands: React.MutableRefObject<HandData>;
  difficulty: number;
  streak: number;
  audioElement: HTMLAudioElement | null;
  onScore: (points: number, result: HitResult) => void;
  onMiss: () => void;
}

const CubeManager: React.FC<CubeManagerProps> = ({
  gameState,
  song,
  hands,
  difficulty,
  streak,
  audioElement,
  onScore,
  onMiss
}) => {
  const [cubes, setCubes] = useState<CubeData[]>([]);
  const [explosions, setExplosions] = useState<ExplosionEvent[]>([]);
  const [debris, setDebris] = useState<SliceDebris[]>([]);

  // Beat-based spawning state
  const spawnEventsRef = useRef<SpawnEvent[]>([]);
  const nextSpawnIndexRef = useRef(0);
  const lastSpawnTime = useRef(0);
  const clockRef = useRef(new THREE.Clock());

  // Initialize spawn events when song starts
  React.useEffect(() => {
    if (gameState === GameState.PLAYING && song) {
      const generator = getPatternGenerator();
      generator.reset();

      // Generate beat map (use song's beatMap if available, otherwise generate from BPM)
      const beatMap = song.beatMap || generateSimpleBeatMap(song.bpm, song.duration);

      // Generate spawn events
      spawnEventsRef.current = generator.generateFromBeatMap(beatMap, difficulty);
      nextSpawnIndexRef.current = 0;
      clockRef.current.start();
      setCubes([]);
      setExplosions([]);
      setDebris([]);
    }
  }, [gameState, song, difficulty]);

  useFrame((state) => {
    if (gameState !== GameState.PLAYING || !audioElement) {
      if (cubes.length > 0 && gameState === GameState.MENU) setCubes([]);
      return;
    }

    // Get current audio time
    const audioTime = audioElement.currentTime;

    // Calculate when cubes should spawn (look ahead by travel time)
    const travelTime = Math.abs(GAME_CONFIG.SPAWN_Z) / GAME_CONFIG.CUBE_SPEED;
    const spawnTime = audioTime + travelTime;

    // Spawn cubes that should appear
    const events = spawnEventsRef.current;
    while (
      nextSpawnIndexRef.current < events.length &&
      events[nextSpawnIndexRef.current].time <= spawnTime
    ) {
      const event = events[nextSpawnIndexRef.current];

      // Add cubes from this event
      setCubes(prev => [...prev, ...event.cubes.map(c => ({
        ...c,
        position: c.position.clone()
      }))]);

      nextSpawnIndexRef.current++;
    }

    // Clean up old explosions and debris
    const now = state.clock.getElapsedTime();
    setExplosions(prev => prev.filter(e => now - e.startTime < 1.5));
    setDebris(prev => prev.filter(d => now - d.startTime < 1.5));
  });

  const handleCubeHit = (id: string, pos: Vector3, color: string, result: HitResult, direction: SlashDirection) => {
    setCubes(prev => prev.filter(c => c.id !== id));
    onScore(result.score, result);

    // Play sound
    const audio8bit = getAudio8Bit();
    audio8bit.playExplosion();

    // Create explosion particles
    const particles = [];
    const particleCount = result.perfectHit ? 25 : 15;
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        id: i,
        position: pos.clone(),
        velocity: new Vector3(
          Math.random() - 0.5,
          Math.random() - 0.5,
          Math.random() - 0.5
        ).normalize().multiplyScalar(5 + Math.random() * 5),
        color: result.perfectHit ? COLORS.PERFECT : color,
        life: 0.5 + Math.random() * 0.5,
        scale: 0.2 + Math.random() * 0.2
      });
    }

    setExplosions(prev => [...prev, {
      id: `exp-${id}`,
      particles,
      startTime: clockRef.current.getElapsedTime()
    }]);

    // Create slice debris (two halves)
    const sliceDir = DIRECTION_ROTATIONS[direction] || 0;
    const debrisPieces: SliceDebris[] = [
      {
        id: `debris-${id}-left`,
        position: pos.clone(),
        velocity: new Vector3(-2 - Math.random() * 2, 2 + Math.random() * 2, 1),
        rotation: new Vector3(0, 0, 0),
        rotationSpeed: new Vector3(
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10
        ),
        color,
        startTime: clockRef.current.getElapsedTime(),
        half: 'left'
      },
      {
        id: `debris-${id}-right`,
        position: pos.clone(),
        velocity: new Vector3(2 + Math.random() * 2, 2 + Math.random() * 2, 1),
        rotation: new Vector3(0, 0, 0),
        rotationSpeed: new Vector3(
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10
        ),
        color,
        startTime: clockRef.current.getElapsedTime(),
        half: 'right'
      }
    ];
    setDebris(prev => [...prev, ...debrisPieces]);
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
          streak={streak}
        />
      ))}
      <Explosions explosions={explosions} />
      <SliceDebrisEffect debris={debris} />
    </group>
  );
};

// --- Hit Feedback Display ---
const HitFeedback = ({ lastHit }: { lastHit: { result: HitResult; time: number } | null }) => {
  const textRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!textRef.current || !lastHit) return;

    const age = state.clock.getElapsedTime() - lastHit.time;
    if (age > 0.5) {
      textRef.current.visible = false;
      return;
    }

    textRef.current.visible = true;
    textRef.current.position.y = 2 + age * 2;
    const scale = 1 - age;
    textRef.current.scale.setScalar(scale);
  });

  if (!lastHit) return null;

  const text = lastHit.result.perfectHit ? 'PERFECT!' : lastHit.result.score >= 80 ? 'GREAT!' : 'OK';
  const color = lastHit.result.perfectHit ? COLORS.PERFECT : COLORS.GOOD;

  return (
    <mesh ref={textRef} position={[0, 2, -5]}>
      <planeGeometry args={[2, 0.5]} />
      <meshBasicMaterial color={color} transparent opacity={0.8} />
    </mesh>
  );
};

// --- Main Game Scene ---

interface GameSceneProps {
  gameState: GameState;
  hands: React.MutableRefObject<HandData>;
  song: Song | null;
  difficulty: number;
  streak: number;
  audioElement: HTMLAudioElement | null;
  onScore: (points: number, result: HitResult) => void;
  onMiss: () => void;
}

const GameScene: React.FC<GameSceneProps> = ({
  gameState,
  hands,
  song,
  difficulty,
  streak,
  audioElement,
  onScore,
  onMiss
}) => {
  const [lastHit, setLastHit] = useState<{ result: HitResult; time: number } | null>(null);

  const handleScore = (points: number, result: HitResult) => {
    setLastHit({ result, time: performance.now() / 1000 });
    onScore(points, result);
  };

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
        streak={streak}
        audioElement={audioElement}
        onScore={handleScore}
        onMiss={onMiss}
      />

      <HitFeedback lastHit={lastHit} />

      <EffectComposer enableNormalPass={false}>
        <Bloom luminanceThreshold={0.5} mipmapBlur intensity={1.5} radius={0.6} />
        <ChromaticAberration offset={new Vector2(0.002, 0.002)} />
      </EffectComposer>
    </Canvas>
  );
};

export default GameScene;
