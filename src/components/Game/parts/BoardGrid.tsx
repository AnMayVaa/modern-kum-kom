import { BOARD_LAYOUT, LETTER_SCORES } from '@/lib/constants';

interface BoardGridProps {
  grid: (string | null)[][];
  blankTiles: Set<string>;
  currentPlayer: number;
  playerRole: number;
  mode: string;
  onCellClick: (r: number, c: number) => void;
}

export const BoardGrid = ({ grid, blankTiles, currentPlayer, playerRole, mode, onCellClick }: BoardGridProps) => {
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

  return (
    <div className={`w-full max-w-full overflow-x-auto pb-4 custom-scrollbar transition-all duration-500
      ${(mode === 'MULTI' && Number(currentPlayer) !== Number(playerRole)) ? 'opacity-60 grayscale-[0.5]' : 'opacity-100'}`}>
      
      {/* กำหนด min-w เพื่อให้กระดานคงรูปทรง 15 คอลัมน์ไว้ ไม่ให้ซ้อนกัน */}
      <div className="min-w-[550px] sm:min-w-[700px] md:min-w-full bg-slate-800 p-1 rounded-2xl shadow-2xl border-4 border-slate-700 mx-auto">
        <div className="grid grid-cols-15 gap-px bg-slate-700/50 border border-slate-700/50 rounded-xl overflow-hidden">
          {grid.map((row, r) => row.map((cell, c) => {
            const isMain = r % 2 !== 0;
            const isBlank = blankTiles.has(`${r},${c}`);

            // 💡 หาคะแนนของตัวอักษรนั้นๆ (ถ้าเป็น Blank จะเป็น 0)
            const score = cell && !isBlank ? LETTER_SCORES[cell] : null;

            return (
              <div key={`${r}-${c}`} onClick={() => onCellClick(r, c)}
                // ปรับขนาดเบี้ยตามหน้าจอ (sm: md: lg:) เพื่อให้พอดีกับ Desktop และ iPad
                className={`flex items-center justify-center transition-all relative leading-none
                ${isMain ? 'h-8 sm:h-10 md:h-12 text-xl sm:text-2xl font-black' : 'h-4 sm:h-5 md:h-6 text-[10px] sm:text-xs'}
                ${cell ? (isBlank ? 'bg-cyan-100 text-blue-700 shadow-[inset_0_0_8px_cyan] z-10' : 'bg-[#ffebbb] text-slate-900 border-b-[3px] border-[#e6c275] shadow-sm z-10 rounded-[2px]') : 
                  isMain ? getCellColor(Math.floor(r/2), c) : 'bg-indigo-900/30 hover:bg-indigo-500/40'}`}>
                    
                {/* ตัวอักษรหลัก */}
                <span className={isMain && !cell ? 'opacity-50 scale-75 transform' : ''}>
                  {cell || (isMain ? (BOARD_LAYOUT[Math.floor(r/2)]?.[c] === 'STAR' ? '★' : BOARD_LAYOUT[Math.floor(r/2)]?.[c]) : '')}
                </span>

                {/* 💡 เพิ่มตัวเลขคะแนนมุมขวาล่าง (เฉพาะช่องที่มีเบี้ยและไม่ใช่เบี้ยว่าง) */}
                {score !== null && score !== undefined && (
                  <span className="absolute bottom-[2px] right-[2px] text-[8px] sm:text-[10px] leading-none font-bold opacity-60">
                    {score}
                  </span>
                )}
              </div>
            );
          }))}
        </div>
      </div>
    </div>
  );
};