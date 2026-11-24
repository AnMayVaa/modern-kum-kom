'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { primaryBtn, secondaryBtn } from '@/components/game/Sheets';
import { useToast } from '@/components/ui/Toast';
import { fromWire, GameState, newGame, PlayerId, toWire, WireState } from '@/lib/game/state';
import { getPusher, realtimeAvailable, roomChannel, roomRequest, sendRoomEvent } from '@/lib/client/realtime';

type Phase = 'choose' | 'working' | 'searching' | 'hosting' | 'paired';

export interface OnlineStart {
  roomId: string;
  me: PlayerId;
  opponentName: string;
  state: GameState;
}

export function Lobby({
  playerName,
  joinCode,
  onBack,
  onStart,
}: {
  playerName: string;
  joinCode?: string | null;
  onBack: () => void;
  onStart: (start: OnlineStart) => void;
}) {
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>('choose');
  const [room, setRoom] = useState<{ id: string; me: PlayerId } | null>(null);
  const [opponent, setOpponent] = useState<string | null>(null);
  const [code, setCode] = useState(joinCode ?? '');
  const [myReady, setMyReady] = useState(false);
  const [theirReady, setTheirReady] = useState(false);
  const [setup, setSetup] = useState<GameState | null>(null);
  const live = useRef({ myReady, setup, phase });
  useEffect(() => {
    live.current = { myReady, setup, phase };
  });

  const reset = useCallback(() => {
    setPhase('choose');
    setRoom(null);
    setOpponent(null);
    setMyReady(false);
    setTheirReady(false);
    setSetup(null);
  }, []);

  const entering = useRef(false);
  const enter = useCallback(
    async (action: 'quick' | 'create' | 'join', roomId?: string) => {
      if (entering.current) return;
      entering.current = true;
      setPhase('working');
      const res = await roomRequest<{ roomId: string; role: PlayerId; opponentName?: string }>(action, { name: playerName, roomId })
        .catch(() => ({ error: 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ' }))
        .finally(() => {
          entering.current = false;
        });
      if ('error' in res && res.error) {
        toast(res.error, { tone: 'error' });
        setPhase('choose');
        return;
      }
      const ok = res as { roomId: string; role: PlayerId; opponentName?: string };
      setRoom({ id: ok.roomId, me: ok.role });
      if (ok.role === 2) {
        setOpponent(ok.opponentName ?? 'ผู้เล่น');
        setPhase('paired');
      } else setPhase(action === 'quick' ? 'searching' : 'hosting');
    },
    [playerName, toast],
  );

  // Deep link: ?room=123456 joins straight away.
  const autoJoined = useRef(false);
  useEffect(() => {
    if (!joinCode || autoJoined.current || !realtimeAvailable()) return;
    autoJoined.current = true;
    const timer = setTimeout(() => void enter('join', joinCode), 0);
    return () => clearTimeout(timer);
  }, [joinCode, enter]);

  // Room channel: pairing and the ready check.
  useEffect(() => {
    if (!room) return;
    const pusher = getPusher();
    if (!pusher) return;
    const name = roomChannel(room.id);
    const channel = pusher.subscribe(name);
    const fromOther = (data: { role?: PlayerId }) => data.role !== room.me;

    const paired = (who: string) => {
      setOpponent(who);
      setPhase('paired');
    };
    const sendReady = (state: GameState | null) =>
      sendRoomEvent(room.id, room.me, 'ready', { name: playerName, ...(state ? { setup: toWire(state) } : {}) });

    channel.bind('pusher:subscription_succeeded', async () => {
      if (room.me === 2) {
        await sendRoomEvent(room.id, 2, 'hello', { name: playerName });
      } else {
        const status = await roomRequest<{ status: string; guestName?: string | null }>('status', { roomId: room.id });
        if (status.status === 'full' && status.guestName) paired(status.guestName);
      }
    });
    channel.bind('opponent-joined', (data: { role: PlayerId; name: string }) => fromOther(data) && paired(data.name));
    channel.bind('hello', (data: { role: PlayerId; name?: string }) => {
      if (!fromOther(data) || !data.name) return; // in-game sync requests carry no name
      paired(data.name);
      if (live.current.myReady) void sendReady(live.current.setup);
    });
    channel.bind('ready', (data: { role: PlayerId; name: string; setup?: WireState }) => {
      if (!fromOther(data)) return;
      setOpponent(data.name);
      setTheirReady(true);
      if (data.setup) setSetup(fromWire(data.setup, []));
    });
    channel.bind('leave', (data: { role: PlayerId }) => {
      if (!fromOther(data)) return;
      toast('อีกฝ่ายออกจากห้องแล้ว');
      reset();
    });

    // Keep a waiting room listed while this player is still here.
    const keepAlive = setInterval(() => {
      if (live.current.phase === 'searching' || live.current.phase === 'hosting') void roomRequest('keepalive', { roomId: room.id });
    }, 15_000);

    return () => {
      clearInterval(keepAlive);
      channel.unbind_all();
      pusher.unsubscribe(name);
    };
  }, [room, playerName, toast, reset]);

  useEffect(() => {
    if (room && opponent && myReady && theirReady && setup) {
      onStart({ roomId: room.id, me: room.me, opponentName: opponent, state: setup });
    }
  }, [room, opponent, myReady, theirReady, setup, onStart]);

  const ready = async () => {
    if (!room) return;
    let state: GameState | null = null;
    if (room.me === 1) {
      state = newGame({ starter: Math.random() < 0.5 ? 1 : 2 });
      setSetup(state);
    }
    setMyReady(true);
    const sent = await sendRoomEvent(room.id, room.me, 'ready', { name: playerName, ...(state ? { setup: toWire(state) } : {}) });
    if (!sent) {
      setMyReady(false);
      toast('ส่งสถานะไม่สำเร็จ ลองอีกครั้ง', { tone: 'error' });
    }
  };

  const cancel = async () => {
    if (room) {
      if (phase === 'paired') await sendRoomEvent(room.id, room.me, 'leave');
      else await roomRequest('close', { roomId: room.id });
    }
    reset();
  };

  const share = async () => {
    if (!room) return;
    const url = `${window.location.origin}/?room=${room.id}`;
    try {
      if (navigator.share) await navigator.share({ title: 'มาเล่นคำคมกัน', text: `รหัสห้อง ${room.id}`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast('คัดลอกลิงก์ห้องแล้ว');
      }
    } catch {
      // the share sheet was dismissed
    }
  };

  if (!realtimeAvailable()) {
    return (
      <Shell title="เล่นออนไลน์" onBack={onBack}>
        <p className="text-[15px] text-kram-700">ยังเล่นออนไลน์ไม่ได้ เพราะยังไม่ได้ตั้งค่า Pusher (NEXT_PUBLIC_PUSHER_KEY)</p>
      </Shell>
    );
  }

  return (
    <Shell title="เล่นออนไลน์" onBack={phase === 'choose' ? onBack : cancel} backLabel={phase === 'choose' ? '‹ เมนู' : '‹ ยกเลิก'}>
      {phase === 'choose' && (
        <div className="flex flex-col gap-3">
          <button type="button" className={`${primaryBtn} py-4 text-base`} onClick={() => enter('quick')}>
            หาคู่แข่งทันที
          </button>
          <button type="button" className={secondaryBtn} onClick={() => enter('create')}>
            สร้างห้องให้เพื่อนเข้า
          </button>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (/^\d{6}$/.test(code)) void enter('join', code);
              else toast('รหัสห้องต้องเป็นตัวเลข 6 หลัก', { tone: 'error' });
            }}
          >
            <label className="sr-only" htmlFor="room-code">
              รหัสห้อง
            </label>
            <input
              id="room-code"
              inputMode="numeric"
              autoComplete="off"
              placeholder="รหัสห้อง 6 หลัก"
              value={code}
              maxLength={6}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="min-w-0 flex-1 rounded-xl bg-kram-50 px-4 py-3 text-center font-display text-xl tracking-[0.3em] text-kram-950 ring-1 ring-kram-200 outline-none placeholder:font-sans placeholder:text-base placeholder:tracking-normal placeholder:text-kram-500 focus:ring-2 focus:ring-gold"
            />
            <button type="submit" className={primaryBtn}>
              เข้าห้อง
            </button>
          </form>
        </div>
      )}

      {phase === 'working' && <p className="py-8 text-center text-kram-700">กำลังเชื่อมต่อ…</p>}

      {phase === 'searching' && (
        <div className="py-6 text-center">
          <p className="font-display text-2xl font-bold">กำลังหาคู่แข่ง…</p>
          <p className="mt-2 text-sm text-kram-500">ถ้ามีคนกดหาคู่แข่งพร้อมกัน ระบบจะจับคู่ให้ทันที</p>
        </div>
      )}

      {phase === 'hosting' && room && (
        <div className="text-center">
          <p className="text-sm text-kram-500">ส่งรหัสนี้ให้เพื่อน</p>
          <p className="my-3 font-display text-5xl font-bold tracking-[0.2em] tabular-nums">{room.id}</p>
          <button type="button" className={`${secondaryBtn} w-full`} onClick={share}>
            ส่งลิงก์ห้อง
          </button>
          <p className="mt-4 text-sm text-kram-500">รอเพื่อนเข้าห้อง…</p>
        </div>
      )}

      {phase === 'paired' && room && (
        <div>
          <p className="mb-4 text-center text-sm text-kram-500">ห้อง {room.id}</p>
          <div className="mb-5 grid grid-cols-2 gap-2">
            {[
              { name: playerName, ready: myReady, you: true },
              { name: opponent ?? '…', ready: theirReady, you: false },
            ].map((p) => (
              <div key={String(p.you)} className={`rounded-xl p-4 text-center ${p.ready ? 'bg-kram-900 text-ivory' : 'bg-kram-50 text-kram-900'}`}>
                <p className="truncate font-semibold">
                  {p.name}
                  {p.you && <span className="opacity-60"> (คุณ)</span>}
                </p>
                <p className={`mt-1 text-sm ${p.ready ? 'text-gold-soft' : 'text-kram-500'}`}>{p.ready ? 'พร้อมแล้ว' : 'ยังไม่พร้อม'}</p>
              </div>
            ))}
          </div>
          <button type="button" className={`${primaryBtn} w-full py-4 text-base`} disabled={myReady} onClick={ready}>
            {myReady ? (theirReady ? 'กำลังเริ่มเกม…' : `รอ ${opponent ?? 'คู่แข่ง'} กดพร้อม`) : 'พร้อมเล่น'}
          </button>
        </div>
      )}
    </Shell>
  );
}

export function Shell({
  title,
  onBack,
  backLabel = '‹ เมนู',
  children,
  wide = false,
}: {
  title: string;
  onBack: () => void;
  backLabel?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center px-4 py-6">
      <div className={`w-full ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <button type="button" onClick={onBack} className="mb-4 rounded-lg px-2 py-1.5 text-sm font-medium text-kram-700 hover:bg-white">
          {backLabel}
        </button>
        <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
          <h1 className="mb-5 font-display text-2xl font-bold">{title}</h1>
          {children}
        </section>
      </div>
    </main>
  );
}
