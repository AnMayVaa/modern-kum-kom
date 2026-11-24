'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Dictionary } from '@/lib/game/dictionary';
import { getLoadedDictionary, loadDictionary } from '@/lib/client/dictionary';

export function useDictionary() {
  const [dictionary, setDictionary] = useState<Dictionary | null>(() => getLoadedDictionary());
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (dictionary) return;
    let live = true;
    loadDictionary()
      .then((d) => {
        if (!live) return;
        setDictionary(d);
        setFailed(false);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [dictionary, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { dictionary, failed, retry };
}
