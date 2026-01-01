// src/hooks/useTurnActions.ts
import { findValidWords, calculateBingoBonus } from '@/lib/gameLogic';
import { LETTER_SCORES, BOARD_LAYOUT } from '@/lib/constants';

export const useTurnActions = (game: any, mode: string, roomInfo: any, playerRole: number) => {
  
  // 💡 ฟังก์ชันตรวจสอบสถานะเกม (จบเกม/รีเซ็ต)
  const checkGameStatus = (currentScores: any, p1Rack: string[], p2Rack: string[], bag: string[], skips: number) => {
    const finalScores = { ...currentScores };
    let msg = "";

    // 1. กรณีจบเกมปกติ (ถุงหมด + มีคนเบี้ยหมดมือ)
    if (bag.length === 0 && (p1Rack.length === 0 || p2Rack.length === 0)) {
      const outOfTilesRole = p1Rack.length === 0 ? 1 : 2;
      const opponentRack = outOfTilesRole === 1 ? p2Rack : p1Rack;
      
      // คำนวณโบนัส x2 จากเบี้ยที่เหลือในมือคู่แข่ง
      const bonus = game.calculateRackScore(opponentRack) * 2;
      
      if (outOfTilesRole === 1) finalScores.p1 += bonus; 
      else finalScores.p2 += bonus;
      
      // ตัดสินผู้ชนะจากคะแนนสุดท้ายที่รวมโบนัสแล้ว (ใครคะแนนสูงกว่าชนะ)
      const winnerRole = finalScores.p1 > finalScores.p2 ? 1 : (finalScores.p1 < finalScores.p2 ? 2 : 0);
      const winnerName = winnerRole === 0 ? "เสมอ" : (winnerRole === 1 ? "P1" : "P2");
      
      msg = `🎮 จบเกม! ${winnerName} เป็นผู้ชนะ (P${outOfTilesRole} เบี้ยหมดมือ ได้โบนัส +${bonus} แต้ม)`;
      return { isEnd: true, finalScores, msg };
    }

    // 2. กรณีข้ามตาติดต่อกันครบ 6 ตา (Stalemate / Reset)
    if (skips >= 6) {
      if (bag.length === 0) {
        // 💡 ถ้าเบี้ยหมดถุงแล้ว -> จบเกมทันที และหักคะแนนเบี้ยค้างมือ
        finalScores.p1 -= game.calculateRackScore(p1Rack);
        finalScores.p2 -= game.calculateRackScore(p2Rack);
        
        const winnerRole = finalScores.p1 > finalScores.p2 ? 1 : (finalScores.p1 < finalScores.p2 ? 2 : 0);
        const resultText = winnerRole === 0 ? "เสมอ" : `P${winnerRole} เป็นผู้ชนะ`;
        
        msg = `🎮 จบเกม (Stalemate)! ${resultText} (หักคะแนนเบี้ยค้างมือ)`;
        return { isEnd: true, finalScores, msg };
      } else {
        // 💡 ถ้าเบี้ยยังไม่หมดถุง -> รีเซ็ตกระดานเริ่มใหม่ที่ดาว
        return { isEnd: false, finalScores, resetGrid: true, msg: "🔄 หยุดนิ่ง 6 ตา! รีเซ็ตกระดานเริ่มใหม่ที่ดาว" };
      }
    }

    return { isEnd: false, finalScores };
  };

  const handleSubmit = async () => {
    // 💡 ดักถ้าจบเกมแล้ว ห้ามกด Submit
    if (game.isGameOver || game.turnHistory.length === 0) return;

    // ตรวจสอบตาแรกต้องทับดาว
    if (game.turnCount === 0 && !game.turnHistory.some((h: any) => h.r === 15 && h.c === 7)) {
      return alert("ตาแรกต้องทับดาว!");
    }

    const allWords = findValidWords(game.grid, game.turnHistory);
    if (allWords.length === 0) return alert("การวางไม่ทำให้เกิดคำ!");

    try {
      let turnSum = 0; let log: string[] = []; let validCoords = new Set<string>();
      const turnPlaced = new Set(game.turnHistory.map((h: any) => `${h.r},${h.c}`));

      // --- ส่วนตรวจคำศัพท์และคิดคะแนน (เหมือนเดิม) ---
      for (const info of allWords) {
        const res = await fetch('/api/check-word', { method: 'POST', body: JSON.stringify({ word: info.word }) });
        const data = await res.json();
        if (!data.valid) { alert(`ไม่พบคำว่า "${info.word}"`); return; }
        
        info.coords.forEach((c: string) => validCoords.add(c)); 
        let pts = 0, mult = 1, math: string[] = [];
        
        info.coords.forEach((coord: string) => {
          const [r, c] = coord.split(',').map(Number);
          const char = game.grid[r][c];
          const val = game.blankTiles.has(coord) ? 0 : (LETTER_SCORES[char!] || 0);
          
          if (val > 0 || r % 2 !== 0) {
            let letterPts = val, s = `${val}`;
            if (turnPlaced.has(coord)) {
              const b = BOARD_LAYOUT[(r-1)/2][c];
              if (b==='2L'){ letterPts*=2; s+='x2'; } else if (b==='3L'){ letterPts*=3; s+='x3'; }
              else if (b==='4L'){ letterPts*=4; s+='x4'; } else if (b==='STAR'||b==='2W') mult*=2;
              else if (b==='3W') mult*=3;
            }
            pts += letterPts; math.push(s);
          }
        });
        turnSum += (pts * mult);
        log.push(`${info.word}: (${math.join('+')})${mult > 1 ? `x${mult}`:''} = ${pts*mult}`);
      }

      // 💡 เตรียมข้อมูลอัปเดต
      const nextGrid = game.grid.map((row: any, r: number) => row.map((char: any, c: number) => validCoords.has(`${r},${c}`) ? char : null));
      const bingo = calculateBingoBonus(game.turnHistory.length);
      const grandTotal = turnSum + bingo;
      const nextBag = game.tileBag.slice(game.turnHistory.length);
      const nextRack = [...game.p1Rack, ...game.tileBag.slice(0, game.turnHistory.length)];
      
      const updatedScores = { ...game.scores };
      if (playerRole === 1) updatedScores.p1 += grandTotal; else updatedScores.p2 += grandTotal;

      // ตรวจสอบสถานะจบเกม (เบี้ยหมดถุงและหมดมือ)
      const status = checkGameStatus(updatedScores, nextRack, game.botRack, nextBag, 0);
      const nextTurnCount = game.turnCount + 1; // ✅ เก็บค่า Turn ล่าสุด

      alert(`✅ ยืนยันสำเร็จ:\n${log.join('\n')}${bingo > 0 ? `\n+ BINGO: 50` : ''}\nรวม: ${grandTotal} แต้ม`);
      if (status.msg) alert(status.msg);

      // 💡 1. อัปเดตเครื่องตัวเองครั้งเดียวให้ครบ (ลบส่วนที่ซ้ำออก)
      game.setGrid(nextGrid);
      game.setScores(status.finalScores);
      game.setTileBag(nextBag);
      game.setP1Rack(nextRack);
      game.setTurnHistory([]);
      game.setTurnCount(nextTurnCount);
      game.setSkipCount(0); // รีเซ็ตแต้มข้ามเป็น 0 เสมอเมื่อลงคำสำเร็จ
      
      if (status.isEnd) {
        game.setIsGameOver(true); // ✅ ล็อคกระดานเครื่องตัวเองทันทีเมื่อชนะ
      }

      // 💡 2. ส่งข้อมูลไปซิงค์กับเพื่อน
      if (mode === 'MULTI') {
        await fetch('/api/multiplayer/match', {
          method: 'POST',
          body: JSON.stringify({
            action: 'update_game', roomId: roomInfo.id, role: playerRole,
            gameData: { 
              grid: nextGrid, 
              scores: status.finalScores, 
              tileBag: nextBag, 
              currentPlayer: playerRole === 1 ? 2 : 1, 
              skipCount: 0, 
              turnCount: nextTurnCount, 
              isGameOver: status.isEnd 
            }
          })
        });
      }

      if (!status.isEnd) {
        game.setCurrentPlayer(mode === 'SOLO' ? 2 : (playerRole === 1 ? 2 : 1));
      }
    } catch (e) { alert("ระบบขัดข้อง"); }
  };

  const handleExchange = async (confirmCall: (msg: string) => boolean) => {
    // 💡 1. ดักตรวจสอบสถานะเบื้องต้น (จบเกมแล้วหรือยัง หรือใช่ตาเราไหม)
    if (game.isGameOver || game.currentPlayer !== playerRole) return;

    const num = game.turnHistory.length;
    let nextGrid = game.grid; 
    let finalBag = game.tileBag;
    let isConfirmed = false;
    const newSkip = game.skipCount + 1; // 💡 เพิ่มจำนวนการข้าม

    // --- ส่วนที่ 1: ตรรกะการแลกเบี้ย (Exchange) ---
    if (num > 0) {
      if (!confirmCall(`ต้องการแลกเบี้ย ${num} ตัว?`)) return;
      if (game.tileBag.length < num) return alert("เบี้ยในถุงไม่พอสำหรับการแลก!");

      // จั่วเบี้ยใหม่ -> เตรียมคืนเบี้ยเก่า -> สับถุงใหม่
      const drawn = game.tileBag.slice(0, num);
      const remaining = game.tileBag.slice(num);
      const returned = game.turnHistory.map((h: any) => h.isBlank ? '0' : h.char);
      finalBag = [...remaining, ...returned].sort(() => Math.random() - 0.5);
      
      // ✅ Surgical Cleanup: คืนค่าเดิมลงกระดานก่อนส่งข้อมูล
      const updatedGrid = [...game.grid.map((row: any) => [...row])];
      game.turnHistory.forEach((h: any) => { 
        updatedGrid[h.r][h.c] = h.originalChar; 
      });
      
      // อัปเดต State ภายในเครื่องตัวเอง
      game.setGrid(updatedGrid); 
      game.setP1Rack((prev: string[]) => [...prev, ...drawn]);
      game.setTileBag(finalBag);
      game.setTurnHistory([]);
      
      nextGrid = updatedGrid;
      isConfirmed = true;
    } 
    // --- ส่วนที่ 2: ตรรกะการข้ามตา (Skip) ---
    else {
      if (!confirmCall("ต้องการข้ามตานี้ใช่หรือไม่?")) return;
      isConfirmed = true;
    }

    // --- ส่วนที่ 3: การประมวลผลกติกาและซิงค์ข้อมูล (Multiplayer Sync) ---
    if (isConfirmed) {
      // ตรวจสอบสถานะจบเกมหรือรีเซ็ตกระดานจากค่า skipCount ใหม่
      const status = checkGameStatus(game.scores, game.p1Rack, game.botRack, finalBag, newSkip);
      const nextTurn = mode === 'SOLO' ? 2 : (playerRole === 1 ? 2 : 1);
      
      // เตรียมกระดานเปล่ากรณีเกิดการรีเซ็ต
      const emptyGrid = Array(31).fill(null).map(() => Array(15).fill(null));
      const gridToSend = status.resetGrid ? emptyGrid : nextGrid;

      // 📡 ส่งข้อมูลอัปเดตไปให้คู่แข่งผ่าน Pusher
      if (mode === 'MULTI' && roomInfo?.id) {
        await fetch('/api/multiplayer/match', {
          method: 'POST',
          body: JSON.stringify({
            action: 'update_game', 
            roomId: roomInfo.id, 
            role: playerRole,
            gameData: { 
              grid: gridToSend, 
              scores: status.finalScores, 
              tileBag: finalBag, 
              currentPlayer: nextTurn, 
              skipCount: status.resetGrid ? 0 : newSkip, 
              isGameOver: status.isEnd,
              turnCount: status.resetGrid ? 0 : game.turnCount // ✅ รีเซ็ตเพื่อให้ลงทับดาวได้ใหม่
            }
          })
        });
      }
      
      // แสดงข้อความแจ้งเตือน (ถ้ามี)
      if (status.msg) alert(status.msg);

      // 💡 อัปเดตสถานะเครื่องตัวเองตามผลลัพธ์ของ checkGameStatus
      if (status.resetGrid) {
        game.setGrid(emptyGrid);
        game.setTurnCount(0);
        game.setSkipCount(0);
        game.setTurnHistory([]);
        game.setBlankTiles(new Set()); // ล้างค่าตัวฟรี
      } else {
        game.setSkipCount(newSkip);
        game.setTurnCount((p: number) => p + 1);
      }

      // ตรวจสอบการจบเกม
      if (status.isEnd) {
        game.setIsGameOver(true);
        game.setScores(status.finalScores);
      }

      game.setCurrentPlayer(nextTurn);
    }
  };
  return { handleSubmit, handleExchange, checkGameStatus};
};