import { useEffect } from 'react';
import Pusher from 'pusher-js';
import { runBotTurn } from '@/lib/botLogic';
import { findValidWords, calculateBingoBonus } from '@/lib/gameLogic';
import { LETTER_SCORES, BOARD_LAYOUT } from '@/lib/constants';

export const useGameEffects = (game: any, mode: string, roomInfo: any, playerRole: number) => {
  // Multiplayer Sync
  useEffect(() => {
    if (mode !== 'MULTI' || !roomInfo?.id) return;
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, { cluster: 'ap1' });
    const channel = pusher.subscribe(`room-${roomInfo.id}`);

    channel.bind('game-updated', (data: any) => {
      if (data.role !== playerRole) {
        game.setGrid(data.gameData.grid);
        game.setCurrentPlayer(data.gameData.currentPlayer);
        game.setTileBag(data.gameData.tileBag);
        game.setScores(data.gameData.scores);
      }
    });

    return () => { channel.unbind_all(); pusher.unsubscribe(`room-${roomInfo.id}`); };
  }, [roomInfo?.id, mode, playerRole, game]);

  // Bot AI Logic
  useEffect(() => {
    if (mode === 'SOLO' && game.currentPlayer === 2) {
      const handleBot = async () => {
        try {
          const result = await runBotTurn(game.grid, game.botRack, async (word) => {
            const res = await fetch('/api/check-word', { method: 'POST', body: JSON.stringify({ word }) });
            const data = await res.json(); return data.valid;
          });

          if (result && result.placements.length > 0) {
            const tempGrid = game.grid.map((row: any) => [...row]);
            result.placements.forEach((p: any) => { tempGrid[p.r][p.c] = p.char; });
            const botWords = findValidWords(tempGrid, result.placements);
            const botTurnCoords = new Set(result.placements.map((p: any) => `${p.r},${p.c}`));
            const validCoords = new Set<string>();
            let botTotal = 0; let botLog: string[] = [];

            botWords.forEach(info => {
              let pts = 0; let mult = 1; let math: string[] = [];
              info.coords.forEach((c: string) => validCoords.add(c));
              info.coords.forEach((coord: string) => {
                const [r, c] = coord.split(',').map(Number);
                const char = tempGrid[r][c] || "";
                const base = LETTER_SCORES[char] || 0;
                if (base > 0 || r % 2 !== 0) {
                  let charPts = base; let s = `${base}`;
                  if (botTurnCoords.has(coord)) {
                    const b = BOARD_LAYOUT[(r - 1) / 2][c];
                    if (b === '2L') { charPts *= 2; s += 'x2'; } else if (b === '3L') { charPts *= 3; s += 'x3'; }
                    else if (b === '4L') { charPts *= 4; s += 'x4'; } else if (b === '2W' || b === 'STAR') mult *= 2;
                    else if (b === '3W') mult *= 3;
                  }
                  pts += charPts; math.push(s);
                }
              });
              botTotal += (pts * mult);
              botLog.push(`${info.word}: (${math.join(' + ')})${mult > 1 ? ` x${mult}` : ''} = ${pts * mult}`);
            });

            const cleanedGrid = tempGrid.map((row: any, r: number) => row.map((char: any, c: number) => validCoords.has(`${r},${c}`) ? char : null));
            const bingo = calculateBingoBonus(result.placements.length);
            alert(`🤖 บอทลงคำ: ${botWords.map(i => i.word).join(', ')}\n` + botLog.join('\n') + (bingo > 0 ? `\n+ BINGO: 50` : '') + `\nรวม: ${botTotal + bingo} คะแนน`);

            game.setGrid(cleanedGrid);
            game.setScores((prev: any) => ({ ...prev, p2: prev.p2 + botTotal + bingo }));
            const newRack = [...game.botRack];
            result.placements.forEach((p: any) => { const i = newRack.indexOf(p.char); if (i > -1) newRack.splice(i, 1); });
            const drawn = game.tileBag.slice(0, result.placements.length);
            game.setTileBag((prev: string[]) => prev.slice(result.placements.length));
            game.setBotRack([...newRack, ...drawn]);
          } else alert("บอทไม่มีคำศัพท์... ขอผ่าน");
        } catch (err) { console.error("Bot Error:", err); }
        finally { game.setCurrentPlayer(1); game.setTurnCount((p: number) => p + 1); }
      };
      const timer = setTimeout(handleBot, 1500);
      return () => clearTimeout(timer);
    }
  }, [game.currentPlayer, mode, game]);
};