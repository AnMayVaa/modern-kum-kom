'use client';

import { useCallback, useEffect, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { GameScreen, GameSetup } from '@/components/game/GameScreen';
import { Lobby, OnlineStart } from '@/components/screens/Lobby';
import { DictionaryScreen, IdentityScreen, MenuScreen, ProfileScreen } from '@/components/screens/Screens';
import type { BotLevel } from '@/lib/game/bot';
import { newGame } from '@/lib/game/state';
import { loadDictionary } from '@/lib/client/dictionary';
import { clearSolo, loadLevel, loadName, loadSolo, saveLevel, saveName } from '@/lib/client/storage';

type Screen =
  | { name: 'boot' }
  | { name: 'identity' }
  | { name: 'menu' }
  | { name: 'online'; joinCode: string | null }
  | { name: 'game'; setup: GameSetup }
  | { name: 'dictionary' }
  | { name: 'profile' };

export default function Home() {
  const { data: session, status } = useSession();
  const [screen, setScreen] = useState<Screen>({ name: 'boot' });
  const [guestName, setGuestName] = useState('');
  const [level, setLevel] = useState<BotLevel>('normal');
  const [hasSaved, setHasSaved] = useState(false);
  const [joinCode, setJoinCode] = useState<string | null>(null);

  const playerName = session?.user?.name || guestName;

  // Read what this device remembers, once, after the page has loaded.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    const code = room && /^\d{6}$/.test(room) ? room : null;
    if (code) window.history.replaceState(null, '', window.location.pathname);
    const timer = setTimeout(() => {
      setGuestName(loadName());
      setLevel(loadLevel());
      setHasSaved(!!loadSolo());
      setJoinCode(code);
    }, 0);
    // Start downloading the word list while the player is still on the menu.
    loadDictionary().catch(() => {});
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (screen.name !== 'boot' || status === 'loading') return;
    const timer = setTimeout(() => {
      const name = session?.user?.name || loadName();
      setScreen(name ? (joinCode ? { name: 'online', joinCode } : { name: 'menu' }) : { name: 'identity' });
    }, 0);
    return () => clearTimeout(timer);
  }, [screen.name, status, session, joinCode]);

  const toMenu = useCallback(() => {
    setHasSaved(!!loadSolo());
    setScreen({ name: 'menu' });
  }, []);

  const startSolo = useCallback(
    (lvl: BotLevel) => {
      clearSolo();
      setScreen({ name: 'game', setup: { mode: 'solo', state: newGame({ starter: 1 }), level: lvl, playerName: playerName || 'คุณ' } });
    },
    [playerName],
  );

  const startOnline = useCallback(
    (start: OnlineStart) =>
      setScreen({
        name: 'game',
        setup: { mode: 'online', state: start.state, me: start.me, roomId: start.roomId, playerName, opponentName: start.opponentName },
      }),
    [playerName],
  );

  switch (screen.name) {
    case 'boot':
      return <main className="min-h-dvh" />;
    case 'identity':
      return (
        <IdentityScreen
          initialName={guestName}
          onDone={(name) => {
            saveName(name);
            setGuestName(name);
            setScreen(joinCode ? { name: 'online', joinCode } : { name: 'menu' });
          }}
        />
      );
    case 'game':
      return (
        <GameScreen
          key={screen.setup.state.id}
          setup={screen.setup}
          onExit={toMenu}
          onRematch={screen.setup.mode === 'solo' ? () => startSolo(level) : undefined}
        />
      );
    case 'online':
      return (
        <Lobby
          playerName={playerName}
          joinCode={screen.joinCode}
          onBack={() => {
            setJoinCode(null);
            toMenu();
          }}
          onStart={startOnline}
        />
      );
    case 'dictionary':
      return <DictionaryScreen onBack={toMenu} />;
    case 'profile':
      return <ProfileScreen name={playerName} avatarUrl={session?.user?.image ?? null} onBack={toMenu} />;
    default:
      return (
        <MenuScreen
          name={playerName}
          level={level}
          onLevel={(l) => {
            setLevel(l);
            saveLevel(l);
          }}
          hasSavedGame={hasSaved}
          onSolo={() => startSolo(level)}
          onResume={() => {
            const saved = loadSolo();
            if (saved) setScreen({ name: 'game', setup: { mode: 'solo', state: saved.state, level: saved.level, playerName: playerName || 'คุณ' } });
          }}
          onOnline={() => setScreen({ name: 'online', joinCode: null })}
          onDictionary={() => setScreen({ name: 'dictionary' })}
          onProfile={() => setScreen({ name: 'profile' })}
          onRename={() => {
            saveName(null);
            if (session) void signOut({ redirect: false });
            setScreen({ name: 'identity' });
          }}
        />
      );
  }
}
