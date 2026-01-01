// src/components/Game/parts/PlayerControls.tsx
interface PlayerControlsProps {
  rack: string[];
  selectedIndex: number | null;
  currentPlayer: number;
  playerRole: number;
  onSelect: (index: number) => void;
  onRecall: () => void;
  onExchange: () => void;
  onShuffle: () => void;
  onSubmit: () => void;
}

export const PlayerControls = ({ rack, selectedIndex, currentPlayer, playerRole, onSelect, onRecall, onExchange, onShuffle, onSubmit }: PlayerControlsProps) => {
  const isTurn = currentPlayer === playerRole;

  return (
    // 💡 ลบ opacity-50 และ bg-slate-50 ออกเพื่อให้การแสดงผลชัดเจนตลอดเวลา
    <div className={`bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-xl w-full max-w-2xl border-2 transition-all 
      ${!isTurn ? 'border-slate-100' : 'border-indigo-100 shadow-indigo-100/50'}`}>
      
      {/* ส่วนแสดงเบี้ยในมือ */}
      <div className="flex flex-nowrap justify-center gap-1 sm:gap-2 mb-8 px-2 overflow-visible">
        {rack.map((tile, i) => (
          // 💡 ลบ disabled={!isTurn} ออกเพื่อให้ผู้เล่นคลิกเลือกสลับที่เบี้ยได้แม้ในตาคู่แข่ง
          <button 
            key={i} 
            onClick={() => onSelect(i)}
            className={`w-12 h-12 sm:w-16 sm:h-16 bg-amber-50 border-b-4 border-amber-400 rounded-2xl flex items-center justify-center text-3xl font-black text-slate-800 shadow-lg transition-all
              ${selectedIndex === i ? 'ring-4 ring-indigo-500 -translate-y-3 bg-indigo-50' : 'hover:-translate-y-1 active:scale-95'}`}
          >
            {tile === '0' ? ' ' : tile}
          </button>
        ))}
      </div>

      {/* แถวปุ่มกดจัดการเบี้ย */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {/* สำหรับปุ่มที่ต้องรอตาตัวเอง ให้เพิ่ม disabled:opacity-50 เพื่อให้ดูเป็นปุ่มที่กดไม่ได้แทนการปิดทั้ง Card */}
        <button 
          onClick={onRecall} 
          disabled={!isTurn}
          className="py-3 bg-slate-100 text-slate-500 font-black rounded-xl border-b-4 border-slate-300 uppercase text-[10px] sm:text-xs active:translate-y-1 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Recall
        </button>

        <button 
          onClick={onShuffle}
          className="py-3 bg-indigo-500 text-white font-black rounded-xl border-b-4 border-indigo-700 uppercase text-[10px] sm:text-xs active:translate-y-1 transition-all shadow-md"
        >
          Shuffle
        </button>

        <button 
          onClick={onExchange} 
          disabled={!isTurn}
          className="py-3 bg-amber-500 text-white font-black rounded-xl border-b-4 border-amber-700 uppercase text-[10px] sm:text-xs active:translate-y-1 transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Exchange / Skip
        </button>
      </div>

      {/* ปุ่ม Submit */}
      <button 
        onClick={onSubmit} 
        disabled={!isTurn}
        className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl border-b-4 border-emerald-800 uppercase tracking-[0.3em] text-sm shadow-xl hover:bg-emerald-500 active:translate-y-1 transition-all disabled:bg-slate-300 disabled:border-slate-400 disabled:text-slate-500 disabled:shadow-none disabled:cursor-not-allowed"
      >
        Submit Move
      </button>
    </div>
  );
};