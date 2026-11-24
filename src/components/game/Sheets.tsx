'use client';

import { useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { RackTileFace } from '@/components/ui/Tile';
import { BLANK_CHOICES, LOWER_VOWELS, TOP_MARKS, UPPER_VOWELS } from '@/lib/game/constants';
import { clusterText, isLowerContent } from '@/lib/game/thai';
import { countTiles } from '@/lib/game/tiles';
import type { GameState, PlayerId } from '@/lib/game/state';
import type { GameController } from '@/hooks/useGame';

const btn = 'rounded-xl px-4 py-3 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40';
export const primaryBtn = `${btn} bg-kram-900 text-ivory hover:bg-kram-800`;
export const secondaryBtn = `${btn} bg-kram-50 text-kram-900 ring-1 ring-kram-200 hover:bg-kram-100`;

/** Choosing the letter for a blank or a dual tile, or the marks for a mark cell. */
export function PickerSheet({ ctl }: { ctl: GameController }) {
  const p = ctl.picker;
  if (!p) return null;
  if (p.type === 'blank' || p.type === 'dual') {
    const letters = p.type === 'blank' ? BLANK_CHOICES : p.options;
    return (
      <Sheet open title={p.type === 'blank' ? 'เบี้ยว่างนี้ใช้แทนตัวอะไร' : 'ใช้เบี้ยนี้เป็นตัวไหน'} onClose={ctl.closePicker}>
        {p.type === 'blank' && <p className="mb-3 text-sm text-kram-500">เบี้ยว่างได้ 0 แต้ม</p>}
        <div className={`grid gap-2 ${p.type === 'dual' ? 'grid-cols-2' : 'grid-cols-6 sm:grid-cols-8'}`}>
          {letters.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => ctl.pickLetter(l)}
              className={`tile aspect-square w-full hover:ring-2 hover:ring-gold ${p.type === 'dual' ? 'text-5xl' : 'text-2xl'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </Sheet>
    );
  }

  const slot = ctl.markSlot(p.r, p.c);
  const hostRow = slot.current && isLowerContent(slot.current) ? p.r - 1 : slot.canUpper || !slot.canLower ? p.r + 1 : p.r - 1;
  const host = ctl.displayGrid[hostRow]?.[p.c] ?? '';
  const preview = host ? clusterText(host, isLowerContent(slot.current) ? '' : slot.current, isLowerContent(slot.current) ? slot.current : '') : '';
  const group = (title: string, marks: string[], enabled: boolean) => (
    <div>
      <p className="mb-1.5 text-sm text-kram-500">{title}</p>
      <div className="grid grid-cols-6 gap-2">
        {marks.map((m) => (
          <button
            key={m}
            type="button"
            disabled={!enabled}
            onClick={() => ctl.addMark(p.r, p.c, m)}
            className="tile aspect-square w-full text-3xl hover:ring-2 hover:ring-gold disabled:opacity-30"
            aria-label={`ใส่ ${m}`}
          >
            {`อ${m}`}
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <Sheet open title="ใส่สระหรือวรรณยุกต์" onClose={ctl.closePicker}>
      <div className="mb-4 flex items-center gap-4 rounded-xl bg-kram-50 p-3">
        <span className="tile h-14 w-14 text-4xl">{preview || host || '–'}</span>
        <p className="text-sm leading-relaxed text-kram-700">
          สระบนกับวรรณยุกต์ซ้อนกันได้ เช่น ที่ เกี่ยว แตะตัวอื่นเพื่อเปลี่ยน
          <br />
          เครื่องหมายไม่มีแต้ม และใช้ได้ไม่จำกัด
        </p>
      </div>
      <div className="flex flex-col gap-4">
        {group('สระบน', UPPER_VOWELS, slot.canUpper)}
        {group('วรรณยุกต์และเครื่องหมายบน', TOP_MARKS, slot.canUpper)}
        {group('สระล่าง', LOWER_VOWELS, slot.canLower)}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button type="button" className={secondaryBtn} disabled={!slot.hasDraft} onClick={() => ctl.clearMark(p.r, p.c)}>
          ล้างช่องนี้
        </button>
        <button type="button" className={primaryBtn} onClick={ctl.closePicker}>
          เสร็จ
        </button>
      </div>
    </Sheet>
  );
}

export function ExchangeSheet({ open, onClose, ctl }: { open: boolean; onClose: () => void; ctl: GameController }) {
  const [picked, setPicked] = useState<number[]>([]);
  const bag = ctl.game.bag.length;
  const close = () => {
    setPicked([]);
    onClose();
  };
  return (
    <Sheet open={open} title="แลกเบี้ยหรือข้ามตา" onClose={close}>
      <p className="mb-3 text-sm text-kram-700">
        แตะเบี้ยที่อยากเปลี่ยน แล้วจั่วใหม่จากถุงเท่าจำนวนที่แลก (ในถุงเหลือ {bag} ตัว) การแลกหรือข้ามตาไม่ได้แต้ม
      </p>
      <div className="mb-5 grid grid-cols-9 gap-1.5" style={{ ['--t' as string]: 'min(2.75rem, calc((100vw - 4.5rem) / 9.4))' }}>
        {ctl.rack.map((tile, i) => (
          <button
            key={i}
            type="button"
            aria-pressed={picked.includes(i)}
            onClick={() => setPicked((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]))}
            aria-label={tile === '0' ? 'เบี้ยว่าง' : tile}
            className={`tile aspect-square w-full text-[calc(var(--t)*0.6)] ${picked.includes(i) ? '-translate-y-1 ring-[3px] ring-chad' : ''}`}
          >
            <RackTileFace tile={tile} />
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className={secondaryBtn}
          onClick={() => {
            ctl.pass();
            close();
          }}
        >
          ข้ามตา
        </button>
        <button
          type="button"
          className={primaryBtn}
          disabled={picked.length === 0 || picked.length > bag}
          onClick={() => ctl.exchange(picked) && close()}
        >
          {picked.length === 0 ? 'เลือกเบี้ยที่จะแลก' : picked.length > bag ? `แลกได้ไม่เกิน ${bag} ตัว` : `แลก ${picked.length} ตัว`}
        </button>
      </div>
    </Sheet>
  );
}

/** Tiles this player hasn't seen yet: the bag plus the opponent's rack. */
export function BagSheet({ open, onClose, game, me }: { open: boolean; onClose: () => void; game: GameState; me: PlayerId }) {
  const unseen = countTiles([...game.bag, ...game.racks[me === 1 ? 2 : 1]]);
  return (
    <Sheet open={open} title="เบี้ยที่ยังไม่ออก" onClose={onClose}>
      <p className="mb-4 text-sm text-kram-700">
        รวมเบี้ยในถุง {game.bag.length} ตัวกับเบี้ยในมือคู่แข่ง ใช้กะว่าตัวไหนยังมีโอกาสออก
      </p>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
        {unseen.map(([tile, n]) => (
          <div key={tile} className="flex flex-col items-center gap-1">
            <span className="tile aspect-square w-full text-[1.4rem]">
              <RackTileFace tile={tile} />
            </span>
            <span className="text-xs tabular-nums text-kram-500">×{n}</span>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

export function RulesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} title="วิธีเล่นคำคม" onClose={onClose}>
      <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-kram-900">
        <Rule title="เป้าหมาย">ต่อคำภาษาไทยบนกระดานให้ได้แต้มมากกว่าคู่แข่ง ทุกคำต้องมีในพจนานุกรม</Rule>
        <Rule title="ลงคำ">
          แตะเบี้ยในมือ แล้วแตะช่องบนกระดาน เบี้ยทุกตัวในตาเดียวต้องเรียงอยู่ในแถวหรือคอลัมน์เดียวกันโดยไม่เว้นช่อง และต้องต่อกับคำที่มีอยู่แล้ว
          ตาแรกต้องวางผ่านช่องดาว ★ แตะเบี้ยที่เพิ่งวางเพื่อเก็บคืน
        </Rule>
        <Rule title="สระและวรรณยุกต์">
          ช่องบาง ๆ เหนือและใต้แต่ละช่องมีไว้ใส่สระบน สระล่าง และวรรณยุกต์ ใช้ได้ไม่จำกัดและไม่มีแต้ม แตะช่องเหนือหรือใต้ตัวอักษรเพื่อใส่
        </Rule>
        <Rule title="ช่องพิเศษ">
          2L 3L 4L คูณแต้มตัวอักษร 2W 3W และดาวคูณแต้มทั้งคำ ใช้ได้เฉพาะตาที่วางเบี้ยทับช่องนั้น ลงเบี้ย 6, 7, 8 หรือ 9 ตัวในตาเดียวได้โบนัส 40, 50, 70 หรือ 90 แต้ม
        </Rule>
        <Rule title="เบี้ยพิเศษ">
          เบี้ยว่างใช้แทนตัวอักษรใดก็ได้แต่ได้ 0 แต้ม เบี้ยคู่ เช่น ฆ/ซ เลือกได้ว่าจะใช้เป็นตัวไหน วางทับเบี้ยเดิมบนกระดานได้ตาละ 1 ตัว
        </Rule>
        <Rule title="จบเกม">
          เมื่อถุงหมดและมีคนลงเบี้ยหมดมือ คนนั้นได้แต้มเบี้ยที่เหลือในมือคู่แข่ง ×2 ถ้าข้ามหรือแลกเบี้ยติดกัน 6 ตา กระดานจะเริ่มใหม่ที่ดาว
          หรือถ้าถุงหมดแล้ว เกมจะจบและหักแต้มเบี้ยที่ค้างในมือ
        </Rule>
      </div>
    </Sheet>
  );
}

function Rule({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-0.5 font-semibold text-kram-900">{title}</h3>
      <p className="text-kram-700">{children}</p>
    </section>
  );
}
