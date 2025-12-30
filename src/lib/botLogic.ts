// src/lib/botLogic.ts
import { findValidWords } from './gameLogic';

export const runBotTurn = async (
  grid: (string | null)[][], 
  botRack: string[], 
  checkAPI: (word: string) => Promise<boolean>
) => {
  const anchors = [];
  for (let r = 1; r < 30; r += 2) {
    for (let c = 0; c < 15; c++) { if (grid[r][c]) anchors.push({r, c}); }
  }

  // สุ่มหาตำแหน่งวาง
  for (const anchor of anchors.sort(() => Math.random() - 0.5)) {
    for (const char of botRack.sort(() => Math.random() - 0.5)) {
      if (char === '0') continue;

      const directions = [
        { dr: 0, dc: 1, type: 'h' }, // ลองขวา
        { dr: 2, dc: 0, type: 'v' }  // ลองล่าง
      ];

      for (const { dr, dc } of directions) {
        const nr = anchor.r + dr;
        const nc = anchor.c + dc;

        if (nr < 31 && nc < 15 && !grid[nr][nc]) {
          // --- จำลองการวางเพื่อเช็ค "คำรวม" ---
          const tempGrid = grid.map(row => [...row]);
          tempGrid[nr][nc] = char;

          // ใช้ตัวสแกนเดียวกับคนหาคำทั้งหมดที่เกิดขึ้น
          const createdWords = findValidWords(tempGrid, [{ r: nr, c: nc }]);
          
          if (createdWords.length > 0) {
            let allWordsValid = true;
            for (const info of createdWords) {
              const isValid = await checkAPI(info.word);
              if (!isValid) { allWordsValid = false; break; }
            }


            if (allWordsValid) {
              return { word: createdWords[0].word, placements: [{ r: nr, c: nc, char }] };
            }
          }
        }
      }
    }
  }
  return null;
};