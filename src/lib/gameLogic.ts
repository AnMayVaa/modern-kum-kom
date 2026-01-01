// src/lib/gameLogic.ts
import { LETTER_SCORES, BOARD_LAYOUT } from './constants';

export interface ScoreDetail {
  word: string;
  baseScore: number;
  multiplierInfo: string;
  wordMultiplier: number;
  finalWordScore: number;
}

export const calculateScoreWithDetails = (
  grid: (string | null)[][],
  wordsInfo: { word: string; coords: string[] }[],
  turnHistory: { r: number; c: number; char: string; isBlank: boolean }[],
  blankTiles: Set<string>
) => {
  let totalTurnScore = 0;
  const details: ScoreDetail[] = [];
  const turnCoords = new Set(turnHistory.map(h => `${h.r},${h.c}`));

  wordsInfo.forEach(info => {
    let wordPoints = 0;
    let wordMult = 1;
    let letterMultiplierText = "";

    info.coords.forEach(coordStr => {
      const [r, c] = coordStr.split(',').map(Number);
      const char = grid[r][c] || "";
      
      // คะแนนพื้นฐาน (ถ้าเป็น Blank '0' คะแนนจะเป็น 0)
      let letterVal = blankTiles.has(coordStr) ? 0 : (LETTER_SCORES[char] || 0);
      
      // ตรวจสอบตัวคูณบนกระดาน (เฉพาะเบี้ยที่วางใหม่ในตานี้เท่านั้น)
      if (turnCoords.has(coordStr)) {
        const layoutRow = (r - 1) / 2; // แปลง Row จาก 31 เป็น 15
        const multiplier = BOARD_LAYOUT[layoutRow][c];

        if (multiplier === '2L') letterVal *= 2;
        else if (multiplier === '3L') letterVal *= 3;
        else if (multiplier === '4L') letterVal *= 4;
        else if (multiplier === '2W' || multiplier === 'STAR') wordMult *= 2;
        else if (multiplier === '3W') wordMult *= 3;
      }
      
      wordPoints += letterVal;
    });

    const finalWordScore = wordPoints * wordMult;
    totalTurnScore += finalWordScore;

    details.push({
      word: info.word,
      baseScore: wordPoints,
      multiplierInfo: wordMult > 1 ? `x${wordMult} Word Bonus` : "No Word Mult",
      wordMultiplier: wordMult,
      finalWordScore: finalWordScore
    });
  });

  return { totalTurnScore, details };
};

// ฟังก์ชันช่วยในการรวมสระ/วรรณยุกต์ (แถวคู่) เข้ากับพยัญชนะ (แถวคี่)
const getCluster = (grid: (string | null)[][], r: number, c: number) => {
  const char = grid[r][c];
  if (!char) return "";

  let cluster = "";
  
  // 1. สระบน/วรรณยุกต์ (r-1): ต้องอยู่หน้าพยัญชนะเพื่อให้โปรแกรมอ่านพยัญชนะก่อน (หรือตามกติกาภาษาไทย)
  const above = grid[r - 1]?.[c];
  if (above && /[ิีึืั่้๊๋็์ํ]/.test(above)) {
    // ในภาษาไทย สระบนจะเก็บไว้ทีหลังพยัญชนะเสมอ เช่น 'ย' + '่'
    cluster = char + above; 
  } else {
    cluster = char;
  }

  // 2. สระล่าง (r+1)
  const below = grid[r + 1]?.[c];
  if (below && /[ุู]/.test(below)) {
    cluster += below;
  }

  return cluster;
};

export const findValidWords = (grid: (string | null)[][], history: { r: number, c: number }[]) => {
  const wordMap = new Map<string, { word: string, coords: string[] }>();

  // Helper สำหรับเก็บพิกัดที่มีตัวอักษรจริงเท่านั้น
  const addValidCoords = (coordsArr: string[], r: number, c: number) => {
    if (grid[r] && grid[r][c]) coordsArr.push(`${r},${c}`);
    if (grid[r-1] && grid[r-1][c]) coordsArr.push(`${r-1},${c}`);
    if (grid[r+1] && grid[r+1][c]) coordsArr.push(`${r+1},${c}`);
  };

  history.forEach(tile => {
    // 1. แนวนอน
    if (tile.r % 2 !== 0) {
      let startC = tile.c;
      while (startC > 0 && grid[tile.r][startC - 1]) startC--;
      let hWord = "";
      let hCoords: string[] = [];
      let currC = startC;
      let count = 0;
      while (currC < 15 && grid[tile.r][currC]) {
        hWord += getCluster(grid, tile.r, currC);
        addValidCoords(hCoords, tile.r, currC); // เก็บเฉพาะที่มีตัวอักษร
        currC++; count++;
      }
      if (count > 1) wordMap.set(`h-${tile.r}-${startC}`, { word: hWord, coords: hCoords });
    }

    // 2. แนวตั้ง
    let c = tile.c;
    let startR = tile.r % 2 === 0 ? (grid[tile.r+1]?.[c] ? tile.r+1 : tile.r-1) : tile.r;
    while (startR > 1 && grid[startR - 2]?.[c]) startR -= 2;
    let vWord = "";
    let vCoords: string[] = [];
    let currR = startR;
    let vCount = 0;
    while (currR < 31 && grid[currR]?.[c]) {
      vWord += getCluster(grid, currR, c);
      addValidCoords(vCoords, currR, c); // เก็บเฉพาะที่มีตัวอักษร
      currR += 2; vCount++;
    }
    if (vCount > 1) wordMap.set(`v-${startR}-${c}`, { word: vWord, coords: vCoords });
  });

  return Array.from(wordMap.values()).map(item => ({
    ...item,
    coords: Array.from(new Set(item.coords)) 
  }));
};

export const calculateBingoBonus = (tilesCount: number): number => {
  if (tilesCount === 6) return 40;
  if (tilesCount === 7) return 50;
  if (tilesCount === 8) return 70;
  if (tilesCount >= 9) return 90;
  return 0;
};