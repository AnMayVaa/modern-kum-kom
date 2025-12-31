import { useEffect } from 'react';
import Pusher from 'pusher-js';

export const useMultiplayer = (
  mode: string,
  roomInfo: any,
  playerRole: number,
  setGrid: any,
  setScores: any,
  setCurrentPlayer: any,
  setTurnCount: any,
  setIsOpponentLeft: any
) => {
  useEffect(() => {
    if (mode === 'MULTI' && roomInfo?.id) {
      const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, { cluster: 'ap1', forceTLS: true });
      const channel = pusher.subscribe(`room-${roomInfo.id}`);

      channel.bind('opponent-disconnected', (data: any) => {
        if (Number(data.role) !== Number(playerRole)) setIsOpponentLeft(true);
      });

      channel.bind('move-made', (data: any) => {
        if (Number(data.senderRole) !== Number(playerRole)) {
          setGrid(data.newGrid);
          setScores(data.newScores);
          setCurrentPlayer(Number(data.nextTurn));
          setTurnCount((prev: number) => prev + 1);
        }
      });

      const handleUnload = () => {
        if (mode === 'MULTI') {
          navigator.sendBeacon('/api/multiplayer/match', JSON.stringify({
            action: 'player_left', roomId: roomInfo.id, role: playerRole
          }));
        }
      };

      window.addEventListener('beforeunload', handleUnload);
      return () => {
        window.removeEventListener('beforeunload', handleUnload);
        channel.unbind_all();
        pusher.unsubscribe(`room-${roomInfo.id}`);
        pusher.disconnect();
      };
    }
  }, [roomInfo?.id, playerRole]);
};