'use client';
import React, { useState, useEffect } from 'react';
import { 
  BOARD_LAYOUT, 
  LETTER_SCORES, 
  INITIAL_LETTER_QUANTITIES, 
  FREE_DIACRITICS, 
  THAI_CONSONANTS 
} from '@/lib/constants';
import { getCluster, findValidWords } from '@/lib/gameLogic';
import { runBotTurn } from '@/lib/botLogic';

interface BoardProps {
  mode: 'SOLO' | 'MULTI';
  onBack: () => void;
}

export default function Board({ mode, onBack }: BoardProps) {
  // --- STATE ---
  const [grid, setGrid] = useState<(string | null)[][]>(Array(31).fill(null).map(() => Array(15).fill(null)));
  const [p1Rack, setP1Rack] = useState<string[]>([]);
  const [botRack, setBotRack] = useState<string[]>([]);
  const [tileBag, setTileBag] = useState<string[]>([]);
  const [turnCount, setTurnCount] = useState(0);
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [scores, setScores] = useState({ p1: 0, p2: 0 });
  const [blankTiles, setBlankTiles] = useState<Set<string>>(new Set());
  const [turnHistory, setTurnHistory] = useState<{ r: number, c: number, char: string, isBlank: boolean }[]>([]);

  // UI States
  const [selectedRackIndex, setSelectedRackIndex] = useState<number | null>(null);
  const [showBotRack, setShowBotRack] = useState(false);
  const [blankMenu, setBlankMenu] = useState<{ r: number, c: number } | null>(null);
  const [diacriticMenu, setDiacriticMenu] = useState<{ r: number, c: number } | null>(null);

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

  // --- BOT EXECUTION LOGIC (FIXED: No Infinite Loop) ---
  useEffect(() => {
    // ล็อคให้ทำงานเฉพาะเมื่อเป็นเทิร์นบอท และ Turn Count เปลี่ยนเท่านั้น
    if (mode === 'SOLO' && currentPlayer === 2) {
      const handleBot = async () => {
        try {
          // 1. เรียกใช้บอทหาคำ (เช็คพจนานุกรมในตัว botLogic)
          const result = await runBotTurn(grid, botRack, async (word) => {
            const res = await fetch('/api/check-word', { method: 'POST', body: JSON.stringify({ word }) });
            const data = await res.json();
            return data.valid;
          });

          if (result && result.placements.length > 0) {
            // 2. จำลองการวางเบี้ยเพื่อหาพิกัดคำที่จะ "เก็บไว้"
            const tempGrid = grid.map(row => [...row]);
            result.placements.forEach(p => { tempGrid[p.r][p.c] = p.char; });

            // สแกนหาคำที่สมบูรณ์ (เช่น "กบ") เพื่อเอาพิกัดมาทำ Cleanup
            const botWordsInfo = findValidWords(tempGrid, result.placements);
            let botValidCoords = new Set<string>();
            let botTurnScore = 0;

            botWordsInfo.forEach(info => {
              botTurnScore += info.word.split('').reduce((s, c) => s + (LETTER_SCORES[c] || 0), 0);
              info.coords.forEach(coord => botValidCoords.add(coord));
            });

            // 3. --- SURGICAL CLEANUP ---
            // สร้างกระดานใหม่ที่เก็บเฉพาะตัวอักษรในคำที่บอททำได้ (คำเก่าที่เหลือจะหายไป)
            const cleanedGrid = Array(31).fill(null).map(() => Array(15).fill(null));
            botValidCoords.forEach(coord => {
              const [r, c] = coord.split(',').map(Number);
              cleanedGrid[r][c] = tempGrid[r][c];
            });

            // 4. อัปเดต State ทุกอย่างพร้อมกัน (ลดจำนวนการ Render)
            setGrid(cleanedGrid);
            setScores(prev => ({ ...prev, p2: prev.p2 + botTurnScore }));
            
            // จั่วเบี้ยใหม่ให้บอท
            const newBotRack = [...botRack];
            result.placements.forEach(p => {
              const idx = newBotRack.indexOf(p.char);
              if (idx > -1) newBotRack.splice(idx, 1);
            });
            setBotRack([...newBotRack, ...tileBag.splice(0, result.placements.length)]);
            
            alert(`บอทลงคำว่า: ${result.word} ได้ ${botTurnScore} คะแนน`);
          } else {
            alert("บอทไม่มีคำที่จะลงได้ในตานี้... บอทขอผ่าน");
          }
        } catch (err) {
          console.error("Bot Error:", err);
        } finally {
          // เปลี่ยนกลับเป็น Player 1 และเพิ่ม Turn Count เพื่อจบกระบวนการ
          setCurrentPlayer(1);
          setTurnCount(prev => prev + 1);
        }
      };

      const timer = setTimeout(handleBot, 1500); // หน่วงเวลาให้ดูเหมือนบอทคิด
      return () => clearTimeout(timer);
    }
  }, [currentPlayer, mode]); // ตัด grid ออกจาก dependencies เพื่อไม่ให้เกิด loop

  // --- ACTIONS ---
  const handleCellClick = (r: number, c: number) => {
    if (currentPlayer !== 1) return; // ล็อคไม่ให้วางถ้าเป็นตาบอท

    const isMain = r % 2 !== 0;
    if (isMain) {
      if (selectedRackIndex !== null && !grid[r][c]) {
        const char = p1Rack[selectedRackIndex];
        if (char === '0') {
          setBlankMenu({ r, c });
        } else {
          placeTile(r, c, char, false);
        }
        setP1Rack(p1Rack.filter((_, i) => i !== selectedRackIndex));
        setSelectedRackIndex(null);
      }
    } else {
      setDiacriticMenu({ r, c });
    }
  };

  const placeTile = (r: number, c: number, char: string, isBlank: boolean) => {
    const nextGrid = [...grid];
    nextGrid[r][c] = char;
    setGrid(nextGrid);
    setTurnHistory([...turnHistory, { r, c, char, isBlank }]);
    if (isBlank) setBlankTiles(new Set(blankTiles).add(`${r},${c}`));
  };

  const handleRecall = () => {
    const nextRack = [...p1Rack];
    const nextGrid = [...grid];
    const nextBlanks = new Set(blankTiles);
    turnHistory.forEach(h => {
      if (!FREE_DIACRITICS.includes(h.char)) nextRack.push(h.isBlank ? '0' : h.char);
      nextGrid[h.r][h.c] = null;
      nextBlanks.delete(`${h.r},${h.c}`);
    });
    setGrid(nextGrid); setP1Rack(nextRack); setTurnHistory([]); setBlankTiles(nextBlanks);
  };

  const handleSubmit = async () => {
  if (turnHistory.length === 0) return;

  // 1. ตรวจสอบกติกาพื้นฐาน (ดาวกึ่งกลาง)
  const touchesStar = turnHistory.some(h => h.r === 15 && h.c === 7);
  if (turnCount === 0 && !touchesStar) {
    return alert("ตาแรกต้องวางทับจุดดาวกึ่งกลางกระดาน!");
  }

  // 2. สแกนหาคำทั้งหมด
  const wordsInfo = findValidWords(grid, turnHistory);
  if (wordsInfo.length === 0) return alert("การวางเบี้ยไม่ทำให้เกิดคำที่ถูกต้อง!");

  try {
    let turnTotal = 0; 
    let validCoords = new Set<string>(); 
    let words = [];
    let hasInvalidWord = false;

    // 3. ตรวจสอบกับ API คลังคำศัพท์
    for (const info of wordsInfo) {
      const res = await fetch('/api/check-word', { 
        method: 'POST', 
        body: JSON.stringify({ word: info.word }) 
      });
      const data = await res.json();
      
      if (data.valid) {
        turnTotal += info.word.split('').reduce((s, c) => s + (LETTER_SCORES[c] || 0), 0);
        info.coords.forEach(coord => validCoords.add(coord));
        words.push(info.word);
      } else { 
        alert(`คำว่า "${info.word}" ไม่มีในพจนานุกรม!`);
        hasInvalidWord = true;
        break; // ถ้ามีแม้แต่คำเดียวที่ผิด ให้หยุดตรวจและไม่ให้ผ่าน
      }
    }

    // 4. ถ้าทุกคำถูกต้อง ถึงจะทำการอัปเดตกระดานและ Cleanup
    if (!hasInvalidWord && words.length > 0) {
      const finalGrid = Array(31).fill(null).map(() => Array(15).fill(null));
      const finalBlanks = new Set<string>();
      
      validCoords.forEach(coord => {
        const [r, c] = coord.split(',').map(Number);
        if (grid[r][c]) {
          finalGrid[r][c] = grid[r][c];
          if (blankTiles.has(coord)) finalBlanks.add(coord);
        }
      });

      // อัปเดต State จริง
      setGrid(finalGrid); 
      setBlankTiles(finalBlanks);
      setScores(prev => ({ ...prev, p1: prev.p1 + turnTotal }));
      setP1Rack([...p1Rack, ...tileBag.splice(0, 9 - p1Rack.length)]);
      setTurnHistory([]); 
      setTurnCount(prev => prev + 1);
      
      alert(`สำเร็จ! คำที่ได้: ${words.join(', ')} (+${turnTotal} คะแนน)`);
      setCurrentPlayer(mode === 'SOLO' ? 2 : 1);
    }
    // หมายเหตุ: ถ้า hasInvalidWord เป็น true ระบบจะไม่ทำอะไร 
    // เบี้ยจะยังค้างอยู่ที่เดิมให้ผู้เล่นกด Recall หรือขยับใหม่ได้เองครับ
  } catch (e) { 
    alert("ระบบเชื่อมต่อพจนานุกรมขัดข้อง"); 
  }
};

  return (
    <div className="flex flex-col items-center gap-4 p-4 bg-slate-100 min-h-screen font-sans">
      {/* HEADER */}
      <div className="bg-white p-4 rounded-2xl shadow-md w-full max-w-xl flex justify-between items-center border-b-4 border-indigo-500">
        <button onClick={onBack} className="text-slate-400 font-bold hover:text-red-500 transition-colors">← MENU</button>
        <div className="text-center font-black">
          <p className={`text-[10px] tracking-widest uppercase ${currentPlayer === 1 ? 'text-indigo-500' : 'text-rose-500'}`}>
            {currentPlayer === 1 ? "YOUR TURN" : (mode === 'SOLO' ? "BOT THINKING..." : "PLAYER 2 TURN")}
          </p>
          <div className="flex gap-4 text-xl text-slate-800">
            <span>P1: {scores.p1}</span>
            <span>{mode === 'SOLO' ? 'BOT' : 'P2'}: {scores.p2}</span>
          </div>
        </div>
        <button onClick={() => setShowBotRack(!showBotRack)} className="text-[10px] bg-slate-100 px-3 py-1.5 rounded-lg font-bold text-slate-500 hover:bg-slate-200">
          {showBotRack ? "HIDE BOT" : "SHOW BOT"}
        </button>
      </div>

      {/* GRID */}
      <div className={`bg-slate-900 p-1.5 rounded-xl shadow-2xl border-4 border-slate-700 transition-all ${currentPlayer === 2 ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="grid grid-cols-15 gap-0.5 sm:gap-1">
          {grid.map((row, r) => row.map((cell, c) => {
            const isMain = r % 2 !== 0;
            const isBlank = blankTiles.has(`${r},${c}`);
            return (
              <div key={`${r}-${c}`} onClick={() => handleCellClick(r, c)}
                className={`flex items-center justify-center cursor-pointer border border-black/10 transition-all
                ${isMain ? 'w-8 h-8 sm:w-11 sm:h-11 text-xl font-bold' : 'w-8 h-4 sm:w-11 sm:h-5 text-xs'}
                ${cell ? (isBlank ? 'bg-cyan-100 text-blue-800 border-2 border-blue-400' : 'bg-amber-100 text-black border-b-2 border-amber-300 shadow-sm') : 
                  isMain ? getCellColor(Math.floor(r/2), c) : 'bg-indigo-600/40 hover:bg-indigo-400'}`}>
                {cell || (isMain ? getCellText(Math.floor(r/2), c) : '')}
              </div>
            );
          }))}
        </div>
      </div>

      {/* BOT HAND DISPLAY */}
      {showBotRack && (
        <div className="flex gap-1 p-3 bg-rose-50 rounded-2xl border border-rose-200 animate-fade-in shadow-inner">
          <span className="text-[10px] font-black text-rose-400 mr-2 self-center italic uppercase">Bot Hand:</span>
          {botRack.map((t, i) => <div key={i} className="w-8 h-8 bg-white/50 border border-rose-100 rounded-lg flex items-center justify-center text-xs text-rose-300 font-bold">{t === '0' ? ' ' : t}</div>)}
        </div>
      )}

      {/* PLAYER CONTROLS */}
      <div className={`bg-white p-6 rounded-3xl shadow-xl w-full max-w-xl border-2 transition-all ${currentPlayer === 2 ? 'grayscale opacity-50' : 'border-slate-200'}`}>
        <div className="flex justify-center gap-2 mb-6">
          {p1Rack.map((tile, i) => (
            <button key={i} onClick={() => setSelectedRackIndex(i)}
              className={`w-10 h-10 sm:w-14 sm:h-14 bg-amber-50 border-b-4 border-amber-300 rounded-xl flex items-center justify-center text-2xl font-black text-slate-800 shadow-md transition-all
                ${selectedRackIndex === i ? 'ring-4 ring-blue-500 -translate-y-2 bg-blue-50' : 'hover:-translate-y-1'}`}>
              {tile === '0' ? ' ' : tile}
            </button>
          ))}
        </div>
        <div className="flex gap-4">
          <button onClick={handleRecall} className="flex-1 py-4 bg-slate-100 text-slate-500 font-bold rounded-2xl border-b-4 border-slate-300 active:border-b-0 uppercase tracking-widest text-xs">Recall</button>
          <button onClick={handleSubmit} className="flex-1 py-4 bg-emerald-600 text-white font-bold rounded-2xl border-b-4 border-emerald-800 active:border-b-0 shadow-lg uppercase tracking-widest text-xs">Submit</button>
        </div>
      </div>

      {/* MODALS */}
      {(blankMenu || diacriticMenu) && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => {setBlankMenu(null); setDiacriticMenu(null);}}>
          <div className="bg-white p-8 rounded-3xl max-w-md w-full shadow-2xl border-t-8 border-indigo-600" onClick={e => e.stopPropagation()}>
            <h3 className="text-2xl font-black text-slate-800 mb-6 text-center">{blankMenu ? "เลือกตัวอักษรฟรี" : "เลือกสระ/วรรณยุกต์"}</h3>
            <div className="grid grid-cols-5 gap-3 max-h-[45vh] overflow-y-auto pr-2">
              {(blankMenu ? THAI_CONSONANTS : FREE_DIACRITICS).map(char => (
                <button key={char} onClick={() => {
                  const t = blankMenu || diacriticMenu!;
                  placeTile(t.r, t.c, char, !!blankMenu);
                  setBlankMenu(null); setDiacriticMenu(null);
                }} className="w-12 h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xl font-bold hover:bg-indigo-600 hover:text-white hover:scale-110 transition-all shadow-sm">
                  {char}
                </button>
              ))}
            </div>
            <button onClick={() => {setBlankMenu(null); setDiacriticMenu(null);}} className="mt-8 w-full py-2 text-slate-400 font-bold hover:text-red-500 transition-colors uppercase text-xs">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- HELPERS ---
const getCellColor = (r: number, c: number) => {
  const type = BOARD_LAYOUT[r]?.[c];
  switch (type) {
    case '3W': return 'bg-rose-500/80 text-white text-[10px] font-bold';
    case '2W': return 'bg-pink-400/80 text-white text-[10px] font-bold';
    case '4L': return 'bg-orange-500/80 text-white text-[10px] font-bold';
    case '3L': return 'bg-emerald-600/80 text-white text-[10px] font-bold';
    case '2L': return 'bg-sky-400/80 text-white text-[10px] font-bold';
    case 'STAR': return 'bg-pink-500 text-white shadow-inner animate-pulse';
    default: return 'bg-slate-800/20';
  }
};

const getCellText = (r: number, c: number) => {
  const type = BOARD_LAYOUT[r]?.[c];
  return type === 'STAR' ? '★' : type || '';
};