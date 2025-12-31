'use client';
import { useState, useEffect } from 'react';
import { LETTER_SCORES, INITIAL_LETTER_QUANTITIES } from '@/lib/constants';
import { findValidWords, calculateBingoBonus } from '@/lib/gameLogic';
import { runBotTurn, Placement } from '@/lib/botLogic';

import { useMultiplayer } from '@/hooks/useMultiplayer';
import { GameHeader } from './parts/GameHeader';
import { BoardGrid } from './parts/BoardGrid';
import { PlayerControls } from './parts/PlayerControls';
import { GameModals } from './parts/GameModals';

export default function Board({ mode, roomInfo, onBack }: any) {
  // --- STATE (เหมือนเดิมทุกอย่าง) ---
  const [grid, setGrid] = useState<(string | null)[][]>(Array(31).fill(null).map(() => Array(15).fill(null)));
  const [p1Rack, setP1Rack] = useState<string[]>([]);
  const [botRack, setBotRack] = useState<string[]>([]);
  const [tileBag, setTileBag] = useState<string[]>([]);
  const [turnCount, setTurnCount] = useState(0);
  const [currentPlayer, setCurrentPlayer] = useState(roomInfo?.starter || 1);
  const [scores, setScores] = useState({ p1: 0, p2: 0 });
  const [blankTiles, setBlankTiles] = useState<Set<string>>(new Set());
  const [turnHistory, setTurnHistory] = useState<{ r: number, c: number, char: string, isBlank: boolean }[]>([]);
  const [selectedRackIndex, setSelectedRackIndex] = useState<number | null>(null);
  const [showBotRack, setShowBotRack] = useState(false);
  const [blankMenu, setBlankMenu] = useState<{ r: number, c: number } | null>(null);
  const [diacriticMenu, setDiacriticMenu] = useState<{ r: number, c: number } | null>(null);
  const [isOpponentLeft, setIsOpponentLeft] = useState(false);
  const playerRole = roomInfo?.role || 1;

  // --- HOOKS ---
  useMultiplayer(mode, roomInfo, playerRole, setGrid, setScores, setCurrentPlayer, setTurnCount, setIsOpponentLeft);

  // --- INITIALIZATION ---
  useEffect(() => {
    const bag: string[] = [];
    Object.entries(INITIAL_LETTER_QUANTITIES).forEach(([char, qty]) => {
      for (let i = 0; i < qty; i++) bag.push(char);
    });
    const shuffled = bag.sort(() => Math.random() - 0.5);
    setP1Rack(shuffled.splice(0, 9));
    if (mode === 'SOLO') setBotRack(shuffled.splice(0, 9));
    setTileBag(shuffled);
  }, [mode]);

  // --- BOT LOGIC (Surgical Cleanup + Bingo) ---
  useEffect(() => {
    if (mode === 'SOLO' && currentPlayer === 2) {
      const handleBot = async () => {
        const result = await runBotTurn(grid, botRack, async (word) => {
          const res = await fetch('/api/check-word', { method: 'POST', body: JSON.stringify({ word }) });
          const data = await res.json();
          return data.valid;
        });

        if (result && result.placements.length > 0) {
          const tempGrid = grid.map(row => [...row]);
          result.placements.forEach((p: Placement) => { tempGrid[p.r][p.c] = p.char; });
          const botWordsInfo = findValidWords(tempGrid, result.placements);
          let botValidCoords = new Set<string>();
          let baseScore = 0;
          botWordsInfo.forEach(info => {
            baseScore += info.word.split('').reduce((s, c) => s + (LETTER_SCORES[c] || 0), 0);
            info.coords.forEach(coord => botValidCoords.add(coord));
          });
          const bingoBonus = calculateBingoBonus(result.placements.length);
          const finalScore = baseScore + bingoBonus;
          const cleanedGrid = Array(31).fill(null).map(() => Array(15).fill(null));
          botValidCoords.forEach(coord => {
            const [r, c] = coord.split(',').map(Number);
            cleanedGrid[r][c] = tempGrid[r][c];
          });
          setGrid(cleanedGrid);
          setScores(prev => ({ ...prev, p2: prev.p2 + finalScore }));
          const newBotRack = [...botRack];
          result.placements.forEach((p: Placement) => {
            const idx = newBotRack.indexOf(p.char);
            if (idx > -1) newBotRack.splice(idx, 1);
          });
          setBotRack([...newBotRack, ...tileBag.slice(0, result.placements.length)]);
          setTileBag(prev => prev.slice(result.placements.length));
          alert(`🤖 บอทลง: ${botWordsInfo.map(i => i.word).join(", ")} (+${finalScore})`);
        }
        setCurrentPlayer(1);
        setTurnCount(prev => prev + 1);
      };
      setTimeout(handleBot, 1500);
    }
  }, [currentPlayer]);

  // --- ACTIONS ---
  const placeTile = (r: number, c: number, char: string, isBlank: boolean) => {
    const nextGrid = [...grid];
    nextGrid[r][c] = char;
    setGrid(nextGrid);
    setTurnHistory([...turnHistory, { r, c, char, isBlank }]);
    if (isBlank) setBlankTiles(new Set(blankTiles).add(`${r},${c}`));
  };

  const handleCellClick = (r: number, c: number) => {
    if (currentPlayer !== playerRole) return;
    if (r % 2 !== 0) {
      if (selectedRackIndex !== null && !grid[r][c]) {
        const char = p1Rack[selectedRackIndex];
        if (char === '0') setBlankMenu({ r, c });
        else placeTile(r, c, char, false);
        setP1Rack(p1Rack.filter((_, i) => i !== selectedRackIndex));
        setSelectedRackIndex(null);
      }
    } else setDiacriticMenu({ r, c });
  };

  const handleRecall = () => {
    const nextRack = [...p1Rack];
    const nextGrid = [...grid];
    const nextBlanks = new Set(blankTiles);
    turnHistory.forEach(h => {
      nextRack.push(h.isBlank ? '0' : h.char);
      nextGrid[h.r][h.c] = null;
      nextBlanks.delete(`${h.r},${h.c}`);
    });
    setGrid(nextGrid); setP1Rack(nextRack); setTurnHistory([]); setBlankTiles(nextBlanks);
  };

  const handleSubmit = async () => {
  if (turnHistory.length === 0) return;

  // 1. ตรวจสอบเงื่อนไข Adjacency (ต้องวางติดเบี้ยเดิม)
  const touchesStar = turnHistory.some(h => h.r === 15 && h.c === 7);
  if (turnCount === 0 && !touchesStar) return alert("ตาแรกต้องวางทับจุดดาว!");

  if (turnCount > 0) {
    const isAdjacent = turnHistory.some(h => 
      (h.r > 1 && grid[h.r - 2][h.c]) || (h.r < 29 && grid[h.r + 2][h.c]) ||
      (h.c > 0 && grid[h.r][h.c - 1]) || (h.c < 14 && grid[h.r][h.c + 1])
    );
    if (!isAdjacent) return alert("ต้องวางต่อจากเบี้ยเดิม!");
  }

  // 2. สแกนหาคำทั้งหมด
  const wordsInfo = findValidWords(grid, turnHistory);
  if (wordsInfo.length === 0) return alert("ไม่เกิดคำที่ถูกต้อง!");

  try {
    let baseScore = 0;
    let validCoords = new Set<string>();
    let validatedWords: string[] = [];
    let hasInvalid = false;

    // 3. ตรวจสอบกับ API และสะสมคะแนน
    for (const info of wordsInfo) {
      const res = await fetch('/api/check-word', { method: 'POST', body: JSON.stringify({ word: info.word }) });
      const data = await res.json();
      
      if (data.valid) {
        // คำนวณคะแนนพื้นฐาน
        baseScore += info.word.split('').reduce((s, c) => s + (LETTER_SCORES[c] || 0), 0);
        info.coords.forEach(coord => validCoords.add(coord));
        validatedWords.push(info.word);
      } else {
        alert(`คำว่า "${info.word}" ไม่มีในพจนานุกรม!`);
        hasInvalid = true;
        break;
      }
    }

    // 4. เมื่อทุกคำถูกต้อง: ดำเนินการอัปเดต
      if (!hasInvalid && validatedWords.length > 0) {
        const bingoBonus = calculateBingoBonus(turnHistory.length); // คำนวณ Bingo
        const finalTurnTotal = baseScore + bingoBonus;

        // จัดการ Grid และ Cleanup
        const finalGrid = Array(31).fill(null).map(() => Array(15).fill(null));
        const finalBlanks = new Set<string>();
        validCoords.forEach(coord => {
          const [r, c] = coord.split(',').map(Number);
          if (grid[r][c]) {
            finalGrid[r][c] = grid[r][c];
            if (blankTiles.has(coord)) finalBlanks.add(coord);
          }
        });

        // อัปเดต State คะแนน
        const newScores = { ...scores };
        if (playerRole === 1) newScores.p1 += finalTurnTotal;
        else newScores.p2 += finalTurnTotal;

        setGrid(finalGrid);
        setBlankTiles(finalBlanks);
        setScores(newScores);

        // จั่วเบี้ยใหม่
        const numUsed = turnHistory.length;
        setP1Rack([...p1Rack, ...tileBag.slice(0, numUsed)]);
        setTileBag(prev => prev.slice(numUsed));
        
        setTurnHistory([]);
        setTurnCount(prev => prev + 1);

        // --- [จุดสำคัญ] แสดง Alert ก่อนสลับเทิร์น ---
        const bonusMsg = bingoBonus > 0 ? `\n🎉 ยินดีด้วย! Bingo Bonus +${bingoBonus} แต้ม!` : '';
        alert(`✅ สำเร็จ!\nคำที่ได้: ${validatedWords.join(', ')}\nรวม: ${finalTurnTotal} คะแนน${bonusMsg}`);

        // 5. ส่งข้อมูล Multiplayer และสลับตา
        if (mode === 'MULTI' && roomInfo) {
          await fetch('/api/multiplayer/move', {
            method: 'POST',
            body: JSON.stringify({
              roomId: roomInfo.id,
              newGrid: finalGrid,
              newScores: newScores,
              senderRole: playerRole,
              words: validatedWords,
              nextTurn: playerRole === 1 ? 2 : 1
            })
          });
        }
        
        // สลับตาเป็นคนถัดไป
        setCurrentPlayer(mode === 'SOLO' ? 2 : (playerRole === 1 ? 2 : 1));
      }
    } catch (e) {
      alert("ระบบตรวจสอบคำศัพท์ขัดข้อง");
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4 bg-slate-50 min-h-screen font-sans selection:bg-indigo-100">
      <GameHeader mode={mode} currentPlayer={currentPlayer} playerRole={playerRole} scores={scores} tileBagLength={tileBag.length} roomInfo={roomInfo} showBotRack={showBotRack} setShowBotRack={setShowBotRack} onBack={onBack} />
      
      <BoardGrid grid={grid} blankTiles={blankTiles} currentPlayer={currentPlayer} playerRole={playerRole} mode={mode} onCellClick={handleCellClick} />
      
      {showBotRack && (
        <div className="flex gap-2 p-3 bg-rose-50 rounded-2xl border-2 border-dashed border-rose-200 animate-in fade-in slide-in-from-bottom-2">
          <span className="text-[10px] font-black text-rose-400 uppercase self-center px-2">Bot's Hand:</span>
          {botRack.map((t, i) => (
            <div key={i} className="w-8 h-8 bg-white border border-rose-100 rounded-lg flex items-center justify-center text-sm text-rose-300 font-bold shadow-sm italic">{t === '0' ? ' ' : t}</div>
          ))}
        </div>
      )}

      <PlayerControls rack={p1Rack} selectedIndex={selectedRackIndex} currentPlayer={currentPlayer} playerRole={playerRole} onSelect={setSelectedRackIndex} onRecall={handleRecall} onSubmit={handleSubmit} />
      
      <GameModals blankMenu={blankMenu} diacriticMenu={diacriticMenu} isOpponentLeft={isOpponentLeft} onSelect={(char, isBlank) => {
          const t = blankMenu || diacriticMenu;
          if (t) placeTile(t.r, t.c, char, isBlank);
          setBlankMenu(null); setDiacriticMenu(null);
        }} onClose={() => {setBlankMenu(null); setDiacriticMenu(null);}} />
    </div>
  );
}