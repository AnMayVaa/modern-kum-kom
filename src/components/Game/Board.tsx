'use client';
import { useState, useEffect, useRef } from 'react';
import { 
  BOARD_LAYOUT, 
  LETTER_SCORES, 
  INITIAL_LETTER_QUANTITIES, 
  FREE_DIACRITICS, 
  THAI_CONSONANTS 
} from '@/lib/constants';
import { getCluster, findValidWords } from '@/lib/gameLogic';
import { runBotTurn } from '@/lib/botLogic';
import Pusher from 'pusher-js';

interface BoardProps {
  mode: 'SOLO' | 'MULTI';
  onBack: () => void;
}

export default function Board({ mode, roomInfo, onBack }: any) {
  // --- STATE ---
  const [grid, setGrid] = useState<(string | null)[][]>(Array(31).fill(null).map(() => Array(15).fill(null)));
  const [p1Rack, setP1Rack] = useState<string[]>([]);
  const [botRack, setBotRack] = useState<string[]>([]);
  const [tileBag, setTileBag] = useState<string[]>([]);
  const [turnCount, setTurnCount] = useState(0);
  const [currentPlayer, setCurrentPlayer] = useState(roomInfo?.starter || 1);
  const [scores, setScores] = useState({ p1: 0, p2: 0 });
  const [blankTiles, setBlankTiles] = useState<Set<string>>(new Set());
  const [turnHistory, setTurnHistory] = useState<{ r: number, c: number, char: string, isBlank: boolean }[]>([]);

  // UI States
  const [selectedRackIndex, setSelectedRackIndex] = useState<number | null>(null);
  const [showBotRack, setShowBotRack] = useState(false);
  const [blankMenu, setBlankMenu] = useState<{ r: number, c: number } | null>(null);
  const [diacriticMenu, setDiacriticMenu] = useState<{ r: number, c: number } | null>(null);

  const [playerRole, setPlayerRole] = useState<1 | 2>(roomInfo?.role || 1);
  const [isOpponentLeft, setIsOpponentLeft] = useState(false); // เช็คว่าคู่แข่งออกไหม

  // --- ระบบ Real-time Multiplayer ---
  const hasAlertedExit = useRef(false);

  useEffect(() => {
    if (mode === 'MULTI' && roomInfo?.id) {
      // 1. เริ่มต้นการเชื่อมต่อ Pusher
      const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, { 
        cluster: 'ap1',
        forceTLS: true 
      });
      const channel = pusher.subscribe(`room-${roomInfo.id}`);

      // 2. ดักฟังคนออกเกม (Opponent Left)
      channel.bind('opponent-disconnected', (data: any) => {
        console.log("ได้รับสัญญาณแจ้งคนออกเกม:", data);
        
        // ตรวจสอบว่าคนออกไม่ใช่ตัวเราเอง
        if (Number(data.role) !== Number(playerRole)) {
          if (!hasAlertedExit.current) {
            hasAlertedExit.current = true;
            // ✅ สั่งแค่เปลี่ยน State เพื่อโชว์ Victory Modal
            // ❌ ห้ามใส่ window.location.reload() หรือ onBack() ในบล็อกนี้เด็ดขาด
            setIsOpponentLeft(true); 
            console.log("เปิดหน้าจอ Victory Modal สำเร็จ");
          }
        }
      });

      // 3. ดักฟังเมื่อเพื่อนลงเบี้ย (Move Sync)
      channel.bind('move-made', (data: any) => {
        if (Number(data.senderRole) !== Number(playerRole)) {
          setGrid(data.newGrid);
          setScores(data.newScores);
          setCurrentPlayer(Number(data.nextTurn));
          // เพิ่ม turnCount เพื่อให้ P2 รู้ว่าตาแรกผ่านไปแล้ว
          setTurnCount(prev => prev + 1); 
          console.log("อัปเดตกระดานจากเพื่อนสำเร็จ");
        }
      });

      // 4. ระบบแจ้งเตือนเมื่อเราเป็นฝ่ายปิดหน้าจอเอง (Beacon API)
      const handleUnload = () => {
        // แจ้งให้เพื่อนรู้ว่าเราออกแล้ว
        if (!hasAlertedExit.current && mode === 'MULTI') {
          navigator.sendBeacon('/api/multiplayer/match', JSON.stringify({
            action: 'player_left',
            roomId: roomInfo.id,
            role: playerRole
          }));
        }
      };

      window.addEventListener('beforeunload', handleUnload);

      // 5. Cleanup เมื่อปิด Component หรือจบเกม
      return () => {
        window.removeEventListener('beforeunload', handleUnload);
        channel.unbind_all();
        pusher.unsubscribe(`room-${roomInfo.id}`);
        pusher.disconnect();
      };
    }
  }, [roomInfo?.id, playerRole]); // Dependency ที่จำเป็นเพื่อให้ Listener ทันสมัยเสมอ

  // --- INITIALIZATION ---
  useEffect(() => {
    const bag: string[] = [];
    Object.entries(INITIAL_LETTER_QUANTITIES).forEach(([char, qty]) => {
      for (let i = 0; i < qty; i++) bag.push(char);
    });
    const shuffled = bag.sort(() => Math.random() - 0.5);
    setP1Rack(shuffled.splice(0, 9));
    if (mode === 'SOLO') setBotRack(shuffled.splice(0, 9));
    setTileBag(shuffled);
  }, [mode]);

  // --- BOT EXECUTION LOGIC (FIXED: No Infinite Loop) ---
  useEffect(() => {
    // ล็อคให้ทำงานเฉพาะเมื่อเป็นเทิร์นบอท และ Turn Count เปลี่ยนเท่านั้น
    if (mode === 'SOLO' && currentPlayer === 2) {
      const handleBot = async () => {
        try {
          // 1. เรียกใช้บอทหาคำ (เช็คพจนานุกรมในตัว botLogic)
          const result = await runBotTurn(grid, botRack, async (word) => {
            const res = await fetch('/api/check-word', { method: 'POST', body: JSON.stringify({ word }) });
            const data = await res.json();
            return data.valid;
          });

          if (result && result.placements.length > 0) {
            // 2. จำลองการวางเบี้ยเพื่อหาพิกัดคำที่จะ "เก็บไว้"
            const tempGrid = grid.map(row => [...row]);
            result.placements.forEach(p => { tempGrid[p.r][p.c] = p.char; });

            // สแกนหาคำที่สมบูรณ์ (เช่น "กบ") เพื่อเอาพิกัดมาทำ Cleanup
            const botWordsInfo = findValidWords(tempGrid, result.placements);
            let botValidCoords = new Set<string>();
            let botTurnScore = 0;

            botWordsInfo.forEach(info => {
              botTurnScore += info.word.split('').reduce((s, c) => s + (LETTER_SCORES[c] || 0), 0);
              info.coords.forEach(coord => botValidCoords.add(coord));
            });

            // 3. --- SURGICAL CLEANUP ---
            // สร้างกระดานใหม่ที่เก็บเฉพาะตัวอักษรในคำที่บอททำได้ (คำเก่าที่เหลือจะหายไป)
            const cleanedGrid = Array(31).fill(null).map(() => Array(15).fill(null));
            botValidCoords.forEach(coord => {
              const [r, c] = coord.split(',').map(Number);
              cleanedGrid[r][c] = tempGrid[r][c];
            });

            // 4. อัปเดต State ทุกอย่างพร้อมกัน (ลดจำนวนการ Render)
            setGrid(cleanedGrid);
            setScores(prev => ({ ...prev, p2: prev.p2 + botTurnScore }));
            
            // จั่วเบี้ยใหม่ให้บอท
            const newBotRack = [...botRack];
            result.placements.forEach(p => {
              const idx = newBotRack.indexOf(p.char);
              if (idx > -1) newBotRack.splice(idx, 1);
            });
            setBotRack([...newBotRack, ...tileBag.splice(0, result.placements.length)]);
            
            alert(`บอทลงคำว่า: ${result.word} ได้ ${botTurnScore} คะแนน`);
          } else {
            alert("บอทไม่มีคำที่จะลงได้ในตานี้... บอทขอผ่าน");
          }
        } catch (err) {
          console.error("Bot Error:", err);
        } finally {
          // เปลี่ยนกลับเป็น Player 1 และเพิ่ม Turn Count เพื่อจบกระบวนการ
          setCurrentPlayer(1);
          setTurnCount(prev => prev + 1);
        }
      };

      const timer = setTimeout(handleBot, 1500); // หน่วงเวลาให้ดูเหมือนบอทคิด
      return () => clearTimeout(timer);
    }
  }, [currentPlayer, mode]); // ตัด grid ออกจาก dependencies เพื่อไม่ให้เกิด loop

  // --- ACTIONS ---
  const handleCellClick = (r: number, c: number) => {
    // 1. ตรวจสอบว่าเป็นตาของคุณหรือไม่ (รองรับทั้ง P1 และ P2)
    const isMyTurn = Number(currentPlayer) === Number(playerRole);
    
    // ถ้าไม่ใช่ตาเรา หรือเป็นตาบอท (ในโหมด SOLO) ให้ล็อคไว้
    if (mode === 'MULTI' && !isMyTurn) {
      console.log("ยังไม่ใช่ตาของคุณ!");
      return;
    }
    
    // ล็อคตาบอทในโหมด SOLO เท่านั้น
    if (mode === 'SOLO' && currentPlayer !== 1) return;

    const isMain = r % 2 !== 0; // แถวพยัญชนะหลัก

    if (isMain) {
      // วางพยัญชนะ
      if (selectedRackIndex !== null && !grid[r][c]) {
        const char = p1Rack[selectedRackIndex];
        
        if (char === '0') {
          // ถ้าเป็นเบี้ยว่าง ให้เปิดเมนูเลือกตัวอักษร
          setBlankMenu({ r, c });
        } else {
          // ส่ง 4 อาร์กิวเมนต์: r, c, ตัวอักษร, isBlank(false)
          placeTile(r, c, char, false);
        }

        // หักเบี้ยออกจากมือและล้างการเลือก
        setP1Rack(p1Rack.filter((_, i) => i !== selectedRackIndex));
        setSelectedRackIndex(null);
      }
    } else {
      // แถวรางสระ: เปิดเมนูเลือกสระ/วรรณยุกต์
      // ตรวจสอบว่าต้องมีพยัญชนะในช่องหลักก่อนถึงจะวางสระได้ (Option)
      setDiacriticMenu({ r, c });
    }
  };

  const placeTile = (r: number, c: number, char: string, isBlank: boolean) => {
    const nextGrid = [...grid];
    nextGrid[r][c] = char;
    setGrid(nextGrid);
    setTurnHistory([...turnHistory, { r, c, char, isBlank }]);
    if (isBlank) setBlankTiles(new Set(blankTiles).add(`${r},${c}`));
  };

  const handleRecall = () => {
    const nextRack = [...p1Rack];
    const nextGrid = [...grid];
    const nextBlanks = new Set(blankTiles);
    turnHistory.forEach(h => {
      if (!FREE_DIACRITICS.includes(h.char)) nextRack.push(h.isBlank ? '0' : h.char);
      nextGrid[h.r][h.c] = null;
      nextBlanks.delete(`${h.r},${h.c}`);
    });
    setGrid(nextGrid); setP1Rack(nextRack); setTurnHistory([]); setBlankTiles(nextBlanks);
  };

  const handleSubmit = async () => {
  if (turnHistory.length === 0) return;

  // 1. ตรวจสอบเงื่อนไขตาแรก: ต้องวางทับจุดดาว (STAR) พิกัดแถว 15 คอลัมน์ 7
  const touchesStar = turnHistory.some(h => h.r === 15 && h.c === 7);
  if (turnCount === 0 && !touchesStar) {
    return alert("ตาแรกต้องวางทับจุดดาวกึ่งกลางกระดาน!");
  }

  // 2. ตรวจสอบการวางติดเบี้ยเดิม (Adjacency Rule): ยกเว้นตาแรก
  if (turnCount > 0) {
    const isAdjacent = turnHistory.some(h => 
      (h.r > 1 && grid[h.r - 2][h.c]) || (h.r < 29 && grid[h.r + 2][h.c]) ||
      (h.c > 0 && grid[h.r][h.c - 1]) || (h.c < 14 && grid[h.r][h.c + 1])
    );
    if (!isAdjacent) return alert("ต้องวางต่อจากเบี้ยที่มีอยู่บนกระดานเท่านั้น!");
  }

  // 3. สแกนหาคำทั้งหมดที่เกิดขึ้นในแนวตั้งและแนวนอน
  const wordsInfo = findValidWords(grid, turnHistory);
  if (wordsInfo.length === 0) return alert("การวางเบี้ยไม่ทำให้เกิดคำที่ถูกต้อง!");

  try {
    let turnTotal = 0; 
    let validCoords = new Set<string>(); 
    let validatedWords: string[] = [];
    let hasInvalidWord = false;

    // 4. ตรวจสอบคำศัพท์กับ API
    for (const info of wordsInfo) {
      const res = await fetch('/api/check-word', { 
        method: 'POST', 
        body: JSON.stringify({ word: info.word }) 
      });
      const data = await res.json();
      
      if (data.valid) {
        // คำนวณคะแนนจากคลังคะแนน LETTER_SCORES
        const wordScore = info.word.split('').reduce((s, c) => s + (LETTER_SCORES[c] || 0), 0);
        turnTotal += wordScore;
        info.coords.forEach(coord => validCoords.add(coord));
        validatedWords.push(info.word);
      } else { 
        alert(`คำว่า "${info.word}" ไม่มีในพจนานุกรม!`); 
        hasInvalidWord = true;
        break; 
      }
    }

    // 5. เมื่อทุกคำถูกต้อง: ดำเนินการ Cleanup และอัปเดตสถานะเกม
    if (!hasInvalidWord && validatedWords.length > 0) {
      // สร้าง Grid ใหม่ที่เก็บเฉพาะเบี้ยที่ได้คะแนน (ล้างตัวอักษรที่ไม่ได้เชื่อมโยงทิ้ง)
      const finalGrid = Array(31).fill(null).map(() => Array(15).fill(null));
      const finalBlanks = new Set<string>();
      
      validCoords.forEach(coord => {
        const [r, c] = coord.split(',').map(Number);
        if (grid[r][c]) {
          finalGrid[r][c] = grid[r][c];
          if (blankTiles.has(coord)) finalBlanks.add(coord);
        }
      });

      // คำนวณคะแนนใหม่ของผู้เล่นปัจจุบัน
      const newScores = { ...scores };
      if (playerRole === 1) newScores.p1 += turnTotal;
      else newScores.p2 += turnTotal;

      // อัปเดต State ภายในเครื่อง
      setGrid(finalGrid);
      setBlankTiles(finalBlanks);
      setScores(newScores);
      setP1Rack([...p1Rack, ...tileBag.splice(0, 9 - p1Rack.length)]); // จั่วเบี้ยใหม่
      setTurnHistory([]);
      setTurnCount(prev => prev + 1);

      alert(`สำเร็จ! คำที่ได้: ${validatedWords.join(', ')} (+${turnTotal} คะแนน)`);

      // 6. กรณีเล่น Multiplayer: ส่งข้อมูลข้ามห้องผ่าน Pusher
      if (mode === 'MULTI' && roomInfo) {
      const nextTurn = playerRole === 1 ? 2 : 1; // คำนวณว่าตาต่อไปเป็นของใคร
      
      await fetch('/api/multiplayer/move', {
        method: 'POST',
        body: JSON.stringify({
          roomId: roomInfo.id,
          newGrid: finalGrid,
          newScores: newScores,
          senderRole: playerRole,
          words: validatedWords,
          nextTurn: nextTurn // ส่งค่านี้ไปด้วย!
        })
      });
    }
    
    // สลับเทิร์น (P1 ไป P2 หรือ P2 ไป P1)
    setCurrentPlayer(mode === 'SOLO' ? 2 : (playerRole === 1 ? 2 : 1));
  }
    } catch (e) {
      alert("ระบบตรวจสอบคำศัพท์ขัดข้อง");
    }
  };

  return (
  <div className="flex flex-col items-center gap-4 p-4 bg-slate-50 min-h-screen font-sans selection:bg-indigo-100">
    {/* --- 1. HEADER: ข้อมูลผู้เล่น, คะแนน และห้อง --- */}
    <div className="bg-white p-4 rounded-3xl shadow-sm w-full max-w-2xl flex justify-between items-center border-b-4 border-indigo-500 relative overflow-hidden">
      <button onClick={onBack} className="text-slate-400 font-bold hover:text-rose-500 transition-colors z-10">
        <span className="text-lg">←</span> MENU
      </button>
      
      <div className="text-center z-10">
        <div className="inline-flex items-center gap-2 mb-1">
          <span className={`w-2 h-2 rounded-full animate-ping ${currentPlayer === playerRole ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          <p className={`text-[11px] font-black uppercase tracking-[0.2em] ${currentPlayer === playerRole ? 'text-emerald-600' : 'text-rose-600'}`}>
            {currentPlayer === playerRole 
              ? "Your Turn" 
              : (mode === 'SOLO' ? "🤖 Bot Thinking..." : "⌛ Waiting for Opponent...")}
          </p>
        </div>
        <div className="flex gap-8 items-center justify-center">
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-slate-400 font-bold">YOU (P1)</span>
            <span className="text-3xl font-black text-slate-800">{scores.p1}</span>
          </div>
          <div className="w-px h-8 bg-slate-100" />
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase">{mode === 'SOLO' ? 'Bot' : 'Opponent (P2)'}</span>
            <span className="text-3xl font-black text-slate-800">{scores.p2}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 z-10">
        {mode === 'MULTI' && roomInfo && (
          <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black border border-indigo-100">
            ROOM: {roomInfo.id}
          </span>
        )}
        <div className="flex flex-col items-end">
          <span className="text-[9px] text-slate-400 font-bold uppercase">Bag Left</span>
          <span className="text-lg font-black text-slate-600 leading-none">{tileBag.length}</span>
        </div>
      </div>
      
      {/* Background Decor */}
      <div className="absolute -right-4 -top-4 w-16 h-16 bg-indigo-50 rounded-full opacity-50" />
    </div>

    {/* --- 2. GAME BOARD: กระดาน 31 แถว (ฉบับปรับปรุงการจัดวาง) --- */}
    <div className={`bg-slate-800 p-1 rounded-2xl shadow-2xl border-4 border-slate-700 overflow-hidden transition-all duration-500
      ${(mode === 'MULTI' && Number(currentPlayer) !== Number(playerRole)) 
        ? 'opacity-60 pointer-events-none grayscale-[0.5]' 
        : 'opacity-100 pointer-events-auto'}`}>
      {/* ใช้ gap ที่เล็กที่สุดเพื่อให้เบี้ยชิดกันสวยงาม */}
      <div className="grid grid-cols-15 gap-px bg-slate-700/50 border border-slate-700/50 rounded-xl overflow-hidden">
        {grid.map((row, r) => row.map((cell, c) => {
          const isMain = r % 2 !== 0;
          const isBlank = blankTiles.has(`${r},${c}`);
          return (
            <div key={`${r}-${c}`} onClick={() => handleCellClick(r, c)}
              // เพิ่ม leading-none เพื่อให้ตัวอักษรอยู่กึ่งกลางแนวตั้งเป๊ะๆ ไม่ตก
              className={`flex items-center justify-center cursor-pointer transition-all relative leading-none
              ${isMain ? 'w-8 h-8 sm:w-12 sm:h-12 text-2xl font-black' : 'w-8 h-4 sm:w-12 sm:h-6 text-xs'}
              ${cell ? (isBlank ? 'bg-cyan-100 text-blue-700 shadow-[inset_0_0_8px_rgba(0,188,212,0.5)] z-10' : 'bg-[#ffebbb] text-slate-900 border-b-[3px] border-[#e6c275] shadow-sm z-10 rounded-[2px]') : 
                isMain ? getCellColor(Math.floor(r/2), c) : 'bg-indigo-900/30 hover:bg-indigo-500/40'}`}>
              {/* ใช้ span เพื่อควบคุมการแสดงผลตัวอักษรให้คมชัด */}
              <span className={isMain && !cell ? 'opacity-50 scale-75 transform' : ''}>
                {cell || (isMain ? getCellText(Math.floor(r/2), c) : '')}
              </span>
            </div>
          );
        }))}
      </div>
    </div>

    {/* --- 3. BOT RACK: แถบเบี้ยบอท (Toggle) --- */}
    {showBotRack && (
      <div className="flex gap-2 p-3 bg-rose-50 rounded-2xl border-2 border-dashed border-rose-200 animate-in fade-in slide-in-from-bottom-2">
        <span className="text-[10px] font-black text-rose-400 uppercase self-center px-2">Bot's Hand:</span>
        {botRack.map((t, i) => (
          <div key={i} className="w-8 h-8 bg-white border border-rose-100 rounded-lg flex items-center justify-center text-sm text-rose-300 font-bold shadow-sm italic">
            {t === '0' ? ' ' : t}
          </div>
        ))}
      </div>
    )}

    {/* --- 4. PLAYER CONTROLS: มือผู้เล่นและปุ่มกดยืนยัน --- */}
    <div className={`bg-white p-10 rounded-[2.5rem] shadow-xl w-full max-w-2xl border-2 transition-all duration-300
      ${currentPlayer !== playerRole ? 'bg-slate-50 opacity-50' : 'border-indigo-100 shadow-indigo-100/50'}`}>
      
      <div className="flex flex-nowrap justify-center gap-1 sm:gap-2 mb-8 px-2 overflow-visible hidden-scrollbar">
        {p1Rack.map((tile, i) => (
          <button key={i} onClick={() => setSelectedRackIndex(i)}
            disabled={currentPlayer !== playerRole}
            className={`w-12 h-12 sm:w-16 sm:h-16 bg-amber-50 border-b-4 border-amber-400 rounded-2xl flex items-center justify-center text-3xl font-black text-slate-800 shadow-lg transition-all
              ${selectedRackIndex === i ? 'ring-4 ring-indigo-500 -translate-y-3 bg-indigo-50 border-indigo-300' : 'hover:-translate-y-1 active:scale-95'}`}>
            {tile === '0' ? ' ' : tile}
          </button>
        ))}
      </div>

      <div className="flex gap-4">
        <button onClick={handleRecall} disabled={currentPlayer !== playerRole}
          className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-2xl border-b-4 border-slate-300 active:border-0 active:translate-y-1 transition-all uppercase tracking-widest text-sm hover:bg-slate-200">
          Recall
        </button>
        <button onClick={handleSubmit} disabled={currentPlayer !== playerRole}
          className="flex-[2] py-4 bg-emerald-600 text-white font-black rounded-2xl border-b-4 border-emerald-800 active:border-0 active:translate-y-1 transition-all shadow-xl hover:bg-emerald-500 uppercase tracking-[0.3em] text-sm">
          Submit Move
        </button>
      </div>
    </div>

    {/* --- 5. MODALS: การเลือกเบี้ยว่างและสระ --- */}
    {(blankMenu || diacriticMenu) && (
      <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={() => {setBlankMenu(null); setDiacriticMenu(null);}}>
        <div className="bg-white p-8 rounded-[3rem] max-w-md w-full shadow-2xl border-t-8 border-indigo-600 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
          <h3 className="text-2xl font-black text-slate-800 mb-2 text-center">
            {blankMenu ? "Select Blank Tile" : "Choose Diacritic"}
          </h3>
          <p className="text-center text-slate-400 text-xs mb-8 uppercase font-bold tracking-widest">
            {blankMenu ? "Consonants Only" : "Vowels & Tonemarks"}
          </p>
          
          <div className="grid grid-cols-5 gap-3 max-h-[45vh] overflow-y-auto pr-2 custom-scrollbar">
            {(blankMenu ? THAI_CONSONANTS : FREE_DIACRITICS).map(char => (
              <button key={char} onClick={() => {
                const t = blankMenu || diacriticMenu!;
                placeTile(t.r, t.c, char, !!blankMenu);
                setBlankMenu(null); setDiacriticMenu(null);
              }} className="w-14 h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl text-2xl font-black text-slate-700 hover:bg-indigo-600 hover:text-white hover:scale-110 hover:shadow-lg transition-all">
                {char}
              </button>
            ))}
          </div>
          <button onClick={() => {setBlankMenu(null); setDiacriticMenu(null);}} className="mt-8 w-full py-4 text-slate-400 font-black hover:text-rose-500 transition-colors uppercase tracking-widest text-xs">
            Dismiss
          </button>
        </div>
      </div>
    )}
    {/* --- UI แจ้งเตือนผู้ชนะเมื่อคู่แข่งออกเกม --- */}
    {isOpponentLeft && (
      <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[999] flex items-center justify-center p-6 animate-in fade-in duration-300">
        <div className="bg-white p-12 rounded-[3.5rem] text-center shadow-2xl border-t-8 border-emerald-500 max-w-sm w-full animate-in zoom-in-95 duration-500">
          <div className="text-8xl mb-6">🏆</div>
          <h2 className="text-4xl font-black text-slate-800 mb-2 italic">YOU WIN!</h2>
          <p className="text-slate-500 font-bold mb-10 leading-relaxed">
            คู่แข่งออกจากห้องไปแล้ว <br/>
            ระบบตัดสินให้คุณเป็นฝ่ายชนะ!
          </p>
          <button 
            onClick={() => window.location.reload()} // บังคับให้โหลดใหม่เมื่อกดปุ่มเท่านั้น
            className="w-full py-5 bg-emerald-500 text-white rounded-3xl font-black text-xl shadow-lg shadow-emerald-200 hover:bg-emerald-400 active:scale-95 transition-all"
          >
            กลับหน้าหลัก
          </button>
        </div>
      </div>
    )}
  </div>
);
}

// --- HELPERS ---
const getCellColor = (r: number, c: number) => {
  const type = BOARD_LAYOUT[r]?.[c];
  switch (type) {
    case '3W': return 'bg-rose-500/80 text-white text-[10px] font-bold';
    case '2W': return 'bg-pink-400/80 text-white text-[10px] font-bold';
    case '4L': return 'bg-orange-500/80 text-white text-[10px] font-bold';
    case '3L': return 'bg-emerald-600/80 text-white text-[10px] font-bold';
    case '2L': return 'bg-sky-400/80 text-white text-[10px] font-bold';
    case 'STAR': return 'bg-pink-500 text-white shadow-inner animate-pulse';
    default: return 'bg-slate-800/20';
  }
};

const getCellText = (r: number, c: number) => {
  const type = BOARD_LAYOUT[r]?.[c];
  return type === 'STAR' ? '★' : type || '';
};