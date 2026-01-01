// src/hooks/useGameActions.ts
import { useState, useEffect } from 'react';
import { INITIAL_LETTER_QUANTITIES, LETTER_SCORES } from '@/lib/constants';
import { findValidWords, calculateBingoBonus } from '@/lib/gameLogic';

export type TurnHistoryItem = {
  r: number;
  c: number;
  char: string;
  isBlank: boolean;
  originalChar: string | null; 
};

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
  
  // 💡 แก้ไขจุดนี้: กำหนด Type ให้ useState ตรงกับ TurnHistoryItem
  const [turnHistory, setTurnHistory] = useState<TurnHistoryItem[]>([]);
  
  const [selectedRackIndex, setSelectedRackIndex] = useState<number | null>(null);
  const [blankMenu, setBlankMenu] = useState<{ r: number, c: number, originalChar?: string | null } | null>(null);
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
  const placeTile = (r: number, c: number, char: string, isBlank: boolean, original: string | null = null) => {
    setGrid(prev => {
      const next = [...prev.map(row => [...row])];
      next[r][c] = char;
      return next;
    });
    // บันทึกประวัติโดยใช้โครงสร้างที่ถูกต้อง
    setTurnHistory(prev => [...prev, { r, c, char, isBlank, originalChar: original }]);
  };

  const handleRackSelect = (index: number) => {
    if (selectedRackIndex === null) setSelectedRackIndex(index);
    else if (selectedRackIndex === index) setSelectedRackIndex(null);
    else {
      const newRack = [...p1Rack];
      const temp = newRack[selectedRackIndex];
      newRack[selectedRackIndex] = newRack[index];
      newRack[index] = temp;
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
        nextRack.push(h.isBlank ? '0' : h.char);
      }
      // คืนค่าเดิมกลับสู่กระดาน (ถ้าทับมาจะได้ตัวเดิม ถ้าวางช่องว่างจะได้ null)
      nextGrid[h.r][h.c] = h.originalChar; 
    });

    setGrid(nextGrid);
    setP1Rack(nextRack);
    setTurnHistory([]);
  };

  const handleCloseModals = () => {
    if (blankMenu) setP1Rack(prev => [...prev, '0']);
    setBlankMenu(null); 
    setDiacriticMenu(null);
  };

  return {
    grid, setGrid, p1Rack, setP1Rack, botRack, setBotRack, tileBag, setTileBag,
    scores, setScores, turnCount, setTurnCount, currentPlayer, setCurrentPlayer,
    blankTiles, setBlankTiles, turnHistory, setTurnHistory,
    selectedRackIndex, setSelectedRackIndex, blankMenu, setBlankMenu, diacriticMenu, setDiacriticMenu,
    placeTile, handleRackSelect, handleShuffle, handleRecall, handleCloseModals
  };
};