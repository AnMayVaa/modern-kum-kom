'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { getProviders, signIn } from 'next-auth/react';
import { primaryBtn, RulesSheet, secondaryBtn } from '@/components/game/Sheets';
import { Shell } from '@/components/screens/Lobby';
import { SiteCredit } from '@/components/SiteCredit';
import { Wordmark } from '@/components/ui/Tile';
import { useDictionary } from '@/hooks/useDictionary';
import { BOT_LEVELS, BotLevel } from '@/lib/game/bot';
import { LETTER_SCORES } from '@/lib/game/constants';
import { normalizeThai, parseWord } from '@/lib/game/thai';
import { loadStats, resetStats, Stats } from '@/lib/client/storage';

// ---- First visit: pick a name ------------------------------------------------------------

export function IdentityScreen({ initialName, onDone }: { initialName: string; onDone: (name: string) => void }) {
  const [name, setName] = useState(initialName);
  const [google, setGoogle] = useState(false);
  useEffect(() => {
    getProviders()
      .then((p) => setGoogle(!!p?.google))
      .catch(() => setGoogle(false));
  }, []);
  const trimmed = name.trim();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <Wordmark size={72} />
      <h1 className="mt-6 text-center font-display text-2xl font-bold text-kram-950">คำคม เกมต่อคำภาษาไทยออนไลน์</h1>
      <p className="mt-2 max-w-xs text-center text-[15px] leading-relaxed text-kram-700">เล่นกับบอทหรือชวนเพื่อนมาเล่นออนไลน์ ฟรีบนเว็บ</p>
      <form
        className="mt-8 flex w-full max-w-xs flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed) onDone(trimmed.slice(0, 24));
        }}
      >
        <label htmlFor="player-name" className="text-sm font-medium text-kram-700">
          ชื่อที่จะแสดงในเกม
        </label>
        <input
          id="player-name"
          autoFocus
          maxLength={24}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="เช่น โอม"
          className="rounded-xl bg-white px-4 py-3 text-lg ring-1 ring-kram-200 outline-none focus:ring-2 focus:ring-gold"
        />
        <button type="submit" disabled={!trimmed} className={`${primaryBtn} py-3.5`}>
          เริ่มเล่น
        </button>
        {google && (
          <button type="button" className={secondaryBtn} onClick={() => signIn('google')}>
            เข้าสู่ระบบด้วย Google
          </button>
        )}
      </form>
      <SiteCredit className="mt-12" />
    </main>
  );
}

// ---- Main menu -----------------------------------------------------------------------

export function MenuScreen({
  name,
  level,
  onLevel,
  hasSavedGame,
  onSolo,
  onResume,
  onOnline,
  onDictionary,
  onProfile,
  onRename,
}: {
  name: string;
  level: BotLevel;
  onLevel: (l: BotLevel) => void;
  hasSavedGame: boolean;
  onSolo: () => void;
  onResume: () => void;
  onOnline: () => void;
  onDictionary: () => void;
  onProfile: () => void;
  onRename: () => void;
}) {
  const [rules, setRules] = useState(false);
  return (
    <main className="flex min-h-dvh flex-col items-center px-5 py-10 sm:justify-center">
      <h1 className="sr-only">คำคม เกมต่อคำภาษาไทยออนไลน์</h1>
      <Wordmark size={76} />
      <p className="mt-6 text-kram-700">
        สวัสดี <span className="font-semibold text-kram-950">{name}</span>{' '}
        <button type="button" onClick={onRename} className="ml-1 text-sm text-kram-500 underline underline-offset-2 hover:text-kram-900">
          เปลี่ยนชื่อ
        </button>
      </p>

      <div className="mt-8 flex w-full max-w-sm flex-col gap-3">
        {hasSavedGame && (
          <button type="button" className={`${primaryBtn} py-4 text-base`} onClick={onResume}>
            เล่นเกมที่ค้างไว้ต่อ
          </button>
        )}
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-lg font-bold">เล่นกับบอท</h2>
            <span className="text-xs text-kram-500">{BOT_LEVELS.find((l) => l.id === level)?.hint}</span>
          </div>
          <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl bg-kram-50 p-1" role="radiogroup" aria-label="ระดับบอท">
            {BOT_LEVELS.map((l) => (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={level === l.id}
                onClick={() => onLevel(l.id)}
                className={`rounded-lg py-2 text-sm font-medium ${level === l.id ? 'bg-kram-900 text-ivory shadow-sm' : 'text-kram-700 hover:bg-white'}`}
              >
                {l.label}
              </button>
            ))}
          </div>
          <button type="button" className={`${hasSavedGame ? secondaryBtn : primaryBtn} w-full`} onClick={onSolo}>
            {hasSavedGame ? 'เริ่มเกมใหม่' : 'เริ่มเกม'}
          </button>
        </div>
        <button type="button" className={`${secondaryBtn} bg-white py-4`} onClick={onOnline}>
          เล่นออนไลน์กับเพื่อน
        </button>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" className={`${secondaryBtn} bg-white text-sm`} onClick={onDictionary}>
            พจนานุกรม
          </button>
          <button type="button" className={`${secondaryBtn} bg-white text-sm`} onClick={onProfile}>
            สถิติ
          </button>
          <button type="button" className={`${secondaryBtn} bg-white text-sm`} onClick={() => setRules(true)}>
            วิธีเล่น
          </button>
        </div>
      </div>
      <SiteCredit className="mt-10" />
      <RulesSheet open={rules} onClose={() => setRules(false)} />
    </main>
  );
}

// ---- Dictionary ------------------------------------------------------------------------

const wordValue = (word: string) => (parseWord(word) ?? []).reduce((sum, cell) => sum + (LETTER_SCORES[cell.base] ?? 0), 0);

export function DictionaryScreen({ onBack }: { onBack: () => void }) {
  const { dictionary, failed, retry } = useDictionary();
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState<string[] | null>(null);
  const q = normalizeThai(query.trim());

  useEffect(() => {
    if (dictionary || !failed || !q) return;
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/dictionary?q=${encodeURIComponent(q)}`).catch(() => null);
      const data = res?.ok ? ((await res.json()) as { words: { word: string }[] }) : { words: [] };
      setRemote(data.words.map((w) => w.word));
    }, 250);
    return () => clearTimeout(timer);
  }, [q, dictionary, failed]);

  const results = useMemo(() => (dictionary ? dictionary.search(q, 80) : q ? (remote ?? []) : []), [dictionary, q, remote]);
  const exact = dictionary ? dictionary.has(q) : results.includes(q);

  return (
    <Shell title="พจนานุกรม" onBack={onBack}>
      <label htmlFor="dict-q" className="sr-only">
        ค้นหาคำ
      </label>
      <input
        id="dict-q"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="พิมพ์คำที่อยากตรวจ"
        className="w-full rounded-xl bg-kram-50 px-4 py-3 text-lg ring-1 ring-kram-200 outline-none focus:ring-2 focus:ring-gold"
      />
      <p className="mt-2 min-h-5 text-sm text-kram-500">
        {!dictionary && !failed
          ? 'กำลังโหลดพจนานุกรม…'
          : failed && !dictionary
            ? 'ใช้การค้นหาจากเซิร์ฟเวอร์'
            : q
              ? exact
                ? `“${q}” ใช้ลงในเกมได้`
                : `ไม่มีคำว่า “${q}” ในพจนานุกรม`
              : `มีทั้งหมด ${dictionary!.size.toLocaleString('th-TH')} คำ`}
        {failed && !dictionary && (
          <button type="button" onClick={retry} className="ml-2 underline">
            ลองโหลดใหม่
          </button>
        )}
      </p>
      <ul className="mt-3 flex flex-col divide-y divide-kram-100">
        {results.map((w) => (
          <li key={w} className="flex items-baseline justify-between py-2.5">
            <span className={`font-display text-lg ${w === q ? 'font-bold' : ''}`}>{w}</span>
            <span className="text-sm tabular-nums text-kram-500">{wordValue(w)} แต้ม</span>
          </li>
        ))}
      </ul>
      {q && results.length === 0 && (dictionary || remote) && <p className="py-6 text-center text-kram-500">ไม่พบคำที่ขึ้นต้นหรือมีคำนี้อยู่</p>}
    </Shell>
  );
}

// ---- Stats -----------------------------------------------------------------------------

export function ProfileScreen({ name, avatarUrl, onBack }: { name: string; avatarUrl: string | null; onBack: () => void }) {
  // Only rendered in the browser after the menu, so reading storage here is safe.
  const [stats, setStats] = useState<Stats>(() => loadStats());
  const rate = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
  const tiles: [string, string][] = [
    ['เล่นแล้ว', `${stats.played} เกม`],
    ['ชนะ', `${stats.wins} (${rate}%)`],
    ['แต้มสูงสุด', `${stats.highScore}`],
    ['แพ้ / เสมอ', `${stats.losses} / ${stats.draws}`],
  ];
  return (
    <Shell title="สถิติของฉัน" onBack={onBack}>
      <div className="mb-5 flex items-center gap-3">
        {avatarUrl ? (
          <Image src={avatarUrl} alt="" width={48} height={48} className="rounded-full" />
        ) : (
          <span className="tile h-12 w-12 text-2xl">{[...name].find((ch) => /[ก-ฮA-Za-z]/.test(ch)) ?? name.slice(0, 1)}</span>
        )}
        <div>
          <p className="font-display text-xl font-bold">{name}</p>
          <p className="text-sm text-kram-500">สถิติเก็บไว้ในเครื่องนี้</p>
        </div>
      </div>
      <dl className="mb-5 grid grid-cols-2 gap-2">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-kram-50 p-3">
            <dt className="text-sm text-kram-500">{label}</dt>
            <dd className="font-display text-2xl font-bold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {stats.bestMove && (
        <p className="mb-5 rounded-xl bg-gold-soft/60 p-3 text-[15px]">
          ตาที่ดีที่สุด <span className="font-display font-bold">{stats.bestMove.words}</span> ได้ {stats.bestMove.score} แต้ม
        </p>
      )}
      <h2 className="mb-2 font-semibold">เกมล่าสุด</h2>
      {stats.recent.length === 0 ? (
        <p className="text-sm text-kram-500">ยังไม่มีเกมที่เล่นจบ ลองเล่นกับบอทสักเกม</p>
      ) : (
        <ul className="flex flex-col divide-y divide-kram-100">
          {stats.recent.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span>
                <span className={`mr-2 font-semibold ${m.result === 'win' ? 'text-leaf' : m.result === 'loss' ? 'text-chad' : 'text-kram-700'}`}>
                  {m.result === 'win' ? 'ชนะ' : m.result === 'loss' ? 'แพ้' : 'เสมอ'}
                </span>
                {m.opponent}
                {m.level && <span className="text-kram-500"> ({BOT_LEVELS.find((l) => l.id === m.level)?.label})</span>}
              </span>
              <span className="shrink-0 tabular-nums text-kram-700">
                {m.myScore}–{m.opponentScore}
                <span className="ml-2 text-kram-500">{new Date(m.at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {stats.played > 0 && (
        <button
          type="button"
          className="mt-5 text-sm text-kram-500 underline underline-offset-2 hover:text-chad"
          onClick={() => {
            if (window.confirm('ล้างสถิติทั้งหมดในเครื่องนี้?')) {
              resetStats();
              setStats(loadStats());
            }
          }}
        >
          ล้างสถิติ
        </button>
      )}
    </Shell>
  );
}
