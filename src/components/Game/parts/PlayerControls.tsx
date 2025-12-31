interface PlayerControlsProps {
  rack: string[];
  selectedIndex: number | null;
  currentPlayer: number;
  playerRole: number;
  onSelect: (index: number) => void;
  onRecall: () => void;
  onSubmit: () => void;
}

export const PlayerControls = ({ rack, selectedIndex, currentPlayer, playerRole, onSelect, onRecall, onSubmit }: PlayerControlsProps) => {
  const isTurn = currentPlayer === playerRole;
  return (
    <div className={`bg-white p-10 rounded-[2.5rem] shadow-xl w-full max-w-2xl border-2 transition-all duration-300
      ${!isTurn ? 'bg-slate-50 opacity-50' : 'border-indigo-100 shadow-indigo-100/50'}`}>
      
      <div className="flex flex-nowrap justify-center gap-1 sm:gap-2 mb-8 px-2 overflow-visible hidden-scrollbar">
        {rack.map((tile, i) => (
          <button key={i} onClick={() => onSelect(i)} disabled={!isTurn}
            className={`w-12 h-12 sm:w-16 sm:h-16 bg-amber-50 border-b-4 border-amber-400 rounded-2xl flex items-center justify-center text-3xl font-black text-slate-800 shadow-lg transition-all
              ${selectedIndex === i ? 'ring-4 ring-indigo-500 -translate-y-3 bg-indigo-50 border-indigo-300' : 'hover:-translate-y-1 active:scale-95'}`}>
            {tile === '0' ? ' ' : tile}
          </button>
        ))}
      </div>

      <div className="flex gap-4">
        <button onClick={onRecall} disabled={!isTurn}
          className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-2xl border-b-4 border-slate-300 active:border-0 active:translate-y-1 transition-all uppercase tracking-widest text-sm hover:bg-slate-200">
          Recall
        </button>
        <button onClick={onSubmit} disabled={!isTurn}
          className="flex-[2] py-4 bg-emerald-600 text-white font-black rounded-2xl border-b-4 border-emerald-800 active:border-0 active:translate-y-1 transition-all shadow-xl hover:bg-emerald-500 uppercase tracking-[0.3em] text-sm">
          Submit Move
        </button>
      </div>
    </div>
  );
};