import React, { useState } from 'react';
import { GameState, Song } from '../types';
import { SONGS } from '../constants';
import { Play, RotateCcw, Volume2, Music, Mic, Timer, Link, Loader, Zap, Target, Award, TrendingUp } from 'lucide-react';

interface UIOverlayProps {
  gameState: GameState;
  score: number;
  streak: number;
  maxStreak: number;
  perfectHits: number;
  totalHits: number;
  timeLeft: number;
  currentSong: Song | null;
  difficulty: number;
  isAnalyzing: boolean;
  onSelectSong: (song: Song) => void;
  onSetDifficulty: (difficulty: number) => void;
  onStart: () => void;
  onRestart: () => void;
  onCustomSong: (url: string) => void;
}

const UIOverlay: React.FC<UIOverlayProps> = ({
  gameState,
  score,
  streak,
  maxStreak,
  perfectHits,
  totalHits,
  timeLeft,
  currentSong,
  difficulty,
  isAnalyzing,
  onSelectSong,
  onSetDifficulty,
  onStart,
  onRestart,
  onCustomSong
}) => {
  const [customUrl, setCustomUrl] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const handleCustomSongSubmit = () => {
    if (customUrl.trim()) {
      onCustomSong(customUrl.trim());
      setCustomUrl('');
      setShowCustomInput(false);
    }
  };

  // Calculate combo multiplier display
  const comboMultiplier = 1 + Math.floor(streak / 10) * 0.1;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col z-10">

      {/* Top HUD */}
      <div className="flex justify-between items-start w-full p-8">
        <div className="flex flex-col gap-2 pointer-events-auto">
          <h1 className="text-4xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 drop-shadow-[0_0_10px_rgba(0,255,255,0.5)]">
            NEON SABER
          </h1>
          <p className="text-xs text-cyan-300/70 tracking-widest uppercase flex items-center gap-2">
            <Mic size={12} /> CAMERA TRACKING ONLINE
          </p>
        </div>

        {/* Center Timer (only visible in game) */}
        {gameState === GameState.PLAYING && (
          <div className="absolute left-1/2 top-8 -translate-x-1/2 flex flex-col items-center">
            <div className="text-4xl font-mono font-bold text-white drop-shadow-[0_0_10px_rgba(0,255,255,0.8)] flex items-center gap-2">
              <Timer size={32} className={timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-cyan-400'} />
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </div>
            {/* Current song info */}
            {currentSong && (
              <div className="text-xs text-cyan-400/60 mt-1">
                {currentSong.title} • {currentSong.bpm} BPM
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col items-end">
          <div className="text-5xl font-mono font-bold text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]">
            {Math.floor(score).toLocaleString()}
          </div>
          <div className="flex items-center gap-3 mt-1">
            {/* Streak */}
            <div className={`font-mono text-xl ${streak >= 10 ? 'text-yellow-400' : 'text-cyan-400'}`}>
              <span className="text-xs opacity-60">STREAK</span> {streak}x
            </div>
            {/* Multiplier */}
            {comboMultiplier > 1 && (
              <div className="font-mono text-sm text-green-400 animate-pulse">
                {comboMultiplier.toFixed(1)}x
              </div>
            )}
          </div>
        </div>
      </div>

      {/* In-game stats bar */}
      {gameState === GameState.PLAYING && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-8 text-sm">
          <div className="flex items-center gap-2 text-yellow-400/80">
            <Award size={16} />
            <span>{perfectHits} PERFECT</span>
          </div>
          <div className="flex items-center gap-2 text-cyan-400/80">
            <Target size={16} />
            <span>{totalHits} HITS</span>
          </div>
          <div className="flex items-center gap-2 text-orange-400/80">
            <TrendingUp size={16} />
            <span>MAX {maxStreak}x</span>
          </div>
        </div>
      )}

      {/* Main Menu Sidebar */}
      {gameState === GameState.MENU && (
        <div className="absolute left-0 top-0 bottom-0 w-96 bg-black/80 backdrop-blur-md border-r border-cyan-500/30 p-8 flex flex-col pointer-events-auto transform transition-transform duration-300">
          <div className="mt-24 mb-4">
            <h2 className="text-2xl font-bold text-white mb-2">TRACK LIST</h2>
            <p className="text-gray-400 text-xs">SELECT A SONG TO START</p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 mb-4">
            {SONGS.map(song => (
              <button
                key={song.id}
                onClick={() => onSelectSong(song)}
                className={`w-full flex items-center justify-between p-4 rounded-lg border transition-all duration-200 group text-left
                  ${currentSong?.id === song.id
                    ? 'bg-cyan-900/50 border-cyan-400 shadow-[0_0_10px_rgba(0,255,255,0.2)]'
                    : 'bg-gray-900/40 border-gray-800 hover:border-cyan-700 hover:bg-gray-800'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${currentSong?.id === song.id ? 'bg-cyan-500 text-black' : 'bg-gray-700 text-gray-300'}`}>
                    <Music size={16} />
                  </div>
                  <div>
                    <div className="font-bold text-white text-sm group-hover:text-cyan-300 transition-colors">{song.title}</div>
                    <div className="text-[10px] text-gray-400 uppercase">{song.artist} • {song.bpm} BPM</div>
                  </div>
                </div>
                {currentSong?.id === song.id && <Volume2 className="text-cyan-400 animate-pulse" size={16} />}
              </button>
            ))}

            {/* Custom Song (when added) */}
            {currentSong?.id === 'custom' && (
              <div className="w-full p-4 rounded-lg border border-purple-500 bg-purple-900/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-purple-500 text-white">
                    <Link size={16} />
                  </div>
                  <div>
                    <div className="font-bold text-white text-sm">{currentSong.title}</div>
                    <div className="text-[10px] text-gray-400 uppercase">
                      {currentSong.bpm} BPM • {Math.floor(currentSong.duration)}s
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Custom Song Input Toggle */}
          <div className="mb-4">
            <button
              onClick={() => setShowCustomInput(!showCustomInput)}
              className="w-full py-2 px-4 text-sm font-medium rounded-lg border border-dashed border-purple-500/50 text-purple-400 hover:bg-purple-900/20 transition-all flex items-center justify-center gap-2"
            >
              <Link size={14} />
              {showCustomInput ? 'HIDE' : 'ADD CUSTOM SONG URL'}
            </button>

            {showCustomInput && (
              <div className="mt-3 space-y-2">
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="Paste audio URL (MP3, WAV)..."
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                />
                <button
                  onClick={handleCustomSongSubmit}
                  disabled={!customUrl.trim() || isAnalyzing}
                  className={`w-full py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all
                    ${customUrl.trim() && !isAnalyzing
                      ? 'bg-purple-600 text-white hover:bg-purple-500'
                      : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    }`}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader size={14} className="animate-spin" />
                      ANALYZING BEATS...
                    </>
                  ) : (
                    <>
                      <Zap size={14} />
                      ANALYZE & LOAD
                    </>
                  )}
                </button>
                <p className="text-[10px] text-gray-500 text-center">
                  Auto-detects BPM and generates beat map
                </p>
              </div>
            )}
          </div>

          {/* Difficulty Slider */}
          <div className="mb-6 p-4 bg-gray-900/60 border border-gray-800 rounded-lg">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-white">DIFFICULTY</h3>
              <span className={`text-xs font-mono ${
                difficulty === 1 ? 'text-green-400' :
                difficulty === 2 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {difficulty === 1 ? 'NORMAL' : difficulty === 2 ? 'HARD' : 'EXPERT'}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="3"
              value={difficulty}
              onChange={(e) => onSetDifficulty(Number(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              style={{
                background: `linear-gradient(to right, rgb(6, 182, 212) 0%, rgb(6, 182, 212) ${((difficulty - 1) / 2) * 100}%, rgb(55, 65, 81) ${((difficulty - 1) / 2) * 100}%, rgb(55, 65, 81) 100%)`
              }}
            />
            <div className="flex justify-between mt-2 text-[10px] text-gray-500">
              <span>NORMAL</span>
              <span>HARD</span>
              <span>EXPERT</span>
            </div>
          </div>

          <button
            disabled={!currentSong}
            onClick={onStart}
            className={`w-full py-4 text-xl font-bold rounded-xl flex items-center justify-center gap-3 transition-all duration-300 mb-4
              ${currentSong
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:scale-105 shadow-[0_0_20px_rgba(0,255,255,0.5)]'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
          >
            <Play fill="currentColor" /> PLAY
          </button>

          <div className="text-[10px] text-gray-600 text-center space-y-1">
            <p>STAND BACK • ENSURE GOOD LIGHTING</p>
            <p className="text-cyan-500/50">SLASH IN THE DIRECTION OF ARROWS</p>
          </div>
        </div>
      )}

      {/* Center Instructions if Menu */}
      {gameState === GameState.MENU && (
        <div className="absolute inset-0 left-96 flex items-center justify-center pointer-events-none">
          <div className="text-center opacity-40">
            <div className="text-6xl text-cyan-500 font-thin mb-4">READY PLAYER ONE</div>
            <p className="text-xl text-white">SELECT TRACK TO BEGIN</p>
            <div className="mt-8 flex justify-center gap-8">
              <div className="text-center">
                <div className="w-16 h-16 border-2 border-cyan-500 rounded-lg flex items-center justify-center mb-2">
                  <span className="text-2xl text-cyan-400">↑</span>
                </div>
                <p className="text-xs text-gray-400">SLASH UP</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 border-2 border-orange-500 rounded-lg flex items-center justify-center mb-2">
                  <span className="text-2xl text-orange-400">↓</span>
                </div>
                <p className="text-xs text-gray-400">SLASH DOWN</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === GameState.GAME_OVER && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-black/80 backdrop-blur-md z-50">
          <div className="bg-black/90 border border-cyan-500 p-10 rounded-3xl text-center shadow-[0_0_100px_rgba(0,255,255,0.2)] animate-in fade-in zoom-in duration-300 min-w-[400px]">
            <h2 className="text-6xl font-black text-white mb-2 tracking-widest">COMPLETE</h2>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 my-8">
              <div className="bg-gray-900/60 rounded-xl p-4">
                <div className="text-3xl font-bold text-white">{Math.floor(score).toLocaleString()}</div>
                <div className="text-xs text-gray-400 uppercase">Final Score</div>
              </div>
              <div className="bg-gray-900/60 rounded-xl p-4">
                <div className="text-3xl font-bold text-yellow-400">{maxStreak}x</div>
                <div className="text-xs text-gray-400 uppercase">Max Streak</div>
              </div>
              <div className="bg-gray-900/60 rounded-xl p-4">
                <div className="text-3xl font-bold text-cyan-400">{totalHits}</div>
                <div className="text-xs text-gray-400 uppercase">Total Hits</div>
              </div>
              <div className="bg-gray-900/60 rounded-xl p-4">
                <div className="text-3xl font-bold text-green-400">{perfectHits}</div>
                <div className="text-xs text-gray-400 uppercase">Perfect Hits</div>
              </div>
            </div>

            {/* Accuracy */}
            {totalHits > 0 && (
              <div className="mb-8">
                <div className="text-sm text-gray-400 mb-1">ACCURACY</div>
                <div className="text-2xl font-bold text-white">
                  {Math.round((perfectHits / totalHits) * 100)}% Perfect
                </div>
              </div>
            )}

            <button
              onClick={onRestart}
              className="flex items-center gap-2 px-8 py-4 bg-white text-black font-bold text-xl rounded-full hover:bg-cyan-400 hover:scale-105 transition-all mx-auto"
            >
              <RotateCcw size={24} /> REPLAY
            </button>
          </div>
        </div>
      )}

      {/* In Game Hint */}
      {gameState === GameState.PLAYING && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center pointer-events-none opacity-50">
          <p className="text-sm text-cyan-200 tracking-widest">SLASH IN ARROW DIRECTION</p>
        </div>
      )}

    </div>
  );
};

export default UIOverlay;
