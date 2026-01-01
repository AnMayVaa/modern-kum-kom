import { THAI_CONSONANTS, FREE_DIACRITICS } from '@/lib/constants';

interface ModalProps {
  blankMenu: any;
  diacriticMenu: any;
  isOpponentLeft: boolean;
  onSelect: (char: string, isBlank: boolean) => void;
  onClose: () => void;
}

export const GameModals = ({ blankMenu, diacriticMenu, isOpponentLeft, onSelect, onClose }: any) => {
  
  // 1. กรณีคู่แข่งออกจากห้อง
  if (isOpponentLeft) return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[999] flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="bg-white p-12 rounded-[3.5rem] text-center shadow-2xl border-t-8 border-emerald-500 max-w-sm w-full animate-in zoom-in-95 duration-500">
        <div className="text-8xl mb-6">🏆</div>
        <h2 className="text-4xl font-black text-slate-800 mb-2 italic">YOU WIN!</h2>
        <p className="text-slate-500 font-bold mb-10 leading-relaxed">คู่แข่งออกจากห้องไปแล้ว <br/>ระบบตัดสินให้คุณเป็นฝ่ายชนะ!</p>
        <button onClick={() => window.location.reload()} className="w-full py-5 bg-emerald-500 text-white rounded-3xl font-black text-xl shadow-lg shadow-emerald-200 hover:bg-emerald-400 active:scale-95 transition-all">กลับหน้าหลัก</button>
      </div>
    </div>
  );

  // 2. กรณีเลือกตัวอักษร (Blank, Diacritic, หรือ Dual Options)
  if (blankMenu || diacriticMenu) {
    // 💡 กำหนดรายการตัวอักษรที่จะแสดง
    const isDual = !!diacriticMenu?.dualOptions;
    const charList = blankMenu 
      ? THAI_CONSONANTS 
      : (isDual ? diacriticMenu.dualOptions : FREE_DIACRITICS);

    return (
      <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={onClose}>
        <div className="bg-white p-8 rounded-[3rem] max-w-md w-full shadow-2xl border-t-8 border-indigo-600 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
          
          {/* Header ของ Modal */}
          <h3 className="text-2xl font-black text-slate-800 mb-2 text-center">
            {blankMenu ? "Select Blank Tile" : (isDual ? "Choose Letter" : "Choose Diacritic")}
          </h3>
          <p className="text-center text-slate-400 text-xs mb-8 uppercase font-bold tracking-widest">
            {blankMenu ? "Consonants Only" : (isDual ? "Dual Purpose Tile" : "Vowels & Tonemarks")}
          </p>

          {/* รายการตัวอักษร */}
          <div className={`grid ${isDual ? 'grid-cols-2' : 'grid-cols-5'} gap-3 max-h-[45vh] overflow-y-auto pr-2 custom-scrollbar`}>
            {charList.map((char: string) => (
              <button 
                key={char} 
                onClick={() => onSelect(char, !!blankMenu)} 
                className={`${isDual ? 'h-24 text-4xl' : 'h-14 text-2xl'} bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-slate-700 hover:bg-indigo-600 hover:text-white hover:scale-105 hover:shadow-lg transition-all`}
              >
                {char}
              </button>
            ))}
          </div>

          <button onClick={onClose} className="mt-8 w-full py-4 text-slate-400 font-black hover:text-rose-500 transition-colors uppercase tracking-widest text-xs">
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  return null;
};