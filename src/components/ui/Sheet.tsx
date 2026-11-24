'use client';

import { useEffect, useRef } from 'react';

/** Modal dialog built on <dialog>: focus is trapped and Esc closes it. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose();
      }}
    >
      {open && (
        <div className="max-h-[85dvh] overflow-y-auto rounded-2xl bg-white p-5 text-kram-950 shadow-2xl sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="font-display text-xl font-bold leading-tight">{title}</h2>
            {dismissible && (
              <button
                type="button"
                onClick={onClose}
                className="-mr-1 -mt-1 rounded-lg px-2 py-1 text-sm text-kram-500 hover:bg-kram-50 hover:text-kram-900"
              >
                ปิด
              </button>
            )}
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
