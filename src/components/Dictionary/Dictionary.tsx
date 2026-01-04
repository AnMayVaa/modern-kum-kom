'use client';
import { useState, useEffect } from 'react';
import { Search, BookOpen, ArrowLeft, Loader2 } from 'lucide-react';

interface DictionaryProps {
  onBack: () => void;
}

export const Dictionary = ({ onBack }: DictionaryProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // 💡 Real-time Search Logic with Debounce
  useEffect(() => {
    // ถ้าช่องว่าง ให้เคลียร์ผลลัพธ์
    if (!query.trim()) {
      setResults([]);
      return;
    }

    // ตั้งเวลาหน่วง 300ms เพื่อไม่ให้ยิง API ทุกตัวอักษรที่พิมพ์ (ลดภาระ Server)
    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/dictionary?q=${query}`);
        const data = await res.json();
        setResults(data.words || []);
      } catch (error) {
        console.error("Search error", error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-6 font-sans animate-in fade-in duration-300">
      <div className="bg-white p-8 rounded-[3rem] shadow-2xl w-full max-w-md border-t-8 border-indigo-500 min-h-[80vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button onClick={onBack} className="text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1 font-bold text-xs uppercase tracking-widest">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="flex items-center gap-2 text-indigo-600">
            <BookOpen size={24} strokeWidth={2.5} />
            <h2 className="text-xl font-black uppercase tracking-wider">Dictionary</h2>
          </div>
          <div className="w-10"></div>
        </div>

        {/* Search Input */}
        <div className="relative mb-6 group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            {loading ? (
              <Loader2 size={20} className="text-indigo-500 animate-spin" />
            ) : (
              <Search size={20} className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            )}
          </div>
          <input 
            type="text" 
            placeholder="ค้นหาคำศัพท์..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-slate-100 border-2 border-transparent rounded-2xl font-bold text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 outline-none transition-all shadow-inner"
            autoFocus
          />
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {query && results.length === 0 && !loading ? (
            <div className="text-center text-slate-400 mt-10 font-bold">
              ไม่พบคำว่า "{query}"
            </div>
          ) : !query ? (
            <div className="text-center text-slate-300 mt-10 text-sm uppercase tracking-widest font-bold">
              พิมพ์เพื่อเริ่มค้นหา
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {results.map((item: any, index: number) => (
                <div key={index} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all cursor-default group">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-black text-slate-700 group-hover:text-indigo-700">
                      {item.word}
                    </span>
                    {/* ถ้าใน DB มีบอกความหมายหรือคะแนน ก็เอามาใส่ตรงนี้ได้ */}
                    {item.score && (
                       <span className="text-xs font-bold bg-white px-2 py-1 rounded-lg text-slate-400 border border-slate-200">
                         {item.score} pts
                       </span>
                    )}
                  </div>
                  {/* แสดงความหมาย (ถ้ามี) */}
                  {item.definition && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-1">{item.definition}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};