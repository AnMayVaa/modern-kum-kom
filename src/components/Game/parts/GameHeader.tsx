interface HeaderProps {
  mode: string;
  currentPlayer: number;
  playerRole: number;
  scores: { p1: number; p2: number };
  tileBagLength: number;
  roomInfo?: any;
  showBotRack: boolean;
  setShowBotRack: (v: boolean) => void;
  onBack: () => void;
}

export const GameHeader = ({ mode, currentPlayer, playerRole, scores, tileBagLength, roomInfo, showBotRack, setShowBotRack, onBack }: HeaderProps) => (
  <div className="bg-white p-4 rounded-3xl shadow-sm w-full max-w-2xl flex justify-between items-center border-b-4 border-indigo-500 relative overflow-hidden h-24">
    {/* 1. ปุ่มย้อนกลับ (ล็อคความกว้างไว้ฝั่งซ้าย) */}
    <div className="w-20 z-10">
      <button onClick={onBack} className="text-slate-400 font-bold hover:text-rose-500 transition-colors">
        <span className="text-lg">←</span> MENU
      </button>
    </div>
    
    {/* 2. ส่วนกลาง (ใช้ Absolute เพื่อให้ล็อคกึ่งกลางหน้าจอเสมอ ไม่ขยับตามปุ่มซ้ายขวา) */}
    <div className="absolute left-1/2 -translate-x-1/2 text-center z-10 w-auto min-w-[150px]">
      <div className="inline-flex items-center gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full animate-ping ${currentPlayer === playerRole ? 'bg-emerald-500' : 'bg-rose-500'}`} />
        <p className={`text-[11px] font-black uppercase tracking-[0.2em] ${currentPlayer === playerRole ? 'text-emerald-600' : 'text-rose-600'}`}>
          {currentPlayer === playerRole ? "Your Turn" : "Opponent Turn"}
        </p>
      </div>
      <div className="flex gap-4 sm:gap-8 items-center justify-center">
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-slate-400 font-bold leading-none mb-1">YOU</span>
          <span className="text-2xl sm:text-3xl font-black text-slate-800">{scores.p1}</span>
        </div>
        <div className="w-px h-6 bg-slate-100" />
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-slate-400 font-bold leading-none mb-1">{mode === 'SOLO' ? 'BOT' : 'P2'}</span>
          <span className="text-2xl sm:text-3xl font-black text-slate-800">{scores.p2}</span>
        </div>
      </div>
    </div>

    {/* 3. ฝั่งขวา (กำหนดขนาดคงที่ให้กลุ่มปุ่ม เพื่อไม่ให้เบียดส่วนกลาง) */}
    <div className="flex flex-col items-end gap-1 z-10 w-28 sm:w-32">
      {mode === 'SOLO' && (
        <button 
          onClick={() => setShowBotRack(!showBotRack)}
          // ล็อคความกว้างปุ่ม (w-full) และความสูง (h-6) เพื่อให้ขนาดปุ่มไม่เปลี่ยนตามตัวหนังสือ
          className={`w-full h-6 rounded-full text-[9px] font-black transition-all ${showBotRack ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-400'}`}
        >
          {showBotRack ? 'HIDE BOT RACK' : 'SHOW BOT RACK'}
        </button>
      )}
      <div className="flex items-center gap-2">
        <span className="text-[9px] text-slate-400 font-bold uppercase leading-none">Bag</span>
        <span className="text-base sm:text-lg font-black text-slate-600">{tileBagLength}</span>
      </div>
    </div>
    
    {/* Background Decor */}
    <div className="absolute -right-4 -top-4 w-16 h-16 bg-indigo-50 rounded-full opacity-50" />
  </div>
);