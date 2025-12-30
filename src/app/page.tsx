'use client';
import { useState } from 'react';
import Board from '@/components/Game/Board';

export default function Home() {
  const [gameMode, setGameMode] = useState<'MENU' | 'SOLO' | 'MULTI'>('MENU');

  if (gameMode === 'MENU') {
    return (
      <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <h1 className="text-5xl font-black text-slate-800 mb-2">MODERN KUM-KOM</h1>
        <p className="text-slate-500 mb-10 font-medium text-lg text-center">
          นวัตกรรมเกมต่ออักษรไทยยุคใหม่
        </p>
        
        <div className="flex flex-col gap-4 w-full max-w-sm">
          <button onClick={() => setGameMode('SOLO')}
            className="py-4 bg-emerald-600 text-white font-bold rounded-2xl shadow-lg hover:bg-emerald-500 transition-all text-xl">
            เล่นกับบอท (Solo vs Bot)
          </button>
          <button onClick={() => setGameMode('MULTI')}
            className="py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg hover:bg-indigo-500 transition-all text-xl">
            เล่นสองคน (Local Multi)
          </button>
        </div>
      </main>
    );
  }

  return <Board mode={gameMode} onBack={() => setGameMode('MENU')} />;
}