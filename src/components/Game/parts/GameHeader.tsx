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
  playerName: string;   // เพิ่มเพื่อรับชื่อเรา
  opponentName: string; // เพิ่มเพื่อรับชื่อคู่แข่ง
}

export const GameHeader = ({ 
  mode, currentPlayer, playerRole, scores, tileBagLength, 
  roomInfo, showBotRack, setShowBotRack, onBack,
  playerName, opponentName 
}: HeaderProps) => (
  <div className="bg-white p-4 rounded-3xl shadow-sm w-full max-w-2xl flex justify-between items-center border-b-4 border-indigo-500 relative overflow-hidden h-24">
    {/* 1. ปุ่มย้อนกลับ */}
    <div className="w-20 z-10">
      <button onClick={onBack} className="text-slate-900 font-bold hover:text-rose-600 transition-colors">
        <span className="text-lg">←</span> MENU
      </button>
    </div>
    
    {/* 2. ส่วนกลาง: แสดงชื่อตามบทบาทจริงและทำให้ตัวหนังสือเข้มขึ้น */}
    <div className="absolute left-1/2 -translate-x-1/2 text-center z-10 w-auto min-w-[200px]">
      <div className="inline-flex items-center gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full animate-ping ${currentPlayer === playerRole ? 'bg-emerald-500' : 'bg-rose-500'}`} />
        <p className={`text-[11px] font-black uppercase tracking-[0.2em] ${currentPlayer === playerRole ? 'text-emerald-700' : 'text-rose-700'}`}>
          {currentPlayer === playerRole ? "Your Turn" : "Opponent Turn"}
        </p>
      </div>
      <div className="flex gap-4 sm:gap-10 items-center justify-center">
        {/* ฝั่ง P1: จะเป็นชื่อเราถ้าเราเป็น Role 1 */}
        <div className="flex flex-col items-center">
          <span className={`text-[10px] font-black leading-none mb-1 uppercase ${playerRole === 1 ? 'text-indigo-700' : 'text-slate-600'}`}>
            {playerRole === 1 ? `${playerName} (YOU)` : (mode === 'SOLO' ? 'BOT' : opponentName)}
          </span>
          <span className="text-2xl sm:text-3xl font-black text-slate-900">{scores.p1}</span>
        </div>

        <div className="w-px h-6 bg-slate-200" />

        {/* ฝั่ง P2: จะเป็นชื่อเราถ้าเราเป็น Role 2 */}
        <div className="flex flex-col items-center">
          <span className={`text-[10px] font-black leading-none mb-1 uppercase ${playerRole === 2 ? 'text-indigo-700' : 'text-slate-600'}`}>
            {playerRole === 2 ? `${playerName} (YOU)` : (mode === 'SOLO' ? 'BOT' : opponentName)}
          </span>
          <span className="text-2xl sm:text-3xl font-black text-slate-900">{scores.p2}</span>
        </div>
      </div>
    </div>

    {/* 3. ฝั่งขวา */}
    <div className="flex flex-col items-end gap-1 z-10 w-28 sm:w-32">
      {mode === 'SOLO' && (
        <button 
          onClick={() => setShowBotRack(!showBotRack)}
          className={`w-full h-6 rounded-full text-[9px] font-black transition-all ${showBotRack ? 'bg-rose-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}
        >
          {showBotRack ? 'HIDE BOT RACK' : 'SHOW BOT RACK'}
        </button>
      )}
      <div className="flex items-center gap-2">
        <span className="text-[9px] text-slate-600 font-black uppercase leading-none">Bag</span>
        <span className="text-base sm:text-lg font-black text-slate-900">{tileBagLength}</span>
      </div>
    </div>
    
    <div className="absolute -right-4 -top-4 w-16 h-16 bg-indigo-50 rounded-full opacity-50" />
  </div>
);