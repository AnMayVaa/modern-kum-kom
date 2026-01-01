// src/hooks/useGameActions.ts
import { useState, useEffect } from 'react';
import { INITIAL_LETTER_QUANTITIES, LETTER_SCORES } from '@/lib/constants';

export type TurnHistoryItem = {
  r: number;
  c: number;
  char: string;
  isBlank: boolean;
  originalChar: string | null; 
  originalRackChar?: string | null;
};

export type MenuState = { 
  r: number; 
  c: number; 
  originalChar?: string | null; 
  dualOptions?: string[];
} | null;

/**
 * Hook สำหรับจัดการ State และ Action ของเกม
 * @param initialData ข้อมูลจาก Lobby (ถุงเบี้ย, เบี้ยเริ่มต้น, ใครเริ่มก่อน)
 */
export const useGameActions = (mode: string, roomInfo: any, playerRole: number, initialData?: any) => {
  // --- 1. GAME STATES ---
  const [grid, setGrid] = useState<(string | null)[][]>(Array(31).fill(null).map(() => Array(15).fill(null)));
  const [p1Rack, setP1Rack] = useState<string[]>([]);
  const [botRack, setBotRack] = useState<string[]>([]);
  const [tileBag, setTileBag] = useState<string[]>([]);
  const [turnCount, setTurnCount] = useState(0);
  const [currentPlayer, setCurrentPlayer] = useState(roomInfo?.starter || 1);
  const [scores, setScores] = useState({ p1: 0, p2: 0 });
  const [blankTiles, setBlankTiles] = useState<Set<string>>(new Set());
  const [turnHistory, setTurnHistory] = useState<TurnHistoryItem[]>([]);
  
  // สถานะสำหรับการดักข้อมูลแชร์ และกติกาจบเกม
  const [p2InitialRack, setP2InitialRack] = useState<string[]>([]); 
  const [skipCount, setSkipCount] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);

  // UI States
  const [selectedRackIndex, setSelectedRackIndex] = useState<number | null>(null);
  const [blankMenu, setBlankMenu] = useState<MenuState>(null);
  const [diacriticMenu, setDiacriticMenu] = useState<MenuState>(null);

  // --- 2. INITIALIZATION (ระบบดักข้อมูล Shared Data) ---
  useEffect(() => {
    // กรณีที่ 1: ได้รับข้อมูล Shared Bag มาจากหน้า Lobby (Multiplayer)
    if (mode === 'MULTI' && initialData) {
      console.log("🎮 Initializing with SHARED DATA from Lobby");
      setTileBag(initialData.tileBag);
      // P1 และ P2 จะได้เบี้ยคนละชุดที่ถูกสุ่มไว้แล้วตั้งแต่ต้น
      setP1Rack(playerRole === 1 ? initialData.p1Rack : initialData.p2Rack);
      setCurrentPlayer(initialData.starter);
    } 
    // กรณีที่ 2: เริ่มเกมใหม่ (SOLO หรือ MULTI ที่เป็น Host เริ่มครั้งแรก)
    else if (mode === 'SOLO' || (mode === 'MULTI' && playerRole === 1 && tileBag.length === 0)) {
      console.log("🎲 Initializing NEW GAME locally");
      const bag: string[] = [];
      Object.entries(INITIAL_LETTER_QUANTITIES).forEach(([char, qty]) => {
        for (let i = 0; i < qty; i++) bag.push(char);
      });
      const shuffled = bag.sort(() => Math.random() - 0.5);
      
      const p1Init = shuffled.splice(0, 9);
      if (mode === 'SOLO') {
        setBotRack(shuffled.splice(0, 9));
      } else {
        // เก็บเบี้ยชุดที่สองไว้ใน p2InitialRack เพื่อส่งไปให้เพื่อนผ่าน Lobby
        setP2InitialRack(shuffled.splice(0, 9));
      }
      setP1Rack(p1Init);
      setTileBag(shuffled);
    }
  }, [mode, initialData, playerRole]);

  // --- 3. HELPER FUNCTIONS ---
  const calculateRackScore = (rack: string[]) => {
    return rack.reduce((sum, char) => sum + (LETTER_SCORES[char] || 0), 0);
  };

  // --- 4. CORE ACTIONS ---
  const placeTile = (r: number, c: number, char: string, isBlank: boolean, original: string | null = null, rackChar: string | null = null) => {
    setGrid(prev => {
      const next = [...prev.map(row => [...row])];
      next[r][c] = char;
      return next;
    });
    setTurnHistory(prev => [...prev, { 
      r, c, char, isBlank, 
      originalChar: original, 
      originalRackChar: rackChar // ✅ บันทึกร่างเดิมไว้
    }]);
  };

  const handleRackSelect = (index: number) => {
    if (selectedRackIndex === null) setSelectedRackIndex(index);
    else if (selectedRackIndex === index) setSelectedRackIndex(null);
    else {
      const newRack = [...p1Rack];
      [newRack[selectedRackIndex], newRack[index]] = [newRack[index], newRack[selectedRackIndex]];
      setP1Rack(newRack);
      setSelectedRackIndex(null);
    }
  };

  const handleShuffle = () => {
    setP1Rack(prev => [...prev].sort(() => Math.random() - 0.5));
    setSelectedRackIndex(null);
  };

  const handleRecall = () => {
    const nextRack = [...p1Rack];
    const nextGrid = [...grid.map(row => [...row])];

    turnHistory.forEach((h: TurnHistoryItem) => {
      if (h.r % 2 !== 0) {
        // 💡 ถ้ามีร่างเดิม (เช่น 'ฆ/ซ') ให้คืนร่างนั้น ถ้าไม่มีคืนตามปกติ
        const tileToReturn = h.originalRackChar || (h.isBlank ? '0' : h.char);
        nextRack.push(tileToReturn);
      }
      nextGrid[h.r][h.c] = h.originalChar; 
    });

    setGrid(nextGrid);
    setP1Rack(nextRack);
    setTurnHistory([]);
    setSelectedRackIndex(null);
  };

  const handleCloseModals = () => {
    // 💡 ถ้าปิดเมนูโดยไม่เลือก ให้คืนเบี้ยเข้ามือให้ถูกตัว
    if (blankMenu) {
      setP1Rack(prev => [...prev, '0']);
    } else if (diacriticMenu?.dualOptions) {
      // คืนเบี้ยทางเลือกกลับเป็น 'ฆ/ซ'
      const originalDual = diacriticMenu.dualOptions.join('/');
      setP1Rack(prev => [...prev, originalDual]);
    }
    setBlankMenu(null); 
    setDiacriticMenu(null);
  };

  return {
    grid, setGrid, 
    p1Rack, setP1Rack, 
    botRack, setBotRack, 
    tileBag, setTileBag,
    scores, setScores, 
    turnCount, setTurnCount, 
    currentPlayer, setCurrentPlayer,
    blankTiles, setBlankTiles, 
    turnHistory, setTurnHistory,
    p2InitialRack,
    skipCount, setSkipCount,
    isGameOver, setIsGameOver,
    selectedRackIndex, setSelectedRackIndex, 
    blankMenu, setBlankMenu, 
    diacriticMenu, setDiacriticMenu,
    placeTile, handleRackSelect, handleShuffle, handleRecall, handleCloseModals, calculateRackScore
  };
};