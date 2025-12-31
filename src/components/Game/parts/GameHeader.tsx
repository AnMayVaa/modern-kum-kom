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
  <div className="bg-white p-4 rounded-3xl shadow-sm w-full max-w-2xl flex justify-between items-center border-b-4 border-indigo-500 relative overflow-hidden">
    <button onClick={onBack} className="text-slate-400 font-bold hover:text-rose-500 transition-colors z-10">
      <span className="text-lg">←</span> MENU
    </button>
    
    <div className="text-center z-10">
      <div className="inline-flex items-center gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full animate-ping ${currentPlayer === playerRole ? 'bg-emerald-500' : 'bg-rose-500'}`} />
        <p className={`text-[11px] font-black uppercase tracking-[0.2em] ${currentPlayer === playerRole ? 'text-emerald-600' : 'text-rose-600'}`}>
          {currentPlayer === playerRole ? "Your Turn" : (mode === 'SOLO' ? "🤖 Bot Thinking..." : "⌛ Waiting for Opponent...")}
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
      {mode === 'SOLO' && (
        <button onClick={() => setShowBotRack(!showBotRack)}
          className={`px-3 py-1 rounded-full text-[10px] font-black transition-all ${showBotRack ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
          {showBotRack ? 'HIDE BOT RACK' : 'SHOW BOT RACK'}
        </button>
      )}
      {mode === 'MULTI' && roomInfo && (
        <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black border border-indigo-100">
          ROOM: {roomInfo.id}
        </span>
      )}
      <div className="flex flex-col items-end">
        <span className="text-[9px] text-slate-400 font-bold uppercase">Bag Left</span>
        <span className="text-lg font-black text-slate-600 leading-none">{tileBagLength}</span>
      </div>
    </div>
    
    <div className="absolute -right-4 -top-4 w-16 h-16 bg-indigo-50 rounded-full opacity-50" />
  </div>
);