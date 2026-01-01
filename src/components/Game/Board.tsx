'use client';
import { useState, useEffect } from 'react';
import { LETTER_SCORES, BOARD_LAYOUT } from '@/lib/constants';
import { findValidWords, calculateBingoBonus } from '@/lib/gameLogic';
import { runBotTurn, Placement } from '@/lib/botLogic';

// --- IMPORT PARTS & HOOKS ---
import { useGameActions } from '@/hooks/useGameActions';
import { useMultiplayer } from '@/hooks/useMultiplayer';
import { GameHeader } from './parts/GameHeader';
import { BoardGrid } from './parts/BoardGrid';
import { PlayerControls } from './parts/PlayerControls';
import { GameModals } from './parts/GameModals';

import Pusher from 'pusher-js';

export default function Board({ 
  mode, 
  roomInfo, 
  onBack, 
  playerName: playerNameProp,
  opponentName: opponentNameProp 
}: any) {
  const playerRole = roomInfo?.role || 1;
  const [isOpponentLeft, setIsOpponentLeft] = useState(false);
  const [showBotRack, setShowBotRack] = useState(false);

  const game = useGameActions(mode, roomInfo, playerRole);

  const playerName = playerNameProp || "YOU"; 
  const opponentName = opponentNameProp || (mode === 'SOLO' ? 'BOT' : 'Opponent');

  useEffect(() => {
    if (mode !== 'MULTI' || !roomInfo?.id) return;

    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, { cluster: 'ap1' });
    const channel = pusher.subscribe(`room-${roomInfo.id}`);

    channel.bind('game-updated', (data: any) => {
      // ถ้าคู่แข่งเป็นคนส่งข้อมูลมา ให้เราอัปเดตตาม
      if (data.role !== playerRole) {
        console.log("คู่แข่งเปลี่ยนตา/แลกเบี้ยแล้ว");
        game.setGrid(data.gameData.grid);
        game.setCurrentPlayer(data.gameData.currentPlayer);
        game.setTileBag(data.gameData.tileBag);
        game.setScores(data.gameData.scores);
      }
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`room-${roomInfo.id}`);
    };
  }, [roomInfo?.id]);

  useMultiplayer(
    mode, 
    roomInfo, 
    playerRole, 
    game.setGrid, 
    game.setScores, 
    game.setCurrentPlayer, 
    game.setTurnCount, 
    setIsOpponentLeft
  );

  // --- [จุดแก้ไขเพิ่ม]: ระบบแจ้งเตือน Exchange/Skip ไปยังคู่แข่ง ---
  const handleExchange = async (confirmCall: (msg: string) => boolean) => {
    if (game.currentPlayer !== playerRole) return;
    const numToExchange = game.turnHistory.length;
    
    let nextGrid = game.grid;
    let nextBag = game.tileBag;
    let isActionConfirmed = false;

    if (numToExchange > 0) {
        if (!confirmCall(`ต้องการแลกเบี้ย ${numToExchange} ตัวใช่หรือไม่?`)) return;
        if (game.tileBag.length < numToExchange) return alert("เบี้ยในถุงไม่พอ!");

        // Logic แลกเบี้ย (จั่วใหม่ -> คืนของเก่า -> Shuffle)
        const drawnTiles = game.tileBag.slice(0, numToExchange);
        const remainingBag = game.tileBag.slice(numToExchange);
        const tilesToReturn = game.turnHistory.map(h => h.isBlank ? '0' : h.char);
        const finalBag = [...remainingBag, ...tilesToReturn].sort(() => Math.random() - 0.5);

        const updatedGrid = [...game.grid];
        const nextBlanks = new Set(game.blankTiles);
        game.turnHistory.forEach(h => {
          updatedGrid[h.r][h.c] = null;
          nextBlanks.delete(`${h.r},${h.c}`);
        });

        // อัปเดตเครื่องตัวเอง
        game.setGrid(updatedGrid);
        game.setBlankTiles(nextBlanks);
        game.setP1Rack(prev => [...prev, ...drawnTiles]);
        game.setTileBag(finalBag);
        game.setTurnHistory([]);
        
        nextGrid = updatedGrid;
        nextBag = finalBag;
        isActionConfirmed = true;
    } else {
        if (!confirmCall("ต้องการข้ามตานี้ใช่หรือไม่?")) return;
        isActionConfirmed = true;
    }

    if (isActionConfirmed) {
        const nextTurn = mode === 'SOLO' ? 2 : (playerRole === 1 ? 2 : 1);
        
        // --- ยิงสัญญาณบอกคู่แข่ง ---
        if (mode === 'MULTI' && roomInfo?.id) {
            await fetch('/api/multiplayer/match', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'update_game',
                    roomId: roomInfo.id,
                    role: playerRole,
                    gameData: {
                        grid: nextGrid,
                        currentPlayer: nextTurn,
                        tileBag: nextBag,
                        scores: game.scores
                    }
                })
            });
        }
        
        game.setCurrentPlayer(nextTurn);
        game.setTurnCount((prev: number) => prev + 1);
    }
  };

  // --- BOT EXECUTION LOGIC (Surgical Cleanup + Bingo) ---
  useEffect(() => {
    if (mode === 'SOLO' && game.currentPlayer === 2) {
      const handleBot = async () => {
        try {
          const result = await runBotTurn(game.grid, game.botRack, async (word) => {
            const res = await fetch('/api/check-word', { method: 'POST', body: JSON.stringify({ word }) });
            const data = await res.json();
            return data.valid;
          });

          if (result && result.placements.length > 0) {
            // 1. จำลองการวางเบี้ยของบอทลงในกระดานชั่วคราว
            const tempGrid = game.grid.map(row => [...row]);
            result.placements.forEach((p: Placement) => { tempGrid[p.r][p.c] = p.char; });

            const botWordsInfo = findValidWords(tempGrid, result.placements);
            const botTurnCoords = new Set(result.placements.map((p: any) => `${p.r},${p.c}`));
            const botValidCoords = new Set<string>();
            
            let botTurnTotal = 0;
            let botDebugLines: string[] = [];

            // 2. คำนวณคะแนนตามกติกาตัวคูณและสร้างสมการ
            botWordsInfo.forEach(info => {
              let wordPointsSum = 0;
              let wordMultiplier = 1;
              let letterParts: string[] = [];
              info.coords.forEach(c => botValidCoords.add(c));

              info.coords.forEach(coordStr => {
                const [r, c] = coordStr.split(',').map(Number);
                const char = tempGrid[r][c] || "";
                const baseVal = LETTER_SCORES[char] || 0;
                let currentLetterScore = baseVal;
                let partStr = `${baseVal}`;

                if (botTurnCoords.has(coordStr)) {
                  const layoutRow = (r - 1) / 2;
                  const bonus = BOARD_LAYOUT[layoutRow][c];
                  if (bonus === '2L') { currentLetterScore *= 2; partStr += 'x2'; }
                  else if (bonus === '3L') { currentLetterScore *= 3; partStr += 'x3'; }
                  else if (bonus === '4L') { currentLetterScore *= 4; partStr += 'x4'; }
                  else if (bonus === '2W' || bonus === 'STAR') wordMultiplier *= 2;
                  else if (bonus === '3W') wordMultiplier *= 3;
                }
                wordPointsSum += currentLetterScore;
                letterParts.push(partStr);
              });

              const finalWordScore = wordPointsSum * wordMultiplier;
              botTurnTotal += finalWordScore;
              const expression = `(${letterParts.join(' + ')})${wordMultiplier > 1 ? ` x${wordMultiplier}` : ''}`;
              botDebugLines.push(`${info.word}: ${expression} = ${finalWordScore}`);
            });

            const botBingo = calculateBingoBonus(result.placements.length);
            const botFinalTotal = botTurnTotal + botBingo;

            // 3. SURGICAL CLEANUP FOR BOT
            const cleanedBotGrid = Array(31).fill(null).map(() => Array(15).fill(null));
            for (let r = 0; r < 31; r++) {
              for (let c = 0; c < 15; c++) {
                const coord = `${r},${c}`;
                const char = tempGrid[r][c];
                if (!char) continue;

                const isBotValid = botValidCoords.has(coord);
                const isPreExisting = char && !result.placements.some((p:any) => p.r === r && p.c === c);
                
                if (isBotValid || isPreExisting) {
                  cleanedBotGrid[r][c] = char;
                }
              }
            }

            // 4. แสดงผลและอัปเดตสถานะ
            let botMsg = `🤖 บอทลงคำ: ${botWordsInfo.map(i => i.word).join(', ')}\n` + botDebugLines.join('\n');
            if (botBingo > 0) botMsg += `\n+ BINGO: 50`;
            botMsg += `\nรวม: ${botFinalTotal} คะแนน`;
            alert(botMsg);

            game.setGrid(cleanedBotGrid);
            game.setScores((prev: any) => ({ ...prev, p2: prev.p2 + botFinalTotal }));

            const newBotRack = [...game.botRack];
            result.placements.forEach((p: Placement) => {
              const idx = newBotRack.indexOf(p.char);
              if (idx > -1) newBotRack.splice(idx, 1);
            });
            const drawn = game.tileBag.slice(0, result.placements.length);
            game.setTileBag((prev: string[]) => prev.slice(result.placements.length));
            game.setBotRack([...newBotRack, ...drawn]);

          } else {
            alert("บอทขอผ่าน");
          }
        } catch (err) {
          console.error("Bot Error:", err);
        } finally {
          game.setCurrentPlayer(1);
          game.setTurnCount((prev: number) => prev + 1);
        }
      };
      const timer = setTimeout(handleBot, 1500);
      return () => clearTimeout(timer);
    }
  }, [game.currentPlayer, mode]);

  // --- PLAYER ACTIONS ---
  const handleCellClick = (r: number, c: number) => {
    // 💡 บล็อกการวางเบี้ยลงบนกระดาน "เฉพาะ" เมื่อไม่ใช่ตาของเรา
    if (game.currentPlayer !== playerRole) return; 

    const isMain = r % 2 !== 0; // แถวพยัญชนะ (แถวคี่)

    if (isMain) {
      // ตรวจสอบว่ามีการเลือกเบี้ยจากมือไว้ และช่องบนกระดานยังว่างอยู่
      if (game.selectedRackIndex !== null && !game.grid[r][c]) {
        const char = game.p1Rack[game.selectedRackIndex];

        if (char === '0') {
          // กรณีเป็นตัวฟรี (Blank) ให้เปิดเมนูเลือกตัวอักษรที่ต้องการแปลง
          game.setBlankMenu({ r, c });
        } else {
          // กรณีเป็นเบี้ยปกติ ให้วางลงบนพิกัดที่คลิก
          game.placeTile(r, c, char, false);
        }

        // เมื่อวางเสร็จ ให้หักเบี้ยออกจากมือ และล้างสถานะการเลือก (Selection)
        game.setP1Rack(prev => prev.filter((_, i) => i !== game.selectedRackIndex));
        game.setSelectedRackIndex(null);
      }
    } else {
      // แถวสระและวรรณยุกต์ (แถวคู่) ให้เปิดเมนูตัวเลือกสระ
      game.setDiacriticMenu({ r, c });
    }
  };

  const handleSubmit = async () => {
    if (game.turnHistory.length === 0) return;

    const isFirstTurn = game.turnCount === 0;
    if (isFirstTurn && !game.turnHistory.some(h => h.r === 15 && h.c === 7)) {
      return alert("ตาแรกต้องทับดาว!");
    }

    // 1. ตรวจหาคำศัพท์ทั้งหมด "ทั้งกระดาน" เพื่อใช้ล้างคำเก่าที่พัง
    const allDetectedWords = findValidWords(game.grid, game.turnHistory);
    if (allDetectedWords.length === 0) return alert("การวางไม่ทำให้เกิดคำ!");

    try {
      let validatedWordsList: string[] = [];
      let totalScoreThisTurn = 0;
      let calculationLog: string[] = [];
      let globalValidCoords = new Set<string>(); // กระดานใหม่จะเหลือแค่พิกัดเหล่านี้
      const currentPlaced = new Set(game.turnHistory.map(h => `${h.r},${h.c}`));

      for (const info of allDetectedWords) {
        const res = await fetch('/api/check-word', { method: 'POST', body: JSON.stringify({ word: info.word }) });
        const data = await res.json();
        
        if (!data.valid) {
          alert(`ไม่พบคำว่า "${info.word}"`);
          return;
        }
        
        validatedWordsList.push(info.word);
        info.coords.forEach(c => globalValidCoords.add(c)); // ลงทะเบียนพิกัดที่ถูกต้อง

        // --- Logic สมการคะแนน: (2 + 3x2) x2 ---
        let wordBase = 0;
        let wordMultiplier = 1;
        let mathParts: string[] = [];

        info.coords.forEach(coordStr => {
          const [r, c] = coordStr.split(',').map(Number);
          const char = game.grid[r][c];
          if (!char) return; // ข้ามช่องว่าง

          const baseVal = game.blankTiles.has(coordStr) ? 0 : (LETTER_SCORES[char] || 0);
          
          // 💡 แสดงเฉพาะตัวอักษรที่มีคะแนน หรือเป็นตัวหลักของกลุ่ม เพื่อไม่ให้เป็น 0+0+0
          if (baseVal > 0 || r % 2 !== 0) {
            let letterTotal = baseVal;
            let partStr = `${baseVal}`;

            if (currentPlaced.has(coordStr)) {
              const bonus = BOARD_LAYOUT[(r - 1) / 2][c];
              if (bonus === '2L') { letterTotal *= 2; partStr += 'x2'; }
              else if (bonus === '3L') { letterTotal *= 3; partStr += 'x3'; }
              else if (bonus === '4L') { letterTotal *= 4; partStr += 'x4'; }
              else if (bonus === '2W' || bonus === 'STAR') wordMultiplier *= 2;
              else if (bonus === '3W') wordMultiplier *= 3;
            }
            wordBase += letterTotal;
            mathParts.push(partStr);
          }
        });

        const wordFinal = wordBase * wordMultiplier;
        totalScoreThisTurn += wordFinal;
        calculationLog.push(`${info.word}: (${mathParts.join(' + ')})${wordMultiplier > 1 ? ` x${wordMultiplier}` : ''} = ${wordFinal}`);
      }

      // --- 💡 2. GLOBAL SURGICAL CLEANUP (ล้าง "แฉ" ออกถ้าไม่เป็นคำแล้ว) ---
      // สร้างกระดานใหม่จากความว่างเปล่า
      const nextCleanGrid = game.grid.map((row, r) => row.map((char, c) => {
        // อนุญาตให้วางเฉพาะตัวอักษรที่ "ยังคงประกอบเป็นคำที่ถูกต้อง" บนกระดานเท่านั้น
        return globalValidCoords.has(`${r},${c}`) ? char : null;
      }));

      const bingo = calculateBingoBonus(game.turnHistory.length);
      const grandTotal = totalScoreThisTurn + bingo;

      // แสดง Debug
      alert(`✅ ยืนยันสำเร็จ:\n${calculationLog.join('\n')}${bingo > 0 ? `\n+ BINGO: 50` : ''}\nรวม: ${grandTotal} แต้ม`);

      // อัปเดต State
      const finalScores = { ...game.scores };
      if (playerRole === 1) finalScores.p1 += grandTotal; else finalScores.p2 += grandTotal;

      game.setGrid(nextCleanGrid);
      game.setScores(finalScores);
      
      // จั่วเบี้ยและสลับตา...
      const numUsed = game.turnHistory.length;
      game.setP1Rack([...game.p1Rack, ...game.tileBag.slice(0, numUsed)]);
      game.setTileBag((prev: string[]) => prev.slice(numUsed));
      game.setTurnHistory([]);
      game.setTurnCount(prev => prev + 1);

      if (mode === 'MULTI' && roomInfo) {
        await fetch('/api/multiplayer/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: roomInfo.id, newGrid: nextCleanGrid, newScores: finalScores,
            senderRole: playerRole, words: validatedWordsList, nextTurn: playerRole === 1 ? 2 : 1
          })
        });
      }
      game.setCurrentPlayer(mode === 'SOLO' ? 2 : (playerRole === 1 ? 2 : 1));

    } catch (e) { alert("ระบบขัดข้อง"); }
  };

  return (
    <div className="flex flex-col items-center justify-start gap-4 p-4 bg-slate-50 min-h-screen font-sans selection:bg-indigo-100 overflow-x-hidden">      
      <GameHeader 
        mode={mode}
        playerName={playerName}
        opponentName={opponentName}
        playerRole={playerRole} 
        currentPlayer={game.currentPlayer}
        scores={game.scores} 
        tileBagLength={game.tileBag.length} 
        showBotRack={showBotRack} 
        setShowBotRack={setShowBotRack} 
        onBack={onBack}
      />

      <BoardGrid 
        grid={game.grid} 
        blankTiles={game.blankTiles} 
        currentPlayer={game.currentPlayer} 
        playerRole={playerRole} 
        mode={mode} 
        onCellClick={handleCellClick} 
      />

      <div className="w-full h-24 flex items-center justify-center shrink-0"> 
        {showBotRack && (
          <div className="flex gap-2 p-3 bg-rose-50 rounded-2xl border-2 border-dashed border-rose-200 animate-in fade-in zoom-in duration-200">
            <span className="text-[10px] font-black text-rose-400 uppercase self-center px-2">Bot's Hand:</span>
            {game.botRack.map((t, i) => (
              <div key={i} className="w-8 h-8 bg-white border border-rose-100 rounded-lg flex items-center justify-center text-sm text-rose-300 font-bold shadow-sm italic">
                {t === '0' ? ' ' : t}
              </div>
            ))}
          </div>
        )}
      </div>

      <PlayerControls 
        rack={game.p1Rack} 
        selectedIndex={game.selectedRackIndex} 
        currentPlayer={game.currentPlayer} 
        playerRole={playerRole} 
        onSelect={game.handleRackSelect} 
        onRecall={game.handleRecall} 
        onExchange={() => handleExchange(window.confirm)} // เปลี่ยนมาใช้ฟังก์ชันที่สร้างใหม่
        onShuffle={game.handleShuffle} 
        onSubmit={handleSubmit} 
      />

      <GameModals 
        blankMenu={game.blankMenu} 
        diacriticMenu={game.diacriticMenu} 
        isOpponentLeft={isOpponentLeft} 
        onSelect={(char, isBlank) => {
          const t = game.blankMenu || game.diacriticMenu;
          if (t) game.placeTile(t.r, t.c, char, isBlank);
          game.setBlankMenu(null); game.setDiacriticMenu(null);
        }} 
        onClose={game.handleCloseModals} 
      />
    </div>
  );
}