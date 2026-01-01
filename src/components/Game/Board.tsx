'use client';
import { useState, useEffect } from 'react';
import { LETTER_SCORES, BOARD_LAYOUT } from '@/lib/constants';
import { findValidWords, calculateBingoBonus } from '@/lib/gameLogic';
import { useGameActions } from '@/hooks/useGameActions';
import { useMultiplayer } from '@/hooks/useMultiplayer';
import { useTurnActions } from '@/hooks/useTurnActions';
import { runBotTurn } from '@/lib/botLogic';
import Pusher from 'pusher-js';

// ✅ เพิ่ม Imports ที่หายไป
import { GameHeader } from './parts/GameHeader';
import { BoardGrid } from './parts/BoardGrid';
import { PlayerControls } from './parts/PlayerControls';
import { GameModals } from './parts/GameModals';

export default function Board({ mode, roomInfo, onBack, playerName: pName, opponentName: oName, initialData }: any) {
  const playerRole = roomInfo?.role || 1;
  const game = useGameActions(mode, roomInfo, playerRole, initialData);
  const [isOpponentLeft, setIsOpponentLeft] = useState(false);
  const [showBotRack, setShowBotRack] = useState(false);

  const playerName = pName || "YOU"; 
  const opponentName = oName || (mode === 'SOLO' ? 'BOT' : 'Opponent');

  const { handleExchange, handleSubmit, checkGameStatus } = useTurnActions(game, mode, roomInfo, playerRole);

  // --- Multi Sync (Initial Sync) ---
  useEffect(() => {
    if (mode !== 'MULTI' || !roomInfo?.id) return;
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, { cluster: 'ap1' });
    const channel = pusher.subscribe(`room-${roomInfo.id}`);

    if (playerRole === 1 && game.tileBag.length > 0 && game.turnCount === 0) {
      fetch('/api/multiplayer/match', {
        method: 'POST',
        body: JSON.stringify({
          action: 'update_game', roomId: roomInfo.id, role: 1,
          gameData: { tileBag: game.tileBag, p2Rack: game.p2InitialRack, currentPlayer: game.currentPlayer, scores: game.scores }
        })
      });
    }

    channel.bind('game-updated', (data: any) => {
      if (data.role !== playerRole) {
        const gd = data.gameData;
        
        // 💡 3. ตรวจสอบว่ามีการส่งรายละเอียดการลงคำมาหรือไม่
        if (gd.lastMove) {
          const { log, bingo, total } = gd.lastMove;
          alert(
            `🎮 ${opponentName} ลงคำ:\n` + 
            `${log.join('\n')}` + 
            `${bingo > 0 ? '\n+ BINGO: 50' : ''}\n` + 
            `รวม: ${total} แต้ม`
          );
        }

        // ซิงค์สถานะเกมปกติ
        game.setGrid(gd.grid);
        game.setCurrentPlayer(gd.currentPlayer);
        game.setTileBag(gd.tileBag);
        game.setScores(gd.scores);

        // 💡 จุดสำคัญ: ซิงค์ turnCount เพื่อให้เงื่อนไข "ทับดาว" ถูกต้อง
        if (data.gameData.turnCount !== undefined) {
          game.setTurnCount(data.gameData.turnCount);
        }
      }
    });

    // 💡 ดักสัญญาณคนออก (แก้ปัญหา Popup ไม่เด้ง)
    // 💡 ตัวรับสัญญาณคนออก
    channel.bind('opponent-disconnected', (data: any) => {
      console.log("⚠️ คู่แข่งออกจากเกม:", data);
      // ตรวจสอบว่า Role ที่ออกไม่ใช่ตัวเราเอง
      if (Number(data.role) !== Number(playerRole)) {
        setIsOpponentLeft(true); // Popup "YOU WIN!" จะเด้งขึ้นมา
      }
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`room-${roomInfo.id}`);
    };
  }, [roomInfo?.id, playerRole, mode]);

  // --- Bot Logic (รองรับเบี้ยทางเลือกและเบี้ยว่าง) ---
  useEffect(() => {
    // 💡 ดักถ้าไม่ใช่โหมด SOLO หรือไม่ใช่ตาบอท หรือเกมจบแล้ว ให้หยุดทำงาน
    if (mode !== 'SOLO' || game.currentPlayer !== 2 || game.isGameOver) return;

    const handleBot = async () => {
      try {
        // 1. บอทประมวลผลหาคำศัพท์ที่ดีที่สุด
        const result = await runBotTurn(game.grid, game.botRack, async (word) => {
          const res = await fetch('/api/check-word', { method: 'POST', body: JSON.stringify({ word }) });
          const data = await res.json(); 
          return data.valid;
        });

        if (result && result.placements.length > 0) {
          const tempGrid = game.grid.map((row: any) => [...row]);
          result.placements.forEach((p: any) => { tempGrid[p.r][p.c] = p.char; });

          const botWords = findValidWords(tempGrid, result.placements);
          const botTurnCoords = new Set(result.placements.map((p: any) => `${p.r},${p.c}`));
          const validCoords = new Set<string>();
          let botSum = 0;

          // 2. คำนวณคะแนนคำศัพท์ที่บอทลง
          botWords.forEach(info => {
            info.coords.forEach((c: string) => validCoords.add(c));
            let pts = 0, mult = 1;
            
            info.coords.forEach((coord: string) => {
              const [r, c] = coord.split(',').map(Number);
              // คะแนนพื้นฐานของตัวอักษรนั้นๆ
              let charPts = LETTER_SCORES[tempGrid[r][c]!] || 0;

              if (botTurnCoords.has(coord)) {
                const b = BOARD_LAYOUT[(r - 1) / 2][c];
                if (b === '2L') charPts *= 2; 
                else if (b === '3L') charPts *= 3; 
                else if (b === '4L') charPts *= 4;
                else if (b === 'STAR' || b === '2W') mult *= 2; 
                else if (b === '3W') mult *= 3;
              }
              pts += charPts;
            });
            botSum += (pts * mult);
          });

          // 3. Surgical Cleanup สำหรับบอท
          const cleanBotGrid = tempGrid.map((row, r) => 
            row.map((char, c) => validCoords.has(`${r},${c}`) ? char : null)
          );

          const botBingo = calculateBingoBonus(result.placements.length);
          const totalPoints = botSum + botBingo;

          alert(`🤖 บอทลงคำ: ${botWords.map(i => i.word).join(', ')}\nรวม: ${totalPoints} แต้ม`);

          // 4. จัดการเบี้ยในมือบอท (Logic การหักเบี้ยพิเศษ)
          const newBotRack = [...game.botRack];
          result.placements.forEach((p: any) => {
            // ก. ลองหาเบี้ยตรงตัวก่อน
            let idx = newBotRack.indexOf(p.char);

            // ข. ถ้าไม่เจอ ลองเช็คว่าเป็นเบี้ยทางเลือกหรือไม่ (เช่น ฆ/ซ)
            if (idx === -1) {
              idx = newBotRack.findIndex(tile => tile.includes('/') && tile.includes(p.char));
            }

            // ค. ถ้ายังไม่เจออีก แสดงว่าบอทใช้เบี้ยว่าง (0)
            if (idx === -1) {
              idx = newBotRack.indexOf('0');
            }

            // หักเบี้ยออกจากมือบอท
            if (idx > -1) {
              newBotRack.splice(idx, 1);
            }
          });

          // 5. อัปเดตสถานะเกม (คะแนน, กระดาน, ถุงเบี้ย)
          const updatedScores = { ...game.scores, p2: game.scores.p2 + totalPoints };
          const nextBag = game.tileBag.slice(result.placements.length);
          const drawn = game.tileBag.slice(0, result.placements.length);

          // เช็คสถานะจบเกมสำหรับบอท
          // (หมายเหตุ: ในโหมด SOLO p1Rack คือมือผู้เล่น, newBotRack คือมือบอท)
          const status = checkGameStatus(updatedScores, game.p1Rack, newBotRack, nextBag, 0);

          game.setGrid(cleanBotGrid);
          game.setScores(status.finalScores);
          game.setTileBag(nextBag);
          game.setBotRack([...newBotRack, ...drawn]);

          if (status.isEnd) {
            game.setIsGameOver(true);
            if (status.msg) alert(status.msg);
          }

        } else {
          alert("บอทไม่มีคำศัพท์ที่ลงได้... ขอผ่าน");
          // กรณีบอทข้ามตา ให้เช็ค Stalemate ด้วย
          const nextSkip = game.skipCount + 1;
          const status = checkGameStatus(game.scores, game.p1Rack, game.botRack, game.tileBag, nextSkip);
          
          game.setSkipCount(status.resetGrid ? 0 : nextSkip);
          if (status.resetGrid) {
            game.setGrid(Array(31).fill(null).map(() => Array(15).fill(null)));
            game.setTurnCount(0);
          }
          if (status.isEnd) game.setIsGameOver(true);
          if (status.msg) alert(status.msg);
        }
      } catch (e) { 
        console.error("Bot Error:", e); 
      } finally { 
        // สลับตากลับมาที่ผู้เล่น
        game.setCurrentPlayer(1); 
        game.setTurnCount((p: number) => p + 1); 
      }
    };

    // หน่วงเวลาเพื่อให้ดูเหมือนบอทกำลังคิด
    const timer = setTimeout(handleBot, 1500);
    return () => clearTimeout(timer);

  }, [game.currentPlayer, mode, game.isGameOver]);

  const onSelect = (selectedChar: string, isBlank: boolean) => {
    if (game.blankMenu) {
      const { r, c, originalChar } = game.blankMenu;
      // ส่ง '0' เป็นร่างเดิมของเบี้ยว่าง
      game.placeTile(r, c, selectedChar, true, originalChar, '0');
      game.setBlankTiles((prev: Set<string>) => new Set(prev).add(`${r},${c}`));
      game.setBlankMenu(null);
    } 
    else if (game.diacriticMenu) {
      const { r, c, originalChar, dualOptions } = game.diacriticMenu;
      
      // 💡 ตรวจสอบว่ามาจากเบี้ยทางเลือก (ฆ/ซ) หรือไม่
      if (dualOptions) {
        const originalDualStr = dualOptions.join('/'); // ต่อกลับเป็น 'ฆ/ซ'
        game.placeTile(r, c, selectedChar, false, originalChar, originalDualStr);
      } else {
        // กรณีสระ/วรรณยุกต์ทั่วไปไม่มีร่างเดิมใน Rack
        game.placeTile(r, c, selectedChar, false, originalChar);
      }
      game.setDiacriticMenu(null);
    }
  };

  return (
    <div className="flex flex-col items-center justify-start gap-4 p-4 bg-slate-50 min-h-screen font-sans overflow-x-hidden">      
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
        onCellClick={(r: number, c: number) => {
          // 💡 ดักถ้าจบเกมแล้ว หรือไม่ใช่ตาเรา ห้ามกด
          if (game.isGameOver || game.currentPlayer !== playerRole) return;

          const isMain = r % 2 !== 0; // ช่องสำหรับวางตัวอักษร
          
          if (isMain && game.selectedRackIndex !== null) {
            const char = game.p1Rack[game.selectedRackIndex];
            const original = game.grid[r][c];
            
            // ตรวจสอบการวางทับ
            const hasOverwritten = game.turnHistory.some((h: any) => h.originalChar !== null);
            if (original) {
              if (hasOverwritten) return alert("วางทับเบี้ยเดิมได้ไม่เกิน 1 ตัวต่อหนึ่งตาเดิน!");
              if (!window.confirm(`ต้องการวางทับตัว "${original}"?`)) return;
            }

            // 🔍 1. กรณีเป็นเบี้ยทางเลือก (เช่น ฆ/ซ)
            if (char.includes('/')) {
              game.setDiacriticMenu({ 
                r, c, 
                originalChar: original, 
                dualOptions: char.split('/') // แยกตัวเลือก เช่น ['ฆ', 'ซ']
              });
              game.setP1Rack((p: string[]) => p.filter((_, i) => i !== game.selectedRackIndex));
              game.setSelectedRackIndex(null);
              return;
            }

            // 🔍 2. กรณีเป็นเบี้ยตัวฟรี (Blank)
            if (char === '0') {
              game.setBlankMenu({ r, c, originalChar: original });
            } 
            // 🔍 3. กรณีเป็นเบี้ยปกติ
            else {
              game.placeTile(r, c, char, false, original);
            }

            game.setP1Rack((p: string[]) => p.filter((_, i) => i !== game.selectedRackIndex));
            game.setSelectedRackIndex(null);
          } 
          // 💡 กรณีคลิกช่องสระ/วรรณยุกต์ (ช่องเลขคู่)
          else if (!isMain) {
            game.setDiacriticMenu({ r, c });
          }
        }} 
      />

      {showBotRack && (
        <div className="flex gap-2 p-3 bg-rose-50 rounded-2xl border-2 border-dashed border-rose-200">
          {game.botRack.map((t: string, i: number) => <div key={i} className="w-8 h-8 bg-white border border-rose-100 rounded-lg flex items-center justify-center text-sm text-rose-300 font-bold shadow-sm italic">{t==='0'?' ':t}</div>)}
        </div>
      )}

      <PlayerControls rack={game.p1Rack} selectedIndex={game.selectedRackIndex} currentPlayer={game.currentPlayer} playerRole={playerRole} onSelect={game.handleRackSelect} onRecall={game.handleRecall} onExchange={() => handleExchange(window.confirm)} onShuffle={game.handleShuffle} onSubmit={handleSubmit} />
      
      {/* ✅ ใส่ Type (char: string, isBlank: boolean) */}
      <GameModals 
        blankMenu={game.blankMenu} 
        diacriticMenu={game.diacriticMenu} 
        isOpponentLeft={isOpponentLeft} 
        onSelect={onSelect} // ✅ ใช้ฟังก์ชันที่เราเพิ่งสร้างด้านบน
        onClose={game.handleCloseModals} 
      />
      {/* 🏆 Popup สรุปคะแนนผู้ชนะ (เด้งอัตโนมัติเมื่อจบเกม) */}
      {game.isGameOver && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[1000] flex items-center justify-center p-6 animate-in fade-in duration-500">
          <div className="bg-white p-10 rounded-[3.5rem] shadow-2xl w-full max-w-md text-center border-t-8 border-indigo-600 relative overflow-hidden">
            
            {/* เอฟเฟกต์ตกแต่งด้านหลัง */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-50 rounded-full blur-3xl opacity-50"></div>
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-rose-50 rounded-full blur-3xl opacity-50"></div>

            <div className="relative z-10">
              <div className="text-7xl mb-6 animate-bounce">
                {game.scores.p1 === game.scores.p2 ? "🤝" : (
                  (playerRole === 1 && game.scores.p1 > game.scores.p2) || (playerRole === 2 && game.scores.p2 > game.scores.p1) 
                  ? "🏆" : "💀"
                )}
              </div>

              <h2 className="text-4xl font-black text-slate-800 mb-2 italic tracking-tight">
                {game.scores.p1 === game.scores.p2 ? "DRAW!" : (
                  (playerRole === 1 && game.scores.p1 > game.scores.p2) || (playerRole === 2 && game.scores.p2 > game.scores.p1) 
                  ? "VICTORY!" : "DEFEAT!"
                )}
              </h2>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-10">Final Match Results</p>
              
              {/* ส่วนแสดงคะแนนเปรียบเทียบ */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-8 rounded-[2.5rem] mb-10 border-2 border-slate-100 relative">
                <div className="flex flex-col items-center">
                  <span className={`text-[9px] font-black mb-2 px-3 py-1 rounded-full ${playerRole === 1 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    {playerName} {playerRole === 1 && "(YOU)"}
                  </span>
                  <span className={`text-5xl font-black ${game.scores.p1 >= game.scores.p2 ? 'text-slate-800' : 'text-slate-300'}`}>
                    {game.scores.p1}
                  </span>
                </div>

                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 py-1 rounded-full border-2 border-slate-100 text-[10px] font-black text-slate-300">
                  VS
                </div>

                <div className="flex flex-col items-center">
                  <span className={`text-[9px] font-black mb-2 px-3 py-1 rounded-full ${playerRole === 2 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    {opponentName} {playerRole === 2 && "(YOU)"}
                  </span>
                  <span className={`text-5xl font-black ${game.scores.p2 >= game.scores.p1 ? 'text-slate-800' : 'text-slate-300'}`}>
                    {game.scores.p2}
                  </span>
                </div>
              </div>

              {/* ปุ่มออกจากเกม */}
              <button 
                onClick={onBack} 
                className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black text-xl shadow-xl hover:bg-indigo-600 hover:-translate-y-1 transition-all active:scale-95"
              >
                EXIT TO LOBBY
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}