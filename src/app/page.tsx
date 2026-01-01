'use client';
import { useState, useEffect } from 'react';
import Board from '@/components/Game/Board';
import Pusher from 'pusher-js';
import { signIn, useSession } from 'next-auth/react';

import { INITIAL_LETTER_QUANTITIES } from '@/lib/constants';

type ViewState = 'IDENTITY' | 'MENU' | 'SOLO' | 'MULTI_LOBBY' | 'SEARCHING' | 'ROOM_CREATED' | 'GAME';

export default function Home() {
  const { data: session } = useSession();
  const [view, setView] = useState<ViewState>('IDENTITY'); 
  const [playerName, setPlayerName] = useState('');
  const [opponentName, setOpponentName] = useState('Opponent');

  // --- States ดั้งเดิมของคุณ (ใช้งานได้ปกติ) ---
  const [roomData, setRoomData] = useState<{ id: string; role: 1 | 2; starter: 1 | 2 } | null>(null);
  const [inputRoom, setInputRoom] = useState('');
  const [generatedRoomId, setGeneratedRoomId] = useState('');
  const [isMyReady, setIsMyReady] = useState(false);
  const [isOpponentReady, setIsOpponentReady] = useState(false);
  const [showMatchPopup, setShowMatchPopup] = useState(false);

  const [initialGameData, setInitialGameData] = useState<any>(null);

  // 💡 1. ฟังก์ชันสุ่มเบี้ย (เฉพาะ P1 เป็นคนทำ)
  const generateInitialData = () => {
    const bag: string[] = [];
    Object.entries(INITIAL_LETTER_QUANTITIES).forEach(([char, qty]) => {
      for (let i = 0; i < qty; i++) bag.push(char);
    });
    const shuffled = bag.sort(() => Math.random() - 0.5);
    return {
      tileBag: shuffled.slice(18),   // เบี้ยที่เหลือในถุง
      p1Rack: shuffled.slice(0, 9),  // เบี้ย P1
      p2Rack: shuffled.slice(9, 18), // เบี้ย P2
      starter: Math.random() > 0.5 ? 1 : 2
    };
  };

  // --- [LOGIC] จัดการชื่อผู้เล่น (Identity) ---
  useEffect(() => {
    // 1. ถ้า Login ผ่าน Google ให้ใช้ชื่อนั้นทันที
    if (session?.user?.name) {
      setPlayerName(session.user.name);
      setView('MENU');
    } 
    // 2. ถ้าเป็น Guest ให้เช็คว่าเคยกรอกชื่อทิ้งไว้ในเครื่องไหม
    else {
      const savedName = localStorage.getItem('kumkom_name');
      if (savedName) {
        setPlayerName(savedName);
        setView('MENU'); // ถ้ามีชื่อแล้ว ข้ามหน้า Identity ไปหน้า Menu เลย
      }
    }
  }, [session]);

  const handleSaveName = () => {
    if (!playerName.trim()) return alert("กรุณาใส่ชื่อก่อนครับ");
    localStorage.setItem('kumkom_name', playerName); // เซฟชื่อลงเครื่องถาวร
    setView('MENU');
  };

  // --- [SYSTEM] ระบบ Sync ข้อมูล Lobby (โค้ดเดิมของคุณ) ---
  useEffect(() => {
    if (!roomData?.id || view === 'GAME') return;
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, { cluster: 'ap1' });
    const channel = pusher.subscribe(`room-${roomData.id}`);

    const onMatch = (data: { starter: 1 | 2 }) => {
      setRoomData(prev => prev ? { ...prev, starter: data.starter } : null);
      setShowMatchPopup(true);
    };
    channel.bind('match-found', onMatch);
    channel.bind('player-joined', onMatch);

    // แก้ไข: รับชื่อคู่แข่งผ่าน Pusher
    channel.bind('player-ready', (data: any) => {
      if (data.role !== roomData.role) {
        setIsOpponentReady(data.playerReady);
        if (data.name) setOpponentName(data.name);
        
        // 💡 ถ้าเราเป็น P2 ให้เก็บข้อมูลเบี้ยที่ P1 ส่งมา
        if (roomData.role === 2 && data.gameSetup) {
          setInitialGameData(data.gameSetup);
        }
      }
    });

    // เพิ่มการดักฟังเมื่อคู่แข่งออกจากห้อง
    channel.bind('player-left', (data: { role: number }) => {
      alert("คู่แข่งออกจากห้องแล้ว");
      setIsOpponentReady(false);
      setShowMatchPopup(false);
      setRoomData(null);
      if (view !== 'MENU') setView('MULTI_LOBBY'); // เด้งกลับไปหน้า Lobby
    });

  return () => { 
    channel.unbind_all(); 
    pusher.unsubscribe(`room-${roomData.id}`); 
    pusher.disconnect(); 
  };

  }, [roomData?.id, view]);

  // 2. ตรวจสอบสถานะการเข้าเกม
  useEffect(() => {
    if (roomData?.id && view !== 'GAME') {
      const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, { cluster: 'ap1' });
      const channel = pusher.subscribe(`room-${roomData.id}`);

      // ในฟังก์ชัน notify_ready_to_pair (ฝั่ง P2)
      pusher.connection.bind('connected', async () => {
        if (roomData.role === 2) {
          await fetch('/api/multiplayer/match', {
            method: 'POST',
            body: JSON.stringify({ action: 'notify_ready_to_pair', roomId: roomData.id, name: playerName }) // 💡 ส่งชื่อ P2 ไป
          });
        }
      });

      // ใน useEffect ที่ดักฟัง Pusher (ส่วน Lobby)
      channel.bind('match-connected', (data: any) => {
        if (roomData.role === 1) {
          setRoomData(prev => prev ? { ...prev, starter: data.starter } : null);
          if (data.opponentName) setOpponentName(data.opponentName); // 💡 P1 เห็นชื่อ P2 ทันที
          setShowMatchPopup(true);
        }
      });

      return () => { channel.unbind_all(); pusher.unsubscribe(`room-${roomData.id}`); pusher.disconnect(); };
    }
  }, [roomData?.id, view]);

  // --- [ACTIONS] ฟังก์ชันต่างๆ (เพิ่มการส่งชื่อ) ---

  const handleRandomMatch = async () => {
    setView('SEARCHING');
    const res = await fetch('/api/multiplayer/match', { 
      method: 'POST', 
      body: JSON.stringify({ action: 'find_match', name: playerName }) // 💡 ส่งชื่อไปด้วย
    });
    const data = await res.json();
    setRoomData({ id: data.roomId, role: data.role, starter: 1 });
    if (data.role === 2) {
      if (data.opponentName) setOpponentName(data.opponentName); // 💡 P2 เห็นชื่อ P1 ทันที
      setShowMatchPopup(true);
    }
  };

  const handleCreateRoom = async () => {
    const newId = Math.floor(100000 + Math.random() * 900000).toString();
    await fetch('/api/rooms', { method: 'POST', body: JSON.stringify({ action: 'create', roomId: newId }) });
    setGeneratedRoomId(newId);
    setRoomData({ id: newId, role: 1, starter: 1 });
    setView('ROOM_CREATED');
  };

  const handleJoinRoom = async () => {
    if (inputRoom.length < 4) return alert("รหัสไม่ถูกต้อง");
    try {
      const res = await fetch('/api/rooms', { method: 'POST', body: JSON.stringify({ action: 'check', roomId: inputRoom }) });
      const data = await res.json();
      if (data.exists) {
        setIsMyReady(false); setIsOpponentReady(false);
        setRoomData({ id: inputRoom, role: 2, starter: 1 });
        setShowMatchPopup(true);
      } else { alert("❌ ไม่พบเลขห้องนี้"); }
    } catch (e) { alert("การเชื่อมต่อล้มเหลว"); }
  };

  // 💡 2. แก้ไข handleSetReady
  const handleSetReady = async () => {
    if (!roomData) return;
    setIsMyReady(true);

    let setupData = null;
    if (roomData.role === 1) {
      setupData = generateInitialData();
      setInitialGameData(setupData); // P1 เซฟไว้ในเครื่องตัวเองด้วย
    }

    await fetch('/api/multiplayer/match', {
      method: 'POST',
      body: JSON.stringify({ 
        action: 'set_ready', 
        roomId: roomData.id, 
        role: roomData.role, 
        playerReady: true, 
        name: playerName,
        gameSetup: setupData // P1 ส่งก้อนเบี้ยไปให้ P2
      })
    });
  };

  useEffect(() => {
    if (isMyReady && isOpponentReady) {
      setTimeout(() => setView('GAME'), 1000);
    }
  }, [isMyReady, isOpponentReady]);

  const handleBackToMenu = async () => {
    if (roomData?.id && roomData.id !== 'SOLO') {
      // 1. แจ้งเตือนคู่แข่งผ่าน API ว่าเราออกจากห้องแล้ว
      try {
        await fetch('/api/multiplayer/match', {
          method: 'POST',
          body: JSON.stringify({ 
            action: 'leave_room', 
            roomId: roomData.id, 
            role: roomData.role 
          })
        });
      } catch (e) {
        console.error("Error leaving room:", e);
      }
    }

    // 2. ล้างสถานะทั้งหมดในเครื่องเราเพื่อป้องกันการเด้งกลับหน้าเดิม
    setRoomData(null);
    setIsMyReady(false);
    setIsOpponentReady(false);
    setShowMatchPopup(false);
    setOpponentName('Opponent');
    setView('MENU'); // กลับไปหน้าเลือกโหมด (BOT/Multi)
  };

  // --- [RENDER] ---

  // หน้าด่านแรก:Identity (แสดงเฉพาะครั้งแรกที่ยังไม่มีชื่อ)
  if (view === 'IDENTITY') {
    return (
      <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-900 font-sans">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl w-full max-w-md border-t-8 border-indigo-600 text-center">
          <h1 className="text-5xl font-black text-slate-800 mb-2 italic">KUM-KOM</h1>
          <p className="text-slate-400 mb-8 uppercase text-[10px] font-bold tracking-widest">Identify Yourself</p>
          <input type="text" placeholder="ชื่อเล่นของคุณ..." value={playerName} onChange={(e) => setPlayerName(e.target.value)}
            className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-center font-bold focus:border-indigo-500 outline-none text-slate-800" />
          <button onClick={handleSaveName} className="w-full mt-4 py-4 bg-slate-800 text-white rounded-2xl font-black">เล่นแบบ Guest</button>
          <div className="relative my-6"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div><span className="relative bg-white px-4 text-[10px] text-slate-300 font-bold uppercase tracking-widest">หรือ</span></div>
          <button onClick={() => signIn('google')} className="w-full py-4 border-2 border-slate-100 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50">Sign in with Google</button>
        </div>
      </main>
    );
  }

  // ส่วนการ Render หน้า GAME
  if (view === 'GAME') {
    const isSolo = roomData?.id === 'SOLO';
    
    // 🛡️ ดัก P2: ถ้ายังไม่มีข้อมูลเบี้ยจาก P1 ห้ามเข้าหน้า Board (ป้องกัน BAG 0)
    if (!isSolo && !initialGameData) {
      return <div className="min-h-screen flex items-center justify-center">กำลังซิงค์ข้อมูลเบี้ย...</div>;
    }

    return (
      <Board 
        mode={isSolo ? 'SOLO' : 'MULTI'} 
        roomInfo={roomData} 
        playerName={playerName} 
        opponentName={opponentName} 
        initialData={initialGameData} // 💡 ส่งข้อมูลนี้เข้า Board
        onBack={handleBackToMenu} 
      />
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-800 font-sans">
      {view === 'MENU' && (
        <div className="flex flex-col items-center">
          <h1 className="text-7xl font-black text-indigo-600 mb-12 italic">KUM-KOM</h1>
          <div className="flex flex-col gap-4 w-full max-w-xs">
            <button onClick={() => { setRoomData({ id: 'SOLO', role: 1, starter: 1 }); setView('GAME'); }} className="py-5 bg-white border-2 border-b-8 border-emerald-500 rounded-3xl font-black text-xl text-emerald-600 shadow-xl hover:-translate-y-1 transition-all">🤖 PLAY VS BOT</button>
            <button onClick={() => setView('MULTI_LOBBY')} className="py-5 bg-white border-2 border-b-8 border-indigo-600 rounded-3xl font-black text-xl text-indigo-600 shadow-xl hover:-translate-y-1 transition-all">👥 MULTIPLAYER</button>
            <button onClick={() => { localStorage.removeItem('kumkom_name'); setView('IDENTITY'); }} className="mt-6 text-[10px] font-bold text-slate-300 hover:text-indigo-500 uppercase tracking-widest">Change Name ({playerName})</button>
          </div>
        </div>
      )}

      {view === 'MULTI_LOBBY' && (
        <div className="bg-white p-8 rounded-[3rem] w-full max-w-md shadow-2xl border-2 border-slate-100">
          <h2 className="text-2xl font-black mb-8 text-center text-indigo-600 uppercase">Multiplayer Lobby</h2>
          <div className="flex flex-col gap-6">
            <button onClick={handleRandomMatch} className="py-6 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-lg">🔍 QUICK MATCH</button>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleCreateRoom} className="py-4 bg-slate-50 text-indigo-600 rounded-2xl font-bold border-2 border-slate-100 hover:bg-white transition-all">CREATE ROOM</button>
              <div className="flex gap-2">
                <input type="text" value={inputRoom} onChange={(e) => setInputRoom(e.target.value.replace(/\D/g,''))} placeholder="ID" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl text-center font-black outline-none focus:border-indigo-400"/>
                <button onClick={handleJoinRoom} className="bg-indigo-600 text-white px-4 rounded-2xl font-bold hover:bg-indigo-500 transition-colors">JOIN</button>
              </div>
            </div>
            <button onClick={() => setView('MENU')} className="mt-4 text-slate-400 font-bold text-xs uppercase hover:text-rose-500 text-center">← Back to Menu</button>
          </div>
        </div>
      )}

      {/* SEARCHING, ROOM_CREATED, showMatchPopup เดิมของคุณ... */}
      {view === 'SEARCHING' && (
        <div className="text-center">
          <div className="w-20 h-20 border-8 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-8 mx-auto"></div>
          <h2 className="text-2xl font-black text-indigo-600 italic">Searching...</h2>
          <button onClick={() => setView('MULTI_LOBBY')} className="mt-12 text-rose-500 font-bold uppercase text-xs">Cancel</button>
        </div>
      )}

      {view === 'ROOM_CREATED' && (
        <div className="bg-white p-10 rounded-[3.5rem] shadow-2xl border-4 border-indigo-50 w-full max-w-sm text-center">
          <h2 className="text-slate-400 font-black text-xs mb-8 uppercase">Waiting for Opponent</h2>
          <div className="bg-indigo-50 p-8 rounded-3xl border-4 border-dashed border-indigo-100 mb-8">
            <p className="text-5xl font-black text-indigo-700 tracking-widest">{generatedRoomId}</p>
          </div>
          <button onClick={() => setView('MULTI_LOBBY')} className="text-slate-300 font-bold text-xs uppercase hover:text-rose-600 tracking-widest">Close Room</button>
        </div>
      )}

      {showMatchPopup && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          <div className="bg-white p-12 rounded-[4rem] text-center shadow-2xl border-b-[12px] border-emerald-500 animate-in zoom-in-95 duration-300">
            <div className="text-7xl mb-6 animate-bounce">🤝</div>
            <h2 className="text-4xl font-black text-slate-800 mb-2 italic">MATCH FOUND!</h2>
            <div className="flex flex-col gap-4">
              <button onClick={handleSetReady} disabled={isMyReady} className={`py-6 px-16 rounded-[2rem] font-black text-2xl shadow-xl transition-all ${isMyReady ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-emerald-500 text-white hover:bg-emerald-400 active:scale-95'}`}>
                {isMyReady ? "READY!" : "START GAME"}
              </button>
              <div className="flex items-center justify-center gap-6 mt-4">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-5 h-5 rounded-full shadow-sm ${isMyReady ? 'bg-emerald-500 ring-4 ring-emerald-100' : 'bg-slate-200'}`}></div>
                  <span className="text-[11px] font-black text-slate-900 uppercase">{playerName} (YOU)</span>
                </div>
                <div className="w-12 h-1 bg-slate-100 rounded-full"></div>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-5 h-5 rounded-full shadow-sm ${isOpponentReady ? 'bg-emerald-500 ring-4 ring-emerald-100' : 'bg-slate-200'}`}></div>
                  <span className="text-[11px] font-black text-slate-900 uppercase">{opponentName}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}