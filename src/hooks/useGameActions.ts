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

  const handleCloseModals = () => {
    if (blankMenu) setP1Rack(prev => [...prev, '0']); // Refund เบี้ยว่าง
    setBlankMenu(null); setDiacriticMenu(null);
  };

  return {
    grid, setGrid, p1Rack, setP1Rack, botRack, setBotRack, tileBag, setTileBag,
    scores, setScores, turnCount, setTurnCount, currentPlayer, setCurrentPlayer,
    blankTiles, setBlankTiles, turnHistory, setTurnHistory,
    selectedRackIndex, setSelectedRackIndex, blankMenu, setBlankMenu, diacriticMenu, setDiacriticMenu,
    placeTile, handleRackSelect, handleShuffle, handleRecall, handleCloseModals
  };
};