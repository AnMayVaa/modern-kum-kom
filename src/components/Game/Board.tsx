'use client';
import React, { useState, useEffect } from 'react';
import { BOARD_LAYOUT, LETTER_SCORES, INITIAL_LETTER_QUANTITIES, FREE_DIACRITICS, THAI_CONSONANTS } from '@/lib/constants';

export default function Board() {
  const [grid, setGrid] = useState<(string | null)[][]>(Array(30).fill(null).map(() => Array(15).fill(null)));
  const [blankTiles, setBlankTiles] = useState<Set<string>>(new Set()); 
  const [rack, setRack] = useState<string[]>([]);
  const [tileBag, setTileBag] = useState<string[]>([]);
  const [selectedRackIndex, setSelectedRackIndex] = useState<number | null>(null);
  const [turnHistory, setTurnHistory] = useState<{r: number, c: number, char: string, isBlank: boolean}[]>([]);
  const [blankMenu, setBlankMenu] = useState<{r: number, c: number} | null>(null);
  const [diacriticMenu, setDiacriticMenu] = useState<{r: number, c: number} | null>(null);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const bag: string[] = [];
    Object.entries(INITIAL_LETTER_QUANTITIES).forEach(([char, qty]) => {
      for (let i = 0; i < qty; i++) bag.push(char);
    });
    const shuffled = bag.sort(() => Math.random() - 0.5);
    setRack(shuffled.splice(0, 9));
    setTileBag(shuffled);
  }, []);

  const handleCellClick = (r: number, c: number, isMain: boolean) => {
    if (isMain) {
      if (selectedRackIndex !== null && !grid[r][c]) {
        const char = rack[selectedRackIndex];
        if (char === '0') setBlankMenu({ r, c });
        else placeTile(r, c, char, false);
        setRack(rack.filter((_, i) => i !== selectedRackIndex));
        setSelectedRackIndex(null);
      }
    } else setDiacriticMenu({ r, c });
  };

  const placeTile = (r: number, c: number, char: string, isBlank: boolean) => {
    const newGrid = [...grid];
    newGrid[r][c] = char;
    setGrid(newGrid);
    setTurnHistory([...turnHistory, { r, c, char, isBlank }]);
    if (isBlank) setBlankTiles(new Set(blankTiles).add(`${r},${c}`));
  };

  const handleRecall = () => {
    const newRack = [...rack];
    const newGrid = [...grid];
    const newBlanks = new Set(blankTiles);
    turnHistory.forEach(item => {
      if (!FREE_DIACRITICS.includes(item.char)) newRack.push(item.isBlank ? '0' : item.char);
      newGrid[item.r][item.c] = null;
      newBlanks.delete(`${item.r},${item.c}`);
    });
    setGrid(newGrid); setRack(newRack); setTurnHistory([]); setBlankTiles(newBlanks);
  };

  // --- LOGIC ค้นหาคำพร้อมพิกัด (เพื่อทำ Dynamic Cleanup) ---
  const findWordsWithCoords = () => {
    if (turnHistory.length === 0) return [];
    const wordsMap = new Map<string, { word: string, coords: Set<string> }>();

    turnHistory.forEach(tile => {
      // 1. ตรวจสอบแนวนอน
      let hWord = ""; let r = tile.r; let startC = tile.c;
      while (startC > 0 && grid[r][startC - 1]) startC--;
      let hCoords = new Set<string>();
      let currC = startC;
      while (currC < 15 && grid[r][currC]) {
        hWord += grid[r][currC] + (grid[r-1][currC] || "") + (grid[r+1][currC] || "");
        hCoords.add(`${r},${currC}`);
        if (grid[r-1][currC]) hCoords.add(`${r-1},${currC}`);
        if (grid[r+1][currC]) hCoords.add(`${r+1},${currC}`);
        currC++;
      }
      if (hWord.length > 1) wordsMap.set(`h-${r}-${startC}`, { word: hWord, coords: hCoords });

      // 2. ตรวจสอบแนวตั้ง
      let vWord = ""; let c = tile.c; let startR = tile.r;
      while (startR > 1 && grid[startR - 2][c]) startR -= 2;
      let vCoords = new Set<string>();
      let currR = startR;
      while (currR < 30 && grid[currR][c]) {
        vWord += grid[currR][c] + (grid[currR-1][c] || "") + (grid[currR+1][c] || "");
        vCoords.add(`${currR},${c}`);
        if (grid[currR-1][c]) vCoords.add(`${currR-1},${c}`);
        if (grid[currR+1][c]) vCoords.add(`${currR+1},${c}`);
        currR += 2;
      }
      if (vWord.length > 1) wordsMap.set(`v-${startR}-${c}`, { word: vWord, coords: vCoords });
    });
    return Array.from(wordsMap.values());
  };

  const handleSubmit = async () => {
    const wordsInfo = findWordsWithCoords();
    if (wordsInfo.length === 0) return;

    try {
      let turnTotalScore = 0;
      let allValidCoords = new Set<string>();
      let allValid = true;
      let validatedWords: string[] = [];

      for (const info of wordsInfo) {
        const res = await fetch('/api/check-word', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ word: info.word }),
        });
        const data = await res.json();
        if (data.valid) {
          turnTotalScore += info.word.split('').reduce((sum, c) => sum + (LETTER_SCORES[c] || 0), 0);
          info.coords.forEach(coord => allValidCoords.add(coord));
          validatedWords.push(info.word);
        } else {
          allValid = false;
          alert(`คำว่า "${info.word}" ไม่มีในพจนานุกรม!`);
          break;
        }
      }

      if (allValid) {
        // --- DYNAMIC CLEANUP: ลบตัวอักษรที่ไม่เกี่ยวข้องออก ---
        const newGrid = Array(30).fill(null).map(() => Array(15).fill(null));
        const newBlanks = new Set<string>();
        allValidCoords.forEach(coord => {
          const [r, c] = coord.split(',').map(Number);
          newGrid[r][c] = grid[r][c];
          if (blankTiles.has(coord)) newBlanks.add(coord);
        });

        setGrid(newGrid);
        setBlankTiles(newBlanks);
        setScore(prev => prev + turnTotalScore);
        const needed = 9 - rack.length;
        const newBag = [...tileBag];
        setRack([...rack, ...newBag.splice(0, needed)]);
        setTileBag(newBag);
        setTurnHistory([]);
        alert(`สำเร็จ! สร้างคำสำเร็จ: ${validatedWords.join(', ')} ได้รับทั้งหมด ${turnTotalScore} คะแนน`);
      }
    } catch (e) { alert("API Error"); }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4 bg-slate-50 min-h-screen">
      <div className="bg-white p-4 rounded-xl shadow-md w-full max-w-xl flex justify-between font-black border-b-4 border-indigo-500">
        <span className="text-2xl text-slate-800">SCORE: {score}</span>
        <span className="text-lg text-slate-400">BAG: {tileBag.length}</span>
      </div>

      <div className="bg-slate-900 p-1.5 rounded-xl shadow-2xl border-4 border-slate-700">
        <div className="grid grid-cols-15 gap-0.5">
          {grid.map((row, r) => row.map((cell, c) => {
            const isMain = r % 2 !== 0;
            const isBlank = blankTiles.has(`${r},${c}`);
            return (
              <div key={`${r}-${c}`} onClick={() => handleCellClick(r, c, isMain)}
                className={`flex items-center justify-center cursor-pointer border border-black/10 transition-all
                ${isMain ? 'w-8 h-8 sm:w-11 sm:h-11 text-xl font-bold' : 'w-8 h-4 sm:w-11 sm:h-5 text-xs'}
                ${cell ? (isBlank ? 'bg-cyan-100 text-blue-700 border-2 border-blue-400' : 'bg-amber-100 text-black border-b-2 border-amber-300 shadow-sm') : 
                  isMain ? getCellColor(Math.floor(r/2), c) : 'bg-indigo-600 hover:bg-indigo-400'}`}>
                {cell || (isMain ? getCellText(Math.floor(r/2), c) : '')}
              </div>
            );
          }))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-xl w-full max-w-xl border border-slate-200">
        <div className="flex justify-center gap-2 mb-6">
          {rack.map((tile, i) => (
            <button key={i} onClick={() => setSelectedRackIndex(i)}
              className={`w-10 h-10 sm:w-14 sm:h-14 bg-amber-50 border-b-4 border-amber-200 rounded-xl flex items-center justify-center text-2xl font-black text-slate-800 shadow-md
                ${selectedRackIndex === i ? 'ring-4 ring-blue-500 -translate-y-2' : ''}`}>
              {tile === '0' ? ' ' : tile} {/* เปลี่ยน 空 เป็นช่องว่างตามคำขอ */}
            </button>
          ))}
        </div>
        <div className="flex gap-4">
          <button onClick={handleRecall} className="flex-1 py-4 bg-slate-100 text-slate-500 font-bold rounded-2xl hover:bg-slate-200 uppercase shadow-sm">Recall</button>
          <button onClick={handleSubmit} className="flex-1 py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-500 shadow-lg uppercase">Submit</button>
        </div>
      </div>

      {/* Modals สำหรับ Blank และ Diacritic เหมือนเดิมครับ */}
      {(blankMenu || diacriticMenu) && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-3xl max-w-md w-full shadow-2xl border-t-8 border-blue-600">
            <h3 className="text-2xl font-black text-slate-800 mb-6 text-center">{blankMenu ? "เลือกตัวอักษรฟรี" : "เลือกสระ/วรรณยุกต์"}</h3>
            <div className="grid grid-cols-5 gap-3 max-h-[50vh] overflow-y-auto">
              {(blankMenu ? THAI_CONSONANTS : FREE_DIACRITICS).map(char => (
                <button key={char} onClick={() => {
                  const t = blankMenu || diacriticMenu!;
                  placeTile(t.r, t.c, char, !!blankMenu);
                  setBlankMenu(null); setDiacriticMenu(null);
                }} className="w-12 h-12 bg-slate-50 border rounded-xl text-xl font-bold hover:bg-blue-600 hover:text-white transition-all shadow-sm">
                  {char}
                </button>
              ))}
            </div>
            <button onClick={() => {setBlankMenu(null); setDiacriticMenu(null);}} className="mt-8 w-full py-2 text-slate-400 font-bold">ยกเลิก</button>
          </div>
        </div>
      )}
    </div>
  );
}

const getCellColor = (r: number, c: number) => {
  const type = BOARD_LAYOUT[r]?.[c];
  switch (type) {
    case '3W': return 'bg-rose-500 text-white text-[10px]';
    case '2W': return 'bg-pink-400 text-white text-[10px]';
    case '4L': return 'bg-orange-500 text-white text-[10px]';
    case '3L': return 'bg-emerald-600 text-white text-[10px]';
    case '2L': return 'bg-sky-400 text-white text-[10px]';
    case 'STAR': return 'bg-pink-500 text-white';
    default: return 'bg-slate-800';
  }
};

const getCellText = (r: number, c: number) => {
  const type = BOARD_LAYOUT[r]?.[c];
  return type === 'STAR' ? '★' : type || '';
};