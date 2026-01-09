import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Vector3 } from 'three';
import HandTracker from './components/HandTracker';
import GameScene from './components/GameScene';
import UIOverlay from './components/UIOverlay';
import { GameState, HandData, Song, HitResult, BeatMap } from './types';
import { SONGS, GAME_CONFIG } from './constants';
import { getAudio8Bit } from './utils/audio8bit';
import { getBeatDetector, analyzeAudioBuffer } from './utils/beatDetector';

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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [customSongUrl, setCustomSongUrl] = useState('');

  // Audio Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerIntervalRef = useRef<number | null>(null);

  // Hand Data Ref with velocity history
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

    // Update Velocity with history tracking
    if (delta > 0) {
      // Left hand velocity
      if (left && prevHands.current.left) {
        const newLeftVel = new Vector3().subVectors(left, prevHands.current.left).divideScalar(delta);
        handDataRef.current.leftVelocity.copy(newLeftVel);

        // Add to history
        handDataRef.current.leftVelocityHistory.push(newLeftVel.clone());
        if (handDataRef.current.leftVelocityHistory.length > GAME_CONFIG.VELOCITY_HISTORY_SIZE) {
          handDataRef.current.leftVelocityHistory.shift();
        }
      } else {
        handDataRef.current.leftVelocity.set(0, 0, 0);
        handDataRef.current.leftVelocityHistory = [];
      }

      // Right hand velocity
      if (right && prevHands.current.right) {
        const newRightVel = new Vector3().subVectors(right, prevHands.current.right).divideScalar(delta);
        handDataRef.current.rightVelocity.copy(newRightVel);

        // Add to history
        handDataRef.current.rightVelocityHistory.push(newRightVel.clone());
        if (handDataRef.current.rightVelocityHistory.length > GAME_CONFIG.VELOCITY_HISTORY_SIZE) {
          handDataRef.current.rightVelocityHistory.shift();
        }
      } else {
        handDataRef.current.rightVelocity.set(0, 0, 0);
        handDataRef.current.rightVelocityHistory = [];
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

    // Stop 8-bit background music
    const audio8bit = getAudio8Bit();
    audio8bit.stopBackgroundMusic();

    // Disconnect beat detector
    const beatDetector = getBeatDetector();
    beatDetector.disconnect();

    setGameState(GameState.GAME_OVER);
  }, []);

  const startGame = async () => {
    if (currentSong && audioRef.current) {
      setScore(0);
      setStreak(0);
      setMaxStreak(0);
      setPerfectHits(0);
      setTotalHits(0);
      setTimeLeft(currentSong.duration);
      setGameState(GameState.PLAYING);

      // Play 8-bit game start sound
      const audio8bit = getAudio8Bit();
      audio8bit.playGameStart();

      // Start 8-bit background music after a short delay
      setTimeout(() => {
        audio8bit.startBackgroundMusic();
      }, 600);

      // Ensure audio src is set
      if (audioRef.current.src !== currentSong.url) {
        audioRef.current.src = currentSong.url;
      }

      audioRef.current.load();

      // Connect beat detector for real-time analysis
      const beatDetector = getBeatDetector();
      beatDetector.connect(audioRef.current);

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

    // Stop 8-bit background music
    const audio8bit = getAudio8Bit();
    audio8bit.stopBackgroundMusic();

    // Disconnect beat detector
    const beatDetector = getBeatDetector();
    beatDetector.disconnect();
  };

  const handleScore = (points: number, result: HitResult) => {
    setScore(prev => prev + points);
    setStreak(prev => {
      const newStreak = prev + 1;
      setMaxStreak(current => Math.max(current, newStreak));
      return newStreak;
    });
    setTotalHits(prev => prev + 1);
    if (result.perfectHit) {
      setPerfectHits(prev => prev + 1);
    }
  };

  const handleMiss = () => {
    setStreak(0);
  };

  // Handle custom song URL (YouTube or direct audio)
  const handleCustomSong = async (url: string) => {
    setIsAnalyzing(true);
    setCustomSongUrl(url);

    try {
      // For now, handle direct audio URLs
      // YouTube integration would require a backend service
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        // Show message that YouTube requires backend
        alert('YouTube integration requires a backend service. Please use a direct audio URL for now, or see the BEAT_SABER_PLAN.md for implementation details.');
        setIsAnalyzing(false);
        return;
      }

      // Create custom song from URL
      const customSong: Song = {
        id: 'custom',
        title: 'Custom Song',
        artist: 'Unknown',
        bpm: 120, // Will be detected
        url: url,
        duration: 180, // Default 3 minutes
        color: '#FF00FF'
      };

      // Try to analyze the audio
      try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Analyze for beats
        const beatMap = await analyzeAudioBuffer(audioBuffer);
        customSong.beatMap = beatMap;
        customSong.bpm = beatMap.bpm;
        customSong.duration = audioBuffer.duration;

        console.log(`Detected BPM: ${beatMap.bpm}, Beats: ${beatMap.beats.length}`);
      } catch (e) {
        console.warn('Could not analyze audio, using default BPM:', e);
      }

      setCurrentSong(customSong);
    } catch (error) {
      console.error('Failed to load custom song:', error);
      alert('Failed to load the audio file. Please check the URL.');
    }

    setIsAnalyzing(false);
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
          difficulty={difficulty}
          streak={streak}
          audioElement={audioRef.current}
          onScore={handleScore}
          onMiss={handleMiss}
        />
      </div>

      {/* UI Layer */}
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
        isAnalyzing={isAnalyzing}
        onSelectSong={setCurrentSong}
        onSetDifficulty={setDifficulty}
        onStart={startGame}
        onRestart={restartGame}
        onCustomSong={handleCustomSong}
      />

      {/* Hidden Hand Tracker */}
      <HandTracker onHandsUpdate={handleHandUpdate} />
    </div>
  );
};

export default App;
