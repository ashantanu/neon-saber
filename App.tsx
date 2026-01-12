import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Vector3, Quaternion } from 'three';
import HandTracker from './components/HandTracker';
import GameScene from './components/GameScene';
import UIOverlay from './components/UIOverlay';
import { GameState, HandData, Song } from './types';
import { SONGS, GAME_CONFIG } from './constants';
import { getAudio8Bit } from './utils/audio8bit';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [currentSong, setCurrentSong] = useState<Song | null>(SONGS[0]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [difficulty, setDifficulty] = useState(1); // 1 = Normal, 2 = Hard, 3 = Expert
  const [previewingSongId, setPreviewingSongId] = useState<string | null>(null);

  // Audio Ref
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerIntervalRef = useRef<number | null>(null);

  // Hand Data Ref - using refs instead of state for buttery-smooth 60fps updates
  const handDataRef = useRef<HandData>({
    left: null,
    right: null,
    leftDirection: new Vector3(0, 1, 0),
    rightDirection: new Vector3(0, 1, 0),
    leftVelocity: new Vector3(0, 0, 0),
    rightVelocity: new Vector3(0, 0, 0),
    leftVelocityHistory: [],
    rightVelocityHistory: []
  });

  const prevHands = useRef<{ left: Vector3 | null, right: Vector3 | null, time: number }>({
    left: null,
    right: null,
    time: 0
  });

  // Smoothed position/direction refs - these lerp towards raw MediaPipe data
  const smoothedLeft = useRef<Vector3 | null>(null);
  const smoothedRight = useRef<Vector3 | null>(null);
  const smoothedLeftDir = useRef(new Vector3(0, 1, 0));
  const smoothedRightDir = useRef(new Vector3(0, 1, 0));
  const upVec = useRef(new Vector3(0, 1, 0));

  // Smoothing factors (0-1, higher = more responsive but less smooth)
  const POSITION_SMOOTHING = 0.5;  // Lerp factor for positions
  const DIRECTION_SMOOTHING = 0.4; // Lerp factor for directions

  const handleHandUpdate = useCallback((
      left: Vector3 | null,
      right: Vector3 | null,
      leftDir: Vector3 | null,
      rightDir: Vector3 | null
  ) => {
    const now = performance.now() / 1000;
    const delta = now - prevHands.current.time;

    // --- POSITION SMOOTHING ---
    // Smooth left hand position
    if (left) {
        if (smoothedLeft.current === null) {
            smoothedLeft.current = left.clone();
        } else {
            smoothedLeft.current.lerp(left, POSITION_SMOOTHING);
        }
    } else {
        smoothedLeft.current = null;
    }

    // Smooth right hand position
    if (right) {
        if (smoothedRight.current === null) {
            smoothedRight.current = right.clone();
        } else {
            smoothedRight.current.lerp(right, POSITION_SMOOTHING);
        }
    } else {
        smoothedRight.current = null;
    }

    // --- DIRECTION SMOOTHING ---
    // Smooth left direction using lerp then normalize
    if (leftDir) {
        smoothedLeftDir.current.lerp(leftDir, DIRECTION_SMOOTHING);
        smoothedLeftDir.current.normalize();
    }

    // Smooth right direction using lerp then normalize
    if (rightDir) {
        smoothedRightDir.current.lerp(rightDir, DIRECTION_SMOOTHING);
        smoothedRightDir.current.normalize();
    }

    // --- VELOCITY TRACKING (using smoothed positions for consistency) ---
    if (delta > 0) {
        // Left hand velocity (based on smoothed positions)
        if (smoothedLeft.current && prevHands.current.left) {
            const newLeftVel = new Vector3().subVectors(smoothedLeft.current, prevHands.current.left).divideScalar(delta);

            // Track velocity history
            handDataRef.current.leftVelocityHistory.push(newLeftVel.clone());
            if (handDataRef.current.leftVelocityHistory.length > GAME_CONFIG.VELOCITY_HISTORY_SIZE) {
                handDataRef.current.leftVelocityHistory.shift();
            }

            // Compute averaged velocity from history for smoother slash detection
            const avgLeftVel = new Vector3();
            for (const vel of handDataRef.current.leftVelocityHistory) {
                avgLeftVel.add(vel);
            }
            avgLeftVel.divideScalar(handDataRef.current.leftVelocityHistory.length);
            handDataRef.current.leftVelocity.copy(avgLeftVel);
        } else {
            handDataRef.current.leftVelocity.set(0, 0, 0);
            handDataRef.current.leftVelocityHistory.length = 0;
        }

        // Right hand velocity (based on smoothed positions)
        if (smoothedRight.current && prevHands.current.right) {
            const newRightVel = new Vector3().subVectors(smoothedRight.current, prevHands.current.right).divideScalar(delta);

            // Track velocity history
            handDataRef.current.rightVelocityHistory.push(newRightVel.clone());
            if (handDataRef.current.rightVelocityHistory.length > GAME_CONFIG.VELOCITY_HISTORY_SIZE) {
                handDataRef.current.rightVelocityHistory.shift();
            }

            // Compute averaged velocity from history for smoother slash detection
            const avgRightVel = new Vector3();
            for (const vel of handDataRef.current.rightVelocityHistory) {
                avgRightVel.add(vel);
            }
            avgRightVel.divideScalar(handDataRef.current.rightVelocityHistory.length);
            handDataRef.current.rightVelocity.copy(avgRightVel);
        } else {
            handDataRef.current.rightVelocity.set(0, 0, 0);
            handDataRef.current.rightVelocityHistory.length = 0;
        }
    }

    // --- UPDATE HAND DATA REF with smoothed values ---
    handDataRef.current.left = smoothedLeft.current ? smoothedLeft.current.clone() : null;
    handDataRef.current.right = smoothedRight.current ? smoothedRight.current.clone() : null;
    handDataRef.current.leftDirection.copy(smoothedLeftDir.current);
    handDataRef.current.rightDirection.copy(smoothedRightDir.current);

    // Save previous (using smoothed positions for velocity calculation)
    prevHands.current = {
        left: smoothedLeft.current ? smoothedLeft.current.clone() : null,
        right: smoothedRight.current ? smoothedRight.current.clone() : null,
        time: now
    };
  }, []);

  const stopGame = useCallback(() => {
    if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
    }
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
    }

    // Stop 8-bit background music
    const audio8bit = getAudio8Bit();
    audio8bit.stopBackgroundMusic();

    setGameState(GameState.GAME_OVER);
  }, []);

  const startGame = () => {
    if (currentSong && audioRef.current) {
        setScore(0);
        setStreak(0);
        setTimeLeft(60); // 1 minute timer
        setGameState(GameState.PLAYING);

        // Stop any preview and play 8-bit game start sound
        const audio8bit = getAudio8Bit();
        audio8bit.stopTrackPreview();
        setPreviewingSongId(null);
        audio8bit.playGameStart();

        // Start 8-bit background music after a short delay (with correct song pattern)
        setTimeout(() => {
          audio8bit.startBackgroundMusic(currentSong.id);
        }, 600);

        // Ensure audio src is set
        if (audioRef.current.src !== currentSong.url) {
             audioRef.current.src = currentSong.url;
        }

        audioRef.current.load();

        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
            playPromise.catch(e => {
                console.error("Audio play failed. User interaction might be required.", e);
            });
        }

        // Start Timer
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

        timerIntervalRef.current = window.setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    stopGame();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        audioRef.current.onended = () => {
            stopGame();
        };
    }
  };

  const restartGame = () => {
    setGameState(GameState.MENU);
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
    }
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    // Stop 8-bit background music and any preview
    const audio8bit = getAudio8Bit();
    audio8bit.stopBackgroundMusic();
    audio8bit.stopTrackPreview();
    setPreviewingSongId(null);
  };

  const handleScore = (points: number) => {
      setScore(prev => prev + points * (1 + Math.floor(streak / 10) * 0.1));
      setStreak(prev => prev + 1);
  };

  const handleMiss = () => {
      setStreak(0);
  };

  const handleTogglePreview = useCallback((song: Song) => {
    const audio8bit = getAudio8Bit();
    const isPlaying = audio8bit.playTrackPreview(song.id);
    setPreviewingSongId(isPlaying ? song.id : null);
  }, []);

  // Initialize Audio Element
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.crossOrigin = "anonymous";
    audioRef.current.volume = 0.6;
    audioRef.current.preload = "auto";

    audioRef.current.onerror = (e) => {
        console.error("Audio Error:", audioRef.current?.error, e);
    };

    // Set up callback for when preview auto-stops
    const audio8bit = getAudio8Bit();
    audio8bit.setOnPreviewEnd(() => {
      setPreviewingSongId(null);
    });

    return () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = "";
        }
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
        }
        // Clean up the callback
        audio8bit.setOnPreviewEnd(null);
    };
  }, []);

  return (
    <div className="w-full h-screen bg-black relative overflow-hidden">
      {/* 3D Scene Layer */}
      <div className="absolute inset-0 z-0">
        <GameScene
            gameState={gameState}
            hands={handDataRef}
            song={currentSong}
            difficulty={difficulty}
            onScore={handleScore}
            onMiss={handleMiss}
        />
      </div>

      {/* UI Layer */}
      <UIOverlay
        gameState={gameState}
        score={score}
        streak={streak}
        timeLeft={timeLeft}
        currentSong={currentSong}
        difficulty={difficulty}
        previewingSongId={previewingSongId}
        onSelectSong={setCurrentSong}
        onTogglePreview={handleTogglePreview}
        onSetDifficulty={setDifficulty}
        onStart={startGame}
        onRestart={restartGame}
      />

      {/* Hidden Hand Tracker */}
      <HandTracker onHandsUpdate={handleHandUpdate} />
    </div>
  );
};

export default App;