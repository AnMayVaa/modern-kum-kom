// src/lib/gameLogic.ts

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