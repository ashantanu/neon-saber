import React from 'react';
import { GameState, Song } from '../types';
import { SONGS } from '../constants';
import { Play, RotateCcw, Volume2, Music, Mic, Timer } from 'lucide-react';

interface UIOverlayProps {
  gameState: GameState;
  score: number;
  streak: number;
  timeLeft: number;
  currentSong: Song | null;
  difficulty: number;
  onSelectSong: (song: Song) => void;
  onSetDifficulty: (difficulty: number) => void;
  onStart: () => void;
  onRestart: () => void;
}

const UIOverlay: React.FC<UIOverlayProps> = ({
  gameState,
  score,
  streak,
  timeLeft,
  currentSong,
  difficulty,
  onSelectSong,
  onSetDifficulty,
  onStart,
  onRestart
}) => {
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
            </div>
        )}

        <div className="flex flex-col items-end">
            <div className="text-5xl font-mono font-bold text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]">
                {score.toLocaleString()}
            </div>
            <div className="text-cyan-400 font-mono text-xl mt-1">
                STREAK: {streak}x
            </div>
        </div>
      </div>

      {/* Main Menu Sidebar */}
      {gameState === GameState.MENU && (
        <div className="absolute left-0 top-0 bottom-0 w-96 bg-black/80 backdrop-blur-md border-r border-cyan-500/30 p-8 flex flex-col pointer-events-auto transform transition-transform duration-300">
           <div className="mt-24 mb-8">
               <h2 className="text-2xl font-bold text-white mb-2">TRACK LIST</h2>
               <p className="text-gray-400 text-xs">SELECT A SONG TO START</p>
           </div>

           <div className="flex-1 overflow-y-auto space-y-2 pr-2 mb-8">
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
                               <div className="text-[10px] text-gray-400 uppercase">{song.artist}</div>
                           </div>
                       </div>
                       {currentSong?.id === song.id && <Volume2 className="text-cyan-400 animate-pulse" size={16} />}
                   </button>
               ))}
           </div>

           {/* Difficulty Slider */}
           <div className="mb-6 p-4 bg-gray-900/60 border border-gray-800 rounded-lg">
               <div className="flex justify-between items-center mb-3">
                   <h3 className="text-sm font-bold text-white">DIFFICULTY</h3>
                   <span className="text-xs font-mono text-cyan-400">
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
           
           <div className="text-[10px] text-gray-600 text-center">
               STAND BACK • ENSURE GOOD LIGHTING
           </div>
        </div>
      )}

      {/* Center Instructions if Menu */}
      {gameState === GameState.MENU && (
          <div className="absolute inset-0 left-96 flex items-center justify-center pointer-events-none">
              <div className="text-center opacity-40">
                  <div className="text-6xl text-cyan-500 font-thin mb-4">READY PLAYER ONE</div>
                  <p className="text-xl text-white">SELECT TRACK TO BEGIN</p>
              </div>
          </div>
      )}

      {/* Game Over Screen */}
      {gameState === GameState.GAME_OVER && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-black/80 backdrop-blur-md z-50">
             <div className="bg-black/90 border border-cyan-500 p-10 rounded-3xl text-center shadow-[0_0_100px_rgba(0,255,255,0.2)] animate-in fade-in zoom-in duration-300">
                <h2 className="text-6xl font-black text-white mb-2 tracking-widest">COMPLETE</h2>
                <div className="text-2xl text-cyan-400 mb-8 font-mono">FINAL SCORE: {score}</div>
                
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
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-center pointer-events-none opacity-50">
              <p className="text-sm text-cyan-200 tracking-widest">SLASH TO THE BEAT</p>
          </div>
      )}

    </div>
  );
};

export default UIOverlay;