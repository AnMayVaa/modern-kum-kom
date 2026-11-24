'use client';

import { BOT_LEVELS, BotLevel } from '@/lib/game/bot';
import { CHECK_OPTIONS, HINT_OPTIONS, TIMER_OPTIONS, timerId } from '@/lib/game/settings';
import type { GameSettings } from '@/lib/game/state';

function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
  columns = 3,
}: {
  label: string;
  options: { id: T; label: string; note?: string }[];
  value: T;
  onChange: (id: T) => void;
  columns?: 2 | 3;
}) {
  const active = options.find((o) => o.id === value);
  return (
    <fieldset>
      <legend className="mb-1.5 flex w-full items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold text-kram-900">{label}</span>
        {active?.note && <span className="text-xs text-kram-500">{active.note}</span>}
      </legend>
      <div className={`grid gap-1 rounded-xl bg-kram-50 p-1 ${columns === 2 ? 'grid-cols-2' : 'grid-cols-3'}`} role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            onClick={() => onChange(o.id)}
            className={`rounded-lg px-1 py-2 text-[13px] font-medium leading-tight ${value === o.id ? 'bg-kram-900 text-ivory shadow-sm' : 'text-kram-700 hover:bg-white'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Game options: bot level (solo only), time limit, hints (solo only) and word checking. */
export function SetupForm({
  settings,
  onSettings,
  level,
  onLevel,
  online = false,
}: {
  settings: GameSettings;
  onSettings: (s: GameSettings) => void;
  level?: BotLevel;
  onLevel?: (l: BotLevel) => void;
  online?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {!online && level && onLevel && (
        <Choice
          label="ระดับบอท"
          options={BOT_LEVELS.map((l) => ({ id: l.id, label: l.label, note: l.hint }))}
          value={level}
          onChange={onLevel}
        />
      )}
      <Choice
        label="จับเวลา"
        options={TIMER_OPTIONS.map((o) => ({ id: o.id, label: o.label, note: o.note }))}
        value={timerId(settings.timer)}
        onChange={(id) => onSettings({ ...settings, timer: TIMER_OPTIONS.find((o) => o.id === id)!.value })}
      />
      {!online && (
        <Choice
          label="คำใบ้"
          options={HINT_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
          value={HINT_OPTIONS.find((o) => o.value === settings.hints)?.id ?? 'unlimited'}
          onChange={(id) => onSettings({ ...settings, hints: HINT_OPTIONS.find((o) => o.id === id)!.value })}
        />
      )}
      <Choice
        label="การตรวจคำ"
        columns={2}
        options={CHECK_OPTIONS.map((o) => ({ id: o.id, label: o.label, note: o.note }))}
        value={settings.strict ? 'strict' : 'casual'}
        onChange={(id) => onSettings({ ...settings, strict: id === 'strict' })}
      />
    </div>
  );
}
