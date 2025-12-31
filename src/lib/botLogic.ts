// src/lib/botLogic.ts
import { findValidWords, calculateBingoBonus } from './gameLogic';
// 1. ดึงค่าคะแนนมาจาก constants.ts แทนการประกาศใหม่
import { LETTER_SCORES } from './constants'; 

export interface Placement {
  r: number;
  c: number;
  char: string;
  isBlank?: boolean;
}

export interface BotMove {
  word: string;
  placements: Placement[];
  totalScore: number;
}

interface TestCase {
  chars: string[];
  offsets: number[][];
  blanks?: number[];
}

const THAI_COMMON = ['ก', 'น', 'ร', 'ด', 'า', 'ส', 'เ', 'ง', 'ม'];

export const runBotTurn = async (
  grid: (string | null)[][], 
  botRack: string[], 
  checkAPI: (word: string) => Promise<boolean>
): Promise<BotMove | null> => {
  let bestMove: BotMove | null = null;
  let maxScore = -1;

  const normalTiles = botRack.filter(t => t !== '0' && t !== 'FREE');
  const hasBlank = botRack.includes('0');

  const anchors = [];
  for (let r = 1; r < 31; r += 2) {
    for (let c = 0; c < 15; c++) {
      if (grid[r][c]) continue;
      const isNeighbor = (r > 1 && grid[r-2][c]) || (r < 29 && grid[r+2][c]) || (c > 0 && grid[r][c-1]) || (c < 14 && grid[r][c+1]);
      if (isNeighbor || (r === 15 && c === 7)) anchors.push({ r, c });
    }
  }

  const targetAnchors = anchors.sort(() => Math.random() - 0.5).slice(0, 25);

  for (const anchor of targetAnchors) {
    const testWords: TestCase[] = [];

    for (let i = 0; i < normalTiles.length; i++) {
      testWords.push({ chars: [normalTiles[i]], offsets: [[0, 0]] });

      for (let j = 0; j < normalTiles.length; j++) {
        if (i === j) continue;

        testWords.push({ chars: [normalTiles[i], normalTiles[j]], offsets: [[0, 0], [0, 1]] });
        testWords.push({ chars: [normalTiles[i], normalTiles[j]], offsets: [[0, 0], [2, 0]] });

        if (hasBlank) {
          THAI_COMMON.forEach(commonChar => {
            testWords.push({ 
              chars: [normalTiles[i], commonChar, normalTiles[j]], 
              offsets: [[0, 0], [0, 1], [0, 2]],
              blanks: [1] 
            });
          });
        }
      }
    }

    for (const test of testWords) {
      const tempPlacements: Placement[] = test.chars.map((char, idx) => ({
        r: anchor.r + test.offsets[idx][0],
        c: anchor.c + test.offsets[idx][1],
        char: char,
        isBlank: test.blanks?.includes(idx)
      }));

      if (tempPlacements.some(p => p.r < 0 || p.r >= 31 || p.c < 0 || p.c >= 15 || grid[p.r][p.c])) continue;

      const tempGrid = grid.map(row => [...row]);
      tempPlacements.forEach(p => tempGrid[p.r][p.c] = p.char);

      const createdWordsInfo = findValidWords(tempGrid, tempPlacements);
      if (createdWordsInfo.length === 0) continue;

      let allValid = true;
      let moveScore = 0;

      for (const info of createdWordsInfo) {
        if (!(await checkAPI(info.word))) { allValid = false; break; }
        
        // 2. เปลี่ยนมาใช้ LETTER_SCORES ที่ import มา
        moveScore += info.word.split('').reduce((sum, letter) => {
          const isThisBlank = tempPlacements.find(p => p.char === letter)?.isBlank;
          // ถ้าเป็นเบี้ยว่างได้ 0 คะแนนตามกติกา
          return sum + (isThisBlank ? 0 : (LETTER_SCORES[letter] || 0)); 
        }, 0);
      }

      if (allValid) {
        const bingoBonus = calculateBingoBonus(tempPlacements.length); // เช็คโบนัส
        const finalScore = moveScore + (tempPlacements.length * 3) + bingoBonus;
        
        if (finalScore > maxScore) {
          maxScore = finalScore;
          bestMove = { word: createdWordsInfo[0].word, placements: tempPlacements, totalScore: finalScore };
        }
      }
    }
    if (maxScore > 30) break;
  }

  return bestMove;
};