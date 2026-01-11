import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Vector3 } from 'three';
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
  const [maxStreak, setMaxStreak] = useState(0);
  const [perfectHits, setPerfectHits] = useState(0);
  const [totalHits, setTotalHits] = useState(0);
  const [currentSong, setCurrentSong] = useState<Song | null>(SONGS[0]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [difficulty, setDifficulty] = useState(1);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerIntervalRef = useRef<number | null>(null);

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

  const handleHandUpdate = useCallback((
    left: Vector3 | null,
    right: Vector3 | null,
    leftDir: Vector3 | null,
    rightDir: Vector3 | null
  ) => {
    const now = performance.now() / 1000;
    const delta = now - prevHands.current.time;

    if (delta > 0) {
      if (left && prevHands.current.left) {
        const newLeftVel = new Vector3().subVectors(left, prevHands.current.left).divideScalar(delta);
        handDataRef.current.leftVelocity.copy(newLeftVel);
        handDataRef.current.leftVelocityHistory.push(newLeftVel.clone());
        if (handDataRef.current.leftVelocityHistory.length > GAME_CONFIG.VELOCITY_HISTORY_SIZE) {
          handDataRef.current.leftVelocityHistory.shift();
        }
      } else {
        handDataRef.current.leftVelocity.set(0, 0, 0);
        handDataRef.current.leftVelocityHistory = [];
      }

      if (right && prevHands.current.right) {
        const newRightVel = new Vector3().subVectors(right, prevHands.current.right).divideScalar(delta);
        handDataRef.current.rightVelocity.copy(newRightVel);
        handDataRef.current.rightVelocityHistory.push(newRightVel.clone());
        if (handDataRef.current.rightVelocityHistory.length > GAME_CONFIG.VELOCITY_HISTORY_SIZE) {
          handDataRef.current.rightVelocityHistory.shift();
        }
      } else {
        handDataRef.current.rightVelocity.set(0, 0, 0);
        handDataRef.current.rightVelocityHistory = [];
      }
    }

    handDataRef.current.left = left;
    handDataRef.current.right = right;
    if (leftDir) handDataRef.current.leftDirection.copy(leftDir);
    if (rightDir) handDataRef.current.rightDirection.copy(rightDir);

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
    getAudio8Bit().stopBackgroundMusic();
    setGameState(GameState.GAME_OVER);
  }, []);

  const startGame = () => {
    if (currentSong && audioRef.current) {
      setScore(0);
      setStreak(0);
      setMaxStreak(0);
      setPerfectHits(0);
      setTotalHits(0);
      setTimeLeft(60);
      setGameState(GameState.PLAYING);

      const audio8bit = getAudio8Bit();
      audio8bit.playGameStart();
      setTimeout(() => audio8bit.startBackgroundMusic(), 600);

      if (audioRef.current.src !== currentSong.url) {
        audioRef.current.src = currentSong.url;
      }
      audioRef.current.load();
      audioRef.current.play().catch(e => console.error("Audio play failed:", e));

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

      audioRef.current.onended = () => stopGame();
    }
  };

  const restartGame = () => {
    setGameState(GameState.MENU);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    getAudio8Bit().stopBackgroundMusic();
  };

  const handleScore = (points: number) => {
    setScore(prev => prev + points * (1 + Math.floor(streak / 10) * 0.1));
    setStreak(prev => {
      const newStreak = prev + 1;
      setMaxStreak(current => Math.max(current, newStreak));
      return newStreak;
    });
    setTotalHits(prev => prev + 1);
  };

  const handleMiss = () => {
    setStreak(0);
  };

  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.crossOrigin = "anonymous";
    audioRef.current.volume = 0.6;
    audioRef.current.preload = "auto";

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

      <UIOverlay
        gameState={gameState}
        score={score}
        streak={streak}
        maxStreak={maxStreak}
        perfectHits={perfectHits}
        totalHits={totalHits}
        timeLeft={timeLeft}
        currentSong={currentSong}
        difficulty={difficulty}
        isAnalyzing={false}
        onSelectSong={setCurrentSong}
        onSetDifficulty={setDifficulty}
        onStart={startGame}
        onRestart={restartGame}
        onCustomSong={() => {}}
      />

      <HandTracker onHandsUpdate={handleHandUpdate} />
    </div>
  );
};

export default App;
