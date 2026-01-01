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

export const getCluster = (grid: (string | null)[][], r: number, c: number) => {
  if (r % 2 === 0) return ""; // ข้ามถ้าไม่ใช่แถวพยัญชนะหลัก
  const main = grid[r][c];
  if (!main) return "";
  const top = grid[r - 1][c] || "";
  const bottom = grid[r + 1][c] || "";
  return main + top + bottom;
};

export const findValidWords = (grid: (string | null)[][], history: { r: number, c: number }[]) => {
  const wordMap = new Map<string, { word: string, coords: Set<string> }>();

  history.forEach(tile => {
    // 1. แนวนอน (Horizontal Scan)
    if (tile.r % 2 !== 0) {
      let startC = tile.c;
      while (startC > 0 && grid[tile.r][startC - 1]) startC--;
      
      let hWord = "";
      let hCoords = new Set<string>();
      let currC = startC;
      let cellsCount = 0; // ตัวนับจำนวนช่องเบี้ยในแถวหลัก
      
      while (currC < 15 && grid[tile.r][currC]) {
        hWord += getCluster(grid, tile.r, currC);
        hCoords.add(`${tile.r},${currC}`);
        hCoords.add(`${tile.r - 1},${currC}`);
        hCoords.add(`${tile.r + 1},${currC}`);
        currC++;
        cellsCount++; // เพิ่มจำนวนช่องที่พบ
      }
      
      // เงื่อนไข: ต้องประกอบด้วยเบี้ยในแถวหลักอย่างน้อย 2 ช่อง (เช่น "ไ" + "ต")
      if (cellsCount > 1) {
        wordMap.set(`h-${tile.r}-${startC}`, { word: hWord, coords: hCoords });
      }
    }

    // 2. แนวตั้ง (Vertical Scan)
    let c = tile.c;
    // หาจุดเริ่มพยัญชนะที่สูงที่สุดในเสานี้
    let startR = tile.r % 2 === 0 ? (grid[tile.r + 1]?.[c] ? tile.r + 1 : tile.r - 1) : tile.r;
    while (startR > 1 && grid[startR - 2][c]) startR -= 2;
    
    let vWord = "";
    let vCoords = new Set<string>();
    let currR = startR;
    let vCellsCount = 0;
    
    while (currR < 30 && grid[currR][c]) {
      vWord += getCluster(grid, currR, c);
      vCoords.add(`${currR},${c}`);
      vCoords.add(`${currR - 1},${c}`);
      vCoords.add(`${currR + 1},${c}`);
      currR += 2; // ข้ามรางสระไปพยัญชนะถัดไป
      vCellsCount++;
    }
    
    if (vCellsCount > 1) {
      wordMap.set(`v-${startR}-${c}`, { word: vWord, coords: vCoords });
    }
  });

  return Array.from(wordMap.values());
};

export const calculateBingoBonus = (tilesCount: number): number => {
  if (tilesCount === 6) return 40;
  if (tilesCount === 7) return 50;
  if (tilesCount === 8) return 70;
  if (tilesCount >= 9) return 90;
  return 0;
};