'use client';
import { useState, useEffect } from 'react';
import { LETTER_SCORES } from '@/lib/constants';
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
            const tempGrid = game.grid.map(row => [...row]);
            result.placements.forEach((p: Placement) => { tempGrid[p.r][p.c] = p.char; });

            const botWordsInfo = findValidWords(tempGrid, result.placements);
            let botValidCoords = new Set<string>();
            let baseScore = 0;

            botWordsInfo.forEach(info => {
              baseScore += info.word.split('').reduce((s, c) => s + (LETTER_SCORES[c] || 0), 0);
              info.coords.forEach(coord => botValidCoords.add(coord));
            });

            const bingoBonus = calculateBingoBonus(result.placements.length);
            const finalScore = baseScore + bingoBonus;

            const cleanedGrid = Array(31).fill(null).map(() => Array(15).fill(null));
            botValidCoords.forEach(coord => {
              const [r, c] = coord.split(',').map(Number);
              cleanedGrid[r][c] = tempGrid[r][c];
            });

            game.setGrid(cleanedGrid);
            game.setScores((prev: any) => ({ ...prev, p2: prev.p2 + finalScore }));

            const newBotRack = [...game.botRack];
            result.placements.forEach((p: Placement) => {
              const idx = newBotRack.indexOf(p.char);
              if (idx > -1) newBotRack.splice(idx, 1);
            });
            const drawn = game.tileBag.slice(0, result.placements.length);
            game.setTileBag((prev: string[]) => prev.slice(result.placements.length));
            game.setBotRack([...newBotRack, ...drawn]);

            const allWords = botWordsInfo.map(i => i.word).join(", ");
            alert(`🤖 บอทลงคำว่า: ${allWords}\nได้แต้ม: ${finalScore}`);
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
    if (game.currentPlayer !== playerRole) return;
    const isMain = r % 2 !== 0;

    if (isMain) {
      if (game.selectedRackIndex !== null && !game.grid[r][c]) {
        const char = game.p1Rack[game.selectedRackIndex];
        if (char === '0') game.setBlankMenu({ r, c });
        else game.placeTile(r, c, char, false);
        game.setP1Rack(prev => prev.filter((_, i) => i !== game.selectedRackIndex));
        game.setSelectedRackIndex(null);
      }
    } else game.setDiacriticMenu({ r, c });
  };

  const handleSubmit = async () => {
    if (game.turnHistory.length === 0) return;
    const touchesStar = game.turnHistory.some(h => h.r === 15 && h.c === 7);
    if (game.turnCount === 0 && !touchesStar) return alert("ตาแรกต้องทับดาว!");

    const wordsInfo = findValidWords(game.grid, game.turnHistory);
    if (wordsInfo.length === 0) return alert("การวางไม่ทำให้เกิดคำ!");

    try {
      let turnTotal = 0;
      let validCoords = new Set<string>();
      let validatedWords: string[] = [];
      let hasInvalid = false;

      for (const info of wordsInfo) {
        const res = await fetch('/api/check-word', { method: 'POST', body: JSON.stringify({ word: info.word }) });
        const data = await res.json();
        if (data.valid) {
          turnTotal += info.word.split('').reduce((s, c) => s + (LETTER_SCORES[c] || 0), 0);
          info.coords.forEach(coord => validCoords.add(coord));
          validatedWords.push(info.word);
        } else {
          alert(`ไม่พบคำว่า "${info.word}"`);
          hasInvalid = true;
          break;
        }
      }

      if (!hasInvalid && validatedWords.length > 0) {
        const bingoBonus = calculateBingoBonus(game.turnHistory.length);
        const totalScore = turnTotal + bingoBonus;

        const finalGrid = Array(31).fill(null).map(() => Array(15).fill(null));
        const finalBlanks = new Set<string>();
        validCoords.forEach(coord => {
          const [r, c] = coord.split(',').map(Number);
          if (game.grid[r][c]) {
            finalGrid[r][c] = game.grid[r][c];
            if (game.blankTiles.has(coord)) finalBlanks.add(coord);
          }
        });

        const newScores = { ...game.scores };
        if (playerRole === 1) newScores.p1 += totalScore; else newScores.p2 += totalScore;

        game.setGrid(finalGrid);
        game.setScores(newScores);
        game.setBlankTiles(finalBlanks);
        
        const numUsed = game.turnHistory.length;
        game.setP1Rack([...game.p1Rack, ...game.tileBag.slice(0, numUsed)]);
        game.setTileBag((prev: string[]) => prev.slice(numUsed));
        
        game.setTurnHistory([]);
        game.setTurnCount((prev: number) => prev + 1);

        alert(`✅ ${validatedWords.join(', ')} : ${totalScore} คะแนน`);

        if (mode === 'MULTI' && roomInfo) {
          await fetch('/api/multiplayer/move', {
            method: 'POST',
            body: JSON.stringify({
              roomId: roomInfo.id,
              newGrid: finalGrid,
              newScores: newScores,
              senderRole: playerRole,
              words: validatedWords,
              nextTurn: playerRole === 1 ? 2 : 1
            })
          });
        }
        game.setCurrentPlayer(mode === 'SOLO' ? 2 : (playerRole === 1 ? 2 : 1));
      }
    } catch (e) {
      alert("ระบบขัดข้อง");
    }
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