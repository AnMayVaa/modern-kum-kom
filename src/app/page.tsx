'use client';
import { useState, useEffect } from 'react';
import Board from '@/components/Game/Board';
import Pusher from 'pusher-js';

type ViewState = 'MENU' | 'SOLO' | 'MULTI_LOBBY' | 'SEARCHING' | 'ROOM_CREATED' | 'GAME';

export default function Home() {
  const [view, setView] = useState<ViewState>('MENU');
  const [roomData, setRoomData] = useState<{ id: string; role: 1 | 2; starter: 1 | 2 } | null>(null);
  const [inputRoom, setInputRoom] = useState('');
  const [generatedRoomId, setGeneratedRoomId] = useState('');
  
  const [isMyReady, setIsMyReady] = useState(false);
  const [isOpponentReady, setIsOpponentReady] = useState(false);
  const [showMatchPopup, setShowMatchPopup] = useState(false);

  // --- ระบบ Sync ข้อมูล Lobby ---
  useEffect(() => {
  if (!roomData?.id || view === 'GAME') return;

  const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, { cluster: 'ap1' });
  const channel = pusher.subscribe(`room-${roomData.id}`);

  // ฟังเสียงการจับคู่ (สำหรับ Host/P1)
  const onMatch = (data: { starter: 1 | 2 }) => {
    setRoomData(prev => prev ? { ...prev, starter: data.starter } : null);
    setShowMatchPopup(true);
  };
  channel.bind('match-found', onMatch);
  channel.bind('player-joined', onMatch);

  // ฟังเสียง Ready จากอีกฝ่าย
  channel.bind('player-ready', (data: { role: 1 | 2; playerReady: boolean }) => {
    console.log("ได้รับสัญญาณพร้อมจากบทบาท:", data.role);
    // ถ้าคนส่งไม่ใช่เรา ให้เซตว่า "คู่แข่งพร้อมแล้ว"
    if (data.role !== roomData.role) {
      setIsOpponentReady(true); 
    }
  });

  return () => {
    channel.unbind_all();
    pusher.unsubscribe(`room-${roomData.id}`);
    pusher.disconnect();
  };
}, [roomData?.id, view]); // ดักฟังเฉพาะเมื่อ ID ห้องเปลี่ยน

  // 2. ตรวจสอบสถานะการเข้าเกม (ต้องพร้อมทั้งคู่)
  useEffect(() => {
    if (roomData?.id && view !== 'GAME') {
      const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, { cluster: 'ap1' });
      const channel = pusher.subscribe(`room-${roomData.id}`);

      // จุดแก้ไข: เมื่อ P2 เชื่อมต่อ Socket สำเร็จ ให้ส่งสัญญาณทักทาย P1 ทันที
      pusher.connection.bind('connected', async () => {
        if (roomData.role === 2) {
          const res = await fetch('/api/multiplayer/match', {
            method: 'POST',
            body: JSON.stringify({ action: 'notify_ready_to_pair', roomId: roomData.id })
          });
          const data = await res.json();
          // รับค่า starter จาก Server และเปิดป๊อปอัปฝั่งตนเอง
          setRoomData(prev => prev ? { ...prev, starter: data.starter } : null);
          setShowMatchPopup(true);
        }
      });

      // จุดแก้ไข: P1 รอฟังเสียง "match-connected" จาก P2 เพื่อเปิดป๊อปอัปพร้อมกัน
      channel.bind('match-connected', (data: { starter: 1 | 2 }) => {
        if (roomData.role === 1) {
          setRoomData(prev => prev ? { ...prev, starter: data.starter } : null);
          setShowMatchPopup(true);
        }
      });

      // ฟังเสียง Ready จากอีกฝ่าย (เหมือนเดิม)
      channel.bind('player-ready', (data: { role: 1 | 2; playerReady: boolean }) => {
        if (data.role !== roomData.role) setIsOpponentReady(data.playerReady);
      });

      return () => { channel.unbind_all(); pusher.unsubscribe(`room-${roomData.id}`); pusher.disconnect(); };
    }
  }, [roomData?.id, view]);

  // --- ACTIONS ---

  const handleRandomMatch = async () => {
    setView('SEARCHING');
    setIsMyReady(false);
    setIsOpponentReady(false);
    try {
      const res = await fetch('/api/multiplayer/match', { method: 'POST', body: JSON.stringify({ action: 'find_match' }) });
      const data = await res.json();
      
      // ตั้งค่า RoomData เพื่อให้ useEffect ของ Pusher เริ่มทำงาน
      setRoomData({ id: data.roomId, role: data.role, starter: 1 });
      
      // หากเป็น P2 (คนจอย) ให้เปิดหน้าจอรอทันที
      if (data.role === 2) {
        setShowMatchPopup(true);
      }
    } catch (e) { 
      alert("ระบบสุ่มห้องขัดข้อง"); 
      setView('MULTI_LOBBY'); 
    }
  };

  const handleCreateRoom = async () => {
    const newId = Math.floor(100000 + Math.random() * 900000).toString();
    await fetch('/api/rooms', { method: 'POST', body: JSON.stringify({ action: 'create', roomId: newId }) });
    setGeneratedRoomId(newId);
    setRoomData({ id: newId, role: 1, starter: 1 }); // Starter จะถูกอัปเดตเมื่อเพื่อนจอย
    setView('ROOM_CREATED');
  };

  const handleJoinRoom = async () => {
    if (inputRoom.length < 4) return alert("รหัสไม่ถูกต้อง");
    try {
      const res = await fetch('/api/rooms', { method: 'POST', body: JSON.stringify({ action: 'check', roomId: inputRoom }) });
      const data = await res.json();
      
      if (data.exists) {
        // เมื่อจอยสำเร็จ ต้องรีเซ็ตสถานะและเตรียมเข้าหน้า Match
        setIsMyReady(false);
        setIsOpponentReady(false);
        setRoomData({ id: inputRoom, role: 2, starter: 1 });
        setShowMatchPopup(true); // บังคับเปิดป๊อปอัปฝั่งคนจอยทันที
      } else { 
        alert("❌ ไม่พบเลขห้องนี้ หรือห้องถูกลบไปแล้ว"); 
      }
    } catch (e) { 
      alert("การเชื่อมต่อล้มเหลว"); 
    }
  };

  // 3. ฟังก์ชันกดยืนยันพร้อมเล่น
  const handleSetReady = async () => {
    if (!roomData) return;
    setIsMyReady(true); // เซตฝั่งเราเองให้เขียว
    
    await fetch('/api/multiplayer/match', {
      method: 'POST',
      body: JSON.stringify({ 
        action: 'set_ready', 
        roomId: roomData.id, 
        role: roomData.role, // ส่งบทบาทเราไป (1 หรือ 2)
        playerReady: true 
      })
    });
  };

  useEffect(() => {
    // ถ้าเขียวทั้งคู่ ให้เข้าเกม!
    if (isMyReady && isOpponentReady) {
      console.log("พร้อมทั้งคู่! กำลังเริ่มเกม...");
      const timer = setTimeout(() => {
        setView('GAME');
      }, 1000); // หน่วง 1 วิให้เห็นไฟเขียวติดพร้อมกันก่อนเด้ง
      return () => clearTimeout(timer);
    }
  }, [isMyReady, isOpponentReady]); // ต้องเฝ้าดูทั้ง 2 ค่านี้

  if (view === 'GAME') return <Board mode="MULTI" roomInfo={roomData} onBack={() => window.location.reload()} />;

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-800 font-sans">
      {view === 'MENU' && (
        <div className="flex flex-col items-center">
          <h1 className="text-7xl font-black text-indigo-600 mb-12 italic">KUM-KOM</h1>
          <div className="flex flex-col gap-4 w-full max-w-xs">
            <button onClick={() => { setRoomData({ id: 'SOLO', role: 1, starter: 1 }); setView('GAME'); }} className="py-5 bg-white border-2 border-b-8 border-emerald-500 rounded-3xl font-black text-xl text-emerald-600 shadow-xl hover:-translate-y-1 transition-all">🤖 PLAY VS BOT</button>
            <button onClick={() => setView('MULTI_LOBBY')} className="py-5 bg-white border-2 border-b-8 border-indigo-600 rounded-3xl font-black text-xl text-indigo-600 shadow-xl hover:-translate-y-1 transition-all">👥 MULTIPLAYER</button>
          </div>
        </div>
      )}

      {view === 'MULTI_LOBBY' && (
        <div className="bg-white p-8 rounded-[3rem] w-full max-w-md shadow-2xl border-2 border-slate-100">
          <h2 className="text-2xl font-black mb-8 text-center text-indigo-600">MULTIPLAYER LOBBY</h2>
          <div className="flex flex-col gap-6">
            <button onClick={handleRandomMatch} className="py-6 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-lg hover:bg-indigo-500 transition-all">🔍 QUICK MATCH</button>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleCreateRoom} className="py-4 bg-slate-50 text-indigo-600 rounded-2xl font-bold border-2 border-slate-100 hover:bg-white transition-all">CREATE ROOM</button>
              <div className="flex gap-2">
                <input type="text" value={inputRoom} onChange={(e) => setInputRoom(e.target.value.replace(/\D/g,''))} placeholder="ID" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl text-center font-black outline-none focus:border-indigo-400"/>
                <button onClick={handleJoinRoom} className="bg-indigo-600 text-white px-4 rounded-2xl font-bold hover:bg-indigo-500 transition-colors">JOIN</button>
              </div>
            </div>
            <button onClick={() => setView('MENU')} className="mt-4 text-slate-400 font-bold text-xs uppercase hover:text-rose-500 text-center">← Back</button>
          </div>
        </div>
      )}

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
            <p className="text-5xl font-black text-indigo-600 tracking-widest">{generatedRoomId}</p>
          </div>
          <div className="flex justify-center gap-2 mb-4 animate-bounce">
            <div className="w-3 h-3 bg-indigo-400 rounded-full"></div>
            <div className="w-3 h-3 bg-indigo-400 rounded-full"></div>
            <div className="w-3 h-3 bg-indigo-400 rounded-full"></div>
          </div>
          <button onClick={() => setView('MULTI_LOBBY')} className="text-slate-300 font-bold text-xs uppercase hover:text-rose-500">Close Room</button>
        </div>
      )}

      {showMatchPopup && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          <div className="bg-white p-12 rounded-[4rem] text-center shadow-2xl border-b-[12px] border-emerald-500 animate-in zoom-in-95 duration-300">
            <div className="text-7xl mb-6 animate-bounce">🤝</div>
            <h2 className="text-4xl font-black text-slate-800 mb-2 italic">MATCH FOUND!</h2>
            <p className="text-slate-400 font-bold mb-10 text-xs uppercase">กรุณากดเพื่อเริ่มเกม</p>
            <div className="flex flex-col gap-4">
              <button onClick={handleSetReady} disabled={isMyReady} className={`py-6 px-16 rounded-[2rem] font-black text-2xl shadow-xl transition-all ${isMyReady ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-emerald-500 text-white hover:bg-emerald-400 active:scale-95'}`}>
                {isMyReady ? "READY!" : "START GAME"}
              </button>
              <div className="flex items-center justify-center gap-4 mt-2">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-4 h-4 rounded-full shadow-sm ${isMyReady ? 'bg-emerald-500 ring-4 ring-emerald-100' : 'bg-slate-200'}`}></div>
                  <span className="text-[10px] font-bold text-slate-300">YOU</span>
                </div>
                <div className="w-12 h-0.5 bg-slate-100"></div>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-4 h-4 rounded-full shadow-sm ${isOpponentReady ? 'bg-emerald-500 ring-4 ring-emerald-100' : 'bg-slate-200'}`}></div>
                  <span className="text-[10px] font-bold text-slate-300">OPPONENT</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}