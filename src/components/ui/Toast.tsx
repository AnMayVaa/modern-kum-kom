'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

type Tone = 'info' | 'success' | 'error';
interface ToastItem {
  id: number;
  title: string;
  body?: string;
  tone: Tone;
}

interface ToastApi {
  toast: (title: string, options?: { body?: string; tone?: Tone; ms?: number }) => void;
}

const ToastContext = createContext<ToastApi>({ toast: () => {} });
export const useToast = () => useContext(ToastContext);

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback<ToastApi['toast']>((title, { body, tone = 'info', ms = 3600 } = {}) => {
    const id = nextId++;
    setItems((list) => [...list.slice(-2), { id, title, body, tone }]);
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), ms);
  }, []);

  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={`toast pointer-events-auto w-full max-w-sm rounded-xl px-4 py-3 shadow-lg ring-1 ${
              t.tone === 'error'
                ? 'bg-chad text-white ring-black/10'
                : t.tone === 'success'
                  ? 'bg-kram-900 text-ivory ring-gold/40'
                  : 'bg-white text-kram-950 ring-kram-200'
            }`}
          >
            <p className="text-[15px] font-semibold leading-snug">{t.title}</p>
            {t.body && <p className="mt-0.5 text-[13px] leading-snug opacity-85">{t.body}</p>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
