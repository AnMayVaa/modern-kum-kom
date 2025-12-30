// src/lib/gameLogic.ts
export const getCluster = (grid: (string | null)[][], r: number, c: number) => {
  if (r % 2 === 0) return ""; // ข้ามถ้าเป็นแถวรางสระ (ต้องเริ่มที่พยัญชนะ)
  const main = grid[r][c];
  if (!main) return "";
  const top = grid[r - 1][c] || "";
  const bottom = grid[r + 1][c] || "";
  return main + top + bottom;
};

export const findValidWords = (grid: (string | null)[][], history: { r: number, c: number }[]) => {
  const wordMap = new Map<string, { word: string, coords: Set<string> }>();

  history.forEach(tile => {
    // 1. แนวนอน
    if (tile.r % 2 !== 0) {
      let startC = tile.c;
      while (startC > 0 && grid[tile.r][startC - 1]) startC--;
      let hWord = ""; let hCoords = new Set<string>();
      let currC = startC;
      while (currC < 15 && grid[tile.r][currC]) {
        hWord += getCluster(grid, tile.r, currC);
        hCoords.add(`${tile.r},${currC}`);
        hCoords.add(`${tile.r - 1},${currC}`);
        hCoords.add(`${tile.r + 1},${currC}`);
        currC++;
      }
      if (hWord.replace(/[ิ-์]/g, '').length > 1) wordMap.set(`h-${tile.r}-${startC}`, { word: hWord, coords: hCoords });
    }

    // 2. แนวตั้ง
    let c = tile.c;
    let startR = tile.r % 2 === 0 ? (grid[tile.r + 1]?.[c] ? tile.r + 1 : tile.r - 1) : tile.r;
    while (startR > 1 && grid[startR - 2][c]) startR -= 2;
    let vWord = ""; let vCoords = new Set<string>();
    let currR = startR;
    while (currR < 30 && grid[currR][c]) {
      vWord += getCluster(grid, currR, c);
      vCoords.add(`${currR},${c}`);
      vCoords.add(`${currR - 1},${c}`);
      vCoords.add(`${currR + 1},${c}`);
      currR += 2;
    }
    if (vWord.replace(/[ิ-์]/g, '').length > 1) wordMap.set(`v-${startR}-${c}`, { word: vWord, coords: vCoords });
  });

  return Array.from(wordMap.values());
};