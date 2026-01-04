import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Vector3 } from 'three';
import HandTracker from './components/HandTracker';
import GameScene from './components/GameScene';
import UIOverlay from './components/UIOverlay';
import { GameState, HandData, Song } from './types';
import { SONGS } from './constants';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [currentSong, setCurrentSong] = useState<Song | null>(SONGS[0]);
  const [timeLeft, setTimeLeft] = useState(0);
  
  // Audio Ref
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerIntervalRef = useRef<number | null>(null);

  // Hand Data Ref
  const handDataRef = useRef<HandData>({
    left: null,
    right: null,
    leftDirection: new Vector3(0, 1, 0),
    rightDirection: new Vector3(0, 1, 0),
    leftVelocity: new Vector3(0, 0, 0),
    rightVelocity: new Vector3(0, 0, 0)
  });

  const prevHands = useRef<{ left: Vector3 | null, right: Vector3 | null, time: number }>({
    left: null,
    right: null,
    time: 0
  });

  const handleHandUpdate = useCallback((
      left: Vector3 | null, 
      right: Vector3 | null,
      leftDir: Vector3 | null,
      rightDir: Vector3 | null
  ) => {
    const now = performance.now() / 1000;
    const delta = now - prevHands.current.time;
    
    // Update Velocity (Position based)
    if (delta > 0) {
        if (left && prevHands.current.left) {
            handDataRef.current.leftVelocity.subVectors(left, prevHands.current.left).divideScalar(delta);
        } else {
            handDataRef.current.leftVelocity.set(0, 0, 0);
        }

        if (right && prevHands.current.right) {
            handDataRef.current.rightVelocity.subVectors(right, prevHands.current.right).divideScalar(delta);
        } else {
            handDataRef.current.rightVelocity.set(0, 0, 0);
        }
    }

    // Update Positions & Directions
    handDataRef.current.left = left;
    handDataRef.current.right = right;
    if (leftDir) handDataRef.current.leftDirection.copy(leftDir);
    if (rightDir) handDataRef.current.rightDirection.copy(rightDir);

    // Save previous
    prevHands.current = {
        left: left ? left.clone() : null,
        right: right ? right.clone() : null,
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
    setGameState(GameState.GAME_OVER);
  }, []);

  const startGame = () => {
    if (currentSong && audioRef.current) {
        setScore(0);
        setStreak(0);
        setTimeLeft(60); // 1 minute timer
        setGameState(GameState.PLAYING);
        
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
  };

  const handleScore = (points: number) => {
      setScore(prev => prev + points * (1 + Math.floor(streak / 10) * 0.1));
      setStreak(prev => prev + 1);
  };

  const handleMiss = () => {
      setStreak(0);
  };

  // Initialize Audio Element
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.crossOrigin = "anonymous";
    audioRef.current.volume = 0.6;
    audioRef.current.preload = "auto";
    
    audioRef.current.onerror = (e) => {
        console.error("Audio Error:", audioRef.current?.error, e);
    };

    return () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = "";
        }
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
        }
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
        onSelectSong={setCurrentSong} 
        onStart={startGame} 
        onRestart={restartGame}
      />

      {/* Hidden Hand Tracker */}
      <HandTracker onHandsUpdate={handleHandUpdate} />
    </div>
  );
};

export default App;