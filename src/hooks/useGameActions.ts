import { useState, useEffect } from 'react';
import { INITIAL_LETTER_QUANTITIES, LETTER_SCORES } from '@/lib/constants';
import { findValidWords, calculateBingoBonus } from '@/lib/gameLogic';

export const useGameActions = (mode: string, roomInfo: any, playerRole: number) => {
  // --- STATE MANAGEMENT ---
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

  // --- CORE ACTIONS ---
  const placeTile = (r: number, c: number, char: string, isBlank: boolean) => {
    const nextGrid = [...grid];
    nextGrid[r][c] = char;
    setGrid(nextGrid);
    setTurnHistory(prev => [...prev, { r, c, char, isBlank }]);
    if (isBlank) setBlankTiles(prev => new Set(prev).add(`${r},${c}`));
  };

  const handleRackSelect = (index: number) => {
    if (currentPlayer !== playerRole) return;
    if (selectedRackIndex === null) setSelectedRackIndex(index);
    else if (selectedRackIndex === index) setSelectedRackIndex(null);
    else {
      // Logic สลับเบี้ยในมือ (Swap)
      const newRack = [...p1Rack];
      const temp = newRack[selectedRackIndex];
      newRack[selectedRackIndex] = newRack[index];
      newRack[index] = temp;
      setP1Rack(newRack);
      setSelectedRackIndex(null);
    }
  };

  const handleShuffle = () => {
    if (currentPlayer !== playerRole) return;
    setP1Rack(prev => [...prev].sort(() => Math.random() - 0.5));
    setSelectedRackIndex(null);
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

  const handleExchange = async (confirmCall: (msg: string) => boolean) => {
    if (currentPlayer !== playerRole) return;
    const numToExchange = turnHistory.length;
    
    if (numToExchange > 0) {
        // 1. ถามยืนยันก่อนแลก
        if (!confirmCall(`ต้องการแลกเบี้ย ${numToExchange} ตัวที่วางอยู่ใช่หรือไม่?`)) return;
        
        // 2. ตรวจสอบว่าเบี้ยในถุงพอให้จั่วใหม่ไหม
        if (tileBag.length < numToExchange) {
        alert("เบี้ยในถุงมีไม่พอสำหรับแลกใบใหม่!");
        return;
        }

        // --- STEP สำคัญ: จั่วของใหม่ "ก่อน" คืนของเก่า ---
        
        // 3. หยิบเบี้ยใหม่จากด้านบนของถุงปัจจุบันมาเก็บไว้
        const drawnTiles = tileBag.slice(0, numToExchange);
        const remainingBag = tileBag.slice(numToExchange);

        // 4. นำเบี้ยเก่าที่วางอยู่บนบอร์ดมาเตรียมคืนถุง
        const tilesToReturn = turnHistory.map(h => h.isBlank ? '0' : h.char);

        // 5. เอาเบี้ยเก่าใส่รวมกับเบี้ยที่เหลือในถุง แล้วทำการสุ่ม (Shuffle) ใหม่
        const finalBag = [...remainingBag, ...tilesToReturn].sort(() => Math.random() - 0.5);

        // 6. ล้างเบี้ยที่ค้างอยู่บนกระดาน (Manual Clear)
        // หมายเหตุ: ห้ามใช้ handleRecall เพราะฟังก์ชันนั้นจะดีดเบี้ยเก่ากลับเข้ามือ
        const nextGrid = [...grid];
        const nextBlanks = new Set(blankTiles);
        turnHistory.forEach(h => {
        nextGrid[h.r][h.c] = null;
        nextBlanks.delete(`${h.r},${h.c}`);
        });

        // 7. อัปเดต State ทั้งหมด
        setGrid(nextGrid);
        setBlankTiles(nextBlanks);
        setP1Rack(prev => [...prev, ...drawnTiles]); // เพิ่มเบี้ยใหม่เข้ามือ
        setTileBag(finalBag); // ถุงใหม่ที่ผสมเบี้ยเก่าและสุ่มแล้ว
        setTurnHistory([]);
        
        alert(`แลกเบี้ยสำเร็จ! ได้รับใบใหม่ ${numToExchange} ใบจากถุงกลาง`);
    } 
    else {
        // กรณีไม่มีเบี้ยบนบอร์ด = Skip Turn
        if (!confirmCall("คุณยังไม่ได้วางเบี้ย ต้องการข้ามตานี้ใช่หรือไม่?")) return;
    }

    // 8. จบเทิร์นและสลับผู้เล่น
    setCurrentPlayer(mode === 'SOLO' ? 2 : (playerRole === 1 ? 2 : 1));
    setTurnCount(prev => prev + 1);
    };

  const handleCloseModals = () => {
    if (blankMenu) setP1Rack(prev => [...prev, '0']); // Refund เบี้ยว่าง
    setBlankMenu(null); setDiacriticMenu(null);
  };

  return {
    grid, setGrid, p1Rack, setP1Rack, botRack, setBotRack, tileBag, setTileBag,
    scores, setScores, turnCount, setTurnCount, currentPlayer, setCurrentPlayer,
    blankTiles, setBlankTiles, turnHistory, setTurnHistory,
    selectedRackIndex, setSelectedRackIndex, blankMenu, setBlankMenu, diacriticMenu, setDiacriticMenu,
    placeTile, handleRackSelect, handleShuffle, handleRecall, handleExchange, handleCloseModals
  };
};