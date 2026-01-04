// src/components/UserProfile/UserProfile.tsx
import { User, Star, Trophy } from 'lucide-react';
import Image from 'next/image';

interface UserProfileProps {
  playerName: string;
  avatarUrl: string | null;
  onBack: () => void;
}

export const UserProfile = ({ playerName, avatarUrl, onBack }: UserProfileProps) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-6 font-sans animate-in fade-in duration-300">
      <div className="bg-white p-8 rounded-[3rem] shadow-2xl w-full max-w-md border-t-8 border-indigo-600">
        
        {/* Header & Back Button */}
        <div className="flex items-center justify-between mb-8">
          <button onClick={onBack} className="text-slate-400 hover:text-indigo-600 transition-colors font-bold text-sm uppercase tracking-widest">
            ← Back
          </button>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-wider">User Profile</h2>
          <div className="w-10"></div> {/* Placeholder จัดกึ่งกลาง */}
        </div>

        {/* Avatar & Name */}
        <div className="flex flex-col items-center mb-10">
          <div className="relative w-32 h-32 mb-4">
            <div className="absolute inset-0 bg-indigo-100 rounded-full blur-xl opacity-50 animate-pulse"></div>
            <div className="relative w-full h-full rounded-full overflow-hidden border-4 border-white shadow-lg">
              {avatarUrl ? (
                <Image src={avatarUrl} alt={playerName} fill className="object-cover" />
              ) : (
                <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-300">
                  <User size={64} strokeWidth={1.5} />
                </div>
              )}
            </div>
            {/* Rank Badge (Placeholder) */}
            <div className="absolute -bottom-2 -right-2 bg-amber-400 p-2 rounded-full border-4 border-white shadow-sm text-white">
              <Star size={20} fill="white" />
            </div>
          </div>
          <h3 className="text-3xl font-black text-slate-800">{playerName}</h3>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Novice Player</p> {/* Placeholder Rank Name */}
        </div>

        {/* Stats (Placeholder) */}
        <div className="grid grid-cols-2 gap-4 mb-10">
          <div className="bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-100 text-center">
            <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center justify-center gap-2">
              <Trophy size={16} /> Rank
            </div>
            <div className="text-4xl font-black text-indigo-600">1</div>
          </div>
          <div className="bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-100 text-center">
            <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center justify-center gap-2">
              <Star size={16} /> Winrate
            </div>
            <div className="text-4xl font-black text-emerald-500">100%</div>
          </div>
        </div>

        {/* Match History (Placeholder) */}
        <div>
          <h4 className="text-sm font-black text-slate-800 mb-4 uppercase tracking-wider">Recent Matches</h4>
          <div className="flex flex-col gap-3">
            {/* ตัวอย่างประวัติการเล่น (Placeholder) */}
            {[true, true, false, true, true].map((isWin, i) => (
              <div key={i} className={`p-4 rounded-2xl flex items-center justify-between border-2 ${isWin ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                <span className={`font-black text-sm uppercase tracking-widest ${isWin ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {isWin ? 'Victory' : 'Defeat'}
                </span>
                <span className="text-xs font-bold text-slate-400">vs Opponent • 3 days ago</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};