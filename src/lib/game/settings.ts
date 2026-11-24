// The choices offered when setting up a game.

import type { GameSettings, TimerSetting } from './state';

export const TIMER_OPTIONS: { id: string; label: string; note?: string; value: TimerSetting }[] = [
  { id: 'off', label: 'ไม่จับเวลา', value: { kind: 'off' } },
  { id: 'turn60', label: '1 นาทีต่อตา', value: { kind: 'turn', seconds: 60 } },
  { id: 'turn120', label: '2 นาทีต่อตา', note: 'ตามกติกา', value: { kind: 'turn', seconds: 120 } },
  { id: 'turn180', label: '3 นาทีต่อตา', value: { kind: 'turn', seconds: 180 } },
  { id: 'game15', label: '15 นาทีทั้งเกม', value: { kind: 'game', minutes: 15 } },
  { id: 'game25', label: '25 นาทีทั้งเกม', note: 'ตามกติกา', value: { kind: 'game', minutes: 25 } },
];

export const HINT_OPTIONS: { id: string; label: string; value: number | null }[] = [
  { id: 'unlimited', label: 'ไม่จำกัด', value: null },
  { id: 'three', label: '3 ครั้ง', value: 3 },
  { id: 'off', label: 'ไม่ใช้', value: 0 },
];

export const CHECK_OPTIONS: { id: string; label: string; note: string; value: boolean }[] = [
  { id: 'casual', label: 'บอกก่อนลง', note: 'เห็นว่าคำถูกหรือผิดก่อนกดลงคำ', value: false },
  { id: 'strict', label: 'แบบแข่งขัน', note: 'ไม่บอกล่วงหน้า ลงคำผิดเสียตานั้น', value: true },
];

export const timerId = (t: TimerSetting) =>
  TIMER_OPTIONS.find((o) => JSON.stringify(o.value) === JSON.stringify(t))?.id ?? 'off';

export function describeTimer(t: TimerSetting): string {
  if (t.kind === 'turn') return `${t.seconds / 60} นาทีต่อตา (หมดเวลาข้ามตา)`;
  if (t.kind === 'game') return `${t.minutes} นาทีทั้งเกม (เกินปรับนาทีละ 10 แต้ม)`;
  return 'ไม่จับเวลา';
}

/** One line describing a game's settings, e.g. "2 นาทีต่อตา · คำใบ้ 3 ครั้ง · แบบแข่งขัน". */
export function describeSettings(s: GameSettings, { hints = true } = {}): string {
  const parts = [s.timer.kind === 'off' ? 'ไม่จับเวลา' : TIMER_OPTIONS.find((o) => o.id === timerId(s.timer))?.label ?? describeTimer(s.timer)];
  if (hints) parts.push(s.hints === null ? 'คำใบ้ไม่จำกัด' : s.hints === 0 ? 'ไม่มีคำใบ้' : `คำใบ้ ${s.hints} ครั้ง`);
  parts.push(s.strict ? 'ตรวจคำแบบแข่งขัน' : 'บอกคำผิดก่อนลง');
  return parts.join(' · ');
}
